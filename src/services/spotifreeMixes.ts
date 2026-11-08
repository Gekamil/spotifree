/**
 * Spotifree's own playlists ("Hecho para ti"), built from what each account really listens to.
 *
 * 1. Signals (per account, kept on the device): songs played 30 s or more, skips, likes /
 *    unlikes, searches, plus what Spotify brings (top songs / artists, recent plays, liked songs,
 *    the user's playlists) — Spotify's recent plays are copied into our own history.
 * 2. Every signal fades with time (likes slowest, searches fastest) and Spotify's starting data
 *    fades over months, so after a long time the recommendations follow what is played HERE.
 * 3. Playlists: Mix diario 1-6 (artists that go together, new picks every day), Descubrimiento
 *    semanal (new artists, every Monday), Radar de novedades (recent releases of your artists),
 *    En repeat, Tus clásicos and "Mix de <artista>". New music comes from /api/discover.
 * 4. Covers vary each time (artist photo with a colour band, collage of 4 covers, or one cover
 *    with a gradient), drawn on the device.
 */
import { create } from 'zustand';
import type { Playlist, Track } from '../types/spotify';
import { usePlayerStore } from '../store/usePlayerStore';
import { buildDynamicShelves, useSpotifyDataStore, type DynamicShelf } from '../store/useSpotifyDataStore';
import { useStatsStore } from '../store/useStatsStore';
import { getRecentSearches } from '../utils/recentSearches';

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
const DAY = 24 * 3600 * 1000;
const norm = (s = '') =>
  String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s*[([].*?[)\]]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
const trackKey = (title: string, artist: string) => `${norm(title)}|${norm(artist)}`;

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function rng(seed: number) {
  let s = seed || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const today = () => new Date().toISOString().slice(0, 10);
function isoWeek(d = new Date()): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return `${t.getUTCFullYear()}-W${Math.ceil(((t.getTime() - y.getTime()) / DAY + 1) / 7)}`;
}
const firstArtist = (t: any): string => String(t?.artists?.[0]?.name || '').split(/\s*[,&]\s*/)[0];
const coverOf = (t: any): string => t?.album?.images?.[0]?.url || '';
const asTrack = (x: any): Track | null => {
  const t = x?.track && x.track.name ? x.track : x;
  return t?.id && t?.name && t?.artists?.length ? (t as Track) : null;
};

// ---------------------------------------------------------------------------
// Tiny IndexedDB key-value store (generated playlists + covers are too big for localStorage)
// ---------------------------------------------------------------------------
let dbP: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  if (!dbP) {
    dbP = new Promise((resolve, reject) => {
      const r = indexedDB.open('spotifree-mixes', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => {
        dbP = null;
        reject(r.error);
      };
    });
  }
  return dbP;
}
async function kvGet<T>(key: string): Promise<T | undefined> {
  try {
    const d = await db();
    return await new Promise((resolve) => {
      const q = d.transaction('kv').objectStore('kv').get(key);
      q.onsuccess = () => resolve(q.result as T);
      q.onerror = () => resolve(undefined);
    });
  } catch {
    return undefined;
  }
}
async function kvSet(key: string, value: unknown): Promise<void> {
  try {
    const d = await db();
    await new Promise<void>((resolve) => {
      const tx = d.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {}
}

// ---------------------------------------------------------------------------
// 1. Signals (per account)
// ---------------------------------------------------------------------------
type SignalKind = 'play' | 'skip' | 'like' | 'unlike' | 'search' | 'spotify';
interface Signal {
  k: SignalKind;
  t: string; // title ('' for artist-only signals)
  a: string; // artist
  id?: string;
  img?: string;
  ts: number;
}

const WEIGHT: Record<SignalKind, number> = { play: 1, skip: -0.6, like: 4, unlike: -4, search: 1.5, spotify: 0.8 };
const HALF_LIFE_DAYS: Record<SignalKind, number> = { play: 60, skip: 30, like: 240, unlike: 120, search: 30, spotify: 90 };
const MAX_SIGNALS = 4000;

const uid = () => useSpotifyDataStore.getState().user?.id || 'local';
const signalsKey = () => `spotifree_taste_${uid()}`;
const firstSeenKey = () => `spotifree_taste_since_${uid()}`;

function readSignals(): Signal[] {
  try {
    return JSON.parse(localStorage.getItem(signalsKey()) || '[]');
  } catch {
    return [];
  }
}
function writeSignals(list: Signal[]) {
  try {
    localStorage.setItem(signalsKey(), JSON.stringify(list.slice(-MAX_SIGNALS)));
  } catch {
    try {
      localStorage.setItem(signalsKey(), JSON.stringify(list.slice(-1500)));
    } catch {}
  }
}
function logSignal(s: Omit<Signal, 'ts'> & { ts?: number }) {
  if (!s.a) return;
  const list = readSignals();
  list.push({ ...s, ts: s.ts || Date.now() });
  writeSignals(list);
  newSignals++;
}
function firstSeen(): number {
  try {
    const v = Number(localStorage.getItem(firstSeenKey()));
    if (v > 0) return v;
    localStorage.setItem(firstSeenKey(), String(Date.now()));
  } catch {}
  return Date.now();
}

let hooksInstalled = false;
let newSignals = 0; // activity since the last build
function installSignalHooks() {
  if (hooksInstalled || typeof window === 'undefined') return;
  hooksInstalled = true;

  // Plays (30 s or more) and skips
  let curId: string | null = null;
  let curLogged = false;
  let curTrack: Track | null = null;
  let lastProgress = 0;
  usePlayerStore.subscribe((s) => {
    const t = s.currentTrack;
    if (t?.id !== curId) {
      if (curTrack && !curLogged && lastProgress > 0 && lastProgress < 15000) {
        logSignal({ k: 'skip', t: curTrack.name, a: firstArtist(curTrack), id: curTrack.id });
      }
      curId = t?.id || null;
      curTrack = t || null;
      curLogged = false;
      lastProgress = 0;
      return;
    }
    lastProgress = s.progressMs || 0;
    if (t && !curLogged && lastProgress >= 30000) {
      curLogged = true;
      logSignal({ k: 'play', t: t.name, a: firstArtist(t), id: t.id, img: coverOf(t) });
    }
  });

  // Likes / unlikes
  let liked = new Set(usePlayerStore.getState().likedTrackIds || []);
  usePlayerStore.subscribe((s) => {
    const now = new Set(s.likedTrackIds || []);
    if (now.size === liked.size && [...now].every((x) => liked.has(x))) return;
    const added = [...now].filter((x) => !liked.has(x));
    const removed = [...liked].filter((x) => !now.has(x));
    liked = now;
    const find = (id: string): Track | null => {
      const cur = s.currentTrack;
      if (cur && (cur.id === id || cur.id.endsWith(id))) return cur;
      for (const p of useSpotifyDataStore.getState().playlists || []) {
        for (const x of p.tracks?.items || []) {
          const tr = asTrack(x);
          if (tr && tr.id === id) return tr;
        }
      }
      return null;
    };
    const seen = new Set<string>();
    for (const id of added) {
      const tr = find(id);
      if (tr && !seen.has(tr.name)) {
        seen.add(tr.name);
        logSignal({ k: 'like', t: tr.name, a: firstArtist(tr), id: tr.id, img: coverOf(tr) });
      }
    }
    for (const id of removed) {
      const tr = find(id);
      if (tr && !seen.has(tr.name)) {
        seen.add(tr.name);
        logSignal({ k: 'unlike', t: tr.name, a: firstArtist(tr), id: tr.id });
      }
    }
  });

  // Searches (artists and songs the user looked for)
  let lastSearchTs = Math.max(0, ...getRecentSearches().map((x) => x.timestamp || 0));
  window.addEventListener('spotifree_recent_searches_updated', () => {
    for (const it of getRecentSearches()) {
      if ((it.timestamp || 0) <= lastSearchTs) continue;
      if (it.type === 'artist') logSignal({ k: 'search', t: '', a: it.title, img: it.image, ts: it.timestamp });
      else if (it.type === 'track') {
        const artist = String(it.subtitle || '').replace(/^Canción\s*•\s*/i, '').split(',')[0];
        logSignal({ k: 'search', t: it.title, a: artist, img: it.image, ts: it.timestamp });
      }
    }
    lastSearchTs = Math.max(lastSearchTs, ...getRecentSearches().map((x) => x.timestamp || 0));
  });
}

/** Spotify's recent plays are copied into our own history (with their real dates) */
function importSpotifyRecent() {
  const recent = useSpotifyDataStore.getState().recentlyPlayed || [];
  if (!recent.length) return;
  const list = readSignals();
  const have = new Set(list.filter((s) => s.k === 'spotify').map((s) => `${s.id}|${s.ts}`));
  let added = 0;
  for (const r of recent) {
    const tr = asTrack(r);
    if (!tr) continue;
    const ts = Date.parse(r?.played_at || '') || 0;
    if (!ts) continue;
    const key = `${tr.id}|${ts}`;
    if (have.has(key)) continue;
    have.add(key);
    list.push({ k: 'spotify', t: tr.name, a: firstArtist(tr), id: tr.id, img: coverOf(tr), ts });
    added++;
  }
  if (added) {
    writeSignals(list.sort((a, b) => a.ts - b.ts));
    newSignals += added;
  }
}

// ---------------------------------------------------------------------------
// 2. Taste profile
// ---------------------------------------------------------------------------
interface ArtistTaste {
  name: string;
  score: number;
  recent: number; // last 30 days only
  img?: string;
}
interface TrackTaste {
  track: Track;
  score: number;
  recent: number;
  last: number;
}
export interface TasteProfile {
  artists: ArtistTaste[];
  tracks: TrackTaste[];
  known: Set<string>; // trackKey of everything the user already has
  knownArtists: Set<string>;
}

function makeTrack(id: string | undefined, title: string, artist: string, img?: string): Track {
  return {
    id: id || `sf-${hash(trackKey(title, artist)).toString(36)}`,
    name: title,
    artists: [{ id: `art-${norm(artist).replace(/\s+/g, '-')}`, name: artist }],
    album: { id: '', name: '', images: img ? [{ url: img }] : [] },
    duration_ms: 200000,
  } as Track;
}

export function buildTasteProfile(): TasteProfile {
  const now = Date.now();
  const artists = new Map<string, ArtistTaste>();
  const tracks = new Map<string, TrackTaste>();
  const known = new Set<string>();
  const knownArtists = new Set<string>();

  const addArtist = (name: string, w: number, recentW: number, img?: string) => {
    const k = norm(name);
    if (!k) return;
    const a = artists.get(k) || { name, score: 0, recent: 0 };
    a.score += w;
    a.recent += recentW;
    if (img && !a.img) a.img = img;
    artists.set(k, a);
    if (w > 0) knownArtists.add(k);
  };
  const addTrack = (tr: Track, w: number, recentW: number, ts: number) => {
    const k = trackKey(tr.name, firstArtist(tr));
    if (!k || k === '|') return;
    known.add(k);
    const x = tracks.get(k) || { track: tr, score: 0, recent: 0, last: 0 };
    x.score += w;
    x.recent += recentW;
    x.last = Math.max(x.last, ts);
    if (!coverOf(x.track) && coverOf(tr)) x.track = tr;
    tracks.set(k, x);
  };

  // Spotify's starting data fades over ~6 months since this account started using Spotifree
  const baseline = Math.pow(0.5, (now - firstSeen()) / (180 * DAY));
  const st = useSpotifyDataStore.getState();
  (st.topArtists || []).forEach((a: any, i: number) => addArtist(a?.name, (3 - Math.min(2, i / 10)) * baseline, 0, a?.images?.[0]?.url));
  (st.topTracks || []).forEach((t: any, i: number) => {
    const tr = asTrack(t);
    if (!tr) return;
    const w = (2 - Math.min(1.5, i / 20)) * baseline;
    addTrack(tr, w, 0, 0);
    addArtist(firstArtist(tr), w * 0.6, 0);
  });
  for (const p of st.playlists || []) {
    const isLiked = p.id === 'liked-songs';
    const items = (p.tracks?.items || []).slice(0, isLiked ? 400 : 120);
    for (const x of items) {
      const tr = asTrack(x);
      if (!tr) continue;
      const w = (isLiked ? 1.5 : 0.35) * baseline;
      addTrack(tr, w, 0, 0);
      addArtist(firstArtist(tr), w * 0.5, 0);
    }
  }
  // Our own play statistics (no dates): moderate weight
  // (only this account's: another account's statistics must never mix in)
  const stats = useStatsStore.getState();
  if ((stats.currentUserId || 'local') === uid()) {
    for (const a of Object.values(stats.artists || {})) addArtist(a.name, Math.min(6, Math.log2(1 + a.plays)) * 0.6, 0, a.image);
  }

  // Everything that happened in Spotifree (and Spotify's recent plays), fading with age
  for (const s of readSignals()) {
    const ageDays = (now - s.ts) / DAY;
    const w = WEIGHT[s.k] * Math.pow(0.5, ageDays / HALF_LIFE_DAYS[s.k]);
    const recentW = ageDays <= 30 ? WEIGHT[s.k] : 0;
    addArtist(s.a, w * (s.t ? 0.7 : 1), recentW * 0.7, undefined);
    if (s.t) addTrack(makeTrack(s.id, s.t, s.a, s.img), w, recentW, s.ts);
  }

  return {
    artists: [...artists.values()].filter((a) => a.score > 0.2).sort((a, b) => b.score - a.score),
    tracks: [...tracks.values()].filter((t) => t.score > 0).sort((a, b) => b.score - a.score),
    known,
    knownArtists,
  };
}

// ---------------------------------------------------------------------------
// 3. New music (server: /api/discover), cached 3 days per artist
// ---------------------------------------------------------------------------
interface Discover {
  artist: { name: string; picture: string | null } | null;
  top: Track[];
  related: Array<{ name: string; picture: string | null; top: Track[] }>;
  recent: Array<{ title: string; date: string; cover: string | null; tracks: Track[] }>;
}
async function discover(artist: string): Promise<Discover | null> {
  const key = `discover:${norm(artist)}`;
  const cached = await kvGet<{ t: number; v: Discover }>(key);
  if (cached && Date.now() - cached.t < 3 * DAY) return cached.v;
  try {
    const r = await fetch(`/api/discover?artist=${encodeURIComponent(artist)}`);
    if (!r.ok) return cached?.v || null;
    const v = (await r.json()) as Discover & { error?: string };
    if (!v.error && v.artist) await kvSet(key, { t: Date.now(), v });
    return v.artist ? v : cached?.v || null;
  } catch {
    return cached?.v || null;
  }
}

// ---------------------------------------------------------------------------
// 4. Covers (drawn on the device; vary each time)
// ---------------------------------------------------------------------------
function loadImg(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!url) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
    setTimeout(() => resolve(null), 6000);
  });
}
function avgColor(img: HTMLImageElement): string {
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 12;
    const x = c.getContext('2d')!;
    x.drawImage(img, 0, 0, 12, 12);
    const d = x.getImageData(0, 0, 12, 12).data;
    let r = 0, g = 0, b = 0;
    for (let i = 0; i < d.length; i += 4) {
      r += d[i];
      g += d[i + 1];
      b += d[i + 2];
    }
    const n = d.length / 4;
    // Darkened, slightly saturated: white text always readable
    const k = 0.62;
    return `rgb(${Math.round((r / n) * k)},${Math.round((g / n) * k)},${Math.round((b / n) * k)})`;
  } catch {
    return '#1e3264';
  }
}
function drawCover(img: HTMLImageElement, ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const s = Math.min(img.naturalWidth, img.naturalHeight);
  ctx.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, x, y, w, h);
}
function wrapTitle(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines.slice(0, 2);
}

let appIcon: Promise<HTMLImageElement | null> | null = null;
type CoverStyle = 'artist' | 'collage' | 'single';
async function makeCover(title: string, style: CoverStyle, images: string[], accent?: string): Promise<string | null> {
  try {
    const S = 320;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    const loaded = (await Promise.all(images.filter(Boolean).slice(0, style === 'collage' ? 4 : 1).map(loadImg))).filter(Boolean) as HTMLImageElement[];
    let band = accent || (loaded[0] ? avgColor(loaded[0]) : '#1e3264');
    if (!loaded.length) {
      // No usable photo: a colour gradient with the title (never an empty cover)
      const hue = hash(title) % 360;
      const g = ctx.createLinearGradient(0, 0, S, S);
      g.addColorStop(0, accent || `hsl(${hue}, 62%, 42%)`);
      g.addColorStop(1, `hsl(${(hue + 40) % 360}, 58%, 18%)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, S, S);
      style = 'single';
    } else if (style === 'collage' && loaded.length >= 4) {
      loaded.forEach((im, i) => drawCover(im, ctx, (i % 2) * (S / 2), Math.floor(i / 2) * (S / 2), S / 2, S / 2));
      band = accent || avgColor(loaded[0]);
    } else {
      drawCover(loaded[0], ctx, 0, 0, S, S);
    }
    ctx.font = '900 30px "SpotifyMixUITitle", "Montserrat", system-ui, sans-serif';
    const lines = wrapTitle(ctx, title, S - 44);
    if (style === 'artist') {
      // Spotify "Daily Mix" look: colour band at the bottom with the title
      const bh = 34 + lines.length * 32;
      ctx.fillStyle = band;
      ctx.fillRect(0, S - bh, S, bh);
    } else {
      const g = ctx.createLinearGradient(0, S * 0.35, 0, S);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.78)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, S, S);
    }
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = style === 'artist' ? 0 : 8;
    lines.forEach((l, i) => ctx.fillText(l, 22, S - 22 - (lines.length - 1 - i) * 32));
    ctx.shadowBlur = 0;
    // The app's own icon in the corner (same-origin file, the official app icon)
    appIcon = appIcon || loadImg('/icon-192.png');
    const icon = await appIcon;
    if (icon) ctx.drawImage(icon, 14, 14, 30, 30);
    return c.toDataURL('image/jpeg', 0.8);
  } catch {
    return null; // a cross-origin image without CORS: the plain image is used instead
  }
}

// ---------------------------------------------------------------------------
// 5. Building the playlists
// ---------------------------------------------------------------------------
export interface SpotifreeMix extends Playlist {
  sfKind: 'daily' | 'discover' | 'radar' | 'repeat' | 'classics' | 'artist';
}

function dedupe(list: Track[], known?: Set<string>, perArtist = 99): Track[] {
  const seen = new Set<string>();
  const perA = new Map<string, number>();
  const out: Track[] = [];
  for (const t of list) {
    const k = trackKey(t.name, firstArtist(t));
    if (seen.has(k) || (known && known.has(k))) continue;
    const a = norm(firstArtist(t));
    const n = perA.get(a) || 0;
    if (n >= perArtist) continue;
    seen.add(k);
    perA.set(a, n + 1);
    out.push(t);
  }
  return out;
}

function mix(id: string, kind: SpotifreeMix['sfKind'], name: string, description: string, items: Track[], cover: string, userName: string): SpotifreeMix {
  return {
    id,
    sfKind: kind,
    name,
    description,
    type: 'playlist',
    images: cover ? [{ url: cover }] : [],
    owner: { display_name: 'Spotifree', id: 'spotifree' },
    tracks: { total: items.length, items },
    madeFor: userName,
  } as any;
}

async function buildMixes(): Promise<SpotifreeMix[]> {
  importSpotifyRecent();
  const profile = buildTasteProfile();
  if (profile.artists.length === 0) return [];
  const day = today();
  const week = isoWeek();
  const userName = useSpotifyDataStore.getState().user?.display_name || '';
  const randDay = rng(hash(`${uid()}:${day}`));

  // Names already on Home / in the library (Spotify's own "Mix diario 1-6", "Descubrimiento
  // semanal", "Mix de X"…): ours never take the same name, so nothing looks repeated
  const store = useSpotifyDataStore.getState();
  const homeShelves =
    store.dynamicShelves && store.dynamicShelves.length
      ? store.dynamicShelves
      : buildDynamicShelves(store.user, store.playlists, store.featuredMessage);
  const taken = new Set<string>([
    ...homeShelves.flatMap((s) => s.cards.map((c) => norm(c.title))),
    ...(store.playlists || []).map((p) => norm(p.name)),
  ]);
  let dailyNumber = Math.max(0, ...[...taken].map((t) => Number(t.match(/^mix diario (\d+)$/)?.[1] || 0)));
  const nameFor = (preferred: string, alternative: string) => (taken.has(norm(preferred)) ? alternative : preferred);

  // New music around the user's top artists (recent taste counts more)
  const ranked = [...profile.artists].sort((a, b) => b.score + b.recent * 2 - (a.score + a.recent * 2));
  const seeds = ranked.slice(0, 10);
  const disc = new Map<string, Discover>();
  for (let i = 0; i < seeds.length; i += 3) {
    const chunk = seeds.slice(i, i + 3);
    const res = await Promise.all(chunk.map((a) => discover(a.name)));
    res.forEach((d, j) => d && disc.set(norm(chunk[j].name), d));
  }
  const pictureOf = (name: string) => disc.get(norm(name))?.artist?.picture || profile.artists.find((a) => norm(a.name) === norm(name))?.img || '';
  const ownByArtist = (name: string) => profile.tracks.filter((t) => norm(firstArtist(t.track)) === norm(name)).map((t) => t.track);

  // Mix diario: group artists that go together (an artist joins a group whose seed lists it as similar)
  const groups: string[][] = [];
  for (const a of seeds) {
    const g = groups.find((grp) => {
      const rel = disc.get(norm(grp[0]))?.related || [];
      return rel.some((r) => norm(r.name) === norm(a.name)) && grp.length < 3;
    });
    if (g) g.push(a.name);
    else if (groups.length < 6) groups.push([a.name]);
  }
  const out: SpotifreeMix[] = [];
  const styles: CoverStyle[] = ['artist', 'collage', 'single'];
  const pickStyle = (salt: string): CoverStyle => styles[hash(`${salt}:${day}`) % styles.length];

  for (let i = 0; i < groups.length; i++) {
    const grp = groups[i];
    const r = rng(hash(`${uid()}:${day}:daily:${i}`));
    const own = shuffle(grp.flatMap(ownByArtist), r).slice(0, 22);
    const theirs = shuffle(grp.flatMap((n) => disc.get(norm(n))?.top || []), r).slice(0, 12);
    const near = shuffle(grp.flatMap((n) => (disc.get(norm(n))?.related || []).flatMap((x) => x.top.slice(0, 3))), r).slice(0, 16);
    const items = shuffle(dedupe([...own, ...theirs, ...near], undefined, 6), r).slice(0, 50);
    if (items.length < 8) continue;
    const relNames = [...new Set(near.map((t) => firstArtist(t)))].slice(0, 2);
    const desc = `${[...grp, ...relNames].slice(0, 3).join(', ')} y más`;
    const style = pickStyle(`daily${i}`);
    const imgs = style === 'artist' ? [pictureOf(shuffle(grp, r)[0])] : shuffle(items.map(coverOf).filter(Boolean), r);
    // Numbered after Spotify's own daily mixes (if the user has 1-6, ours are 7, 8…)
    dailyNumber += 1;
    const title = `Mix diario ${dailyNumber}`;
    const cover = (await makeCover(title, style, imgs)) || imgs[0] || '';
    out.push(mix(`sf-daily-${out.filter((m) => m.sfKind === 'daily').length + 1}`, 'daily', title, desc, items, cover, userName));
  }

  // Descubrimiento semanal: artists the user doesn't listen to yet (changes every Monday)
  {
    const r = rng(hash(`${uid()}:${week}:discover`));
    const pool = seeds.flatMap((s) => disc.get(norm(s.name))?.related || []).filter((x) => !profile.knownArtists.has(norm(x.name)));
    const freq = new Map<string, number>();
    pool.forEach((x) => freq.set(norm(x.name), (freq.get(norm(x.name)) || 0) + 1));
    const tracks = shuffle(pool, r)
      .sort((a, b) => (freq.get(norm(b.name)) || 0) - (freq.get(norm(a.name)) || 0))
      .flatMap((x) => shuffle(x.top, r).slice(0, 2));
    const items = dedupe(tracks, profile.known, 2).slice(0, 30);
    if (items.length >= 10) {
      const imgs = shuffle(items.map(coverOf).filter(Boolean), r);
      const name = nameFor('Descubrimiento semanal', 'Tu descubrimiento semanal');
      const cover = (await makeCover(name, hash(week) % 2 ? 'collage' : 'single', imgs, '#3d2b66')) || imgs[0] || '';
      out.push(mix('sf-discover-weekly', 'discover', name, 'Música nueva elegida para ti. Cambia cada lunes.', items, cover, userName));
    }
  }

  // Radar de novedades: releases of the last weeks from the user's artists
  {
    const fresh = seeds.flatMap((s) => (disc.get(norm(s.name))?.recent || []).flatMap((a) => a.tracks.slice(0, 4)));
    const items = dedupe(fresh, undefined, 5).slice(0, 30);
    if (items.length >= 5) {
      const imgs = shuffle(items.map(coverOf).filter(Boolean), randDay);
      const name = nameFor('Radar de novedades', 'Tu radar de novedades');
      const cover = (await makeCover(name, 'collage', imgs, '#7a2d3a')) || imgs[0] || '';
      out.push(mix('sf-release-radar', 'radar', name, 'Lo último de los artistas que escuchas.', items, cover, userName));
    }
  }

  // En repeat: what the user plays most these weeks
  {
    const items = profile.tracks.filter((t) => t.recent > 0).sort((a, b) => b.recent - a.recent).map((t) => t.track).slice(0, 30);
    if (items.length >= 8) {
      const imgs = items.map(coverOf).filter(Boolean);
      const name = nameFor('En repeat', 'Lo que más escuchas');
      const cover = (await makeCover(name, pickStyle('repeat'), pickStyle('repeat') === 'artist' ? [pictureOf(firstArtist(items[0]))] : imgs, '#1f5f4a')) || imgs[0] || '';
      out.push(mix('sf-on-repeat', 'repeat', name, 'Las canciones que más te gustan ahora mismo.', items, cover, userName));
    }
  }

  // Tus clásicos: long-time favourites not played lately
  {
    const cutoff = Date.now() - 45 * DAY;
    const items = shuffle(
      profile.tracks.filter((t) => t.score > 1.2 && t.last < cutoff).slice(0, 80).map((t) => t.track),
      randDay
    ).slice(0, 30);
    if (items.length >= 10) {
      const imgs = shuffle(items.map(coverOf).filter(Boolean), randDay);
      const name = nameFor('Tus clásicos', 'Tus clásicos de siempre');
      const cover = (await makeCover(name, 'collage', imgs, '#5a4a1c')) || imgs[0] || '';
      out.push(mix('sf-classics', 'classics', name, 'Canciones que siempre vuelven. Hace tiempo que no suenan.', items, cover, userName));
    }
  }

  // Mix de <artista> for the favourite artists
  for (const a of ranked.slice(0, 6)) {
    const d = disc.get(norm(a.name));
    if (!d) continue;
    const r = rng(hash(`${uid()}:${day}:artist:${a.name}`));
    const items = shuffle(dedupe([...d.top.slice(0, 12), ...ownByArtist(a.name).slice(0, 8), ...d.related.flatMap((x) => x.top.slice(0, 2))], undefined, 12), r).slice(0, 35);
    if (items.length < 10) continue;
    const title = `Mix de ${d.artist?.name || a.name}`;
    // Spotify already gives this user a "Mix de X": that one stays, ours would only repeat it
    if (taken.has(norm(title))) continue;
    const style: CoverStyle = hash(`${a.name}:${day}`) % 3 === 0 ? 'collage' : 'artist';
    const imgs = style === 'artist' ? [pictureOf(a.name)] : shuffle(items.map(coverOf).filter(Boolean), r);
    const cover = (await makeCover(title, style, imgs)) || imgs[0] || '';
    out.push(mix(`sf-artist-${norm(a.name).replace(/\s+/g, '-')}`, 'artist', title, `${d.artist?.name || a.name} y artistas parecidos`, items, cover, userName));
  }
  return out;
}

// ---------------------------------------------------------------------------
// 6. Store, Home shelves and refresh
// ---------------------------------------------------------------------------
interface MixesState {
  mixes: SpotifreeMix[];
  builtDay: string | null;
  building: boolean;
}
export const useSpotifreeMixes = create<MixesState>(() => ({ mixes: [], builtDay: null, building: false }));

function publish(mixes: SpotifreeMix[], builtDay: string | null) {
  useSpotifreeMixes.setState({ mixes, builtDay });
  // So the playlist pages open them like any other playlist
  useSpotifyDataStore.setState((s) => ({
    playlistDetailsCache: { ...s.playlistDetailsCache, ...Object.fromEntries(mixes.map((m) => [m.id, m])) },
  }));
}

// v2: mixes built before names were kept apart from Spotify's own are rebuilt
const storeKey = () => `mixes2:${uid()}`;
let building: Promise<void> | null = null;

/** Rebuilds the account's playlists (once a day, or when asked) */
export function refreshSpotifreeMixes(force = false): Promise<void> {
  if (building) return building;
  building = (async () => {
    try {
      const saved = await kvGet<{ day: string; week: string; mixes: SpotifreeMix[] }>(storeKey());
      if (saved?.mixes?.length) publish(saved.mixes, saved.day);
      // Like Spotify they stay the same during the day, unless there was a lot of new listening
      if (!force && saved?.day === today() && newSignals < 40) return;
      useSpotifreeMixes.setState({ building: true });
      const mixes = await buildMixes();
      if (mixes.length) {
        publish(mixes, today());
        await kvSet(storeKey(), { day: today(), week: isoWeek(), mixes });
      }
      newSignals = 0;
    } catch (e) {
      console.warn('[SpotifreeMixes] build failed', e);
    } finally {
      useSpotifreeMixes.setState({ building: false });
      building = null;
    }
  })();
  return building;
}

let started = false;
/** Starts listening to the account's activity and builds / loads its playlists */
export function initSpotifreeMixes() {
  if (started || typeof window === 'undefined') return;
  started = true;
  // For checking from the console: window.__spotifreeMixes.refresh(true)
  (window as any).__spotifreeMixes = { refresh: refreshSpotifreeMixes, store: useSpotifreeMixes, profile: buildTasteProfile };
  installSignalHooks();
  firstSeen();
  // First build a few seconds after start (Spotify data arrives first)
  setTimeout(() => void refreshSpotifreeMixes(), 6000);
  // Another account signs in: its own playlists
  let lastUser = uid();
  useSpotifyDataStore.subscribe((s) => {
    const u = s.user?.id || 'local';
    if (u !== lastUser) {
      lastUser = u;
      useSpotifreeMixes.setState({ mixes: [], builtDay: null });
      firstSeen();
      setTimeout(() => void refreshSpotifreeMixes(), 3000);
    }
  });
  // New day while the app stays open
  setInterval(() => {
    if (useSpotifreeMixes.getState().builtDay !== today()) void refreshSpotifreeMixes();
  }, 30 * 60 * 1000);
}

const cardOf = (m: SpotifreeMix) => ({ id: m.id, title: m.name, subtitle: m.description, image: m.images?.[0]?.url || '' });

/**
 * No playlist twice on Home: the first section that shows it keeps it, later sections drop it
 * (a section left empty disappears; one left with 1-2 cards is shown as featured cards).
 */
export function dedupeHomeShelves(shelves: DynamicShelf[]): DynamicShelf[] {
  // Two sections with the same name are one section
  const merged: DynamicShelf[] = [];
  const byTitle = new Map<string, number>();
  for (const s of shelves) {
    const key = norm(`${s.prefix || ''} ${s.title}`);
    const at = key ? byTitle.get(key) : undefined;
    if (at !== undefined) merged[at] = { ...merged[at], cards: [...merged[at].cards, ...s.cards] };
    else {
      if (key) byTitle.set(key, merged.length);
      merged.push(s);
    }
  }
  // The same playlist (same id, same picture or same name) only the first time it appears
  const seenIds = new Set<string>();
  const seenImages = new Set<string>();
  const seenTitles = new Set<string>();
  const out: DynamicShelf[] = [];
  for (const s of merged) {
    const cards = s.cards.filter((c) => {
      const img = (c.image || '').split('?')[0];
      const title = norm(c.title);
      if (seenIds.has(c.id) || (img && seenImages.has(img)) || (title && seenTitles.has(title))) return false;
      seenIds.add(c.id);
      if (img) seenImages.add(img);
      if (title) seenTitles.add(title);
      return true;
    });
    if (cards.length) out.push(cards.length === s.cards.length ? s : { ...s, cards });
  }
  return out;
}

/**
 * Home with Spotifree's playlists, each shown ONCE:
 *  - the daily mixes, Descubrimiento, Radar… go into Spotify's own "Hecho para" section when
 *    there is one (extending it), otherwise into our own "Hecho para <name>" near the top
 *  - "Tus artistas, en mix" as its own section
 *  - then no card may repeat anywhere on Home (they used to be added to every mixes section)
 */
export function withSpotifreeShelves(base: DynamicShelf[], mixes: SpotifreeMix[], userName?: string): DynamicShelf[] {
  if (!mixes.length) return dedupeHomeShelves(base);
  const made = mixes.filter((m) => m.sfKind !== 'artist').map(cardOf);
  const artists = mixes.filter((m) => m.sfKind === 'artist').map(cardOf);
  const name = (userName || '').split(' ')[0];

  // Extend Spotify's first "Hecho para / Made for" section, only that one
  const madeForIdx = base.findIndex((s) => s.type === 'made_for' || /hecho para|made for/i.test(`${s.prefix || ''} ${s.title}`));
  let shelves = base.slice();
  const ours: DynamicShelf[] = [];
  if (made.length) {
    if (madeForIdx >= 0) {
      const s = shelves[madeForIdx];
      shelves[madeForIdx] = { ...s, cards: [...made, ...s.cards], hasSeeAll: true };
    } else {
      ours.push({ id: 'sf-made-for', title: name ? `Hecho para ${name}` : 'Hecho para ti', subtitle: 'Por Spotifree, con lo que escuchas', type: 'made_for', cards: made, hasSeeAll: true });
    }
  }
  if (artists.length) {
    ours.push({ id: 'sf-artist-mixes', title: 'Tus artistas, en mix', type: 'mixes', cards: artists, hasSeeAll: true });
  }
  shelves = [...shelves.slice(0, 1), ...ours, ...shelves.slice(1)];
  return dedupeHomeShelves(shelves);
}
