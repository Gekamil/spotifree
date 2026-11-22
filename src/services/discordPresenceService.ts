import { create } from 'zustand';
import { usePlayerStore, resolveTrackCover } from '../store/usePlayerStore';

interface DiscordBridgeStatus {
  connected: boolean;
  connecting: boolean;
  clientId: string;
  platform: string;
  pipeIndex?: number;
}

interface DiscordPresenceState {
  enabled: boolean;
  bridgeActive: boolean;
  discordConnected: boolean;
  clientId: string;
  lastSyncError: string | null;
  lastSyncedTrack: string | null;
  workingBaseUrl: string | null;

  // Actions
  setEnabled: (enabled: boolean) => void;
  setClientId: (clientId: string) => Promise<void>;
  checkStatus: () => Promise<boolean>;
  syncPresence: () => Promise<void>;
  clearPresence: () => Promise<void>;
}

const STORAGE_KEY_ENABLED = 'spotifree_discord_rpc_enabled';
const STORAGE_KEY_CLIENT_ID = 'spotifree_discord_client_id';

const CANDIDATE_BRIDGE_URLS = [
  '', // Same-origin relative path (when served by server.mjs)
  'http://127.0.0.1:3001',
  'http://localhost:3001',
  'http://127.0.0.1:10000',
  'http://localhost:10000',
];

export const useDiscordPresenceStore = create<DiscordPresenceState>((set, get) => ({
  enabled: typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_ENABLED) !== 'false' : true,
  bridgeActive: false,
  discordConnected: false,
  clientId: typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_CLIENT_ID) || '' : '',
  lastSyncError: null,
  lastSyncedTrack: null,
  workingBaseUrl: null,

  setEnabled: (enabled: boolean) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_ENABLED, String(enabled));
    }
    set({ enabled });
    if (!enabled) {
      get().clearPresence().catch(() => {});
    } else {
      get().syncPresence().catch(() => {});
    }
  },

  setClientId: async (clientId: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_CLIENT_ID, clientId);
    }
    set({ clientId });
    const baseUrl = get().workingBaseUrl || '';
    try {
      await fetch(`${baseUrl}/api/discord/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId }),
      });
      await get().checkStatus();
    } catch {}
  },

  checkStatus: async () => {
    for (const base of CANDIDATE_BRIDGE_URLS) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1200);
        const res = await fetch(`${base}/api/discord/status`, {
          signal: controller.signal,
          mode: 'cors',
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data: DiscordBridgeStatus = await res.json();
          set({
            bridgeActive: true,
            discordConnected: !!data.connected,
            workingBaseUrl: base,
            clientId: data.clientId || get().clientId,
            lastSyncError: null,
          });
          return true;
        }
      } catch {
        // Try next candidate silently
      }
    }

    set({ bridgeActive: false, discordConnected: false });
    return false;
  },

  syncPresence: async () => {
    if (!get().enabled) return;

    const playerState = usePlayerStore.getState();
    const currentTrack = playerState.currentTrack;
    const isPlaying = playerState.isPlaying;

    if (!currentTrack || !isPlaying) {
      await get().clearPresence();
      return;
    }

    let baseUrl = get().workingBaseUrl;
    if (baseUrl === null) {
      await get().checkStatus();
      baseUrl = get().workingBaseUrl;
    }

    if (baseUrl === null) {
      // Bridge server is not running on user machine
      return;
    }

    try {
      let coverUrl = resolveTrackCover(currentTrack);
      if (!coverUrl && currentTrack.album?.images?.[0]?.url) {
        coverUrl = currentTrack.album.images[0].url;
      }

      const payload = {
        track: {
          id: currentTrack.id,
          name: currentTrack.name,
          artists: currentTrack.artists?.map((a) => a.name) || ['Spotifree'],
          album: currentTrack.album?.name || 'Spotifree',
          duration_ms: currentTrack.duration_ms || 180000,
          coverUrl: coverUrl || undefined,
        },
        isPlaying,
        progressMs: playerState.progressMs || 0,
      };

      const res = await fetch(`${baseUrl}/api/discord/presence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        mode: 'cors',
      });

      if (res.ok) {
        set({
          lastSyncedTrack: currentTrack.name,
          lastSyncError: null,
          bridgeActive: true,
        });
      }
    } catch (err: any) {
      set({ lastSyncError: err?.message || 'Error de sincronización' });
    }
  },

  clearPresence: async () => {
    const baseUrl = get().workingBaseUrl;
    if (baseUrl === null) return;
    try {
      await fetch(`${baseUrl}/api/discord/clear`, {
        method: 'POST',
        mode: 'cors',
      });
      set({ lastSyncedTrack: null });
    } catch {}
  },
}));

// Initialize player synchronization listener
let syncDebounceTimer: any = null;
let lastSyncedTrackId: string | null = null;
let lastSyncedPlayingState: boolean | null = null;

export function initDiscordPresenceSync() {
  if (typeof window === 'undefined') return;

  // Initial connection probe
  useDiscordPresenceStore.getState().checkStatus().catch(() => {});

  // Periodic health check every 15 seconds
  setInterval(() => {
    useDiscordPresenceStore.getState().checkStatus().catch(() => {});
  }, 15000);

  // Subscribe to player store changes
  usePlayerStore.subscribe((state) => {
    const store = useDiscordPresenceStore.getState();
    if (!store.enabled) return;

    const trackId = state.currentTrack?.id || null;
    const isPlaying = state.isPlaying;

    // Detect immediate state transition (play/pause or track switch)
    const isImmediateChange = trackId !== lastSyncedTrackId || isPlaying !== lastSyncedPlayingState;

    if (isImmediateChange) {
      lastSyncedTrackId = trackId;
      lastSyncedPlayingState = isPlaying;
      if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
      syncDebounceTimer = setTimeout(() => {
        store.syncPresence().catch(() => {});
      }, 200);
    } else {
      // Debounce progress timeline updates
      if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
      syncDebounceTimer = setTimeout(() => {
        store.syncPresence().catch(() => {});
      }, 2000);
    }
  });
}
