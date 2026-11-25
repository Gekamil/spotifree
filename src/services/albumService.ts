import type { Track, Playlist } from '../types/spotify';
import { useSpotifyDataStore } from '../store/useSpotifyDataStore';
import { toHDImage } from '../utils/formatters';

interface FetchAlbumResult {
  tracks: Track[];
  album?: Partial<Playlist>;
}

// In-memory cache for fast repeat album opens
const ALBUM_CACHE = new Map<string, { result: FetchAlbumResult; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function isAlbumIdentifier(id: string, type?: string, description?: string): boolean {
  if (type === 'album') return true;
  if (!id) return false;
  if (id.toLowerCase().startsWith('spotify:album:')) return true;
  const lowerDesc = (description || '').toLowerCase();
  if (lowerDesc.includes('álbum') || lowerDesc.includes('album')) return true;
  const clean = id.replace(/^spotify:(playlist|album):/i, '').trim();
  return clean.startsWith('alb-') || clean.startsWith('album-');
}

/**
 * Robustly fetches all tracks for an album from Spotify, Deezer, iTunes or multi-source fallback.
 * Prevents 0-track empty screens when opening an album from a song.
 */
export async function fetchAlbumTracks(
  albumId: string,
  albumNameHint?: string,
  artistNameHint?: string,
  albumCoverHint?: string
): Promise<FetchAlbumResult> {
  const normId = (albumId || '').replace(/^spotify:album:/i, '').split('?')[0].trim();
  const cacheKey = `${normId}::${(albumNameHint || '').toLowerCase().trim()}::${(artistNameHint || '').toLowerCase().trim()}`;

  // 1. Check in-memory cache
  const cachedMem = ALBUM_CACHE.get(cacheKey) || ALBUM_CACHE.get(normId);
  if (cachedMem && Date.now() - cachedMem.timestamp < CACHE_TTL_MS && cachedMem.result.tracks.length > 0) {
    return cachedMem.result;
  }

  // 2. Check store playlistDetailsCache
  const storeCache = useSpotifyDataStore.getState().playlistDetailsCache;
  const cachedStore = storeCache[normId] || storeCache[albumId];
  if (cachedStore && Array.isArray(cachedStore.tracks?.items) && cachedStore.tracks.items.length > 0) {
    const res: FetchAlbumResult = {
      tracks: cachedStore.tracks.items,
      album: cachedStore,
    };
    ALBUM_CACHE.set(cacheKey, { result: res, timestamp: Date.now() });
    return res;
  }

  const rawClean = normId.replace(/^(alb-|album-)/i, '').trim();

  // 3. Direct Deezer Numeric Album Lookup (alb-12345 or dz-12345)
  const dzNumericId = rawClean.replace(/^dz-/, '');
  if (/^\d+$/.test(dzNumericId)) {
    try {
      const dzRes = await fetch(`https://api.deezer.com/album/${dzNumericId}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout ? AbortSignal.timeout(4000) : undefined,
      });
      if (dzRes.ok) {
        const data = await dzRes.json();
        if (data && data.title && Array.isArray(data.tracks?.data) && data.tracks.data.length > 0) {
          const cover = toHDImage(data.cover_xl || data.cover_big || data.cover_medium || data.cover || albumCoverHint || '');
          const artistName = data.artist?.name || artistNameHint || 'Artista';
          const tracks: Track[] = data.tracks.data.map((t: any, idx: number) => ({
            id: `dz-${t.id}`,
            name: t.title || t.title_short || 'Cancion',
            duration_ms: (t.duration || 210) * 1000,
            preview_url: t.preview || null,
            artists: [{ id: `art-${t.artist?.id || data.artist?.id || idx}`, name: t.artist?.name || artistName }],
            album: {
              id: normId,
              name: data.title,
              images: cover ? [{ url: cover }] : [],
            },
            added_at: 'Reciente',
          }));

          const albumInfo: Partial<Playlist> = {
            id: normId,
            name: data.title,
            description: data.description || `Album de ${artistName} • ${data.release_date?.split('-')[0] || ''}`.trim(),
            type: 'album',
            images: cover ? [{ url: cover }] : [],
            owner: { display_name: artistName, id: `user-${data.artist?.id || 'dz'}` },
            color: '#303030',
            tracks: { total: data.nb_tracks || tracks.length, items: tracks },
          };

          const res: FetchAlbumResult = { tracks, album: albumInfo };
          ALBUM_CACHE.set(cacheKey, { result: res, timestamp: Date.now() });
          useSpotifyDataStore.getState().cachePlaylistDetails(albumInfo as Playlist);
          return res;
        }
      }
    } catch {}
  }

  // 4. Direct iTunes Collection Lookup (alb-itunes-12345)
  if (rawClean.startsWith('itunes-')) {
    const itunesId = rawClean.replace(/^itunes-/, '');
    if (/^\d+$/.test(itunesId)) {
      try {
        const itRes = await fetch(`https://itunes.apple.com/lookup?id=${itunesId}&entity=song`, {
          signal: AbortSignal.timeout ? AbortSignal.timeout(4000) : undefined,
        });
        if (itRes.ok) {
          const itData = await itRes.json();
          if (Array.isArray(itData.results) && itData.results.length > 1) {
            const coll = itData.results[0];
            const songItems = itData.results.slice(1);
            const cover = toHDImage((coll.artworkUrl100 || albumCoverHint || '').replace('100x100bb', '600x600bb'));
            const artistName = coll.artistName || artistNameHint || 'Artista';
            const tracks: Track[] = songItems.map((t: any, idx: number) => ({
              id: `itunes-${t.trackId}`,
              name: t.trackName || 'Cancion',
              duration_ms: t.trackTimeMillis || 210000,
              preview_url: t.previewUrl || null,
              artists: [{ id: `art-${t.artistId || idx}`, name: t.artistName || artistName }],
              album: {
                id: normId,
                name: coll.collectionName || t.collectionName || albumNameHint || 'Album',
                images: cover ? [{ url: cover }] : [],
              },
              added_at: 'Reciente',
            }));

            const albumInfo: Partial<Playlist> = {
              id: normId,
              name: coll.collectionName || albumNameHint || 'Album',
              description: `Album de ${artistName} • ${coll.releaseDate?.split('-')[0] || ''}`.trim(),
              type: 'album',
              images: cover ? [{ url: cover }] : [],
              owner: { display_name: artistName, id: 'itunes' },
              color: '#303030',
              tracks: { total: tracks.length, items: tracks },
            };

            const res: FetchAlbumResult = { tracks, album: albumInfo };
            ALBUM_CACHE.set(cacheKey, { result: res, timestamp: Date.now() });
            useSpotifyDataStore.getState().cachePlaylistDetails(albumInfo as Playlist);
            return res;
          }
        }
      } catch {}
    }
  }

  // 5. Direct Spotify 22-character Album ID or Endpoint Query
  const spotifyId = rawClean;
  const isLikelySpotifyId = /^[0-9A-Za-z]{22}$/.test(spotifyId);
  const targetEndpoints = isLikelySpotifyId
    ? [`/api/spotify/playlist/${spotifyId}?refresh=1`, `/api/spotify/playlist/${encodeURIComponent(normId)}?refresh=1`]
    : [`/api/spotify/playlist/${encodeURIComponent(normId)}?refresh=1`];

  for (const endpoint of targetEndpoints) {
    try {
      const userCookie = typeof window !== 'undefined' ? window.localStorage.getItem('user_spotify_cookie') || '' : '';
      const accessToken = typeof window !== 'undefined' ? window.localStorage.getItem('spotify_access_token') || '' : '';
      const headers: Record<string, string> = {};
      if (userCookie) headers['x-spotify-cookie'] = userCookie;
      if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

      const res = await fetch(endpoint, {
        headers,
        signal: AbortSignal.timeout ? AbortSignal.timeout(5000) : undefined,
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.tracks?.items) && data.tracks.items.length > 0) {
          const cover = toHDImage(data.images?.[0]?.url || albumCoverHint || '');
          const result: FetchAlbumResult = {
            tracks: data.tracks.items,
            album: {
              ...data,
              type: 'album',
              images: cover ? [{ url: cover }] : (data.images || []),
            },
          };
          ALBUM_CACHE.set(cacheKey, { result, timestamp: Date.now() });
          useSpotifyDataStore.getState().cachePlaylistDetails({
            ...data,
            id: normId,
            type: 'album',
          } as Playlist);
          return result;
        }
      }
    } catch {}
  }

  // 6. Multi-Source Search Fallback by Album Name & Artist Name
  let resolvedAlbumName = (albumNameHint || '').trim();
  if (!resolvedAlbumName && normId.startsWith('alb-name-')) {
    try {
      resolvedAlbumName = decodeURIComponent(normId.replace(/^alb-name-/, '')).trim();
    } catch {}
  }

  const isGenericName = !resolvedAlbumName || /^(desconocido|archivo local|spotifree|album|álbum|cancion|canción)$/i.test(resolvedAlbumName);
  if (!isGenericName) {
    const cleanAlbumTitle = resolvedAlbumName.replace(/[()[\]{}_-]/g, ' ').replace(/\s+/g, ' ').trim();
    const cleanArtistTitle = (artistNameHint || '').replace(/[()[\]{}_-]/g, ' ').replace(/\s+/g, ' ').trim();

    // Source A: Search Deezer Album Catalog
    try {
      const searchQueries = cleanArtistTitle
        ? [`"${cleanAlbumTitle}" ${cleanArtistTitle}`, `${cleanAlbumTitle} ${cleanArtistTitle}`, cleanAlbumTitle]
        : [cleanAlbumTitle];

      let matchedDeezerAlbumId: string | null = null;
      for (const q of searchQueries) {
        const sRes = await fetch(`https://api.deezer.com/search/album?q=${encodeURIComponent(q)}&limit=6`, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout ? AbortSignal.timeout(3500) : undefined,
        });
        if (sRes.ok) {
          const sData = await sRes.json();
          if (Array.isArray(sData.data) && sData.data.length > 0) {
            const exact = sData.data.find((a: any) => {
              const aTitle = (a.title || '').toLowerCase().trim();
              const target = cleanAlbumTitle.toLowerCase();
              return aTitle === target || target.includes(aTitle) || aTitle.includes(target);
            }) || sData.data[0];

            if (exact?.id) {
              matchedDeezerAlbumId = String(exact.id);
              break;
            }
          }
        }
      }

      if (matchedDeezerAlbumId) {
        const detailRes = await fetch(`https://api.deezer.com/album/${matchedDeezerAlbumId}`, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout ? AbortSignal.timeout(4000) : undefined,
        });
        if (detailRes.ok) {
          const detailData = await detailRes.json();
          if (detailData && Array.isArray(detailData.tracks?.data) && detailData.tracks.data.length > 0) {
            const cover = toHDImage(detailData.cover_xl || detailData.cover_big || detailData.cover_medium || detailData.cover || albumCoverHint || '');
            const artistName = detailData.artist?.name || cleanArtistTitle || 'Artista';
            const tracks: Track[] = detailData.tracks.data.map((t: any, idx: number) => ({
              id: `dz-${t.id}`,
              name: t.title || t.title_short || 'Cancion',
              duration_ms: (t.duration || 210) * 1000,
              preview_url: t.preview || null,
              artists: [{ id: `art-${t.artist?.id || detailData.artist?.id || idx}`, name: t.artist?.name || artistName }],
              album: {
                id: normId,
                name: detailData.title || resolvedAlbumName,
                images: cover ? [{ url: cover }] : [],
              },
              added_at: 'Reciente',
            }));

            const albumInfo: Partial<Playlist> = {
              id: normId,
              name: detailData.title || resolvedAlbumName,
              description: `Album de ${artistName} • ${detailData.release_date?.split('-')[0] || ''}`.trim(),
              type: 'album',
              images: cover ? [{ url: cover }] : [],
              owner: { display_name: artistName, id: `user-${detailData.artist?.id || 'dz'}` },
              color: '#303030',
              tracks: { total: detailData.nb_tracks || tracks.length, items: tracks },
            };

            const res: FetchAlbumResult = { tracks, album: albumInfo };
            ALBUM_CACHE.set(cacheKey, { result: res, timestamp: Date.now() });
            useSpotifyDataStore.getState().cachePlaylistDetails(albumInfo as Playlist);
            return res;
          }
        }
      }
    } catch {}

    // Source B: Search iTunes Album Catalog
    try {
      const q = cleanArtistTitle ? `${cleanAlbumTitle} ${cleanArtistTitle}` : cleanAlbumTitle;
      const itRes = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=album&limit=4`, {
        signal: AbortSignal.timeout ? AbortSignal.timeout(3500) : undefined,
      });
      if (itRes.ok) {
        const itData = await itRes.json();
        if (Array.isArray(itData.results) && itData.results.length > 0) {
          const coll = itData.results[0];
          if (coll.collectionId) {
            const detailRes = await fetch(`https://itunes.apple.com/lookup?id=${coll.collectionId}&entity=song`, {
              signal: AbortSignal.timeout ? AbortSignal.timeout(4000) : undefined,
            });
            if (detailRes.ok) {
              const detailData = await detailRes.json();
              if (Array.isArray(detailData.results) && detailData.results.length > 1) {
                const songItems = detailData.results.slice(1);
                const cover = toHDImage((coll.artworkUrl100 || albumCoverHint || '').replace('100x100bb', '600x600bb'));
                const artistName = coll.artistName || cleanArtistTitle || 'Artista';
                const tracks: Track[] = songItems.map((t: any, idx: number) => ({
                  id: `itunes-${t.trackId}`,
                  name: t.trackName || 'Cancion',
                  duration_ms: t.trackTimeMillis || 210000,
                  preview_url: t.previewUrl || null,
                  artists: [{ id: `art-${t.artistId || idx}`, name: t.artistName || artistName }],
                  album: {
                    id: normId,
                    name: coll.collectionName || resolvedAlbumName,
                    images: cover ? [{ url: cover }] : [],
                  },
                  added_at: 'Reciente',
                }));

                const albumInfo: Partial<Playlist> = {
                  id: normId,
                  name: coll.collectionName || resolvedAlbumName,
                  description: `Album de ${artistName} • ${coll.releaseDate?.split('-')[0] || ''}`.trim(),
                  type: 'album',
                  images: cover ? [{ url: cover }] : [],
                  owner: { display_name: artistName, id: 'itunes' },
                  color: '#303030',
                  tracks: { total: tracks.length, items: tracks },
                };

                const res: FetchAlbumResult = { tracks, album: albumInfo };
                ALBUM_CACHE.set(cacheKey, { result: res, timestamp: Date.now() });
                useSpotifyDataStore.getState().cachePlaylistDetails(albumInfo as Playlist);
                return res;
              }
            }
          }
        }
      }
    } catch {}

    // Source C: Search Spotifree Backend API for album tracks
    try {
      const q = cleanArtistTitle ? `${cleanAlbumTitle} ${cleanArtistTitle}` : cleanAlbumTitle;
      const sRes = await fetch(`/api/spotify/search?q=${encodeURIComponent(q)}&limit=30`, {
        signal: AbortSignal.timeout ? AbortSignal.timeout(4000) : undefined,
      });
      if (sRes.ok) {
        const sData = await sRes.json();
        const candTracks = (sData.tracks?.items || []).filter((t: Track) => {
          const tAlb = (t.album?.name || '').toLowerCase().trim();
          const target = cleanAlbumTitle.toLowerCase();
          return tAlb === target || target.includes(tAlb) || tAlb.includes(target);
        });

        if (candTracks.length > 0) {
          const cover = toHDImage(candTracks[0]?.album?.images?.[0]?.url || albumCoverHint || '');
          const artistName = candTracks[0]?.artists?.[0]?.name || cleanArtistTitle || 'Artista';
          const albumInfo: Partial<Playlist> = {
            id: normId,
            name: resolvedAlbumName,
            description: `Album • ${artistName}`,
            type: 'album',
            images: cover ? [{ url: cover }] : [],
            owner: { display_name: artistName, id: 'spotify' },
            color: '#303030',
            tracks: { total: candTracks.length, items: candTracks },
          };

          const res: FetchAlbumResult = { tracks: candTracks, album: albumInfo };
          ALBUM_CACHE.set(cacheKey, { result: res, timestamp: Date.now() });
          useSpotifyDataStore.getState().cachePlaylistDetails(albumInfo as Playlist);
          return res;
        }
      }
    } catch {}
  }

  return { tracks: [] };
}
