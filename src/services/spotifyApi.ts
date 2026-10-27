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
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem('spotify_403_premium');
      }
      return await res.json();
    }
    if (res.status === 403) {
      const errBody = await res.text().catch(() => '');
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem('spotify_403_premium', errBody || 'Active premium subscription required for the owner of the app.');
      }
      console.error(
        'Spotify /v1/me devolvió 403 Forbidden:', errBody
      );
    } else {
      console.warn(`Spotify /v1/me returned ${res.status}`);
    }
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

  // 1. Try Spotify Official Web API if valid token exists
  try {
    const validToken = await getValidAccessToken();
    if (validToken) {
      const res = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(cleanQ)}&type=track,artist,album,playlist&limit=12`,
        { headers: { Authorization: `Bearer ${validToken}` } }
      );
      if (res.ok) {
        const data = await res.json();
        if (data.tracks?.items?.length || data.artists?.items?.length || data.albums?.items?.length) {
          return data;
        }
      }
    }
  } catch (err) {
    console.warn('Spotify official search failed, falling back:', err);
  }

  // 2. Try proxy /api/spotify/search if backend is available
  try {
    const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(cleanQ)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.tracks?.items?.length || data.artists?.items?.length) {
        return data;
      }
    }
  } catch (err) {
    console.warn('Error querying /api/spotify/search:', err);
  }

  // 3. Parallel multi-entity iTunes Search Fallback (Songs, Albums, Artists)
  try {
    const [songsRes, albumsRes] = await Promise.all([
      fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(cleanQ)}&media=music&entity=song&limit=15`),
      fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(cleanQ)}&media=music&entity=album&limit=8`),
    ]);

    const songData = songsRes.ok ? await songsRes.json() : { results: [] };
    const albumData = albumsRes.ok ? await albumsRes.json() : { results: [] };

    const tracks: Track[] = (songData.results || []).map((t: any, idx: number) => ({
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

    // Extract unique artists with their best artwork from tracks
    const artistMap = new Map<string, { id: string; name: string; images: Array<{ url: string }> }>();
    for (const t of songData.results || []) {
      if (t.artistName && !artistMap.has(t.artistName.toLowerCase())) {
        artistMap.set(t.artistName.toLowerCase(), {
          id: `art-${t.artistId || t.artistName.toLowerCase().replace(/\s+/g, '-')}`,
          name: t.artistName,
          images: [{ url: (t.artworkUrl100 || '').replace('100x100bb', '600x600bb') }],
        });
      }
      if (artistMap.size >= 6) break;
    }

    const albums = (albumData.results || []).map((a: any, idx: number) => ({
      id: `alb-${a.collectionId || idx}`,
      name: a.collectionName,
      artists: [{ name: a.artistName }],
      images: [{ url: (a.artworkUrl100 || '').replace('100x100bb', '600x600bb') }],
      release_date: (a.releaseDate || '').slice(0, 4) || '2024',
    }));

    // Generate matching playlists from catalog / search query
    const playlists = [
      {
        id: `search-pl-${cleanQ.toLowerCase().replace(/\s+/g, '-')}`,
        name: `This Is ${cleanQ.charAt(0).toUpperCase() + cleanQ.slice(1)}`,
        images: [{
          url: tracks[0]?.album?.images?.[0]?.url || 'https://i.scdn.co/image/ab67706f00000002acc0778b688c66b07afc5426'
        }],
        owner: { display_name: 'Spotify' },
      },
      {
        id: `search-mix-${cleanQ.toLowerCase().replace(/\s+/g, '-')}`,
        name: `Mix de ${cleanQ.charAt(0).toUpperCase() + cleanQ.slice(1)}`,
        images: [{
          url: tracks[1]?.album?.images?.[0]?.url || 'https://i.scdn.co/image/ab67706f000000022072b736ac89da8c376e3fe6'
        }],
        owner: { display_name: 'Spotify' },
      },
    ];

    return {
      tracks: { items: tracks },
      artists: { items: Array.from(artistMap.values()) },
      albums: { items: albums },
      playlists: { items: playlists },
    };
  } catch (err) {
    console.error('Fallback search failed:', err);
  }

  return {
    tracks: { items: [] },
    artists: { items: [] },
    albums: { items: [] },
    playlists: { items: [] },
  };
}
