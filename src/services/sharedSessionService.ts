/**
 * Spotifree Shared Session (Sesión Compartida / Jam Room)
 * Real-time synchronized co-listening, collaborative playlist & music queue,
 * live multiplayer cursor presence, and guest role protection.
 *
 * Dual architecture:
 * 1. WebRTC Peer-to-Peer DataChannels (instant sub-30ms cursor tracking & playback sync, zero firewall/auth barriers)
 * 2. Cloud Firestore Realtime Sync (persistent cloud state across all devices)
 */

import { create } from 'zustand';
import { db, isFirebaseConfigured } from './firebase';
import {
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  updateDoc,
  deleteField,
  type Unsubscribe,
} from 'firebase/firestore';
import type { Track } from '../types/spotify';
import { usePlayerStore } from '../store/usePlayerStore';
import { useUIStore } from '../store/useUIStore';
import { useSpotifyDataStore } from '../store/useSpotifyDataStore';

export interface SessionParticipant {
  id: string;
  name: string;
  color: string;
  isHost: boolean;
  lastSeen: number;
  /** Profile photo (a URL, or a small image) so friends see who is listening */
  avatar?: string;
  cursor?: {
    pctX: number;
    pctY: number;
    updatedAt: number;
  };
}

export interface SessionPlaybackState {
  track: Track | null;
  isPlaying: boolean;
  progressMs: number;
  updatedAt: number;
  actionOrigin: string;
  queue?: Track[];
}

export interface SharedSessionData {
  id: string;
  hostUid: string;
  hostName: string;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
  playback: SessionPlaybackState;
  participants: Record<string, SessionParticipant>;
}

export interface SharedSessionStore {
  isInSession: boolean;
  isHost: boolean;
  sessionId: string | null;
  sessionLink: string | null;
  hostName: string;
  myParticipantId: string;
  participants: SessionParticipant[];
  libraryViewMode: 'host' | 'my';
  setLibraryViewMode: (mode: 'host' | 'my') => void;
  isModalOpen: boolean;
  setModalOpen: (open: boolean) => void;
  updateMyName: (newName: string) => Promise<void>;
  createSession: (userName?: string) => Promise<string | null>;
  joinSession: (sessionId: string, userName?: string) => Promise<boolean>;
  leaveSession: () => Promise<void>;
  terminateSession: () => Promise<void>;
  broadcastPlayback: (track: Track | null, isPlaying: boolean, progressMs: number) => Promise<void>;
  broadcastCursor: (pctX: number, pctY: number) => void;
  _subscribeToSessionDoc: (sessionId: string) => void;
}

/** This account's profile photo for the session: its custom one or Spotify's (small enough to share) */
function myAvatar(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const u: any = useSpotifyDataStore.getState().user;
    const id = u?.id || window.localStorage.getItem('spotifree_active_user_id') || 'default';
    const raw = window.localStorage.getItem(`spotifree_custom_profile_${id}`) || window.localStorage.getItem('spotifree_custom_profile');
    const custom = raw ? JSON.parse(raw)?.avatarUrl : '';
    const url = custom || u?.images?.[0]?.url || '';
    // Web addresses always; an uploaded picture only if small (it travels inside the session)
    if (/^https?:\/\//.test(url) || (url.startsWith('data:image') && url.length < 60000)) return url;
  } catch {}
  return undefined;
}

const PARTICIPANT_COLORS = [
  '#1ed760', // Spotify Green
  '#ff4081', // Neon Pink
  '#00e5ff', // Cyan
  '#ffea00', // Electric Yellow
  '#b388ff', // Soft Purple
  '#ff9100', // Amber Orange
  '#00e676', // Bright Emerald
];

function getRandomColor(): string {
  return PARTICIPANT_COLORS[Math.floor(Math.random() * PARTICIPANT_COLORS.length)];
}

function generateSessionCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

let sessionDocUnsubscribe: Unsubscribe | null = null;
let lastCursorBroadcast = 0;
let lastFirestoreCursorWrite = 0;
let lastPlaybackOrigin = '';
let isApplyingRemoteSync = false;

export function getIsApplyingRemoteSync(): boolean {
  return isApplyingRemoteSync;
}

// WebRTC P2P mesh references
let peerInstance: any = null;
let guestConnections: any[] = [];
let hostConnection: any = null;
let p2pHeartbeatInterval: any = null;

const GLOBAL_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  { urls: 'stun:stun.services.mozilla.com' },
  { urls: 'stun:stun.cloudflare.com:3478' },
];

const PEER_BASE_CONFIG = {
  debug: 0,
  config: {
    iceServers: GLOBAL_ICE_SERVERS,
    iceCandidatePoolSize: 10,
  },
};

function cleanupP2P() {
  try {
    if (p2pHeartbeatInterval) {
      clearInterval(p2pHeartbeatInterval);
      p2pHeartbeatInterval = null;
    }
    if (guestConnections.length > 0) {
      guestConnections.forEach((c) => {
        try { c.close(); } catch {}
      });
      guestConnections = [];
    }
    if (hostConnection) {
      try { hostConnection.close(); } catch {}
      hostConnection = null;
    }
    if (peerInstance) {
      try { peerInstance.destroy(); } catch {}
      peerInstance = null;
    }
  } catch {}
}

function broadcastToAllP2P(message: any) {
  // If host, broadcast to all connected guests
  guestConnections.forEach((conn) => {
    try {
      if (conn && conn.open) {
        conn.send(message);
      }
    } catch {}
  });

  // If guest, send to host
  if (hostConnection && hostConnection.open) {
    try {
      hostConnection.send(message);
    } catch {}
  }
}

async function initP2PHost(sessionId: string, _hostParticipant: SessionParticipant) {
  cleanupP2P();
  if (typeof window === 'undefined') return;

  try {
    const PeerModule = await import('peerjs');
    const PeerClass = (PeerModule as any).default?.Peer || (PeerModule as any).Peer || (PeerModule as any).default;
    const hostPeerId = `spotifree-jam-${sessionId.toLowerCase().trim()}`;

    const peer = new PeerClass(hostPeerId, PEER_BASE_CONFIG);
    peerInstance = peer;

    peer.on('open', (id: string) => {
      console.log('[SharedSession P2P] Host live on WebRTC room ID:', id);
      // Keep-alive heartbeat every 3.5s across router NATs
      if (p2pHeartbeatInterval) clearInterval(p2pHeartbeatInterval);
      p2pHeartbeatInterval = setInterval(() => {
        broadcastToAllP2P({ type: 'ping' });
      }, 3500);
    });

    peer.on('connection', (conn: any) => {
      console.log('[SharedSession P2P] Guest connected via WebRTC:', conn.peer);
      guestConnections.push(conn);

      conn.on('data', (data: any) => {
        handleIncomingP2PAsHost(data, conn);
      });

      conn.on('close', () => {
        guestConnections = guestConnections.filter((c) => c !== conn);
      });

      conn.on('error', () => {
        guestConnections = guestConnections.filter((c) => c !== conn);
      });
    });

    peer.on('error', (err: any) => {
      console.warn('[SharedSession P2P] Host peer notice:', err?.type || err);
    });
  } catch (err) {
    console.warn('[SharedSession P2P] Could not start P2P host:', err);
  }
}

function handleIncomingP2PAsHost(data: any, senderConn: any) {
  if (!data || !data.type) return;

  // Keep-alive ping
  if (data.type === 'ping') return;

  const store = useSharedSessionStore.getState();

  // 1. Guest joins session
  if (data.type === 'join' && data.participant) {
    const guest: SessionParticipant = data.participant;
    const currentList = store.participants.filter((p) => p.id !== guest.id);
    const updatedParticipants = [...currentList, guest];

    useSharedSessionStore.setState({ participants: updatedParticipants });

    // Send full state synchronization package back to this guest
    const player = usePlayerStore.getState();
    senderConn.send({
      type: 'sync',
      hostName: store.hostName,
      participants: updatedParticipants,
      playback: {
        track: player.currentTrack,
        isPlaying: player.isPlaying,
        progressMs: player.progressMs,
        updatedAt: Date.now(),
        actionOrigin: store.myParticipantId,
        queue: player.queue.slice(0, 50),
      },
    });

    // Notify other connected guests
    guestConnections.forEach((c) => {
      if (c !== senderConn && c.open) {
        c.send({
          type: 'participants_update',
          participants: updatedParticipants,
        });
      }
    });
  }

  // 2. Cursor movement from guest
  if (data.type === 'cursor') {
    const { participantId, pctX, pctY, updatedAt } = data;
    useSharedSessionStore.setState((s) => ({
      participants: s.participants.map((p) =>
        p.id === participantId
          ? { ...p, cursor: { pctX, pctY, updatedAt: updatedAt || Date.now() }, lastSeen: Date.now() }
          : p
      ),
    }));

    // Forward cursor to other guests
    guestConnections.forEach((c) => {
      if (c !== senderConn && c.open) {
        c.send(data);
      }
    });
  }

  // 3. Playback control from guest
  if (data.type === 'playback') {
    applySynchronizedPlayback(data);
    // Forward to all other guests
    guestConnections.forEach((c) => {
      if (c !== senderConn && c.open) {
        c.send(data);
      }
    });
  }

  // 4. Guest renamed themselves
  if (data.type === 'rename' && data.participantId && data.name) {
    useSharedSessionStore.setState((s) => ({
      participants: s.participants.map((p) =>
        p.id === data.participantId ? { ...p, name: data.name } : p
      ),
    }));
    // Forward rename to other guests
    guestConnections.forEach((c) => {
      if (c !== senderConn && c.open) {
        c.send(data);
      }
    });
  }

  // 5. Guest disconnected or left session
  if (data.type === 'leave' && data.participantId) {
    useSharedSessionStore.setState((s) => ({
      participants: s.participants.filter((p) => p.id !== data.participantId),
    }));
    guestConnections.forEach((c) => {
      if (c !== senderConn && c.open) {
        c.send(data);
      }
    });
  }
}

async function initP2PGuest(sessionId: string, guestParticipant: SessionParticipant) {
  cleanupP2P();
  if (typeof window === 'undefined') return;

  try {
    const PeerModule = await import('peerjs');
    const PeerClass = (PeerModule as any).default?.Peer || (PeerModule as any).Peer || (PeerModule as any).default;
    const hostPeerId = `spotifree-jam-${sessionId.toLowerCase().trim()}`;

    const peer = new PeerClass(PEER_BASE_CONFIG);
    peerInstance = peer;

    let attempts = 0;
    let isConnected = false;
    let retryTimer: any = null;

    const tryConnect = () => {
      if (isConnected || !peerInstance || peerInstance.destroyed) return;
      attempts++;
      console.log(`[SharedSession P2P] Guest connecting to host (${attempts}/6):`, hostPeerId);

      try {
        const conn = peer.connect(hostPeerId, { reliable: true });
        hostConnection = conn;

        conn.on('open', () => {
          console.log('[SharedSession P2P] Connected to host DataChannel!');
          isConnected = true;
          if (retryTimer) {
            clearTimeout(retryTimer);
            retryTimer = null;
          }

          conn.send({
            type: 'join',
            participant: guestParticipant,
          });

          // Keep-alive heartbeat every 3.5s across NAT routers
          if (p2pHeartbeatInterval) clearInterval(p2pHeartbeatInterval);
          p2pHeartbeatInterval = setInterval(() => {
            if (hostConnection && hostConnection.open) {
              hostConnection.send({ type: 'ping' });
            }
          }, 3500);
        });

        conn.on('data', (data: any) => {
          handleIncomingP2PAsGuest(data);
        });

        conn.on('close', () => {
          console.log('[SharedSession P2P] Host closed connection');
          isConnected = false;
        });

        conn.on('error', (e: any) => {
          console.warn('[SharedSession P2P] DataChannel attempt error:', e);
          if (!isConnected && attempts < 6) {
            retryTimer = setTimeout(tryConnect, 2000);
          }
        });
      } catch (err) {
        console.warn('[SharedSession P2P] Connect exception:', err);
        if (!isConnected && attempts < 6) {
          retryTimer = setTimeout(tryConnect, 2000);
        }
      }
    };

    peer.on('open', () => {
      console.log('[SharedSession P2P] Guest peer ready');
      tryConnect();
    });

    peer.on('error', (err: any) => {
      console.warn('[SharedSession P2P] Guest peer notice:', err?.type || err);
      if (err?.type === 'peer-unavailable' && !isConnected && attempts < 6) {
        if (retryTimer) clearTimeout(retryTimer);
        retryTimer = setTimeout(tryConnect, 2500);
      }
    });
  } catch (err) {
    console.warn('[SharedSession P2P] Could not start P2P guest:', err);
  }
}

function handleIncomingP2PAsGuest(data: any) {
  if (!data || !data.type) return;

  // Keep-alive ping
  if (data.type === 'ping') return;

  // 1. Initial full state sync
  if (data.type === 'sync') {
    useSharedSessionStore.setState({
      hostName: data.hostName || 'Anfitrión',
      participants: data.participants || [],
    });

    if (data.playback && data.playback.track) {
      applySynchronizedPlayback(data.playback);
    }
  }

  // 2. Participant list update
  if (data.type === 'participants_update' && Array.isArray(data.participants)) {
    useSharedSessionStore.setState({ participants: data.participants });
  }

  // 3. Cursor movement
  if (data.type === 'cursor') {
    const { participantId, pctX, pctY, updatedAt } = data;
    useSharedSessionStore.setState((s) => ({
      participants: s.participants.map((p) =>
        p.id === participantId
          ? { ...p, cursor: { pctX, pctY, updatedAt: updatedAt || Date.now() }, lastSeen: Date.now() }
          : p
      ),
    }));
  }

  // 4. Playback change
  if (data.type === 'playback') {
    applySynchronizedPlayback(data);
  }

  // 5. Another participant renamed themselves
  if (data.type === 'rename' && data.participantId && data.name) {
    useSharedSessionStore.setState((s) => ({
      participants: s.participants.map((p) =>
        p.id === data.participantId ? { ...p, name: data.name } : p
      ),
    }));
  }

  // 6. Another participant left or closed tab
  if (data.type === 'leave' && data.participantId) {
    useSharedSessionStore.setState((s) => ({
      participants: s.participants.filter((p) => p.id !== data.participantId),
    }));
  }

  // 7. Host ended session
  if (data.type === 'terminate') {
    alert('La sesión compartida ha sido finalizada por el anfitrión.');
    useSharedSessionStore.getState().leaveSession();
  }
}

function applySynchronizedPlayback(pb: any) {
  if (!pb) return;
  const player = usePlayerStore.getState();
  const myId = useSharedSessionStore.getState().myParticipantId;

  if (pb.actionOrigin === myId) return;

  isApplyingRemoteSync = true;
  try {
    const elapsed = pb.isPlaying && pb.updatedAt ? Math.max(0, Date.now() - pb.updatedAt) : 0;
    const expectedProgress = (pb.progressMs || 0) + elapsed;

    // Track change
    const curClean = (player.currentTrack?.id || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
    const pbClean = (pb.track?.id || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
    if (pb.track && pbClean && pbClean !== curClean) {
      player.playTrack(pb.track, pb.queue);
    }

    // Play / Pause state
    if (typeof pb.isPlaying === 'boolean' && pb.isPlaying !== player.isPlaying) {
      usePlayerStore.setState({ isPlaying: pb.isPlaying });
      const engine = typeof window !== 'undefined' ? (window as any).__audioEngine : null;
      if (engine) {
        if (pb.isPlaying) {
          engine.unlockAudio?.();
          engine.resume?.();
        } else {
          engine.pause?.();
        }
      }
    }

    // Seek synchronization (>7s drift while playing, or >2s when paused)
    const drift = Math.abs(player.progressMs - expectedProgress);
    const shouldSeek = (!pb.isPlaying && drift > 2000) || (pb.isPlaying && drift > 7000);

    if (typeof pb.progressMs === 'number' && shouldSeek) {
      player.setProgress(expectedProgress);
      const engine = typeof window !== 'undefined' ? (window as any).__audioEngine : null;
      if (engine) {
        engine.seek?.(expectedProgress / 1000);
      }
    }
  } finally {
    setTimeout(() => {
      isApplyingRemoteSync = false;
    }, 600);
  }
}

export const useSharedSessionStore = create<SharedSessionStore>((set, get) => ({
  isInSession: false,
  isHost: false,
  sessionId: null,
  sessionLink: null,
  hostName: '',
  myParticipantId: typeof window !== 'undefined' ? (window.localStorage.getItem('spotifree_session_pid') || `p_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`) : 'p_default',
  participants: [],
  libraryViewMode: 'host',
  setLibraryViewMode: (mode: 'host' | 'my') => set({ libraryViewMode: mode }),
  isModalOpen: false,

  setModalOpen: (open: boolean) => set({ isModalOpen: open }),

  updateMyName: async (newName: string) => {
    const cleanName = newName.trim();
    if (!cleanName) return;
    const { myParticipantId, sessionId, isHost } = get();
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('spotifree_session_name', cleanName);
    }

    set((s) => ({
      hostName: isHost ? cleanName : s.hostName,
      participants: s.participants.map((p) =>
        p.id === myParticipantId ? { ...p, name: cleanName } : p
      ),
    }));

    broadcastToAllP2P({
      type: 'rename',
      participantId: myParticipantId,
      name: cleanName,
    });

    if (db && isFirebaseConfigured() && sessionId) {
      try {
        const sessionRef = doc(db, 'shared_sessions', sessionId);
        const updates: any = {
          [`participants.${myParticipantId}.name`]: cleanName,
          updatedAt: Date.now(),
        };
        if (isHost) {
          updates.hostName = cleanName;
        }
        await updateDoc(sessionRef, updates);
      } catch {}
    }
  },

  createSession: async (userName = 'Anfitrión') => {
    const { myParticipantId } = get();
    const sessionId = generateSessionCode();
    const color = PARTICIPANT_COLORS[0];
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const sessionLink = `${origin}/?session=${sessionId}`;

    const hostParticipant: SessionParticipant = {
      id: myParticipantId,
      name: userName || 'Anfitrión',
      color,
      isHost: true,
      lastSeen: Date.now(),
      ...(myAvatar() ? { avatar: myAvatar() } : {}),
    };

    const initialPlayback: SessionPlaybackState = {
      track: usePlayerStore.getState().currentTrack,
      isPlaying: usePlayerStore.getState().isPlaying,
      progressMs: usePlayerStore.getState().progressMs,
      updatedAt: Date.now(),
      actionOrigin: myParticipantId,
      queue: usePlayerStore.getState().queue.slice(0, 50),
    };

    const sessionData: SharedSessionData = {
      id: sessionId,
      hostUid: myParticipantId,
      hostName: userName || 'Anfitrión',
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      playback: initialPlayback,
      participants: {
        [myParticipantId]: hostParticipant,
      },
    };

    // Activate state immediately
    set({
      isInSession: true,
      isHost: true,
      sessionId,
      sessionLink,
      hostName: userName || 'Anfitrión',
      participants: [hostParticipant],
      isModalOpen: true,
    });

    // 1. Initialize WebRTC P2P Host (direct peer connections without permission roadblocks)
    initP2PHost(sessionId, hostParticipant);

    // 2. Dual-write to Cloud Firestore if configured
    if (isFirebaseConfigured() && db) {
      try {
        const sessionRef = doc(db, 'shared_sessions', sessionId);
        await setDoc(sessionRef, sessionData);
        get()._subscribeToSessionDoc(sessionId);
      } catch (e) {
        console.warn('[SharedSession] Firestore cloud sync notice (P2P active):', e);
      }
    }

    return sessionId;
  },

  joinSession: async (sessionId: string, userName?: string) => {
    if (!sessionId || !sessionId.trim()) return false;
    const cleanId = sessionId.trim().toUpperCase();
    const { myParticipantId } = get();
    const color = getRandomColor();
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const sessionLink = `${origin}/?session=${cleanId}`;

    // Clean up any old session
    cleanupP2P();
    if (sessionDocUnsubscribe) {
      sessionDocUnsubscribe();
      sessionDocUnsubscribe = null;
    }

    const savedName = typeof window !== 'undefined' ? window.localStorage.getItem('spotifree_session_name') : null;
    let initialName = savedName || userName || 'Invitado 1';

    const guestParticipant: SessionParticipant = {
      id: myParticipantId,
      name: initialName,
      color,
      isHost: false,
      lastSeen: Date.now(),
      ...(myAvatar() ? { avatar: myAvatar() } : {}),
    };

    // 1. Fetch from Firestore first to verify the session is active before joining
    if (isFirebaseConfigured() && db) {
      try {
        const sessionRef = doc(db, 'shared_sessions', cleanId);
        const snap = await getDoc(sessionRef);

        if (!snap.exists()) {
          console.warn('[SharedSession] Session does not exist:', cleanId);
          if (typeof window !== 'undefined' && window.location.search.includes('session=')) {
            const cleanUrl = window.location.pathname + window.location.hash;
            window.history.replaceState({}, document.title, cleanUrl);
          }
          return false;
        }

        const data = snap.data() as SharedSessionData;
        if (!data || !data.isActive) {
          console.warn('[SharedSession] Session is no longer active (closed by host):', cleanId);
          if (typeof window !== 'undefined' && window.location.search.includes('session=')) {
            const cleanUrl = window.location.pathname + window.location.hash;
            window.history.replaceState({}, document.title, cleanUrl);
          }
          return false;
        }

        // Determine guest number if no saved nickname
        if (!savedName && (!userName || userName === 'Invitado')) {
          const existingGuests = Object.values(data.participants || {}).filter((p) => !p.isHost).length;
          initialName = `Invitado ${existingGuests + 1}`;
          guestParticipant.name = initialName;
        }

        const currentParticipants = Object.values(data.participants || {});
        const updatedList = [...currentParticipants.filter((p) => p.id !== myParticipantId), guestParticipant];

        set({
          isInSession: true,
          isHost: false,
          sessionId: cleanId,
          sessionLink,
          hostName: data.hostName || 'Anfitrión',
          participants: updatedList,
          isModalOpen: true,
        });

        useUIStore.setState({ activeRightSidebar: 'friends' });

        await updateDoc(sessionRef, {
          [`participants.${myParticipantId}`]: guestParticipant,
          updatedAt: Date.now(),
        });

        if (data.playback && data.playback.track) {
          applySynchronizedPlayback(data.playback);
        }

        get()._subscribeToSessionDoc(cleanId);
        initP2PGuest(cleanId, guestParticipant);
        return true;
      } catch (e) {
        console.warn('[SharedSession] Firestore validation error:', e);
        if (typeof window !== 'undefined' && window.location.search.includes('session=')) {
          const cleanUrl = window.location.pathname + window.location.hash;
          window.history.replaceState({}, document.title, cleanUrl);
        }
        return false;
      }
    }

    return false;
  },

  leaveSession: async () => {
    const { sessionId, isHost } = get();

    cleanupP2P();

    if (sessionId && db && isFirebaseConfigured()) {
      try {
        const sessionRef = doc(db, 'shared_sessions', sessionId);
        if (isHost) {
          await updateDoc(sessionRef, {
            isActive: false,
            updatedAt: Date.now(),
          });
        }
      } catch {}
    }

    if (sessionDocUnsubscribe) {
      sessionDocUnsubscribe();
      sessionDocUnsubscribe = null;
    }

    if (typeof window !== 'undefined' && window.location.search.includes('session=')) {
      const cleanUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, document.title, cleanUrl);
    }

    set({
      isInSession: false,
      isHost: false,
      sessionId: null,
      sessionLink: null,
      participants: [],
      isModalOpen: false,
    });
  },

  terminateSession: async () => {
    const { isHost } = get();
    if (!isHost) return;

    // Send terminate signal over P2P DataChannel
    broadcastToAllP2P({ type: 'terminate' });

    get().leaveSession();
  },

  broadcastPlayback: async (track: Track | null, isPlaying: boolean, progressMs: number) => {
    const { isInSession, sessionId, myParticipantId } = get();
    if (!isInSession || !sessionId) return;

    lastPlaybackOrigin = myParticipantId;

    const playbackPayload = {
      type: 'playback',
      track,
      isPlaying,
      progressMs,
      updatedAt: Date.now(),
      actionOrigin: myParticipantId,
      queue: usePlayerStore.getState().queue.slice(0, 50),
    };

    // 1. Broadcast over WebRTC DataChannel (instantaneous, sub-30ms)
    broadcastToAllP2P(playbackPayload);

    // 2. Sync to Cloud Firestore if connected
    if (db && isFirebaseConfigured()) {
      try {
        const sessionRef = doc(db, 'shared_sessions', sessionId);
        await updateDoc(sessionRef, {
          playback: {
            track,
            isPlaying,
            progressMs,
            updatedAt: Date.now(),
            actionOrigin: myParticipantId,
            queue: usePlayerStore.getState().queue.slice(0, 50),
          },
          updatedAt: Date.now(),
        });
      } catch {}
    }
  },

  broadcastCursor: (pctX: number, pctY: number) => {
    const { isInSession, sessionId, myParticipantId } = get();
    if (!isInSession || !sessionId) return;

    const now = Date.now();
    if (now - lastCursorBroadcast < 16) return; // 60fps for instant fluid response
    lastCursorBroadcast = now;

    const cursorPayload = {
      type: 'cursor',
      participantId: myParticipantId,
      pctX: Math.round(pctX * 1000) / 1000,
      pctY: Math.round(pctY * 1000) / 1000,
      updatedAt: now,
    };

    // 1. Broadcast over WebRTC DataChannel directly to peers
    broadcastToAllP2P(cursorPayload);

    // Update local cursor state
    useSharedSessionStore.setState((s) => ({
      participants: s.participants.map((p) =>
        p.id === myParticipantId
          ? { ...p, cursor: { pctX: cursorPayload.pctX, pctY: cursorPayload.pctY, updatedAt: now }, lastSeen: now }
          : p
      ),
    }));

    // 2. Throttle Firestore cursor writes to once every 1.5 seconds to respect write quotas
    if (db && isFirebaseConfigured() && (now - lastFirestoreCursorWrite > 1500)) {
      lastFirestoreCursorWrite = now;
      try {
        const sessionRef = doc(db, 'shared_sessions', sessionId);
        updateDoc(sessionRef, {
          [`participants.${myParticipantId}.cursor`]: cursorPayload,
          [`participants.${myParticipantId}.lastSeen`]: now,
        }).catch(() => {});
      } catch {}
    }
  },

  _subscribeToSessionDoc: (sessionId: string) => {
    if (sessionDocUnsubscribe) {
      sessionDocUnsubscribe();
      sessionDocUnsubscribe = null;
    }

    if (!db) return;
    const sessionRef = doc(db, 'shared_sessions', sessionId);

    sessionDocUnsubscribe = onSnapshot(sessionRef, (snap) => {
      if (!snap.exists()) {
        get().leaveSession();
        return;
      }

      const data = snap.data() as SharedSessionData;

      if (!data.isActive) {
        alert('La sesión compartida ha sido finalizada por el anfitrión.');
        get().leaveSession();
        return;
      }

      const { myParticipantId } = get();
      const participantsList = Object.values(data.participants || {});
      set({
        participants: participantsList,
        hostName: data.hostName || 'Anfitrión',
      });

      if (data.playback && data.playback.actionOrigin !== myParticipantId && data.playback.actionOrigin !== lastPlaybackOrigin) {
        applySynchronizedPlayback(data.playback);
      }
    }, (error) => {
      console.warn('[SharedSession] Firestore subscription notice (using WebRTC P2P):', error);
    });
  },
}));

// Automatic cleanup when tab or browser is closed
if (typeof window !== 'undefined') {
  const notifyLeaveOnUnload = () => {
    try {
      const s = useSharedSessionStore.getState();
      if (!s.isInSession || !s.sessionId) return;
      broadcastToAllP2P({ type: 'leave', participantId: s.myParticipantId });
      if (db && isFirebaseConfigured()) {
        const sessionRef = doc(db, 'shared_sessions', s.sessionId);
        if (s.isHost) {
          updateDoc(sessionRef, { isActive: false, updatedAt: Date.now() }).catch(() => {});
        } else {
          updateDoc(sessionRef, {
            [`participants.${s.myParticipantId}`]: deleteField(),
            updatedAt: Date.now(),
          }).catch(() => {});
        }
      }
    } catch {}
  };

  window.addEventListener('beforeunload', notifyLeaveOnUnload);
  window.addEventListener('pagehide', notifyLeaveOnUnload);
}
