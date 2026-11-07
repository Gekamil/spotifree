/**
 * APK only: keeps the native media session (Android Auto, playback notification, lock screen,
 * Bluetooth / car stereo) in sync with the player, and runs the commands that come from there.
 * Native side: native/android/SpotifreeMediaService.java + SpotifreeMediaPlugin.java.
 */
import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { usePlayerStore } from '../store/usePlayerStore';
import { useSpotifyDataStore } from '../store/useSpotifyDataStore';
import { useLanguageStore } from '../utils/i18n';
import { fetchLyricsUnified, parseEnhancedLyrics, type SyncedLine } from '../utils/lyricsService';
import type { Track } from '../types/spotify';

interface MediaCommand {
  action: 'play' | 'pause' | 'next' | 'previous' | 'seek' | 'playFromMediaId' | 'playFromSearch';
  positionMs?: number;
  mediaId?: string;
  query?: string;
}

interface SpotifreeMediaPlugin {
  setLibrary(o: { playlists: unknown[] }): Promise<void>;
  updateNowPlaying(o: Record<string, unknown>): Promise<void>;
  stop(): Promise<void>;
  takePendingCommand(): Promise<{ command?: MediaCommand }>;
  addListener(event: 'command', cb: (c: MediaCommand) => void): Promise<PluginListenerHandle>;
}

const SpotifreeMedia = registerPlugin<SpotifreeMediaPlugin>('SpotifreeMedia');

/** Show the current lyric line on the car screen / Bluetooth display (setting, on by default) */
export const CAR_LYRICS_KEY = 'spotifree_car_lyrics';
export function getCarLyricsEnabled(): boolean {
  try {
    return window.localStorage.getItem(CAR_LYRICS_KEY) !== 'false';
  } catch {
    return true;
  }
}
export function setCarLyricsEnabled(on: boolean) {
  try {
    window.localStorage.setItem(CAR_LYRICS_KEY, on ? 'true' : 'false');
  } catch {}
  pushNowPlaying(true);
}

export function isNativeMediaAvailable(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('SpotifreeMedia');
  } catch {
    return false;
  }
}

const artist = (t?: Track | null) => (t?.artists || []).map((a) => a.name).filter(Boolean).join(', ');
const cover = (t?: Track | null) => t?.album?.images?.[0]?.url || '';

// ----------------------------------------------------------------- library (Android Auto)
let libraryTimer: number | undefined;
let lastLibrarySig = '';
function pushLibrary() {
  window.clearTimeout(libraryTimer);
  libraryTimer = window.setTimeout(() => {
    const { playlists } = useSpotifyDataStore.getState() as any;
    const lists: any[] = [];
    for (const p of (playlists || []) as any[]) {
      const items: Track[] = (p?.tracks?.items || []).map((x: any) => x?.track || x).filter((t: any) => t?.id && t?.name);
      if (!p?.id || items.length === 0) continue;
      lists.push({
        id: p.id,
        name: p.name || '',
        subtitle: p.owner?.display_name || p.description?.slice(0, 60) || '',
        tracks: items.slice(0, 150).map((t) => ({ id: t.id, title: t.name, artist: artist(t) })),
      });
      if (lists.length >= 50) break;
    }
    const sig = lists.map((l) => `${l.id}:${l.tracks.length}:${l.name}`).join('|');
    if (sig === lastLibrarySig) return;
    lastLibrarySig = sig;
    SpotifreeMedia.setLibrary({ playlists: lists }).catch(() => {});
  }, 1500);
}

// ----------------------------------------------------------------- lyrics line
let lyricTrackId: string | null = null;
let lyricLines: SyncedLine[] = [];
async function loadLyrics(t: Track | null) {
  lyricLines = [];
  lyricTrackId = t?.id || null;
  if (!t || !getCarLyricsEnabled()) return;
  try {
    const res = await fetchLyricsUnified(t.name, t.artists?.[0]?.name || '', (t.duration_ms || 0) / 1000);
    if (lyricTrackId !== t.id) return;
    lyricLines = res.syncedLyrics ? parseEnhancedLyrics(res.syncedLyrics).filter((l) => l.text && l.text.trim()) : [];
  } catch {
    lyricLines = [];
  }
}
function currentLyricLine(progressMs: number): string {
  if (!getCarLyricsEnabled() || lyricLines.length === 0) return '';
  let line = '';
  for (const l of lyricLines) {
    if (l.timeMs <= progressMs + 250) line = l.text;
    else break;
  }
  return line;
}

// ----------------------------------------------------------------- now playing
let lastSent = '';
let lastPushAt = 0;
function pushNowPlaying(force = false) {
  const s = usePlayerStore.getState();
  const t = s.currentTrack;
  if (!t) return;
  const line = currentLyricLine(s.progressMs || 0);
  const key = `${t.id}|${s.isPlaying}|${line}|${useLanguageStore.getState().language}`;
  const now = Date.now();
  // Position is extrapolated by the system while playing: resend on changes, or every 15 s
  if (!force && key === lastSent && now - lastPushAt < 15000) return;
  lastSent = key;
  lastPushAt = now;
  const upcoming = typeof s.getUpcomingTracks === 'function' ? s.getUpcomingTracks(20) : [];
  SpotifreeMedia.updateNowPlaying({
    title: t.name || '',
    artist: artist(t),
    album: t.album?.name || '',
    artworkUrl: cover(t),
    durationMs: s.durationMs || t.duration_ms || 0,
    positionMs: s.progressMs || 0,
    isPlaying: Boolean(s.isPlaying),
    lyricLine: line,
    language: useLanguageStore.getState().language,
    queue: upcoming.map((x) => ({ id: x.id, title: x.name, artist: artist(x) })),
  }).catch(() => {});
}

// ----------------------------------------------------------------- commands from car / notification
function engine(): any {
  return (window as any).__audioEngine;
}

function runCommand(c: MediaCommand) {
  const player = usePlayerStore.getState();
  switch (c.action) {
    case 'play':
      if (!player.isPlaying) player.togglePlay();
      break;
    case 'pause':
      if (player.isPlaying) player.togglePlay();
      break;
    case 'next':
      player.nextTrack();
      break;
    case 'previous':
      player.previousTrack();
      break;
    case 'seek':
      if (typeof c.positionMs === 'number') {
        engine()?.seek?.(c.positionMs / 1000);
        player.setProgress?.(c.positionMs);
      }
      break;
    case 'playFromMediaId':
      playMediaId(c.mediaId || '');
      break;
    case 'playFromSearch':
      playSearch(c.query || '');
      break;
  }
  window.setTimeout(() => pushNowPlaying(true), 600);
}

function findPlaylistTracks(plId: string): Track[] {
  const st = useSpotifyDataStore.getState() as any;
  const p = (st.playlists || []).find((x: any) => x.id === plId);
  return (p?.tracks?.items || []).map((x: any) => x?.track || x).filter((t: any) => t?.id);
}

function playMediaId(mediaId: string) {
  const player = usePlayerStore.getState();
  if (mediaId.startsWith('tr:')) {
    const rest = mediaId.slice(3);
    const cut = rest.lastIndexOf(':');
    const plId = rest.slice(0, cut);
    const idx = Number(rest.slice(cut + 1));
    const tracks = findPlaylistTracks(plId);
    const t = tracks[idx];
    if (t) player.playTrack(t, tracks, plId);
  } else if (mediaId.startsWith('q:')) {
    const idx = Number(mediaId.slice(2));
    const upcoming = player.getUpcomingTracks?.(20) || [];
    const t = upcoming[idx];
    if (t) player.playTrack(t, player.queue, (player as any).contextId);
  } else if (mediaId.startsWith('pl:')) {
    const plId = mediaId.slice(3);
    const tracks = findPlaylistTracks(plId);
    if (tracks[0]) player.playTrack(tracks[0], tracks, plId);
  }
}

function playSearch(query: string) {
  const q = query.trim().toLowerCase();
  const st = useSpotifyDataStore.getState() as any;
  const lists: { id: string; name: string; tracks: Track[] }[] = (st.playlists || []).map((p: any) => ({
    id: p.id,
    name: p.name || '',
    tracks: findPlaylistTracks(p.id),
  }));
  if (!q) {
    const first = lists.find((l) => l.tracks.length);
    if (first) usePlayerStore.getState().playTrack(first.tracks[0], first.tracks, first.id);
    return;
  }
  const byName = lists.find((l) => l.name.toLowerCase().includes(q) && l.tracks.length);
  if (byName) {
    usePlayerStore.getState().playTrack(byName.tracks[0], byName.tracks, byName.id);
    return;
  }
  for (const l of lists) {
    const t = (l.tracks as Track[]).find((x) => `${x.name} ${artist(x)}`.toLowerCase().includes(q));
    if (t) {
      usePlayerStore.getState().playTrack(t, l.tracks, l.id);
      return;
    }
  }
}

let started = false;
export function initNativeMedia() {
  if (started || typeof window === 'undefined' || !isNativeMediaAvailable()) return;
  started = true;

  SpotifreeMedia.addListener('command', runCommand).catch(() => {});
  // A song chosen in the car while the app was closed
  window.setTimeout(() => {
    SpotifreeMedia.takePendingCommand()
      .then((r) => {
        if (r?.command) window.setTimeout(() => runCommand(r.command!), 2500);
      })
      .catch(() => {});
  }, 1500);

  pushLibrary();
  useSpotifyDataStore.subscribe((s: any, prev: any) => {
    if (s.playlists !== prev.playlists) pushLibrary();
  });

  usePlayerStore.subscribe((s, prev) => {
    if (s.currentTrack?.id !== prev.currentTrack?.id) {
      void loadLyrics(s.currentTrack).then(() => pushNowPlaying(true));
      pushNowPlaying(true);
      return;
    }
    if (s.isPlaying !== prev.isPlaying || s.queue !== prev.queue) {
      pushNowPlaying(true);
      return;
    }
    if (Math.abs((s.progressMs || 0) - (prev.progressMs || 0)) > 4000) {
      pushNowPlaying(true); // seek
      return;
    }
    pushNowPlaying(false); // lyric line changes
  });
  useLanguageStore.subscribe(() => pushNowPlaying(true));
}
