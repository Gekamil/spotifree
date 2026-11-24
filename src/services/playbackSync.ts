import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import type { Track } from '../types/spotify';
import { usePlayerStore, sanitizeTrack, hydrateTrackCoverSync } from '../store/usePlayerStore';
import { saveLastPlaybackToFirestore, slimPlaybackSnapshotForCloud } from './firebase';

export interface SyncedDJState {
  isDJModeActive: boolean;
  currentSetTitle: string;
  activeSegmentId: string | null;
  djTracks: Track[];
}

export interface SyncedPlaybackSnapshot {
  version: 1;
  updatedAt: number;
  deviceId: string;
  wasPlaying: boolean;
  progressMs: number;
  durationMs: number;
  currentContextId: string | null;
  currentContextName: string | null;
  shuffleMode: 'off' | 'all' | 'smart';
  isShuffle: boolean;
  repeatMode: 'off' | 'all' | 'one';
  playedInShuffle: string[];
  preselectedNextTrackId: string | null;
  currentTrack: Track;
  queue: Track[];
  originalQueue: Track[];
  djState: SyncedDJState | null;
}

const LOCAL_PLAYBACK_PREFIX = 'spotifree_last_playback_';
const DEVICE_ID_KEY = 'spotifree_device_id';
const ACCOUNT_KEY = 'spotifree_account_v1';
const BROADCAST_CHANNEL = 'spotifree_playback_sync';

let cachedDeviceId = '';
let lastLocalInteractionAt = 0;
let lastAppliedRemoteAt = 0;
let lastCloudPushAt = 0;
let lastLocalSaveAt = 0;
let isApplyingRemote = false;
let initialized = false;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let broadcastCh: BroadcastChannel | null = null;
let cachedAccountSnapshot: { uid?: string } | null = null;

export function getPlaybackDeviceId(): string {
  if (cachedDeviceId) return cachedDeviceId;
  if (typeof window !== 'undefined') {
    try {
      const existing = window.localStorage.getItem(DEVICE_ID_KEY);
      if (existing && existing.length >= 6) {
        cachedDeviceId = existing;
        return cachedDeviceId;
      }
      const created = `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      window.localStorage.setItem(DEVICE_ID_KEY, created);
      cachedDeviceId = created;
      return cachedDeviceId;
    } catch {}
  }
  cachedDeviceId = `dev-${Date.now().toString(36)}`;
  return cachedDeviceId;
}

function getActiveAccountIdentity(): { uid?: string; email?: string } | null {
  if (typeof window === 'undefined') return cachedAccountSnapshot;
  try {
    const raw = window.localStorage.getItem(ACCOUNT_KEY);
    if (!raw) return cachedAccountSnapshot;
    const parsed = JSON.parse(raw);
    if (parsed && (parsed.uid || parsed.email)) return parsed;
  } catch {}
  return cachedAccountSnapshot;
}

function getLocalStorageKey(uid?: string): string {
  const scope = (uid || getActiveAccountIdentity()?.uid || 'local').trim() || 'local';
  return `${LOCAL_PLAYBACK_PREFIX}${scope}`;
}

function readLocalPlaybackSnapshot(uid?: string): SyncedPlaybackSnapshot | null {
  if (typeof window === 'undefined') return null;
  const keys = [getLocalStorageKey(uid)];
  if (uid && getLocalStorageKey('local') !== keys[0]) {
    keys.push(getLocalStorageKey('local'));
  }
  let best: SyncedPlaybackSnapshot | null = null;
  for (const k of keys) {
    try {
      const raw = window.localStorage.getItem(k);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (parsed?.currentTrack?.id && (!best || (parsed.updatedAt || 0) > (best.updatedAt || 0))) {
        best = parsed as SyncedPlaybackSnapshot;
      }
    } catch {}
  }
  return best;
}

function writeLocalPlaybackSnapshot(snapshot: SyncedPlaybackSnapshot, uid?: string): void {
  if (typeof window === 'undefined') return;
  try {
    const json = JSON.stringify(snapshot);
    window.localStorage.setItem(getLocalStorageKey(uid), json);
    if (uid) {
      window.localStorage.setItem(`${LOCAL_PLAYBACK_PREFIX}local`, json);
    }
    const rawAcc = window.localStorage.getItem(ACCOUNT_KEY);
    if (rawAcc) {
      const acc = JSON.parse(rawAcc);
      if (acc && (!uid || acc.uid === uid)) {
        acc.stats = { ...(acc.stats || {}), lastPlayback: snapshot };
        window.localStorage.setItem(ACCOUNT_KEY, JSON.stringify(acc));
      }
    }
  } catch {}
}

export function capturePlaybackSnapshot(overrides?: Partial<SyncedPlaybackSnapshot>): SyncedPlaybackSnapshot | null {
  const ps = usePlayerStore.getState();
  if (!ps.currentTrack?.id) return null;

  let djState: SyncedDJState | null = null;
  if (typeof window !== 'undefined') {
    try {
      const dj = (window as any).__useAIDJStore?.getState?.();
      if (dj?.isDJModeActive) {
        djState = {
          isDJModeActive: true,
          currentSetTitle: String(dj.currentSetTitle || ''),
          activeSegmentId: dj.activeSegmentId || null,
          djTracks: Array.isArray(dj.djTracks) ? dj.djTracks : [],
        };
      }
    } catch {}
  }

  const raw: SyncedPlaybackSnapshot = {
    version: 1,
    updatedAt: overrides?.updatedAt ?? Date.now(),
    deviceId: overrides?.deviceId ?? getPlaybackDeviceId(),
    wasPlaying: overrides?.wasPlaying ?? Boolean(ps.isPlaying),
    progressMs: Math.max(0, Math.round(Number(ps.progressMs) || 0)),
    durationMs: Math.max(0, Math.round(Number(ps.durationMs) || ps.currentTrack.duration_ms || 0)),
    currentContextId: ps.currentContextId ?? null,
    currentContextName: ps.currentContextName ?? null,
    shuffleMode: ps.shuffleMode || (ps.isShuffle ? 'all' : 'off'),
    isShuffle: Boolean(ps.isShuffle),
    repeatMode: ps.repeatMode || 'off',
    playedInShuffle: Array.isArray(ps.playedInShuffle) ? [...ps.playedInShuffle] : [],
    preselectedNextTrackId: ps.preselectedNextTrackId ?? null,
    currentTrack: ps.currentTrack,
    queue: Array.isArray(ps.queue) ? ps.queue : [],
    originalQueue: Array.isArray(ps.originalQueue) ? ps.originalQueue : [],
    djState,
  };

  return slimPlaybackSnapshotForCloud(raw) as SyncedPlaybackSnapshot | null;
}

export function shouldApplyRemotePlayback(params: {
  remote: SyncedPlaybackSnapshot | null | undefined;
  localDeviceId: string;
  isLocallyPlaying: boolean;
  hasLocalCurrentTrack: boolean;
  lastLocalInteractionAt: number;
  lastAppliedRemoteAt: number;
}): boolean {
  const {
    remote,
    localDeviceId,
    isLocallyPlaying,
    hasLocalCurrentTrack,
    lastLocalInteractionAt: localAt,
    lastAppliedRemoteAt: appliedAt,
  } = params;

  if (!remote || !remote.currentTrack?.id) return false;
  const remoteUpdatedAt = Number(remote.updatedAt) || 0;
  if (remoteUpdatedAt <= 0) return false;
  if (remoteUpdatedAt <= appliedAt) return false;
  if (isLocallyPlaying) return false;

  // Same-device echo while this tab/app already has a track loaded must not overwrite local session
  if (hasLocalCurrentTrack && remote.deviceId && remote.deviceId === localDeviceId) {
    return false;
  }

  // Only replace local state if remote timestamp is strictly newer than last local interaction
  if (hasLocalCurrentTrack && remoteUpdatedAt <= localAt) {
    return false;
  }

  return true;
}

export function applyRemotePlayback(remote?: SyncedPlaybackSnapshot | null, forceOnColdStart = false): boolean {
  if (!remote || !remote.currentTrack?.id) return false;
  const ps = usePlayerStore.getState();
  const localDeviceId = getPlaybackDeviceId();

  const allowed = shouldApplyRemotePlayback({
    remote,
    localDeviceId,
    isLocallyPlaying: ps.isPlaying,
    hasLocalCurrentTrack: Boolean(ps.currentTrack?.id) && !forceOnColdStart,
    lastLocalInteractionAt,
    lastAppliedRemoteAt,
  });

  if (!allowed) return false;

  isApplyingRemote = true;
  try {
    lastAppliedRemoteAt = Math.max(lastAppliedRemoteAt, Number(remote.updatedAt) || Date.now());

    usePlayerStore.getState().hydratePlaybackSession({
      currentTrack: remote.currentTrack,
      progressMs: remote.progressMs,
      durationMs: remote.durationMs,
      queue: remote.queue,
      originalQueue: remote.originalQueue,
      shuffleMode: remote.shuffleMode,
      isShuffle: remote.isShuffle,
      repeatMode: remote.repeatMode,
      currentContextId: remote.currentContextId,
      currentContextName: remote.currentContextName,
      playedInShuffle: remote.playedInShuffle,
      preselectedNextTrackId: remote.preselectedNextTrackId,
    });

    if (typeof window !== 'undefined') {
      try {
        const aiDjStore = (window as any).__useAIDJStore;
        if (aiDjStore?.setState) {
          if (remote.djState?.isDJModeActive && Array.isArray(remote.djState.djTracks) && remote.djState.djTracks.length > 0) {
            aiDjStore.setState({
              isDJModeActive: true,
              djTracks: remote.djState.djTracks.map((t: Track) => hydrateTrackCoverSync(sanitizeTrack(t))),
              currentSetTitle: remote.djState.currentSetTitle || '',
              activeSegmentId: remote.djState.activeSegmentId || null,
            });
          } else if (aiDjStore.getState?.()?.isDJModeActive && remote.currentContextId !== 'dj-session') {
            aiDjStore.setState({ isDJModeActive: false });
          }
        }
      } catch {}
    }

    const uid = getActiveAccountIdentity()?.uid;
    writeLocalPlaybackSnapshot(remote, uid);
    return true;
  } finally {
    setTimeout(() => {
      isApplyingRemote = false;
    }, 50);
  }
}

export async function flushPlaybackSync(immediateCloud = true): Promise<void> {
  if (isApplyingRemote) return;
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  const snapshot = capturePlaybackSnapshot();
  if (!snapshot) return;

  const acc = getActiveAccountIdentity();
  const uid = acc?.uid;
  writeLocalPlaybackSnapshot(snapshot, uid);
  lastLocalSaveAt = Date.now();

  try {
    broadcastCh?.postMessage({ type: 'playback_update', snapshot });
  } catch {}

  if (!uid) return;
  if (!immediateCloud && Date.now() - lastCloudPushAt < 12000) return;

  lastCloudPushAt = Date.now();
  const ok = await saveLastPlaybackToFirestore(uid, snapshot);
  if (ok) {
    lastAppliedRemoteAt = Math.max(lastAppliedRemoteAt, snapshot.updatedAt);
  }
}

function schedulePlaybackFlush(delayMs: number, immediateCloud = true): void {
  if (isApplyingRemote) return;
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushPlaybackSync(immediateCloud);
  }, delayMs);
}

function buildQueueSignature(queue: Track[], currentTrackId?: string | null): string {
  if (!Array.isArray(queue) || queue.length === 0) return '0';
  let smartCount = 0;
  let curIdx = -1;
  for (let i = 0; i < queue.length; i++) {
    if ((queue[i] as any)?.isSmartRecommendation) smartCount++;
    if (curIdx === -1 && currentTrackId && queue[i]?.id === currentTrackId) curIdx = i;
  }
  const start = Math.max(0, curIdx >= 0 ? curIdx - 2 : 0);
  const windowSlice = queue.slice(start, start + 14).map((t) => `${t.id}:${(t as any)?.isSmartRecommendation ? 1 : 0}`).join(',');
  const tail = queue.slice(-4).map((t) => t.id).join(',');
  return `${queue.length}|${smartCount}|${curIdx}|${windowSlice}|${tail}`;
}

export function initPlaybackSync(): () => void {
  if (initialized) return () => {};
  initialized = true;

  // 1. Cold start local restoration (before network responds)
  const acc = getActiveAccountIdentity();
  if (acc?.uid) cachedAccountSnapshot = { uid: acc.uid };
  const localSaved = readLocalPlaybackSnapshot(acc?.uid);
  const accLast = (acc as any)?.stats?.lastPlayback as SyncedPlaybackSnapshot | undefined;
  const bestInitial =
    accLast && (!localSaved || (accLast.updatedAt || 0) > (localSaved.updatedAt || 0))
      ? accLast
      : localSaved;

  if (bestInitial && !usePlayerStore.getState().currentTrack) {
    applyRemotePlayback(bestInitial, true);
    lastLocalInteractionAt = Number(bestInitial.updatedAt) || 0;
  }

  // 2. Instant cross-tab sync within the same browser
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    try {
      broadcastCh = new BroadcastChannel(BROADCAST_CHANNEL);
      broadcastCh.onmessage = (ev) => {
        if (ev?.data?.type === 'playback_update' && ev.data.snapshot) {
          applyRemotePlayback(ev.data.snapshot);
        }
      };
    } catch {}
  }

  const initPs = usePlayerStore.getState();
  let prevQueueSig = buildQueueSignature(initPs.queue, initPs.currentTrack?.id);

  // 3. Subscribe to meaningful player changes (paused/stopped, track change, seek, shuffle/repeat, smart queue additions)
  const unsubPlayer = usePlayerStore.subscribe((state, prev) => {
    if (isApplyingRemote) {
      prevQueueSig = buildQueueSignature(state.queue, state.currentTrack?.id);
      return;
    }
    if (!state.currentTrack?.id) return;

    const trackChanged = state.currentTrack.id !== prev.currentTrack?.id;
    const playToggled = state.isPlaying !== prev.isPlaying;
    const pausedNow = prev.isPlaying && !state.isPlaying;
    const shuffleChanged = state.shuffleMode !== prev.shuffleMode || state.isShuffle !== prev.isShuffle;
    const repeatChanged = state.repeatMode !== prev.repeatMode;
    const contextChanged = state.currentContextId !== prev.currentContextId;
    const progressDelta = Math.abs((state.progressMs || 0) - (prev.progressMs || 0));
    const userSeek = progressDelta >= 3500 && !trackChanged;

    const nextQueueSig = buildQueueSignature(state.queue, state.currentTrack?.id);
    const queueChanged = nextQueueSig !== prevQueueSig;
    prevQueueSig = nextQueueSig;

    if (trackChanged || playToggled || shuffleChanged || repeatChanged || contextChanged || queueChanged || userSeek) {
      lastLocalInteractionAt = Date.now();
    }

    if (pausedNow) {
      // Stopped/paused on desktop, mobile or car: persist immediately for instant pickup on another device
      schedulePlaybackFlush(250, true);
    } else if (trackChanged || shuffleChanged || repeatChanged || contextChanged || queueChanged || userSeek) {
      schedulePlaybackFlush(state.isPlaying ? 1200 : 400, true);
    } else if (state.isPlaying && Date.now() - lastLocalSaveAt >= 15000) {
      // Periodic 15s checkpoint while playing so sudden app close / battery death loses at most seconds
      void flushPlaybackSync(true);
    }
  });

  // 4. Lifecycle flush handlers (backgrounding, closing tab, locking screen, switching away in car/mobile)
  const onHiddenOrLeave = () => {
    if (usePlayerStore.getState().currentTrack?.id) {
      lastLocalInteractionAt = Date.now();
      void flushPlaybackSync(true);
    }
  };

  const onVisibilityChange = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      onHiddenOrLeave();
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', onHiddenOrLeave);
    window.addEventListener('beforeunload', onHiddenOrLeave);
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibilityChange);
  }

  let removeCapListener: (() => void) | null = null;
  try {
    if (Capacitor.isPluginAvailable('App')) {
      CapApp.addListener('appStateChange', ({ isActive }) => {
        if (!isActive) onHiddenOrLeave();
      })
        .then((handle) => {
          removeCapListener = () => handle.remove();
        })
        .catch(() => {});
    }
  } catch {}

  return () => {
    initialized = false;
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    unsubPlayer();
    removeCapListener?.();
    if (typeof window !== 'undefined') {
      window.removeEventListener('pagehide', onHiddenOrLeave);
      window.removeEventListener('beforeunload', onHiddenOrLeave);
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    }
    try {
      broadcastCh?.close();
    } catch {}
    broadcastCh = null;
  };
}
