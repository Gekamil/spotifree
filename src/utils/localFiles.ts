/**
 * "Archivos locales": songs the user adds from their own phone or computer. The audio is kept
 * inside the app (IndexedDB), so they play with no connection at all (airplane mode).
 * Title / artist / cover come from the file's tags (ID3) or, failing that, from its name.
 */
import type { Track } from '../types/spotify';

export const LOCAL_FILES_PLAYLIST_ID = 'local-files';
export const LOCAL_FILES_EVENT = 'spotifree:local-files-changed';
const ID_PREFIX = 'local-';

export function isLocalTrackId(id?: string | null): boolean {
  return typeof id === 'string' && id.startsWith(ID_PREFIX);
}

interface LocalRecord {
  id: string;
  track: Track;
  blob: Blob;
  size: number;
  addedAt: number;
}

// ---------------------------------------------------------------------------
// IndexedDB
// ---------------------------------------------------------------------------
const DB_NAME = 'spotifree-local-files';
const STORE = 'tracks';
let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      })
  );
}

function notify() {
  try {
    window.dispatchEvent(new CustomEvent(LOCAL_FILES_EVENT));
  } catch {}
}

// ---------------------------------------------------------------------------
// Reading the files
// ---------------------------------------------------------------------------
function hashString(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function decodeText(bytes: Uint8Array, encoding: number): string {
  try {
    if (encoding === 0) return new TextDecoder('latin1').decode(bytes);
    if (encoding === 1) return new TextDecoder('utf-16').decode(bytes);
    if (encoding === 2) return new TextDecoder('utf-16be').decode(bytes);
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    return '';
  }
}

const clean = (s: string) => s.replace(/\u0000/g, ' ').replace(/\s+/g, ' ').trim();

/** Index just after the text terminator (1 zero byte, or 2 for UTF-16) */
function skipTerminated(b: Uint8Array, from: number, encoding: number): number {
  if (encoding === 1 || encoding === 2) {
    for (let i = from; i + 1 < b.length; i += 2) if (b[i] === 0 && b[i + 1] === 0) return i + 2;
  } else {
    for (let i = from; i < b.length; i++) if (b[i] === 0) return i + 1;
  }
  return b.length;
}

interface Tags {
  title?: string;
  artist?: string;
  album?: string;
  cover?: Blob;
}

/** ID3v2.3 / 2.4 tags of an MP3 (title, artist, album, cover) */
async function readId3(file: File): Promise<Tags> {
  const head = new Uint8Array(await file.slice(0, 10).arrayBuffer());
  if (head[0] !== 0x49 || head[1] !== 0x44 || head[2] !== 0x33) return {};
  const version = head[3];
  if (version !== 3 && version !== 4) return {};
  const tagSize = ((head[6] & 0x7f) << 21) | ((head[7] & 0x7f) << 14) | ((head[8] & 0x7f) << 7) | (head[9] & 0x7f);
  const b = new Uint8Array(await file.slice(10, 10 + Math.min(tagSize, 4_000_000)).arrayBuffer());
  const tags: Tags = {};
  let p = 0;
  while (p + 10 <= b.length) {
    const id = String.fromCharCode(b[p], b[p + 1], b[p + 2], b[p + 3]);
    if (!/^[A-Z0-9]{4}$/.test(id)) break;
    const size =
      version === 4
        ? ((b[p + 4] & 0x7f) << 21) | ((b[p + 5] & 0x7f) << 14) | ((b[p + 6] & 0x7f) << 7) | (b[p + 7] & 0x7f)
        : (b[p + 4] << 24) | (b[p + 5] << 16) | (b[p + 6] << 8) | b[p + 7];
    const start = p + 10;
    const end = Math.min(b.length, start + size);
    if (size <= 0 || end <= start) break;
    const data = b.subarray(start, end);
    if (id === 'TIT2' || id === 'TPE1' || id === 'TALB') {
      const text = clean(decodeText(data.subarray(1), data[0]));
      if (id === 'TIT2') tags.title = text;
      else if (id === 'TPE1') tags.artist = text.split('/')[0].trim();
      else tags.album = text;
    } else if (id === 'APIC' && !tags.cover) {
      const enc = data[0];
      const mimeEnd = skipTerminated(data, 1, 0);
      const mime = decodeText(data.subarray(1, mimeEnd - 1), 0) || 'image/jpeg';
      const descEnd = skipTerminated(data, mimeEnd + 1, enc);
      const img = data.subarray(descEnd);
      if (img.length > 100) tags.cover = new Blob([img.slice()], { type: mime.includes('/') ? mime : `image/${mime.toLowerCase()}` });
    }
    p = end;
  }
  return tags;
}

/** "Artista - Título.mp3" → both parts; otherwise just the title */
function fromFileName(name: string): Tags {
  const base = name.replace(/\.[a-z0-9]{2,5}$/i, '').replace(/_/g, ' ').trim();
  const m = base.match(/^(?:\d{1,3}[\s.-]+)?(.+?)\s+-\s+(.+)$/);
  return m ? { artist: m[1].trim(), title: m[2].trim() } : { title: base };
}

/** Small JPEG of the cover (keeps the library light) */
async function coverDataUrl(blob: Blob): Promise<string | null> {
  try {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error('cover'));
      img.src = url;
    });
    const size = 300;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const s = Math.min(img.naturalWidth, img.naturalHeight);
    ctx.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, size, size);
    URL.revokeObjectURL(url);
    return canvas.toDataURL('image/jpeg', 0.82);
  } catch {
    return null;
  }
}

function readDurationMs(file: Blob): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const a = new Audio();
    let done = false;
    const finish = (ms: number) => {
      if (done) return;
      done = true;
      URL.revokeObjectURL(url);
      resolve(ms);
    };
    a.preload = 'metadata';
    a.onloadedmetadata = () => finish(isFinite(a.duration) ? Math.round(a.duration * 1000) : 0);
    a.onerror = () => finish(0);
    setTimeout(() => finish(0), 6000);
    a.src = url;
  });
}

export function isAudioFile(f: File): boolean {
  return f.type.startsWith('audio/') || /\.(mp3|m4a|aac|flac|ogg|oga|opus|wav|webm)$/i.test(f.name);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export async function addLocalFiles(
  files: File[],
  onProgress?: (done: number, total: number) => void
): Promise<{ added: number; skipped: number }> {
  const audio = files.filter(isAudioFile);
  let added = 0;
  // Ask the browser not to clear these files when space is low
  try {
    await navigator.storage?.persist?.();
  } catch {}
  for (let i = 0; i < audio.length; i++) {
    const f = audio[i];
    try {
      const id = `${ID_PREFIX}${hashString(`${f.name}|${f.size}|${f.lastModified}`)}`;
      const tags = { ...fromFileName(f.name), ...(/\.mp3$/i.test(f.name) || f.type === 'audio/mpeg' ? await readId3(f) : {}) };
      const [durationMs, cover] = await Promise.all([readDurationMs(f), tags.cover ? coverDataUrl(tags.cover) : Promise.resolve(null)]);
      const artist = tags.artist || 'Artista desconocido';
      const track: Track = {
        id,
        name: tags.title || f.name,
        artists: [{ id: `${ID_PREFIX}artist-${hashString(artist)}`, name: artist }],
        album: { id: `${ID_PREFIX}album-${hashString(tags.album || artist)}`, name: tags.album || 'Archivos locales', images: cover ? [{ url: cover }] : [] },
        duration_ms: durationMs || 180000,
        preview_url: null,
        playlistId: LOCAL_FILES_PLAYLIST_ID,
        added_at: new Date().toISOString(),
      } as Track;
      await tx('readwrite', (s) => s.put({ id, track, blob: f, size: f.size, addedAt: Date.now() + i } as LocalRecord));
      added++;
    } catch (e) {
      console.warn('[localFiles] Could not add', f.name, e);
    }
    onProgress?.(i + 1, audio.length);
  }
  if (added) notify();
  return { added, skipped: files.length - added };
}

export async function listLocalTracks(): Promise<Track[]> {
  try {
    const all = await tx<LocalRecord[]>('readonly', (s) => s.getAll());
    return all.sort((a, b) => b.addedAt - a.addedAt).map((r) => r.track);
  } catch {
    return [];
  }
}

export async function getLocalFilesSize(): Promise<number> {
  try {
    const all = await tx<LocalRecord[]>('readonly', (s) => s.getAll());
    return all.reduce((n, r) => n + (r.size || 0), 0);
  } catch {
    return 0;
  }
}

const urlCache = new Map<string, string>();

/** Playable URL of a local song (kept while the app is open) */
export async function getLocalTrackUrl(id: string): Promise<string | null> {
  const cached = urlCache.get(id);
  if (cached) return cached;
  try {
    const rec = await tx<LocalRecord | undefined>('readonly', (s) => s.get(id));
    if (!rec?.blob) return null;
    const url = URL.createObjectURL(rec.blob);
    urlCache.set(id, url);
    return url;
  } catch {
    return null;
  }
}

export async function removeLocalTrack(id: string): Promise<void> {
  try {
    await tx('readwrite', (s) => s.delete(id));
  } catch {}
  const url = urlCache.get(id);
  if (url) {
    URL.revokeObjectURL(url);
    urlCache.delete(id);
  }
  notify();
}
