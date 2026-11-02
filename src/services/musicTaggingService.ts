/**
 * Music Tagging & Hashtag Classification Service
 * 
 * Internal classification engine for tracks and user playlists.
 * Categorizes songs with internal hashtags (e.g. #reggaeton, #chill, #trap, #rock, etc.)
 * purely for internal DJ organization and AI set curation.
 * 
 * NOTE: These hashtags are strictly internal and NOT rendered in visible user-facing copy.
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
  keywords: string[];
  artists: string[];
  searchQueries: string[];
}

export const HASHTAG_DEFINITIONS: Record<MusicHashtag, HashtagDefinition> = {
  '#reggaeton': {
    tag: '#reggaeton',
    keywords: ['reggaeton', 'perreo', 'dembow', 'bellakeo', 'urbano', 'rumba', 'latino', 'dancehall'],
    artists: [
      'bad bunny', 'feid', 'quevedo', 'mora', 'rauw alejandro', 'anuel', 'anuel aa',
      'daddy yankee', 'don omar', 'ozuna', 'jhayco', 'jhay cortez', 'myke towers',
      'ryan castro', 'blessd', 'saiko', 'sech', 'chencho corleone', 'zion & lennox',
      'wisin & yandel', 'j balvin', 'maluma', 'cris mj', 'floyy menor', 'el alfa'
    ],
    searchQueries: [
      'reggaeton exitos 2024',
      'bad bunny feid quevedo perreo',
      'reggaeton clasico de siempre',
      'rauw mora myke towers exitos',
    ],
  },
  '#chill': {
    tag: '#chill',
    keywords: [
      'chill', 'relax', 'acustico', 'acoustic', 'calma', 'suave', 'paz', 'balada',
      'desconectar', 'guitarra', 'intimo', 'indie folk', 'dream pop', 'ambient',
      'lo-fi', 'lofi', 'bedroom pop', 'downtempo', 'slow', 'instrumental', 'fingerstyle'
    ],
    artists: [
      'novo amor', 'cigarettes after sex', 'bon iver', 'men i trust', 'mac demarco',
      'boy pablo', 'sufjan stevens', 'kings of convenience', 'iron & wine', 'iron and wine',
      'jose gonzalez', 'josé gonzález', 'cuco', 'phoebe bridgers', 'beach house',
      'leon bridges', 'daniel caesar', 'sen senra', 'silvana estrada', 'kevin kaarl',
      'guitarricadelafuente', 'natalia lafourcade', 'valeria castro', 'depedro',
      'devendra banhart', 'ludovico einaudi', 'chilledcow', 'lofi girl', 'jack johnson'
    ],
    searchQueries: [
      'novo amor cigarettes after sex indie chill',
      'sen senra guitarricadelafuente kevin kaarl acustico indie',
      'men i trust mac demarco dream pop bedroom chill',
      'bon iver sufjan stevens kings of convenience indie folk',
      'ambient acoustic calm peaceful chillout',
      'lofi beats chillhop instrumental relax study',
    ],
  },
  '#trap': {
    tag: '#trap',
    keywords: ['trap', 'drill', 'phonk', 'barras', 'pesado', 'flow', 'calle', 'subgrave'],
    artists: [
      'duki', 'trueno', 'milo j', 'eladio carrion', 'eladio carrión', 'bizarrap', 'bzrp',
      'c.r.o', 'cro', 'ysy a', 'khea', 'tiago pzk', 'lit killah', 'travis scott',
      'central cee', '21 savage', 'future', 'metro boomin', 'pop smoke'
    ],
    searchQueries: [
      'duki eladio carrion trap latino',
      'trueno milo j bizarrap session',
      'drill trap espanol exitos',
      'travis scott metro boomin trap',
    ],
  },
  '#bachata': {
    tag: '#bachata',
    keywords: ['bachata', 'sentimiento', 'amargue', 'romance', 'guitarra bachata'],
    artists: [
      'romeo santos', 'prince royce', 'aventura', 'juan luis guerra', 'anthony santos',
      'frank reyes', 'zacarias ferreira', 'henry santos', 'daniel santacruz'
    ],
    searchQueries: [
      'romeo santos prince royce aventura exitos',
      'bachata clasicos y nuevas',
      'bachata romántica para bailar',
    ],
  },
  '#rock': {
    tag: '#rock',
    keywords: ['rock', 'guitarra', 'electrica', 'bateria', 'himno', 'distorsion', 'indie rock'],
    artists: [
      'estopa', 'melendi', 'fito & fitipaldis', 'fito y fitipaldis', 'marea', 'extremoduro',
      'leiva', 'pereza', 'los rodriguez', 'jarabe de palo', 'heroes del silencio',
      'queen', 'nirvana', 'guns n roses', 'ac/dc', 'bon jovi', 'red hot chili peppers', 'the killers'
    ],
    searchQueries: [
      'estopa fito melendi rock espanol',
      'clasicos del rock en espanol',
      'queen nirvana greatest rock hits',
      'indie rock festival hits',
    ],
  },
  '#pop': {
    tag: '#pop',
    keywords: ['pop', 'radio', 'pegadiza', 'estribillo', 'comercial', 'top 40', 'bailable'],
    artists: [
      'aitana', 'rosalia', 'rosalía', 'tini', 'emilia', 'lola indigo', 'lola índigo',
      'taylor swift', 'dua lipa', 'sabrina carpenter', 'olivia rodrigo', 'ariana grande',
      'shakira', 'manuel turizo', 'enrique iglesias', 'alvaro de luna'
    ],
    searchQueries: [
      'pop actual en espanol exitos',
      'aitana rosalia emilia pop latino',
      'top pop hits radio 2024',
    ],
  },
  '#electro': {
    tag: '#electro',
    keywords: ['techno', 'house', 'electro', 'edm', 'dance', 'rave', 'drop', 'synth', 'club'],
    artists: [
      'calvin harris', 'david guetta', 'tiesto', 'tiësto', 'avicii', 'martin garrix',
      'marshmello', 'alok', 'fisher', 'fred again', 'skrillex', 'swedish house mafia', 'daft punk'
    ],
    searchQueries: [
      'calvin harris david guetta edm festival',
      'house dance electronic hits',
      'techno club bangers',
    ],
  },
  '#lofi': {
    tag: '#lofi',
    keywords: ['lofi', 'beats', 'study', 'focus', 'concentracion', 'piano', 'instrumental', 'ambient'],
    artists: [
      'chilledcow', 'lofi girl', 'ludovico einaudi', 'yiruma', 'idealism', 'jinsang', 'potsu'
    ],
    searchQueries: [
      'lofi hip hop study beats chill',
      'piano instrumental relax calm',
      'focus beats ambient study',
    ],
  },
  '#clasicos': {
    tag: '#clasicos',
    keywords: ['clasicos', 'antiguas', '80s', '90s', '2000s', 'recuerdos', 'nostalgia', 'oro'],
    artists: [
      'michael jackson', 'madonna', 'abba', 'elthon john', 'george michael',
      'camilo sesto', 'rocio durcal', 'julio iglesias', 'hombres g', 'alaska'
    ],
    searchQueries: [
      'exitos de los 80 y 90 en espanol',
      'clasicos inolvidables canciones de siempre',
      '2000s greatest hits radio',
    ],
  },
  '#entreno': {
    tag: '#entreno',
    keywords: ['gym', 'entreno', 'motivacion', 'fuerza', 'pesas', 'cardio', 'pump', 'adrenalina'],
    artists: [
      'duki', 'eladio carrion', 'travis scott', 'eminem', 'neffex', 'ghostemane'
    ],
    searchQueries: [
      'gym motivation hard phonk drill',
      'entrenamiento pesas maxima energia',
      'workout hip hop pump',
    ],
  },
  '#flamenco': {
    tag: '#flamenco',
    keywords: ['flamenco', 'urbano flamenco', 'palmas', 'cajon', 'espana', 'calle espanol'],
    artists: [
      'c. tangana', 'c tangana', 'delaossa', 'jc reyes', 'camin', 'maka',
      'el bobe', 'morad', 'beny jr', 'kaydy cain', 'rosalia', 'rosalía'
    ],
    searchQueries: [
      'c tangana flamenco urbano exitos',
      'jc reyes camin maka urbano flamenco',
      'flamenco pop moderno espanol',
    ],
  },
};

const TRACK_HASHTAG_CACHE = new Map<string, MusicHashtag[]>();

/**
 * Classifies a track into internal music hashtags by inspecting
 * artist names, track titles and album names.
 */
export function classifyTrackHashtags(track: Track): MusicHashtag[] {
  if (!track || !track.id) return ['#pop'];

  const cacheKey = track.id;
  if (TRACK_HASHTAG_CACHE.has(cacheKey)) {
    return TRACK_HASHTAG_CACHE.get(cacheKey)!;
  }

  const artistsStr = (track.artists || []).map((a) => a.name.toLowerCase()).join(' ');
  const titleStr = (track.name || '').toLowerCase();
  const albumStr = (track.album?.name || '').toLowerCase();
  const combined = `${artistsStr} ${titleStr} ${albumStr}`;

  const matchedTags = new Set<MusicHashtag>();

  for (const [tag, def] of Object.entries(HASHTAG_DEFINITIONS) as [MusicHashtag, HashtagDefinition][]) {
    // Check artist matches (high confidence)
    for (const art of def.artists) {
      if (artistsStr.includes(art)) {
        matchedTags.add(tag);
        break;
      }
    }

    // Check keyword matches in title/album
    for (const kw of def.keywords) {
      if (titleStr.includes(kw) || albumStr.includes(kw)) {
        matchedTags.add(tag);
        break;
      }
    }
  }

  // Guard #chill against high-energy / party tracks
  if (matchedTags.has('#chill')) {
    if (/reggaeton|perreo|bellakeo|dembow|trap|drill|phonk|techno|edm|rave|hardcore|party|fiesta/i.test(combined)) {
      matchedTags.delete('#chill');
    }
  }

  // Fallback heuristic if no tag matched
  if (matchedTags.size === 0) {
    if (combined.includes('feat') || combined.includes('ft.') || combined.includes('remix')) {
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

  // Initialize empty array for each tag
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
 * Curates exactly 15 songs matching the specified internal hashtag:
 * - Dynamically extracts a balanced mix (5-7 tracks) from the user's own matching playlists
 * - Discovers fresh related tracks matching the hashtag via real-time catalog search
 * - Dynamically rotates queries and variations on each run so the mix is always fresh and different
 * - Strictly prevents off-genre contamination (no generic pop into #chill sets)
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
    // Strict guard: ensure track does not belong to discordant genres
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

  // 2. Discover related fresh tracks and remixes for this hashtag
  const def = HASHTAG_DEFINITIONS[targetTag] || HASHTAG_DEFINITIONS['#chill'];
  const queriesShuffled = [...def.searchQueries].sort(() => Math.random() - 0.5);

  // Pick up to 2 distinct search queries with fresh rotation modifiers
  const modifiers = ['', ' remix', ' acustico', ' sesion', ' version', ' live', ' edit'];
  const searchPromises = queriesShuffled.slice(0, 2).map((baseQ) => {
    const mod = modifiers[Math.floor(Math.random() * modifiers.length)];
    const q = `${baseQ}${mod}`.trim();
    return searchSpotify(q).catch(() => null);
  });

  const searchResults = await Promise.all(searchPromises);
  for (const res of searchResults) {
    const discovered = (res?.tracks?.items || []).sort(() => Math.random() - 0.5);
    for (const t of discovered) {
      if (result.length >= count) break;
      addTrack(t);
    }
    if (result.length >= count) break;
  }

  // 3. If still under quota, use remaining genre-specific queries (NEVER generic pop)
  if (result.length < count) {
    for (const extraQuery of queriesShuffled.slice(2)) {
      try {
        const res = await searchSpotify(extraQuery);
        const discovered = (res?.tracks?.items || []).sort(() => Math.random() - 0.5);
        for (const t of discovered) {
          if (result.length >= count) break;
          addTrack(t);
        }
      } catch {}
      if (result.length >= count) break;
    }
  }

  // 4. Final safety fill: repeat user matching tracks if any, otherwise repeat primary query
  if (result.length < count && userShuffled.length > 0) {
    for (const t of userShuffled) {
      if (result.length >= count) break;
      if (!result.some((r) => r.id === t.id)) {
        result.push(t);
      }
    }
  }

  // 5. Return exactly count tracks shuffled
  return result.slice(0, count).sort(() => Math.random() - 0.5);
}
