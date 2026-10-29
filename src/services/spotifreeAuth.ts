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
  createdAt?: number;
  updatedAt?: number;
}

const STORAGE_KEY = 'spotifree_current_cloud_account';

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

export async function registerSpotifreeAccount(
  email: string,
  password: string,
  displayName?: string
): Promise<{ success: boolean; account?: SpotifreeAccount; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, displayName }),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      saveCurrentSpotifreeAccount(data.account);
      return { success: true, account: data.account };
    }
    return { success: false, error: data.error || 'Error al registrar la cuenta.' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error de conexión con el servidor.' };
  }
}

export async function loginSpotifreeAccount(
  email: string,
  password: string
): Promise<{ success: boolean; account?: SpotifreeAccount; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      saveCurrentSpotifreeAccount(data.account);
      return { success: true, account: data.account };
    }
    return { success: false, error: data.error || 'Correo o contraseña incorrectos.' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error de conexión con el servidor.' };
  }
}

export async function syncSpotifreeAccount(
  payload: Partial<SpotifreeAccount> & { password?: string }
): Promise<SpotifreeAccount | null> {
  const current = getSavedSpotifreeAccount();
  const email = payload.email || current?.email;
  if (!email) return null;

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
        saveCurrentSpotifreeAccount(data.account);
        return data.account;
      }
    }
  } catch (e) {
    console.warn('[SpotifreeCloudSync error]:', e);
  }
  return null;
}
