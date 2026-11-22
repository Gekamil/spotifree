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
import { usePlayerStore } from '../store/usePlayerStore';
import { searchSpotify } from './spotifyApi';
import { isNonMusicOrNoise, filterMusicTracksOnly } from '../utils/trackFilter';
import { getCustomLikedSongs } from '../utils/userStorage';
import { isStrictArtistMatch, parseArtistNames, trackMatchesArtist } from '../utils/trackArtists';
import { resolveClientSideRealFeature, calculateHarmonicCompatibility } from '../utils/audioFeatures';
import { isNotInterested } from '../utils/notInterested';
import { isTrackDisliked } from './labsService';

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
  | '#flamenco'
  | '#indie'
  | '#corridos'
  | '#rnb';

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
      'ryan castro', 'blessd', 'saiko', 'sech', 'chencho corleone', 'chencho',
      'zion & lennox', 'zion y lennox', 'zion', 'lennox', 'wisin & yandel', 'wisin y yandel',
      'wisin', 'yandel', 'j balvin', 'maluma', 'cris mj', 'floyymenor', 'floyy menor',
      'el alfa', 'farruko', 'nicky jam', 'arcangel', 'arcángel', 'justin quiles',
      'de la ghetto', 'bryant myers', 'noriel', 'lunay', 'alvaro diaz', 'álvaro díaz',
      'young miko', 'bad gyal', 'tokischa', 'natti natasha', 'becky g', 'manuel turizo',
      'dei v', 'gonzy', 'jc reyes', 'el taiger', 'chimbala', 'rochy rd', 'darell',
      'lenny tavarez', 'lenny tavárez', 'dalex', 'jay wheeler', 'tainy', 'ovy on the drums',
      'sky rompiendo', 'chris jedi', 'gaby music', 'calle 13', 'residente', 'tito el bambino',
      'hector el father', 'alexis & fido', 'j alvarez', 'cosculluela', 'maldy', 'omar montes'
    ],
  },
  '#trap': {
    tag: '#trap',
    deezerGenreId: 116, // Rap/Hip Hop
    itunesGenreId: 18,  // Hip-Hop/Rap
    artists: [
      'duki', 'trueno', 'milo j', 'eladio carrion', 'eladio carrión', 'bizarrap', 'bzrp',
      'c.r.o', 'cro', 'ysy a', 'khea', 'tiago pzk', 'lit killah', 'travis scott',
      'central cee', '21 savage', 'future', 'metro boomin', 'pop smoke', 'drake',
      'kendrick lamar', 'kanye west', 'eminem', 'lil baby', 'gunna', 'playboi carti',
      'post malone', 'juice wrld', 'xxxtentacion', 'nf', 'j. cole', 'j cole',
      'a$ap rocky', 'asap rocky', 'lil uzi vert', 'mac miller', '50 cent', 'snoop dogg',
      '2pac', 'tupac', 'dr. dre', 'dr dre', 'the notorious b.i.g.', 'notorious big',
      'biggie', 'wiz khalifa', 'young thug', 'ty dolla $ign', 'jack harlow', 'don toliver',
      'roddy ricch', 'dababy', 'lil wayne', 'polo g', 'lil nas x', 'trippie redd',
      'morad', 'beny jr', 'delaossa', 'foyone', 'ayax y prok', 'natos y waor',
      'fernandocosta', 'kaydy cain', 'neo pistea', 'bhavi'
    ],
  },
  '#rock': {
    tag: '#rock',
    deezerGenreId: 152, // Rock
    itunesGenreId: 21,  // Rock
    artists: [
      'queen', 'nirvana', 'guns n roses', 'guns n\' roses', 'ac/dc', 'acdc', 'bon jovi',
      'red hot chili peppers', 'the killers', 'linkin park', 'metallica', 'foo fighters',
      'green day', 'arctic monkeys', 'muse', 'radiohead', 'blink-182', 'blink 182',
      'oasis', 'coldplay', 'imagine dragons', 'maneskin', 'måneskin', 'the strokes',
      'gorillaz', 'u2', 'aerosmith', 'led zeppelin', 'pink floyd', 'the beatles',
      'the rolling stones', 'system of a down', 'soad', 'rammstein', 'slipknot',
      'bring me the horizon', 'bmth', 'twenty one pilots', 'the offspring',
      'avenged sevenfold', 'audioslave', 'pearl jam', 'soundgarden', 'deftones',
      'papa roach', 'three days grace', 'fall out boy', 'paramore', 'evanescence',
      'my chemical romance', 'iron maiden', 'judas priest', 'black sabbath',
      'ozzy osbourne', 'scorpions', 'deep purple', 'the clash', 'the cure', 'the police',
      'dire straits', 'estopa', 'melendi', 'fito & fitipaldis', 'fito y fitipaldis',
      'marea', 'extremoduro', 'leiva', 'pereza', 'los rodriguez', 'los rodríguez',
      'jarabe de palo', 'heroes del silencio', 'héroes del silencio', 'platero y tu',
      'ska-p', 'bunbury', 'soda stereo', 'gustavo cerati', 'enrique bunbury',
      'los fabulosos cadillacs', 'los prisioneros', 'maná', 'mana', 'andres calamaro',
      'andrés calamaro', 'charly garcia', 'fito paez'
    ],
  },
  '#indie': {
    tag: '#indie',
    deezerGenreId: 85, // Alternative
    itunesGenreId: 20, // Alternative
    artists: [
      'arctic monkeys', 'the 1975', 'tame impala', 'the neighbourhood', 'lana del rey',
      'billie eilish', 'lorde', 'florence + the machine', 'florence and the machine',
      'foster the people', 'glass animals', 'phoenix', 'two door cinema club',
      'mgmt', 'vampire weekend', 'foals', 'the xx', 'arcade fire', 'the black keys',
      'cage the elephant', 'wallows', 'boy pablo', 'clairo', 'mac demarco',
      'beabadoobee', 'rex orange county', 'steve lacy', 'dominic fike',
      'vetusta morla', 'love of lesbian', 'lori meyers', 'izal', 'shinova',
      'viva suecia', 'arde bogota', 'arde bogotá', 'carolina durante', 'cupido',
      'sen senra', 'alizzz', 'guitarricadelafuente', 'dorian', 'la m.o.d.a.',
      'la moda', 'sidonie', 'zahara', 'ginebras', 'rusowsky', 'ralphie choo'
    ],
  },
  '#pop': {
    tag: '#pop',
    deezerGenreId: 132, // Pop
    itunesGenreId: 14,  // Pop
    artists: [
      'taylor swift', 'dua lipa', 'sabrina carpenter', 'olivia rodrigo', 'ariana grande',
      'harry styles', 'ed sheeran', 'justin bieber', 'bruno mars', 'katy perry',
      'rihanna', 'beyonce', 'beyoncé', 'lady gaga', 'miley cyrus', 'shawn mendes',
      'selena gomez', 'camila cabello', 'charlie puth', 'adele', 'sia', 'sam smith',
      'maroon 5', 'onerepublic', 'tate mcrae', 'chappell roan', 'lizzo', 'doja cat',
      'shakira', 'aitana', 'rosalia', 'rosalía', 'tini', 'emilia', 'lola indigo',
      'lola índigo', 'ana mena', 'morat', 'sebastian yatra', 'sebastián yatra',
      'camilo', 'beret', 'pablo alboran', 'pablo alborán', 'alvaro de luna',
      'álvaro de luna', 'dani martin', 'dani martín', 'david bisbal', 'manuel carrasco',
      'alejandro sanz', 'antonio orozco', 'malu', 'malú', 'vanesa martin', 'pablo lopez',
      'chayanne', 'luis fonsi', 'ricky martin', 'enrique iglesias', 'belinda'
    ],
  },
  '#electro': {
    tag: '#electro',
    deezerGenreId: 113, // Dance
    itunesGenreId: 17,  // Dance
    artists: [
      'calvin harris', 'david guetta', 'tiesto', 'tiësto', 'avicii', 'martin garrix',
      'marshmello', 'alok', 'fisher', 'fred again', 'fred again..', 'skrillex',
      'swedish house mafia', 'daft punk', 'kygo', 'the chainsmokers', 'zedd',
      'alan walker', 'armin van buuren', 'hardwell', 'peggy gou', 'rufus du sol',
      'rüfüs du sol', 'bicep', 'disclosure', 'deadmau5', 'dj snake',
      'dimitri vegas & like mike', 'steve aoki', 'afrojack', 'kshmr', 'galantis',
      'lost frequencies', 'robin schulz', 'oliver heldens', 'meduza', 'major lazer',
      'jax jones', 'duke dumont', 'anyma', 'tale of us', 'camelphat', 'john summit',
      'dom dolla', 'boris brejcha', 'charlotte de witte', 'amelie lens', 'eric prydz',
      'fatboy slim'
    ],
  },
  '#corridos': {
    tag: '#corridos',
    deezerGenreId: 197, // Latino
    itunesGenreId: 12,  // Latino
    artists: [
      'peso pluma', 'natanael cano', 'fuerza regida', 'junior h', 'carin leon',
      'carín león', 'christian nodal', 'grupo frontera', 'eslabon armado',
      'oscar maydon', 'gabito ballesteros', 'chicho castro', 'luis r conriquez',
      'tito double p', 'xavi', 'marca registrada', 'calibre 50', 'los dos carnales',
      'los tucanes de tijuana', 'los tigres del norte', 'banda ms', 'la arrolladora',
      'gerardo ortiz', 'alfredo olivas', 'julion alvarez', 'edén muñoz', 'eden muñoz'
    ],
  },
  '#bachata': {
    tag: '#bachata',
    deezerGenreId: 197, // Latino
    itunesGenreId: 12,  // Latino
    artists: [
      'romeo santos', 'prince royce', 'aventura', 'juan luis guerra', 'anthony santos',
      'frank reyes', 'zacarias ferreira', 'zacarías ferreira', 'henry santos',
      'daniel santacruz', 'monchy & alexandra', 'elvis martinez', 'luis vargas',
      'joe veras', 'raulin rodriguez', 'raulín rodríguez', 'kiko rodriguez',
      'marc anthony', 'gilberto santa rosa', 'grupo niche', 'hector lavoe',
      'héctor lavoe', 'willie colon', 'ruben blades', 'celia cruz'
    ],
  },
  '#flamenco': {
    tag: '#flamenco',
    deezerGenreId: 197, // Latino
    itunesGenreId: 12,  // Latino
    artists: [
      'c. tangana', 'c tangana', 'delaossa', 'jc reyes', 'camin', 'maka',
      'el bobe', 'morad', 'beny jr', 'kaydy cain', 'rosalia', 'rosalía',
      'camaron de la isla', 'camarón de la isla', 'paco de lucia', 'paco de lucía',
      'los chichos', 'los chunguitos', 'ketama', 'antonio carmona', 'nina pastori',
      'niña pastori', 'estrella morente', 'diego el cigala', 'kiko veneno',
      'pitingo', 'jose merce', 'josé mercé', 'fondo flamenco', 'dellafuente',
      'moncho chavea', 'original elias'
    ],
  },
  '#rnb': {
    tag: '#rnb',
    deezerGenreId: 165, // R&B
    itunesGenreId: 15,  // R&B/Soul
    artists: [
      'the weeknd', 'sza', 'frank ocean', 'brent faiyaz', 'daniel caesar',
      'giveon', 'steve lacy', 'h.e.r.', 'her', 'khalid', 'alicia keys',
      'john legend', 'summer walker', 'bryson tiller', 'partynextdoor',
      'miguel', 'chris brown', 'usher', 'ne-yo', 'mariah carey'
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
      'purrple cat', 'mell-ø', 'nohidea', 'stan forebee', 'invention_', 'yiruma',
      'norah jones', 'jack johnson', 'bon iver', 'iron & wine', 'sufjan stevens',
      'vance joy', 'passenger'
    ],
  },
  '#lofi': {
    tag: '#lofi',
    deezerGenreId: 85, // Alternativo / Ambient
    itunesGenreId: 20, // Alternative
    artists: [
      'chilledcow', 'lofi girl', 'ludovico einaudi', 'yiruma', 'idealism', 'jinsang',
      'potsu', 'kudasaibeats', 'the deli', 'tomppabeats', 'wun two', 'sleepy fish'
    ],
  },
  '#clasicos': {
    tag: '#clasicos',
    deezerGenreId: 152, // Classic Rock & Pop
    itunesGenreId: 21,  // Classic Rock
    artists: [
      'michael jackson', 'madonna', 'abba', 'elton john', 'elthon john', 'george michael',
      'camilo sesto', 'rocio durcal', 'rocío dúrcal', 'julio iglesias', 'hombres g',
      'alaska', 'queen', 'mecano', 'los secretos', 'radio futura', 'duncan dhu',
      'la union', 'la unión', 'phil collins', 'stevie wonder', 'whitney houston',
      'bee gees', 'earth wind & fire', 'cyndi lauper', 'wham!', 'prince',
      'david bowie', 'fleetwood mac', 'bruce springsteen', 'billy joel', 'toto'
    ],
  },
  '#entreno': {
    tag: '#entreno',
    deezerGenreId: 116, // Rap & High energy
    itunesGenreId: 18,  // Hip-Hop
    artists: [
      'duki', 'eladio carrion', 'travis scott', 'eminem', 'neffex', 'ghostemane',
      'bizarrap', 'kordhell', 'playaphonk', 'interworld', 'tevvez', 'zyzz',
      'hardstyle mafia', 'scarlxrd', 'twenty one pilots', 'skillet', 'survivor'
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
 * Classifies a track into internal music hashtags based on artist roles,
 * semantic acoustic cues, audio features and genre characteristics.
 * Strictly prevents substring leakage and never defaults blindly to #pop.
 */
export function classifyTrackHashtags(track: Track): MusicHashtag[] {
  if (!track || !track.id) return ['#pop'];

  const cacheKey = track.id;
  if (TRACK_HASHTAG_CACHE.has(cacheKey)) {
    return TRACK_HASHTAG_CACHE.get(cacheKey)!;
  }

  const rawArtists = (track.artists || []).map((a) => (a.name || '').trim()).filter(Boolean);
  const parsedArtists: string[] = [];
  for (const art of rawArtists) {
    parsedArtists.push(...parseArtistNames(art));
  }
  const artistsStr = parsedArtists.map((a) => a.toLowerCase()).join(' ');
  const titleStr = (track.name || '').toLowerCase();
  const albumStr = (track.album?.name || '').toLowerCase();
  const fullText = `${artistsStr} ${titleStr} ${albumStr}`;
  const matchedTags = new Set<MusicHashtag>();

  // 1. High-confidence Artist Role Match with strict artist boundary checking
  for (const [tag, def] of Object.entries(HASHTAG_DEFINITIONS) as [MusicHashtag, HashtagDefinition][]) {
    for (const art of def.artists) {
      if (
        parsedArtists.some((a) => isStrictArtistMatch(a, art)) ||
        artistsStr === art ||
        artistsStr.startsWith(art + ' ') ||
        artistsStr.endsWith(' ' + art) ||
        artistsStr.includes(' ' + art + ' ')
      ) {
        matchedTags.add(tag);
        break;
      }
    }
  }

  // 2. Specific acoustic, rhythmic or genre cues in title, album or track
  if (matchedTags.size === 0) {
    if (/perreo|dembow|bellakeo|bellaqueo|sandungueo|reggaeton/i.test(fullText)) {
      matchedTags.add('#reggaeton');
    } else if (/drill|barras|subgrave|phonk|cypher|freestyle|diss|trap/i.test(fullText)) {
      matchedTags.add('#trap');
    } else if (/guitar|rock|metal|punk|hardcore|grunge|heavy metal|riff/i.test(fullText)) {
      matchedTags.add('#rock');
    } else if (/corrido|corridos|belico|bélico|tumbado|ranchera|banda|norteño/i.test(fullText)) {
      matchedTags.add('#corridos');
    } else if (/bachata|salsa|merengue|cumbia|tropical/i.test(fullText)) {
      matchedTags.add('#bachata');
    } else if (/lo-fi|lofi|ambient|sleep beats|study beats|chillhop|piano solo|rain beats/i.test(fullText)) {
      matchedTags.add('#lofi');
      matchedTags.add('#chill');
    } else if (/club mix|extended mix|edm|techno|house mix|trance|dnb|drum and bass|synthwave/i.test(fullText)) {
      matchedTags.add('#electro');
    } else if (/flamenco|buleria|bulería|rumba|alegrias/i.test(fullText)) {
      matchedTags.add('#flamenco');
    } else if (/r&b|rnb|soul|neo-soul/i.test(fullText)) {
      matchedTags.add('#rnb');
    } else if (/indie|alternativ|shoegaze|dream pop/i.test(fullText)) {
      matchedTags.add('#indie');
    }
  }

  // 3. Audio feature heuristics (measured tempo & energy characteristics)
  try {
    const feat = resolveClientSideRealFeature(track.id, track.name, track.artists?.[0]?.name);
    if (matchedTags.size === 0 && feat && feat.tempo > 0) {
      if (feat.tempo >= 124 && feat.tempo <= 135) {
        matchedTags.add('#electro');
      } else if (feat.tempo >= 88 && feat.tempo <= 104) {
        matchedTags.add('#reggaeton');
      } else if (feat.tempo < 80) {
        matchedTags.add('#chill');
      }
    }
  } catch {}

  // 4. Strict guard for #chill against high-energy, perreo or trap tracks
  if (matchedTags.has('#chill')) {
    if (
      /reggaeton|perreo|bellakeo|dembow|trap|drill|phonk|techno|edm|rave|hardcore|party|fiesta/i.test(fullText) ||
      /bad bunny|feid|anuel|eladio|duki|karol g/i.test(artistsStr)
    ) {
      matchedTags.delete('#chill');
    }
  }

  // 5. Intelligent Fallback: never blindly assign everything to #pop
  if (matchedTags.size === 0) {
    if (/guitar|banda|live session|en vivo|acustico|acústico/i.test(fullText)) {
      matchedTags.add('#rock');
    } else if (titleStr.includes('remix') || titleStr.includes('feat') || titleStr.includes('ft.')) {
      matchedTags.add('#reggaeton');
    } else {
      // Direct fast fallback to #pop without recursive library analysis
      matchedTags.add('#pop');
    }
  }

  const result = Array.from(matchedTags);
  TRACK_HASHTAG_CACHE.set(cacheKey, result);
  return result;
}

// In-memory cache for library hashtag analysis to guarantee 0ms instant response on UI mount
let cachedLibraryIndex: Map<MusicHashtag, Track[]> | null = null;
let lastLibraryIndexTime = 0;
let cachedDominantTag: MusicHashtag = '#pop';
let lastDominantTagTime = 0;

/**
 * Returns the dominant music hashtag across the user's library
 */
export function getDominantUserHashtag(): MusicHashtag {
  const now = Date.now();
  if (cachedDominantTag && now - lastDominantTagTime < 30000) {
    return cachedDominantTag;
  }
  const library = analyzeUserLibraryByHashtags();
  let maxCount = 0;
  let dominant: MusicHashtag = '#pop';
  for (const [tag, tracks] of library.entries()) {
    if (tracks.length > maxCount) {
      maxCount = tracks.length;
      dominant = tag;
    }
  }
  cachedDominantTag = dominant;
  lastDominantTagTime = now;
  return dominant;
}

/**
 * Analyzes the user's entire library of playlists, player history, and liked songs
 * and builds an internal index of tracks grouped by hashtags.
 */
export function analyzeUserLibraryByHashtags(): Map<MusicHashtag, Track[]> {
  const now = Date.now();
  if (cachedLibraryIndex && now - lastLibraryIndexTime < 30000) {
    return cachedLibraryIndex;
  }
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

  // 1. Scan player history (the actual songs the user is listening to)
  try {
    const history = usePlayerStore.getState().history || [];
    history.forEach(processTrack);
  } catch {}

  // 2. Scan playlists in cache and store
  Object.values(playlistDetailsCache).forEach((pl: any) => {
    pl?.tracks?.items?.forEach(processTrack);
  });
  playlists.forEach((p) => {
    p.tracks?.items?.forEach(processTrack);
  });

  // 3. Scan locally imported and liked songs
  if (typeof window !== 'undefined') {
    try {
      const local = JSON.parse(window.localStorage.getItem('user_imported_playlists') || '[]');
      local.forEach((p: any) => p?.tracks?.items?.forEach(processTrack));
      const liked = getCustomLikedSongs();
      liked.forEach(processTrack);
    } catch {}
  }

  cachedLibraryIndex = index;
  lastLibraryIndexTime = Date.now();
  return index;
}

/**
 * Resolves the primary hashtag from a user prompt or vibe description
 */
export function resolveHashtagFromPrompt(prompt: string): MusicHashtag {
  const p = prompt.toLowerCase();

  // If user says "sorpréndeme" / "sorpresa" / "aleatorio", pick a diverse genre that changes the vibe genuinely
  if (/sorpr[eé]ndeme|sorpresa|aleatorio|random|otra\s+cosa|cambiar?\s+(de\s+)?rollo/i.test(p)) {
    const surpriseTags: MusicHashtag[] = [
      '#pop', '#reggaeton', '#electro', '#rock', '#indie', '#chill',
      '#trap', '#clasicos', '#entreno', '#corridos', '#bachata', '#lofi'
    ];
    return surpriseTags[Math.floor(Math.random() * surpriseTags.length)];
  }

  if (/descubrimiento|novedades|recomendaciones/i.test(p)) {
    const discoveryTags: MusicHashtag[] = ['#indie', '#trap', '#electro', '#pop', '#chill', '#rock'];
    return discoveryTags[Math.floor(Math.random() * discoveryTags.length)];
  }

  if (/\bpop\b|pop\s+actual/i.test(p)) return '#pop';
  if (/rock|guitarra|metal|punk|heavy|estopa|melendi|fito/i.test(p)) return '#rock';
  if (/indie|alternativ|vetusta|lori|morat/i.test(p)) return '#indie';
  if (/electro|techno|house|edm|dance|rave|electr[oó]nica/i.test(p)) return '#electro';
  if (/chill|relax|tranquil|calma|suave|acustico|desconectar/i.test(p)) return '#chill';
  if (/clasic|cl[aá]sicos|recuerdo|antigu|80|90|2000/i.test(p)) return '#clasicos';
  if (/estudiar|concentra|lofi|piano|trabajar|enfoque/i.test(p)) return '#lofi';
  if (/gym|entreno|entrenar|pesas|fuerza|cardio/i.test(p)) return '#entreno';
  if (/reggaeton|perreo|bailar|fiesta|dembow|bellakeo|urbano|latino/i.test(p)) return '#reggaeton';
  if (/trap|drill|phonk|barras|duro/i.test(p)) return '#trap';
  if (/bachata|romeo|aventura|royce/i.test(p)) return '#bachata';
  if (/corrido|mexic|belic|bélico|tumbado|peso pluma|junior h/i.test(p)) return '#corridos';
  if (/r&b|rnb|soul|the weeknd/i.test(p)) return '#rnb';
  if (/flamenco|tangana|delaossa|maka/i.test(p)) return '#flamenco';
  if (/exitos|éxitos|top/i.test(p)) return '#pop';

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
    if (isNonMusicOrNoise(t)) return;
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

export const AUTHENTIC_FLAGSHIP_TRACKS: Record<MusicHashtag, Track[]> = {
  '#reggaeton': [
    {
      id: 'rg-la-inocente',
      name: 'LA INOCENTE',
      duration_ms: 204000,
      preview_url: null,
      artists: [{ id: 'art-mora', name: 'Mora' }, { id: 'art-feid', name: 'Feid' }],
      album: { id: 'alb-microdosis', name: 'MICRODOSIS', images: [{ url: 'https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/bf/82/10/bf82103f-91a5-8667-8349-6bb117a2db12/8445162483841.jpg/600x600bb.jpg' }] },
    },
    {
      id: 'rg-luna',
      name: 'LUNA',
      duration_ms: 196000,
      preview_url: null,
      artists: [{ id: 'art-feid', name: 'Feid' }, { id: 'art-atljacob', name: 'ATL Jacob' }],
      album: { id: 'alb-ferxxo', name: 'FERXXOCALIPSIS', images: [{ url: 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/08/94/a5/0894a500-1111-96f7-4dc7-4ef86cb493c4/23UM1G430882.rgb.jpg/600x600bb.jpg' }] },
    },
    {
      id: 'rg-columbia',
      name: 'Columbia',
      duration_ms: 186000,
      preview_url: null,
      artists: [{ id: 'art-quevedo', name: 'Quevedo' }],
      album: { id: 'alb-columbia', name: 'Columbia', images: [{ url: 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/e0/75/ca/e075ca33-28f9-4b68-ca4e-a9ff44b61184/5054197726593.jpg/600x600bb.jpg' }] },
    },
    {
      id: 'rg-titi',
      name: 'Tití Me Preguntó',
      duration_ms: 243000,
      preview_url: null,
      artists: [{ id: 'art-badbunny', name: 'Bad Bunny' }],
      album: { id: 'alb-uvst', name: 'Un Verano Sin Ti', images: [{ url: 'https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/34/00/22/3400224d-0453-2b62-c163-f2ee96057c7b/196626945068.jpg/600x600bb.jpg' }] },
    },
    {
      id: 'rg-lala',
      name: 'LALA',
      duration_ms: 197000,
      preview_url: null,
      artists: [{ id: 'art-myketowers', name: 'Myke Towers' }],
      album: { id: 'alb-lala', name: 'LA VIDA ES UNA', images: [{ url: 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/7e/17/dc/7e17dc17-8a6c-9a4f-566d-fcbcf2175053/197188730999.jpg/600x600bb.jpg' }] },
    },
    {
      id: 'rg-todo-de-ti',
      name: 'Todo de Ti',
      duration_ms: 199000,
      preview_url: null,
      artists: [{ id: 'art-rauw', name: 'Rauw Alejandro' }],
      album: { id: 'alb-viceversa', name: 'VICE VERSA', images: [{ url: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/a4/09/b3/a409b3fc-fa4e-eeeb-21ca-3a6d7f022ef6/886449339327.jpg/600x600bb.jpg' }] },
    },
  ],
  '#rock': [
    {
      id: 'rk-in-the-end',
      name: 'In the End',
      duration_ms: 216000,
      preview_url: null,
      artists: [{ id: 'art-linkinpark', name: 'Linkin Park' }],
      album: { id: 'alb-hybridtheory', name: 'Hybrid Theory', images: [{ url: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/91/92/ff/9192ffae-b51f-508b-b830-ec6f5b9d363d/093624898160.jpg/600x600bb.jpg' }] },
    },
    {
      id: 'rk-smells-teen',
      name: 'Smells Like Teen Spirit',
      duration_ms: 301000,
      preview_url: null,
      artists: [{ id: 'art-nirvana', name: 'Nirvana' }],
      album: { id: 'alb-nevermind', name: 'Nevermind', images: [{ url: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/4a/01/a0/4a01a086-64cc-60db-46f3-6d0c41097241/00602527779089.rgb.jpg/600x600bb.jpg' }] },
    },
    {
      id: 'rk-californication',
      name: 'Californication',
      duration_ms: 329000,
      preview_url: null,
      artists: [{ id: 'art-rhcp', name: 'Red Hot Chili Peppers' }],
      album: { id: 'alb-californication', name: 'Californication', images: [{ url: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/7c/e8/1a/7ce81a54-681b-5e98-38bb-f421fec8618e/093624738626.jpg/600x600bb.jpg' }] },
    },
    {
      id: 'rk-boulevard',
      name: 'Boulevard of Broken Dreams',
      duration_ms: 262000,
      preview_url: null,
      artists: [{ id: 'art-greenday', name: 'Green Day' }],
      album: { id: 'alb-americanidiot', name: 'American Idiot', images: [{ url: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/10/72/71/1072714c-1e24-ff57-ca56-f25b290df6aa/093624877769.jpg/600x600bb.jpg' }] },
    },
    {
      id: 'rk-mr-brightside',
      name: 'Mr. Brightside',
      duration_ms: 222000,
      preview_url: null,
      artists: [{ id: 'art-killers', name: 'The Killers' }],
      album: { id: 'alb-hotfuss', name: 'Hot Fuss', images: [{ url: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/80/7e/fa/807efa8e-8db4-89c0-e7df-57fa23126be1/00602498622119.rgb.jpg/600x600bb.jpg' }] },
    },
    {
      id: 'rk-do-i-wanna-know',
      name: 'Do I Wanna Know?',
      duration_ms: 272000,
      preview_url: null,
      artists: [{ id: 'art-arcticmonkeys', name: 'Arctic Monkeys' }],
      album: { id: 'alb-am', name: 'AM', images: [{ url: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/7c/49/71/7c4971c2-d5a2-3f11-7eb9-2ec828d15c70/887828031795.png/600x600bb.jpg' }] },
    },
  ],
  '#trap': [
    {
      id: 'tr-givenchy',
      name: 'GIVENCHY',
      duration_ms: 188000,
      preview_url: null,
      artists: [{ id: 'art-duki', name: 'Duki' }],
      album: { id: 'alb-givenchy', name: 'GIVENCHY', images: [{ url: 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/33/c9/44/33c9447e-8557-48f8-3e9a-471a25d2b1f8/196871146762.jpg/600x600bb.jpg' }] },
    },
    {
      id: 'tr-mbappe',
      name: 'Mbappé',
      duration_ms: 198000,
      preview_url: null,
      artists: [{ id: 'art-eladio', name: 'Eladio Carrión' }],
      album: { id: 'alb-sen2kbron', name: 'SEN2 KBRN VOL. 2', images: [{ url: 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/a4/09/78/a409787a-55ba-4161-002f-b4b967dcffce/197187123990.jpg/600x600bb.jpg' }] },
    },
    {
      id: 'tr-rara-vez',
      name: 'Rara Vez',
      duration_ms: 194000,
      preview_url: null,
      artists: [{ id: 'art-miloj', name: 'Milo J' }, { id: 'art-taipei', name: 'Taiu' }],
      album: { id: 'alb-raravez', name: 'Rara Vez', images: [{ url: 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/28/69/ae/2869aee6-8575-3b9e-64c8-c92c556b6b7a/197188206128.jpg/600x600bb.jpg' }] },
    },
    {
      id: 'tr-sicko-mode',
      name: 'SICKO MODE',
      duration_ms: 312000,
      preview_url: null,
      artists: [{ id: 'art-travisscott', name: 'Travis Scott' }, { id: 'art-drake', name: 'Drake' }],
      album: { id: 'alb-astroworld', name: 'ASTROWORLD', images: [{ url: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/8e/3c/6f/8e3c6fd5-8bb2-bc23-a178-ee2b8812c3e1/886447239476.jpg/600x600bb.jpg' }] },
    },
    {
      id: 'tr-lose-yourself',
      name: 'Lose Yourself',
      duration_ms: 326000,
      preview_url: null,
      artists: [{ id: 'art-eminem', name: 'Eminem' }],
      album: { id: 'alb-curtaincall', name: 'Curtain Call', images: [{ url: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/b9/a2/a6/b9a2a6ea-800a-42c2-75d3-8f0a0e5b7c7b/00602498878936.rgb.jpg/600x600bb.jpg' }] },
    },
  ],
  '#corridos': [
    {
      id: 'cr-ella-baila-sola',
      name: 'Ella Baila Sola',
      duration_ms: 165000,
      preview_url: null,
      artists: [{ id: 'art-eslabon', name: 'Eslabon Armado' }, { id: 'art-pesopluma', name: 'Peso Pluma' }],
      album: { id: 'alb-desvelado', name: 'DESVELADO', images: [{ url: 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/1f/26/50/1f26503b-d242-a040-3fc1-91ea835dcb62/197338304919_cover.jpg/600x600bb.jpg' }] },
    },
    {
      id: 'cr-harley-quinn',
      name: 'HARLEY QUINN',
      duration_ms: 143000,
      preview_url: null,
      artists: [{ id: 'art-fuerzaregida', name: 'Fuerza Regida' }, { id: 'art-marshmello', name: 'Marshmello' }],
      album: { id: 'alb-papasitos', name: 'Pa Las Baby’s y Belikeada', images: [{ url: 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/7f/7a/ff/7f7afff8-7440-9118-2ad3-21c6ffb6070a/197189737195.jpg/600x600bb.jpg' }] },
    },
    {
      id: 'cr-un-x100to',
      name: 'un x100to',
      duration_ms: 194000,
      preview_url: null,
      artists: [{ id: 'art-grupofrontera', name: 'Grupo Frontera' }, { id: 'art-badbunny', name: 'Bad Bunny' }],
      album: { id: 'alb-elcomienzo', name: 'El Comienzo', images: [{ url: 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/1e/8a/15/1e8a1562-97b7-e23e-63f2-1a48c66ba1cf/197188701975.jpg/600x600bb.jpg' }] },
    },
    {
      id: 'cr-primera-cita',
      name: 'Primera Cita',
      duration_ms: 184000,
      preview_url: null,
      artists: [{ id: 'art-carinleon', name: 'Carin Leon' }],
      album: { id: 'alb-colmillo', name: 'Colmillo de Leche', images: [{ url: 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/14/66/cb/1466cb9e-5bb6-79ba-b1f4-5f5043aa9f7f/197188611113.jpg/600x600bb.jpg' }] },
    },
  ],
  '#indie': [
    {
      id: 'in-less-i-know',
      name: 'The Less I Know The Better',
      duration_ms: 216000,
      preview_url: null,
      artists: [{ id: 'art-tameimpala', name: 'Tame Impala' }],
      album: { id: 'alb-currents', name: 'Currents', images: [{ url: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/2b/43/69/2b4369e8-3ea0-5c3c-0ff6-4d2d477e68ad/00602547306777.rgb.jpg/600x600bb.jpg' }] },
    },
    {
      id: 'in-somebody-else',
      name: 'Somebody Else',
      duration_ms: 347000,
      preview_url: null,
      artists: [{ id: 'art-1975', name: 'The 1975' }],
      album: { id: 'alb-ilikeit', name: 'I like it when you sleep', images: [{ url: 'https://is1-ssl.mzstatic.com/image/thumb/Music114/v4/18/88/54/1888540c-1579-2ef5-a50e-a507f38290fa/00602547672285.rgb.jpg/600x600bb.jpg' }] },
    },
    {
      id: 'in-los-perros',
      name: 'Los Perros',
      duration_ms: 198000,
      preview_url: null,
      artists: [{ id: 'art-ardebogota', name: 'Arde Bogotá' }],
      album: { id: 'alb-cowboys', name: 'Cowboys de la A3', images: [{ url: 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/37/10/7c/37107c1b-b46d-3171-ec3f-c9321591f17e/196589993356.jpg/600x600bb.jpg' }] },
    },
    {
      id: 'in-copenhague',
      name: 'Copenhague',
      duration_ms: 284000,
      preview_url: null,
      artists: [{ id: 'art-vetustamorla', name: 'Vetusta Morla' }],
      album: { id: 'alb-undiaenel', name: 'Un Día en el Mundo', images: [{ url: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/58/01/fa/5801fa62-246e-1d5f-b5dc-d68f27666ee3/8437008779018.jpg/600x600bb.jpg' }] },
    },
  ],
  '#pop': [
    {
      id: 'po-cruel-summer',
      name: 'Cruel Summer',
      duration_ms: 178000,
      preview_url: null,
      artists: [{ id: 'art-taylorswift', name: 'Taylor Swift' }],
      album: { id: 'alb-lover', name: 'Lover', images: [{ url: 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/a4/09/96/a40996fc-ecf0-fb81-19d8-c116499318a7/19UMGIM68665.rgb.jpg/600x600bb.jpg' }] },
    },
    {
      id: 'po-espresso',
      name: 'Espresso',
      duration_ms: 175000,
      preview_url: null,
      artists: [{ id: 'art-sabrinacarpenter', name: 'Sabrina Carpenter' }],
      album: { id: 'alb-shortnsweet', name: 'Short n’ Sweet', images: [{ url: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/d4/0b/c8/d40bc8c6-669c-2975-d142-261f951e737c/24UMGIM52313.rgb.jpg/600x600bb.jpg' }] },
    },
    {
      id: 'po-houdini',
      name: 'Houdini',
      duration_ms: 185000,
      preview_url: null,
      artists: [{ id: 'art-dualipa', name: 'Dua Lipa' }],
      album: { id: 'alb-radicaloptimism', name: 'Radical Optimism', images: [{ url: 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/55/e8/35/55e8354c-e83c-1121-6548-dc81d77b0682/5054197941071.jpg/600x600bb.jpg' }] },
    },
    {
      id: 'po-despecha',
      name: 'DESPECHÁ',
      duration_ms: 157000,
      preview_url: null,
      artists: [{ id: 'art-rosalia', name: 'ROSALÍA' }],
      album: { id: 'alb-motomamiplus', name: 'MOTOMAMI +', images: [{ url: 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/10/89/3e/10893ec4-469a-6ca6-75bb-11a511f5fe07/886449909247.jpg/600x600bb.jpg' }] },
    },
  ],
  '#electro': [
    {
      id: 'el-the-nights',
      name: 'The Nights',
      duration_ms: 176000,
      preview_url: null,
      artists: [{ id: 'art-avicii', name: 'Avicii' }],
      album: { id: 'alb-thenights', name: 'The Days / The Nights', images: [{ url: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/80/7e/fa/807efa8e-8db4-89c0-e7df-57fa23126be1/00602498622119.rgb.jpg/600x600bb.jpg' }] },
    },
    {
      id: 'el-summer',
      name: 'Summer',
      duration_ms: 222000,
      preview_url: null,
      artists: [{ id: 'art-calvinharris', name: 'Calvin Harris' }],
      album: { id: 'alb-motion', name: 'Motion', images: [{ url: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/93/94/a4/9394a46d-97e3-0599-270e-3fa145882b7d/886444855266.jpg/600x600bb.jpg' }] },
    },
    {
      id: 'el-titanium',
      name: 'Titanium',
      duration_ms: 245000,
      preview_url: null,
      artists: [{ id: 'art-davidguetta', name: 'David Guetta' }, { id: 'art-sia', name: 'Sia' }],
      album: { id: 'alb-nothingbut', name: 'Nothing But the Beat', images: [{ url: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/21/df/b5/21dfb5c7-1282-e565-d602-0e54fe055b8e/5099908389552.jpg/600x600bb.jpg' }] },
    },
    {
      id: 'el-animals',
      name: 'Animals',
      duration_ms: 304000,
      preview_url: null,
      artists: [{ id: 'art-martingarrix', name: 'Martin Garrix' }],
      album: { id: 'alb-animals', name: 'Animals - Single', images: [{ url: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/64/0a/61/640a618e-5b12-3023-ff2a-f97e68407fc3/00888072049093.rgb.jpg/600x600bb.jpg' }] },
    },
  ],
  '#bachata': [
    {
      id: 'ba-propuesta-indecente',
      name: 'Propuesta Indecente',
      duration_ms: 235000,
      preview_url: null,
      artists: [{ id: 'art-romeosantos', name: 'Romeo Santos' }],
      album: { id: 'alb-formula2', name: 'Formula, Vol. 2', images: [{ url: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/7e/6b/ba/7e6bba84-56b0-6425-6366-ee5c0a0c493c/886444390507.jpg/600x600bb.jpg' }] },
    },
    {
      id: 'ba-darte-un-beso',
      name: 'Darte un Beso',
      duration_ms: 206000,
      preview_url: null,
      artists: [{ id: 'art-princeroyce', name: 'Prince Royce' }],
      album: { id: 'alb-soyelmismo', name: 'Soy el Mismo', images: [{ url: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/91/df/3f/91df3ff2-520e-fc8a-21cb-42a447814470/886444199995.jpg/600x600bb.jpg' }] },
    },
    {
      id: 'ba-obsesion',
      name: 'Obsesión',
      duration_ms: 254000,
      preview_url: null,
      artists: [{ id: 'art-aventura', name: 'Aventura' }],
      album: { id: 'alb-werebroke', name: 'We Broke the Rules', images: [{ url: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/10/d4/21/10d421e4-ea77-fba2-8ef7-7b8307db3bb7/886443729902.jpg/600x600bb.jpg' }] },
    },
    {
      id: 'ba-la-bachata',
      name: 'La Bachata',
      duration_ms: 162000,
      preview_url: null,
      artists: [{ id: 'art-manuelturizo', name: 'Manuel Turizo' }],
      album: { id: 'alb-2000', name: '2000', images: [{ url: 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/12/3c/a2/123ca2a3-f141-86a0-5ce8-89c565251c89/196589947939.jpg/600x600bb.jpg' }] },
    },
  ],
  '#flamenco': [
    {
      id: 'fl-tu-me-dejaste',
      name: 'Tú Me Dejaste De Querer',
      duration_ms: 197000,
      preview_url: null,
      artists: [{ id: 'art-ctangana', name: 'C. Tangana' }, { id: 'art-ninapastori', name: 'Niña Pastori' }],
      album: { id: 'alb-elmadrideno', name: 'El Madrileño', images: [{ url: 'https://is1-ssl.mzstatic.com/image/thumb/Music114/v4/8e/3c/6f/8e3c6fd5-8bb2-bc23-a178-ee2b8812c3e1/886447239476.jpg/600x600bb.jpg' }] },
    },
    {
      id: 'fl-el-arte-vivir',
      name: 'El Arte de Vivir',
      duration_ms: 228000,
      preview_url: null,
      artists: [{ id: 'art-maka', name: 'Maka' }],
      album: { id: 'alb-elartedevivir', name: 'El Arte de Vivir', images: [{ url: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/84/cb/78/84cb7883-fa50-f8be-c3be-fc98a83a0058/8429006095697.jpg/600x600bb.jpg' }] },
    },
    {
      id: 'fl-pelele',
      name: 'Pelele',
      duration_ms: 152000,
      preview_url: null,
      artists: [{ id: 'art-morad', name: 'Morad' }],
      album: { id: 'alb-pelele', name: 'Pelele', images: [{ url: 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/4a/12/38/4a1238dc-cb0f-f1bb-3f7a-f9037a3b34b6/artwork.jpg/600x600bb.jpg' }] },
    },
  ],
  '#rnb': [
    {
      id: 'rb-blinding-lights',
      name: 'Blinding Lights',
      duration_ms: 200000,
      preview_url: null,
      artists: [{ id: 'art-theweeknd', name: 'The Weeknd' }],
      album: { id: 'alb-afterhours', name: 'After Hours', images: [{ url: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/cb/96/12/cb961239-cf44-42b7-a871-3a25ef1f6aa3/20UMGIM10243.rgb.jpg/600x600bb.jpg' }] },
    },
    {
      id: 'rb-kill-bill',
      name: 'Kill Bill',
      duration_ms: 153000,
      preview_url: null,
      artists: [{ id: 'art-sza', name: 'SZA' }],
      album: { id: 'alb-sos', name: 'SOS', images: [{ url: 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/b4/09/b3/b409b3fc-fa4e-eeeb-21ca-3a6d7f022ef6/886449339327.jpg/600x600bb.jpg' }] },
    },
  ],
  '#clasicos': [
    {
      id: 'cl-billie-jean',
      name: 'Billie Jean',
      duration_ms: 294000,
      preview_url: null,
      artists: [{ id: 'art-michaeljackson', name: 'Michael Jackson' }],
      album: { id: 'alb-thriller', name: 'Thriller', images: [{ url: 'https://is1-ssl.mzstatic.com/image/thumb/Music128/v4/e5/22/a8/e522a84e-2895-35c8-1033-68d6f51930b2/074643811224.jpg/600x600bb.jpg' }] },
    },
    {
      id: 'cl-dancing-queen',
      name: 'Dancing Queen',
      duration_ms: 231000,
      preview_url: null,
      artists: [{ id: 'art-abba', name: 'ABBA' }],
      album: { id: 'alb-arrival', name: 'Arrival', images: [{ url: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/6c/02/75/6c02758d-7360-15ef-77e8-e7379d799017/00602537841189.rgb.jpg/600x600bb.jpg' }] },
    },
    {
      id: 'cl-devuelveme',
      name: 'Devuélveme a mi chica',
      duration_ms: 196000,
      preview_url: null,
      artists: [{ id: 'art-hombresg', name: 'Hombres G' }],
      album: { id: 'alb-hombresg', name: 'Hombres G', images: [{ url: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/10/d4/21/10d421e4-ea77-fba2-8ef7-7b8307db3bb7/886443729902.jpg/600x600bb.jpg' }] },
    },
  ],
  '#chill': AUTHENTIC_LOFI_CHILL_TRACKS,
  '#lofi': AUTHENTIC_LOFI_CHILL_TRACKS,
  '#entreno': [
    {
      id: 'en-murder-mind',
      name: 'Murder In My Mind',
      duration_ms: 145000,
      preview_url: null,
      artists: [{ id: 'art-kordhell', name: 'Kordhell' }],
      album: { id: 'alb-murdermind', name: 'Murder In My Mind', images: [{ url: 'https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/64/0a/61/640a618e-5b12-3023-ff2a-f97e68407fc3/00888072049093.rgb.jpg/600x600bb.jpg' }] },
    },
    {
      id: 'en-fight-back',
      name: 'Fight Back',
      duration_ms: 196000,
      preview_url: null,
      artists: [{ id: 'art-neffex', name: 'NEFFEX' }],
      album: { id: 'alb-fightback', name: 'Fight Back', images: [{ url: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/a4/09/b3/a409b3fc-fa4e-eeeb-21ca-3a6d7f022ef6/886449339327.jpg/600x600bb.jpg' }] },
    },
  ],
};

/**
 * Curates songs matching the specified internal hashtag/role:
 * - Dynamically extracts a balanced mix from the user's matching playlists & history
 * - Injects authentic genre flagship tracks so the vibe is guaranteed
 * - Discovers peer artists from the live catalog
 * - Ranks candidates by harmonic compatibility and tempo proximity to seed track
 * - Strictly prevents artist duplication and off-genre contamination
 */
export async function getCuratedSetForHashtag(
  targetTag: MusicHashtag,
  count: number = 15,
  excludeTrackIds: Set<string> = new Set(),
  seedTrack?: Track
): Promise<Track[]> {
  const libraryIndex = analyzeUserLibraryByHashtags();
  const userTracks = (libraryIndex.get(targetTag) || []).filter((t) => !excludeTrackIds.has(t.id));

  const result: Track[] = [];
  const seen = new Set<string>(excludeTrackIds);
  const seedArtist = seedTrack?.artists?.[0]?.name;

  const addTrack = (t: Track) => {
    if (!t || !t.id || seen.has(t.id)) return false;
    if (isGenericTitleMatch(t.name, targetTag)) return false;
    if (isNonMusicOrNoise(t)) return false;
    if (isNotInterested(t) || isTrackDisliked(t)) return false;

    // Do not recommend the exact same artist as the seed track (maintain artist variety)
    if (seedArtist && trackMatchesArtist(t, seedArtist)) {
      return false;
    }

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

  // 1. Take a fresh randomized sample of user tracks from matching playlists (up to 40% of set)
  const userShuffled = [...userTracks].sort(() => Math.random() - 0.5);
  const userQuota = Math.min(Math.floor(count * 0.4), userShuffled.length);
  for (let i = 0; i < userQuota; i++) {
    addTrack(userShuffled[i]);
  }

  // 2. Add authentic flagship genre tracks for instantaneous genre coherence
  const flagshipPool = AUTHENTIC_FLAGSHIP_TRACKS[targetTag] || [];
  const shuffledFlagship = [...flagshipPool].sort(() => Math.random() - 0.5);
  for (const t of shuffledFlagship) {
    if (result.length >= count) break;
    addTrack(t);
  }

  // 3. Add fresh verified chart tracks from official localized charts for real discovery variety
  if (result.length < count) {
    try {
      const chartTracks = await fetchRoleChartTracks(targetTag);
      for (const t of chartTracks.sort(() => Math.random() - 0.5)) {
        if (result.length >= count) break;
        addTrack(t);
      }
    } catch {}
  }

  // 4. Add similar songs by peer artists of this genre from the catalog
  if (result.length < count) {
    const genreDef = HASHTAG_DEFINITIONS[targetTag];
    if (genreDef?.artists?.length) {
      const candidateArtists = [...genreDef.artists]
        .filter((a) => !seedArtist || !isStrictArtistMatch(a, seedArtist))
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);

      for (const artistName of candidateArtists) {
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
  }

  // 4. Harmonic & Tempo Re-ranking if seedTrack is provided
  if (seedTrack && result.length > 1) {
    try {
      const seedFeat = resolveClientSideRealFeature(seedTrack.id, seedTrack.name, seedArtist);
      result.sort((a, b) => {
        const featA = resolveClientSideRealFeature(a.id, a.name, a.artists?.[0]?.name);
        const featB = resolveClientSideRealFeature(b.id, b.name, b.artists?.[0]?.name);
        const harmA = calculateHarmonicCompatibility(seedFeat.camelot, featA.camelot).score;
        const harmB = calculateHarmonicCompatibility(seedFeat.camelot, featB.camelot).score;
        const bpmDiffA = Math.abs(seedFeat.tempo - featA.tempo);
        const bpmDiffB = Math.abs(seedFeat.tempo - featB.tempo);
        const scoreA = harmA - bpmDiffA * 0.35;
        const scoreB = harmB - bpmDiffB * 0.35;
        return scoreB - scoreA;
      });
    } catch {}
  } else if (!seedTrack) {
    result.sort(() => Math.random() - 0.5);
  }

  return result.slice(0, count);
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
    '#rock': 'Rock',
    '#indie': 'Indie / Alternativo',
    '#corridos': 'Corridos & Regional',
    '#pop': 'Pop',
    '#electro': 'Electrónica',
    '#rnb': 'R&B / Soul',
    '#clasicos': 'Clásicos',
    '#chill': 'Algo chill',
    '#lofi': 'Lo-Fi',
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

/**
 * Initial DJ Set Remix:
 * - 70-80% directly from user's own playlists and liked songs
 * - 20-30% similar tracks by the EXACT SAME artists present in user's library
 * - 100% personalized, never inserts random foreign tracks or generic charts
 */
export async function getInitialDJLibraryRemix(count: number = 15): Promise<Track[]> {
  const { playlists, playlistDetailsCache } = useSpotifyDataStore.getState();
  const allUserTracks: Track[] = [];
  const seenIds = new Set<string>();

  const collect = (t: Track) => {
    if (!t || !t.id || seenIds.has(t.id)) return;
    seenIds.add(t.id);
    allUserTracks.push(t);
  };

  // 1. Collect tracks from player history (actual recent listens)
  try {
    const history = usePlayerStore.getState().history || [];
    history.forEach(collect);
  } catch {}

  Object.values(playlistDetailsCache).forEach((pl: any) => {
    pl?.tracks?.items?.forEach(collect);
  });
  playlists.forEach((p) => {
    p.tracks?.items?.forEach(collect);
  });

  if (typeof window !== 'undefined') {
    try {
      const local = JSON.parse(window.localStorage.getItem('user_imported_playlists') || '[]');
      local.forEach((p: any) => p?.tracks?.items?.forEach(collect));
      const liked = getCustomLikedSongs();
      liked.forEach(collect);
    } catch {}
  }

  // If user has tracks in their library:
  if (allUserTracks.length > 0) {
    const shuffledUser = [...allUserTracks].sort(() => Math.random() - 0.5);
    // Instant return if user already has enough tracks, avoiding slow network searches
    if (shuffledUser.length >= count) {
      return filterMusicTracksOnly(shuffledUser).slice(0, count);
    }
    const userQuota = Math.min(Math.floor(count * 0.75), shuffledUser.length);
    const result: Track[] = shuffledUser.slice(0, userQuota);
    const resultSetIds = new Set(result.map((t) => t.id));

    // Fill remaining slots with songs from the exact same artists in parallel with timeout to avoid multi-second freezes
    const userArtists = Array.from(
      new Set(allUserTracks.map((t) => t.artists?.[0]?.name).filter(Boolean) as string[])
    ).sort(() => Math.random() - 0.5);

    const searchPromises = userArtists.slice(0, 4).map(async (artist) => {
      try {
        const searchPromise = searchSpotify(`artist:"${artist}"`);
        const timeoutPromise = new Promise<null>((r) => setTimeout(() => r(null), 1200));
        const res = await Promise.race([searchPromise, timeoutPromise]);
        return (res as any)?.tracks?.items || [];
      } catch {
        return [];
      }
    });
    const searchResults = await Promise.all(searchPromises);
    for (const items of searchResults) {
      for (const t of items) {
        if (result.length >= count) break;
        if (!resultSetIds.has(t.id)) {
          resultSetIds.add(t.id);
          result.push(t);
        }
      }
    }

    // Safety fill with remaining user tracks if needed
    for (const t of shuffledUser) {
      if (result.length >= count) break;
      if (!resultSetIds.has(t.id)) {
        resultSetIds.add(t.id);
        result.push(t);
      }
    }

    return filterMusicTracksOnly(result).slice(0, count).sort(() => Math.random() - 0.5);
  }

  // Fallback to dominant hashtag if library is completely empty
  const dominantTag = getDominantUserHashtag();
  return getCuratedSetForHashtag(dominantTag, count);
}
