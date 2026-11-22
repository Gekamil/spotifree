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
import { AUTHENTIC_FLAGSHIP_TRACKS, getDominantUserHashtag } from './musicTaggingService';

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
      return hey + pick([
        `Starting today with a 50/50 mix: your favorite essentials paired with smart shuffle recommendations. Here's ${s}.`,
        `A balanced set today: half your rotation, half fresh discoveries tailored to your taste. ${s}.`,
        `${userName ? `${userName}, ` : ''}let's kick off with a 50/50 blend of your top tracks and new discoveries. ${s}.`,
      ]);
    case 'throwback':
      return hey + pick([`Now a trip back in time. ${s}, you haven't played it in a while.`, `Remember this one? It's been ages. ${s}.`, `Digging up some gems you forgot about. Starting with ${s}.`]);
    case 'artist-focus':
      return hey + pick([`You've been really into ${focus} lately. Here's ${song || 'one of theirs'}.`, `A block dedicated to ${focus}. Kicking off with ${song || 'a banger'}.`, `A little more ${focus}, I know you love it. ${song}.`]);
    case 'discovery':
      return hey + pick([
        `Smart shuffle recommendations incoming that match your taste. Check out ${s}.`,
        `Time to discover. Fresh picks tailored to your style. ${s}.`,
        `Recommendations you don't have saved yet. ${s}. Give it a spin.`,
      ]);
    case 'liked':
      return hey + pick([`Pulling from your Liked Songs. ${s}.`, `Songs you saved for a reason. Starting with ${s}.`]);
    default:
      return hey + (s ? `Here's ${s}.` : "Let's go!");
  }
}

export const SEGMENT_TITLES_EN: Record<DJSegmentKind, string> = {
  'heavy-rotation': 'Your 50/50 Mix',
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
        `${hi}arrancamos con una mezcla 50/50: tus temas favoritos combinados con recomendaciones de al azar inteligente. Suena ${s}.`,
        `He preparado un set equilibrado al 50/50: mitad tus canciones del momento y mitad descubrimientos que te van a encajar. Vamos con ${s}.`,
        `${hi}vamos con tus imprescindibles intercalados con recomendaciones seleccionadas para ti. Arrancamos con ${s}.`,
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
        `Te traigo recomendaciones de al azar inteligente que encajan contigo. Escucha ${s}.`,
        `Hora de descubrir con recomendaciones frescas. Si te gusta lo que escuchas, esto te va a encajar. ${s}.`,
        `Recomendaciones que todavía no tienes en tu biblioteca. ${s}. Dale una oportunidad.`,
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
  'heavy-rotation': 'Tu mezcla 50/50',
  throwback: 'Hace tiempo que no suenan',
  'artist-focus': 'Más de',
  discovery: 'Descubrimientos para ti',
  liked: 'De tus Me gusta',
  request: 'Tu petición',
};

async function searchArtistTracks(artist: string, limit = 8): Promise<Track[]> {
  try {
    const searchPromise = searchSpotify(`artist:"${artist}"`);
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 400));
    const res = await Promise.race([searchPromise, timeoutPromise]);
    const items: Track[] = (res as any)?.tracks?.items || [];
    return filterMusicTracksOnly(items).filter((t) => (t.artists || []).some((a) => (a.name || '').toLowerCase() === artist.toLowerCase())).slice(0, limit);
  } catch {
    return [];
  }
}

/**
 * Interleaves playlist tracks and smart recommendations to achieve a strict 50/50 balance.
 * Pattern: [playlistTrack1, recTrack1, playlistTrack2, recTrack2].
 */
export function interleave5050(playlistTracks: Track[], recTracks: Track[], targetSize: number = 4): Track[] {
  const result: Track[] = [];
  let pIdx = 0;
  let rIdx = 0;

  while (result.length < targetSize && (pIdx < playlistTracks.length || rIdx < recTracks.length)) {
    if (result.length % 2 === 0) {
      if (pIdx < playlistTracks.length) {
        result.push(playlistTracks[pIdx++]);
      } else if (rIdx < recTracks.length) {
        result.push(recTracks[rIdx++]);
      }
    } else {
      if (rIdx < recTracks.length) {
        result.push(recTracks[rIdx++]);
      } else if (pIdx < playlistTracks.length) {
        result.push(playlistTracks[pIdx++]);
      }
    }
  }
  return result;
}

/**
 * Fetches high-quality smart recommendations using YouTube Music Radio algorithm (Smart Shuffle)
 * and related discoveries, strictly excluding songs already in the user's library/playlists.
 */
export async function fetchSmartDJRecommendations(
  seedTracks: Track[],
  artists: string[],
  excludeSigsAndIds: Set<string>,
  targetCount: number = 8
): Promise<Track[]> {
  const recs: Track[] = [];
  const seen = new Set<string>(excludeSigsAndIds);

  const add = (t: Track | null | undefined): boolean => {
    if (!t || !t.id || isNonMusicOrNoise(t)) return false;
    const sig = sigOf(t);
    const clean = cleanId(t.id);
    if (seen.has(sig) || seen.has(clean) || seen.has(t.id)) return false;
    seen.add(sig);
    seen.add(clean);
    seen.add(t.id);
    recs.push({ ...t, isSmartRecommendation: true } as any);
    return true;
  };

  // 1. YouTube Music Radio (Smart Shuffle's core recommendation engine)
  const topSeeds = seedTracks.slice(0, 2);
  const ytmPromises = topSeeds.map(async (seed) => {
    if (!seed || !seed.name) return [];
    try {
      const isYtId = (id: string) => /^[a-zA-Z0-9_-]{11}$/.test(id);
      const rawVideoId = isYtId(seed.id || '') ? seed.id : (seed.id || '').startsWith('yt-') ? seed.id.replace(/^yt-/i, '') : '';
      const title = seed.name || '';
      const artist = seed.artists?.[0]?.name || '';
      const res = await fetch(
        `/api/audio/recommendations?videoId=${encodeURIComponent(rawVideoId)}&title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}&limit=10`,
        { signal: AbortSignal.timeout ? AbortSignal.timeout(1200) : undefined }
      );
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.tracks)) {
          return data.tracks as Track[];
        }
      }
    } catch {}
    return [];
  });

  try {
    const ytmBatches = await Promise.all(ytmPromises);
    ytmBatches.flat().forEach(add);
  } catch {}

  // 2. Discoveries from user's favorite artists that are not in their library
  if (recs.length < targetCount && artists.length > 0) {
    try {
      const artistPromises = artists.slice(0, 3).map((a) => searchArtistTracks(a, 6));
      const artistBatches = await Promise.all(artistPromises);
      artistBatches.flat().forEach(add);
    } catch {}
  }

  // 3. Flagship authentic chart tracks from dominant genre
  if (recs.length < targetCount) {
    try {
      const dominantTag = getDominantUserHashtag();
      const flagship = AUTHENTIC_FLAGSHIP_TRACKS[dominantTag] || [];
      shuffle(flagship).forEach(add);
    } catch {}
  }

  return filterMusicTracksOnly(recs).slice(0, targetCount);
}

/**
 * Builds a fresh DJ set of `blockCount` blocks (~4 songs each). Different every time:
 * block order, picks and lines are randomised, and songs already used are skipped.
 * Balances the set 50/50 between user's favorite playlist songs and smart shuffle recommendations.
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

  // Heavy rotation candidates: most played, then liked + recently played
  const heavy = [...library]
    .filter((e) => e.plays > 0 || e.recentRank < 25)
    .sort((a, b) => b.plays * 3 + (b.recentRank < 25 ? 25 - b.recentRank : 0) - (a.plays * 3 + (a.recentRank < 25 ? 25 - a.recentRank : 0)));

  // Collect signatures and IDs of the user's entire library so recommendations NEVER repeat what is in their playlists
  const librarySigs = new Set(library.map((e) => sigOf(e.track)));
  const libraryIds = new Set(library.map((e) => cleanId(e.track.id)));
  const combinedExclude = new Set<string>([...exclude, ...librarySigs, ...libraryIds]);

  // Fetch smart shuffle recommendations (50/50 balance)
  const smartRecs = await fetchSmartDJRecommendations(
    heavy.map((e) => e.track),
    artists,
    combinedExclude,
    blockSize * 4
  );

  let recIdx = 0;
  const takeRecs = (n: number): Track[] => {
    const out: Track[] = [];
    while (out.length < n && recIdx < smartRecs.length) {
      const t = smartRecs[recIdx++];
      const sig = sigOf(t);
      if (!used.has(sig)) {
        used.add(sig);
        out.push(t);
      }
    }
    return out;
  };

  // 1. Heavy rotation: 50/50 mix with user's top playlist tracks & fresh smart shuffle recommendations
  const heavyHalf = take(shuffle(heavy.slice(0, blockSize * 2)), Math.ceil(blockSize / 2));
  const recHalf = takeRecs(Math.floor(blockSize / 2));
  const openerTracks = (heavyHalf.length > 0 && recHalf.length > 0)
    ? interleave5050(heavyHalf, recHalf, blockSize)
    : take(shuffle(heavy.slice(0, blockSize * 3)), blockSize);

  if (openerTracks.length >= 2) {
    blocks.push({
      kind: 'heavy-rotation',
      tracks: openerTracks,
      reason: 'una mezcla 50/50 con tus temas favoritos y recomendaciones de al azar inteligente',
    });
  }

  // 2. Discoveries block: authentic recommendations tailored by smart shuffle
  const discoveryRecs = takeRecs(blockSize);
  const discoveryArtists = shuffle(artists).slice(0, 3);
  if (discoveryRecs.length >= 2) {
    blocks.push({
      kind: 'discovery',
      tracks: discoveryRecs,
      reason: 'canciones nuevas recomendadas con al azar inteligente que encajan con tu rollo',
    });
  } else if (discoveryArtists.length > 0 && library.length < 4 && blocks.length === 0) {
    const libSigs = new Set(library.map((e) => sigOf(e.track)));
    const found = (await Promise.all(discoveryArtists.map((a) => searchArtistTracks(a, 10)))).flat().filter((t) => !libSigs.has(sigOf(t)) && !exclude.has(t.id));
    const discTracks = takeTracks(shuffle(found), blockSize);
    if (discTracks.length >= 2) blocks.push({ kind: 'discovery', tracks: discTracks, reason: `canciones nuevas de artistas que le gustan (${discoveryArtists.join(', ')})` });
  }

  // 3. Artist focus: 50% own songs from playlists + 50% fresh recommendations of that artist
  const focusArtist = artists.length > 0 ? pick(artists.slice(0, Math.min(3, artists.length))) : '';
  if (focusArtist) {
    const own = library.filter((e) => (e.track.artists || []).some((a) => a.name === focusArtist));
    const ownTracks = take(shuffle(own), Math.ceil(blockSize / 2));
    let recArtistTracks = takeRecs(Math.floor(blockSize / 2));
    if (recArtistTracks.length < Math.floor(blockSize / 2)) {
      const more = await searchArtistTracks(focusArtist);
      const moreRecs = more.filter((t) => !librarySigs.has(sigOf(t)) && !used.has(sigOf(t)));
      recArtistTracks = recArtistTracks.concat(takeTracks(shuffle(moreRecs), Math.floor(blockSize / 2) - recArtistTracks.length));
    }
    const artist5050 = (ownTracks.length > 0 && recArtistTracks.length > 0)
      ? interleave5050(ownTracks, recArtistTracks, blockSize)
      : ownTracks.concat(takeTracks(shuffle(recArtistTracks), blockSize - ownTracks.length));
    if (artist5050.length >= 2) blocks.push({ kind: 'artist-focus', tracks: artist5050, reason: `es uno de sus artistas más escuchados`, focusArtist });
  }

  // 4. Throwbacks: 50% throwback songs + 50% smart recommendations
  const throwback = library.filter((e) => e.recentRank === Infinity && (e.lastPlayedAt === 0 || now - e.lastPlayedAt > 14 * DAY));
  const throwbackHalf = take(shuffle(throwback.filter((e) => e.liked || e.plays > 0).concat(shuffle(throwback))), Math.ceil(blockSize / 2));
  const throwbackRecs = takeRecs(Math.floor(blockSize / 2));
  const throwbackTracks = (throwbackHalf.length > 0 && throwbackRecs.length > 0)
    ? interleave5050(throwbackHalf, throwbackRecs, blockSize)
    : take(shuffle(throwback.filter((e) => e.liked || e.plays > 0).concat(shuffle(throwback))), blockSize);
  if (throwbackTracks.length >= 2) blocks.push({ kind: 'throwback', tracks: throwbackTracks, reason: 'canciones de su biblioteca que hace tiempo que no escucha' });

  // 5. Liked songs block as filler when the library is small
  if (blocks.length < 3) {
    const liked = library.filter((e) => e.liked);
    const likedHalf = take(shuffle(liked), Math.ceil(blockSize / 2));
    const likedRecs = takeRecs(Math.floor(blockSize / 2));
    const likedTracks = (likedHalf.length > 0 && likedRecs.length > 0)
      ? interleave5050(likedHalf, likedRecs, blockSize)
      : take(shuffle(liked), blockSize);
    if (likedTracks.length >= 2) blocks.push({ kind: 'liked', tracks: likedTracks, reason: 'canciones que guardó en Me gusta' });
  }

  // Fallback: anything in the library
  if (blocks.length === 0) {
    const any = take(shuffle(library), blockSize * 3);
    if (any.length > 0) blocks.push({ kind: 'liked', tracks: any, reason: 'canciones de su biblioteca' });
  }

  // Order: opener is ALWAYS the 50/50 heavy rotation mix
  const opener = blocks.find((b) => b.kind === 'heavy-rotation') || blocks.find((b) => b.kind === 'artist-focus');
  const rest = shuffle(blocks.filter((b) => b !== opener));
  const ordered = opener ? [opener, ...rest] : shuffle(blocks);

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
