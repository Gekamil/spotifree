import { usePlayerStore } from '../store/usePlayerStore';
import { useSpotifyDataStore } from '../store/useSpotifyDataStore';
import { useUIStore } from '../store/useUIStore';
import { usePlaylistInviteStore } from '../store/usePlaylistInviteStore';
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
      const lower = pathAndQuery.toLowerCase();
      if (
        lower === 'play' ||
        lower.startsWith('play?') ||
        lower.startsWith('play/') ||
        lower.startsWith('search?') ||
        lower.startsWith('search/')
      ) {
        const queryString = pathAndQuery.includes('?') ? pathAndQuery.split('?')[1] : '';
        const queryParams = new URLSearchParams(queryString || '');
        const q = queryParams.get('q') || queryParams.get('query') || '';
        await playVoiceSearch(q);
        showGlobalToast(q ? `Buscando y reproduciendo: ${q}` : 'Reproduciendo música');
        return true;
      }
      if (lower === 'pause') {
        const player = usePlayerStore.getState();
        if (player.isPlaying) player.togglePlay();
        showGlobalToast('Música pausada');
        return true;
      }
      if (lower === 'next' || lower === 'skip') {
        usePlayerStore.getState().nextTrack();
        showGlobalToast('Siguiente canción');
        return true;
      }
      if (lower === 'prev' || lower === 'previous') {
        usePlayerStore.getState().previousTrack();
        showGlobalToast('Canción anterior');
        return true;
      }
      if (lower === 'toggle' || lower === 'togglepause') {
        const player = usePlayerStore.getState();
        if (player.currentTrack) {
          player.togglePlay();
        } else {
          await playVoiceSearch('');
        }
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

    // Invitation to a shared/collaborative playlist: ?collab=PL…
    const collabParam = parsedUrl.searchParams.get('collab');
    const shareParam = parsedUrl.searchParams.get('share');
    if (collabParam) {
      return await openSharedInvite(collabParam.trim());
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
      return await openPlaylistInviteModal(playlistParam, shareParam);
    }

    if (shareParam) {
      return await openSharedInvite(shareParam.trim());
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
        if (kind.toLowerCase() === 'playlist') {
          return await openPlaylistInviteModal(id, shareParam);
        }
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
      return await openPlaylistInviteModal(cleanId);
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

async function openPlaylistInviteModal(playlistId: string, shareCode?: string | null): Promise<boolean> {
  const cleanId = playlistId.replace(/^spotify:playlist:/i, '').split('?')[0].trim();
  if (!cleanId && !shareCode) return false;
  const inviteStore = usePlaylistInviteStore.getState();
  inviteStore.openInviteLoading({ playlistId: cleanId || null, shareCode: shareCode || null });

  try {
    if (shareCode) {
      const { previewSharedPlaylist } = await import('../services/sharedPlaylists');
      const snapPreview = await previewSharedPlaylist(shareCode);
      if (snapPreview) {
        const existingLocal = useSpotifyDataStore.getState().playlists.some(
          (p) =>
            p.id === cleanId ||
            p.id === `shared-copy-${shareCode}` ||
            (snapPreview.localId && p.id === snapPreview.localId)
        );
        inviteStore.setInvitePreview({
          code: snapPreview.code,
          kind: snapPreview.kind,
          playlistId: cleanId || `shared-copy-${shareCode}`,
          name: snapPreview.name,
          description: snapPreview.description,
          image: snapPreview.image,
          ownerId: snapPreview.ownerId,
          ownerName: snapPreview.ownerName,
          memberCount: snapPreview.memberCount,
          tracks: snapPreview.tracks,
          collaborative: snapPreview.collaborative,
          alreadyInLibrary: existingLocal,
        });
        return true;
      }
    }

    const dataStore = useSpotifyDataStore.getState();
    const localPlaylist = dataStore.playlists.find(
      (p) => p.id === cleanId || p.id === `spotify:playlist:${cleanId}` || p.id.replace(/^spotify:playlist:/, '') === cleanId
    );
    let resolved = localPlaylist || dataStore.playlistDetailsCache[cleanId];
    if (!resolved || !resolved.tracks?.items?.length) {
      resolved = (await fetchPlaylistDetails(cleanId).catch(() => null)) || resolved;
    }

    if (!resolved || (!resolved.name && !resolved.tracks?.items?.length)) {
      inviteStore.setInviteError('No se pudo encontrar esta playlist o su enlace ha caducado.');
      return false;
    }

    inviteStore.setInvitePreview({
      kind: 'public',
      playlistId: cleanId,
      name: resolved.name || 'Playlist compartida',
      description: resolved.description || '',
      image: resolved.images?.[0]?.url || '',
      ownerId: resolved.owner?.id || 'spotify',
      ownerName: resolved.owner?.display_name || 'Spotifree',
      memberCount: 1,
      tracks: resolved.tracks?.items || [],
      collaborative: Boolean((resolved as any).collaborative),
      alreadyInLibrary: Boolean(localPlaylist),
    });
    return true;
  } catch (err) {
    console.warn('[DeepLink] Could not load playlist invite preview', err);
    inviteStore.setInviteError('Error al cargar los detalles de la playlist compartida.');
    return false;
  }
}

async function openSharedInvite(code: string): Promise<boolean> {
  const cleanCode = code.trim().toUpperCase();
  if (!cleanCode) return false;
  const inviteStore = usePlaylistInviteStore.getState();
  inviteStore.openInviteLoading({ collabCode: cleanCode });

  try {
    const { previewSharedPlaylist } = await import('../services/sharedPlaylists');
    const preview = await previewSharedPlaylist(cleanCode);
    if (!preview) {
      inviteStore.setInviteError('La invitación a esta playlist no existe o ya no está disponible.');
      return false;
    }
    const existingLocal = preview.localId
      ? useSpotifyDataStore.getState().playlists.some((p) => p.id === preview.localId)
      : false;
    inviteStore.setInvitePreview({
      code: preview.code,
      kind: preview.kind,
      playlistId: preview.localId || `shared-${preview.code}`,
      name: preview.name,
      description: preview.description,
      image: preview.image,
      ownerId: preview.ownerId,
      ownerName: preview.ownerName,
      memberCount: preview.memberCount,
      tracks: preview.tracks,
      collaborative: preview.collaborative,
      alreadyInLibrary: existingLocal,
    });
    return true;
  } catch (err) {
    console.warn('[DeepLink] Could not preview shared playlist', err);
    inviteStore.setInviteError('No se ha podido cargar la invitación a la playlist.');
    return false;
  }
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

  // Check URL parameters shortly after mount so invite modals appear promptly even before login finishes
  window.setTimeout(() => {
    try {
      const fullUrl = window.location.href;
      const params = new URLSearchParams(window.location.search);
      if (
        params.has('play') ||
        params.has('q') ||
        params.has('track') ||
        params.has('playlist') ||
        params.has('album') ||
        params.has('collab') ||
        params.has('share') ||
        /\/(track|playlist|album|artist)\/[a-zA-Z0-9]+/i.test(window.location.pathname)
      ) {
        void handleDeepLink(fullUrl);
      }
    } catch {}
  }, 250);
}
