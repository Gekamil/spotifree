import type { Playlist, Track, UserProfile } from '../types/spotify';
import { getValidAccessToken } from './spotifyAuth';

export async function fetchPlaylistDetails(id: string): Promise<Playlist | null> {
  try {
    const validToken = await getValidAccessToken();
    if (validToken) {
      const res = await fetch(`https://api.spotify.com/v1/playlists/${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${validToken}` },
      });
      if (res.ok) {
        return await res.json();
      }
    }

    const res = await fetch(`/api/spotify/playlist/${encodeURIComponent(id)}`);
    if (res.ok) {
      return await res.json();
    }
    return null;
  } catch (err) {
    console.error(`Error fetching playlist details for ${id}:`, err);
    return null;
  }
}

export async function fetchCurrentUser(): Promise<UserProfile | null> {
  const token = typeof window !== 'undefined' ? window.localStorage.getItem('spotify_access_token') : null;
  if (!token) return null;

  try {
    const validToken = await getValidAccessToken();
    if (!validToken) return null;

    const res = await fetch('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${validToken}` },
    });
    if (res.ok) {
      return await res.json();
    }
    console.warn(`Spotify /v1/me returned ${res.status}`);
    return null;
  } catch (err) {
    console.error('Error fetching /v1/me from Spotify API:', err);
    return null;
  }
}

export async function fetchUserPlaylists(): Promise<Playlist[]> {
  const token = typeof window !== 'undefined' ? window.localStorage.getItem('spotify_access_token') : null;
  if (!token) return [];

  try {
    const validToken = await getValidAccessToken();
    if (!validToken) return [];

    const res = await fetch('https://api.spotify.com/v1/me/playlists?limit=50', {
      headers: { Authorization: `Bearer ${validToken}` },
    });
    if (res.ok) {
      const data = await res.json();
      return (data.items || []).filter(Boolean);
    }
    console.warn(`Spotify /v1/me/playlists returned ${res.status}`);
    return [];
  } catch (err) {
    console.error('Error fetching user playlists from Spotify API:', err);
    return [];
  }
}

export async function fetchBrowseCategories(): Promise<any[]> {
  return [];
}

export async function fetchFeaturedPlaylists(): Promise<any[]> {
  return [];
}

export async function fetchNewReleases(): Promise<any[]> {
  return [];
}

export async function fetchTopTracks(): Promise<Track[]> {
  const token = typeof window !== 'undefined' ? window.localStorage.getItem('spotify_access_token') : null;
  if (token && token !== 'session-bridge-active') {
    try {
      const validToken = await getValidAccessToken();
      const res = await fetch('https://api.spotify.com/v1/me/top/tracks?limit=20', {
        headers: { Authorization: `Bearer ${validToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        return data.items || [];
      }
    } catch {}
  }
  return [];
}

export async function searchSpotify(query: string): Promise<any | null> {
  const cleanQ = query.trim();
  if (!cleanQ) return null;

  try {
    const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(cleanQ)}`);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.error('Error querying /api/spotify/search:', err);
  }

  // Direct iTunes music search fallback
  try {
    const itunesRes = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(cleanQ)}&media=music&entity=song&limit=20`
    );
    if (itunesRes.ok) {
      const data = await itunesRes.json();
      const items = (data.results || []).map((t: any, idx: number) => ({
        id: `search-${t.trackId || idx}`,
        name: t.trackName || 'Canción',
        duration_ms: t.trackTimeMillis || 210000,
        preview_url: t.previewUrl || null,
        artists: [{ id: `art-${t.artistId || idx}`, name: t.artistName || 'Artista' }],
        album: {
          id: `alb-${t.collectionId || idx}`,
          name: t.collectionName || t.trackName,
          images: [{ url: (t.artworkUrl100 || '').replace('100x100bb', '600x600bb') }],
        },
      }));
      return { tracks: { items } };
    }
  } catch (err) {
    console.error('Fallback search failed:', err);
  }

  return { tracks: { items: [] } };
}
