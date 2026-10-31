/**
 * Spotifree Offline Audio Storage System ("musica-spotifree")
 * Real CacheStorage and OPFS (Origin Private File System) persistence for offline audio playback.
 */

import type { Playlist, Track } from '../types/spotify';
import { API_BASE } from '../config';

const CACHE_NAME = 'musica-spotifree';
const METADATA_KEY_PREFIX = 'spotifree_offline_meta_';
const PLAYLISTS_LIST_KEY = 'spotifree_downloaded_playlists_list';

/**
 * Check if a track is downloaded locally
 */
export async function isTrackDownloaded(trackId: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    if ('caches' in window) {
      const cache = await caches.open(CACHE_NAME);
      const match = await cache.match(`/musica-spotifree/tracks/${trackId}.mp3`);
      if (match) return true;
    }
  } catch {}
  return false;
}

/**
 * Retrieve blob URL for offline playback
 */
export async function getDownloadedTrackBlobUrl(trackId: string): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  try {
    if ('caches' in window) {
      const cache = await caches.open(CACHE_NAME);
      const cacheKey = `/musica-spotifree/tracks/${trackId}.mp3`;
      const res = await cache.match(cacheKey);
      if (res && res.ok) {
        const blob = await res.blob();
        // Discard truncated / 30-second preview audio snippets (< 1.2 MB)
        if (blob && blob.size < 1_200_000) {
          try { await cache.delete(cacheKey); } catch {}
          return null;
        }
        return URL.createObjectURL(blob);
      }
    }
  } catch {}
  return null;
}

/**
 * Purges any corrupted or short 30-second preview clips from CacheStorage.
 * Full studio tracks are always > 1.2 MB.
 */
export async function purgeCorruptedPreviewAudio(): Promise<number> {
  if (typeof window === 'undefined' || !('caches' in window)) return 0;
  let purgedCount = 0;
  try {
    const cache = await caches.open(CACHE_NAME);
    const requests = await cache.keys();
    for (const req of requests) {
      if (req.url.includes('/musica-spotifree/tracks/')) {
        const res = await cache.match(req);
        if (res && res.ok) {
          const blob = await res.blob();
          if (blob && blob.size < 1_200_000) {
            await cache.delete(req);
            purgedCount++;
          }
        }
      }
    }
  } catch {}
  return purgedCount;
}

/**
 * Download a single track audio stream and store in musica-spotifree cache.
 * Strictly downloads full studio audio stream — NEVER caches 30-second previews.
 */
export async function downloadTrackAudio(track: Track): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    const artist = track.artists?.[0]?.name || '';
    const query = `${track.name} ${artist}`.trim();
    let res: Response | null = null;

    try {
      const streamUrl = `${API_BASE}/api/audio/stream?q=${encodeURIComponent(query)}`;
      res = await fetch(streamUrl, { signal: AbortSignal.timeout?.(25000) });
    } catch {}

    if (!res || !res.ok) return false;

    const blob = await res.blob();
    // Strictly require >= 1.2 MB to guarantee full audio rather than previews
    if (!blob || blob.size < 1_200_000) return false;

    // 1. Store in CacheStorage
    if ('caches' in window) {
      const cache = await caches.open(CACHE_NAME);
      const cacheKey = `/musica-spotifree/tracks/${track.id}.mp3`;
      const responseToCache = new Response(blob, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': String(blob.size),
          'X-Track-Id': track.id,
          'X-Track-Title': encodeURIComponent(track.name),
        },
      });
      await cache.put(cacheKey, responseToCache);
    }

    // 2. Try OPFS directory "musica-spotifree"
    try {
      if (navigator.storage && (navigator.storage as any).getDirectory) {
        const root = await (navigator.storage as any).getDirectory();
        const spotifreeDir = await root.getDirectoryHandle('musica-spotifree', { create: true });
        const fileHandle = await spotifreeDir.getFileHandle(`${track.id}.mp3`, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
      }
    } catch {}

    return true;
  } catch (e) {
    console.warn(`[offlineStorage] Failed to download track ${track.name}:`, e);
    return false;
  }
}

/**
 * Check if an entire playlist is marked as downloaded
 */
export function isPlaylistDownloaded(playlistId: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const listRaw = window.localStorage.getItem(PLAYLISTS_LIST_KEY);
    if (!listRaw) return false;
    const list: string[] = JSON.parse(listRaw);
    return list.includes(playlistId);
  } catch {
    return false;
  }
}

/**
 * Download all tracks of a playlist with real progress reporting
 */
export async function downloadPlaylist(
  playlist: Playlist,
  tracks: Track[],
  onProgress?: (completed: number, total: number) => void
): Promise<{ total: number; downloaded: number }> {
  const total = tracks.length;
  let completed = 0;
  let successful = 0;

  for (const track of tracks) {
    const already = await isTrackDownloaded(track.id);
    if (!already) {
      const ok = await downloadTrackAudio(track);
      if (ok) successful++;
    } else {
      successful++;
    }
    completed++;
    onProgress?.(completed, total);
  }

  // Save playlist metadata if at least some tracks were stored locally
  if (typeof window !== 'undefined' && successful > 0) {
    try {
      const offlinePl = {
        ...playlist,
        tracks: { total: tracks.length, items: tracks },
        downloadedAt: Date.now(),
      };
      window.localStorage.setItem(`${METADATA_KEY_PREFIX}${playlist.id}`, JSON.stringify(offlinePl));

      const listRaw = window.localStorage.getItem(PLAYLISTS_LIST_KEY);
      const list: string[] = listRaw ? JSON.parse(listRaw) : [];
      if (!list.includes(playlist.id)) {
        list.push(playlist.id);
        window.localStorage.setItem(PLAYLISTS_LIST_KEY, JSON.stringify(list));
      }
    } catch {}
  }

  return { total, downloaded: successful };
}

/**
 * Delete a downloaded playlist and its tracks from musica-spotifree
 */
export async function deleteDownloadedPlaylist(playlistId: string, trackIds?: string[]): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    // 1. Remove from localStorage list
    const listRaw = window.localStorage.getItem(PLAYLISTS_LIST_KEY);
    if (listRaw) {
      const list: string[] = JSON.parse(listRaw).filter((id: string) => id !== playlistId);
      window.localStorage.setItem(PLAYLISTS_LIST_KEY, JSON.stringify(list));
    }
    window.localStorage.removeItem(`${METADATA_KEY_PREFIX}${playlistId}`);
    window.localStorage.removeItem(`spotifree_downloaded_${playlistId}`);

    // 2. Remove cached tracks if provided
    if (trackIds && 'caches' in window) {
      const cache = await caches.open(CACHE_NAME);
      for (const id of trackIds) {
        await cache.delete(`/musica-spotifree/tracks/${id}.mp3`);
      }
    }
  } catch {}
}

/**
 * Get all downloaded playlists
 */
export function getDownloadedPlaylists(): Playlist[] {
  if (typeof window === 'undefined') return [];
  try {
    const listRaw = window.localStorage.getItem(PLAYLISTS_LIST_KEY);
    if (!listRaw) return [];
    const ids: string[] = JSON.parse(listRaw);
    const result: Playlist[] = [];

    for (const id of ids) {
      const raw = window.localStorage.getItem(`${METADATA_KEY_PREFIX}${id}`);
      if (raw) {
        result.push(JSON.parse(raw));
      }
    }
    return result;
  } catch {
    return [];
  }
}

/**
 * Compute real storage usage in CacheStorage and localStorage
 */
export async function getStorageUsage(): Promise<{ usedBytes: number; formatted: string }> {
  let bytes = 0;

  try {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      if (estimate.usage) {
        bytes = estimate.usage;
      }
    }
  } catch {}

  if (bytes === 0 && typeof window !== 'undefined' && 'caches' in window) {
    try {
      const cache = await caches.open(CACHE_NAME);
      const keys = await cache.keys();
      // Rough estimation ~3.5MB per track
      bytes = keys.length * 3.5 * 1024 * 1024;
    } catch {}
  }

  // Format
  let formatted = '0.0 MB';
  if (bytes > 1024 * 1024 * 1024) {
    formatted = `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  } else if (bytes > 0) {
    formatted = `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return { usedBytes: bytes, formatted };
}

/**
 * Clear all offline cache ("musica-spotifree" cache and OPFS)
 */
export async function clearOfflineCache(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    if ('caches' in window) {
      await caches.delete(CACHE_NAME);
    }

    try {
      if (navigator.storage && (navigator.storage as any).getDirectory) {
        const root = await (navigator.storage as any).getDirectory();
        await root.removeEntry('musica-spotifree', { recursive: true });
      }
    } catch {}

    // Clear list
    window.localStorage.removeItem(PLAYLISTS_LIST_KEY);
    const keysToRemove = Object.keys(window.localStorage).filter(
      (k) =>
        k.startsWith(METADATA_KEY_PREFIX) ||
        k.startsWith('spotifree_downloaded_') ||
        k.startsWith('spotifree_offline_playlist_')
    );
    keysToRemove.forEach((k) => window.localStorage.removeItem(k));
  } catch (e) {
    console.warn('[offlineStorage] clearOfflineCache error:', e);
  }
}
