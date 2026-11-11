/**
 * Spotifree Offline Audio Storage System ("musica-spotifree")
 * Multi-layer persistence (Native Android files + CacheStorage + IndexedDB + OPFS)
 * and chunked full-track audio extraction for reliable airplane mode playback.
 */

import { Capacitor, CapacitorHttp } from '@capacitor/core';
import type { Playlist, Track } from '../types/spotify';
import { API_BASE } from '../config';
import { cleanTrackId } from './audioFeatures';
import {
  deleteNativeOfflinePlaylist,
  deleteNativeOfflineTrack,
  getNativeOfflineTrackUrl,
  isDeviceMusicAvailable,
  listNativeOfflineData,
  saveNativeOfflinePlaylist,
  saveNativeOfflineTrack,
  saveNativePublicMusicFile,
} from './nativeLocalMusic';

const CACHE_NAME = 'musica-spotifree';
const METADATA_KEY_PREFIX = 'spotifree_offline_meta_';
const PLAYLISTS_LIST_KEY = 'spotifree_downloaded_playlists_list';
const TRACK_META_PREFIX = 'spotifree_offline_track_';
const IDB_NAME = 'spotifree-offline-db';
const IDB_VERSION = 1;
const IDB_STORE_TRACKS = 'tracks';
const IDB_STORE_PLAYLISTS = 'playlists';

const RENDER_BACKEND_BASE = 'https://spotifree-backend-o4a7.onrender.com';
const YT_PLAYER_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';

export const DOWNLOADS_CHANGED_EVENT = 'spotifree:downloads-changed';

export interface StoredTrackEntry {
  blob: Blob;
  mimeType: string;
  ext: string;
  size: number;
  track?: Track;
}

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

export function onDownloadsChanged(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = () => callback();
  window.addEventListener(DOWNLOADS_CHANGED_EVENT, handler);
  return () => window.removeEventListener(DOWNLOADS_CHANGED_EVENT, handler);
}

// ---------------------------------------------------------------------------
// IndexedDB Storage Helpers (resilient fallback across Chrome, Safari, WebView)
// ---------------------------------------------------------------------------
function openOfflineDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(IDB_NAME, IDB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE_TRACKS)) {
          db.createObjectStore(IDB_STORE_TRACKS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(IDB_STORE_PLAYLISTS)) {
          db.createObjectStore(IDB_STORE_PLAYLISTS, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbPutTrack(cleanId: string, entry: StoredTrackEntry): Promise<void> {
  const db = await openOfflineDB();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE_TRACKS, 'readwrite');
      tx.objectStore(IDB_STORE_TRACKS).put({
        id: cleanId,
        blob: entry.blob,
        mimeType: entry.mimeType,
        ext: entry.ext,
        size: entry.size,
        track: entry.track,
        savedAt: Date.now(),
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function idbGetTrack(cleanId: string): Promise<StoredTrackEntry | null> {
  const db = await openOfflineDB();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE_TRACKS, 'readonly');
      const req = tx.objectStore(IDB_STORE_TRACKS).get(cleanId);
      req.onsuccess = () => {
        const row = req.result;
        if (row?.blob && row.blob.size >= 35_000) {
          resolve({
            blob: row.blob,
            mimeType: row.mimeType || row.blob.type || 'audio/mp4',
            ext: row.ext || mimeToExt(row.mimeType || row.blob.type),
            size: row.blob.size,
            track: row.track,
          });
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbDeleteTrack(cleanId: string): Promise<void> {
  const db = await openOfflineDB();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE_TRACKS, 'readwrite');
      tx.objectStore(IDB_STORE_TRACKS).delete(cleanId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function idbListTrackIds(): Promise<string[]> {
  const db = await openOfflineDB();
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE_TRACKS, 'readonly');
      const req = tx.objectStore(IDB_STORE_TRACKS).getAllKeys();
      req.onsuccess = () => resolve((req.result || []).map((k) => String(k)));
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

async function idbClearAll(): Promise<void> {
  const db = await openOfflineDB();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction([IDB_STORE_TRACKS, IDB_STORE_PLAYLISTS], 'readwrite');
      tx.objectStore(IDB_STORE_TRACKS).clear();
      tx.objectStore(IDB_STORE_PLAYLISTS).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

// ---------------------------------------------------------------------------
// Format Validation Helpers
// ---------------------------------------------------------------------------
function mimeToExt(mime = ''): string {
  const m = mime.toLowerCase();
  if (m.includes('flac')) return 'flac';
  if (m.includes('wav')) return 'wav';
  if (m.includes('mpeg') || m.includes('mp3')) return 'mp3';
  if (m.includes('webm')) return 'webm';
  if (m.includes('ogg') || m.includes('opus')) return 'ogg';
  return 'm4a';
}

export function sniffAudioFormat(bytes: Uint8Array): { valid: boolean; mime: string; ext: string } {
  if (!bytes || bytes.length < 16) return { valid: false, mime: '', ext: 'm4a' };

  // Reject HTML / XML / JSON error payloads explicitly
  if (bytes[0] === 0x3c /* < */ || bytes[0] === 0x7b /* { */ || bytes[0] === 0x5b /* [ */) {
    return { valid: false, mime: '', ext: 'm4a' };
  }

  // MP4 / M4A container ('ftyp' at bytes 4..7)
  if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    return { valid: true, mime: 'audio/mp4', ext: 'm4a' };
  }
  // ID3 MP3 ('ID3') or MPEG frame sync (0xFF 0xE0..0xFF)
  if ((bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)) {
    return { valid: true, mime: 'audio/mpeg', ext: 'mp3' };
  }
  // WebM / EBML (0x1A 0x45 0xDF 0xA3)
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return { valid: true, mime: 'audio/webm', ext: 'webm' };
  }
  // Ogg ('OggS')
  if (bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) {
    return { valid: true, mime: 'audio/ogg', ext: 'ogg' };
  }
  // FLAC ('fLaC')
  if (bytes[0] === 0x66 && bytes[1] === 0x4c && bytes[2] === 0x61 && bytes[3] === 0x43) {
    return { valid: true, mime: 'audio/flac', ext: 'flac' };
  }
  // RIFF / WAV
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
    return { valid: true, mime: 'audio/wav', ext: 'wav' };
  }
  return { valid: false, mime: '', ext: 'm4a' };
}

async function validateAudioBlob(blob: Blob): Promise<{ valid: boolean; mime: string; ext: string }> {
  if (!blob || blob.size < 35_000) return { valid: false, mime: '', ext: 'm4a' };
  try {
    const head = new Uint8Array(await blob.slice(0, 32).arrayBuffer());
    const sniff = sniffAudioFormat(head);
    if (!sniff.valid) return { valid: false, mime: '', ext: 'm4a' };
    return sniff;
  } catch {
    return { valid: false, mime: '', ext: 'm4a' };
  }
}

function getCachedVideoIdForTrack(track: Track): string | null {
  if (typeof window === 'undefined') return null;
  const clean = cleanTrackId(track.id);
  if (track.id.startsWith('yt-')) {
    const vid = track.id.slice(3).trim();
    if (/^[\w-]{11}$/.test(vid)) return vid;
  }
  try {
    const ovRaw = window.localStorage.getItem('spotifree_source_overrides');
    if (ovRaw) {
      const ov = JSON.parse(ovRaw);
      if (ov[clean] && /^[\w-]{11}$/.test(ov[clean])) return ov[clean];
    }
  } catch {}
  try {
    const artist = track.artists?.[0]?.name || '';
    const q = `${track.name} ${artist}`.trim();
    const raw = window.localStorage.getItem('spotifree_yt_cache_v3');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed[q] && /^[\w-]{11}$/.test(parsed[q])) return parsed[q];
    }
  } catch {}
  return null;
}

// ---------------------------------------------------------------------------
// Public Offline Status & Lookup APIs
// ---------------------------------------------------------------------------
export async function isTrackDownloaded(trackId: string): Promise<boolean> {
  if (typeof window === 'undefined' || !trackId) return false;
  if (trackId.startsWith('local-dev-')) return true;
  const clean = cleanTrackId(trackId);
  if (!clean) return false;

  const nativeUrl = await getNativeOfflineTrackUrl(clean);
  if (nativeUrl) return true;

  try {
    if ('caches' in window) {
      const cache = await caches.open(CACHE_NAME);
      const match =
        (await cache.match(`/musica-spotifree/tracks/${clean}.mp3`)) ||
        (await cache.match(`/musica-spotifree/tracks/${trackId}.mp3`));
      if (match && match.ok) {
        const len = parseInt(match.headers.get('content-length') || '0', 10);
        if (len === 0 || len >= 35_000) return true;
      }
    }
  } catch {}

  const idbHit = await idbGetTrack(clean);
  if (idbHit) return true;

  try {
    if (typeof navigator !== 'undefined' && navigator.storage && (navigator.storage as any).getDirectory) {
      const root = await (navigator.storage as any).getDirectory();
      const dir = await root.getDirectoryHandle('musica-spotifree');
      for (const name of [`${clean}.mp3`, `${clean}.m4a`]) {
        try {
          const fh = await dir.getFileHandle(name);
          const f = await fh.getFile();
          if (f && f.size >= 35_000) return true;
        } catch {}
      }
    }
  } catch {}

  return false;
}

async function getStoredAudioEntry(trackId: string): Promise<StoredTrackEntry | null> {
  if (typeof window === 'undefined' || !trackId) return null;
  const clean = cleanTrackId(trackId);
  if (!clean) return null;

  try {
    if ('caches' in window) {
      const cache = await caches.open(CACHE_NAME);
      const cacheKeyClean = `/musica-spotifree/tracks/${clean}.mp3`;
      let res = await cache.match(cacheKeyClean);
      if (!res && clean !== trackId) {
        res = await cache.match(`/musica-spotifree/tracks/${trackId}.mp3`);
      }
      if (res && res.ok && res.headers.get('x-audio-source') !== 'preview') {
        const blob = await res.blob();
        const check = await validateAudioBlob(blob);
        if (check.valid) {
          const mimeType = res.headers.get('x-audio-mime') || res.headers.get('content-type') || check.mime || 'audio/mp4';
          const ext = res.headers.get('x-audio-ext') || check.ext || mimeToExt(mimeType);
          return { blob: blob.type ? blob : new Blob([blob], { type: mimeType }), mimeType, ext, size: blob.size };
        }
        try { await cache.delete(cacheKeyClean); } catch {}
      }
    }
  } catch (err) {
    console.warn('[offlineStorage] CacheStorage lookup failed:', err);
  }

  const idbHit = await idbGetTrack(clean);
  if (idbHit) {
    const check = await validateAudioBlob(idbHit.blob);
    if (check.valid) return idbHit;
  }

  try {
    if (typeof navigator !== 'undefined' && navigator.storage && (navigator.storage as any).getDirectory) {
      const root = await (navigator.storage as any).getDirectory();
      const dir = await root.getDirectoryHandle('musica-spotifree');
      for (const name of [`${clean}.m4a`, `${clean}.mp3`, `${clean}.flac`, `${clean}.webm`, `${clean}.ogg`, `${clean}.wav`]) {
        try {
          const fh = await dir.getFileHandle(name);
          const file = await fh.getFile();
          const check = await validateAudioBlob(file);
          if (check.valid) {
            return { blob: file, mimeType: check.mime, ext: check.ext, size: file.size };
          }
        } catch {}
      }
    }
  } catch {}

  return null;
}

export async function getDownloadedTrackBlobUrl(trackId: string): Promise<string | null> {
  if (typeof window === 'undefined' || !trackId) return null;
  const clean = cleanTrackId(trackId);
  if (!clean) return null;

  // On Android APK, native internal file URI streams straight from flash storage with zero RAM copy
  const nativeUrl = await getNativeOfflineTrackUrl(clean);
  if (nativeUrl) return nativeUrl;

  const entry = await getStoredAudioEntry(trackId);
  if (entry?.blob) {
    const typedBlob = entry.blob.type ? entry.blob : new Blob([entry.blob], { type: entry.mimeType || 'audio/mp4' });
    return URL.createObjectURL(typedBlob);
  }

  return null;
}

export async function getAllDownloadedTrackIds(): Promise<Set<string>> {
  const result = new Set<string>();
  if (typeof window === 'undefined') return result;

  try {
    const nativeData = await listNativeOfflineData();
    if (nativeData?.tracks) {
      for (const t of nativeData.tracks) {
        if (t?.id) result.add(cleanTrackId(String(t.id)));
      }
    }
  } catch {}

  try {
    if ('caches' in window) {
      const cache = await caches.open(CACHE_NAME);
      const requests = await cache.keys();
      for (const req of requests) {
        const match = req.url.match(/\/musica-spotifree\/tracks\/([^/]+)\.mp3$/);
        if (match?.[1]) {
          result.add(cleanTrackId(match[1]));
        }
      }
    }
  } catch {}

  try {
    const idbIds = await idbListTrackIds();
    for (const id of idbIds) {
      if (id) result.add(cleanTrackId(id));
    }
  } catch {}

  try {
    if (typeof navigator !== 'undefined' && navigator.storage && (navigator.storage as any).getDirectory) {
      const root = await (navigator.storage as any).getDirectory();
      const dir = await root.getDirectoryHandle('musica-spotifree');
      for await (const entry of (dir as any).values()) {
        const m = String(entry?.name || '').match(/^([^/]+)\.(mp3|m4a|webm|ogg|flac|wav)$/i);
        if (m?.[1]) result.add(cleanTrackId(m[1]));
      }
    }
  } catch {}

  // Remove orphaned TRACK_META_PREFIX keys that lack backing binary audio so checkmarks never lie
  try {
    const orphanKeys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(TRACK_META_PREFIX)) {
        const id = cleanTrackId(key.substring(TRACK_META_PREFIX.length));
        if (!id || (!result.has(id) && !id.startsWith('local-dev-'))) {
          orphanKeys.push(key);
        }
      }
    }
    orphanKeys.forEach((k) => window.localStorage.removeItem(k));
  } catch {}

  return result;
}

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
          const isExplicitPreview = res.headers.get('x-audio-source') === 'preview';
          const blob = await res.blob();
          const check = await validateAudioBlob(blob);
          if (isExplicitPreview || !check.valid) {
            await cache.delete(req);
            purgedCount++;
          }
        }
      }
    }
  } catch {}
  return purgedCount;
}

// ---------------------------------------------------------------------------
// Audio Download Strategies (Chunked Server Range + Native Phone CapacitorHttp)
// ---------------------------------------------------------------------------
async function fetchChunkedAudioFromBackend(baseOrigin: string, track: Track, knownVideoId?: string | null): Promise<StoredTrackEntry | null> {
  const clean = cleanTrackId(track.id);
  const artist = track.artists?.[0]?.name || '';
  const query = `${track.name} ${artist}`.trim();
  const durationSec = track.duration_ms ? Math.round(track.duration_ms / 1000) : 0;

  const params = new URLSearchParams();
  params.set('q', query);
  params.set('trackId', clean);
  if (track.name) params.set('title', track.name);
  if (artist) params.set('artist', artist);
  if (durationSec > 35) params.set('duration', String(durationSec));
  if (knownVideoId) params.set('videoId', knownVideoId);

  const CHUNK_SIZE = 2_097_152; // 2 MB chunks safely avoid Vercel 4.5 MB limit on tracks of any length
  const firstUrl = `${baseOrigin}/api/audio/stream?${params.toString()}`;

  const firstRes = await fetch(firstUrl, {
    headers: { Range: `bytes=0-${CHUNK_SIZE - 1}` },
    signal: AbortSignal.timeout ? AbortSignal.timeout(35000) : undefined,
  });
  if (!firstRes.ok) return null;
  if (firstRes.headers.get('x-audio-source') === 'preview') return null;

  const firstBuf = await firstRes.arrayBuffer();
  if (!firstBuf || firstBuf.byteLength < 10_000) return null;

  const headCheck = sniffAudioFormat(new Uint8Array(firstBuf, 0, Math.min(32, firstBuf.byteLength)));
  if (!headCheck.valid) return null;

  const mimeType = (firstRes.headers.get('x-audio-mime') || firstRes.headers.get('content-type') || headCheck.mime || 'audio/mp4').split(';')[0].trim();
  const ext = firstRes.headers.get('x-audio-ext') || headCheck.ext || mimeToExt(mimeType);
  const resolvedVideoId = firstRes.headers.get('x-video-id') || knownVideoId || '';

  let totalLen = parseInt(firstRes.headers.get('x-total-length') || '0', 10);
  if (!totalLen) {
    const cr = firstRes.headers.get('content-range') || '';
    const m = cr.match(/\/(\d+)$/);
    if (m) totalLen = parseInt(m[1], 10);
  }
  if (!totalLen) totalLen = firstBuf.byteLength;

  const chunks: ArrayBuffer[] = [firstBuf];
  let downloadedBytes = firstBuf.byteLength;
  const directAudioUrl = firstRes.headers.get('x-direct-audio-url') || '';

  // Fast CDN direct-CORS path when backend resolves a CORS-open audio URL (avoids repeated serverless round-trips)
  if (downloadedBytes < totalLen && directAudioUrl) {
    try {
      const DIRECT_CHUNK = 8_388_608;
      while (downloadedBytes < totalLen) {
        const end = Math.min(totalLen - 1, downloadedBytes + DIRECT_CHUNK - 1);
        const directRes = await fetch(directAudioUrl, {
          headers: { Range: `bytes=${downloadedBytes}-${end}` },
          signal: AbortSignal.timeout ? AbortSignal.timeout(45000) : undefined,
        });
        if (!directRes.ok && directRes.status !== 206) break;
        const buf = await directRes.arrayBuffer();
        if (!buf || buf.byteLength === 0) break;
        chunks.push(buf);
        downloadedBytes += buf.byteLength;
      }
    } catch {}
  }

  if (downloadedBytes < totalLen) {
    const nextParams = new URLSearchParams();
    if (resolvedVideoId) {
      nextParams.set('videoId', resolvedVideoId);
    } else {
      nextParams.set('q', query);
      if (track.name) nextParams.set('title', track.name);
      if (artist) nextParams.set('artist', artist);
    }
    nextParams.set('trackId', clean);
    const nextUrl = `${baseOrigin}/api/audio/stream?${nextParams.toString()}`;

    while (downloadedBytes < totalLen) {
      const end = Math.min(totalLen - 1, downloadedBytes + CHUNK_SIZE - 1);
      const chunkRes = await fetch(nextUrl, {
        headers: { Range: `bytes=${downloadedBytes}-${end}` },
        signal: AbortSignal.timeout ? AbortSignal.timeout(35000) : undefined,
      });
      if (!chunkRes.ok && chunkRes.status !== 206) {
        return null;
      }
      const buf = await chunkRes.arrayBuffer();
      if (!buf || buf.byteLength === 0) break;
      chunks.push(buf);
      downloadedBytes += buf.byteLength;
    }
  }

  const finalBlob = new Blob(chunks, { type: mimeType });
  if (finalBlob.size < 35_000) return null;
  if (totalLen > 0 && finalBlob.size < Math.floor(totalLen * 0.98)) return null;

  return { blob: finalBlob, mimeType, ext, size: finalBlob.size, track };
}

/**
 * Direct CORS fallback via tracks.monochrome.st when backend servers cannot extract the track.
 */
async function fetchDirectAudioViaMonochrome(track: Track): Promise<StoredTrackEntry | null> {
  if (track?.id?.startsWith('sc-')) return null;
  try {
    const rawTitle = track.name || '';
    const rawArtist = track.artists?.[0]?.name || '';
    const cleanQ = `${rawTitle} ${rawArtist}`
      .replace(/\s*[\[(](official.*?|remastered.*?|explicit|bonus track)[\])]/gi, '')
      .trim();
    if (!cleanQ) return null;

    const searchRes = await fetch(
      `https://tracks.monochrome.st/search/tracks?q=${encodeURIComponent(cleanQ)}&limit=8`,
      { signal: AbortSignal.timeout ? AbortSignal.timeout(6000) : undefined }
    );
    if (!searchRes.ok) return null;
    const data = await searchRes.json();
    const items: any[] = Array.isArray(data?.tracks) ? data.tracks : [];
    if (items.length === 0) return null;

    const norm = (s = '') =>
      s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
    const targetTitle = norm(rawTitle);
    const targetArtist = norm(rawArtist);
    const titleTokens = targetTitle.split(' ').filter((w) => w.length >= 2);
    const targetDurSec = track.duration_ms ? Math.round(track.duration_ms / 1000) : 0;

    let best: any = null;
    let bestScore = -999;

    for (const item of items) {
      if (!item?.id || item.playable === false) continue;
      const candTitle = norm(item.title || '');
      const candArtists = norm(Array.isArray(item.artistNames) ? item.artistNames.join(' ') : '');
      const candFull = `${candTitle} ${candArtists}`.trim();
      const candDurSec = Math.round((Number(item.duration) || 0) / 1000);
      if (candDurSec > 0 && candDurSec < 45 && !(targetDurSec > 0 && targetDurSec < 45)) continue;
      if (targetDurSec > 35 && candDurSec > 0 && Math.abs(candDurSec - targetDurSec) > 22) continue;
      if (!targetFullAllows(candFull, targetTitle)) continue;

      let score = 0;
      if (candTitle === targetTitle) score += 80;
      if (titleTokens.length > 0) {
        const hits = titleTokens.filter((w) => candFull.includes(w)).length;
        if (hits / titleTokens.length < 0.5) continue;
        score += Math.round((hits / titleTokens.length) * 50);
      }
      if (targetArtist) {
        const aTokens = targetArtist.split(' ').filter((w) => w.length >= 2);
        const aHits = aTokens.filter((w) => candFull.includes(w)).length;
        score += aHits > 0 ? 45 : -60;
      }
      if (targetDurSec > 35 && candDurSec > 0) {
        score += Math.abs(candDurSec - targetDurSec) <= 5 ? 35 : 10;
      }
      if (score >= 35 && score > bestScore) {
        bestScore = score;
        best = item;
      }
    }

    if (!best?.id) return null;
    const binRes = await fetch(`https://tracks.monochrome.st/track/${best.id}`, {
      signal: AbortSignal.timeout ? AbortSignal.timeout(45000) : undefined,
    });
    if (!binRes.ok) return null;
    const blob = await binRes.blob();
    const check = await validateAudioBlob(blob);
    if (!check.valid) return null;
    const mimeType = check.mime || 'audio/flac';
    return {
      blob: blob.type ? blob : new Blob([blob], { type: mimeType }),
      mimeType,
      ext: check.ext || 'flac',
      size: blob.size,
      track,
    };
  } catch {
    return null;
  }
}

function targetFullAllows(candNorm: string, targetTitleNorm: string): boolean {
  for (const tag of ['karaoke', 'instrumental', 'tribute', 'backing track', '8d audio', 'slowed', 'sped up']) {
    if (candNorm.includes(tag) && !targetTitleNorm.includes(tag)) return false;
  }
  return true;
}

function base64ToUint8Array(b64: string): Uint8Array {
  const cleanB64 = b64.includes(',') && b64.startsWith('data:') ? b64.slice(b64.indexOf(',') + 1) : b64;
  const bin = atob(cleanB64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function fetchDirectAudioViaCapacitor(track: Track, knownVideoId?: string | null): Promise<StoredTrackEntry | null> {
  if (!Capacitor.isNativePlatform()) return null;
  if (track?.id?.startsWith('sc-') || knownVideoId?.startsWith('sc:') || knownVideoId?.startsWith('mono:')) return null;

  try {
    let videoId = knownVideoId || getCachedVideoIdForTrack(track);
    if (!videoId) {
      const artist = track.artists?.[0]?.name || '';
      const q = `${track.name} ${artist}`.trim();
      const dur = track.duration_ms ? Math.round(track.duration_ms / 1000) : 0;
      const params = new URLSearchParams({ q, title: track.name || '' });
      if (artist) params.set('artist', artist);
      if (dur > 35) params.set('duration', String(dur));
      const r = await fetch(`${API_BASE}/api/audio/resolve?${params.toString()}`);
      if (r.ok) {
        const d = await r.json();
        if (d?.videoId) videoId = d.videoId;
      }
    }
    if (!videoId) return null;

    // Step 1: Retrieve fresh visitorData from YouTube using the device's own IP
    let visitorData = '';
    try {
      const swRes = await CapacitorHttp.get({
        url: 'https://www.youtube.com/sw.js_data',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        },
        responseType: 'text',
        connectTimeout: 8000,
        readTimeout: 8000,
      });
      const text = typeof swRes.data === 'string' ? swRes.data : JSON.stringify(swRes.data || '');
      const m = text.match(/"(Cg[a-zA-Z0-9_%-]{20,})"/);
      if (m?.[1]) visitorData = m[1];
    } catch {}

    // Step 2: Query Innertube VISIONOS client directly from the phone (zero bot block, zero 1MB limit)
    const playerRes = await CapacitorHttp.post({
      url: `https://www.youtube.com/youtubei/v1/player?key=${YT_PLAYER_KEY}&prettyPrint=false`,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15',
        'X-YouTube-Client-Name': '101',
        'X-YouTube-Client-Version': '1.02',
        ...(visitorData ? { 'X-Goog-Visitor-Id': visitorData } : {}),
      },
      data: {
        videoId,
        context: {
          client: {
            clientName: 'VISIONOS',
            clientVersion: '1.02',
            deviceMake: 'Apple',
            deviceModel: 'RealityDevice17,1',
            osName: 'visionOS',
            osVersion: '26.5.23O471',
            visitorData,
            hl: 'es',
            gl: 'ES',
          },
        },
        contentCheckOk: true,
        racyCheckOk: true,
      },
      connectTimeout: 10000,
      readTimeout: 10000,
    });

    const pData = typeof playerRes.data === 'string' ? JSON.parse(playerRes.data) : playerRes.data;
    if (pData?.playabilityStatus?.status !== 'OK') return null;

    const formats = [...(pData.streamingData?.adaptiveFormats || []), ...(pData.streamingData?.formats || [])].filter(
      (f: any) => f.mimeType?.startsWith('audio/') && f.url
    );
    const chosen =
      formats.find((f: any) => String(f.itag) === '140') ||
      formats.filter((f: any) => f.mimeType?.includes('mp4')).sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0))[0] ||
      formats[0];

    if (!chosen?.url) return null;

    const totalLen = parseInt(String(chosen.contentLength || '0'), 10) || 0;
    const mimeType = String(chosen.mimeType || 'audio/mp4').split(';')[0].trim();
    const ext = mimeToExt(mimeType);

    // Download audio in 1.5 MB native HTTP chunks to prevent Android bridge OOM
    const CHUNK = 1_572_864;
    const parts: BlobPart[] = [];
    let offset = 0;
    const expectedTotal = totalLen > 0 ? totalLen : 20_000_000;

    while (offset < expectedTotal) {
      const end = totalLen > 0 ? Math.min(totalLen - 1, offset + CHUNK - 1) : offset + CHUNK - 1;
      const chunkRes = await CapacitorHttp.get({
        url: chosen.url,
        headers: { Range: `bytes=${offset}-${end}` },
        responseType: 'arraybuffer',
        connectTimeout: 15000,
        readTimeout: 30000,
      });

      if (chunkRes.status !== 200 && chunkRes.status !== 206) {
        if (offset === 0) return null;
        break;
      }

      const bytes = typeof chunkRes.data === 'string' ? base64ToUint8Array(chunkRes.data) : null;
      if (!bytes || bytes.byteLength === 0) break;

      if (offset === 0) {
        const check = sniffAudioFormat(bytes.subarray(0, 32));
        if (!check.valid) return null;
      }

      const buf = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(buf).set(bytes);
      parts.push(buf);
      offset += bytes.byteLength;

      if (totalLen === 0 && bytes.byteLength < CHUNK) break;
    }

    const blob = new Blob(parts, { type: mimeType });
    if (blob.size < 35_000) return null;
    if (totalLen > 0 && blob.size < Math.floor(totalLen * 0.98)) return null;

    return { blob, mimeType, ext, size: blob.size, track };
  } catch (err) {
    console.warn('[offlineStorage] CapacitorHttp direct extraction failed:', err);
    return null;
  }
}

async function persistDownloadedEntry(clean: string, track: Track, entry: StoredTrackEntry): Promise<boolean> {
  try {
    try {
      await navigator.storage?.persist?.();
    } catch {}

    // 1. Native Android app-private offline storage (survives across web <-> offline.html origin switches!)
    const artist = track.artists?.[0]?.name || 'Artista';
    const rawName = `${artist} - ${track.name}`.trim();
    const safeFilename = `${rawName.replace(/[/\\?%*:|"<>]/g, '_')}.${entry.ext || 'm4a'}`;
    if (isDeviceMusicAvailable()) {
      await saveNativeOfflineTrack(clean, entry.blob, entry.ext, entry.mimeType, track, safeFilename, false).catch(() => false);
    }

    // 2. CacheStorage "musica-spotifree"
    if ('caches' in window) {
      try {
        const cache = await caches.open(CACHE_NAME);
        const cacheKey = `/musica-spotifree/tracks/${clean}.mp3`;
        const responseToCache = new Response(entry.blob, {
          headers: {
            'Content-Type': entry.mimeType || 'audio/mp4',
            'Content-Length': String(entry.blob.size),
            'X-Track-Id': clean,
            'X-Track-Title': encodeURIComponent(track.name),
            'X-Audio-Source': 'full',
            'X-Audio-Mime': entry.mimeType || 'audio/mp4',
            'X-Audio-Ext': entry.ext || 'm4a',
          },
        });
        await cache.put(cacheKey, responseToCache);
      } catch {}
    }

    // 3. IndexedDB (reliable binary Blob store)
    await idbPutTrack(clean, { ...entry, track }).catch(() => {});

    // 4. OPFS directory "musica-spotifree"
    try {
      if (typeof navigator !== 'undefined' && navigator.storage && (navigator.storage as any).getDirectory) {
        const root = await (navigator.storage as any).getDirectory();
        const dir = await root.getDirectoryHandle('musica-spotifree', { create: true });
        const fh = await dir.getFileHandle(`${clean}.${entry.ext || 'm4a'}`, { create: true });
        const writable = await fh.createWritable();
        await writable.write(entry.blob);
        await writable.close();
      }
    } catch {}

    // 5. Track metadata in localStorage
    try {
      window.localStorage.setItem(
        `${TRACK_META_PREFIX}${clean}`,
        JSON.stringify({ ...track, _offlineExt: entry.ext, _offlineMime: entry.mimeType })
      );
    } catch {}

    notifyDownloadsChanged(clean);
    return true;
  } catch (e) {
    console.warn('[offlineStorage] persistDownloadedEntry error:', e);
    return false;
  }
}

export async function downloadTrackAudio(track: Track): Promise<boolean> {
  if (typeof window === 'undefined' || !track) return false;

  if (track.id.startsWith('local-dev-')) {
    try {
      window.localStorage.setItem(`${TRACK_META_PREFIX}${track.id}`, JSON.stringify(track));
      notifyDownloadsChanged(track.id);
    } catch {}
    return true;
  }

  const clean = cleanTrackId(track.id);
  if (!clean) return false;

  if (await isTrackDownloaded(track.id)) {
    return true;
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return false;
  }

  const scMatch = String(clean || '').match(/^sc-(\d+)$/);
  const knownVideoId = scMatch ? `sc:${scMatch[1]}` : getCachedVideoIdForTrack(track) || (track.scAltId || null);
  let extracted: StoredTrackEntry | null = null;

  // On Capacitor APK, try phone residential IP YouTube M4A (~3.5 MB) first before server FLAC/stream
  if (Capacitor.isNativePlatform()) {
    extracted = await fetchDirectAudioViaCapacitor(track, knownVideoId);
  }

  // Primary backend streaming endpoint (Vercel / configured API_BASE with YouTube + Monochrome + SoundCloud)
  if (!extracted) {
    try {
      extracted = await fetchChunkedAudioFromBackend(API_BASE, track, knownVideoId);
    } catch (e) {
      console.warn(`[offlineStorage] Primary backend strategy failed for ${track.name}:`, e);
    }
  }

  // Direct CORS Monochrome lossless CDN fallback (works even if backend API is temporarily unavailable)
  if (!extracted) {
    extracted = await fetchDirectAudioViaMonochrome(track);
  }

  // Render cloud backend fallback
  if (!extracted && API_BASE !== RENDER_BACKEND_BASE) {
    try {
      extracted = await fetchChunkedAudioFromBackend(RENDER_BACKEND_BASE, track, knownVideoId);
    } catch (e) {
      console.warn(`[offlineStorage] Render backend strategy failed for ${track.name}:`, e);
    }
  }

  if (!extracted) return false;

  return persistDownloadedEntry(clean, track, extracted);
}

export async function deleteDownloadedTrack(trackId: string): Promise<void> {
  if (typeof window === 'undefined') return;
  const clean = cleanTrackId(trackId);
  if (!clean) return;

  await deleteNativeOfflineTrack(clean);

  try {
    if ('caches' in window) {
      const cache = await caches.open(CACHE_NAME);
      await cache.delete(`/musica-spotifree/tracks/${clean}.mp3`);
      if (clean !== trackId) {
        await cache.delete(`/musica-spotifree/tracks/${trackId}.mp3`);
      }
    }
  } catch {}

  await idbDeleteTrack(clean);

  try {
    if (typeof navigator !== 'undefined' && navigator.storage && (navigator.storage as any).getDirectory) {
      const root = await (navigator.storage as any).getDirectory();
      const dir = await root.getDirectoryHandle('musica-spotifree');
      for (const ext of ['mp3', 'm4a', 'webm', 'ogg', 'flac', 'wav']) {
        await dir.removeEntry(`${clean}.${ext}`).catch(() => {});
      }
    }
  } catch {}

  try {
    window.localStorage.removeItem(`${TRACK_META_PREFIX}${clean}`);
  } catch {}

  notifyDownloadsChanged(clean);
}

/**
 * Save / Export track as a real playable audio file on user's device.
 */
export async function saveTrackAsMp3File(track: Track): Promise<boolean> {
  if (typeof window === 'undefined' || !track) return false;
  const artist = track.artists?.[0]?.name || 'Artista';
  const rawName = `${artist} - ${track.name}`.trim().replace(/[/\\?%*:|"<>]/g, '_');

  let entry = await getStoredAudioEntry(track.id);
  if (!entry) {
    const ok = await downloadTrackAudio(track);
    if (!ok) return false;
    entry = await getStoredAudioEntry(track.id);
  }
  if (!entry?.blob) return false;

  const safeFilename = `${rawName}.${entry.ext || 'm4a'}`;

  // On Android APK: write straight into Music/Spotifree/ via native MediaStore (visible in Files & local music!)
  if (isDeviceMusicAvailable()) {
    const nativeSaved = await saveNativePublicMusicFile(entry.blob, safeFilename, entry.mimeType);
    if (nativeSaved) return true;
  }

  // On desktop / mobile browser (or APK fallback): trigger real file download with matched extension
  try {
    const typedBlob = entry.blob.type ? entry.blob : new Blob([entry.blob], { type: entry.mimeType || 'audio/mp4' });
    const blobUrl = URL.createObjectURL(typedBlob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = safeFilename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      try { document.body.removeChild(a); } catch {}
      URL.revokeObjectURL(blobUrl);
    }, 1500);
    return true;
  } catch (err) {
    console.error('[offlineStorage] saveTrackAsMp3File failed:', err);
    return false;
  }
}

export function isPlaylistDownloaded(playlistId: string): boolean {
  if (typeof window === 'undefined' || !playlistId) return false;
  const clean = playlistId.replace(/^spotify:(playlist|album):/, '').split('?')[0];
  try {
    const listRaw = window.localStorage.getItem(PLAYLISTS_LIST_KEY);
    if (!listRaw) return false;
    const list: string[] = JSON.parse(listRaw);
    return list.includes(playlistId) || list.includes(clean);
  } catch {
    return false;
  }
}

/**
 * Download all tracks of a playlist with concurrency and real progress reporting.
 */
export async function downloadPlaylist(
  playlist: Playlist,
  tracks: Track[],
  onProgress?: (completed: number, total: number) => void
): Promise<{ total: number; downloaded: number; offline?: boolean }> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { total: tracks.length, downloaded: 0, offline: true };
  }

  const total = tracks.length;
  let completed = 0;
  let successful = 0;

  if (total === 0) {
    return { total: 0, downloaded: 0 };
  }

  // Concurrency worker pool (2 parallel downloads = 2x faster playlists without rate-limit spikes)
  let nextIdx = 0;
  const workerCount = Math.min(2, total);

  const worker = async () => {
    while (true) {
      const idx = nextIdx++;
      if (idx >= total) break;
      const track = tracks[idx];
      try {
        const already = await isTrackDownloaded(track.id);
        if (already) {
          successful++;
        } else {
          const ok = await downloadTrackAudio(track);
          if (ok) successful++;
        }
      } catch {}
      completed++;
      onProgress?.(completed, total);
    }
  };

  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  const cleanPlId = playlist.id.replace(/^spotify:(playlist|album):/, '').split('?')[0];

  if (typeof window !== 'undefined' && successful > 0) {
    try {
      const offlinePl = {
        ...playlist,
        tracks: { total: tracks.length, items: tracks },
        downloadedAt: Date.now(),
      };
      window.localStorage.setItem(`${METADATA_KEY_PREFIX}${playlist.id}`, JSON.stringify(offlinePl));
      if (cleanPlId && cleanPlId !== playlist.id) {
        window.localStorage.setItem(`${METADATA_KEY_PREFIX}${cleanPlId}`, JSON.stringify(offlinePl));
      }
      window.localStorage.setItem(`spotifree_playlist_tracks_${cleanPlId}`, JSON.stringify(tracks));

      const listRaw = window.localStorage.getItem(PLAYLISTS_LIST_KEY);
      const list: string[] = listRaw ? JSON.parse(listRaw) : [];
      if (!list.includes(playlist.id)) list.push(playlist.id);
      if (cleanPlId && !list.includes(cleanPlId)) list.push(cleanPlId);
      window.localStorage.setItem(PLAYLISTS_LIST_KEY, JSON.stringify(list));

      if (isDeviceMusicAvailable()) {
        await saveNativeOfflinePlaylist(cleanPlId || playlist.id, offlinePl).catch(() => {});
      }
    } catch {}
  }

  notifyDownloadsChanged();
  return { total, downloaded: successful };
}

export async function deleteDownloadedPlaylist(playlistId: string, trackIds?: string[]): Promise<void> {
  if (typeof window === 'undefined') return;
  const cleanPlId = playlistId.replace(/^spotify:(playlist|album):/, '').split('?')[0];

  await deleteNativeOfflinePlaylist(playlistId);
  if (cleanPlId && cleanPlId !== playlistId) {
    await deleteNativeOfflinePlaylist(cleanPlId);
  }

  try {
    const listRaw = window.localStorage.getItem(PLAYLISTS_LIST_KEY);
    if (listRaw) {
      const list: string[] = JSON.parse(listRaw).filter((id: string) => id !== playlistId && id !== cleanPlId);
      window.localStorage.setItem(PLAYLISTS_LIST_KEY, JSON.stringify(list));
    }
    window.localStorage.removeItem(`${METADATA_KEY_PREFIX}${playlistId}`);
    if (cleanPlId) window.localStorage.removeItem(`${METADATA_KEY_PREFIX}${cleanPlId}`);
    window.localStorage.removeItem(`spotifree_downloaded_${playlistId}`);
    if (cleanPlId) window.localStorage.removeItem(`spotifree_downloaded_${cleanPlId}`);

    if (trackIds && trackIds.length > 0) {
      for (const id of trackIds) {
        await deleteDownloadedTrack(id);
      }
    }
  } catch {}

  notifyDownloadsChanged();
}

export function getDownloadedPlaylists(): Playlist[] {
  if (typeof window === 'undefined') return [];
  try {
    const listRaw = window.localStorage.getItem(PLAYLISTS_LIST_KEY);
    if (!listRaw) return [];
    const ids: string[] = JSON.parse(listRaw);
    const result: Playlist[] = [];
    const seen = new Set<string>();

    for (const id of ids) {
      const clean = id.replace(/^spotify:(playlist|album):/, '').split('?')[0];
      if (seen.has(clean)) continue;
      const raw =
        window.localStorage.getItem(`${METADATA_KEY_PREFIX}${id}`) ||
        window.localStorage.getItem(`${METADATA_KEY_PREFIX}${clean}`);
      if (raw) {
        const pl = JSON.parse(raw) as Playlist;
        seen.add(clean);
        result.push(pl);
      }
    }
    return result;
  } catch {
    return [];
  }
}

export function getDownloadedTracks(): Track[] {
  if (typeof window === 'undefined') return [];
  const tracks: Track[] = [];
  const seenIds = new Set<string>();

  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(TRACK_META_PREFIX)) {
        try {
          const raw = window.localStorage.getItem(key);
          if (raw) {
            const trk = JSON.parse(raw) as Track;
            if (trk && trk.id && !seenIds.has(cleanTrackId(trk.id))) {
              seenIds.add(cleanTrackId(trk.id));
              tracks.push(trk);
            }
          }
        } catch {}
      }
    }
  } catch {}

  return tracks;
}

export async function getStorageUsage(): Promise<{ usedBytes: number; formatted: string }> {
  let bytes = 0;

  try {
    const nativeData = await listNativeOfflineData();
    if (nativeData?.tracks?.length) {
      for (const t of nativeData.tracks) {
        if (typeof t?._nativeSize === 'number') bytes += t._nativeSize;
      }
    }
  } catch {}

  if (bytes === 0) {
    try {
      if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        if (estimate.usage) {
          bytes = estimate.usage;
        }
      }
    } catch {}
  }

  if (bytes === 0 && typeof window !== 'undefined' && 'caches' in window) {
    try {
      const cache = await caches.open(CACHE_NAME);
      const keys = await cache.keys();
      for (const k of keys) {
        const m = await cache.match(k);
        const len = parseInt(m?.headers.get('content-length') || '0', 10);
        bytes += len > 0 ? len : 3.5 * 1024 * 1024;
      }
    } catch {}
  }

  let formatted = '0.0 MB';
  if (bytes > 1024 * 1024 * 1024) {
    formatted = `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  } else if (bytes > 0) {
    formatted = `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return { usedBytes: bytes, formatted };
}

export async function clearOfflineCache(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const nativeData = await listNativeOfflineData();
    if (nativeData?.tracks) {
      for (const t of nativeData.tracks) {
        if (t?.id) await deleteNativeOfflineTrack(cleanTrackId(String(t.id)));
      }
    }
    if (nativeData?.playlists) {
      for (const p of nativeData.playlists) {
        if (p?.id) await deleteNativeOfflinePlaylist(String(p.id));
      }
    }
  } catch {}

  try {
    if ('caches' in window) {
      await caches.delete(CACHE_NAME);
    }

    await idbClearAll();

    try {
      if (navigator.storage && (navigator.storage as any).getDirectory) {
        const root = await (navigator.storage as any).getDirectory();
        await root.removeEntry('musica-spotifree', { recursive: true });
      }
    } catch {}

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
