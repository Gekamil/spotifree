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

export function getSavedAccounts(): SavedAccount[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(ACCOUNTS_STORAGE_KEY);
    if (!raw) return [];
    const list: SavedAccount[] = JSON.parse(raw);
    if (!Array.isArray(list)) return [];

    // Filter out ghost/dummy accounts like 'spotify-oauth-user' or 'Cuenta de Spotify'
    const cleanList = list.filter((a) => {
      if (!a) return false;
      const normId = (a.id || '').toLowerCase().trim();
      const normName = (a.displayName || '').toLowerCase().trim();
      if (normId === 'spotify-oauth-user' || normId === 'spotify-dummy-user') return false;
      if (normName === 'cuenta de spotify') return false;
      return true;
    });

    if (cleanList.length !== list.length) {
      window.localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(cleanList));
    }

    // Deduplicate accounts strictly by displayName, id, email, or cookie
    const seen = new Set<string>();
    const deduplicated: SavedAccount[] = [];

    for (const a of cleanList) {
      if (!a) continue;
      const keyName = a.displayName ? a.displayName.toLowerCase().trim() : '';
      const keyId = a.id ? a.id.toLowerCase().trim() : '';
      const keyCookie = a.cookie ? cleanSpDc(a.cookie) : '';
      const keyEmail = a.email ? a.email.toLowerCase().trim() : '';

      if (
        (keyName && seen.has(`name:${keyName}`)) ||
        (keyId && seen.has(`id:${keyId}`)) ||
        (keyEmail && seen.has(`email:${keyEmail}`)) ||
        (keyCookie && seen.has(`cookie:${keyCookie.slice(0, 30)}`))
      ) {
        continue;
      }

      if (keyName) seen.add(`name:${keyName}`);
      if (keyId) seen.add(`id:${keyId}`);
      if (keyEmail) seen.add(`email:${keyEmail}`);
      if (keyCookie) seen.add(`cookie:${keyCookie.slice(0, 30)}`);

      deduplicated.push(a);
    }

    return deduplicated;
  } catch {}
  return [];
}

export function saveAccount(account: SavedAccount) {
  if (typeof window === 'undefined' || !account) return;
  // Never save ghost/dummy accounts
  const rawId = (account.id || '').toLowerCase().trim();
  const rawName = (account.displayName || '').toLowerCase().trim();
  if (rawId === 'spotify-oauth-user' || rawId === 'spotify-dummy-user' || rawName === 'cuenta de spotify') {
    return;
  }

  try {
    const normName = account.displayName ? account.displayName.toLowerCase().trim() : '';
    const normId = account.id ? account.id.toLowerCase().trim() : '';
    const normCookie = account.cookie ? cleanSpDc(account.cookie) : '';
    const normEmail = account.email ? account.email.toLowerCase().trim() : '';

    // Check if there was an existing entry with matching identity to preserve avatar/banner
    const existing = getSavedAccounts().find((a) => {
      const aName = a.displayName ? a.displayName.toLowerCase().trim() : '';
      const aId = a.id ? a.id.toLowerCase().trim() : '';
      const aCookie = a.cookie ? cleanSpDc(a.cookie) : '';
      const aEmail = a.email ? a.email.toLowerCase().trim() : '';

      if (normName && aName && aName === normName) return true;
      if (normId && aId && aId === normId) return true;
      if (normEmail && aEmail && aEmail === normEmail) return true;
      if (normCookie && aCookie && (aCookie.includes(normCookie.slice(0, 30)) || normCookie.includes(aCookie.slice(0, 30)))) return true;
      return false;
    });

    const stableId =
      account.id && !account.id.startsWith('user-')
        ? account.id
        : existing?.id || (normName ? `user_${normName.replace(/[^a-z0-9]/g, '_')}` : `user_${Date.now()}`);

    const merged: SavedAccount = {
      id: stableId,
      displayName: account.displayName || existing?.displayName || 'Usuario Spotify',
      avatarUrl: account.avatarUrl || existing?.avatarUrl,
      bannerUrl: account.bannerUrl || existing?.bannerUrl,
      email: account.email || existing?.email,
      cookie: normCookie || existing?.cookie || '',
      accessToken: account.accessToken || existing?.accessToken,
      lastUsed: Date.now(),
    };

    // Filter out ANY previous match
    const list = getSavedAccounts().filter((a) => {
      const aName = a.displayName ? a.displayName.toLowerCase().trim() : '';
      const aId = a.id ? a.id.toLowerCase().trim() : '';
      const aCookie = a.cookie ? cleanSpDc(a.cookie) : '';
      const aEmail = a.email ? a.email.toLowerCase().trim() : '';

      if (normName && aName === normName) return false;
      if (stableId && aId === stableId) return false;
      if (normEmail && aEmail && aEmail === normEmail) return false;
      if (normCookie && aCookie && (aCookie.includes(normCookie.slice(0, 30)) || normCookie.includes(aCookie.slice(0, 30)))) return false;

      return true;
    });

    list.unshift(merged);
    window.localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(list.slice(0, 10)));
  } catch {}
}

export function removeSavedAccount(accountIdOrName: string) {
  if (typeof window === 'undefined' || !accountIdOrName) return;
  try {
    const target = accountIdOrName.toLowerCase().trim();
    const cleanTargetCookie = cleanSpDc(accountIdOrName);

    const list = getSavedAccounts().filter((a) => {
      const aId = a.id ? a.id.toLowerCase().trim() : '';
      const aName = a.displayName ? a.displayName.toLowerCase().trim() : '';
      const aEmail = a.email ? a.email.toLowerCase().trim() : '';
      const aCookie = a.cookie ? cleanSpDc(a.cookie) : '';

      if (aId === target || aName === target) return false;
      if (aEmail && aEmail === target) return false;
      if (cleanTargetCookie && aCookie && (aCookie.includes(cleanTargetCookie.slice(0, 30)) || cleanTargetCookie.includes(aCookie.slice(0, 30)))) return false;
      return true;
    });

    window.localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(list));
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
 * Saves a cookie to the currently active account (or creates an account entry for it)
 */
export function saveCookieToActiveAccount(cookie: string, sessionData?: any) {
  if (typeof window === 'undefined' || !cookie) return;
  const clean = cleanSpDc(cookie);
  const activeId = window.localStorage.getItem('spotifree_active_user_id') || sessionData?.user?.id || 'active_user';

  const accounts = getSavedAccounts();
  const existing = accounts.find((a) => a.id === activeId || a.displayName === sessionData?.user?.display_name);

  const updated: SavedAccount = {
    id: sessionData?.user?.id || activeId,
    displayName: sessionData?.user?.display_name || existing?.displayName || 'Usuario Spotify',
    avatarUrl: sessionData?.user?.images?.[0]?.url || existing?.avatarUrl,
    bannerUrl: existing?.bannerUrl,
    email: sessionData?.user?.email || existing?.email,
    cookie: clean,
    lastUsed: Date.now(),
  };

  saveAccount(updated);
  if (sessionData) {
    try {
      window.localStorage.setItem(`spotifree_account_session_${updated.id}`, JSON.stringify(sessionData));
    } catch {}
  }
}
