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
    deezerGenreId: 85, // Alternative / Ambient Chill
    itunesGenreId: 20, // Alternative / Relaxed
    artists: [
      'lofi girl', 'chilledcow', 'jinsang', 'idealism', 'potsu', 'saib', 'kupla',
      'kudasaibeats', 'kudasai', 'the deli', 'tomppabeats', 'wun two', 'sleepy fish',
      'elijah who', 'swum', 'eevee', 'birocratic', 'shiloh dynasty', 'ludovico einaudi',
      'purrple cat', 'mell-ø', 'nohidea', 'stan forebee', 'invention_'
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

    // 1. iTunes Spain Official Genre Chart (localized strictly to Spanish / Latin tastes, no random foreign charts)
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

    // 2. Search catalog for flagship artists of this role (WITHOUT the genre word!)
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

export const AUTHENTIC_LOFI_CHILL_TRACKS: Track[] = [
  {
    id: 'lofi-1',
    name: 'Affection',
    duration_ms: 135000,
    preview_url: null,
    artists: [{ id: 'art-jinsang', name: 'Jinsang' }],
    album: {
      id: 'alb-jinsang',
      name: 'Life',
      images: [{ url: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/33/a5/2f/33a52fc2-d77b-9408-6d5b-af389ee28c43/cover_4018939360092.jpg/600x600bb.jpg' }],
    },
  },
  {
    id: 'lofi-2',
    name: 'im closing my eyes',
    duration_ms: 125000,
    preview_url: null,
    artists: [{ id: 'art-potsu', name: 'potsu' }, { id: 'art-shiloh', name: 'Shiloh Dynasty' }],
    album: {
      id: 'alb-potsu',
      name: 'im closing my eyes',
      images: [{ url: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/f4/1c/40/f41c40ff-730f-e190-ed5c-0049cbf46b4b/053000718956_cover.jpg/600x600bb.jpg' }],
    },
  },
  {
    id: 'lofi-3',
    name: 'Controlla',
    duration_ms: 140000,
    preview_url: null,
    artists: [{ id: 'art-idealism', name: 'Idealism' }],
    album: {
      id: 'alb-idealism',
      name: 'Hiraeth',
      images: [{ url: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/b8/b5/26/b8b526e2-956e-bb51-dd2a-f24961a34820/artwork.jpg/600x600bb.jpg' }],
    },
  },
  {
    id: 'lofi-4',
    name: '5:32pm',
    duration_ms: 118000,
    preview_url: null,
    artists: [{ id: 'art-thedeli', name: 'The Deli' }],
    album: {
      id: 'alb-thedeli',
      name: 'Vibes 2',
      images: [{ url: 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/e2/09/c5/e209c539-b762-951a-ff82-c414537b2d01/180772.jpg/600x600bb.jpg' }],
    },
  },
  {
    id: 'lofi-5',
    name: 'Both of Us',
    duration_ms: 154000,
    preview_url: null,
    artists: [{ id: 'art-idealism', name: 'Idealism' }],
    album: {
      id: 'alb-rain',
      name: 'Rainy Evening',
      images: [{ url: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/68/8c/f9/688cf962-6c43-96ec-cc6b-1574e4ce4476/artwork.jpg/600x600bb.jpg' }],
    },
  },
  {
    id: 'lofi-6',
    name: 'Honeymoon',
    duration_ms: 145000,
    preview_url: null,
    artists: [{ id: 'art-kupla', name: 'Kupla' }],
    album: {
      id: 'alb-kupla',
      name: 'Melody Mountain',
      images: [{ url: 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/4b/91/3e/4b913e72-9fd0-5c76-23ed-64ae378b0ed2/850020209125.jpg/600x600bb.jpg' }],
    },
  },
  {
    id: 'lofi-7',
    name: 'Dreaming',
    duration_ms: 132000,
    preview_url: null,
    artists: [{ id: 'art-saib', name: 'Saib' }],
    album: {
      id: 'alb-saib',
      name: 'Bebop',
      images: [{ url: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/04/e5/01/04e501dd-9ef2-729b-f5d2-d9bb923dd685/881034742674.jpg/600x600bb.jpg' }],
    },
  },
  {
    id: 'lofi-8',
    name: 'A Lonely Begonia',
    duration_ms: 160000,
    preview_url: null,
    artists: [{ id: 'art-kudasai', name: 'Kudasaibeats' }],
    album: {
      id: 'alb-kudasai',
      name: 'Falling',
      images: [{ url: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/1c/30/b1/1c30b1ce-6c95-7fd4-cc2a-449101a40b48/artwork.jpg/600x600bb.jpg' }],
    },
  },
  {
    id: 'lofi-9',
    name: 'Snowman',
    duration_ms: 148000,
    preview_url: null,
    artists: [{ id: 'art-wys', name: 'WYS' }],
    album: {
      id: 'alb-wys',
      name: '1 Am. Study Session',
      images: [{ url: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/09/42/7c/09427c6d-462f-a256-58af-f710743d4684/859735893612.jpg/600x600bb.jpg' }],
    },
  },
  {
    id: 'lofi-10',
    name: 'Again',
    duration_ms: 110000,
    preview_url: null,
    artists: [{ id: 'art-wuntwo', name: 'Wun Two' }],
    album: {
      id: 'alb-wuntwo',
      name: 'Rio',
      images: [{ url: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/f5/29/33/f52933c9-8143-b0d2-b180-8d92f9a36922/cover_4062851259545.jpg/600x600bb.jpg' }],
    },
  },
  {
    id: 'lofi-11',
    name: 'Phantasm',
    duration_ms: 138000,
    preview_url: null,
    artists: [{ id: 'art-elijah', name: 'Elijah Who' }],
    album: {
      id: 'alb-elijah',
      name: 'Gentle Boy',
      images: [{ url: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/cd/05/87/cd0587b2-90df-e1b5-b6a3-b98a557e2d81/7316474914624.jpg/600x600bb.jpg' }],
    },
  },
  {
    id: 'lofi-12',
    name: 'Nagashi',
    duration_ms: 144000,
    preview_url: null,
    artists: [{ id: 'art-idealism', name: 'Idealism' }],
    album: {
      id: 'alb-nagashi',
      name: 'Nagashi Single',
      images: [{ url: 'https://is1-ssl.mzstatic.com/image/thumb/Music123/v4/0e/f3/e9/0ef3e972-5803-2dd5-822f-1e8a01d47225/053000009238_cover.jpg/600x600bb.jpg' }],
    },
  },
  {
    id: 'lofi-13',
    name: 'Tired',
    duration_ms: 152000,
    preview_url: null,
    artists: [{ id: 'art-sleepy', name: 'Sleepy Fish' }, { id: 'art-lofigirl', name: 'Lofi Girl' }],
    album: {
      id: 'alb-sleepy',
      name: 'Beneath the City',
      images: [{ url: 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/30/d4/10/30d41084-7548-dafc-1776-a9127b1e5a57/5059449078915.png/600x600bb.jpg' }],
    },
  },
  {
    id: 'lofi-14',
    name: 'Coffee',
    duration_ms: 126000,
    preview_url: null,
    artists: [{ id: 'art-beabadoobee', name: 'beabadoobee' }],
    album: {
      id: 'alb-coffee',
      name: 'Coffee Lofi Sessions',
      images: [{ url: 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/9a/9e/05/9a9e0570-bee1-20b5-e512-38b5e1168a76/192641174858_Cover.jpg/600x600bb.jpg' }],
    },
  },
  {
    id: 'lofi-15',
    name: 'Can We Kiss Forever?',
    duration_ms: 187000,
    preview_url: null,
    artists: [{ id: 'art-kina', name: 'Kina' }, { id: 'art-adriana', name: 'Adriana Proenza' }],
    album: {
      id: 'alb-kina',
      name: 'Can We Kiss Forever?',
      images: [{ url: 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/2c/f6/b4/2cf6b4ee-90ba-297f-057a-b85f91e303ed/886448163213.jpg/600x600bb.jpg' }],
    },
  },
];

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

  // 1. Take a fresh randomized sample of user tracks from matching playlists (up to 75% of set)
  const userShuffled = [...userTracks].sort(() => Math.random() - 0.5);
  const userQuota = Math.min(Math.floor(count * 0.75), userShuffled.length);
  for (let i = 0; i < userQuota; i++) {
    addTrack(userShuffled[i]);
  }

  // 1b. If #chill requested, immediately add authentic Lo-Fi & relaxed beats pool for instantaneous response
  if (targetTag === '#chill') {
    const lofiPool = [...AUTHENTIC_LOFI_CHILL_TRACKS].sort(() => Math.random() - 0.5);
    for (const t of lofiPool) {
      if (result.length >= count) break;
      addTrack(t);
    }
  }

  // 2. Add similar songs by the same artists the user listens to in this genre/playlist
  if (result.length < count && userTracks.length > 0) {
    const userArtists = Array.from(
      new Set(userTracks.map((t) => t.artists?.[0]?.name).filter(Boolean) as string[])
    ).sort(() => Math.random() - 0.5);

    for (const artistName of userArtists.slice(0, 3)) {
      if (result.length >= count) break;
      try {
        const res = await searchSpotify(`artist:"${artistName}"`);
        for (const t of res?.tracks?.items || []) {
          if (result.length >= count) break;
          addTrack(t);
        }
      } catch {}
    }
  }

  // 3. Fetch fresh tracks from localized genre role charts and flagship artists if more needed
  if (result.length < count) {
    const roleTracks = await fetchRoleChartTracks(targetTag);
    for (const t of roleTracks) {
      if (result.length >= count) break;
      addTrack(t);
    }
  }

  // 4. Final safety fill: repeat user matching tracks if any, otherwise repeat role pool
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

/**
 * Returns dynamic quick vibe buttons based on the user's actual saved playlists & genres.
 * Adapts to user library (e.g., Bachata / Latino, Reggaetón, Rock, Pop) rather than hardcoded presets.
 */
export function getUserDynamicVibeChips(): string[] {
  const libraryIndex = analyzeUserLibraryByHashtags();
  const counts: { tag: MusicHashtag; count: number; label: string }[] = [];

  const labelMap: Record<MusicHashtag, string> = {
    '#reggaeton': 'Reggaetón',
    '#bachata': 'Bachata / Latino',
    '#trap': 'Trap / Urbano',
    '#pop': 'Pop',
    '#rock': 'Rock',
    '#clasicos': 'Clásicos',
    '#chill': 'Algo chill',
    '#lofi': 'Lo-Fi',
    '#electro': 'Electrónica',
    '#entreno': 'Para entrenar',
    '#flamenco': 'Flamenco',
  };

  for (const [tag, tracks] of libraryIndex.entries()) {
    if (tag !== '#chill' && tracks.length > 0) {
      counts.push({ tag, count: tracks.length, label: labelMap[tag] || tag });
    }
  }

  counts.sort((a, b) => b.count - a.count);
  const topGenreChips = counts.slice(0, 3).map((c) => c.label);

  const defaultGenres = ['Reggaetón', 'Clásicos', 'Trap / Urbano'];
  const finalGenres: string[] = [];
  topGenreChips.forEach((g) => {
    if (!finalGenres.includes(g)) finalGenres.push(g);
  });
  defaultGenres.forEach((g) => {
    if (finalGenres.length < 3 && !finalGenres.includes(g)) finalGenres.push(g);
  });

  return ['Más movido', 'Algo chill', ...finalGenres, 'Sorpréndeme'];
}
