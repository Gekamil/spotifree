/**
 * "Explorar todo" categories change every day: the curated playlists of each category are
 * reshuffled with the date, and two live searches (picked by date from the category's own
 * list of searches) add playlists that weren't there yesterday. Cached for the day.
 */
import { useEffect, useState } from 'react';
import { CATEGORY_HUBS, type HubCard, type HubShelf } from '../data/categoryHubs';
import { searchSpotify } from './spotifyApi';

/** Searches per category: two of them are used each day */
const CATEGORY_SEARCHES: Record<string, Array<{ q: string; title: string }>> = {
  'cat-musica': [
    { q: 'éxitos del momento', title: 'Éxitos del momento' },
    { q: 'música para el día', title: 'Para acompañar tu día' },
    { q: 'top canciones', title: 'Top canciones' },
    { q: 'novedades', title: 'Lo más nuevo' },
    { q: 'clásicos', title: 'Clásicos de siempre' },
    { q: 'chill', title: 'Para relajarse' },
  ],
  'cat-eventos': [
    { q: 'en directo', title: 'En directo' },
    { q: 'festival', title: 'Ambiente de festival' },
    { q: 'live concierto', title: 'Grandes conciertos' },
    { q: 'acústico', title: 'Versiones acústicas' },
  ],
  'cat-para-ti': [
    { q: 'mix', title: 'Mixes para ti' },
    { q: 'descubrimiento', title: 'Descubre algo nuevo' },
    { q: 'favoritas', title: 'Tus favoritas' },
    { q: 'radio', title: 'Radios' },
  ],
  'cat-novedades': [
    { q: 'novedades viernes', title: 'Novedades del viernes' },
    { q: 'nuevos lanzamientos', title: 'Nuevos lanzamientos' },
    { q: 'new music', title: 'New music' },
    { q: 'estrenos', title: 'Estrenos' },
  ],
  'cat-latina': [
    { q: 'latino', title: 'Lo mejor latino' },
    { q: 'reggaeton', title: 'Reggaeton' },
    { q: 'bachata', title: 'Bachata' },
    { q: 'salsa', title: 'Salsa' },
    { q: 'cumbia', title: 'Cumbia' },
    { q: 'merengue', title: 'Merengue' },
  ],
  'cat-pop': [
    { q: 'pop', title: 'Pop' },
    { q: 'pop español', title: 'Pop en español' },
    { q: 'pop hits', title: 'Pop hits' },
    { q: 'pop dosmil', title: 'Pop de los 2000' },
    { q: 'k-pop', title: 'K-Pop' },
  ],
  'cat-rock': [
    { q: 'rock', title: 'Rock' },
    { q: 'rock clásico', title: 'Rock clásico' },
    { q: 'rock en español', title: 'Rock en español' },
    { q: 'metal', title: 'Metal' },
    { q: 'punk', title: 'Punk' },
  ],
  'cat-futbol': [
    { q: 'fútbol', title: 'Para el partido' },
    { q: 'himnos', title: 'Himnos' },
    { q: 'motivación', title: 'Motivación' },
    { q: 'workout', title: 'A tope' },
  ],
  'cat-listas': [
    { q: 'top 50', title: 'Top 50' },
    { q: 'viral', title: 'Virales' },
    { q: 'top hits', title: 'Top hits' },
    { q: 'éxitos', title: 'Éxitos' },
  ],
  'cat-urbano': [
    { q: 'urbano', title: 'Urbano' },
    { q: 'trap', title: 'Trap' },
    { q: 'reggaeton', title: 'Reggaeton' },
    { q: 'dembow', title: 'Dembow' },
    { q: 'rap español', title: 'Rap en español' },
  ],
  'cat-indie': [
    { q: 'indie', title: 'Indie' },
    { q: 'indie español', title: 'Indie español' },
    { q: 'alternativo', title: 'Alternativo' },
    { q: 'indie folk', title: 'Indie folk' },
  ],
  'cat-dance': [
    { q: 'dance', title: 'Dance' },
    { q: 'electrónica', title: 'Electrónica' },
    { q: 'house', title: 'House' },
    { q: 'techno', title: 'Techno' },
    { q: 'edm', title: 'EDM' },
  ],
  'cat-descubrir': [
    { q: 'descubrir', title: 'Por descubrir' },
    { q: 'joyas ocultas', title: 'Joyas ocultas' },
    { q: 'nuevos artistas', title: 'Nuevos artistas' },
    { q: 'radar', title: 'En el radar' },
  ],
};

/** Local date, e.g. 2026-11-08: the hub changes when the day changes */
export function todayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededShuffle<T>(items: T[], seed: number): T[] {
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

/** The curated shelves of a category, reshuffled for the day (no network) */
export function curatedShelvesForDay(categoryId: string, day = todayKey()): HubShelf[] {
  const shelves = (CATEGORY_HUBS[categoryId] || CATEGORY_HUBS['cat-musica']).shelves;
  const seed = hashString(`${categoryId}:${day}`);
  return seededShuffle(
    shelves.map((s, i) => ({ title: s.title, cards: seededShuffle(s.cards, seed + i * 7919) })),
    seed
  );
}

/** The two searches used for a category on a given day */
export function searchesForDay(categoryId: string, day = todayKey()) {
  const list = CATEGORY_SEARCHES[categoryId] || CATEGORY_SEARCHES['cat-musica'];
  const start = hashString(day) % list.length;
  return [list[start], list[(start + 1) % list.length]].filter((x, i, a) => a.indexOf(x) === i);
}

const CACHE_PREFIX = 'spotifree_cat_hub_';

async function liveShelves(categoryId: string, day: string, exclude: Set<string>): Promise<HubShelf[]> {
  const shelves: HubShelf[] = [];
  for (const s of searchesForDay(categoryId, day)) {
    try {
      const data = await searchSpotify(s.q);
      const items: any[] = data?.playlists?.items || [];
      const cards: HubCard[] = [];
      for (const p of items) {
        // Skip the placeholder "This Is / Mix / Radio" cards built when nothing was found
        if (!p?.id || /^search-(pl|mix|radio)-/.test(p.id) || exclude.has(p.id)) continue;
        const image = p.images?.[0]?.url;
        if (!image) continue;
        exclude.add(p.id);
        cards.push({
          id: p.id,
          title: p.name,
          subtitle: p.description?.replace(/<[^>]+>/g, '') || (p.owner?.display_name ? `De ${p.owner.display_name}` : 'Playlist'),
          image,
        });
        if (cards.length >= 10) break;
      }
      if (cards.length >= 3) shelves.push({ title: s.title, cards: seededShuffle(cards, hashString(`${day}:${s.q}`)) });
    } catch {}
  }
  return shelves;
}

/** Today's shelves for a category: curated (reshuffled) first, then today's live picks */
export async function getDailyCategoryHub(categoryId: string): Promise<HubShelf[]> {
  const day = todayKey();
  const key = `${CACHE_PREFIX}${categoryId}`;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw) {
      const cached = JSON.parse(raw);
      if (cached?.day === day && Array.isArray(cached.shelves)) return cached.shelves;
    }
  } catch {}
  const curated = curatedShelvesForDay(categoryId, day);
  const seen = new Set(curated.flatMap((s) => s.cards.map((c) => c.id)));
  const live = await liveShelves(categoryId, day, seen);
  const shelves = [...curated.slice(0, 1), ...live, ...curated.slice(1)];
  if (live.length > 0) {
    try {
      window.localStorage.setItem(key, JSON.stringify({ day, shelves }));
    } catch {}
  }
  return shelves;
}

/** Shelves for a category: today's curated order right away, live picks when they arrive */
export function useDailyCategoryHub(categoryId: string | null | undefined): HubShelf[] {
  const [shelves, setShelves] = useState<HubShelf[]>(() => (categoryId ? curatedShelvesForDay(categoryId) : []));
  useEffect(() => {
    if (!categoryId) {
      setShelves([]);
      return;
    }
    let alive = true;
    setShelves(curatedShelvesForDay(categoryId));
    getDailyCategoryHub(categoryId).then((s) => {
      if (alive && s.length) setShelves(s);
    });
    return () => {
      alive = false;
    };
  }, [categoryId]);
  return shelves;
}
