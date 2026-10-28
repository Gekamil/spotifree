import type { Playlist, Track, UserProfile } from '../types/spotify';
import { getValidAccessToken } from './spotifyAuth';

export async function fetchPlaylistDetails(id: string): Promise<Playlist | null> {
  try {
    const userCookie = typeof window !== 'undefined' ? window.localStorage.getItem('user_spotify_cookie') || '' : '';
    const storedToken = typeof window !== 'undefined' ? window.localStorage.getItem('spotify_access_token') || '' : '';
    const validToken = await getValidAccessToken().catch(() => null);
    const activeToken = validToken || storedToken;

    if (activeToken && activeToken !== 'session-bridge-active') {
      try {
        const res = await fetch(`https://api.spotify.com/v1/playlists/${encodeURIComponent(id)}`, {
          headers: { Authorization: `Bearer ${activeToken}` },
        });
        if (res.ok) {
          return await res.json();
        }
      } catch {}
    }

    const headers: Record<string, string> = {};
    if (userCookie) headers['x-spotify-cookie'] = userCookie;
    if (activeToken && activeToken !== 'session-bridge-active') {
      headers['Authorization'] = `Bearer ${activeToken}`;
    }

    const res = await fetch(`/api/spotify/playlist/${encodeURIComponent(id)}`, { headers });
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

  let tracks: Track[] = [];
  let artists: Array<{ id: string; name: string; images: Array<{ url: string }> }> = [];
  let albums: Array<{ id: string; name: string; images: Array<{ url: string }>; release_date?: string; artists: Array<{ name: string }> }> = [];
  let playlists: Array<{ id: string; name: string; images: Array<{ url: string }>; owner?: { display_name: string } }> = [];

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
        if (data.tracks?.items?.length) tracks = data.tracks.items;
        if (data.artists?.items?.length) artists = data.artists.items;
        if (data.albums?.items?.length) albums = data.albums.items;
        if (data.playlists?.items?.length) playlists = data.playlists.items;
      }
    }
  } catch (err) {
    console.warn('Spotify official search failed:', err);
  }

  // 2. Parallel multi-entity iTunes Search Fallback to guarantee Artists, Albums, and Playlists
  try {
    const [songsRes, albumsRes, artistsRes] = await Promise.all([
      fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(cleanQ)}&media=music&entity=song&limit=15`),
      fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(cleanQ)}&media=music&entity=album&limit=8`),
      fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(cleanQ)}&media=music&entity=musicArtist&limit=6`),
    ]);

    const songData = songsRes.ok ? await songsRes.json() : { results: [] };
    const albumData = albumsRes.ok ? await albumsRes.json() : { results: [] };
    const artistData = artistsRes.ok ? await artistsRes.json() : { results: [] };

    if (tracks.length === 0) {
      tracks = (songData.results || []).map((t: any, idx: number) => ({
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
    }

    if (artists.length === 0) {
      const artistMap = new Map<string, { id: string; name: string; images: Array<{ url: string }> }>();

      (artistData.results || []).forEach((a: any, idx: number) => {
        if (a.artistName) {
          const matchSong = (songData.results || []).find((s: any) => s.artistName?.toLowerCase() === a.artistName?.toLowerCase());
          const img = matchSong?.artworkUrl100?.replace('100x100bb', '600x600bb') ||
                      songData.results?.[idx]?.artworkUrl100?.replace('100x100bb', '600x600bb') ||
                      tracks[0]?.album?.images?.[0]?.url ||
                      'https://i.scdn.co/image/ab6761610000e5eb4e015d3113dd88ee0cb71658';

          artistMap.set(a.artistName.toLowerCase(), {
            id: `art-${a.artistId || idx}`,
            name: a.artistName,
            images: [{ url: img }],
          });
        }
      });

      for (const t of songData.results || []) {
        if (t.artistName && !artistMap.has(t.artistName.toLowerCase())) {
          artistMap.set(t.artistName.toLowerCase(), {
            id: `art-${t.artistId || t.artistName.toLowerCase().replace(/\s+/g, '-')}`,
            name: t.artistName,
            images: [{ url: (t.artworkUrl100 || '').replace('100x100bb', '600x600bb') }],
          });
        }
        if (artistMap.size >= 8) break;
      }

      artists = Array.from(artistMap.values());
    }

    if (albums.length === 0) {
      albums = (albumData.results || []).map((a: any, idx: number) => ({
        id: `alb-${a.collectionId || idx}`,
        name: a.collectionName,
        artists: [{ name: a.artistName }],
        images: [{ url: (a.artworkUrl100 || '').replace('100x100bb', '600x600bb') }],
        release_date: (a.releaseDate || '').slice(0, 4) || '2024',
      }));
    }

    if (playlists.length === 0) {
      const topCover = tracks[0]?.album?.images?.[0]?.url || 'https://i.scdn.co/image/ab67706f00000002acc0778b688c66b07afc5426';
      const secondCover = tracks[1]?.album?.images?.[0]?.url || 'https://i.scdn.co/image/ab67706f000000022072b736ac89da8c376e3fe6';
      const thirdCover = albums[0]?.images?.[0]?.url || topCover;

      playlists = [
        {
          id: `search-pl-${cleanQ.toLowerCase().replace(/\s+/g, '-')}`,
          name: `This Is ${cleanQ.charAt(0).toUpperCase() + cleanQ.slice(1)}`,
          images: [{ url: topCover }],
          owner: { display_name: 'Spotify' },
        },
        {
          id: `search-mix-${cleanQ.toLowerCase().replace(/\s+/g, '-')}`,
          name: `Mix de ${cleanQ.charAt(0).toUpperCase() + cleanQ.slice(1)}`,
          images: [{ url: secondCover }],
          owner: { display_name: 'Spotify' },
        },
        {
          id: `search-radio-${cleanQ.toLowerCase().replace(/\s+/g, '-')}`,
          name: `Radio de ${cleanQ.charAt(0).toUpperCase() + cleanQ.slice(1)}`,
          images: [{ url: thirdCover }],
          owner: { display_name: 'Spotify' },
        },
      ];
    }
  } catch (err) {
    console.error('Parallel search enrichment failed:', err);
  }

  return {
    tracks: { items: tracks },
    artists: { items: artists },
    albums: { items: albums },
    playlists: { items: playlists },
  };
}
