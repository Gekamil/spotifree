import net from 'node:net';
import crypto from 'node:crypto';
import path from 'node:path';
import os from 'node:os';

/**
 * Native Zero-Dependency Discord Rich Presence (IPC) Client for Spotifree
 * Connects directly to Discord desktop client via local Named Pipe / Unix Socket.
 */

// Registered Discord Application IDs for Music RPC
export const DEFAULT_MUSIC_CLIENT_ID = process.env.DISCORD_CLIENT_ID || '714912685713424424';

const OPCODES = {
  HANDSHAKE: 0,
  FRAME: 1,
  CLOSE: 2,
  PING: 3,
  PONG: 4,
};

export class DiscordRpcClient {
  constructor(options = {}) {
    this.clientId = options.clientId || DEFAULT_MUSIC_CLIENT_ID;
    this.socket = null;
    this.connected = false;
    this.connecting = false;
    this.reconnectTimer = null;
    this.lastActivity = null;
    this.currentTrack = null;
    this.lastSentTimestamp = 0;
    this.pipeIndex = 0;
    this.logEnabled = options.verbose ?? false;
  }

  log(...args) {
    if (this.logEnabled) {
      console.log('[DiscordRPC]', ...args);
    }
  }

  getSocketPath(index = 0) {
    if (process.platform === 'win32') {
      return `\\\\.\\pipe\\discord-ipc-${index}`;
    }
    const env = process.env;
    const prefix = env.XDG_RUNTIME_DIR || env.TMPDIR || env.TMP || env.TEMP || '/tmp';
    return path.join(prefix, `discord-ipc-${index}`);
  }

  connect() {
    if (this.connected || this.connecting) return;
    this.connecting = true;

    const tryNextPipe = (idx) => {
      if (idx > 9) {
        this.connecting = false;
        this.scheduleReconnect(5000);
        return;
      }

      const socketPath = this.getSocketPath(idx);
      const socket = net.createConnection(socketPath, () => {
        this.connecting = false;
        this.connected = true;
        this.socket = socket;
        this.pipeIndex = idx;
        this.log(`Conectado a Discord en el canal IPC ${idx}`);

        // 1. Send Handshake
        this.sendPacket(OPCODES.HANDSHAKE, {
          v: 1,
          client_id: this.clientId,
        });

        // Re-apply last activity if present
        if (this.lastActivity) {
          this.sendActivityPayload(this.lastActivity);
        }
      });

      socket.on('data', (data) => {
        this.handleIncomingData(data);
      });

      socket.on('error', () => {
        // Socket failed, try next pipe index (0-9)
        socket.destroy();
        tryNextPipe(idx + 1);
      });

      socket.on('close', () => {
        if (this.socket === socket) {
          this.connected = false;
          this.socket = null;
          this.scheduleReconnect(5000);
        }
      });
    };

    tryNextPipe(0);
  }

  scheduleReconnect(delayMs = 5000) {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.connected) {
        this.connect();
      }
    }, delayMs);
    if (this.reconnectTimer && typeof this.reconnectTimer.unref === 'function') {
      this.reconnectTimer.unref();
    }
  }

  sendPacket(opcode, payload) {
    if (!this.socket || !this.connected) return false;
    try {
      const jsonStr = JSON.stringify(payload);
      const byteLength = Buffer.byteLength(jsonStr, 'utf8');
      const buffer = Buffer.alloc(8 + byteLength);
      buffer.writeInt32LE(opcode, 0);
      buffer.writeInt32LE(byteLength, 4);
      buffer.write(jsonStr, 8, 'utf8');
      this.socket.write(buffer);
      return true;
    } catch (err) {
      this.log('Error enviando paquete a Discord:', err.message);
      return false;
    }
  }

  handleIncomingData(buffer) {
    try {
      if (buffer.length < 8) return;
      const op = buffer.readInt32LE(0);
      const length = buffer.readInt32LE(4);
      if (buffer.length >= 8 + length) {
        const payloadStr = buffer.subarray(8, 8 + length).toString('utf8');
        const parsed = JSON.parse(payloadStr);
        if (parsed.evt === 'READY') {
          this.log('Handshake con Discord completado exitosamente.');
        } else if (parsed.evt === 'ERROR') {
          this.log('Discord RPC reportó error:', parsed.data);
        }
      }
    } catch {}
  }

  setClientId(newClientId) {
    if (!newClientId || newClientId === this.clientId) return;
    this.clientId = newClientId;
    if (this.connected && this.socket) {
      try {
        this.socket.destroy();
      } catch {}
      this.connected = false;
      this.connect();
    }
  }

  formatPresence({ track, isPlaying, progressMs = 0 }) {
    if (!track || !track.name || !isPlaying) {
      return null;
    }

    const now = Math.floor(Date.now() / 1000);
    const positionSec = Math.floor(progressMs / 1000);
    const durationSec = Math.max(1, Math.floor((track.duration_ms || 180000) / 1000));
    const startTimestamp = Math.max(0, now - positionSec);
    const endTimestamp = startTimestamp + durationSec;

    const artistStr = Array.isArray(track.artists)
      ? track.artists.map((a) => (typeof a === 'string' ? a : a?.name || '')).filter(Boolean).join(', ')
      : (typeof track.artist === 'string' ? track.artist : 'Spotifree');

    const cleanTitle = (track.name || 'Canción').slice(0, 128);
    const cleanArtist = (artistStr || 'Spotifree').slice(0, 128);
    const albumName = (track.album?.name || track.album || track.name || 'Spotifree').slice(0, 128);

    // Large image URL (album cover or Spotifree default)
    let coverUrl = track.coverUrl || track.album?.images?.[0]?.url || 'https://spotifree.app/icon-512.png';
    if (coverUrl.startsWith('//')) coverUrl = `https:${coverUrl}`;

    const activity = {
      type: 2, // 2 = LISTENING (Escuchando)
      details: cleanTitle,
      state: cleanArtist,
      timestamps: {
        start: startTimestamp,
        end: endTimestamp,
      },
      assets: {
        large_image: coverUrl,
        large_text: albumName,
        small_image: 'https://raw.githubusercontent.com/Gekamil/spotifree/main/public/icon-192.png',
        small_text: 'Spotifree',
      },
      buttons: [
        {
          label: 'Escuchar en Spotifree',
          url: `https://spotifree.app/?play=${encodeURIComponent(track.id || track.name)}`,
        },
      ],
      instance: false,
    };

    return activity;
  }

  updatePresence(presenceData) {
    this.currentTrack = presenceData.track || null;
    const formatted = this.formatPresence(presenceData);
    this.lastActivity = formatted;
    return this.sendActivityPayload(formatted);
  }

  sendActivityPayload(activity) {
    if (!this.connected) {
      this.connect();
      return false;
    }

    const payload = {
      cmd: 'SET_ACTIVITY',
      args: {
        pid: process.pid,
        activity: activity || null,
      },
      nonce: crypto.randomUUID(),
    };

    return this.sendPacket(OPCODES.FRAME, payload);
  }

  clearPresence() {
    this.currentTrack = null;
    this.lastActivity = null;
    return this.sendActivityPayload(null);
  }

  getStatus() {
    return {
      connected: this.connected,
      connecting: this.connecting,
      clientId: this.clientId,
      platform: process.platform,
      pipeIndex: this.pipeIndex,
      currentTrack: this.currentTrack,
    };
  }

  destroy() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.socket) {
      try {
        this.clearPresence();
        this.socket.destroy();
      } catch {}
    }
    this.connected = false;
    this.socket = null;
  }
}

// Global singleton instance for easy import in scripts or server
export const discordRpc = new DiscordRpcClient();
