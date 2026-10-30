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
  bannerUrl?: string | null;
  spotifyCookie?: string;
  playlists: Playlist[];
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

export async function saveUserDataToFirestore(uid: string, data: Partial<CloudUserData>): Promise<boolean> {
  if (!isFirebaseConfigured() || !db) return false;
  try {
    const userRef = doc(db, 'users', uid);
    await setDoc(userRef, { ...data, updatedAt: Date.now() }, { merge: true });
    return true;
  } catch (err) {
    console.error('[Firestore] Error saving user data:', err);
    return false;
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

export function subscribeToUserDataFirestore(
  uid: string,
  onUpdate: (data: CloudUserData) => void
): () => void {
  if (!isFirebaseConfigured() || !db) return () => {};
  const userRef = doc(db, 'users', uid);
  return onSnapshot(
    userRef,
    (snap) => {
      if (snap.exists()) {
        onUpdate(snap.data() as CloudUserData);
      }
    },
    (err) => {
      console.warn('[Firestore] Realtime subscription error:', err);
    }
  );
}
