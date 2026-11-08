import { usePlayerStore } from '../store/usePlayerStore';
import { useSpotifyDataStore } from '../store/useSpotifyDataStore';
import { useUIStore } from '../store/useUIStore';
import { searchSpotify, fetchPlaylistDetails } from '../services/spotifyApi';
import { showGlobalToast } from './globalToast';
import { playVoiceSearch } from '../services/nativeMedia';
import type { Track, Playlist } from '../types/spotify';

/**
 * Handles incoming Deep Links, App Links, and Voice Intents from:
 * 1. Google Assistant / Gemini / Android AI: "Pon música en Spotifree", "Reproduce Bad Bunny en Spotifree"
 * 2. Spotify URLs: https://open.spotify.com/track/..., playlist/..., album/..., artist/...
 * 3. Spotify URIs: spotify:track:..., spotify:playlist:..., spotify:album:..., spotify:artist:...
 * 4. Spotifree custom scheme & web links: spotifree://play?q=..., https://spotifreeweb.vercel.app/?play=...
 */

let isHandlingLink = false;

export async function handleDeepLink(rawInput: string): Promise<boolean> {
  if (!rawInput || typeof rawInput !== 'string') return false;
  if (isHandlingLink) return false;
  isHandlingLink = true;

  try {
    const trimmed = rawInput.trim();

    // 1. Spotify URI (e.g. spotify:track:4cOdK2wGLETKBW3PvgPWqT)
    if (trimmed.startsWith('spotify:')) {
      const parts = trimmed.split(':');
      const kind = parts[1]?.toLowerCase();
      const id = parts[2]?.split('?')[0];
      if (kind && id) {
        return await routeEntity(kind, id);
      }
    }

    // 2. Spotifree custom scheme (e.g. spotifree://play?q=Bad+Bunny or spotifree://track/...)
    if (trimmed.startsWith('spotifree://')) {
      const pathAndQuery = trimmed.replace(/^spotifree:\/\//, '');
      if (
        pathAndQuery === 'play' ||
        pathAndQuery.startsWith('play?') ||
        pathAndQuery.startsWith('play/') ||
        pathAndQuery.startsWith('search?') ||
        pathAndQuery.startsWith('search/')
      ) {
        const queryString = pathAndQuery.includes('?') ? pathAndQuery.split('?')[1] : '';
        const queryParams = new URLSearchParams(queryString || '');
        const q = queryParams.get('q') || queryParams.get('query') || '';
        await playVoiceSearch(q);
        showGlobalToast(q ? `Buscando y reproduciendo: ${q}` : 'Reproduciendo música');
        return true;
      }
      const slashParts = pathAndQuery.split('?')[0].split('/');
      const kind = slashParts[0]?.toLowerCase();
      const id = slashParts[1];
      if (kind && id) {
        return await routeEntity(kind, id);
      }
    }

    // 3. Web URL: open.spotify.com or spotifreeweb.vercel.app
    let parsedUrl: URL | null = null;
    try {
      parsedUrl = new URL(trimmed);
    } catch {
      // Not a valid URL: treat as direct voice query
      await playVoiceSearch(trimmed);
      showGlobalToast(trimmed ? `Reproduciendo: ${trimmed}` : 'Reproduciendo música');
      return true;
    }

    // Query parameters: ?play=..., ?q=..., ?search=..., ?track=..., ?playlist=...
    const playParam = parsedUrl.searchParams.get('play') ?? parsedUrl.searchParams.get('q') ?? parsedUrl.searchParams.get('search');
    if (playParam !== null) {
      const decoded = decodeURIComponent(playParam).trim();
      if (decoded.startsWith('spotify:') || decoded.includes('open.spotify.com')) {
        return await handleDeepLink(decoded);
      }
      await playVoiceSearch(decoded === 'random' ? '' : decoded);
      showGlobalToast(decoded && decoded !== 'random' ? `Reproduciendo: ${decoded}` : 'Reproduciendo música');
      return true;
    }

    const trackParam = parsedUrl.searchParams.get('track');
    if (trackParam) {
      return await routeEntity('track', trackParam);
    }

    const playlistParam = parsedUrl.searchParams.get('playlist');
    if (playlistParam) {
      return await routeEntity('playlist', playlistParam);
    }

    const albumParam = parsedUrl.searchParams.get('album');
    if (albumParam) {
      return await routeEntity('album', albumParam);
    }

    // Path pattern: /track/:id, /playlist/:id, /album/:id, /artist/:id
    const host = parsedUrl.hostname.toLowerCase();
    const isSpotifyHost = host.includes('spotify.com');
    const isSpotifreeHost = host.includes('spotifreeweb') || host.includes('spotifree') || host.includes('localhost') || host === '127.0.0.1';

    if (isSpotifyHost || isSpotifreeHost) {
      const match = /\/(track|playlist|album|artist)\/([a-zA-Z0-9]+)/i.exec(parsedUrl.pathname);
      if (match) {
        const [, kind, id] = match;
        return await routeEntity(kind.toLowerCase(), id);
      }
    }

    // Fallback: If URL has no recognized path or query, but has a query string, run voice search with it
    const searchParam = parsedUrl.search.replace(/^\?/, '').trim();
    if (searchParam) {
      await playVoiceSearch(decodeURIComponent(searchParam));
      return true;
    }

    return false;
  } catch (err) {
    console.warn('[DeepLink] Failed to handle link:', rawInput, err);
    return false;
  } finally {
    isHandlingLink = false;
  }
}

async function routeEntity(kind: string, id: string): Promise<boolean> {
  const cleanId = id.split('?')[0].trim();
  if (!cleanId) return false;

  switch (kind) {
    case 'track':
      return await playTrackById(cleanId);
    case 'playlist':
      return await playPlaylistById(cleanId);
    case 'album':
      return await playPlaylistById(`alb-${cleanId}`);
    case 'artist':
      return await openArtistById(cleanId);
    default:
      return false;
  }
}

async function playTrackById(trackId: string): Promise<boolean> {
  const player = usePlayerStore.getState();
  const dataStore = useSpotifyDataStore.getState();

  // 1. Check if track is already in local playlists or queue
  const allKnownTracks: Track[] = [
    ...(player.queue || []),
    ...(dataStore.playlists || []).flatMap((p) => p.tracks?.items || []),
  ];
  const localMatch = allKnownTracks.find(
    (t) => t.id === trackId || t.id === `spotify:track:${trackId}` || t.id.replace(/^spotify:track:/, '') === trackId
  );

  if (localMatch) {
    player.playTrack(localMatch, [localMatch]);
    showGlobalToast(`Reproduciendo: ${localMatch.name}`);
    return true;
  }

  // 2. Fetch track info from Spotify oEmbed (free, public, no token required)
  try {
    const oembedUrl = `https://open.spotify.com/oembed?url=https://open.spotify.com/track/${encodeURIComponent(trackId)}`;
    const res = await fetch(oembedUrl, { signal: AbortSignal.timeout(3500) });
    if (res.ok) {
      const data = await res.json();
      const trackTitle = data.title;
      const coverUrl = data.thumbnail_url;

      if (trackTitle) {
        // Search in Spotify / YouTube catalog for the full song
        const searchResults = await searchSpotify(trackTitle).catch(() => null);
        const bestTrack = searchResults?.tracks?.items?.[0];

        if (bestTrack) {
          player.playTrack(bestTrack, [bestTrack]);
          showGlobalToast(`Reproduciendo: ${bestTrack.name}`);
          return true;
        }

        // Fallback: construct Track object with oEmbed metadata
        const fallbackTrack: Track = {
          id: `spotify:track:${trackId}`,
          name: trackTitle,
          duration_ms: 200000,
          artists: [{ id: 'art-spotify', name: data.author_name || 'Spotify' }],
          album: {
            id: `alb-${trackId}`,
            name: trackTitle,
            images: coverUrl ? [{ url: coverUrl }] : [],
          },
        };
        player.playTrack(fallbackTrack, [fallbackTrack]);
        showGlobalToast(`Reproduciendo: ${trackTitle}`);
        return true;
      }
    }
  } catch (err) {
    console.warn('[DeepLink] oEmbed lookup failed for track:', trackId, err);
  }

  // 3. Fallback: search Spotify directly with the track ID
  await playVoiceSearch(trackId);
  return true;
}

async function playPlaylistById(playlistId: string): Promise<boolean> {
  const dataStore = useSpotifyDataStore.getState();
  const player = usePlayerStore.getState();

  // Check if playlist is already in user library
  let playlist = dataStore.playlists.find(
    (p) => p.id === playlistId || p.id === `spotify:playlist:${playlistId}` || p.id.replace(/^spotify:playlist:/, '') === playlistId
  );

  if (!playlist) {
    playlist = (await fetchPlaylistDetails(playlistId)) || undefined;
  }

  if (playlist && playlist.tracks?.items?.length) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('spotifree_open_playlist', { detail: playlist }));
      (window as any).__mobileSelectPlaylist?.(playlist);
      (window as any).__desktopSelectPlaylist?.(playlist);
    }
    useUIStore.getState().setActiveMainTab('playlist');
    const firstTrack = playlist.tracks.items[0];
    player.playTrack(firstTrack, playlist.tracks.items, playlist.id);
    showGlobalToast(`Reproduciendo playlist: ${playlist.name}`);
    return true;
  }

  return false;
}

async function openArtistById(artistId: string): Promise<boolean> {
  const targetId = artistId.startsWith('art-') ? artistId : `art-${artistId}`;

  // Find or create artist view in UI
  const artistPl: Playlist = {
    id: targetId,
    name: 'Artista',
    description: '',
    images: [],
    owner: { id: 'spotify', display_name: 'Spotify' },
    type: 'playlist',
    tracks: { total: 0, items: [] },
  };

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('spotifree_open_playlist', { detail: artistPl }));
    (window as any).__mobileSelectPlaylist?.(artistPl);
    (window as any).__desktopSelectPlaylist?.(artistPl);
  }
  useUIStore.getState().setActiveMainTab('playlist');
  showGlobalToast('Abriendo artista');
  return true;
}

/**
 * Initializes deep link and voice command listeners on app startup
 */
export function initDeepLinks() {
  if (typeof window === 'undefined') return;

  // 1. Initial URL parameters check (for PWA / Web / App launch)
  window.setTimeout(() => {
    try {
      const fullUrl = window.location.href;
      const params = new URLSearchParams(window.location.search);
      if (params.has('play') || params.has('q') || params.has('track') || params.has('playlist') || params.has('album')) {
        void handleDeepLink(fullUrl);
      }
    } catch {}
  }, 1000);
}
