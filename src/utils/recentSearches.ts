export interface RecentSearchItem {
  id: string;
  type: 'track' | 'artist' | 'album' | 'playlist' | 'query';
  title: string;
  subtitle: string;
  image?: string;
  data?: any;
  timestamp: number;
}

const STORAGE_KEY = 'spotifree_recent_searches';
const MAX_RECENT_ITEMS = 20;

export function getRecentSearches(): RecentSearchItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (Array.isArray(list)) {
      return list;
    }
  } catch {}
  return [];
}

export function saveRecentSearches(items: RecentSearchItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_RECENT_ITEMS)));
    window.dispatchEvent(new CustomEvent('spotifree_recent_searches_updated', { detail: items }));
  } catch {}
}

export function addRecentSearch(item: Omit<RecentSearchItem, 'timestamp'>): RecentSearchItem[] {
  const current = getRecentSearches();
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
  saveRecentSearches(updated);
  return updated;
}

export function removeRecentSearch(id: string): RecentSearchItem[] {
  const current = getRecentSearches();
  const updated = current.filter((item) => item.id !== id);
  saveRecentSearches(updated);
  return updated;
}

export function clearRecentSearches(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('spotifree_recent_searches_updated', { detail: [] }));
  } catch {}
}
