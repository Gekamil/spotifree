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

export interface SpotifreeAccount {
  uid?: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  spotifyCookie?: string;
  playlists: Playlist[];
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

  if (typeof window !== 'undefined') {
    try {
      cookie = window.localStorage.getItem('user_spotify_cookie') || '';
      const rawPl = window.localStorage.getItem('user_imported_playlists');
      if (rawPl) playlists = JSON.parse(rawPl);
      const rawLikes = window.localStorage.getItem('spotifree_liked_tracks');
      if (rawLikes) likedTracks = JSON.parse(rawLikes);
    } catch {}
  }

  return { cookie, playlists, likedTracks };
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
      avatarUrl: fbRes.user.photoURL || null,
      bannerUrl: null,
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

    const mergedAcc: SpotifreeAccount = {
      uid,
      email: cleanEmail,
      displayName: cloudData?.displayName || fbRes.user.displayName || cleanEmail.split('@')[0] || 'Usuario',
      avatarUrl: cloudData?.photoURL || fbRes.user.photoURL || null,
      bannerUrl: null,
      spotifyCookie: cloudData?.spotifyCookie || local.cookie || undefined,
      playlists: Array.isArray(cloudData?.playlists) && cloudData.playlists.length > 0 ? cloudData.playlists : local.playlists,
      likedTracks: Array.from(new Set([...(cloudData?.likedTracks || []), ...local.likedTracks])),
      updatedAt: Date.now(),
    };

    // Update Firestore if local had items not yet in cloud
    await saveUserDataToFirestore(uid, mergedAcc);

    // Save locally
    saveCurrentSpotifreeAccount(mergedAcc);

    // Sync stores
    applyAccountToAppStores(mergedAcc);

    // Listen to real-time changes
    subscribeToUserDataFirestore(uid, (updated) => {
      applyAccountToAppStores({ ...mergedAcc, ...updated });
    });

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
    avatarUrl: cloudData?.photoURL || fbRes.user.photoURL || null,
    bannerUrl: cloudData?.bannerUrl || null,
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

  const merged: SpotifreeAccount = {
    ...(current || {}),
    ...payload,
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
 * and ensures any cloud-synced Spotify cookie is applied to the local session.
 */
export function applyAccountToAppStores(acc: SpotifreeAccount): void {
  // Sync Spotify cookie to localStorage and reinitialize store if new
  if (acc.spotifyCookie && typeof window !== 'undefined') {
    const currentCookie = window.localStorage.getItem('user_spotify_cookie');
    if (currentCookie !== acc.spotifyCookie) {
      window.localStorage.setItem('user_spotify_cookie', acc.spotifyCookie);
      useSpotifyDataStore.getState().initialize?.();
    }
  }

  const userId = acc.uid || acc.email || 'spotifree-user';
  const displayName = acc.displayName || acc.email.split('@')[0] || 'Usuario';
  const images = acc.avatarUrl ? [{ url: acc.avatarUrl, height: 300, width: 300 }] : [];

  useSpotifyDataStore.setState((s) => ({
    isAuthenticated: true,
    user: {
      id: userId,
      display_name: displayName,
      email: acc.email,
      images: images.length > 0 ? images : (s.user?.images || []),
      followers: s.user?.followers || { total: 0 },
    },
  }));

  if (Array.isArray(acc.playlists) && acc.playlists.length > 0) {
    useSpotifyDataStore.setState((s) => {
      const currentIds = new Set(s.playlists.map((p) => p.id));
      const toAdd = acc.playlists.filter((p) => !currentIds.has(p.id));
      return { playlists: [...toAdd, ...s.playlists] };
    });
  }

  if (Array.isArray(acc.likedTracks) && acc.likedTracks.length > 0) {
    usePlayerStore.setState((s) => ({
      likedTrackIds: Array.from(new Set([...s.likedTrackIds, ...acc.likedTracks])),
    }));
  }
}

/**
 * Initializes automatic background authentication session restoration
 * so users stay logged in across app restarts, reloads, and mobile PWA launches.
 */
export function initAuthListener(): () => void {
  return onFirebaseAuthStateChanged(async (user) => {
    if (user) {
      const cloudData = await getUserDataFromFirestore(user.uid);
      const acc: SpotifreeAccount = {
        uid: user.uid,
        email: user.email || '',
        displayName: cloudData?.displayName || user.displayName || 'Usuario',
        avatarUrl: cloudData?.photoURL || user.photoURL || null,
        bannerUrl: cloudData?.bannerUrl || null,
        spotifyCookie: cloudData?.spotifyCookie,
        playlists: cloudData?.playlists || [],
        likedTracks: cloudData?.likedTracks || [],
        updatedAt: cloudData?.updatedAt || Date.now(),
      };
      saveCurrentSpotifreeAccount(acc);
      applyAccountToAppStores(acc);

      // Listen to real-time updates from other devices
      subscribeToUserDataFirestore(user.uid, (updated) => {
        applyAccountToAppStores({ ...acc, ...updated });
      });
    }
  });
}
