import type { Track, Playlist } from '../types/spotify';
import { useSpotifyDataStore } from '../store/useSpotifyDataStore';
import { getArtistPicture, ARTIST_IMAGE_CACHE } from '../utils/artistImage';

/**
 * Resolves clean artist name from an artist ID or playlist name
 */
export function resolveArtistName(artistId: string, fallbackName?: string): string {
  if (fallbackName && fallbackName.trim() && !/^playlist$/i.test(fallbackName.trim())) {
    return fallbackName.replace(/^(art-|artist-|sf-artist-)/i, '').trim();
  }
  const clean = artistId.replace(/^(art-|artist-|sf-artist-|spotify:artist:)/i, '').replace(/[-_]+/g, ' ').trim();
  // Capitalize words nicely if derived from slug
  return clean.replace(/\b\w/g, (c) => c.toUpperCase()) || 'Artista';
}

/**
 * Robustly fetches top tracks for an artist using multi-tier fallbacks:
 * 1. Cache in SpotifyDataStore
 * 2. Spotify Search / Artist Top Tracks API
 * 3. Deezer Artist Search API
 * 4. iTunes Artist Search API
 * 5. Local library scan matching artist
 */
export async function fetchArtistTopTracks(artistId: string, artistNameHint?: string): Promise<Track[]> {
  const cleanName = resolveArtistName(artistId, artistNameHint);

  // 1. Check if already cached in memory or store
  const cached = useSpotifyDataStore.getState().playlistDetailsCache[artistId];
  if (cached && Array.isArray(cached.tracks?.items) && cached.tracks.items.length > 0) {
    const items = (cached.tracks.items as any[]).map((x) => (x.track ? x.track : x)).filter(Boolean);
    if (items.length > 0) return items;
  }

  let songs: Track[] = [];

  // 1.5. Direct Backend Fast-Path (/api/playlist handles Deezer & iTunes server-side with zero CORS issues)
  try {
    const pRes = await fetch(`/api/playlist?id=${encodeURIComponent(artistId)}`);
    if (pRes.ok) {
      const pData = await pRes.json();
      if (Array.isArray(pData.tracks?.items) && pData.tracks.items.length > 0) {
        songs = pData.tracks.items.map((x: any) => (x.track ? x.track : x)).filter(Boolean);
        if (pData.images?.[0]?.url) {
          ARTIST_IMAGE_CACHE.set(cleanName.toLowerCase(), pData.images[0].url);
        }
        if (songs.length > 0) return songs;
      }
    }
  } catch {}

  // 2. Try Spotify search endpoint
  try {
    const sRes = await fetch(`/api/spotify/search?q=${encodeURIComponent(cleanName)}`);
    if (sRes.ok) {
      const sData = await sRes.json();
      if (Array.isArray(sData.tracks?.items) && sData.tracks.items.length > 0) {
        const matching = sData.tracks.items.filter((t: Track) =>
          t.artists?.some((a) => a.name.toLowerCase().includes(cleanName.toLowerCase()))
        );
        songs = matching.length > 0 ? matching : sData.tracks.items.slice(0, 25);
      }
    }
  } catch {}

  // 3. Try Deezer Search API
  if (songs.length === 0) {
    try {
      const dzRes = await fetch(`https://api.deezer.com/search?q=artist:"${encodeURIComponent(cleanName)}"&limit=30`);
      if (dzRes.ok) {
        const dzData = await dzRes.json();
        if (Array.isArray(dzData.data) && dzData.data.length > 0) {
          songs = dzData.data.map((t: any, idx: number) => ({
            id: `dz-${t.id}`,
            name: t.title || t.title_short || 'Canción',
            duration_ms: (t.duration || 210) * 1000,
            preview_url: t.preview || null,
            artists: [{ id: `art-${t.artist?.id || idx}`, name: t.artist?.name || cleanName }],
            album: {
              id: `alb-${t.album?.id || idx}`,
              name: t.album?.title || t.title,
              images: [{ url: t.album?.cover_xl || t.album?.cover_big || t.album?.cover_medium || '' }],
            },
          }));
        }
      }
    } catch {}
  }

  // 4. Try iTunes Search API
  if (songs.length === 0) {
    try {
      const itunesRes = await fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(cleanName)}&media=music&entity=song&limit=30`
      );
      if (itunesRes.ok) {
        const itData = await itunesRes.json();
        if (Array.isArray(itData.results) && itData.results.length > 0) {
          songs = itData.results.map((t: any, idx: number) => ({
            id: `itunes-${t.trackId || idx}`,
            name: t.trackName || 'Canción',
            duration_ms: (t.trackTimeMillis && t.trackTimeMillis > 35000) ? t.trackTimeMillis : 210000,
            preview_url: t.previewUrl || null,
            artists: [{ id: `art-${t.artistId || idx}`, name: t.artistName || cleanName }],
            album: {
              id: `alb-${t.collectionId || idx}`,
              name: t.collectionName || t.trackName,
              images: [{ url: (t.artworkUrl100 || '').replace('100x100bb', '600x600bb') }],
            },
          }));
        }
      }
    } catch {}
  }

  // 5. Fallback: match from user's playlists & library
  if (songs.length === 0) {
    const allPlaylists = useSpotifyDataStore.getState().playlists || [];
    const localMatches: Track[] = [];
    const lowerName = cleanName.toLowerCase();
    for (const pl of allPlaylists) {
      const items = (pl.tracks?.items || []).map((x: any) => (x.track ? x.track : x)).filter(Boolean);
      for (const t of items) {
        if (t.artists?.some((a: any) => a.name.toLowerCase().includes(lowerName))) {
          if (!localMatches.some((m) => m.id === t.id)) {
            localMatches.push(t);
          }
        }
      }
    }
    if (localMatches.length > 0) {
      songs = localMatches.slice(0, 30);
    }
  }

  // Cache in store if we found songs
  if (songs.length > 0) {
    const cachedPic = ARTIST_IMAGE_CACHE.get(cleanName.toLowerCase());
    const artistPic = cachedPic || (await getArtistPicture(cleanName));
    const artistCover = artistPic || songs[0]?.album?.images?.[0]?.url || '';
    const syntheticPlaylist: Playlist = {
      id: artistId,
      name: cleanName,
      description: 'Artista oficial • Verificado en Spotify',
      type: 'artist',
      images: [{ url: artistCover }],
      owner: { display_name: 'Spotify', id: 'spotify' },
      tracks: { total: songs.length, items: songs },
    } as any;

    useSpotifyDataStore.getState().cachePlaylistDetails(syntheticPlaylist);
  }

  return songs;
}
