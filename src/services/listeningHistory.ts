import type { Track } from '../types/spotify';
import { useSpotifyDataStore } from '../store/useSpotifyDataStore';
import { TRACK_COVER_CACHE } from '../utils/trackCovers';
import { getPlaylistCover } from '../utils/playlistCover';

export interface HistoryItem {
  id: string;
  name: string;
  subtitle?: string;
  image?: string;
  type: 'track' | 'playlist' | 'album' | 'artist';
  playedAt: number; // timestamp ms
  track?: Track;
}

const STORAGE_KEY_PREFIX = 'spotifree_play_history';

function getKey(userId?: string | null): string {
  const uid = userId || (typeof window !== 'undefined' ? window.localStorage.getItem('spotifree_active_user_id') : '') || 'default';
  return `${STORAGE_KEY_PREFIX}_${uid}`;
}

export function getListeningHistory(): HistoryItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(getKey());
    if (raw) {
      const items: HistoryItem[] = JSON.parse(raw);
      if (Array.isArray(items) && items.length > 0) return items;
    }
  } catch {}

  // Initial seed from store's recentlyPlayed if empty
  const seeded = seedFromStore();
  if (seeded.length > 0) {
    try {
      window.localStorage.setItem(getKey(), JSON.stringify(seeded));
    } catch {}
    return seeded;
  }

  return [];
}

function seedFromStore(): HistoryItem[] {
  const items: HistoryItem[] = [];
  const now = Date.now();
  const dayMs = 86400000;

  try {
    const recents = useSpotifyDataStore.getState().recentlyPlayed || [];
    recents.forEach((item: any, idx: number) => {
      const track = item.track || item;
      if (!track || !track.id) return;
      // Stagger timestamps across today and yesterday for realistic grouping
      const playedAt = item.played_at ? new Date(item.played_at).getTime() : now - idx * (3600000 * 3);
      const trackImg = track.album?.images?.[0]?.url || TRACK_COVER_CACHE.get(track.id) || '';
      items.push({
        id: track.id,
        name: track.name || 'Canción',
        subtitle: track.artists?.[0]?.name ? `Canción • ${track.artists[0].name}` : 'Canción',
        image: trackImg,
        type: 'track',
        playedAt: isNaN(playedAt) ? now - idx * 3600000 : playedAt,
        track,
      });
    });

    // Also include some recent playlists if available
    const playlists = useSpotifyDataStore.getState().playlists || [];
    playlists.slice(0, 4).forEach((pl, idx) => {
      if (pl.id === 'liked-songs') return;
      items.push({
        id: pl.id,
        name: pl.name,
        subtitle: `Playlist • ${pl.tracks?.total || pl.tracks?.items?.length || 0} canciones`,
        image: getPlaylistCover(pl) || pl.images?.[0]?.url || '',
        type: 'playlist',
        playedAt: now - (idx + 1) * (dayMs * 0.8),
      });
    });
  } catch {}

  return items.sort((a, b) => b.playedAt - a.playedAt);
}

export function recordHistoryItem(item: Omit<HistoryItem, 'playedAt'> & { playedAt?: number }) {
  if (typeof window === 'undefined') return;
  try {
    const current = getListeningHistory();
    const playedAt = item.playedAt || Date.now();
    let resolvedImage = item.image || '';
    if (!resolvedImage && item.track) {
      resolvedImage =
        item.track.album?.images?.[0]?.url ||
        TRACK_COVER_CACHE.get(item.track.id) ||
        '';
    }
    if (!resolvedImage && TRACK_COVER_CACHE.has(item.id)) {
      resolvedImage = TRACK_COVER_CACHE.get(item.id) || '';
    }

    // Remove existing occurrence of this specific item so it jumps to top
    const filtered = current.filter((x) => x.id !== item.id);
    const updated: HistoryItem[] = [{ ...item, image: resolvedImage, playedAt }, ...filtered].slice(0, 100);

    window.localStorage.setItem(getKey(), JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('spotifree:history_updated'));
  } catch {}
}

export interface DayGroup {
  dateLabel: string;
  items: HistoryItem[];
}

/**
 * Groups history items by date:
 * - "Hoy"
 * - "Ayer"
 * - "X de mes" (e.g. "8 de noviembre")
 */
export function groupHistoryByDate(items: HistoryItem[]): DayGroup[] {
  const groups: Map<string, HistoryItem[]> = new Map();

  const now = new Date();
  const todayStr = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStr = todayStr - 86400000;

  for (const item of items) {
    const d = new Date(item.playedAt);
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

    let label: string;
    if (dayStart >= todayStr) {
      label = 'Hoy';
    } else if (dayStart >= yesterdayStr) {
      label = 'Ayer';
    } else {
      label = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
    }

    if (!groups.has(label)) {
      groups.set(label, []);
    }
    groups.get(label)!.push(item);
  }

  const result: DayGroup[] = [];
  groups.forEach((groupItems, dateLabel) => {
    result.push({ dateLabel, items: groupItems });
  });

  return result;
}
