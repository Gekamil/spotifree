/**
 * "No me interesa" (Spotify's "Not interested"): songs the user doesn't want recommended.
 * They are left out of Spotifree's mixes, recommendations, smart shuffle and autoplay, and the
 * taste engine counts it as a strong "no" (spotifreeMixes listens to the event).
 * Kept per account on this device.
 */
import type { Track } from '../types/spotify';

const norm = (s: string) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s*[([].*?[)\]]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
const keyOf = (t: Pick<Track, 'name' | 'artists'>) => `${norm(t.name)}|${norm(t.artists?.[0]?.name || '')}`;
const storeKey = () => {
  try {
    return `spotifree_not_interested_${localStorage.getItem('spotifree_active_user_id') || 'active'}`;
  } catch {
    return 'spotifree_not_interested_active';
  }
};

let cache: { key: string; set: Set<string> } | null = null;
function load(): Set<string> {
  const k = storeKey();
  if (cache?.key === k) return cache.set;
  let set = new Set<string>();
  try {
    set = new Set(JSON.parse(localStorage.getItem(k) || '[]'));
  } catch {}
  cache = { key: k, set };
  return set;
}
function save(set: Set<string>) {
  try {
    localStorage.setItem(storeKey(), JSON.stringify([...set].slice(-2000)));
  } catch {}
}

export function isNotInterested(t: Pick<Track, 'name' | 'artists'> | null | undefined): boolean {
  if (!t?.name) return false;
  return load().has(keyOf(t));
}

/** Drops the songs the user said "No me interesa" to */
export function withoutNotInterested<T extends Pick<Track, 'name' | 'artists'>>(list: T[]): T[] {
  const set = load();
  if (!set.size) return list;
  return list.filter((t) => !t?.name || !set.has(keyOf(t)));
}

export function markNotInterested(t: Track) {
  const set = load();
  set.add(keyOf(t));
  save(set);
  try {
    window.dispatchEvent(new CustomEvent('spotifree:not-interested', { detail: { track: t } }));
  } catch {}
}

export function undoNotInterested(t: Track) {
  const set = load();
  set.delete(keyOf(t));
  save(set);
  try {
    window.dispatchEvent(new CustomEvent('spotifree:not-interested', { detail: { track: t, undone: true } }));
  } catch {}
}

export function getNotInterestedCount(): number {
  return load().size;
}

export function clearAllNotInterested(): void {
  const set = new Set<string>();
  save(set);
  cache = { key: storeKey(), set };
  try {
    window.dispatchEvent(new CustomEvent('spotifree:not-interested-cleared'));
  } catch {}
}
