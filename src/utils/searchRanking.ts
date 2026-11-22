/**
 * Orders song results by how well they match what was typed (like Spotify): "bad bunny" gives
 * Bad Bunny's songs before songs that are just called "Bad", and the real song before karaoke,
 * lullaby or cover versions. Pure function (tests/search_ranking.test.js).
 */
import { isStrictArtistMatch } from './trackArtists';

export interface RankableTrack {
  name: string;
  artists?: Array<{ name: string }>;
  isLyricsMatch?: boolean;
}

export const normText = (s: string) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ñ]+/g, ' ')
    .trim();

const VERSION_WORDS = /\b(karaoke|instrumental|cover|tribute|lullaby|lullabies|rendition|8 bit|piano version|workout|made famous|in the style of|originally performed|cancion de cuna|nana)\b/;

export function searchScore(query: string, t: RankableTrack): number {
  if (t.isLyricsMatch) return 500;
  const q = normText(query);
  if (!q) return 0;
  const tokens = q.split(' ').filter(Boolean);
  const title = normText(t.name);
  const artists = (t.artists || []).map((a) => normText(a.name)).filter(Boolean);
  const artistStr = artists.join(' ');
  const all = `${title} ${artistStr}`;
  const words = new Set(all.split(' '));

  let score = 0;
  if (artists.includes(q)) {
    score += 120; // typed the artist's name exactly
  } else if (artists.some((a) => isStrictArtistMatch(a, q))) {
    score += 100;
  } else if (tokens.length === 1 && artists.some((a) => a.split(' ').includes(q))) {
    score += 35;
  }

  if (title === q) score += 90; // typed the song's title exactly
  else if (title.startsWith(q)) score += 35;
  else if (title.includes(q)) score += 20;

  if (q.includes(title) && artists.some((a) => isStrictArtistMatch(a, q) || q.includes(a))) {
    score += 85; // "song artist"
  }

  let missing = 0;
  for (const tok of tokens) {
    const whole = words.has(tok);
    const part = !whole && all.includes(tok);
    if (whole) score += artistStr.split(' ').includes(tok) ? 8 : 6;
    else if (part) score += 2;
    else missing++;
  }
  score -= missing * 30;

  // Penalize partial substring artist collision when searching multi-word artist
  // e.g. searching "Vibra Eterna" must penalize songs from artist "Eterna"
  if (tokens.length > 1) {
    for (const a of artists) {
      const aTokens = a.split(' ').filter(Boolean);
      if (aTokens.length < tokens.length && tokens.includes(a)) {
        score -= 60;
      }
    }
  }

  // Versions nobody asked for
  if (VERSION_WORDS.test(`${title} ${artistStr}`) && !VERSION_WORDS.test(q)) score -= 25;
  return score;
}


/** Stable sort by relevance (equal scores keep the original order) */
export function rankSearchTracks<T extends RankableTrack>(query: string, tracks: T[]): T[] {
  return tracks
    .map((t, i) => ({ t, i, s: searchScore(query, t) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.t);
}

export interface RankablePlaylist {
  id: string;
  name: string;
  description?: string;
  images?: Array<{ url: string }>;
  owner?: { display_name?: string; id?: string };
  tracks?: { total?: number; items?: any[] };
  [key: string]: any;
}

export const PLAYLIST_FRANCHISE_MAP = [
  { match: /\b(los\s+)?juegos\s+del\s+hambre\b/i, alias: 'hunger games' },
  { match: /\b(el\s+)?se[ñn]or\s+de\s+los\s+anillos\b/i, alias: 'lord of the rings' },
  { match: /\b(la\s+)?guerra\s+de\s+las\s+galaxias\b/i, alias: 'star wars' },
  { match: /\b(el\s+)?juego\s+de\s+tronos\b/i, alias: 'game of thrones' },
  { match: /\bcancion\s+de\s+hielo\s+y\s+fuego\b/i, alias: 'a song of ice and fire' },
  { match: /\bpiratas\s+del\s+caribe\b/i, alias: 'pirates of the caribbean' },
  { match: /\bguardianes\s+de\s+la\s+galaxia\b/i, alias: 'guardians of the galaxy' },
  { match: /\b(los\s+)?vengadores\b/i, alias: 'avengers' },
  { match: /\b(el\s+)?hombre\s+ara[ñn]a\b/i, alias: 'spider man' },
  { match: /\b(el\s+)?rey\s+leon\b/i, alias: 'the lion king' },
  { match: /\b(la\s+)?bella\s+y\s+la\s+bestia\b/i, alias: 'beauty and the beast' },
  { match: /\b(el\s+)?padrino\b/i, alias: 'the godfather' },
  { match: /\bpesadilla\s+antes\s+de\s+navidad\b/i, alias: 'the nightmare before christmas' },
  { match: /\bel\s+viaje\s+de\s+chihiro\b/i, alias: 'spirited away' },
  { match: /\b(las\s+)?cronicas\s+de\s+narnia\b/i, alias: 'the chronicles of narnia' },
  { match: /\b(a\s+todo\s+gas|rapidos?\s+y\s+furiosos?)\b/i, alias: 'fast and furious' },
  { match: /\bmision\s+imposible\b/i, alias: 'mission impossible' },
  { match: /\bamanecer\s+en\s+la\s+cosecha\b/i, alias: 'sunrise on the reaping' },
  { match: /\bbalada\s+de\s+pajaros\s+cantores\b/i, alias: 'the ballad of songbirds and snakes' },
  { match: /\binterestelar\b/i, alias: 'interstellar' },
  { match: /\b(el\s+)?origen\b/i, alias: 'inception' },
  { match: /\b(la\s+)?casa\s+de\s+papel\b/i, alias: 'money heist' },
  { match: /\b(el\s+)?ultimo\s+de\s+nosotros\b/i, alias: 'the last of us' },
  { match: /\b(la\s+)?leyenda\s+de\s+zelda\b/i, alias: 'the legend of zelda' },
];

export function playlistSearchScore(query: string, p: RankablePlaylist): number {
  const q = normText(query);
  if (!q) return 0;
  const title = normText(p.name);
  const desc = normText(p.description || '');
  const owner = normText(p.owner?.display_name || p.owner?.id || '');
  const id = String(p.id || '');
  const isSpotifyOfficial = owner === 'spotify' || id.startsWith('37i9dQ');

  let score = 0;

  // Spotify Official Editorial Boost
  if (isSpotifyOfficial) {
    score += 260;
  }

  // Official Soundtrack and Editorial markers
  if (/\b(official\s+playlist|soundtrack\s+oficial|banda\s+sonora\s+oficial|official\s+soundtrack|original\s+soundtrack)\b/i.test(p.name)) {
    score += 140;
  } else if (/\b(soundtrack|banda\s+sonora|ost|bso|score)\b/i.test(p.name)) {
    score += 60;
  }

  if (/^(this\s+is|mix\s+de|radio\s+de)\b/i.test(title)) {
    score += 50;
  }

  // Exact & Prefix Title Match
  if (title === q) {
    score += 200;
  } else if (title.startsWith(q)) {
    score += 100;
  } else if (title.includes(q)) {
    score += 70;
  }

  // Franchise & Bilingual Semantic Matching
  for (const f of PLAYLIST_FRANCHISE_MAP) {
    if (f.match.test(q)) {
      if (title.includes(f.alias) || desc.includes(f.alias)) {
        score += 220;
      }
    }
  }

  // Token Overlap
  const stopWords = new Set(['de', 'la', 'los', 'las', 'el', 'en', 'y', 'the', 'of', 'and', 'in', 'on', 'a', 'para', 'con']);
  const tokens = q.split(' ').filter((t) => t.length > 1 && !stopWords.has(t));
  const titleWords = new Set(title.split(' '));
  for (const tok of tokens) {
    if (titleWords.has(tok)) {
      score += 25;
    } else if (title.includes(tok)) {
      score += 12;
    } else if (desc.includes(tok)) {
      score += 6;
    } else {
      score -= 15;
    }
  }

  // Audiobooks / Reading Fan Playlists: Push to bottom unless user asked for audio
  const isAudioIntent = /\b(audio|audiolibro|audiobook|capitulo|leer|lectura|reading|book|libro)\b/i.test(q);
  const combinedText = `${title} ${desc}`;
  const isAudioContent = /\b(audiolibro|audiobook|lee\s+conmigo|reading\s+the|pov\b|pov:|capitulo|capitulos)\b/i.test(combinedText);
  if (!isAudioIntent) {
    if (isAudioContent) {
      score -= 320;
    }
  } else {
    if (isAudioContent) {
      score += 350;
    }
  }

  if (p.images?.[0]?.url) {
    score += 15;
  }

  return score;
}

export function rankSearchPlaylists<T extends RankablePlaylist>(query: string, playlists: T[]): T[] {
  return playlists
    .map((p, i) => ({ p, i, s: playlistSearchScore(query, p) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.p);
}
