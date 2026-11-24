import { getActiveUserId } from './userStorage';

export interface RecentSearchItem {
  id: string;
  type: 'track' | 'artist' | 'album' | 'playlist' | 'query';
  title: string;
  subtitle: string;
  image?: string;
  data?: any;
  timestamp: number;
}

const STORAGE_KEY_PREFIX = 'spotifree_recent_searches';
const MAX_RECENT_ITEMS = 20;

export function getRecentSearchesStorageKey(userId?: string): string {
  const uid = (userId || getActiveUserId() || 'guest').trim();
  const safeUid = uid && uid !== 'undefined' && uid !== 'null' ? uid : 'guest';
  return `${STORAGE_KEY_PREFIX}_${safeUid}`;
}

export function notifyRecentSearchesUpdated(items?: RecentSearchItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    const detail = items || getRecentSearches();
    window.dispatchEvent(new CustomEvent('spotifree_recent_searches_updated', { detail }));
  } catch {}
}

export function getRecentSearches(userId?: string): RecentSearchItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const key = getRecentSearchesStorageKey(userId);
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (Array.isArray(list)) {
      return list;
    }
  } catch {}
  return [];
}

export function saveRecentSearches(items: RecentSearchItem[], userId?: string): void {
  if (typeof window === 'undefined') return;
  try {
    const key = getRecentSearchesStorageKey(userId);
    const slice = items.slice(0, MAX_RECENT_ITEMS);
    window.localStorage.setItem(key, JSON.stringify(slice));
    notifyRecentSearchesUpdated(slice);
  } catch {}
}

export function addRecentSearch(item: Omit<RecentSearchItem, 'timestamp'>, userId?: string): RecentSearchItem[] {
  const current = getRecentSearches(userId);
  const cleanTitle = (item.title || '').trim().toLowerCase();
  
  // Filter out existing duplicates with same id or title + type
  const filtered = current.filter(
    (existing) => existing.id !== item.id && !(existing.title.trim().toLowerCase() === cleanTitle && existing.type === item.type)
  );

  const newItem: RecentSearchItem = {
    ...item,
    timestamp: Date.now(),
  };

  const updated = [newItem, ...filtered].slice(0, MAX_RECENT_ITEMS);
  saveRecentSearches(updated, userId);
  return updated;
}

export function removeRecentSearch(id: string, userId?: string): RecentSearchItem[] {
  const current = getRecentSearches(userId);
  const updated = current.filter((item) => item.id !== id);
  saveRecentSearches(updated, userId);
  return updated;
}

export function clearRecentSearches(userId?: string): void {
  if (typeof window === 'undefined') return;
  try {
    const key = getRecentSearchesStorageKey(userId);
    window.localStorage.removeItem(key);
    notifyRecentSearchesUpdated([]);
  } catch {}
}
