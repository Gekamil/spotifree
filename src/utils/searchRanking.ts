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
