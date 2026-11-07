/**
 * DJ set built in blocks, like Spotify's DJ: every few songs the DJ comes back and tells you
 * what is coming and why ("lo que más te suena", "hace tiempo que no la escuchas",
 * "más de {artista}", "descubrimientos"). Blocks come from the user's real data: plays and
 * last-played time (stats), liked songs, playlists and recent history.
 */
import type { Track } from '../types/spotify';
import { useSpotifyDataStore } from '../store/useSpotifyDataStore';
import { usePlayerStore } from '../store/usePlayerStore';
import { useStatsStore } from '../store/useStatsStore';
import { getCustomLikedSongs } from '../utils/userStorage';
import { filterMusicTracksOnly, isNonMusicOrNoise } from '../utils/trackFilter';
import { searchSpotify } from './spotifyApi';
import { useLanguageStore } from '../utils/i18n';

export type DJSegmentKind = 'heavy-rotation' | 'throwback' | 'artist-focus' | 'discovery' | 'liked' | 'request';

export interface DJSegment {
  id: string;
  kind: DJSegmentKind;
  /** Short label shown in the DJ view ("Lo que más te suena") */
  title: string;
  /** Why these songs, used to write the DJ line */
  reason: string;
  /** Index of the first song of the block inside the DJ queue */
  startIndex: number;
  length: number;
  /** What the DJ says when the block starts (local line; may be replaced by the AI's) */
  intro: string;
  focusArtist?: string;
}

export interface DJSegmentedSet {
  tracks: Track[];
  segments: DJSegment[];
}

interface LibraryEntry {
  track: Track;
  liked: boolean;
  plays: number;
  lastPlayedAt: number;
  recentRank: number; // position in recent history (0 = just played), Infinity if not there
}

const DAY = 24 * 60 * 60 * 1000;
const cleanId = (id?: string) => (id || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
const sigOf = (t: Track) => `${(t.name || '').toLowerCase().trim()}::${(t.artists?.[0]?.name || '').toLowerCase().trim()}`;
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/** Every song the user has (liked, playlists, history) with how much and how recently they played it. */
export function collectUserLibrary(): LibraryEntry[] {
  const { playlists, playlistDetailsCache } = useSpotifyDataStore.getState();
  const history = usePlayerStore.getState().history || [];
  const statsTracks = useStatsStore.getState().tracks || {};
  const likedIds = new Set((usePlayerStore.getState().likedTrackIds || []).map(cleanId));

  const bySig = new Map<string, LibraryEntry>();
  const add = (t: Track | null | undefined, liked = false) => {
    if (!t || !t.id || !t.name || isNonMusicOrNoise(t)) return;
    const sig = sigOf(t);
    const existing = bySig.get(sig);
    if (existing) {
      if (liked) existing.liked = true;
      return;
    }
    const st = statsTracks[t.id] || statsTracks[cleanId(t.id)];
    bySig.set(sig, {
      track: t,
      liked: liked || likedIds.has(cleanId(t.id)),
      plays: st?.plays || 0,
      lastPlayedAt: st?.lastPlayedAt || 0,
      recentRank: Infinity,
    });
  };

  try {
    getCustomLikedSongs().forEach((t) => add(t, true));
  } catch {}
  const likedPl = playlists.find((p) => p.id === 'liked-songs');
  likedPl?.tracks?.items?.forEach((t) => add(t, true));
  history.forEach((t) => add(t));
  playlists.forEach((p) => {
    if (p.id === 'spotify-dj') return;
    p.tracks?.items?.forEach((t) => add(t));
  });
  Object.values(playlistDetailsCache || {}).forEach((p: any) => p?.tracks?.items?.forEach((t: Track) => add(t)));

  history.slice(0, 60).forEach((t, idx) => {
    const e = bySig.get(sigOf(t));
    if (e && e.recentRank === Infinity) e.recentRank = idx;
  });
  return Array.from(bySig.values());
}

function topArtistsOf(entries: LibraryEntry[], limit = 6): string[] {
  const statsArtists = useStatsStore.getState().getTopArtists(limit).map((a) => a.name).filter((n) => n && n !== 'Spotify');
  if (statsArtists.length >= 3) return statsArtists;
  const counts = new Map<string, number>();
  for (const e of entries) {
    const a = e.track.artists?.[0]?.name;
    if (!a || a === 'Spotify') continue;
    counts.set(a, (counts.get(a) || 0) + 1 + (e.liked ? 1 : 0) + Math.min(e.plays, 5));
  }
  const fromLib = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).map(([a]) => a);
  return Array.from(new Set([...statsArtists, ...fromLib])).slice(0, limit);
}

// ---------------------------------------------------------------------------
// Local DJ lines (used instantly; the AI may replace them when it answers in time)
// ---------------------------------------------------------------------------
function buildSegmentIntroEn(seg: Pick<DJSegment, 'kind' | 'focusArtist'>, song: string, artist: string, userName: string, isFirst: boolean): string {
  const hey = isFirst
    ? pick([`Hey${userName ? ` ${userName}` : ''}! Your DJ here.`, `What's up${userName ? ` ${userName}` : ''}! Your DJ is in the booth.`, `Hi${userName ? ` ${userName}` : ''}! Let's go.`]) + ' '
    : '';
  const s = song && artist ? `${song} by ${artist}` : song || artist;
  const focus = seg.focusArtist || artist;
  switch (seg.kind) {
    case 'heavy-rotation':
      return hey + pick([`Starting with what you've had on repeat lately. ${s}.`, `You've got this one on loop and I don't blame you. Here's ${s}.`, `${userName ? `${userName}, ` : ''}let's go with your current essentials. ${s}.`]);
    case 'throwback':
      return hey + pick([`Now a trip back in time. ${s}, you haven't played it in a while.`, `Remember this one? It's been ages. ${s}.`, `Digging up some gems you forgot about. Starting with ${s}.`]);
    case 'artist-focus':
      return hey + pick([`You've been really into ${focus} lately. Here's ${song || 'one of theirs'}.`, `A block dedicated to ${focus}. Kicking off with ${song || 'a banger'}.`, `A little more ${focus}, I know you love it. ${song}.`]);
    case 'discovery':
      return hey + pick([`Here's something new that fits you. Check out ${s}.`, `Time to discover. If you like what you hear, this will click. ${s}.`, `Something that's not in your library yet. ${s}. Give it a chance.`]);
    case 'liked':
      return hey + pick([`Pulling from your Liked Songs. ${s}.`, `Songs you saved for a reason. Starting with ${s}.`]);
    default:
      return hey + (s ? `Here's ${s}.` : "Let's go!");
  }
}

export const SEGMENT_TITLES_EN: Record<DJSegmentKind, string> = {
  'heavy-rotation': 'Your heavy rotation',
  throwback: 'Throwbacks',
  'artist-focus': 'More by',
  discovery: 'Discoveries for you',
  liked: 'From your Liked Songs',
  request: 'Your request',
};

export function buildSegmentIntro(seg: Pick<DJSegment, 'kind' | 'focusArtist'>, first: Track | undefined, userName: string, isFirst: boolean): string {
  const song = first?.name ? first.name.replace(/\s*[([].*?[)\]]\s*/g, ' ').replace(/\s+-\s+.*$/, '').trim() : '';
  const artist = first?.artists?.[0]?.name || '';
  if (useLanguageStore.getState().language === 'en') return buildSegmentIntroEn(seg, song, artist, userName, isFirst);
  const hi = userName ? `${userName}, ` : '';
  const hey = isFirst
    ? pick([`¡Hola${userName ? ` ${userName}` : ''}! Aquí tu DJ.`, `¡Muy buenas${userName ? ` ${userName}` : ''}! Tu DJ en cabina.`, `¡Hey${userName ? ` ${userName}` : ''}! Empezamos.`]) + ' '
    : '';
  const s = song && artist ? `${song} de ${artist}` : song || artist;
  switch (seg.kind) {
    case 'heavy-rotation':
      return hey + pick([
        `Empezamos con lo que más te suena estos días. ${s}.`,
        `Lo tienes en bucle y no te culpo. Suena ${s}.`,
        `${hi}vamos con tus imprescindibles del momento. ${s}.`,
      ]);
    case 'throwback':
      return hey + pick([
        `Ahora un viaje atrás. ${s}, que hace tiempo que no la pones.`,
        `¿Te acuerdas de esta? Hace mucho que no suena. ${s}.`,
        `Rescatamos joyas que tenías olvidadas. Empezamos con ${s}.`,
      ]);
    case 'artist-focus':
      return hey + pick([
        `Te noto muy de ${seg.focusArtist || artist} últimamente. Vamos con ${song || 'una suya'}.`,
        `Bloque dedicado a ${seg.focusArtist || artist}. Arrancamos con ${song || 'un temazo'}.`,
        `Un poco más de ${seg.focusArtist || artist}, que sé que te encanta. ${song}.`,
      ]);
    case 'discovery':
      return hey + pick([
        `Te traigo algo nuevo que encaja contigo. Escucha ${s}.`,
        `Hora de descubrir. Si te gusta lo que escuchas, esto te va a encajar. ${s}.`,
        `Algo que todavía no tienes en tu biblioteca. ${s}. Dale una oportunidad.`,
      ]);
    case 'liked':
      return hey + pick([
        `Tiramos de tus Me gusta. ${s}.`,
        `Canciones que guardaste por algo. Empezamos con ${s}.`,
      ]);
    default:
      return hey + (s ? `Vamos con ${s}.` : '¡Vamos!');
  }
}

const SEGMENT_TITLES: Record<DJSegmentKind, string> = {
  'heavy-rotation': 'Lo que más te suena',
  throwback: 'Hace tiempo que no suenan',
  'artist-focus': 'Más de',
  discovery: 'Descubrimientos para ti',
  liked: 'De tus Me gusta',
  request: 'Tu petición',
};

async function searchArtistTracks(artist: string, limit = 8): Promise<Track[]> {
  try {
    const res = await searchSpotify(`artist:"${artist}"`);
    const items: Track[] = res?.tracks?.items || [];
    return filterMusicTracksOnly(items).filter((t) => (t.artists || []).some((a) => (a.name || '').toLowerCase() === artist.toLowerCase())).slice(0, limit);
  } catch {
    return [];
  }
}

/**
 * Builds a fresh DJ set of `blockCount` blocks (~4 songs each). Different every time:
 * block order, picks and lines are randomised, and songs already used are skipped.
 */
export async function buildSegmentedDJSet(opts: { blockSize?: number; exclude?: Set<string>; userName?: string } = {}): Promise<DJSegmentedSet> {
  const blockSize = opts.blockSize || 4;
  const exclude = opts.exclude || new Set<string>();
  const library = collectUserLibrary().filter((e) => !exclude.has(e.track.id) && !exclude.has(sigOf(e.track)));
  const used = new Set<string>();
  const take = (entries: LibraryEntry[], n: number): Track[] => {
    const out: Track[] = [];
    for (const e of entries) {
      if (out.length >= n) break;
      const sig = sigOf(e.track);
      if (used.has(sig)) continue;
      used.add(sig);
      out.push(e.track);
    }
    return out;
  };
  const takeTracks = (tracks: Track[], n: number): Track[] =>
    take(tracks.map((t) => ({ track: t, liked: false, plays: 0, lastPlayedAt: 0, recentRank: Infinity })), n);

  const now = Date.now();
  const artists = topArtistsOf(library);
  const blocks: Array<{ kind: DJSegmentKind; tracks: Track[]; reason: string; focusArtist?: string }> = [];

  // 1. Heavy rotation: most played, then liked + recently played
  const heavy = [...library]
    .filter((e) => e.plays > 0 || e.recentRank < 25)
    .sort((a, b) => b.plays * 3 + (b.recentRank < 25 ? 25 - b.recentRank : 0) - (a.plays * 3 + (a.recentRank < 25 ? 25 - a.recentRank : 0)));
  const heavyTracks = take(shuffle(heavy.slice(0, blockSize * 3)), blockSize);
  if (heavyTracks.length >= 2) blocks.push({ kind: 'heavy-rotation', tracks: heavyTracks, reason: 'las canciones que más reproduce últimamente' });

  // 2. Throwbacks: in the library but not played for 2+ weeks (or never in this app)
  const throwback = library.filter((e) => e.recentRank === Infinity && (e.lastPlayedAt === 0 || now - e.lastPlayedAt > 14 * DAY));
  const throwbackTracks = take(shuffle(throwback.filter((e) => e.liked || e.plays > 0).concat(shuffle(throwback))), blockSize);
  if (throwbackTracks.length >= 2) blocks.push({ kind: 'throwback', tracks: throwbackTracks, reason: 'canciones de su biblioteca que hace tiempo que no escucha' });

  // 3. Artist focus: one of the top artists, own songs + others of theirs
  const focusArtist = artists.length > 0 ? pick(artists.slice(0, Math.min(3, artists.length))) : '';
  if (focusArtist) {
    const own = library.filter((e) => (e.track.artists || []).some((a) => a.name === focusArtist));
    let focusTracks = take(shuffle(own), Math.ceil(blockSize / 2));
    if (focusTracks.length < blockSize) {
      const more = await searchArtistTracks(focusArtist);
      focusTracks = focusTracks.concat(takeTracks(shuffle(more), blockSize - focusTracks.length));
    }
    if (focusTracks.length >= 2) blocks.push({ kind: 'artist-focus', tracks: focusTracks, reason: `es uno de sus artistas más escuchados`, focusArtist });
  }

  // 4. Discoveries: songs of their other artists that are NOT in the library
  const discoveryArtists = shuffle(artists.filter((a) => a !== focusArtist)).slice(0, 3);
  if (discoveryArtists.length > 0) {
    const libSigs = new Set(library.map((e) => sigOf(e.track)));
    const found = (await Promise.all(discoveryArtists.map((a) => searchArtistTracks(a, 10)))).flat().filter((t) => !libSigs.has(sigOf(t)) && !exclude.has(t.id));
    const discTracks = takeTracks(shuffle(found), blockSize);
    if (discTracks.length >= 2) blocks.push({ kind: 'discovery', tracks: discTracks, reason: `canciones nuevas de artistas que le gustan (${discoveryArtists.join(', ')})` });
  }

  // 5. Liked songs block as filler when the library is small
  if (blocks.length < 3) {
    const liked = library.filter((e) => e.liked);
    const likedTracks = take(shuffle(liked), blockSize);
    if (likedTracks.length >= 2) blocks.push({ kind: 'liked', tracks: likedTracks, reason: 'canciones que guardó en Me gusta' });
  }

  // Fallback: anything in the library
  if (blocks.length === 0) {
    const any = take(shuffle(library), blockSize * 3);
    if (any.length > 0) blocks.push({ kind: 'liked', tracks: any, reason: 'canciones de su biblioteca' });
  }

  // Order: open with heavy rotation or artist focus most of the time, never the same order twice
  const opener = blocks.find((b) => b.kind === 'heavy-rotation') || blocks.find((b) => b.kind === 'artist-focus');
  const rest = shuffle(blocks.filter((b) => b !== opener));
  const ordered = opener && Math.random() < 0.8 ? [opener, ...rest] : shuffle(blocks);

  const tracks: Track[] = [];
  const segments: DJSegment[] = [];
  ordered.forEach((b, i) => {
    const seg: DJSegment = {
      id: `seg-${Date.now()}-${i}`,
      kind: b.kind,
      title: b.kind === 'artist-focus' ? `Más de ${b.focusArtist}` : SEGMENT_TITLES[b.kind],
      reason: b.reason,
      startIndex: tracks.length,
      length: b.tracks.length,
      intro: '',
      focusArtist: b.focusArtist,
    };
    seg.intro = buildSegmentIntro(seg, b.tracks[0], opts.userName || '', i === 0);
    segments.push(seg);
    tracks.push(...b.tracks);
  });

  return { tracks, segments };
}

/** Segment that contains the given queue index. */
export function segmentAt(segments: DJSegment[], index: number): DJSegment | null {
  for (let i = segments.length - 1; i >= 0; i--) {
    if (index >= segments[i].startIndex && index < segments[i].startIndex + segments[i].length) return segments[i];
  }
  return null;
}
