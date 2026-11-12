/**
 * How "Aleatorio" orders the songs (Settings › Ajustes avanzados).
 *
 *  - 'random': a plain random order (Fisher-Yates). The same artist can come up several times in a row.
 *  - 'balanced' (default, like Spotify's): each artist's songs are spread evenly over the whole
 *    list with a random start and a little jitter, so the same artist is not heard twice in a row
 *    and every artist shows up throughout (Spotify's published approach to shuffle).
 * Option "recentAtEnd": songs heard in the last few days go towards the end of the order, so
 * the shuffle starts with what you haven't heard lately.
 */
import type { Track } from '../types/spotify';
import { isTasteRatingActive, isTrackDisliked } from '../services/labsService';
import { isNotInterested } from './notInterested';

export type ShuffleAlgorithm = 'random' | 'balanced';

const ALGO_KEY = 'spotifree_shuffle_algorithm';
const RECENT_KEY = 'spotifree_shuffle_recent_at_end';

export function getShuffleAlgorithm(): ShuffleAlgorithm {
  try {
    return localStorage.getItem(ALGO_KEY) === 'random' ? 'random' : 'balanced';
  } catch {
    return 'balanced';
  }
}
export function setShuffleAlgorithm(a: ShuffleAlgorithm) {
  try {
    localStorage.setItem(ALGO_KEY, a);
    window.dispatchEvent(new Event('spotifree:shuffle-settings'));
  } catch {}
}
export function getRecentAtEnd(): boolean {
  try {
    return localStorage.getItem(RECENT_KEY) !== 'false';
  } catch {
    return true;
  }
}
export function setRecentAtEnd(on: boolean) {
  try {
    localStorage.setItem(RECENT_KEY, on ? 'true' : 'false');
    window.dispatchEvent(new Event('spotifree:shuffle-settings'));
  } catch {}
}

function fisherYates<T>(list: T[]): T[] {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const artistKey = (t: Track) => (t.artists?.[0]?.name || t.artists?.[0]?.id || '?').toLowerCase().trim();

/** Spreads each artist evenly over 0..1 (random start, ±jitter), then sorts by position */
function balanced(list: Track[], penaltyOf: (t: Track) => number): Track[] {
  const groups = new Map<string, Track[]>();
  for (const t of list) {
    const k = artistKey(t);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(t);
  }
  const placed: Array<{ t: Track; pos: number }> = [];
  for (const songs of groups.values()) {
    const n = songs.length;
    const shuffled = fisherYates(songs);
    const start = Math.random() / n;
    shuffled.forEach((t, i) => {
      const jitter = (Math.random() - 0.5) * (0.35 / n);
      placed.push({ t, pos: start + i / n + jitter + penaltyOf(t) });
    });
  }
  placed.sort((a, b) => a.pos - b.pos);
  // Last pass: if the same artist still lands twice in a row, swap with the next different one
  const out = placed.map((p) => p.t);
  for (let i = 1; i < out.length; i++) {
    if (artistKey(out[i]) !== artistKey(out[i - 1])) continue;
    const j = out.findIndex((x, k) => k > i && artistKey(x) !== artistKey(out[i - 1]) && (k + 1 >= out.length || artistKey(out[k + 1]) !== artistKey(out[i])));
    if (j > i) [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Shuffled order for the queue. `lastPlayedOf` returns when a song was last heard (ms, 0 = never).
 */
export function shuffleTracks(list: Track[], lastPlayedOf: (t: Track) => number = () => 0): Track[] {
  const effectiveList = list.filter((t) => !isNotInterested(t) && (!isTasteRatingActive() || !isTrackDisliked(t)));
  const targetList = effectiveList.length > 0 ? effectiveList : list;

  if (targetList.length <= 2) return fisherYates(targetList);
  const recentAtEnd = getRecentAtEnd();
  const now = Date.now();
  // Heard today: towards the end; in the last 3 days: second half; this week: a nudge
  const penaltyOf = (t: Track) => {
    if (!recentAtEnd) return 0;
    const ts = lastPlayedOf(t);
    if (!ts) return 0;
    const h = (now - ts) / 3600000;
    return h < 24 ? 1 : h < 72 ? 0.5 : h < 168 ? 0.2 : 0;
  };
  if (getShuffleAlgorithm() === 'random') {
    const order = fisherYates(targetList);
    if (!recentAtEnd) return order;
    // Random, but what was heard lately still goes later
    return order
      .map((t, i) => ({ t, pos: i / order.length + penaltyOf(t) }))
      .sort((a, b) => a.pos - b.pos)
      .map((x) => x.t);
  }
  return balanced(targetList, penaltyOf);
}
