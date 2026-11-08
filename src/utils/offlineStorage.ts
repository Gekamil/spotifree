/**
 * Spotifree Offline Audio Storage System ("musica-spotifree")
 * Real CacheStorage and OPFS (Origin Private File System) persistence for offline audio playback.
 */

import type { Playlist, Track } from '../types/spotify';
import { API_BASE } from '../config';
import { cleanTrackId } from './audioFeatures';

const CACHE_NAME = 'musica-spotifree';
const METADATA_KEY_PREFIX = 'spotifree_offline_meta_';
const PLAYLISTS_LIST_KEY = 'spotifree_downloaded_playlists_list';
const TRACK_META_PREFIX = 'spotifree_offline_track_';

export const DOWNLOADS_CHANGED_EVENT = 'spotifree:downloads-changed';

/**
 * Dispatch an event when downloads change so all UI components update reactively
 */
export function notifyDownloadsChanged(trackId?: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(
      new CustomEvent(DOWNLOADS_CHANGED_EVENT, {
        detail: { trackId: trackId ? cleanTrackId(trackId) : null, timestamp: Date.now() },
      })
    );
  } catch {}
}

/**
 * Subscribe to download state changes
 */
export function onDownloadsChanged(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = () => callback();
  window.addEventListener(DOWNLOADS_CHANGED_EVENT, handler);
  return () => window.removeEventListener(DOWNLOADS_CHANGED_EVENT, handler);
}

/**
 * Check if a track is downloaded locally in CacheStorage or OPFS
 */
export async function isTrackDownloaded(trackId: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const clean = cleanTrackId(trackId);
  if (!clean) return false;

  try {
    if ('caches' in window) {
      const cache = await caches.open(CACHE_NAME);
      const match = (await cache.match(`/musica-spotifree/tracks/${clean}.mp3`)) ||
                    (await cache.match(`/musica-spotifree/tracks/${trackId}.mp3`));
      if (match) return true;
    }
  } catch {}

  // Check OPFS
  try {
    if (typeof navigator !== 'undefined' && navigator.storage && (navigator.storage as any).getDirectory) {
      const root = await (navigator.storage as any).getDirectory();
      const spotifreeDir = await root.getDirectoryHandle('musica-spotifree');
      const fileHandle = await spotifreeDir.getFileHandle(`${clean}.mp3`);
      if (fileHandle) return true;
    }
  } catch {}

  return false;
}

/**
 * Retrieve blob URL for offline playback
 */
export async function getDownloadedTrackBlobUrl(trackId: string): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const clean = cleanTrackId(trackId);
  if (!clean) return null;

  // 1. Check CacheStorage
  try {
    if ('caches' in window) {
      const cache = await caches.open(CACHE_NAME);
      const cacheKeyClean = `/musica-spotifree/tracks/${clean}.mp3`;
      let res = await cache.match(cacheKeyClean);
      if (!res && clean !== trackId) {
        res = await cache.match(`/musica-spotifree/tracks/${trackId}.mp3`);
      }
      if (res && res.ok) {
        const blob = await res.blob();
        // Discard corrupted or tiny 0-byte clips (< 400 KB)
        if (blob && blob.size < 400_000) {
          try { await cache.delete(cacheKeyClean); } catch {}
          return null;
        }
        return URL.createObjectURL(blob);
      }
    }
  } catch (err) {
    console.warn('[offlineStorage] CacheStorage lookup failed:', err);
  }

  // 2. Check OPFS
  try {
    if (typeof navigator !== 'undefined' && navigator.storage && (navigator.storage as any).getDirectory) {
      const root = await (navigator.storage as any).getDirectory();
      const spotifreeDir = await root.getDirectoryHandle('musica-spotifree');
      const fileHandle = await spotifreeDir.getFileHandle(`${clean}.mp3`);
      const file = await fileHandle.getFile();
      if (file && file.size >= 400_000) {
        return URL.createObjectURL(file);
      }
    }
  } catch {}

  return null;
}

/**
 * Get the set of all downloaded track IDs
 */
export async function getAllDownloadedTrackIds(): Promise<Set<string>> {
  const result = new Set<string>();
  if (typeof window === 'undefined') return result;

  try {
    if ('caches' in window) {
      const cache = await caches.open(CACHE_NAME);
      const requests = await cache.keys();
      for (const req of requests) {
        const url = req.url;
        const match = url.match(/\/musica-spotifree\/tracks\/([^/]+)\.mp3$/);
        if (match && match[1]) {
          result.add(cleanTrackId(match[1]));
        }
      }
    }
  } catch {}

  // Also include tracks registered in localStorage
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(TRACK_META_PREFIX)) {
        const id = key.substring(TRACK_META_PREFIX.length);
        if (id) result.add(cleanTrackId(id));
      }
    }
  } catch {}

  return result;
}

/**
 * Purges any corrupted or short 30-second preview clips from CacheStorage.
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
          if (blob && blob.size < 400_000) {
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
 * Strictly downloads full studio audio stream and saves into CacheStorage & OPFS.
 */
export async function downloadTrackAudio(track: Track): Promise<boolean> {
  if (typeof window === 'undefined' || !track) return false;
  const clean = cleanTrackId(track.id);
  if (!clean) return false;

  try {
    const artist = track.artists?.[0]?.name || '';
    const query = `${track.name} ${artist}`.trim();
    let res: Response | null = null;

    // Strategy 1: Primary audio stream endpoint
    try {
      const streamUrl = `${API_BASE}/api/audio/stream?q=${encodeURIComponent(query)}&trackId=${encodeURIComponent(clean)}`;
      const timeoutSignal = typeof AbortSignal !== 'undefined' && AbortSignal.timeout
        ? AbortSignal.timeout(60000)
        : undefined;
      res = await fetch(streamUrl, { signal: timeoutSignal });
    } catch (e) {
      console.warn(`[offlineStorage] Strategy 1 failed for ${track.name}:`, e);
    }

    // Strategy 2: Download action endpoint
    if (!res || !res.ok) {
      try {
        const downloadUrl = `${API_BASE}/api/audio/download?q=${encodeURIComponent(query)}&trackId=${encodeURIComponent(clean)}`;
        const timeoutSignal = typeof AbortSignal !== 'undefined' && AbortSignal.timeout
          ? AbortSignal.timeout(60000)
          : undefined;
        res = await fetch(downloadUrl, { signal: timeoutSignal });
      } catch (e) {
        console.warn(`[offlineStorage] Strategy 2 failed for ${track.name}:`, e);
      }
    }

    // Strategy 3: Piped direct bytes fallback
    if (!res || !res.ok) {
      try {
        const pipeUrl = `${API_BASE}/api/audio/stream?q=${encodeURIComponent(query)}&pipe=true`;
        const timeoutSignal = typeof AbortSignal !== 'undefined' && AbortSignal.timeout
          ? AbortSignal.timeout(60000)
          : undefined;
        res = await fetch(pipeUrl, { signal: timeoutSignal });
      } catch (e) {
        console.warn(`[offlineStorage] Strategy 3 failed for ${track.name}:`, e);
      }
    }

    if (!res || !res.ok) return false;

    const blob = await res.blob();
    // Strictly require >= 250 KB to guarantee full audio rather than tiny errors/previews
    if (!blob || blob.size < 250_000) return false;

    // 1. Store in CacheStorage
    if ('caches' in window) {
      const cache = await caches.open(CACHE_NAME);
      const cacheKey = `/musica-spotifree/tracks/${clean}.mp3`;
      const responseToCache = new Response(blob, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': String(blob.size),
          'X-Track-Id': clean,
          'X-Track-Title': encodeURIComponent(track.name),
        },
      });
      await cache.put(cacheKey, responseToCache);
    }

    // 2. Try OPFS directory "musica-spotifree"
    try {
      if (typeof navigator !== 'undefined' && navigator.storage && (navigator.storage as any).getDirectory) {
        const root = await (navigator.storage as any).getDirectory();
        const spotifreeDir = await root.getDirectoryHandle('musica-spotifree', { create: true });
        const fileHandle = await spotifreeDir.getFileHandle(`${clean}.mp3`, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
      }
    } catch {}

    // 3. Save track metadata in localStorage
    try {
      window.localStorage.setItem(`${TRACK_META_PREFIX}${clean}`, JSON.stringify(track));
    } catch {}

    notifyDownloadsChanged(clean);
    return true;
  } catch (e) {
    console.warn(`[offlineStorage] Failed to download track ${track.name}:`, e);
    return false;
  }
}

/**
 * Delete a single downloaded track from musica-spotifree
 */
export async function deleteDownloadedTrack(trackId: string): Promise<void> {
  if (typeof window === 'undefined') return;
  const clean = cleanTrackId(trackId);
  if (!clean) return;

  try {
    if ('caches' in window) {
      const cache = await caches.open(CACHE_NAME);
      await cache.delete(`/musica-spotifree/tracks/${clean}.mp3`);
      if (clean !== trackId) {
        await cache.delete(`/musica-spotifree/tracks/${trackId}.mp3`);
      }
    }
  } catch {}

  try {
    if (typeof navigator !== 'undefined' && navigator.storage && (navigator.storage as any).getDirectory) {
      const root = await (navigator.storage as any).getDirectory();
      const spotifreeDir = await root.getDirectoryHandle('musica-spotifree');
      await spotifreeDir.removeEntry(`${clean}.mp3`);
    }
  } catch {}

  try {
    window.localStorage.removeItem(`${TRACK_META_PREFIX}${clean}`);
  } catch {}

  notifyDownloadsChanged(clean);
}

/**
 * Save / Export track as a real MP3 file download on user's device
 */
export async function saveTrackAsMp3File(track: Track): Promise<boolean> {
  if (typeof window === 'undefined' || !track) return false;
  const clean = cleanTrackId(track.id);
  const artist = track.artists?.[0]?.name || 'Artista';
  const rawName = `${artist} - ${track.name}`.trim();
  const safeFilename = rawName.replace(/[/\\?%*:|"<>]/g, '_') + '.mp3';

  // 1. If already downloaded in CacheStorage, export direct blob
  try {
    if ('caches' in window) {
      const cache = await caches.open(CACHE_NAME);
      const res = (await cache.match(`/musica-spotifree/tracks/${clean}.mp3`)) ||
                  (await cache.match(`/musica-spotifree/tracks/${track.id}.mp3`));
      if (res && res.ok) {
        const blob = await res.blob();
        if (blob && blob.size >= 400_000) {
          const blobUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = safeFilename;
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);
          }, 1000);
          return true;
        }
      }
    }
  } catch {}

  // 2. Otherwise trigger direct download via backend /api/audio/download
  try {
    const query = `${track.name} ${artist}`.trim();
    const downloadUrl = `${API_BASE}/api/audio/download?q=${encodeURIComponent(query)}&filename=${encodeURIComponent(safeFilename)}`;
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = safeFilename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
    }, 1000);
    return true;
  } catch (err) {
    console.error('[offlineStorage] saveTrackAsMp3File failed:', err);
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

  notifyDownloadsChanged();
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
        const clean = cleanTrackId(id);
        await cache.delete(`/musica-spotifree/tracks/${clean}.mp3`);
        if (clean !== id) {
          await cache.delete(`/musica-spotifree/tracks/${id}.mp3`);
        }
        window.localStorage.removeItem(`${TRACK_META_PREFIX}${clean}`);
      }
    }
  } catch {}

  notifyDownloadsChanged();
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
        k.startsWith('spotifree_offline_playlist_') ||
        k.startsWith(TRACK_META_PREFIX)
    );
    keysToRemove.forEach((k) => window.localStorage.removeItem(k));
  } catch (e) {
    console.warn('[offlineStorage] clearOfflineCache error:', e);
  }

  notifyDownloadsChanged();
}
