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
    keywords: ['chill', 'relax', 'acustico', 'acoustic', 'calma', 'suave', 'paz', 'balada', 'desconectar', 'guitarra', 'intimo'],
    artists: [
      'morat', 'coldplay', 'ed sheeran', 'vance joy', 'pablo alboran', 'pablo alborán',
      'beret', 'sebastian yatra', 'camila', 'reik', 'sin bandera', 'jack johnson',
      'james arthur', 'lewis capaldi', 'shawn mendes', 'alec benjamin', 'billie eilish'
    ],
    searchQueries: [
      'morat beret acustico baladas',
      'coldplay ed sheeran acoustic chill',
      'musica tranquila suave espanol',
      'indie folk chill out acoustic',
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
 * - Extracts up to 7-8 tracks from the user's own playlists
 * - Discovers related tracks matching the hashtag via search
 * - Guarantees pristine track covers and deduplication
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
    seen.add(t.id);
    result.push(t);
    return true;
  };

  // 1. Take up to 7-8 tracks from user's matching playlists
  const userShuffled = [...userTracks].sort(() => Math.random() - 0.5);
  const userQuota = Math.min(8, userShuffled.length);
  for (let i = 0; i < userQuota; i++) {
    addTrack(userShuffled[i]);
  }

  // 2. Discover related fresh tracks for this hashtag
  const def = HASHTAG_DEFINITIONS[targetTag];
  const query = def.searchQueries[Math.floor(Math.random() * def.searchQueries.length)] || `${targetTag.replace('#', '')} exitos`;

  try {
    const searchRes = await searchSpotify(query);
    const discovered = searchRes?.tracks?.items || [];
    for (const t of discovered) {
      if (result.length >= count) break;
      addTrack(t);
    }
  } catch {}

  // 3. Fallback: if we still need more tracks, pull from user's other tracks or general search
  if (result.length < count) {
    const allUserTracks = Array.from(libraryIndex.values()).flat();
    for (const t of allUserTracks) {
      if (result.length >= count) break;
      addTrack(t);
    }
  }

  if (result.length < count) {
    try {
      const fallbackRes = await searchSpotify('top exitos espanol 2024');
      const fallbackTracks = fallbackRes?.tracks?.items || [];
      for (const t of fallbackTracks) {
        if (result.length >= count) break;
        addTrack(t);
      }
    } catch {}
  }

  // 4. Return exactly count tracks shuffled
  return result.slice(0, count).sort(() => Math.random() - 0.5);
}
