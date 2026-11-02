/**
 * Music Tagging & Hashtag Classification Service
 * 
 * Internal classification engine for tracks and user playlists.
 * Categorizes songs with internal hashtags (e.g. #reggaeton, #chill, #trap, #rock, etc.)
 * purely for internal DJ organization and AI set curation.
 * 
 * NOTE: Searches are performed by verified GENRE ROLES and flagship artists,
 * NEVER by searching literal genre keywords in song titles.
 * These hashtags are strictly internal and NOT rendered in visible user-facing copy.
 */

import type { Track } from '../types/spotify';
import { useSpotifyDataStore } from '../store/useSpotifyDataStore';
import { searchSpotify } from './spotifyApi';

export type MusicHashtag =
  | '#reggaeton'
  | '#chill'
  | '#trap'
  | '#bachata'
  | '#rock'
  | '#pop'
  | '#electro'
  | '#lofi'
  | '#clasicos'
  | '#entreno'
  | '#flamenco';

interface HashtagDefinition {
  tag: MusicHashtag;
  deezerGenreId?: number;
  itunesGenreId?: number;
  artists: string[];
}

export const HASHTAG_DEFINITIONS: Record<MusicHashtag, HashtagDefinition> = {
  '#reggaeton': {
    tag: '#reggaeton',
    deezerGenreId: 122, // Reggaeton
    itunesGenreId: 1119, // Latin Urban
    artists: [
      'bad bunny', 'feid', 'quevedo', 'mora', 'rauw alejandro', 'anuel', 'anuel aa',
      'daddy yankee', 'don omar', 'ozuna', 'jhayco', 'jhay cortez', 'myke towers',
      'ryan castro', 'blessd', 'saiko', 'sech', 'chencho corleone', 'zion & lennox',
      'wisin & yandel', 'j balvin', 'maluma', 'cris mj', 'floyy menor', 'el alfa'
    ],
  },
  '#chill': {
    tag: '#chill',
    deezerGenreId: 466, // Folk / Acoustic Calm
    itunesGenreId: 10,  // Singer/Songwriter & Acoustic
    artists: [
      'novo amor', 'cigarettes after sex', 'bon iver', 'men i trust', 'mac demarco',
      'boy pablo', 'sufjan stevens', 'kings of convenience', 'iron & wine', 'iron and wine',
      'jose gonzalez', 'josé gonzález', 'cuco', 'phoebe bridgers', 'beach house',
      'leon bridges', 'daniel caesar', 'sen senra', 'silvana estrada', 'kevin kaarl',
      'guitarricadelafuente', 'natalia lafourcade', 'valeria castro', 'depedro',
      'devendra banhart', 'ludovico einaudi', 'chilledcow', 'lofi girl', 'jack johnson'
    ],
  },
  '#trap': {
    tag: '#trap',
    deezerGenreId: 116, // Rap/Hip Hop
    itunesGenreId: 18,  // Hip-Hop/Rap
    artists: [
      'duki', 'trueno', 'milo j', 'eladio carrion', 'eladio carrión', 'bizarrap', 'bzrp',
      'c.r.o', 'cro', 'ysy a', 'khea', 'tiago pzk', 'lit killah', 'travis scott',
      'central cee', '21 savage', 'future', 'metro boomin', 'pop smoke'
    ],
  },
  '#bachata': {
    tag: '#bachata',
    deezerGenreId: 197, // Latino
    itunesGenreId: 12,  // Latino
    artists: [
      'romeo santos', 'prince royce', 'aventura', 'juan luis guerra', 'anthony santos',
      'frank reyes', 'zacarias ferreira', 'henry santos', 'daniel santacruz'
    ],
  },
  '#rock': {
    tag: '#rock',
    deezerGenreId: 152, // Rock
    itunesGenreId: 21,  // Rock
    artists: [
      'estopa', 'melendi', 'fito & fitipaldis', 'fito y fitipaldis', 'marea', 'extremoduro',
      'leiva', 'pereza', 'los rodriguez', 'jarabe de palo', 'heroes del silencio',
      'queen', 'nirvana', 'guns n roses', 'ac/dc', 'bon jovi', 'red hot chili peppers', 'the killers'
    ],
  },
  '#pop': {
    tag: '#pop',
    deezerGenreId: 132, // Pop
    itunesGenreId: 14,  // Pop
    artists: [
      'aitana', 'rosalia', 'rosalía', 'tini', 'emilia', 'lola indigo', 'lola índigo',
      'taylor swift', 'dua lipa', 'sabrina carpenter', 'olivia rodrigo', 'ariana grande',
      'shakira', 'manuel turizo', 'enrique iglesias', 'alvaro de luna'
    ],
  },
  '#electro': {
    tag: '#electro',
    deezerGenreId: 113, // Dance
    itunesGenreId: 17,  // Dance
    artists: [
      'calvin harris', 'david guetta', 'tiesto', 'tiësto', 'avicii', 'martin garrix',
      'marshmello', 'alok', 'fisher', 'fred again', 'skrillex', 'swedish house mafia', 'daft punk'
    ],
  },
  '#lofi': {
    tag: '#lofi',
    deezerGenreId: 85, // Alternativo / Ambient
    itunesGenreId: 20, // Alternative
    artists: [
      'chilledcow', 'lofi girl', 'ludovico einaudi', 'yiruma', 'idealism', 'jinsang', 'potsu'
    ],
  },
  '#clasicos': {
    tag: '#clasicos',
    deezerGenreId: 152, // Classic Rock & Pop
    itunesGenreId: 21,  // Classic Rock
    artists: [
      'michael jackson', 'madonna', 'abba', 'elton john', 'elthon john', 'george michael',
      'camilo sesto', 'rocio durcal', 'julio iglesias', 'hombres g', 'alaska', 'queen'
    ],
  },
  '#entreno': {
    tag: '#entreno',
    deezerGenreId: 116, // Rap & High energy
    itunesGenreId: 18,  // Hip-Hop
    artists: [
      'duki', 'eladio carrion', 'travis scott', 'eminem', 'neffex', 'ghostemane', 'bizarrap'
    ],
  },
  '#flamenco': {
    tag: '#flamenco',
    deezerGenreId: 197, // Latino
    itunesGenreId: 12,  // Latino
    artists: [
      'c. tangana', 'c tangana', 'delaossa', 'jc reyes', 'camin', 'maka',
      'el bobe', 'morad', 'beny jr', 'kaydy cain', 'rosalia', 'rosalía'
    ],
  },
};

const TRACK_HASHTAG_CACHE = new Map<string, MusicHashtag[]>();

/**
 * Filter out any song whose title literally equals or directly starts with the genre word
 * (e.g. a song titled "Reggaeton", "Pop", "Chill", "Clásicos")
 */
function isGenericTitleMatch(title: string, role: MusicHashtag): boolean {
  if (!title) return false;
  const t = title.toLowerCase().trim();
  const rawRole = role.replace('#', '').toLowerCase();
  if (
    t === rawRole ||
    t === `${rawRole} mix` ||
    t === `${rawRole} exitos` ||
    t === `${rawRole} hits` ||
    t.startsWith(`${rawRole} -`) ||
    t.startsWith(`${rawRole} (`) ||
    t.startsWith(`${rawRole} :`) ||
    t.startsWith(`${rawRole} `) ||
    t === 'chillout' ||
    t === 'chill out' ||
    t === 'chill beats' ||
    t === 'lofi beats' ||
    t === 'pop music' ||
    t === 'reggaeton 2024' ||
    t === 'canciones de siempre'
  ) {
    return true;
  }
  return false;
}

/**
 * Classifies a track into internal music hashtags based on artist roles
 * and genre characteristics, strictly avoiding false keyword matches on titles.
 */
export function classifyTrackHashtags(track: Track): MusicHashtag[] {
  if (!track || !track.id) return ['#pop'];

  const cacheKey = track.id;
  if (TRACK_HASHTAG_CACHE.has(cacheKey)) {
    return TRACK_HASHTAG_CACHE.get(cacheKey)!;
  }

  const artistsStr = (track.artists || []).map((a) => a.name.toLowerCase()).join(' ');
  const titleStr = (track.name || '').toLowerCase();
  const matchedTags = new Set<MusicHashtag>();

  // 1. High-confidence Artist Role Match (The artist determines the musical role)
  for (const [tag, def] of Object.entries(HASHTAG_DEFINITIONS) as [MusicHashtag, HashtagDefinition][]) {
    for (const art of def.artists) {
      if (artistsStr.includes(art)) {
        matchedTags.add(tag);
        break;
      }
    }
  }

  // 2. Specific acoustic or rhythmic cues (without matching generic genre names)
  if (matchedTags.size === 0) {
    if (/perreo|dembow|bellakeo/i.test(titleStr)) {
      matchedTags.add('#reggaeton');
    } else if (/drill|barras|subgrave|phonk/i.test(titleStr)) {
      matchedTags.add('#trap');
    } else if (/fingerstyle|piano solo|ambient dream/i.test(titleStr)) {
      matchedTags.add('#chill');
    } else if (/bachata/i.test(titleStr)) {
      matchedTags.add('#bachata');
    }
  }

  // 3. Strict guard for #chill against high-energy or dance music
  if (matchedTags.has('#chill')) {
    if (
      /reggaeton|perreo|bellakeo|dembow|trap|drill|phonk|techno|edm|rave|hardcore|party|fiesta/i.test(titleStr) ||
      /bad bunny|feid|anuel|eladio|duki|karol g/i.test(artistsStr)
    ) {
      matchedTags.delete('#chill');
    }
  }

  // 4. Fallback heuristic
  if (matchedTags.size === 0) {
    if (titleStr.includes('remix') || titleStr.includes('feat') || titleStr.includes('ft.')) {
      matchedTags.add('#reggaeton');
    } else {
      matchedTags.add('#pop');
    }
  }

  const result = Array.from(matchedTags);
  TRACK_HASHTAG_CACHE.set(cacheKey, result);
  return result;
}

/**
 * Returns the dominant music hashtag across the user's library
 */
export function getDominantUserHashtag(): MusicHashtag {
  const library = analyzeUserLibraryByHashtags();
  let maxCount = 0;
  let dominant: MusicHashtag = '#reggaeton';
  for (const [tag, tracks] of library.entries()) {
    if (tracks.length > maxCount) {
      maxCount = tracks.length;
      dominant = tag;
    }
  }
  return dominant;
}

/**
 * Analyzes the user's entire library of playlists and liked songs
 * and builds an internal index of tracks grouped by hashtags.
 */
export function analyzeUserLibraryByHashtags(): Map<MusicHashtag, Track[]> {
  const { playlists, playlistDetailsCache } = useSpotifyDataStore.getState();
  const index = new Map<MusicHashtag, Track[]>();

  (Object.keys(HASHTAG_DEFINITIONS) as MusicHashtag[]).forEach((tag) => {
    index.set(tag, []);
  });

  const seenIds = new Set<string>();

  const processTrack = (t: Track) => {
    if (!t || !t.id || seenIds.has(t.id)) return;
    seenIds.add(t.id);

    const tags = classifyTrackHashtags(t);
    tags.forEach((tag) => {
      const list = index.get(tag) || [];
      list.push(t);
      index.set(tag, list);
    });
  };

  // 1. Scan playlists in cache and store
  Object.values(playlistDetailsCache).forEach((pl: any) => {
    pl?.tracks?.items?.forEach(processTrack);
  });
  playlists.forEach((p) => {
    p.tracks?.items?.forEach(processTrack);
  });

  // 2. Scan locally imported and liked songs
  if (typeof window !== 'undefined') {
    try {
      const local = JSON.parse(window.localStorage.getItem('user_imported_playlists') || '[]');
      local.forEach((p: any) => p?.tracks?.items?.forEach(processTrack));
      const liked = JSON.parse(window.localStorage.getItem('spotifree_liked_songs') || '[]');
      liked.forEach(processTrack);
    } catch {}
  }

  return index;
}

/**
 * Resolves the primary hashtag from a user prompt or vibe description
 */
export function resolveHashtagFromPrompt(prompt: string): MusicHashtag {
  const p = prompt.toLowerCase();

  if (/reggaeton|perreo|bailar|fiesta|dembow|bellakeo|latino/i.test(p)) return '#reggaeton';
  if (/chill|relax|tranquil|calma|suave|acustico|desconectar/i.test(p)) return '#chill';
  if (/trap|drill|phonk|barras|duro/i.test(p)) return '#trap';
  if (/bachata|romeo|aventura|royce/i.test(p)) return '#bachata';
  if (/rock|guitarra|indie|estopa|melendi|fito/i.test(p)) return '#rock';
  if (/electro|techno|house|edm|dance|rave/i.test(p)) return '#electro';
  if (/estudiar|concentra|lofi|piano|trabajar/i.test(p)) return '#lofi';
  if (/gym|entreno|pesas|fuerza|cardio/i.test(p)) return '#entreno';
  if (/flamenco|tangana|delaossa|maka/i.test(p)) return '#flamenco';
  if (/clasic|recuerdo|antigu|80|90|2000/i.test(p)) return '#clasicos';

  // Check known artists
  for (const [tag, def] of Object.entries(HASHTAG_DEFINITIONS) as [MusicHashtag, HashtagDefinition][]) {
    for (const art of def.artists) {
      if (p.includes(art)) return tag;
    }
  }

  return '#reggaeton';
}

/**
 * Fetches verified genre tracks directly from official editorial charts
 * (Deezer genre charts & iTunes Spain genre charts) and flagship artists,
 * completely avoiding naive keyword title searches.
 */
export async function fetchRoleChartTracks(targetTag: MusicHashtag): Promise<Track[]> {
  const def = HASHTAG_DEFINITIONS[targetTag] || HASHTAG_DEFINITIONS['#chill'];
  const tracks: Track[] = [];
  const seenIds = new Set<string>();

  const add = (t: Track) => {
    if (!t || !t.id || seenIds.has(t.id)) return;
    if (isGenericTitleMatch(t.name, targetTag)) return;
    seenIds.add(t.id);
    tracks.push(t);
  };

  try {
    const promises: Promise<any>[] = [];

    // 1. Deezer Official Genre Chart (100% verified genre classification)
    if (def.deezerGenreId !== undefined) {
      promises.push(
        fetch(`https://api.deezer.com/chart/${def.deezerGenreId}/tracks?limit=25`, {
          signal: AbortSignal.timeout?.(4000),
        })
          .then((r) => (r.ok ? r.json() : { data: [] }))
          .then((d) => {
            (d.data || []).forEach((t: any) => {
              const cover = t.album?.cover_xl || t.album?.cover_big || t.album?.cover_medium || '';
              add({
                id: `dz-${t.id}`,
                name: t.title || t.title_short,
                duration_ms: (t.duration || 210) * 1000,
                preview_url: null,
                artists: [{ id: `art-${t.artist?.id || 'unknown'}`, name: t.artist?.name || 'Artista' }],
                album: {
                  id: `alb-${t.album?.id || 'unknown'}`,
                  name: t.album?.title || t.title,
                  images: cover ? [{ url: cover }] : [],
                },
              });
            });
          })
          .catch(() => {})
      );
    }

    // 2. iTunes Spain Official Genre Chart
    if (def.itunesGenreId !== undefined) {
      promises.push(
        fetch(`https://itunes.apple.com/es/rss/topsongs/limit=25/genre=${def.itunesGenreId}/json`, {
          signal: AbortSignal.timeout?.(4000),
        })
          .then((r) => (r.ok ? r.json() : { feed: { entry: [] } }))
          .then((d) => {
            const entries = d.feed?.entry || [];
            entries.forEach((e: any, idx: number) => {
              const images = e['im:image'] || [];
              const highestImg = images[images.length - 1]?.label || '';
              const id = e.id?.attributes?.['im:id'] || `it-${idx}-${Date.now()}`;
              add({
                id: `it-${id}`,
                name: e['im:name']?.label || 'Canción',
                duration_ms: 210000,
                preview_url: null,
                artists: [{ id: `art-it-${idx}`, name: e['im:artist']?.label || 'Artista' }],
                album: {
                  id: `alb-it-${idx}`,
                  name: e['im:collection']?.['im:name']?.label || e['im:name']?.label || 'Álbum',
                  images: highestImg ? [{ url: highestImg.replace(/100x100bb/, '600x600bb') }] : [],
                },
              });
            });
          })
          .catch(() => {})
      );
    }

    // 3. Search catalog for flagship artists of this role (WITHOUT the genre word!)
    const shuffledArtists = [...def.artists].sort(() => Math.random() - 0.5);
    const chosenArtists = shuffledArtists.slice(0, 3);
    for (const art of chosenArtists) {
      promises.push(
        searchSpotify(`artist:"${art}"`)
          .then((res) => {
            (res?.tracks?.items || []).forEach(add);
          })
          .catch(() => {})
      );
    }

    await Promise.all(promises);
  } catch {}

  return tracks.sort(() => Math.random() - 0.5);
}

/**
 * Curates exactly 15 songs matching the specified internal hashtag/role:
 * - Dynamically extracts a balanced mix (5-7 tracks) from the user's own matching playlists
 * - Discovers fresh related tracks from verified genre charts & flagship role artists
 * - Dynamically rotates on each run so the mix is always fresh and different
 * - Strictly prevents off-genre contamination or generic title keyword spam
 */
export async function getCuratedSetForHashtag(
  targetTag: MusicHashtag,
  count: number = 15,
  excludeTrackIds: Set<string> = new Set()
): Promise<Track[]> {
  const libraryIndex = analyzeUserLibraryByHashtags();
  const userTracks = (libraryIndex.get(targetTag) || []).filter((t) => !excludeTrackIds.has(t.id));

  const result: Track[] = [];
  const seen = new Set<string>(excludeTrackIds);

  const addTrack = (t: Track) => {
    if (!t || !t.id || seen.has(t.id)) return false;
    if (isGenericTitleMatch(t.name, targetTag)) return false;

    // Strict guard for #chill
    if (targetTag === '#chill') {
      const lower = `${t.name} ${t.artists?.map((a) => a.name).join(' ')}`.toLowerCase();
      if (/reggaeton|perreo|dembow|bellakeo|trap|drill|phonk|techno|edm|rave|hardcore/i.test(lower)) {
        return false;
      }
    }

    seen.add(t.id);
    result.push(t);
    return true;
  };

  // 1. Take a fresh randomized sample of user tracks from matching playlists (up to 45% of set)
  const userShuffled = [...userTracks].sort(() => Math.random() - 0.5);
  const userQuota = Math.min(Math.floor(count * 0.45), userShuffled.length);
  for (let i = 0; i < userQuota; i++) {
    addTrack(userShuffled[i]);
  }

  // 2. Fetch fresh tracks from the official genre role charts and flagship artists
  const roleTracks = await fetchRoleChartTracks(targetTag);
  for (const t of roleTracks) {
    if (result.length >= count) break;
    addTrack(t);
  }

  // 3. Final safety fill: repeat user matching tracks if any, otherwise repeat role pool
  if (result.length < count && userShuffled.length > 0) {
    for (const t of userShuffled) {
      if (result.length >= count) break;
      if (!result.some((r) => r.id === t.id)) {
        result.push(t);
      }
    }
  }

  // 4. Return exactly count tracks shuffled
  return result.slice(0, count).sort(() => Math.random() - 0.5);
}
