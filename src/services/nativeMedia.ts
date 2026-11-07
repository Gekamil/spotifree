/**
 * APK only: Android Auto (Spotify-like car app), playback notification, lock screen and
 * Bluetooth / car controls. Keeps the native media session in sync with the player and runs
 * the commands that come from the car.
 * Native side: native/android/SpotifreeMediaService.java + SpotifreeMediaPlugin.java
 * (+ SpotifreeArtProvider.java for the covers).
 *
 * Car browse tree: Inicio (recent + your shelves) · Tu biblioteca · A continuación, playlists
 * with "Reproducir en aleatorio", search (also by voice). Now playing: like, shuffle, repeat,
 * queue and the current lyric line.
 */
import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { usePlayerStore } from '../store/usePlayerStore';
import { useSpotifyDataStore } from '../store/useSpotifyDataStore';
import { useLanguageStore } from '../utils/i18n';
import { fetchLyricsUnified, parseEnhancedLyrics, type SyncedLine } from '../utils/lyricsService';
import { toHDImage } from '../utils/formatters';
import { fetchPlaylistDetails, searchSpotify } from './spotifyApi';
import type { Playlist, Track } from '../types/spotify';

interface MediaCommand {
  action:
    | 'play' | 'pause' | 'next' | 'previous' | 'seek'
    | 'playFromMediaId' | 'playFromSearch' | 'playQueueIndex'
    | 'toggleLike' | 'toggleShuffle' | 'cycleRepeat'
    | 'loadPlaylist' | 'search';
  positionMs?: number;
  mediaId?: string;
  query?: string;
  index?: number;
  id?: string;
  requestId?: string;
}

interface CarItem { id: string; name: string; subtitle?: string; image?: string }
interface CarTrack { id: string; title: string; artist: string; image?: string }

interface SpotifreeMediaPlugin {
  setLibrary(o: { playlists: CarItem[]; home: { title: string; items: CarItem[] }[]; loggedIn: boolean }): Promise<void>;
  setPlaylistTracks(o: { id: string; tracks: CarTrack[] }): Promise<void>;
  setSearchResults(o: { requestId: string; tracks: CarTrack[]; playlists: CarItem[] }): Promise<void>;
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

const en = () => useLanguageStore.getState().language === 'en';
const artistOf = (t?: Track | null) => (t?.artists || []).map((a) => a.name).filter(Boolean).join(', ');
const img = (url?: string | null) => (url ? toHDImage(url) : '');
const coverOf = (t?: Track | null) => img(t?.album?.images?.[0]?.url);
const tracksOf = (p?: Playlist | null): Track[] =>
  ((p?.tracks?.items || []) as any[]).map((x) => x?.track || x).filter((t: any) => t?.id && t?.name);
const carTrack = (t: Track): CarTrack => ({ id: t.id, title: t.name, artist: artistOf(t), image: coverOf(t) });
const playlistItem = (p: Playlist): CarItem => ({
  id: p.id,
  name: p.name || '',
  subtitle:
    p.id === 'liked-songs'
      ? `${tracksOf(p).length || p.tracks?.total || 0} ${en() ? 'songs' : 'canciones'}`
      : p.owner?.display_name || '',
  image: img(p.images?.[0]?.url),
});

// ----------------------------------------------------------------- recently played (for "Inicio")
const RECENT_KEY = 'spotifree_car_recent';
function readRecent(): string[] {
  try {
    return JSON.parse(window.localStorage.getItem(RECENT_KEY) || '[]') || [];
  } catch {
    return [];
  }
}
function rememberContext(id?: string | null) {
  if (!id) return;
  const list = [id, ...readRecent().filter((x) => x !== id)].slice(0, 12);
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {}
  pushLibrary();
}

// ----------------------------------------------------------------- library + home
let libraryTimer: number | undefined;
let lastLibrarySig = '';
function findPlaylist(id: string): Playlist | null {
  const st = useSpotifyDataStore.getState();
  return st.playlists.find((p) => p.id === id) || st.playlistDetailsCache?.[id] || null;
}

function pushLibrary() {
  window.clearTimeout(libraryTimer);
  libraryTimer = window.setTimeout(() => {
    const st = useSpotifyDataStore.getState();
    const playlists = st.playlists || [];
    const liked = playlists.find((p) => p.id === 'liked-songs');
    const others = playlists.filter((p) => p.id !== 'liked-songs');
    const lib: CarItem[] = [...(liked ? [playlistItem(liked)] : []), ...others.slice(0, 80).map(playlistItem)];

    // Inicio: like the Spotify car app, recent first, then your shelves
    const known = new Map<string, CarItem>();
    for (const p of playlists) known.set(p.id, playlistItem(p));
    for (const shelf of st.dynamicShelves || []) {
      for (const c of shelf.cards || []) {
        if (!known.has(c.id)) known.set(c.id, { id: c.id, name: c.title, subtitle: c.subtitle, image: img(c.image) });
      }
    }
    const home: { title: string; items: CarItem[] }[] = [];
    const recent = readRecent().map((id) => known.get(id)).filter(Boolean) as CarItem[];
    if (recent.length) home.push({ title: en() ? 'Recently played' : 'Escuchado recientemente', items: recent.slice(0, 8) });
    const quick = (st.quickAccessCards || [])
      .map((c) => known.get(c.id) || { id: c.id, name: c.name, image: img(c.image) })
      .filter((c) => !recent.some((r) => r.id === c.id));
    if (quick.length) home.push({ title: en() ? 'Your favourites' : 'Tus favoritos', items: quick.slice(0, 8) });
    for (const shelf of (st.dynamicShelves || []).slice(0, 8)) {
      if (shelf.type === 'artist') continue; // artist pages are not playlists
      const items = (shelf.cards || [])
        .filter((c) => c.id && !c.id.startsWith('art-'))
        .slice(0, 10)
        .map((c) => known.get(c.id) || { id: c.id, name: c.title, subtitle: c.subtitle, image: img(c.image) });
      if (items.length) home.push({ title: shelf.title, items });
    }

    const sig = JSON.stringify([lib.map((l) => l.id + l.name + l.image), home.map((h) => h.title + h.items.map((i) => i.id).join())]);
    if (sig === lastLibrarySig) return;
    lastLibrarySig = sig;
    SpotifreeMedia.setLibrary({ playlists: lib, home, loggedIn: Boolean(st.isAuthenticated) }).catch(() => {});
  }, 1200);
}

// ----------------------------------------------------------------- songs of a playlist (on demand)
const sentTracks = new Map<string, Track[]>();
async function loadPlaylistTracks(id: string): Promise<Track[]> {
  let p = findPlaylist(id);
  let tracks = tracksOf(p);
  if (tracks.length === 0) {
    try {
      const fetched = await fetchPlaylistDetails(id);
      if (fetched) {
        useSpotifyDataStore.getState().cachePlaylistDetails?.(fetched);
        p = fetched;
        tracks = tracksOf(fetched);
      }
    } catch {}
  }
  sentTracks.set(id, tracks);
  return tracks;
}
async function answerLoadPlaylist(id: string) {
  const tracks = await loadPlaylistTracks(id);
  SpotifreeMedia.setPlaylistTracks({ id, tracks: tracks.slice(0, 300).map(carTrack) }).catch(() => {});
}

// ----------------------------------------------------------------- search (car search screen)
const searchTracks = new Map<string, Track[]>();
async function runSearch(query: string): Promise<{ tracks: Track[]; playlists: CarItem[] }> {
  const res = await searchSpotify(query).catch(() => null);
  const list = (v: any): any[] => (Array.isArray(v) ? v : Array.isArray(v?.items) ? v.items : []);
  const tracks: Track[] = (list(res?.tracks) as Track[]).filter((t) => t?.id && t?.name).slice(0, 25);
  // Generated "radio" cards of the search page are not real playlists
  const playlists: CarItem[] = list(res?.playlists).filter((p) => p?.id && !String(p.id).startsWith('search-')).slice(0, 15).map((p) => ({
    id: p.id,
    name: p.name,
    subtitle: p.owner?.display_name || '',
    image: img(p.images?.[0]?.url),
  }));
  return { tracks, playlists };
}
async function answerSearch(requestId: string, query: string) {
  const { tracks, playlists } = await runSearch(query);
  searchTracks.set(requestId, tracks);
  if (searchTracks.size > 10) searchTracks.delete(searchTracks.keys().next().value as string);
  SpotifreeMedia.setSearchResults({ requestId, tracks: tracks.map(carTrack), playlists }).catch(() => {});
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
let lastQueueSig = '';
function pushNowPlaying(force = false) {
  const s = usePlayerStore.getState();
  const t = s.currentTrack;
  if (!t) return;
  const line = currentLyricLine(s.progressMs || 0);
  const liked = (s.likedTrackIds || []).includes(t.id);
  const shuffle = Boolean(s.isShuffle);
  const repeat = s.repeatMode || 'off';
  const key = `${t.id}|${s.isPlaying}|${line}|${liked}|${shuffle}|${repeat}|${useLanguageStore.getState().language}`;
  const now = Date.now();
  // The system extrapolates the position while playing: resend on changes, or every 15 s
  if (!force && key === lastSent && now - lastPushAt < 15000) return;
  lastSent = key;
  lastPushAt = now;
  const upcoming = typeof s.getUpcomingTracks === 'function' ? s.getUpcomingTracks(30) : [];
  const queueSig = upcoming.map((x) => x.id).join();
  const sendQueue = queueSig !== lastQueueSig;
  lastQueueSig = queueSig;
  SpotifreeMedia.updateNowPlaying({
    trackId: t.id,
    title: t.name || '',
    artist: artistOf(t),
    album: t.album?.name || '',
    artworkUrl: coverOf(t),
    durationMs: s.durationMs || t.duration_ms || 0,
    positionMs: s.progressMs || 0,
    isPlaying: Boolean(s.isPlaying),
    lyricLine: line,
    liked,
    shuffle,
    repeat,
    language: useLanguageStore.getState().language,
    ...(sendQueue ? { queue: upcoming.map(carTrack) } : {}),
  }).catch(() => {});
}

// ----------------------------------------------------------------- commands from the car
function engine(): any {
  return (window as any).__audioEngine;
}

function playList(tracks: Track[], start: Track | undefined, contextId?: string) {
  if (!start) return;
  usePlayerStore.getState().playTrack(start, tracks, contextId);
}

async function runCommand(c: MediaCommand) {
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
    case 'toggleLike':
      if (player.currentTrack) player.toggleLike(player.currentTrack.id, player.currentTrack);
      break;
    case 'toggleShuffle':
      player.toggleShuffle();
      break;
    case 'cycleRepeat':
      player.toggleRepeat();
      break;
    case 'playQueueIndex': {
      const upcoming = player.getUpcomingTracks?.(30) || [];
      const t = upcoming[Number(c.index) || 0];
      if (t) player.playTrack(t, player.queue, player.currentContextId || undefined);
      break;
    }
    case 'loadPlaylist':
      if (c.id) await answerLoadPlaylist(c.id);
      return;
    case 'search':
      if (c.requestId) await answerSearch(c.requestId, c.query || '');
      return;
    case 'playFromMediaId':
      await playMediaId(c.mediaId || '');
      break;
    case 'playFromSearch':
      await playVoiceSearch(c.query || '');
      break;
  }
  window.setTimeout(() => pushNowPlaying(true), 500);
}

function splitId(rest: string): [string, number] {
  const cut = rest.lastIndexOf(':');
  return [rest.slice(0, cut), Number(rest.slice(cut + 1))];
}

async function playMediaId(mediaId: string) {
  const player = usePlayerStore.getState();
  if (mediaId.startsWith('tr:')) {
    const [plId, idx] = splitId(mediaId.slice(3));
    const tracks = sentTracks.get(plId) || (await loadPlaylistTracks(plId));
    playList(tracks, tracks[idx], plId);
  } else if (mediaId.startsWith('shuf:')) {
    const plId = mediaId.slice(5);
    const tracks = sentTracks.get(plId) || (await loadPlaylistTracks(plId));
    if (!tracks.length) return;
    if (!player.isShuffle) player.toggleShuffle();
    playList(tracks, tracks[Math.floor(Math.random() * tracks.length)], plId);
  } else if (mediaId.startsWith('q:')) {
    const upcoming = player.getUpcomingTracks?.(30) || [];
    const t = upcoming[Number(mediaId.slice(2))];
    if (t) player.playTrack(t, player.queue, player.currentContextId || undefined);
  } else if (mediaId.startsWith('st:')) {
    const [req, idx] = splitId(mediaId.slice(3));
    const tracks = searchTracks.get(req) || [];
    playList(tracks, tracks[idx]);
  } else if (mediaId.startsWith('pl:')) {
    const plId = mediaId.slice(3);
    const tracks = sentTracks.get(plId) || (await loadPlaylistTracks(plId));
    playList(tracks, tracks[0], plId);
  }
}

/** "Hey Google, play <x> on Spotifree": your playlists first, then any song / playlist */
async function playVoiceSearch(query: string) {
  const q = query.trim().toLowerCase();
  const st = useSpotifyDataStore.getState();
  if (!q) {
    // "Play music": continue, or the most recent list, or Liked Songs
    const player = usePlayerStore.getState();
    if (player.currentTrack) {
      if (!player.isPlaying) player.togglePlay();
      return;
    }
    const first = readRecent()[0] || 'liked-songs';
    const tracks = await loadPlaylistTracks(first);
    playList(tracks, tracks[0], first);
    return;
  }
  const mine = st.playlists.find((p) => (p.name || '').toLowerCase().includes(q));
  if (mine) {
    const tracks = await loadPlaylistTracks(mine.id);
    if (tracks.length) return playList(tracks, tracks[0], mine.id);
  }
  for (const p of st.playlists) {
    const tracks = tracksOf(p);
    const t = tracks.find((x) => `${x.name} ${artistOf(x)}`.toLowerCase().includes(q));
    if (t) return playList(tracks, t, p.id);
  }
  const { tracks, playlists } = await runSearch(query);
  if (tracks.length) return playList(tracks, tracks[0]);
  if (playlists[0]) {
    const pt = await loadPlaylistTracks(playlists[0].id);
    playList(pt, pt[0], playlists[0].id);
  }
}

let started = false;
export function initNativeMedia() {
  if (started || typeof window === 'undefined' || !isNativeMediaAvailable()) return;
  started = true;
  // For debugging from the WebView inspector: simulate a car command
  (window as any).__spotifreeCar = { runCommand, pushLibrary, pushNowPlaying };

  SpotifreeMedia.addListener('command', (c) => {
    void runCommand(c);
  }).catch(() => {});
  // A song chosen in the car while the app was closed
  window.setTimeout(() => {
    SpotifreeMedia.takePendingCommand()
      .then((r) => {
        if (r?.command) window.setTimeout(() => void runCommand(r.command!), 2500);
      })
      .catch(() => {});
  }, 1500);

  pushLibrary();
  useSpotifyDataStore.subscribe((s, prev) => {
    if (
      s.playlists !== prev.playlists ||
      s.dynamicShelves !== prev.dynamicShelves ||
      s.quickAccessCards !== prev.quickAccessCards ||
      s.isAuthenticated !== prev.isAuthenticated
    ) {
      sentTracks.clear();
      pushLibrary();
    }
  });

  usePlayerStore.subscribe((s, prev) => {
    if (s.currentContextId && s.currentContextId !== prev.currentContextId) rememberContext(s.currentContextId);
    if (s.currentTrack?.id !== prev.currentTrack?.id) {
      void loadLyrics(s.currentTrack).then(() => pushNowPlaying(true));
      pushNowPlaying(true);
      return;
    }
    if (
      s.isPlaying !== prev.isPlaying ||
      s.queue !== prev.queue ||
      s.likedTrackIds !== prev.likedTrackIds ||
      s.isShuffle !== prev.isShuffle ||
      s.repeatMode !== prev.repeatMode
    ) {
      pushNowPlaying(true);
      return;
    }
    if (Math.abs((s.progressMs || 0) - (prev.progressMs || 0)) > 4000) {
      pushNowPlaying(true); // seek
      return;
    }
    pushNowPlaying(false); // lyric line changes
  });
  useLanguageStore.subscribe(() => {
    lastLibrarySig = '';
    pushLibrary();
    pushNowPlaying(true);
  });
}
