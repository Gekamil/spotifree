/**
 * Deleted playlists can be recovered for 90 days (like Spotify's "Recuperar playlists").
 *  - On delete, a copy (with its songs) goes to the trash of this account (this device + the
 *    cloud account, so it can be recovered from any device).
 *  - Restoring puts it back in the library and tells the other devices (restored ids travel in the
 *    account, otherwise they would keep it hidden as deleted).
 */
import { create } from 'zustand';
import type { Playlist, Track } from '../types/spotify';

export interface TrashEntry {
  id: string;
  name: string;
  image?: string;
  total: number;
  deletedAt: number;
  playlist: Playlist;
}

const DAYS_90 = 90 * 86400000;
const MAX = 40;
const uidKey = () => {
  try {
    return localStorage.getItem('spotifree_active_user_id') || 'active';
  } catch {
    return 'active';
  }
};
const trashKey = () => `spotifree_playlist_trash_${uidKey()}`;
const RESTORED_KEY = 'spotifree_restored_playlist_ids';

const slimTrack = (t: any): Track => ({
  id: t.id,
  name: t.name,
  duration_ms: t.duration_ms || 0,
  artists: (t.artists || []).slice(0, 3).map((a: any) => ({ id: a?.id || '', name: a?.name || '' })),
  album: { id: t.album?.id || '', name: t.album?.name || '', images: t.album?.images?.[0]?.url ? [{ url: t.album.images[0].url }] : [] },
  ...(t.added_at ? { added_at: t.added_at } : {}),
});

function read(): TrashEntry[] {
  try {
    const list: TrashEntry[] = JSON.parse(localStorage.getItem(trashKey()) || '[]');
    return Array.isArray(list) ? list.filter((e) => e && e.id && Date.now() - e.deletedAt < DAYS_90) : [];
  } catch {
    return [];
  }
}
function write(list: TrashEntry[]) {
  const clean = list.filter((e) => Date.now() - e.deletedAt < DAYS_90).sort((a, b) => b.deletedAt - a.deletedAt).slice(0, MAX);
  try {
    localStorage.setItem(trashKey(), JSON.stringify(clean));
  } catch {}
  usePlaylistTrash.setState({ entries: clean });
}

export const usePlaylistTrash = create<{ entries: TrashEntry[] }>(() => ({ entries: typeof window === 'undefined' ? [] : read() }));

export function getRestoredIds(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RESTORED_KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function setRestoredIds(ids: string[]) {
  try {
    localStorage.setItem(RESTORED_KEY, JSON.stringify(ids.slice(-200)));
  } catch {}
}

/** What travels in the account (stats map): the trash with light songs, and the restored ids */
export function trashForCloud() {
  return {
    playlistTrash: read()
      .slice(0, 20)
      .map((e) => ({ ...e, playlist: { ...e.playlist, tracks: { total: e.total, items: (e.playlist.tracks?.items || []).slice(0, 300).map(slimTrack) } } })),
    restoredPlaylistIds: getRestoredIds(),
  };
}

/** A playlist is being deleted: keep a copy (empty brand-new lists are not worth keeping) */
export function addToTrash(p: Playlist | undefined | null) {
  if (!p?.id || p.id === 'liked-songs') return;
  const items = p.tracks?.items || [];
  if ((p as any).is_new && items.length === 0) return;
  const entry: TrashEntry = {
    id: p.id,
    name: p.name || 'Playlist',
    image: p.images?.[0]?.url && !String(p.images[0].url).startsWith('data:') ? p.images[0].url : undefined,
    total: items.length || p.tracks?.total || 0,
    deletedAt: Date.now(),
    playlist: { ...p, tracks: { total: items.length || p.tracks?.total || 0, items: items.map(slimTrack) } } as Playlist,
  };
  write([entry, ...read().filter((e) => e.id !== p.id)]);
  // Deleted again: no longer "restored" for the other devices
  setRestoredIds(getRestoredIds().filter((x) => x !== p.id));
}

/** Trash and restored ids from the account (another device deleted / restored something) */
export function mergeCloudTrash(cloud: TrashEntry[] | undefined, restored: string[] | undefined) {
  const restoredSet = new Set(restored || []);
  const mine = read();
  const byId = new Map(mine.map((e) => [e.id, e]));
  for (const e of cloud || []) {
    if (!e?.id || restoredSet.has(e.id)) continue;
    const have = byId.get(e.id);
    if (!have || have.deletedAt < e.deletedAt) byId.set(e.id, e);
  }
  for (const id of restoredSet) byId.delete(id);
  write([...byId.values()]);
  if (restored?.length) {
    const local = new Set(getRestoredIds());
    restored.forEach((x) => local.add(x));
    setRestoredIds([...local]);
  }
}

/** Puts a deleted playlist back in the library (this device, the account and the other devices) */
export async function restoreFromTrash(id: string): Promise<boolean> {
  const entry = read().find((e) => e.id === id);
  if (!entry) return false;
  const clean = id.replace(/^spotify:playlist:/i, '').split('?')[0].trim();
  // 1. No longer "deleted" here
  let deleted: string[] = [];
  try {
    deleted = JSON.parse(localStorage.getItem('spotifree_deleted_playlist_ids') || '[]');
  } catch {}
  deleted = deleted.filter((x) => x !== id && x !== clean);
  try {
    localStorage.setItem('spotifree_deleted_playlist_ids', JSON.stringify(deleted));
  } catch {}
  setRestoredIds([...getRestoredIds().filter((x) => x !== id), id]);
  write(read().filter((e) => e.id !== id));

  // 2. The account first (so the deleted list there no longer hides it), then the library
  const [{ syncSpotifreeAccount, getSavedSpotifreeAccount }, { useSpotifyDataStore }] = await Promise.all([
    import('./spotifreeAuth'),
    import('../store/useSpotifyDataStore'),
  ]);
  if (getSavedSpotifreeAccount()) {
    const stats = { ...((getSavedSpotifreeAccount() as any)?.stats || {}), ...trashForCloud() };
    await syncSpotifreeAccount({ deletedPlaylistIds: deleted, stats } as any).catch(() => null);
  }
  useSpotifyDataStore.getState().addCustomPlaylist({ ...entry.playlist, is_new: false } as any);
  return true;
}

/** Removes an entry for good */
export function purgeFromTrash(id: string) {
  write(read().filter((e) => e.id !== id));
}
