import type { Track, Playlist } from '../types/spotify';
import { getArtistPicture, ARTIST_IMAGE_CACHE } from '../utils/artistImage';
import { useSpotifyDataStore } from '../store/useSpotifyDataStore';

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
 * Normalizes track title to canonical key for deduplication:
 * Strips diacritics, case, remaster/live/deluxe/anniversary/year parentheticals, and punctuation.
 */
export function normalizeTrackKey(title: string): string {
  return (title || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s*[-–—]\s*(remastered|remaster|live|radio edit|deluxe|bonus track|anniversary|edit|mono|stereo|single version).*/i, '')
    .replace(/\s*\((album\s+version|album|remastered|remaster|live|deluxe|bonus track|anniversary|\d{4}|radio edit|mono|stereo|version|explicit|clean)[^)]*\)/gi, '')
    .replace(/\s*\[(album\s+version|album|remastered|remaster|live|deluxe|bonus track|anniversary|\d{4}|radio edit|mono|stereo|version|explicit|clean)[^\]]*\]/gi, '')
    .replace(/\s*\((feat|ft)\.?\s+[^)]+\)/gi, '')
    .replace(/\s*\[(feat|ft)\.?\s+[^\]]+\]/gi, '')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Merges two matching track representations, preserving the highest quality metadata.
 */
function mergeTrackMetadata(primary: Track, secondary: Track): Track {
  const isPrimarySpotify = /^[0-9a-zA-Z]{22}$/.test(primary.id);
  const isSecondarySpotify = /^[0-9a-zA-Z]{22}$/.test(secondary.id);
  const bestId = isPrimarySpotify ? primary.id : isSecondarySpotify ? secondary.id : primary.id;

  const pImg = primary.album?.images?.[0]?.url || '';
  const sImg = secondary.album?.images?.[0]?.url || '';
  const bestImg = (pImg.includes('1000x1000') || pImg.includes('b273') || pImg.includes('640'))
    ? pImg
    : (sImg.includes('1000x1000') || sImg.includes('b273') || sImg.includes('640'))
    ? sImg
    : pImg || sImg;

  const bestPreview = primary.preview_url || secondary.preview_url || null;
  const bestDuration = (primary.duration_ms && primary.duration_ms > 30000)
    ? primary.duration_ms
    : (secondary.duration_ms && secondary.duration_ms > 30000)
    ? secondary.duration_ms
    : primary.duration_ms || 210000;

  const bestAlbumName = (primary.album?.name && primary.album.name !== primary.name)
    ? primary.album.name
    : secondary.album?.name || primary.album?.name || primary.name;

  return {
    ...primary,
    id: bestId,
    preview_url: bestPreview,
    duration_ms: bestDuration,
    album: {
      id: primary.album?.id || secondary.album?.id || `alb-${bestId}`,
      name: bestAlbumName,
      images: bestImg ? [{ url: bestImg }] : primary.album?.images || [],
    },
  };
}

/**
 * Deep-fetches complete artist track catalogue combining:
 * 1. Deezer Artist Top 100
 * 2. Deezer Artist Search (100)
 * 3. Spotify Search API
 * 4. Backend Discovery API (/api/discover)
 * 5. Backend Playlist Scraper fast-path (/api/playlist)
 * 6. Local User Library & Playlists
 */
export async function fetchArtistTopTracks(artistId: string, artistNameHint?: string): Promise<Track[]> {
  const cleanName = resolveArtistName(artistId, artistNameHint);
  const lowerName = cleanName.toLowerCase();

  // 1. Check existing deep cache
  const cached = useSpotifyDataStore.getState().playlistDetailsCache[artistId];
  if (cached && Array.isArray(cached.tracks?.items) && cached.tracks.items.length >= 45) {
    const items = (cached.tracks.items as any[]).map((x) => (x.track ? x.track : x)).filter(Boolean);
    if (items.length > 0) return items;
  }

  const rawCandidates: Track[] = [];

  // Helper to extract numeric Deezer artist id
  let dzArtistId = '';
  if (/^\d+$/.test(artistId)) {
    dzArtistId = artistId;
  } else if (artistId.startsWith('dz-art-') || artistId.startsWith('dz-')) {
    dzArtistId = artistId.replace(/^(dz-art-|dz-)/, '');
  }

  // Multi-source parallel fetch
  const fetchPromises: Promise<void>[] = [];

  // Source A: Resolve Deezer Artist ID and fetch Top 100
  fetchPromises.push((async () => {
    try {
      let resolvedId = dzArtistId;
      if (!resolvedId) {
        const sRes = await fetch(`https://api.deezer.com/search/artist?q=${encodeURIComponent(cleanName)}&limit=1`, {
          signal: AbortSignal.timeout(3500),
        });
        if (sRes.ok) {
          const sData = await sRes.json();
          if (sData.data?.[0]?.id) resolvedId = String(sData.data[0].id);
        }
      }
      if (resolvedId) {
        const topRes = await fetch(`https://api.deezer.com/artist/${resolvedId}/top?limit=100`, {
          signal: AbortSignal.timeout(4000),
        });
        if (topRes.ok) {
          const topData = await topRes.json();
          if (Array.isArray(topData.data)) {
            topData.data.forEach((t: any) => {
              rawCandidates.push({
                id: `dz-${t.id}`,
                name: t.title || t.title_short || 'Canción',
                duration_ms: (t.duration || 210) * 1000,
                preview_url: t.preview || null,
                artists: [{ id: `art-${t.artist?.id || resolvedId}`, name: t.artist?.name || cleanName }],
                album: {
                  id: `alb-${t.album?.id || t.id}`,
                  name: t.album?.title || t.title,
                  images: [{ url: t.album?.cover_xl || t.album?.cover_big || t.album?.cover_medium || '' }],
                },
              });
            });
          }
        }
      }
    } catch {}
  })());

  // Source B: Deezer Artist Search (limit 100)
  fetchPromises.push((async () => {
    try {
      const dzRes = await fetch(`https://api.deezer.com/search?q=artist:"${encodeURIComponent(cleanName)}"&limit=100`, {
        signal: AbortSignal.timeout(4000),
      });
      if (dzRes.ok) {
        const dzData = await dzRes.json();
        if (Array.isArray(dzData.data)) {
          dzData.data.forEach((t: any) => {
            rawCandidates.push({
              id: `dz-${t.id}`,
              name: t.title || t.title_short || 'Canción',
              duration_ms: (t.duration || 210) * 1000,
              preview_url: t.preview || null,
              artists: [{ id: `art-${t.artist?.id || ''}`, name: t.artist?.name || cleanName }],
              album: {
                id: `alb-${t.album?.id || t.id}`,
                name: t.album?.title || t.title,
                images: [{ url: t.album?.cover_xl || t.album?.cover_big || t.album?.cover_medium || '' }],
              },
            });
          });
        }
      }
    } catch {}
  })());

  // Source C: Spotify Search API
  fetchPromises.push((async () => {
    try {
      const sRes = await fetch(`/api/spotify/search?q=${encodeURIComponent(cleanName)}`, {
        signal: AbortSignal.timeout(3500),
      });
      if (sRes.ok) {
        const sData = await sRes.json();
        if (Array.isArray(sData.tracks?.items)) {
          sData.tracks.items.forEach((t: Track) => {
            const matches = !t.artists?.length || t.artists.some((a) => a.name.toLowerCase().includes(lowerName) || lowerName.includes(a.name.toLowerCase()));
            if (matches) rawCandidates.push(t);
          });
        }
      }
    } catch {}
  })());

  // Source D: Backend Discovery API (/api/discover)
  fetchPromises.push((async () => {
    try {
      const discRes = await fetch(`/api/discover?artist=${encodeURIComponent(cleanName)}`, {
        signal: AbortSignal.timeout(4000),
      });
      if (discRes.ok) {
        const discData = await discRes.json();
        if (Array.isArray(discData.top)) {
          rawCandidates.push(...discData.top);
        }
        if (Array.isArray(discData.recent)) {
          discData.recent.forEach((r: any) => {
            if (Array.isArray(r.tracks)) rawCandidates.push(...r.tracks);
          });
        }
        if (discData.artist?.picture) {
          ARTIST_IMAGE_CACHE.set(lowerName, discData.artist.picture);
        }
      }
    } catch {}
  })());

  // Source E: Backend Playlist Scraper fast-path
  fetchPromises.push((async () => {
    try {
      const pRes = await fetch(`/api/playlist?id=${encodeURIComponent(artistId)}`, {
        signal: AbortSignal.timeout(3500),
      });
      if (pRes.ok) {
        const pData = await pRes.json();
        if (Array.isArray(pData.tracks?.items)) {
          pData.tracks.items.forEach((x: any) => {
            const tr = x.track ? x.track : x;
            if (tr) rawCandidates.push(tr);
          });
        }
        if (pData.images?.[0]?.url) {
          ARTIST_IMAGE_CACHE.set(lowerName, pData.images[0].url);
        }
      }
    } catch {}
  })());

  // Wait for all sources to settle
  await Promise.allSettled(fetchPromises);

  // Source F: Match from local user library & playlists
  try {
    const allPlaylists = useSpotifyDataStore.getState().playlists || [];
    for (const pl of allPlaylists) {
      const items = (pl.tracks?.items || []).map((x: any) => (x.track ? x.track : x)).filter(Boolean);
      for (const t of items) {
        if (t.artists?.some((a: any) => a.name.toLowerCase().includes(lowerName))) {
          rawCandidates.push(t);
        }
      }
    }
  } catch {}

  // Deduplication & Quality Enrichment Map
  const trackMap = new Map<string, Track>();

  for (const track of rawCandidates) {
    if (!track || !track.name) continue;
    const key = normalizeTrackKey(track.name);
    if (!key) continue;

    if (trackMap.has(key)) {
      const existing = trackMap.get(key)!;
      trackMap.set(key, mergeTrackMetadata(existing, track));
    } else {
      trackMap.set(key, track);
    }
  }

  const finalTracks = Array.from(trackMap.values());

  // Cache in store if songs found
  if (finalTracks.length > 0) {
    const cachedPic = ARTIST_IMAGE_CACHE.get(lowerName);
    const artistPic = cachedPic || (await getArtistPicture(cleanName));
    const artistCover = artistPic || finalTracks[0]?.album?.images?.[0]?.url || '';

    const syntheticPlaylist: Playlist = {
      id: artistId,
      name: cleanName,
      description: 'Artista oficial • Verificado en Spotify',
      type: 'artist',
      images: [{ url: artistCover }],
      owner: { display_name: 'Spotify', id: 'spotify' },
      tracks: { total: finalTracks.length, items: finalTracks },
    } as any;

    useSpotifyDataStore.getState().cachePlaylistDetails(syntheticPlaylist);
  }

  return finalTracks;
}
