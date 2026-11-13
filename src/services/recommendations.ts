/**
 * src/services/recommendations.ts
 *
 * Feature F17: Daily Rotating Playlist Recommendations
 * Rotates community and public playlists daily on the home feed using
 * date-seeded deterministic hashing, genre diversity balancing,
 * live community search enrichment, and resilient local storage caching.
 */

import type { DynamicShelf, DynamicShelfCard } from '../store/useSpotifyDataStore';
import { searchSpotify } from './spotifyApi';

/**
 * Returns formatted calendar day stamp (YYYY-MM-DD)
 */
export function todayRecommendationKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * 32-bit FNV-1a deterministic hash algorithm
 */
export function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Deterministic pseudo-random shuffle (Fisher-Yates with LCG)
 */
export function seededShuffle<T>(items: T[], seed: number): T[] {
  const out = items.slice();
  let s = seed || 1;
  const rand = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export interface CuratedRecommendationEntry {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  genre: 'urban_latin' | 'pop_charts' | 'rock_indie' | 'discovery_new' | 'chill_electronic';
  owner?: string;
}

/**
 * High-diversity pool of curated, verified public & community Spotify playlists
 */
export const CURATED_RECOMMENDATION_POOL: CuratedRecommendationEntry[] = [
  // Urban & Latin Hits
  {
    id: '37i9dQZF1DWZdsS73T1ogG',
    title: 'el nuevo urbano',
    subtitle: 'Lo último del trap, reggaeton y música urbana española e internacional.',
    image: 'https://i.scdn.co/image/ab67706f00000002acc0778b688c66b07afc5426',
    genre: 'urban_latin',
  },
  {
    id: '37i9dQZF1DX10zKzsJ2jva',
    title: 'Viva Latino',
    subtitle: 'El corazón y la energía de los mayores éxitos de la música latina.',
    image: 'https://i.scdn.co/image/ab67706f00000002964880811c74069be12f02b5',
    genre: 'urban_latin',
  },
  {
    id: '37i9dQZF1DX8SfyweGQcsQ',
    title: 'Mansión Reggaeton',
    subtitle: 'El sonido oficial del perreo y los hits de reggaeton más sonados.',
    image: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/b1/e2/3f/b1e23f6e-29ba-c816-cd4a-2f995c19a25d/886447345481.jpg/600x600bb.jpg',
    genre: 'urban_latin',
  },
  // Pop & Charts
  {
    id: '37i9dQZEVXbNFJfN1Vw8d9',
    title: 'Top 50: España',
    subtitle: 'Tu actualización diaria de los temas más escuchados en España.',
    image: 'https://charts-images.scdn.co/assets/locale_en/regional/daily/region_es_default.jpg',
    genre: 'pop_charts',
  },
  {
    id: '37i9dQZF1DXcBWIGoYBM5M',
    title: 'Éxitos España',
    subtitle: 'Los temas más reproducidos y las canciones del momento en España.',
    image: 'https://i.scdn.co/image/ab67706f00000002e8ccdd567fff6a597b87586b',
    genre: 'pop_charts',
  },
  {
    id: '37i9dQZEVXbMDoHDwVN2tF',
    title: 'Top 50: Global',
    subtitle: 'Tu actualización diaria de las canciones más escuchadas en todo el mundo.',
    image: 'https://charts-images.scdn.co/assets/locale_en/regional/daily/region_global_default.jpg',
    genre: 'pop_charts',
  },
  {
    id: '37i9dQZF1EQncLwOalG3K7',
    title: 'Pop con Ñ',
    subtitle: 'El mejor pop actual cantado en nuestro idioma.',
    image: 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/33/87/c8/3387c827-adaa-681d-bd10-ce7d8e888b9c/22UMGIM21054.rgb.jpg/600x600bb.jpg',
    genre: 'pop_charts',
  },
  {
    id: '37i9dQZEVXbLiRSasKsNU9',
    title: 'Top Canciones: Viral España',
    subtitle: 'Las canciones y audios que se están viralizando con más fuerza.',
    image: 'https://charts-images.scdn.co/assets/locale_en/viral/daily/region_es_default.jpg',
    genre: 'pop_charts',
  },
  {
    id: '37i9dQZF1DXbYM3nMM0oPk',
    title: 'Mega Pop',
    subtitle: 'Los grandes éxitos globales del pop contemporáneo.',
    image: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/b8/02/bd/b802bd1d-c601-74a9-c194-b2fea8d5ed1b/5026854930541.jpg/600x600bb.jpg',
    genre: 'pop_charts',
  },
  // Rock, Clásicos & Indie
  {
    id: '37i9dQZF1DX2EiUAL7Wdfc',
    title: 'míticas',
    subtitle: 'Canciones imprescindibles que nunca pasarán de moda.',
    image: 'https://i.scdn.co/image/ab67706f000000022072b736ac89da8c376e3fe6',
    genre: 'rock_indie',
  },
  {
    id: '37i9dQZF1DWXRqgorJj26U',
    title: 'Rock Classics',
    subtitle: 'Grandes himnos y leyendas que definieron la historia del rock.',
    image: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/3d/ac/6a/3dac6a5f-d4be-32c6-6e4a-c7a79fe5bfd9/715187754720.png/600x600bb.jpg',
    genre: 'rock_indie',
  },
  {
    id: '37i9dQZF1DX9qNs32f2WzD',
    title: 'Rock en Español',
    subtitle: 'Las guitarras más potentes y míticas del rock hispano.',
    image: 'https://is1-ssl.mzstatic.com/image/thumb/Music114/v4/53/f3/fc/53f3fccd-2024-789e-8858-c9562cc1edfa/886449216321.jpg/600x600bb.jpg',
    genre: 'rock_indie',
  },
  {
    id: '37i9dQZF1DX9tBL39mXN61',
    title: 'Indie Español',
    subtitle: 'Sonidos frescos, independientes y alternativos de la escena actual.',
    image: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/69/49/f1/6949f1a9-db34-b9cb-4e58-6321d007c79b/artwork.jpg/600x600bb.jpg',
    genre: 'rock_indie',
  },
  // Discovery & New Music
  {
    id: '37i9dQZEVXcQ9NknPpJyRU',
    title: 'Descubrimiento Semanal',
    subtitle: 'Joyas ocultas y recomendaciones musicales seleccionadas para ti.',
    image: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/4a/b8/51/4ab851d0-7c24-2406-6647-d6622f99d39b/199066743287.jpg/600x600bb.jpg',
    genre: 'discovery_new',
  },
  {
    id: '37i9dQZEVXbxJjY5x43H57',
    title: 'Radar de Novedades',
    subtitle: 'Los últimos lanzamientos de los artistas que están despuntando.',
    image: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/42/dd/bb/42ddbb2d-ff39-cf04-7667-2872e77a6ca7/197338933862.jpg/600x600bb.jpg',
    genre: 'discovery_new',
  },
  {
    id: '37i9dQZF1DX6PYajiT4pAf',
    title: 'Novedades Viernes España',
    subtitle: 'Los estrenos y canciones más destacadas que acaban de publicarse.',
    image: 'https://i.scdn.co/image/ab67706f00000002eaecef062c2877a5c0f5f10e',
    genre: 'discovery_new',
  },
  // Chill, Electronic & Focus
  {
    id: '37i9dQZF1DWWQRwui0ExPn',
    title: 'Chill & Focus',
    subtitle: 'Ritmos instrumentales, lo-fi y melodías para máxima concentración.',
    image: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/d1/f9/69/d1f96944-7177-481f-8da9-12283cee8db1/196006235529.jpg/600x600bb.jpg',
    genre: 'chill_electronic',
  },
  {
    id: '37i9dQZF1DX4dyzvuaRJ0n',
    title: 'Electro Beats',
    subtitle: 'Lo más potente de la electrónica, dance y house de clubbing.',
    image: 'https://is1-ssl.mzstatic.com/image/thumb/Music/v4/f1/74/df/f174df13-f2f9-51ad-0801-5a0168f0a1c5/cover.jpg/600x600bb.jpg',
    genre: 'chill_electronic',
  },
  {
    id: '37i9dQZF1DWZeKCadgRdKQ',
    title: 'Deep Focus',
    subtitle: 'Paisajes sonoros y sintetizadores envolventes para trabajar sin distracciones.',
    image: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=600&auto=format&fit=crop&q=80',
    genre: 'chill_electronic',
  },
  {
    id: '37i9dQZF1DX3rxVfibe1L0',
    title: 'Café de la Mañana',
    subtitle: 'Acústico y melodías suaves para acompañar un buen café.',
    image: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=600&auto=format&fit=crop&q=80',
    genre: 'chill_electronic',
  },
];

/**
 * Daily community search queries rotated by day seed
 */
const COMMUNITY_ROTATING_QUERIES = [
  'mejores playlists comunidad',
  'éxitos de fiesta',
  'descubrimiento semanal',
  'top canciones 2026',
  'temazos del momento',
  'reggaeton hits verano',
  'rock alternativo joyas',
  'chillout instrumental lo-fi',
  'gym workout motivation',
  'acústico relajante',
  'grandes clásicos de siempre',
  'indie pop emergente',
];

const LOCAL_STORAGE_CACHE_KEY_PREFIX = 'spotifree_daily_recs_';

/**
 * Generates balanced, date-seeded curated cards with genre diversity
 */
export function getDailyRotatingPlaylists(date = new Date(), count = 8): DynamicShelfCard[] {
  const day = todayRecommendationKey(date);
  const baseSeed = hashSeed(day);

  // Group pool by genre
  const byGenre: Record<string, CuratedRecommendationEntry[]> = {
    urban_latin: [],
    pop_charts: [],
    rock_indie: [],
    discovery_new: [],
    chill_electronic: [],
  };

  CURATED_RECOMMENDATION_POOL.forEach((item) => {
    byGenre[item.genre]?.push(item);
  });

  const selected: CuratedRecommendationEntry[] = [];
  const genres = Object.keys(byGenre);

  // Pick deterministically 1-2 from each genre bucket using offset seed
  genres.forEach((genre, gIdx) => {
    const pool = byGenre[genre];
    if (!pool || pool.length === 0) return;
    const shuffled = seededShuffle(pool, baseSeed + (gIdx + 1) * 31337);
    selected.push(shuffled[0]);
    if (selected.length < count && shuffled.length > 1 && (baseSeed + gIdx) % 2 === 0) {
      selected.push(shuffled[1]);
    }
  });

  // If still below desired count, fill from overall pool
  if (selected.length < count) {
    const seenIds = new Set(selected.map((s) => s.id));
    const remaining = seededShuffle(
      CURATED_RECOMMENDATION_POOL.filter((p) => !seenIds.has(p.id)),
      baseSeed + 99991
    );
    for (const item of remaining) {
      selected.push(item);
      if (selected.length >= count) break;
    }
  }

  // Final seeded shuffle to interleave genres naturally
  const finalEntries = seededShuffle(selected.slice(0, count), baseSeed + 4242);

  return finalEntries.map((entry) => ({
    id: entry.id,
    title: entry.title,
    subtitle: entry.subtitle,
    image: entry.image,
  }));
}

/**
 * Builds the synchronous daily rotating shelf for instant home feed rendering
 */
export function buildDailyRotatingShelf(date = new Date()): DynamicShelf {
  const cards = getDailyRotatingPlaylists(date, 8);
  return {
    id: 'shelf-daily-recommendations',
    title: 'Recomendaciones del día',
    prefix: 'Para hoy',
    subtitle: 'Listas recomendadas rotativas según tus gustos y la comunidad',
    type: 'featured',
    hasSeeAll: true,
    cards,
  };
}

/**
 * Asynchronously fetches and enriches daily shelves with live community playlists.
 * Falls back safely to buildDailyRotatingShelf on any network/API failure.
 */
export async function fetchDailyRotatingShelves(date = new Date()): Promise<DynamicShelf[]> {
  const day = todayRecommendationKey(date);
  const cacheKey = `${LOCAL_STORAGE_CACHE_KEY_PREFIX}${day}`;

  // 1. Check local storage cache
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(cacheKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.day === day && Array.isArray(parsed?.shelves) && parsed.shelves.length > 0) {
          return parsed.shelves;
        }
      }
    } catch {}
  }

  const baseShelf = buildDailyRotatingShelf(date);
  const curatedCards = [...baseShelf.cards];
  const seenIds = new Set(curatedCards.map((c) => c.id));

  // 2. Query live community playlists based on day seed
  try {
    const queryIdx = hashSeed(day) % COMMUNITY_ROTATING_QUERIES.length;
    const query = COMMUNITY_ROTATING_QUERIES[queryIdx];
    const liveData = await searchSpotify(query).catch(() => null);

    const liveItems = liveData?.playlists?.items || [];
    const communityCards: DynamicShelfCard[] = [];

    for (const item of liveItems) {
      if (!item?.id || item.id.startsWith('search-') || seenIds.has(item.id)) continue;
      const image = item.images?.[0]?.url;
      if (!image) continue;

      seenIds.add(item.id);
      communityCards.push({
        id: item.id,
        title: item.name,
        subtitle: item.description?.replace(/<[^>]+>/g, '') || (item.owner?.display_name ? `De ${item.owner.display_name}` : 'Playlist de la comunidad'),
        image,
      });

      if (communityCards.length >= 4) break;
    }

    if (communityCards.length > 0) {
      const mergedShelf: DynamicShelf = {
        ...baseShelf,
        cards: [...curatedCards.slice(0, 5), ...communityCards, ...curatedCards.slice(5)],
      };

      const result = [mergedShelf];
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(cacheKey, JSON.stringify({ day, shelves: result }));
        } catch {}
      }
      return result;
    }
  } catch (err) {
    console.warn('[Recommendations] Failed to enrich with live community search, using curated pool fallback:', err);
  }

  return [baseShelf];
}
