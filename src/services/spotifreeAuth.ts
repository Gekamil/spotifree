import { API_BASE } from '../config';
import type { Playlist, Track } from '../types/spotify';

export interface SpotifreeAccount {
  email: string;
  displayName: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  spotifyCookie?: string;
  playlists: Playlist[];
  likedTracks: string[];
  history?: Track[];
  stats?: any;
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

export async function registerSpotifreeAccount(
  email: string,
  password: string,
  displayName?: string
): Promise<{ success: boolean; account?: SpotifreeAccount; error?: string }> {
  const local = getLocalDataToMerge();
  const cleanEmail = email.trim().toLowerCase();
  const cleanName = displayName?.trim() || cleanEmail.split('@')[0] || 'Usuario';

  // 1. Try server endpoint
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
        const db = getLocalAccountsDb();
        db[cleanEmail] = { ...data.account, password };
        saveLocalAccountsDb(db);
        return { success: true, account: data.account };
      }
      if (data.error) {
        return { success: false, error: data.error };
      }
    }
  } catch {
    // Server unavailable, fall through to instant offline local DB
  }

  // 2. Instant Local Accounts DB Fallback (works 100% offline & in PWA shortcuts)
  try {
    const db = getLocalAccountsDb();
    if (db[cleanEmail]) {
      return { success: false, error: 'Ya existe una cuenta registrada con este correo.' };
    }

    const newAcc: SpotifreeAccount = {
      email: cleanEmail,
      displayName: cleanName,
      avatarUrl: null,
      bannerUrl: null,
      spotifyCookie: local.cookie,
      playlists: local.playlists,
      likedTracks: local.likedTracks,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    db[cleanEmail] = { ...newAcc, password };
    saveLocalAccountsDb(db);
    saveCurrentSpotifreeAccount(newAcc);
    return { success: true, account: newAcc };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al guardar la cuenta local.' };
  }
}

export async function loginSpotifreeAccount(
  email: string,
  password: string
): Promise<{ success: boolean; account?: SpotifreeAccount; error?: string }> {
  const local = getLocalDataToMerge();
  const cleanEmail = email.trim().toLowerCase();

  // 1. Try server endpoint
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
        if (data.account.spotifyCookie && typeof window !== 'undefined') {
          window.localStorage.setItem('user_spotify_cookie', data.account.spotifyCookie);
        }
        const db = getLocalAccountsDb();
        db[cleanEmail] = { ...data.account, password };
        saveLocalAccountsDb(db);
        return { success: true, account: data.account };
      }
      if (data.error) {
        return { success: false, error: data.error };
      }
    }
  } catch {
    // Server unavailable, fall through to local accounts store
  }

  // 2. Instant Local Accounts DB Fallback
  try {
    const db = getLocalAccountsDb();
    const existing = db[cleanEmail];
    if (!existing || (existing.password && existing.password !== password)) {
      return { success: false, error: 'Correo o contraseña incorrectos.' };
    }

    const mergedAcc: SpotifreeAccount = {
      ...existing,
      spotifyCookie: existing.spotifyCookie || local.cookie,
      playlists: Array.isArray(existing.playlists) && existing.playlists.length > 0 ? existing.playlists : local.playlists,
      likedTracks: Array.from(new Set([...(existing.likedTracks || []), ...local.likedTracks])),
      updatedAt: Date.now(),
    };

    saveCurrentSpotifreeAccount(mergedAcc);
    if (mergedAcc.spotifyCookie && typeof window !== 'undefined') {
      window.localStorage.setItem('user_spotify_cookie', mergedAcc.spotifyCookie);
    }
    return { success: true, account: mergedAcc };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al autenticar la cuenta local.' };
  }
}

export async function syncSpotifreeAccount(
  payload: Partial<SpotifreeAccount> & { password?: string }
): Promise<SpotifreeAccount | null> {
  const current = getSavedSpotifreeAccount();
  const email = (payload.email || current?.email || '').trim().toLowerCase();
  if (!email) return null;

  let syncedAccount: SpotifreeAccount | null = null;

  try {
    const res = await fetch(`${API_BASE}/api/auth/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password: payload.password || '1234',
        ...payload,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.account) {
        syncedAccount = data.account;
      }
    }
  } catch {}

  if (!syncedAccount) {
    // Local fallback update
    syncedAccount = {
      ...(current || {}),
      ...payload,
      email,
      updatedAt: Date.now(),
    } as SpotifreeAccount;
  }

  saveCurrentSpotifreeAccount(syncedAccount);
  const db = getLocalAccountsDb();
  if (db[email]) {
    db[email] = { ...db[email], ...syncedAccount };
    saveLocalAccountsDb(db);
  }
  return syncedAccount;
}
