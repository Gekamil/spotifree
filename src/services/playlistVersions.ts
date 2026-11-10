/**
 * Version history of the user's playlists: each time a playlist's songs change (added, removed,
 * reordered), the version it had before is kept, so it can be brought back. Kept on this device:
 * the last 15 versions of each playlist, for 30 days.
 */
import { create } from 'zustand';
import type { Playlist, Track } from '../types/spotify';

export interface PlaylistVersion {
  at: number;
  total: number;
  /** what changed from this version to the next one (for the list: "+2", "−1", "Orden") */
  change: string;
  items: Track[];
}

const MAX = 15;
let restoring = false;
const DAYS_30 = 30 * 86400000;
const keyFor = () => {
  try {
    return `spotifree_pl_versions_${localStorage.getItem('spotifree_active_user_id') || 'active'}`;
  } catch {
    return 'spotifree_pl_versions_active';
  }
};

const slim = (t: any): Track => ({
  id: t.id,
  name: t.name,
  duration_ms: t.duration_ms || 0,
  artists: (t.artists || []).slice(0, 3).map((a: any) => ({ id: a?.id || '', name: a?.name || '' })),
  album: { id: t.album?.id || '', name: t.album?.name || '', images: t.album?.images?.[0]?.url ? [{ url: t.album.images[0].url }] : [] },
  ...(t.added_at ? { added_at: t.added_at } : {}),
});

type Store = Record<string, PlaylistVersion[]>;
function read(): Store {
  try {
    const v = JSON.parse(localStorage.getItem(keyFor()) || '{}');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}
function write(s: Store) {
  const now = Date.now();
  for (const id of Object.keys(s)) {
    s[id] = (s[id] || []).filter((v) => now - v.at < DAYS_30).slice(0, MAX);
    if (!s[id].length) delete s[id];
  }
  try {
    localStorage.setItem(keyFor(), JSON.stringify(s));
  } catch {
    // Full storage: keep only the newest half of every playlist's history
    for (const id of Object.keys(s)) s[id] = s[id].slice(0, Math.ceil(s[id].length / 2));
    try {
      localStorage.setItem(keyFor(), JSON.stringify(s));
    } catch {}
  }
  usePlaylistVersions.setState({ version: Date.now() });
}

/** Re-render signal for the history screen */
export const usePlaylistVersions = create<{ version: number }>(() => ({ version: 0 }));

const idsOf = (items: any[] = []) => items.map((t) => String(t?.id || `${t?.name}|${t?.artists?.[0]?.name}`));

/** What a change did, in a few words */
function describe(before: any[], after: any[]): string {
  const b = new Set(idsOf(before));
  const a = new Set(idsOf(after));
  const added = [...a].filter((x) => !b.has(x)).length;
  const removed = [...b].filter((x) => !a.has(x)).length;
  if (added && removed) return `+${added} −${removed}`;
  if (added) return added === 1 ? '1 canción añadida' : `${added} canciones añadidas`;
  if (removed) return removed === 1 ? '1 canción quitada' : `${removed} canciones quitadas`;
  return 'Orden cambiado';
}

/** Called before a playlist's songs change: keeps the current version if the songs really change */
export function recordPlaylistVersion(p: Pick<Playlist, 'id' | 'tracks'> | undefined | null, nextItems: any[] | undefined) {
  if (!p?.id || !Array.isArray(nextItems) || p.id === 'liked-songs') return;
  const before = p.tracks?.items || [];
  if (!before.length) return;
  const b = idsOf(before);
  const n = idsOf(nextItems);
  if (b.length === n.length && b.every((x, i) => x === n[i])) return; // same songs, same order (covers…)
  const s = read();
  const list = s[p.id] || [];
  // Several changes within a minute are one edit: keep the version from before them all
  // (a restore always keeps its own, so it can be undone)
  if (!restoring && list[0] && Date.now() - list[0].at < 60000) {
    list[0] = { ...list[0], change: describe(list[0].items, nextItems) };
  } else {
    list.unshift({ at: Date.now(), total: before.length, change: describe(before, nextItems), items: before.map(slim) });
  }
  s[p.id] = list;
  write(s);
}

export function getPlaylistVersions(id: string): PlaylistVersion[] {
  return (read()[id] || []).filter((v) => Date.now() - v.at < DAYS_30);
}

/** Brings a playlist back to an earlier version (the current one is kept too, so it can be undone) */
export async function restorePlaylistVersion(id: string, at: number): Promise<boolean> {
  const v = getPlaylistVersions(id).find((x) => x.at === at);
  if (!v) return false;
  // Songs coming back were on this playlist's "removed" list (which keeps Spotify from bringing
  // them back): take them off it, or they would be filtered out again
  try {
    const clean = id.replace(/^spotify:playlist:/i, '').split('?')[0].trim();
    const back = new Set<string>();
    for (const t of v.items) {
      const c = (t.id || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
      back.add(t.id);
      back.add(c);
      back.add(`spotify:track:${c}`);
      if (t.name && t.artists?.[0]?.name) back.add(`sig:${t.name.toLowerCase().trim()}::${t.artists[0].name.toLowerCase().trim()}`);
    }
    for (const k of [`spotifree_removed_tracks_${clean}`, `spotifree_removed_tracks_${id}`]) {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const list: string[] = JSON.parse(raw);
      localStorage.setItem(k, JSON.stringify(list.filter((x) => !back.has(x))));
    }
  } catch {}

  const { useSpotifyDataStore } = await import('../store/useSpotifyDataStore');
  const st = useSpotifyDataStore.getState();
  restoring = true;
  try {
    st.updatePlaylist(id, { tracks: { total: v.items.length, items: v.items } });
  } finally {
    restoring = false;
  }
  const cached = st.playlistDetailsCache[id] || st.playlists.find((p) => p.id === id);
  if (cached) st.cachePlaylistDetails({ ...cached, tracks: { total: v.items.length, items: v.items } });
  try {
    window.dispatchEvent(new CustomEvent('spotifree_playlist_updated', { detail: { id, cleanId: id, updatedPlaylist: { ...(cached || {}), id, tracks: { total: v.items.length, items: v.items } } } }));
  } catch {}
  return true;
}
