export interface SavedAccount {
  id: string;
  displayName: string;
  email?: string;
  avatarUrl?: string;
  cookie: string;
  accessToken?: string;
  lastUsed: number;
}

export const ACCOUNTS_STORAGE_KEY = 'spotifree_saved_accounts';

export function getSavedAccounts(): SavedAccount[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(ACCOUNTS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

export function saveAccount(account: SavedAccount) {
  if (typeof window === 'undefined') return;
  try {
    const list = getSavedAccounts().filter(
      (a) => a.id !== account.id && (!account.cookie || a.cookie !== account.cookie)
    );
    list.unshift(account);
    window.localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(list.slice(0, 10)));
  } catch {}
}

export function removeSavedAccount(accountId: string) {
  if (typeof window === 'undefined') return;
  try {
    const list = getSavedAccounts().filter((a) => a.id !== accountId);
    window.localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(list));
  } catch {}
}

export function cleanSpDc(raw: string): string {
  if (!raw) return '';
  let str = raw.trim();
  const match = str.match(/sp_dc=([^;]+)/);
  if (match) return match[1].trim();
  return str.replace(/^sp_dc=/i, '').trim();
}
