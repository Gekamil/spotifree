import { API_BASE } from '../config';
import type { Playlist, Track } from '../types/spotify';
import {
  isFirebaseConfigured,
  registerWithFirebase,
  loginWithFirebase,
  loginWithGoogleFirebase,
  logoutFirebase,
  saveUserDataToFirestore,
  getUserDataFromFirestore,
  subscribeToUserDataFirestore,
  onFirebaseAuthStateChanged,
} from './firebase';
import { useSpotifyDataStore } from '../store/useSpotifyDataStore';
import { usePlayerStore } from '../store/usePlayerStore';
import { getRemovedTrackIdsForPlaylist } from '../utils/userStorage';
import { deduplicateTracks } from '../utils/trackDeduplication';

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

export function saveCurrentSpotifreeAccount(account: SpotifreeAccount | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (account) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(account));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {}
}

function getLocalDataToMerge() {
  let cookie = '';
  let playlists: any[] = [];
  let likedTracks: string[] = [];
  let avatarUrl: string | null = null;
  let bannerUrl: string | null = null;

  if (typeof window !== 'undefined') {
    try {
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
  const local = getLocalDataToMerge();
  const cleanEmail = email.trim().toLowerCase();

  // 1. Firebase Authentication
  if (isFirebaseConfigured()) {
    const fbRes = await loginWithFirebase(cleanEmail, password);
    if (!fbRes.success || !fbRes.user) {
      return { success: false, error: fbRes.error || 'Credenciales incorrectas.' };
    }

    const uid = fbRes.user.uid;
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
  const local = getLocalDataToMerge();
  const cloudData = await getUserDataFromFirestore(uid);

  const acc: SpotifreeAccount = {
    uid,
    email: fbRes.user.email || '',
    displayName: cloudData?.displayName || fbRes.user.displayName || 'Usuario Google',
    avatarUrl: cloudData?.avatarUrl || cloudData?.photoURL || fbRes.user.photoURL || local.avatarUrl || null,
    bannerUrl: cloudData?.bannerUrl || local.bannerUrl || null,
    spotifyCookie: cloudData?.spotifyCookie || local.cookie || undefined,
    playlists: Array.isArray(cloudData?.playlists) && cloudData.playlists.length > 0 ? cloudData.playlists : local.playlists,
    likedTracks: Array.from(new Set([...(cloudData?.likedTracks || []), ...local.likedTracks])),
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
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem('spotifree_current_cloud_account');
    window.localStorage.removeItem('spotifree_account');
    window.localStorage.removeItem('user_spotify_cookie');
    window.localStorage.removeItem('spotify_access_token');
    window.localStorage.removeItem('spotify_refresh_token');
    window.localStorage.removeItem('spotify_extracted_session');
    window.localStorage.removeItem('spotifree_saved_accounts');
    window.localStorage.removeItem('spotifree_active_user_id');
    window.localStorage.removeItem('spotifree_custom_profile');
    window.localStorage.setItem('spotify_logged_out', 'true');
  }
  await logoutFirebase();
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

  if (!email) return null;

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
  const rawPlaylists = payload.playlists || current?.playlists || [];
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
    playlists: cleanPlaylists,
    deletedPlaylistIds: Array.from(deletedSet),
    likedTracks: cleanLikedTracks,
    email,
    uid,
    updatedAt: Date.now(),
  } as SpotifreeAccount;

  // 1. Sync to Cloud Firestore if user is authenticated with Firebase
  if (uid && isFirebaseConfigured()) {
    await saveUserDataToFirestore(uid, merged);
  }

  saveCurrentSpotifreeAccount(merged);
  applyAccountToAppStores(merged);
  return merged;
}

/**
 * Pushes account data into live React stores (Spotify Store, Player Store, Library)
 * and ensures any cloud-synced Spotify cookie and custom profile are applied.
 */
export function applyAccountToAppStores(acc: SpotifreeAccount): void {
  const userId = acc.uid || acc.email || 'spotifree-user';
  const displayName = acc.displayName || acc.email.split('@')[0] || 'Usuario';
  const images = acc.avatarUrl ? [{ url: acc.avatarUrl, height: 300, width: 300 }] : [];

  // 1. Sync Spotify cookie to localStorage and reinitialize store if new
  if (acc.spotifyCookie && typeof window !== 'undefined') {
    const currentCookie = window.localStorage.getItem('user_spotify_cookie');
    if (currentCookie !== acc.spotifyCookie) {
      window.localStorage.setItem('user_spotify_cookie', acc.spotifyCookie);
      useSpotifyDataStore.getState().initialize?.();
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
        window.localStorage.setItem('user_imported_playlists', JSON.stringify(cleanPlaylists));

        // Prime cache for each playlist so tracks and items are instantly accessible
        const rawCache = window.localStorage.getItem(`spotifree_playlist_cache_${userId}`);
        const cacheObj: Record<string, Playlist> = rawCache ? JSON.parse(rawCache) : {};
        cleanPlaylists.forEach((p) => {
          if (p && p.id) {
            cacheObj[p.id] = p;
          }
        });
        window.localStorage.setItem(`spotifree_playlist_cache_${userId}`, JSON.stringify(cacheObj));
        window.localStorage.setItem('spotifree_playlist_cache_active', JSON.stringify(cacheObj));

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
      const updatedCache = { ...s.playlistDetailsCache };
      cleanPlaylists.forEach((p) => {
        if (p && p.id) {
          updatedCache[p.id] = p;
        }
      });
      return {
        playlists: [...cleanPlaylists, ...remainingSystem],
        playlistDetailsCache: updatedCache,
      };
    });
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
      const acc: SpotifreeAccount = {
        uid: user.uid,
        email: user.email || cloudData?.email || '',
        displayName: cloudData?.displayName || user.displayName || 'Usuario',
        avatarUrl: cloudData?.avatarUrl || cloudData?.photoURL || user.photoURL || null,
        bannerUrl: cloudData?.bannerUrl || null,
        spotifyCookie: cloudData?.spotifyCookie,
        playlists: cloudData?.playlists || [],
        deletedPlaylistIds: cloudData?.deletedPlaylistIds || [],
        likedTracks: cloudData?.likedTracks || [],
        updatedAt: cloudData?.updatedAt || Date.now(),
      };
      saveCurrentSpotifreeAccount(acc);
      applyAccountToAppStores(acc);

      // Realtime listener for cross-device updates (PC <-> Mobile)
      unsubscribeFirestore = subscribeToUserDataFirestore(user.uid, (fresh) => {
        if (!fresh) return;
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
          updatedAt: fresh.updatedAt || Date.now(),
        };
        saveCurrentSpotifreeAccount(freshAcc);
        applyAccountToAppStores(freshAcc);
      });
    } else {
      // Never wipe out a locally stored account/cookie just because Firebase user is null
      if (typeof window !== 'undefined') {
        const current = getSavedSpotifreeAccount();
        const hasLocalCookie = window.localStorage.getItem('user_spotify_cookie');
        if (!current?.spotifyCookie && !hasLocalCookie) {
          saveCurrentSpotifreeAccount(null);
        }
      }
    }
  });
}
