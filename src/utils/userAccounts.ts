export interface SavedAccount {
  id: string;
  displayName: string;
  email?: string;
  avatarUrl?: string;
  bannerUrl?: string;
  cookie: string;
  accessToken?: string;
  lastUsed: number;
}

export const ACCOUNTS_STORAGE_KEY = 'spotifree_saved_accounts';

// Instantly purge all legacy/mock accounts from localStorage
if (typeof window !== 'undefined') {
  try {
    window.localStorage.removeItem(ACCOUNTS_STORAGE_KEY);
    window.localStorage.removeItem('spotifree_active_user_id');
  } catch {}
}

export function getSavedAccounts(): SavedAccount[] {
  // Purged: Spotifree now strictly uses unified Firebase Email/Password cloud accounts.
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(ACCOUNTS_STORAGE_KEY);
      window.localStorage.removeItem('spotifree_active_user_id');
    } catch {}
  }
  return [];
}

export function saveAccount(_account: SavedAccount) {
  // No-op: legacy local accounts are deprecated in favor of Firebase Auth
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(ACCOUNTS_STORAGE_KEY);
    } catch {}
  }
}

export function removeSavedAccount(accountIdOrName: string) {
  if (typeof window === 'undefined' || !accountIdOrName) return;
  try {
    window.localStorage.removeItem(ACCOUNTS_STORAGE_KEY);
    window.localStorage.removeItem(`spotifree_account_session_${accountIdOrName}`);
    window.localStorage.removeItem(`spotifree_playlist_cache_${accountIdOrName}`);
    window.localStorage.removeItem(`spotifree_custom_profile_${accountIdOrName}`);
  } catch {}
}

export function cleanSpDc(raw: string): string {
  if (!raw) return '';
  let str = String(raw).trim();
  str = str.replace(/^[\s"'“”‘’]+|[\s"'“”‘’;]+$/g, '').trim();
  const match = str.match(/sp_dc=([^;]+)/i);
  if (match) str = match[1].trim();
  str = str.replace(/^sp_dc=/i, '').trim();
  str = str.replace(/^[\s"'“”‘’]+|[\s"'“”‘’;]+$/g, '').trim();
  try {
    str = decodeURIComponent(str);
  } catch {}
  return str.replace(/^[\s"'“”‘’]+|[\s"'“”‘’;]+$/g, '').trim();
}

/**
 * Saves profile customization to both localStorage and the backend profile API
 * for persistent cross-device synchronization.
 */
export async function syncUserProfileToServer(data: {
  userId: string;
  displayName?: string;
  avatarUrl?: string;
  bannerUrl?: string;
  cookie?: string;
  email?: string;
}) {
  if (typeof window === 'undefined' || !data.userId) return;

  const currentCookie = data.cookie || window.localStorage.getItem('user_spotify_cookie') || '';
  const clean = cleanSpDc(currentCookie);

  // 1. LocalStorage immediate backup
  try {
    const key = `spotifree_custom_profile_${data.userId}`;
    const existing = window.localStorage.getItem(key);
    const parsed = existing ? JSON.parse(existing) : {};
    const merged = { ...parsed, ...data, cookie: clean, updatedAt: Date.now() };
    window.localStorage.setItem(key, JSON.stringify(merged));
  } catch {}

  // 2. Server API sync for cross-device parity
  try {
    await fetch('/api/user-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, cookie: clean }),
      signal: AbortSignal.timeout(4000),
    });
  } catch {}
}

/**
 * Fetches profile customization from backend profile API
 */
export async function fetchUserProfileFromServer(
  identifier: string | { userId?: string; displayName?: string; cookie?: string }
): Promise<any | null> {
  if (typeof window === 'undefined' || !identifier) return null;
  try {
    let query = '';
    if (typeof identifier === 'string') {
      query = `userId=${encodeURIComponent(identifier)}`;
    } else {
      const parts: string[] = [];
      if (identifier.userId) parts.push(`userId=${encodeURIComponent(identifier.userId)}`);
      if (identifier.displayName) parts.push(`name=${encodeURIComponent(identifier.displayName)}`);
      if (identifier.cookie) parts.push(`cookie=${encodeURIComponent(cleanSpDc(identifier.cookie))}`);
      query = parts.join('&');
    }

    const res = await fetch(`/api/user-profile?${query}`, {
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const json = await res.json();
      return json?.profile || null;
    }
  } catch {}
  return null;
}

export { switchActiveAccount } from '../store/useSpotifyDataStore';

/**
 * Saves a cookie to the currently active session
 */
export function saveCookieToActiveAccount(cookie: string, _sessionData?: any) {
  if (typeof window === 'undefined' || !cookie) return;
  const clean = cleanSpDc(cookie);
  window.localStorage.setItem('user_spotify_cookie', clean);
}
