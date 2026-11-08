/**
 * APK: the music already on the phone (native/android/SpotifreeLocalMusicPlugin.java).
 * The songs are listed in "Archivos locales" and "Descargas" and play from their own files.
 * Songs of the user's playlists that are on the phone play from the phone too (offline), see
 * findLocalMatch().
 */
import { Capacitor, registerPlugin } from '@capacitor/core';
import type { Track } from '../types/spotify';
import { LOCAL_FILES_EVENT, LOCAL_FILES_PLAYLIST_ID } from './localFiles';

interface DeviceSong {
  id: number;
  title: string;
  artist: string;
  album: string;
  albumId: number;
  durationMs: number;
  path: string;
  size: number;
  dateAdded: number;
}

interface LocalMusicPlugin {
  status(): Promise<{ available: boolean; granted: boolean }>;
  scan(o: { request: boolean }): Promise<{ granted: boolean; tracks: DeviceSong[]; error?: string }>;
  artwork(o: { albumId: number; id: number }): Promise<{ dataUrl: string | null }>;
}

const LocalMusic = registerPlugin<LocalMusicPlugin>('SpotifreeLocalMusic');
export const DEVICE_PREFIX = 'local-dev-';
const CACHE_KEY = 'spotifree_device_music_v1';
const ART_KEY = 'spotifree_device_art_v1';

export function isDeviceMusicAvailable(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('SpotifreeLocalMusic');
  } catch {
    return false;
  }
}

let songs: DeviceSong[] = (() => {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || '[]');
  } catch {
    return [];
  }
})();
const art: Record<string, string> = (() => {
  try {
    return JSON.parse(localStorage.getItem(ART_KEY) || '{}');
  } catch {
    return {};
  }
})();
let permission: boolean | null = null;

function toTrack(s: DeviceSong): Track {
  const artist = s.artist || 'Artista desconocido';
  const cover = art[String(s.albumId)];
  return {
    id: `${DEVICE_PREFIX}${s.id}`,
    name: s.title || s.path.split('/').pop() || 'Canción',
    artists: [{ id: `${DEVICE_PREFIX}artist-${artist}`, name: artist }],
    album: { id: `${DEVICE_PREFIX}album-${s.albumId}`, name: s.album || 'Archivos locales', images: cover ? [{ url: cover }] : [] },
    duration_ms: s.durationMs || 180000,
    preview_url: null,
    playlistId: LOCAL_FILES_PLAYLIST_ID,
    added_at: new Date((s.dateAdded || 0) * 1000).toISOString(),
  } as Track;
}

/** Songs found on the phone in the last scan (also offline) */
export function deviceTracks(): Track[] {
  return songs.map(toTrack);
}

export function devicePermissionGranted(): boolean | null {
  return permission;
}

function notify() {
  rebuildIndex();
  try {
    window.dispatchEvent(new CustomEvent(LOCAL_FILES_EVENT));
  } catch {}
}

let scanning: Promise<boolean> | null = null;
/** Reads the phone's music. request=true asks for the permission if needed. */
export function scanDeviceMusic(request = false): Promise<boolean> {
  if (!isDeviceMusicAvailable()) return Promise.resolve(false);
  if (scanning) return scanning;
  scanning = (async () => {
    try {
      const r = await LocalMusic.scan({ request });
      permission = r.granted;
      if (!r.granted) return false;
      songs = (r.tracks || []).filter((s) => s && s.path);
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(songs));
      } catch {}
      notify();
      void loadArtwork();
      return true;
    } catch {
      return false;
    } finally {
      scanning = null;
    }
  })();
  return scanning;
}

/** Album covers, one per album, in the background (kept for next time) */
async function loadArtwork() {
  const albums = new Map<number, number>();
  for (const s of songs) if (!albums.has(s.albumId) && !art[String(s.albumId)]) albums.set(s.albumId, s.id);
  let changed = 0;
  for (const [albumId, id] of albums) {
    try {
      const r = await LocalMusic.artwork({ albumId, id });
      if (r?.dataUrl) {
        art[String(albumId)] = r.dataUrl;
        changed++;
      } else {
        art[String(albumId)] = '';
      }
    } catch {}
    if (changed && changed % 12 === 0) notify();
  }
  try {
    localStorage.setItem(ART_KEY, JSON.stringify(art));
  } catch {
    // Too many covers for localStorage: keep them for this session only
  }
  if (changed) notify();
}

/** URL the web player can play (the file itself, through Capacitor) */
export function getDeviceTrackUrl(id: string): string | null {
  const s = songs.find((x) => `${DEVICE_PREFIX}${x.id}` === id);
  if (!s) return null;
  try {
    return Capacitor.convertFileSrc(`file://${s.path}`);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Playlist songs that are on the phone
// ---------------------------------------------------------------------------
export function normalizeForMatch(s = ''): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s*[([].*?[)\]]/g, '')
    .replace(/\s+-\s+.*(remaster|version|edit|mix).*$/i, '')
    .replace(/\b(feat|ft)\.?\s.*$/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

let index = new Map<string, string>(); // normalized title -> device track id (+ artist check)
let indexArtists = new Map<string, string>();
function rebuildIndex() {
  index = new Map();
  indexArtists = new Map();
  for (const s of songs) {
    const key = normalizeForMatch(s.title);
    if (!key || index.has(key)) continue;
    index.set(key, `${DEVICE_PREFIX}${s.id}`);
    indexArtists.set(key, normalizeForMatch(s.artist));
  }
}
rebuildIndex();

/** The phone's copy of a playlist song (same title and artist), if there is one */
export function findDeviceMatch(track: Pick<Track, 'name' | 'artists'> | null | undefined): string | null {
  if (!track?.name || index.size === 0) return null;
  const key = normalizeForMatch(track.name);
  const id = index.get(key);
  if (!id) return null;
  const devArtist = indexArtists.get(key) || '';
  const artists = (track.artists || []).map((a) => normalizeForMatch(a?.name));
  // Same artist (or the file has no artist tag but the title is long enough to be specific)
  const ok = devArtist ? artists.some((a) => a && (devArtist.includes(a) || a.includes(devArtist))) : key.length >= 8;
  return ok ? id : null;
}
