import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  updateProfile,
  type Auth,
  type User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  type Firestore,
} from 'firebase/firestore';
import type { Playlist, Track } from '../types/spotify';

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
}

export interface CloudUserData {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string | null;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  spotifyCookie?: string;
  playlists: Playlist[];
  deletedPlaylistIds?: string[];
  likedTracks: string[];
  history?: Track[];
  customTransitions?: Record<string, any>;
  theme?: 'standard' | 'oled' | 'platinum';
  updatedAt?: number;
}

export const DEFAULT_FIREBASE_CONFIG: FirebaseConfig = {
  apiKey: "AIzaSyDGjCo0rg6NLe9DtgO4rXk8tQ_H3KKcdDQ",
  authDomain: "spotifree-app.firebaseapp.com",
  projectId: "spotifree-app",
  storageBucket: "spotifree-app.firebasestorage.app",
  messagingSenderId: "589271576044",
  appId: "1:589271576044:web:eac5a2243fca0259a0a4c9"
};

const STORAGE_KEY_CONFIG = 'spotifree_firebase_config';

function getStoredConfig(): FirebaseConfig {
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY_CONFIG);
      if (raw) return JSON.parse(raw);
    } catch {}
  }
  // Fallback to Vite env variables if set
  if (import.meta.env.VITE_FIREBASE_API_KEY && import.meta.env.VITE_FIREBASE_PROJECT_ID) {
    return {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    };
  }
  return DEFAULT_FIREBASE_CONFIG;
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

export function initFirebase(customConfig?: FirebaseConfig): boolean {
  const config = customConfig || getStoredConfig();
  if (!config || !config.apiKey || !config.projectId) {
    return false;
  }

  try {
    if (getApps().length === 0) {
      app = initializeApp(config);
    } else {
      app = getApps()[0];
    }
    auth = getAuth(app);
    db = getFirestore(app);
    return true;
  } catch (err) {
    console.error('[Firebase] Error initializing Firebase:', err);
    return false;
  }
}

export function saveFirebaseConfig(config: FirebaseConfig): boolean {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
    } catch {}
  }
  return initFirebase(config);
}

export function isFirebaseConfigured(): boolean {
  if (!auth || !db) {
    initFirebase();
  }
  return !!auth && !!db;
}

// Auto-initialize on module load if config exists
initFirebase();

export { auth, db };

// ----------------------------------------------------------------------
// Authentication Services
// ----------------------------------------------------------------------

export async function registerWithFirebase(
  email: string,
  pass: string,
  displayName?: string
): Promise<{ success: boolean; user?: User; error?: string }> {
  if (!isFirebaseConfigured() || !auth) {
    return {
      success: false,
      error: 'Firebase no está configurado. Introduce tu firebaseConfig primero.',
    };
  }

  try {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
    if (displayName && cred.user) {
      await updateProfile(cred.user, { displayName: displayName.trim() });
    }
    return { success: true, user: cred.user };
  } catch (err: any) {
    let msg = 'Error al registrar la cuenta.';
    if (err.code === 'auth/email-already-in-use') {
      msg = 'Ese correo ya está registrado. Prueba a iniciar sesión.';
    } else if (err.code === 'auth/invalid-email') {
      msg = 'El formato del correo electrónico no es válido.';
    } else if (err.code === 'auth/weak-password') {
      msg = 'La contraseña debe tener al menos 6 caracteres.';
    } else if (err.message) {
      msg = err.message;
    }
    return { success: false, error: msg };
  }
}

export async function loginWithFirebase(
  email: string,
  pass: string
): Promise<{ success: boolean; user?: User; error?: string }> {
  if (!isFirebaseConfigured() || !auth) {
    return {
      success: false,
      error: 'Firebase no está configurado. Introduce tu firebaseConfig primero.',
    };
  }

  try {
    const cred = await signInWithEmailAndPassword(auth, email.trim(), pass);
    return { success: true, user: cred.user };
  } catch (err: any) {
    let msg = 'Credenciales incorrectas.';
    if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
      msg = 'Correo o contraseña incorrectos.';
    } else if (err.code === 'auth/invalid-email') {
      msg = 'El formato del correo electrónico no es válido.';
    } else if (err.message) {
      msg = err.message;
    }
    return { success: false, error: msg };
  }
}

export async function loginWithGoogleFirebase(): Promise<{ success: boolean; user?: User; error?: string }> {
  if (!isFirebaseConfigured() || !auth) {
    return {
      success: false,
      error: 'Firebase no está configurado. Introduce tu firebaseConfig primero.',
    };
  }

  try {
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(auth, provider);
    return { success: true, user: cred.user };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error con el inicio de sesión de Google.' };
  }
}

export async function logoutFirebase(): Promise<void> {
  if (auth) {
    await signOut(auth);
  }
}

export function onFirebaseAuthStateChanged(cb: (user: User | null) => void): () => void {
  if (!auth) {
    initFirebase();
  }
  if (!auth) {
    cb(null);
    return () => {};
  }
  return onAuthStateChanged(auth, cb);
}

// ----------------------------------------------------------------------
// Firestore Database Synchronization (Playlists, Liked Songs, Transitions)
// ----------------------------------------------------------------------

function cleanDataForFirestore(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== undefined)
      .map((item) => (typeof item === 'object' && item !== null ? cleanDataForFirestore(item) : item));
  }
  if (typeof obj !== 'object') {
    return obj;
  }
  const cleaned: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val === undefined) continue;
    if (val !== null && typeof val === 'object') {
      cleaned[key] = cleanDataForFirestore(val);
    } else {
      cleaned[key] = val;
    }
  }
  return cleaned;
}

/** The last reason a save to the cloud failed ('' when the last one worked) */
export let lastCloudSaveError = '';

const byteSize = (x: unknown) => {
  try {
    return new Blob([JSON.stringify(x)]).size;
  } catch {
    return JSON.stringify(x || '').length;
  }
};

/** A song with just what the app needs (Firestore documents are limited to 1 MB) */
function slimTrack(t: any): any {
  if (!t || typeof t !== 'object') return t;
  const out: any = {
    id: t.id,
    name: t.name,
    duration_ms: t.duration_ms || 0,
    artists: (t.artists || []).slice(0, 4).map((a: any) => ({ id: a?.id || '', name: a?.name || '' })),
    album: {
      id: t.album?.id || '',
      name: t.album?.name || '',
      images: t.album?.images?.[0]?.url && !String(t.album.images[0].url).startsWith('data:') ? [{ url: t.album.images[0].url }] : [],
    },
  };
  if (t.added_at) out.added_at = t.added_at;
  if (t.added_by && typeof t.added_by === 'string') out.added_by = t.added_by;
  return out;
}

const isOwnList = (p: any) =>
  Boolean(p?.is_custom) || /^(custom-|pl-custom-|imported-|local-)/.test(String(p?.id || '')) || p?.id === 'liked-songs';

/** Playlists that fit in the document: slim songs first; if still too big, the songs of lists that
 *  Spotify itself gives back on the other device go, and as a last resort long lists are cut. */
function fitPlaylists(playlists: any[], budget: number): any[] {
  const slim = (p: any, items?: any[]) => {
    const own = typeof p.images?.[0]?.url === 'string' && p.images[0].url.startsWith('data:') && p.images[0].url.length > 200000;
    return {
      ...p,
      // A very big photo of its own can't travel (the songs' collage is used instead)
      images: own ? [] : p.images,
      tracks: { total: p.tracks?.total ?? (items || p.tracks?.items || []).length, items: (items ?? p.tracks?.items ?? []).map(slimTrack) },
    };
  };
  let list = playlists.slice(0, 500).map((p) => slim(p));
  if (byteSize(list) <= budget) return list;
  list = list.map((p) => (isOwnList(p) ? p : { ...p, tracks: { total: p.tracks?.total || 0, items: [] } }));
  if (byteSize(list) <= budget) return list;
  return list.map((p) => ({ ...p, tracks: { total: p.tracks?.total || 0, items: (p.tracks?.items || []).slice(0, 150) } }));
}

export async function saveUserDataToFirestore(uid: string, data: Partial<CloudUserData>): Promise<boolean> {
  if (!isFirebaseConfigured() || !db) return false;
  try {
    const userRef = doc(db, 'users', uid);
    const cleaned = prepareUserDocForFirestore(uid, data);
    if (!cleaned) return false;
    lastWrittenUpdatedAt = cleaned.updatedAt;
    writtenUpdatedAts.add(cleaned.updatedAt);
    if (writtenUpdatedAts.size > 30) writtenUpdatedAts.delete(writtenUpdatedAts.values().next().value as number);
    await setDoc(userRef, cleaned, { merge: true });
    lastCloudSaveError = '';
    return true;
  } catch (err: any) {
    lastCloudSaveError = String(err?.code || err?.message || err || 'error');
    console.error('[Firestore] Error saving user data:', err);
    return false;
  }
}

/** The account as the database rules accept it (null when it can't be saved: no valid email) */
export function prepareUserDocForFirestore(uid: string, data: Partial<CloudUserData>): Record<string, any> | null {
  {
    // firestore.rules only accept these fields (hasOnly) and reject the WHOLE save when one of
    // them breaks a limit, so every field is made to fit the rules here. App settings, the
    // listening taste and photos too big for avatarUrl travel inside the free-form "stats" map.
    const ALLOWED = [
      'uid', 'email', 'displayName', 'avatarUrl', 'photoURL', 'bannerUrl', 'spotifyCookie',
      'playlists', 'likedTracks', 'history', 'deletedPlaylistIds', 'stats', 'customTransitions',
      'theme', 'updatedAt',
    ];
    const src: Record<string, any> = { ...(data as any) };
    const stats: Record<string, any> = src.stats && typeof src.stats === 'object' ? { ...src.stats } : {};
    if (src.settings) stats.appSettings = src.settings;
    if ((src as any).taste) stats.taste = (src as any).taste;

    const payload: Record<string, any> = {};
    for (const k of ALLOWED) if (src[k] !== undefined) payload[k] = src[k];
    payload.uid = uid; // must equal the document id ("id" and "createdAt" are never sent: they can't change)

    // Rules: email required and valid
    const email = String(payload.email || '').trim().toLowerCase();
    if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
      lastCloudSaveError = 'correo no válido';
      return null;
    }
    payload.email = email;
    // displayName 1-100
    if (typeof payload.displayName === 'string') {
      payload.displayName = payload.displayName.trim().slice(0, 100);
      if (!payload.displayName) delete payload.displayName;
    } else delete payload.displayName;
    // Photos: web addresses up to 2000 characters; a picture uploaded from the device goes in stats
    for (const [k, statKey] of [['avatarUrl', 'avatarImage'], ['photoURL', ''], ['bannerUrl', 'bannerImage']] as const) {
      const v = payload[k];
      if (v === null || v === undefined) continue;
      if (typeof v !== 'string') {
        delete payload[k];
        continue;
      }
      if (v.length > 2000) {
        delete payload[k];
        if (statKey && v.startsWith('data:image') && v.length <= 350000) stats[statKey] = v;
      } else if (statKey) {
        stats[statKey] = null; // a web photo replaces an uploaded one
      }
    }
    if (typeof payload.spotifyCookie === 'string' && payload.spotifyCookie.length > 10000) delete payload.spotifyCookie;
    if (payload.theme !== undefined && !['standard', 'oled', 'platinum'].includes(payload.theme)) delete payload.theme;
    if (payload.playlists !== undefined && !Array.isArray(payload.playlists)) delete payload.playlists;
    if (payload.likedTracks !== undefined) {
      payload.likedTracks = Array.isArray(payload.likedTracks) ? payload.likedTracks.filter((x: any) => typeof x === 'string').slice(-20000) : [];
    }
    if (Array.isArray(payload.history)) payload.history = payload.history.slice(0, 500).map(slimTrack);
    else delete payload.history;
    if (Array.isArray(payload.deletedPlaylistIds) && payload.deletedPlaylistIds.length > 1000) {
      payload.deletedPlaylistIds = payload.deletedPlaylistIds.slice(-1000);
    }
    if (Object.keys(stats).length) payload.stats = stats;

    // Size: a Firestore document holds at most 1 MB
    const BUDGET = 900000;
    if (Array.isArray(payload.playlists)) {
      const rest = byteSize({ ...payload, playlists: [] });
      payload.playlists = fitPlaylists(payload.playlists, Math.max(150000, BUDGET - rest));
    }
    if (byteSize(payload) > BUDGET && payload.stats) {
      // The trash of deleted playlists gives way first (it stays on the device that deleted them)
      while (byteSize(payload) > BUDGET && Array.isArray(payload.stats.playlistTrash) && payload.stats.playlistTrash.length) {
        payload.stats.playlistTrash = payload.stats.playlistTrash.slice(0, -1);
      }
      if (byteSize(payload) > BUDGET) delete payload.stats.bannerImage;
      if (byteSize(payload) > BUDGET) delete payload.stats.avatarImage;
      if (byteSize(payload) > BUDGET && payload.stats.taste?.signals) payload.stats.taste = { ...payload.stats.taste, signals: payload.stats.taste.signals.slice(-400) };
    }

    return cleanDataForFirestore({ ...payload, updatedAt: Date.now() });
  }
}

export async function getUserDataFromFirestore(uid: string): Promise<CloudUserData | null> {
  if (!isFirebaseConfigured() || !db) return null;
  try {
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      return snap.data() as CloudUserData;
    }
    return null;
  } catch (err) {
    console.error('[Firestore] Error fetching user data:', err);
    return null;
  }
}

/** updatedAt of the documents this device wrote lately (their echo from the server is not a remote change) */
const writtenUpdatedAts = new Set<number>();
export let lastWrittenUpdatedAt = 0;

export function subscribeToUserDataFirestore(
  uid: string,
  onUpdate: (data: CloudUserData) => void
): () => void {
  if (!isFirebaseConfigured() || !db) return () => {};
  const userRef = doc(db, 'users', uid);
  return onSnapshot(
    userRef,
    (snap) => {
      if (!snap.exists()) return;
      // This device's own writes come back twice (local, then confirmed): they are not news, and
      // applying an older echo could undo a change made a moment later
      if (snap.metadata.hasPendingWrites) return;
      const data = snap.data() as CloudUserData;
      if (data?.updatedAt && writtenUpdatedAts.has(data.updatedAt)) return;
      onUpdate(data);
    },
    (err) => {
      console.warn('[Firestore] Realtime subscription error:', err);
    }
  );
}
