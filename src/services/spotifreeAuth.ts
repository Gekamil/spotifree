import { API_BASE } from '../config';
import type { Playlist, Track } from '../types/spotify';
import {
  isFirebaseConfigured,
  registerWithFirebase,
  loginWithFirebase,
  loginWithGoogleFirebase,
  logoutFirebase,
  saveUserDataToFirestore,
  lastCloudSaveError,
  getUserDataFromFirestore,
  subscribeToUserDataFirestore,
  onFirebaseAuthStateChanged,
} from './firebase';
import { useSpotifyDataStore, slimPlaylistForStorage } from '../store/useSpotifyDataStore';
import { usePlayerStore } from '../store/usePlayerStore';
import { useStatsStore } from '../store/useStatsStore';
import { useLabsStore } from './labsService';
import { useAIDJStore } from './aiDJService';
import { audioEngine } from './audioEngine';
import { getRemovedTrackIdsForPlaylist, setActiveUserId, clearActiveUserId } from '../utils/userStorage';
import { deduplicateTracks } from '../utils/trackDeduplication';
import { applyRemoteSettings } from './settingsSync';
import { applyRemotePlayback, resetPlaybackSyncCoordinator } from './playbackSync';
import { resetSpotifreeMixes, refreshSpotifreeMixes } from './spotifreeMixes';
import { resetNotInterestedCache } from '../utils/notInterested';
import { notifyRecentSearchesUpdated, getRecentSearches } from '../utils/recentSearches';
import { showGlobalToast } from '../utils/globalToast';
import { create } from 'zustand';
import { mergeCloudTrash } from './playlistTrash';

/** Notices about saving to the account: once per session / at most once a minute */
let warnedNoAccount = false;
let lastSaveWarning = 0;
let lastRemoteNotice = 0;

/** State of the account's sync, shown in Settings (and used for the "updated from another device" notice) */
export type CloudSyncState = 'idle' | 'saving' | 'saved' | 'error' | 'offline' | 'local';
export const useCloudSync = create<{ state: CloudSyncState; savedAt: number; receivedAt: number; error: string }>(() => ({
  state: 'idle',
  savedAt: 0,
  receivedAt: 0,
  error: '',
}));

export interface SpotifreeAccount {
  uid?: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  spotifyCookie?: string;
  playlists: Playlist[];
  deletedPlaylistIds?: string[];
  likedTracks: string[];
  history?: Track[];
  stats?: any;
  customTransitions?: Record<string, any>;
  /** App settings that follow the account (see settingsSync.ts) */
  settings?: { values: Record<string, string | null>; updatedAt: number };
  theme?: 'standard' | 'oled' | 'platinum';
  createdAt?: number;
  updatedAt?: number;
}

const STORAGE_KEY = 'spotifree_current_cloud_account';
const LOCAL_ACCOUNTS_KEY = 'spotifree_local_accounts_db';

function getLocalAccountsDb(): Record<string, any> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(LOCAL_ACCOUNTS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

function saveLocalAccountsDb(db: Record<string, any>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(db));
  } catch {}
}

export function getSavedSpotifreeAccount(): SpotifreeAccount | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function safeSetLocalStorage(key: string, value: string, fallbackValue?: () => string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    try {
      window.localStorage.removeItem('spotifree_playlist_cache_active');
      window.localStorage.setItem(key, value);
      return true;
    } catch {
      if (fallbackValue) {
        try {
          window.localStorage.setItem(key, fallbackValue());
          return true;
        } catch {}
      }
      return false;
    }
  }
}

function syncSavedLibraryIdsFromPlaylists(playlists: Playlist[], deletedSet: Set<string>): void {
  if (typeof window === 'undefined' || !Array.isArray(playlists)) return;
  try {
    const cleanPid = (id: string) => (id || '').replace(/^spotify:(playlist|album):/i, '').split('?')[0].trim();
    const isDeleted = (id: string) => {
      if (!id) return false;
      const c = cleanPid(id);
      return deletedSet.has(id) || deletedSet.has(c) || deletedSet.has(`spotify:playlist:${c}`);
    };
    const raw = window.localStorage.getItem('spotifree_saved_library_playlists');
    const existing: string[] = raw ? JSON.parse(raw) : [];
    const nextSet = new Set<string>(existing.filter((id) => id && !isDeleted(id)));
    for (const p of playlists) {
      if (!p?.id || isDeleted(p.id)) continue;
      if (p.id === 'liked-songs' || p.id === 'user-liked-songs' || p.id === 'spotify-dj' || p.id.includes('collection:tracks')) {
        continue;
      }
      nextSet.add(p.id);
      const c = cleanPid(p.id);
      if (c) nextSet.add(c);
    }
    window.localStorage.setItem('spotifree_saved_library_playlists', JSON.stringify(Array.from(nextSet)));
  } catch {}
}

export function saveCurrentSpotifreeAccount(account: SpotifreeAccount | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (account) {
      const slimPlaylists = Array.isArray(account.playlists)
        ? account.playlists.map(slimPlaylistForStorage)
        : account.playlists;
      const slimAccount: SpotifreeAccount = {
        ...account,
        playlists: slimPlaylists,
      };
      safeSetLocalStorage(STORAGE_KEY, JSON.stringify(slimAccount), () => {
        const ultraSlim = Array.isArray(slimPlaylists)
          ? slimPlaylists.map((p: any) =>
              p?.is_custom || p?.id === 'liked-songs'
                ? { ...p, tracks: { total: p.tracks?.total || 0, items: (p.tracks?.items || []).slice(0, 120) } }
                : { ...p, tracks: { total: p.tracks?.total || 0, items: [] } }
            )
          : slimPlaylists;
        return JSON.stringify({ ...slimAccount, playlists: ultraSlim });
      });
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {}
}

function getLocalDataToMerge(targetUid?: string) {
  let cookie = '';
  let playlists: any[] = [];
  let likedTracks: string[] = [];
  let avatarUrl: string | null = null;
  let bannerUrl: string | null = null;

  if (typeof window !== 'undefined') {
    try {
      const activeUser = window.localStorage.getItem('spotifree_active_user_id');
      // If local data belongs to another user (not guest, and not targetUid), DO NOT leak it!
      if (activeUser && activeUser !== 'guest' && targetUid && activeUser !== targetUid) {
        return { cookie: '', playlists: [], likedTracks: [], avatarUrl: null, bannerUrl: null };
      }

      cookie = window.localStorage.getItem('user_spotify_cookie') || '';
      const rawPl = window.localStorage.getItem('user_imported_playlists');
      if (rawPl) playlists = JSON.parse(rawPl);
      const rawLikes = window.localStorage.getItem('spotifree_liked_tracks');
      if (rawLikes) likedTracks = JSON.parse(rawLikes);
      const rawProf = window.localStorage.getItem('spotifree_custom_profile');
      if (rawProf) {
        const parsed = JSON.parse(rawProf);
        if (parsed.avatarUrl) avatarUrl = parsed.avatarUrl;
        if (parsed.bannerUrl) bannerUrl = parsed.bannerUrl;
      }
    } catch {}
  }

  return { cookie, playlists, likedTracks, avatarUrl, bannerUrl };
}

/**
 * Registers a real, cloud-verified user account with Firebase Authentication
 * and creates a permanent profile document in Cloud Firestore.
 */
export async function registerSpotifreeAccount(
  email: string,
  password: string,
  displayName?: string
): Promise<{ success: boolean; account?: SpotifreeAccount; error?: string }> {
  const local = getLocalDataToMerge();
  const cleanEmail = email.trim().toLowerCase();
  const cleanName = displayName?.trim() || cleanEmail.split('@')[0] || 'Usuario';

  // 1. Firebase Authentication (Real Cloud Database & Auth)
  if (isFirebaseConfigured()) {
    const fbRes = await registerWithFirebase(cleanEmail, password, cleanName);
    if (!fbRes.success || !fbRes.user) {
      return { success: false, error: fbRes.error || 'Error al registrar en Firebase.' };
    }

    const newAcc: SpotifreeAccount = {
      uid: fbRes.user.uid,
      email: cleanEmail,
      displayName: cleanName,
      avatarUrl: local.avatarUrl || fbRes.user.photoURL || null,
      bannerUrl: local.bannerUrl || null,
      spotifyCookie: local.cookie,
      playlists: local.playlists,
      likedTracks: local.likedTracks,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Save to Cloud Firestore
    await saveUserDataToFirestore(fbRes.user.uid, newAcc);

    // Save locally
    saveCurrentSpotifreeAccount(newAcc);
    const db = getLocalAccountsDb();
    db[cleanEmail] = { ...newAcc, password };
    saveLocalAccountsDb(db);

    // Sync stores
    applyAccountToAppStores(newAcc);

    return { success: true, account: newAcc };
  }

  // 2. Server API Fallback if Firebase not reachable
  try {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: cleanEmail,
        password,
        displayName: cleanName,
        spotifyCookie: local.cookie,
        playlists: local.playlists,
        likedTracks: local.likedTracks,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.account) {
        saveCurrentSpotifreeAccount(data.account);
        applyAccountToAppStores(data.account);
        return { success: true, account: data.account };
      }
      if (data.error) {
        return { success: false, error: data.error };
      }
    }
  } catch {}

  // 3. Fallback
  return { success: false, error: 'No se pudo conectar con el servidor de autenticación.' };
}

/**
 * Logs in with email/password via Firebase Authentication
 * and retrieves real-time cloud data from Cloud Firestore.
 */
export async function loginSpotifreeAccount(
  email: string,
  password: string
): Promise<{ success: boolean; account?: SpotifreeAccount; error?: string }> {
  const cleanEmail = email.trim().toLowerCase();

  // 1. Firebase Authentication
  if (isFirebaseConfigured()) {
    const fbRes = await loginWithFirebase(cleanEmail, password);
    if (!fbRes.success || !fbRes.user) {
      return { success: false, error: fbRes.error || 'Credenciales incorrectas.' };
    }

    const uid = fbRes.user.uid;
    const local = getLocalDataToMerge(uid);
    const cloudData = await getUserDataFromFirestore(uid);

    // If cloud data exists, it is authoritative! Only use local data as fallback if cloud has no record
    const hasCloudPlaylists = Array.isArray(cloudData?.playlists);
    const hasCloudLikes = Array.isArray(cloudData?.likedTracks);

    const mergedAcc: SpotifreeAccount = {
      uid,
      email: cleanEmail,
      displayName: cloudData?.displayName || fbRes.user.displayName || cleanEmail.split('@')[0] || 'Usuario',
      avatarUrl: cloudData?.avatarUrl || cloudData?.photoURL || fbRes.user.photoURL || local.avatarUrl || null,
      bannerUrl: cloudData?.bannerUrl || local.bannerUrl || null,
      spotifyCookie: cloudData?.spotifyCookie || local.cookie || undefined,
      playlists: hasCloudPlaylists ? (cloudData!.playlists || []) : local.playlists,
      deletedPlaylistIds: cloudData?.deletedPlaylistIds || [],
      likedTracks: hasCloudLikes ? (cloudData!.likedTracks || []) : local.likedTracks,
      stats: (cloudData as any)?.stats,
      updatedAt: Date.now(),
    };

    // Save locally
    saveCurrentSpotifreeAccount(mergedAcc);

    // Sync stores
    applyAccountToAppStores(mergedAcc);

    return { success: true, account: mergedAcc };
  }

  // 2. Server API fallback
  try {
    const local = getLocalDataToMerge();
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: cleanEmail,
        password,
        spotifyCookie: local.cookie,
        playlists: local.playlists,
        likedTracks: local.likedTracks,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.account) {
        saveCurrentSpotifreeAccount(data.account);
        applyAccountToAppStores(data.account);
        return { success: true, account: data.account };
      }
      if (data.error) {
        return { success: false, error: data.error };
      }
    }
  } catch {}

  return { success: false, error: 'Correo o contraseña incorrectos.' };
}

/**
 * 1-Click Google Sign In with Firebase
 */
export async function loginWithGoogleAccount(): Promise<{ success: boolean; account?: SpotifreeAccount; error?: string }> {
  if (!isFirebaseConfigured()) {
    return { success: false, error: 'Firebase no está configurado.' };
  }

  const fbRes = await loginWithGoogleFirebase();
  if (!fbRes.success || !fbRes.user) {
    return { success: false, error: fbRes.error || 'Error con Google Sign In.' };
  }

  const uid = fbRes.user.uid;
  const local = getLocalDataToMerge(uid);
  const cloudData = await getUserDataFromFirestore(uid);

  const acc: SpotifreeAccount = {
    uid,
    email: fbRes.user.email || '',
    displayName: cloudData?.displayName || fbRes.user.displayName || 'Usuario Google',
    avatarUrl: cloudData?.avatarUrl || cloudData?.photoURL || fbRes.user.photoURL || local.avatarUrl || null,
    bannerUrl: cloudData?.bannerUrl || local.bannerUrl || null,
    spotifyCookie: cloudData?.spotifyCookie || local.cookie || undefined,
    playlists: Array.isArray(cloudData?.playlists) && cloudData.playlists.length > 0 ? cloudData.playlists : local.playlists,
    likedTracks: Array.isArray(cloudData?.likedTracks) && cloudData.likedTracks.length > 0 ? cloudData.likedTracks : local.likedTracks,
    stats: (cloudData as any)?.stats,
    updatedAt: Date.now(),
  };

  await saveUserDataToFirestore(uid, acc);
  saveCurrentSpotifreeAccount(acc);
  applyAccountToAppStores(acc);

  subscribeToUserDataFirestore(uid, (updated) => {
    applyAccountToAppStores({ ...acc, ...updated });
  });

  return { success: true, account: acc };
}

export async function logoutSpotifreeAccount(): Promise<void> {
  saveCurrentSpotifreeAccount(null);

  // 1. Immediately and synchronously stop audio engine to eliminate ghost audio
  try {
    audioEngine.pause();
    audioEngine.resetForRestoredTrack();
  } catch {}

  // 2. Synchronously clear player store state
  try {
    usePlayerStore.setState({
      isPlaying: false,
      currentTrack: null,
      queue: [],
      originalQueue: [],
      likedTrackIds: [],
      progressMs: 0,
      playedInShuffle: [],
      currentContextId: null,
      currentContextName: null,
      preselectedNextTrackId: null,
    });
  } catch {}

  // 3. Stop AI DJ session
  try {
    useAIDJStore.getState().stopDJSession?.();
  } catch {}

  // 4. Reset playback sync coordinator
  try {
    resetPlaybackSyncCoordinator();
  } catch {}

  // 5. Reset mixes, stats, and taste
  try {
    resetSpotifreeMixes();
  } catch {}
  try {
    useStatsStore.getState().resetStats();
  } catch {}
  try {
    useLabsStore.getState().resetTasteKeys?.();
  } catch {}
  try {
    resetNotInterestedCache();
  } catch {}

  // 6. Clean localStorage
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem('spotifree_current_cloud_account');
    window.localStorage.removeItem('spotifree_account');
    window.localStorage.removeItem('user_spotify_cookie');
    window.localStorage.removeItem('spotify_access_token');
    window.localStorage.removeItem('spotify_refresh_token');
    window.localStorage.removeItem('spotify_expires_at');
    window.localStorage.removeItem('spotify_session_synced');
    window.localStorage.removeItem('spotify_sp_dc');
    window.localStorage.removeItem('user_imported_playlists');
    window.localStorage.removeItem('spotifree_saved_library_playlists');
    window.localStorage.removeItem('spotify_extracted_session');
    window.localStorage.removeItem('spotifree_active_user_id');
    window.localStorage.removeItem('spotifree_custom_profile');
    window.localStorage.removeItem('spotifree_playlist_cache_active');
    window.localStorage.removeItem('spotifree_liked_tracks');
    window.localStorage.removeItem('spotifree_guest_liked_songs');
    window.localStorage.removeItem('spotifree_last_playback_local');
    window.localStorage.removeItem('spotifree_last_playback_guest');
    window.localStorage.setItem('spotify_logged_out', 'true');
    window.sessionStorage.removeItem('spotify_403_premium');
  }

  // 7. Clear active user ID and notify search views
  clearActiveUserId();
  notifyRecentSearchesUpdated([]);

  // 8. Logout Firebase
  await logoutFirebase();

  // 9. Reset Spotify Data Store
  try {
    useSpotifyDataStore.getState().logout?.();
  } catch {}
}

/**
 * Synchronizes user playlists and liked songs to Cloud Firestore.
 */
export async function syncSpotifreeAccount(
  payload: Partial<SpotifreeAccount>
): Promise<SpotifreeAccount | null> {
  const current = getSavedSpotifreeAccount();
  const email = (payload.email || current?.email || '').trim().toLowerCase();
  const uid = payload.uid || current?.uid;

  if (!email) {
    useCloudSync.setState({ state: 'local' });
    // Changes without a Spotifree account stay on this device: say so once
    if ((payload.playlists || payload.likedTracks) && !warnedNoAccount) {
      warnedNoAccount = true;
      showGlobalToast('Guardado en este dispositivo. Entra con tu cuenta de Spotifree para verlo también en tus otros dispositivos.');
    }
    return null;
  }

  // Gather all deleted playlist IDs
  const deletedSet = new Set<string>(
    Array.isArray(payload.deletedPlaylistIds)
      ? payload.deletedPlaylistIds
      : Array.isArray(current?.deletedPlaylistIds)
      ? current.deletedPlaylistIds
      : []
  );
  if (typeof window !== 'undefined') {
    try {
      const rawD = window.localStorage.getItem('spotifree_deleted_playlist_ids');
      if (rawD) {
        (JSON.parse(rawD) as string[]).forEach((id) => deletedSet.add(id));
      }
    } catch {}
  }

  // Source of playlists
  const storeState = useSpotifyDataStore.getState();
  const sameStoreUser = storeState.isAuthenticated && (storeState.user?.id === uid || storeState.user?.email === email);
  const rawPlaylists =
    payload.playlists ||
    (sameStoreUser && storeState.playlists.length > (current?.playlists?.length || 0) ? storeState.playlists : null) ||
    current?.playlists ||
    [];
  const cleanPlaylists = rawPlaylists
    .filter((p) => p && p.id && !deletedSet.has(p.id))
    .map((p) => {
      if (!p.tracks?.items || !Array.isArray(p.tracks.items)) return p;
      const removedSet = getRemovedTrackIdsForPlaylist(p.id);
      if (removedSet.size === 0) return p;
      const filteredItems = p.tracks.items.filter((t) => {
        const c = (t.id || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
        const sig = t.name && t.artists?.[0]?.name ? `sig:${t.name.toLowerCase().trim()}::${t.artists[0].name.toLowerCase().trim()}` : '';
        return !removedSet.has(t.id) && !removedSet.has(c) && (!sig || !removedSet.has(sig));
      });
      return {
        ...p,
        tracks: {
          ...p.tracks,
          total: filteredItems.length,
          items: filteredItems,
        },
      };
    });

  // Source of liked tracks
  const likedRemovedSet = getRemovedTrackIdsForPlaylist('liked-songs');
  const rawLikedTracks = payload.likedTracks || current?.likedTracks || [];
  const cleanLikedTracks = Array.from(
    new Set(
      rawLikedTracks.filter((id) => {
        const c = (id || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
        return !likedRemovedSet.has(id) && !likedRemovedSet.has(c) && !likedRemovedSet.has(`spotify:track:${c}`);
      })
    )
  );

  const merged: SpotifreeAccount = {
    ...(current || {}),
    ...payload,
    // stats is a map of independent parts (settings, taste, taste, trash…): a payload adds to it
    ...(payload.stats ? { stats: { ...((current as any)?.stats || {}), ...payload.stats } } : {}),
    playlists: cleanPlaylists,
    deletedPlaylistIds: Array.from(deletedSet),
    likedTracks: cleanLikedTracks,
    email,
    uid,
    updatedAt: Date.now(),
  } as SpotifreeAccount;

  try {
    const localStatsExport = useStatsStore.getState().getExportableStats();
    if (localStatsExport.totalSeconds > 0) {
      if (!merged.stats) (merged as any).stats = {};
      (merged as any).stats.listeningStats = localStatsExport;
    }
  } catch {}

  // 0. Persist synchronously to localStorage BEFORE async network Firestore save
  // so swiping/closing the Android APK right after saving never loses changes
  saveCurrentSpotifreeAccount(merged);
  syncSavedLibraryIdsFromPlaylists(cleanPlaylists, deletedSet);

  // 1. Sync to Cloud Firestore if user is authenticated with Firebase
  if (uid && isFirebaseConfigured()) {
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    // Offline the save waits in Firestore's queue and goes out when the connection is back
    useCloudSync.setState({ state: offline ? 'offline' : 'saving' });
    const ok = await saveUserDataToFirestore(uid, merged);
    if (ok) useCloudSync.setState({ state: 'saved', savedAt: Date.now(), error: '' });
    else useCloudSync.setState({ state: 'error', error: lastCloudSaveError || 'sin conexión' });
    // A failed save used to be silent: the change then never reached the other devices
    if (!ok && Date.now() - lastSaveWarning > 60000) {
      lastSaveWarning = Date.now();
      showGlobalToast(`No se pudo guardar en tu cuenta (${lastCloudSaveError || 'sin conexión'}). Se reintentará con el próximo cambio.`);
    }
  }

  // Only re-apply stores if profile metadata / cookie / settings changed
  if (
    payload.displayName !== undefined ||
    payload.avatarUrl !== undefined ||
    payload.bannerUrl !== undefined ||
    payload.spotifyCookie !== undefined ||
    payload.settings !== undefined
  ) {
    applyAccountToAppStores(merged);
  }
  return merged;
}

let statsPushTimer: any = null;
export function scheduleCloudStatsSync(): void {
  if (statsPushTimer) return;
  statsPushTimer = setTimeout(() => {
    statsPushTimer = null;
    const current = getSavedSpotifreeAccount();
    if (!current?.uid) return;
    const statsExport = useStatsStore.getState().getExportableStats();
    if (statsExport.totalSeconds > 0) {
      void syncSpotifreeAccount({
        stats: { listeningStats: statsExport },
      });
    }
  }, 8000);
}

if (typeof window !== 'undefined') {
  (window as any).__spotifree_syncStats = scheduleCloudStatsSync;
}

/**
 * Pushes account data into live React stores (Spotify Store, Player Store, Library)
 * and ensures any cloud-synced Spotify cookie and custom profile are applied.
 */
export function applyAccountToAppStores(acc: SpotifreeAccount): void {
  // Photos uploaded from a device travel in stats (avatarUrl only takes web addresses)
  const st: any = (acc as any).stats || {};
  if (!acc.avatarUrl && typeof st.avatarImage === 'string') acc = { ...acc, avatarUrl: st.avatarImage };
  if (!acc.bannerUrl && typeof st.bannerImage === 'string') acc = { ...acc, bannerUrl: st.bannerImage };
  const userId = acc.uid || acc.email || 'spotifree-user';
  const displayName = acc.displayName || acc.email.split('@')[0] || 'Usuario';
  const images = acc.avatarUrl ? [{ url: acc.avatarUrl, height: 300, width: 300 }] : [];

  const previousUserId = useSpotifyDataStore.getState().user?.id;
  const isDifferentUser = Boolean(previousUserId && previousUserId !== userId);

  // 0. Set active user identity and load per-user stores
  setActiveUserId(userId);
  try {
    useStatsStore.getState().loadStatsForUser(userId);
    if (st.listeningStats) {
      useStatsStore.getState().syncWithCloudStats(st.listeningStats);
    }
  } catch {}
  try {
    useLabsStore.getState().loadTasteKeysForUser(userId);
  } catch {}
  try {
    resetNotInterestedCache();
  } catch {}

  // If switching accounts: stop audio and reset player if no remote playback
  if (isDifferentUser) {
    if (!st.lastPlayback) {
      try {
        audioEngine.pause();
        audioEngine.resetForRestoredTrack();
        usePlayerStore.setState({
          isPlaying: false,
          currentTrack: null,
          queue: [],
          originalQueue: [],
          likedTrackIds: [],
          progressMs: 0,
          playedInShuffle: [],
          currentContextId: null,
          currentContextName: null,
          preselectedNextTrackId: null,
        });
      } catch {}
    }
    try {
      useAIDJStore.getState().stopDJSession?.();
    } catch {}
  }

  // 1. Sync Spotify cookie to localStorage and reinitialize store if new
  if (acc.spotifyCookie && typeof window !== 'undefined') {
    const currentCookie = window.localStorage.getItem('user_spotify_cookie');
    if (currentCookie !== acc.spotifyCookie) {
      window.localStorage.setItem('user_spotify_cookie', acc.spotifyCookie);
      useSpotifyDataStore.getState().initialize?.();
    }
  }

  // 1a. Settings saved by another device (equalizer, DJ, language...)
  // (in the cloud they are stored as stats.appSettings, see saveUserDataToFirestore)
  // The local copy of the account and the cloud document may both carry them: newest wins
  const candidates = [acc.settings, (acc as any).stats?.appSettings].filter((x) => x && x.values);
  const syncedSettings = candidates.sort((a: any, b: any) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
  if (syncedSettings) applyRemoteSettings(syncedSettings);

  // 1a-ter. Playback continuity from another device (exact song, second, queue & Smart Shuffle tracks)
  if (st.lastPlayback) {
    applyRemotePlayback(st.lastPlayback);
  }

  // 1a-bis. Trash of deleted playlists and the ones restored on another device: a restored playlist
  // must stop being "deleted" here too, or this device would keep hiding it
  if (st.playlistTrash || st.restoredPlaylistIds) {
    const restored: string[] = Array.isArray(st.restoredPlaylistIds) ? st.restoredPlaylistIds : [];
    mergeCloudTrash(Array.isArray(st.playlistTrash) ? st.playlistTrash : [], restored);
    if (restored.length) {
      const r = new Set(restored);
      acc = { ...acc, deletedPlaylistIds: (acc.deletedPlaylistIds || []).filter((x) => !r.has(x)) };
      try {
        const localD: string[] = JSON.parse(window.localStorage.getItem('spotifree_deleted_playlist_ids') || '[]');
        window.localStorage.setItem('spotifree_deleted_playlist_ids', JSON.stringify(localD.filter((x) => !r.has(x))));
      } catch {}
    }
  }

  // 1b. Sync deleted playlist IDs if present in cloud account
  if (Array.isArray(acc.deletedPlaylistIds) && typeof window !== 'undefined') {
    try {
      const rawD = window.localStorage.getItem('spotifree_deleted_playlist_ids');
      const localD: string[] = rawD ? JSON.parse(rawD) : [];
      const mergedSet = new Set([...localD, ...acc.deletedPlaylistIds]);
      window.localStorage.setItem('spotifree_deleted_playlist_ids', JSON.stringify(Array.from(mergedSet)));
    } catch {}
  }

  // 2. Persist custom profile info (avatar, banner, display name) across all local profile keys
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem('spotifree_active_user_id', userId);
      window.localStorage.removeItem('spotify_logged_out');
      const customProf = {
        displayName,
        avatarUrl: acc.avatarUrl || undefined,
        bannerUrl: acc.bannerUrl || undefined,
      };
      window.localStorage.setItem('spotifree_custom_profile', JSON.stringify(customProf));
      window.localStorage.setItem(`spotifree_custom_profile_${userId}`, JSON.stringify(customProf));
    } catch {}
  }

  // 3. Update active user in Spotify Data store
  useSpotifyDataStore.setState((s) => ({
    isAuthenticated: true,
    user: {
      id: userId,
      display_name: displayName,
      email: acc.email,
      images: images.length > 0 ? images : (s.user?.images || []),
      bannerUrl: acc.bannerUrl || (s.user as any)?.bannerUrl || null,
      followers: s.user?.followers || { total: 0 },
    } as any,
    ...(isDifferentUser ? { recentlyPlayed: [], topArtists: [], topTracks: [] } : {}),
  }));

  // 4. Sync playlists to local storage, cache, and store (authoritative from cloud, filtering deleted IDs)
  if (Array.isArray(acc.playlists)) {
    const deletedSet = new Set(Array.isArray(acc.deletedPlaylistIds) ? acc.deletedPlaylistIds : []);
    if (typeof window !== 'undefined') {
      try {
        const rawD = window.localStorage.getItem('spotifree_deleted_playlist_ids');
        if (rawD) {
          const localD: string[] = JSON.parse(rawD);
          localD.forEach((id) => deletedSet.add(id));
        }
      } catch {}
    }

    // Filter out any deleted playlists and removed tracks from each playlist
    const cleanPlaylists = acc.playlists
      .filter((p) => p && p.id && !deletedSet.has(p.id))
      .map((p) => {
        if (!p.tracks?.items || !Array.isArray(p.tracks.items)) return p;
        const removedSet = getRemovedTrackIdsForPlaylist(p.id);
        if (removedSet.size === 0) return p;
        const filteredItems = p.tracks.items.filter((t) => {
          const c = (t.id || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
          const sig = t.name && t.artists?.[0]?.name ? `sig:${t.name.toLowerCase().trim()}::${t.artists[0].name.toLowerCase().trim()}` : '';
          return !removedSet.has(t.id) && !removedSet.has(c) && (!sig || !removedSet.has(sig));
        });
        return {
          ...p,
          tracks: {
            ...p.tracks,
            total: filteredItems.length,
            items: filteredItems,
          },
        };
      });

    if (typeof window !== 'undefined') {
      try {
        const slimClean = cleanPlaylists.map(slimPlaylistForStorage);
        safeSetLocalStorage('user_imported_playlists', JSON.stringify(slimClean), () =>
          JSON.stringify(slimClean.map((p: any) =>
            p.is_custom || p.id === 'liked-songs'
              ? { ...p, tracks: { total: p.tracks?.total || 0, items: (p.tracks?.items || []).slice(0, 120) } }
              : { ...p, tracks: { total: p.tracks?.total || 0, items: [] } }
          ))
        );
        syncSavedLibraryIdsFromPlaylists(cleanPlaylists, deletedSet);

        // Prime cache for each playlist so tracks and items are instantly accessible
        const rawCache = window.localStorage.getItem(`spotifree_playlist_cache_${userId}`);
        const cacheObj: Record<string, Playlist> = rawCache ? JSON.parse(rawCache) : {};
        slimClean.forEach((p) => {
          if (p && p.id) {
            cacheObj[p.id] = p;
          }
        });
        safeSetLocalStorage(`spotifree_playlist_cache_${userId}`, JSON.stringify(cacheObj));

        // If liked-songs has tracks, prime custom liked songs for this user (filtering blacklisted items)
        const isLikedPl = (p: any) =>
          p.id === 'liked-songs' ||
          p.id === 'user-liked-songs' ||
          p.id === 'tracks' ||
          p.id?.includes('collection:tracks') ||
          /^(canciones que te gustan|canciones que me gustan|tus me gusta|liked songs)/i.test((p.name || '').trim());

        const likedPl = cleanPlaylists.find(isLikedPl);
        if (likedPl?.tracks?.items && Array.isArray(likedPl.tracks.items) && likedPl.tracks.items.length > 0) {
          const likedRemovedSet = getRemovedTrackIdsForPlaylist('liked-songs');
          const cleanLikedItems = likedPl.tracks.items.filter((t) => {
            const c = (t.id || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
            const sig = t.name && t.artists?.[0]?.name ? `sig:${t.name.toLowerCase().trim()}::${t.artists[0].name.toLowerCase().trim()}` : '';
            return !likedRemovedSet.has(t.id) && !likedRemovedSet.has(c) && (!sig || !likedRemovedSet.has(sig));
          });

          const rawExisting = window.localStorage.getItem(`spotifree_custom_liked_songs_${userId}`);
          let existingLiked: any[] = rawExisting ? JSON.parse(rawExisting) : [];
          // Preserve existing liked tracks if cleanLikedItems is smaller
          const mergedLiked = cleanLikedItems.length >= existingLiked.length
            ? cleanLikedItems
            : deduplicateTracks([...cleanLikedItems, ...existingLiked]).filter((t) => {
                const c = (t.id || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
                const sig = t.name && t.artists?.[0]?.name ? `sig:${t.name.toLowerCase().trim()}::${t.artists[0].name.toLowerCase().trim()}` : '';
                return !likedRemovedSet.has(t.id) && !likedRemovedSet.has(c) && (!sig || !likedRemovedSet.has(sig));
              });

          window.localStorage.setItem(`spotifree_custom_liked_songs_${userId}`, JSON.stringify(mergedLiked));
          window.dispatchEvent(new CustomEvent('spotifree_liked_songs_updated', {
            detail: { tracks: mergedLiked },
          }));
        }
      } catch {}
    }
    useSpotifyDataStore.setState((s) => {
      const systemPlaylists = s.playlists.filter((p) => p.id === 'liked-songs' || p.id === 'user-liked-songs');
      const cleanIds = new Set(cleanPlaylists.map((p) => p.id));
      const remainingSystem = systemPlaylists.filter((p) => !cleanIds.has(p.id));
      // A list that came from the cloud without its songs (they didn't fit in the account; Spotify
      // gives them back) keeps the songs this device already has
      const withSongs = cleanPlaylists.map((p) => {
        if ((p.tracks?.items?.length || 0) > 0 || !(p.tracks?.total > 0)) return p;
        const local = s.playlistDetailsCache[p.id] || s.playlists.find((x) => x.id === p.id);
        return local?.tracks?.items?.length ? { ...p, tracks: local.tracks } : p;
      });
      const updatedCache = { ...s.playlistDetailsCache };
      withSongs.forEach((p) => {
        if (p && p.id) {
          updatedCache[p.id] = p;
        }
      });
      return {
        playlists: [...withSongs, ...remainingSystem],
        playlistDetailsCache: updatedCache,
      };
    });

    // Notify all active playlist views in real time that cloud sync has arrived
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('spotifree_playlists_synced', {
          detail: { playlists: cleanPlaylists },
        })
      );
    }
  }

  // 5. Sync liked tracks to local storage and player store (filtering removed IDs)
  if (Array.isArray(acc.likedTracks)) {
    const likedRemovedSet = getRemovedTrackIdsForPlaylist('liked-songs');
    const cleanLikedIds = acc.likedTracks.filter((id) => {
      const c = (id || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
      return !likedRemovedSet.has(id) && !likedRemovedSet.has(c);
    });
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem('spotifree_liked_tracks', JSON.stringify(cleanLikedIds));
      } catch {}
    }
    usePlayerStore.setState({
      likedTrackIds: cleanLikedIds,
    });
  }

  if (isDifferentUser || !previousUserId) {
    // 6. Reset and rebuild mixes for the active user
    resetSpotifreeMixes();
    void refreshSpotifreeMixes(true);

    // 7. Notify search views with the active user's searches
    notifyRecentSearchesUpdated(getRecentSearches(userId));
  }
}

/**
 * Reconciles initial Firestore user document with any newer local changes
 * made right before closing the app (e.g. offline or Android APK quick swipe-close).
 */
export function reconcileAccountWithLocalSnapshot(
  baseCloudAcc: SpotifreeAccount,
  localSaved: SpotifreeAccount | null
): { account: SpotifreeAccount; hasNewerLocal: boolean } {
  const cloudTs = Number(baseCloudAcc.updatedAt || 0);
  const localTs = Number(localSaved?.updatedAt || 0);
  if (localSaved && localSaved.uid && localSaved.uid === baseCloudAcc.uid && localTs > cloudTs) {
    return {
      account: {
        ...baseCloudAcc,
        ...localSaved,
        stats: {
          ...((baseCloudAcc as any).stats || {}),
          ...((localSaved as any).stats || {}),
        },
        updatedAt: localTs,
      },
      hasNewerLocal: true,
    };
  }
  return { account: baseCloudAcc, hasNewerLocal: false };
}

/**
 * Initializes automatic background authentication session restoration
 * so users stay logged in across app restarts, reloads, and mobile PWA launches,
 * and maintains real-time bidirectional synchronization with Cloud Firestore.
 */
export function initAuthListener(): () => void {
  let unsubscribeFirestore: (() => void) | null = null;

  return onFirebaseAuthStateChanged(async (user) => {
    if (unsubscribeFirestore) {
      unsubscribeFirestore();
      unsubscribeFirestore = null;
    }

    if (user) {
      const cloudData = await getUserDataFromFirestore(user.uid);
      const localSaved = getSavedSpotifreeAccount();
      const baseAcc: SpotifreeAccount = {
        uid: user.uid,
        email: user.email || cloudData?.email || localSaved?.email || '',
        displayName: cloudData?.displayName || user.displayName || localSaved?.displayName || 'Usuario',
        avatarUrl: cloudData?.avatarUrl || cloudData?.photoURL || user.photoURL || localSaved?.avatarUrl || null,
        bannerUrl: cloudData?.bannerUrl || localSaved?.bannerUrl || null,
        spotifyCookie: cloudData?.spotifyCookie || localSaved?.spotifyCookie,
        playlists: cloudData?.playlists || [],
        deletedPlaylistIds: cloudData?.deletedPlaylistIds || [],
        likedTracks: cloudData?.likedTracks || [],
        stats: (cloudData as any)?.stats,
        updatedAt: cloudData?.updatedAt || 0,
      };

      const { account: reconciledAcc, hasNewerLocal } = reconcileAccountWithLocalSnapshot(baseAcc, localSaved);
      if (!reconciledAcc.updatedAt) {
        reconciledAcc.updatedAt = Date.now();
      }
      saveCurrentSpotifreeAccount(reconciledAcc);
      applyAccountToAppStores(reconciledAcc);

      // Push unsynced local changes to Firestore so other devices receive them
      if (hasNewerLocal) {
        void saveUserDataToFirestore(user.uid, reconciledAcc).catch(() => {});
      }

      // Realtime listener for cross-device updates (PC <-> Mobile)
      let firstSnapshot = true;
      unsubscribeFirestore = subscribeToUserDataFirestore(user.uid, (fresh) => {
        if (!fresh) return;
        const currentLocal = getSavedSpotifreeAccount();
        const freshTs = Number(fresh.updatedAt || 0);
        const localTs = Number(currentLocal?.updatedAt || 0);
        // Never overwrite newer local edits with an older cloud snapshot / initial echo
        if (currentLocal && currentLocal.uid === user.uid && localTs > freshTs) {
          if (firstSnapshot) {
            firstSnapshot = false;
            void saveUserDataToFirestore(user.uid, currentLocal).catch(() => {});
          }
          return;
        }

        const freshAcc: SpotifreeAccount = {
          uid: user.uid,
          email: fresh.email || user.email || '',
          displayName: fresh.displayName || user.displayName || 'Usuario',
          avatarUrl: fresh.avatarUrl || fresh.photoURL || user.photoURL || null,
          bannerUrl: fresh.bannerUrl || null,
          spotifyCookie: fresh.spotifyCookie,
          playlists: fresh.playlists || [],
          deletedPlaylistIds: fresh.deletedPlaylistIds || [],
          likedTracks: fresh.likedTracks || [],
          stats: (fresh as any).stats,
          updatedAt: fresh.updatedAt || Date.now(),
        };
        saveCurrentSpotifreeAccount(freshAcc);
        applyAccountToAppStores(freshAcc);
        // Real time: a change made on another device just arrived (the first value is just the load)
        if (firstSnapshot) {
          firstSnapshot = false;
          return;
        }
        const isPurePlaybackUpdate = Boolean(
          (fresh as any)?.stats?.lastPlayback?.updatedAt &&
          (fresh as any).stats.lastPlayback.updatedAt === fresh.updatedAt
        );
        if (isPurePlaybackUpdate) return;
        useCloudSync.setState({ receivedAt: Date.now() });
        if (Date.now() - lastRemoteNotice > 30000) {
          lastRemoteNotice = Date.now();
          showGlobalToast('Tu biblioteca se ha actualizado con los cambios de otro dispositivo');
        }
      });
    } else {
      // Never wipe out a locally stored account/cookie just because Firebase user is null (e.g. offline/APK)
      if (typeof window !== 'undefined') {
        const explicitLoggedOut = window.localStorage.getItem('spotify_logged_out') === 'true';
        const current = getSavedSpotifreeAccount();
        const hasLocalCookie = window.localStorage.getItem('user_spotify_cookie');
        if (explicitLoggedOut || (!current?.uid && !current?.spotifyCookie && !hasLocalCookie)) {
          saveCurrentSpotifreeAccount(null);
        }
      }
    }
  });
}
