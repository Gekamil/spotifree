/**
 * Apple Music animated covers for the playing song's album (only albums Apple made one for).
 * The album is found with the iTunes Search API (from the device, so no server limits), the
 * video link comes from /api/motion-cover (api/metadata.js), results are kept for 7 days.
 */
import type { Track } from '../types/spotify';

export type MotionCoverMode = 'off' | 'wifi' | 'always';
export const MOTION_COVER_KEY = 'spotifree_motion_covers';
export const MOTION_COVER_EVENT = 'spotifree:motion-covers-changed';

export function getMotionCoverMode(): MotionCoverMode {
  try {
    const v = localStorage.getItem(MOTION_COVER_KEY);
    return v === 'off' || v === 'always' ? v : 'wifi';
  } catch {
    return 'wifi';
  }
}

export function setMotionCoverMode(mode: MotionCoverMode) {
  try {
    localStorage.setItem(MOTION_COVER_KEY, mode);
  } catch {}
  try {
    window.dispatchEvent(new CustomEvent(MOTION_COVER_EVENT));
  } catch {}
}

/** Whether animated covers may load now (setting + data saver / mobile data) */
export function motionCoversAllowed(): boolean {
  const mode = getMotionCoverMode();
  if (mode === 'off') return false;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return false;
  const conn = (navigator as any)?.connection;
  if (conn?.saveData) return false;
  if (mode === 'wifi' && conn && (conn.type === 'cellular' || /(^|-)?(2g|3g)$/.test(conn.effectiveType || ''))) return false;
  return true;
}

export interface MotionCover {
  video: string;
  poster: string | null;
  /** 'hls' = Apple Music animated cover (.m3u8); 'mp4' = the song's Spotify Canvas */
  kind?: 'hls' | 'mp4';
}

const TTL = 7 * 24 * 3600 * 1000;
// v2: v1 could hold animated covers of other albums by the same artist
const STORE_KEY = 'spotifree_motion_cover_cache_v2';
try {
  localStorage.removeItem('spotifree_motion_cover_cache_v1');
} catch {}
const mem = new Map<string, MotionCover | null>();
const pending = new Map<string, Promise<MotionCover | null>>();
let stored: Record<string, { t: number; v: MotionCover | null }> = (() => {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
  } catch {
    return {};
  }
})();

function save(key: string, v: MotionCover | null) {
  mem.set(key, v);
  stored[key] = { t: Date.now(), v };
  const keys = Object.keys(stored);
  if (keys.length > 400) {
    keys.sort((a, b) => stored[a].t - stored[b].t).slice(0, keys.length - 400).forEach((k) => delete stored[k]);
  }
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(stored));
  } catch {
    stored = {};
  }
}

const norm = (s = '') =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s*[([].*?[)\]]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

function albumKey(t: Track): string {
  return `${norm(t.artists?.[0]?.name)}|${norm(t.album?.name || t.name)}`;
}

const artistIdMem = new Map<string, string | null>();

/** Apple's id for the artist (exact name), to list their own albums */
async function appleArtistId(artist: string): Promise<string | null> {
  const key = norm(artist);
  if (artistIdMem.has(key)) return artistIdMem.get(key) || null;
  try {
    const r = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(artist)}&entity=musicArtist&limit=5&country=es`);
    if (!r.ok) return null;
    const data = await r.json();
    const hit = (data.results || []).find((x: any) => norm(x.artistName) === key);
    const id = hit?.artistId ? String(hit.artistId) : null;
    artistIdMem.set(key, id);
    return id;
  } catch {
    return null;
  }
}

/** The album, found in the artist's own catalogue (titles like "EoO" are not found by search) */
async function albumFromArtistCatalogue(artist: string, album: string): Promise<string | null> {
  const want = norm(album);
  if (!want) return null;
  const artistId = await appleArtistId(artist);
  if (!artistId) return null;
  try {
    const r = await fetch(`https://itunes.apple.com/lookup?id=${artistId}&entity=album&limit=200&country=es`);
    if (!r.ok) return null;
    const data = await r.json();
    const albums: any[] = (data.results || []).filter((x: any) => x.wrapperType === 'collection');
    const strip = (s: string) => norm(s).replace(/\s+(single|ep|deluxe|deluxe edition|edicion deluxe)$/, '');
    const hit = albums.find((x) => norm(x.collectionName) === want) || albums.find((x) => strip(x.collectionName) === strip(album));
    return hit?.collectionId ? String(hit.collectionId) : null;
  } catch {
    return null;
  }
}

async function appleAlbumId(t: Track): Promise<string | null> {
  const artist = t.artists?.[0]?.name || '';
  const term = encodeURIComponent(`${artist} ${t.name}`.trim());
  try {
    const r = await fetch(`https://itunes.apple.com/search?term=${term}&entity=song&limit=8&country=es`);
    if (r.ok) {
      const data = await r.json();
      // Exactly this song: same artist (whole name) and same title, or the same album name.
      // Never "the artist's first album": that showed covers of other albums.
      const artistN = norm(artist);
      const title = norm(t.name);
      const album = norm(t.album?.name);
      const results: any[] = (data.results || []).filter((x: any) => {
        const xa = norm(x.artistName);
        return artistN && xa && (xa.includes(artistN) || artistN.includes(xa));
      });
      const hit =
        (album && results.find((x) => norm(x.collectionName) === album)) ||
        results.find((x) => norm(x.trackName) === title) ||
        null;
      if (hit?.collectionId) return String(hit.collectionId);
    }
  } catch {}
  // Second try: the album by name in the artist's catalogue
  return t.album?.name ? albumFromArtistCatalogue(artist, t.album.name) : null;
}


/** Apple Music animated cover of the track's album (cached per album), or null */
function appleMotion(t: Track): Promise<MotionCover | null> {
  const key = albumKey(t);
  if (mem.has(key)) return Promise.resolve(mem.get(key) || null);
  const s = stored[key];
  if (s && Date.now() - s.t < TTL) {
    mem.set(key, s.v);
    return Promise.resolve(s.v);
  }
  const p0 = pending.get(key);
  if (p0) return p0;
  const p = (async () => {
    try {
      const id = await appleAlbumId(t);
      // No exact album found: no Apple cover (a wrong one is worse than none)
      if (!id) return null;
      const r = await fetch(`/api/motion-cover?id=${id}&country=es`);
      if (!r.ok) return null;
      const data = await r.json();
      const v: MotionCover | null = data?.square?.video ? { video: data.square.video, poster: data.square.poster || null, kind: 'hls' } : null;
      // Only remember answers that really came back (not network errors)
      if (data && !data.error) save(key, v);
      return v;
    } catch {
      return null;
    } finally {
      pending.delete(key);
    }
  })();
  pending.set(key, p);
  return p;
}

/**
 * Moving cover for the playing song: only the album's Apple Music animated cover (the Spotify
 * Canvas has its own button in the player, so it is not repeated here), or null.
 */
export async function getMotionCover(t: Track | null | undefined): Promise<MotionCover | null> {
  if (!t?.name || !t.artists?.[0]?.name) return null;
  return appleMotion(t);
}
