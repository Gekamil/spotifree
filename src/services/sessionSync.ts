import { useSpotifyDataStore, buildDynamicShelves } from '../store/useSpotifyDataStore';
import { usePlayerStore } from '../store/usePlayerStore';
import type { Playlist, UserProfile, Track, SpotifyImage } from '../types/spotify';

export interface SessionSyncUser {
  id: string;
  display_name: string;
  images?: Array<{ url: string; height?: number | null; width?: number | null }>;
  avatarLetter?: string;
  avatarColor?: string;
}

export interface SessionSyncPlayback {
  isPlaying: boolean;
  item: Track | null;
}

export interface SessionSyncResponse {
  connected: boolean;
  error?: string;
  user?: SessionSyncUser | null;
  accessToken?: string | null;
  playlists?: Playlist[];
  quickAccess?: Array<{ id: string; name: string; image: string; color?: string }>;
  shelves?: any[];
  recentlyPlayed?: any[];
  featuredMessage?: string | null;
  playback?: SessionSyncPlayback;
  queue?: any[];
}

/**
 * Calls Vite dev server middleware /api/session-sync to fetch live Spotify
 * session data from Chrome running with remote debugging on port 9222.
 */
export async function fetchChromeSession(): Promise<SessionSyncResponse | null> {
  try {
    const res = await fetch('/api/session-sync', {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      console.warn(`[sessionSync] /api/session-sync responded with HTTP ${res.status}`);
      return null;
    }

    const data: SessionSyncResponse = await res.json();
    return data;
  } catch (err) {
    console.warn('[sessionSync] Failed to reach /api/session-sync:', err);
    return null;
  }
}

/**
 * Synchronizes active Chrome session into frontend localStorage and Zustand stores.
 * Returns true if session was successfully synced.
 */
export async function syncChromeSession(): Promise<boolean> {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem('spotify_logged_out');
  }
  const session = await fetchChromeSession();
  if (!session || !session.connected || !session.user) {
    return false;
  }

  // 1. Persist session token if provided
  if (session.accessToken) {
    window.localStorage.setItem('spotify_access_token', session.accessToken);
    // 30 days expiration for session tokens
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
    window.localStorage.setItem('spotify_expires_at', expiresAt.toString());
  }

  window.localStorage.setItem('spotify_session_synced', 'true');

  // 2. Map images safely to SpotifyImage[]
  const mappedImages: SpotifyImage[] = (session.user.images || []).map((img) => ({
    url: img.url,
    ...(img.height != null ? { height: img.height } : {}),
    ...(img.width != null ? { width: img.width } : {}),
  }));

  // 3. Synchronize user profile and playlists into useSpotifyDataStore
  const userProfile: UserProfile = {
    id: session.user.id || 'e6yr34zzwnf1yybcw49po6nrw',
    display_name: session.user.display_name || 'Jorgeperezvk',
    images: mappedImages,
    email: 'jorgeperezvk@spotify.com',
    followers: { total: 0 },
  };

  const livePlaylists =
    session.playlists && session.playlists.length > 0
      ? session.playlists
      : [];
  const msg =
    session.featuredMessage ||
    (new Date().getDay() === 5 ? '¡Hoy es viernes de novedades!' : 'Novedades populares');
  const shelves = (session.shelves && session.shelves.length > 0)
    ? session.shelves
    : buildDynamicShelves(
        userProfile,
        livePlaylists,
        msg,
        (session as any).featuredPlaylists || [],
        (session as any).topTracks || [],
        (session as any).topArtists || [],
        session.recentlyPlayed || []
      );

  const quickAccess = (session.quickAccess && session.quickAccess.length > 0)
    ? session.quickAccess.map((q: any) => ({
        id: q.id,
        name: q.name,
        image: q.image,
        color: q.color || '#303030',
      }))
    : [
        { id: '37i9dQZF1DWZdsS73T1ogG', name: 'el nuevo urbano', image: 'https://i.scdn.co/image/ab67706f00000002acc0778b688c66b07afc5426', color: '#704838' },
        { id: '7b3MrCWtettvBKlfBSdorn', name: 'J+L(2026)', image: 'https://image-cdn-fa.spotifycdn.com/image/ab67706c0000d72c804d43e5cc7f6a6d0ac65ffc', color: '#5a483a' },
        { id: '4f0YTBqSbvM1iJpuY9r3yQ', name: 'ZIZI', image: 'https://i.scdn.co/image/ab67616d0000b273eb31ebdbca6acd99c23b4d31', color: '#2e4a52' },
        { id: '37i9dQZF1DX2EiUAL7Wdfc', name: 'míticas', image: 'https://i.scdn.co/image/ab67706f000000022072b736ac89da8c376e3fe6', color: '#8b3a1a' },
      ];

  useSpotifyDataStore.setState((state) => ({
    isAuthenticated: true,
    user: userProfile,
    playlists:
      session.playlists && session.playlists.length > 0
        ? session.playlists
        : state.playlists,
    quickAccessCards: quickAccess,
    featuredMessage: msg,
    dynamicShelves: shelves,
    isLoading: false,
  }));

  // 4. Synchronize playback only if Spotifree player is not currently active
  const localPlayer = usePlayerStore.getState();
  if (session.playback?.item && !localPlayer.isPlaying && !localPlayer.currentTrack) {
    usePlayerStore.setState({
      currentTrack: session.playback.item,
      isPlaying: session.playback.isPlaying,
    });
  }

  return true;
}

let syncPollingTimer: number | null = null;

/**
 * Starts continuous background synchronization with Spotify Chrome session.
 */
export function startLiveSessionPolling(intervalMs = 15000): void {
  if (syncPollingTimer !== null) return;
  syncPollingTimer = window.setInterval(async () => {
    if (typeof window !== 'undefined' && window.localStorage.getItem('spotify_logged_out') === 'true') {
      return;
    }
    try {
      await syncChromeSession();
    } catch (e) {
      // Silent error handling for background polling
    }
  }, intervalMs);
}

/**
 * Stops continuous background synchronization.
 */
export function stopLiveSessionPolling(): void {
  if (syncPollingTimer !== null) {
    clearInterval(syncPollingTimer);
    syncPollingTimer = null;
  }
}
