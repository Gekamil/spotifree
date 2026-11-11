const MEMORY_PLAYLIST_CACHE = new Map();
import { toHDImage, cleanSpDcString, getWebPlayerAuth, extractEntityImage } from './_lib/extract-session.js';
import { readExternalPlaylist } from './_lib/import-playlist.js';
import { buildArtistSoundCloudVault, resolveSoundCloudUrl } from './_lib/musicFallback.js';

function stripHtml(text) {
  if (!text) return '';
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function parseEmbedHtml(html, cleanId) {
  const scriptMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!scriptMatch) {
    throw new Error('Embed NEXT_DATA not found in page');
  }

  const data = JSON.parse(scriptMatch[1]);
  const entity = data.props?.pageProps?.state?.data?.entity;

  if (!entity) {
    throw new Error('Entity missing from Spotify Embed');
  }

  const coverUrl = toHDImage(
    entity.visualIdentity?.image?.[0]?.url ||
    entity.coverArt?.sources?.[0]?.url ||
    entity.images?.[0]?.url ||
    'https://misc.scdn.co/liked-songs/liked-songs-640.jpg'
  );

  const tracks = (entity.trackList || []).map((t, idx) => {
    const rawUri = t.uri || '';
    const trackId = rawUri.split(':').pop() || `track-${idx}`;
    const artistNames = t.subtitle ? t.subtitle.split(', ') : ['Spotify'];
    const rawTrackCover = t.visualIdentity?.image?.[0]?.url || t.coverArt?.sources?.[0]?.url;
    const trackCover = rawTrackCover ? toHDImage(rawTrackCover) : null;

    return {
      id: trackId,
      name: t.title,
      artists: artistNames.map((name, i) => ({
        id: `artist-${idx}-${i}`,
        name: name.trim(),
      })),
      album: {
        id: `album-${cleanId}`,
        name: entity.name,
        images: trackCover ? [{ url: trackCover }] : [],
      },
      duration_ms: t.duration || 180000,
      preview_url: t.audioPreview?.url || null,
      added_at: 'Reciente',
    };
  });

  const rawBanner =
    entity.visualIdentity?.image?.[0]?.url ||
    entity.headerImage?.sources?.[0]?.url ||
    entity.header_image?.url ||
    entity.images?.find(i => (i.width || 0) > (i.height || 0))?.url ||
    (coverUrl && coverUrl.includes('/img/daily/') ? coverUrl : null) ||
    null;
  const bannerUrl = rawBanner ? toHDImage(rawBanner) : undefined;

  return {
    id: cleanId,
    name: entity.name,
    description: stripHtml(entity.description || ''),
    type: entity.type || 'playlist',
    images: [{ url: coverUrl }],
    ...(bannerUrl ? { bannerUrl } : {}),
    owner: {
      display_name: (entity.type === 'album' && entity.subtitle) ? entity.subtitle : (entity.owner?.name || 'Spotify'),
      id: entity.owner?.id || 'spotify',
    },
    color: '#303030',
    tracks: {
      total: tracks.length,
      items: tracks,
    },
  };
}

/**
 * Resolves a real Spotify Playlist / Album / Liked Songs directly from Spotify's
 * internal Pathfinder GraphQL and Web API with zero mock/fake tracks.
 */
export async function resolveSpotifyPlaylist(playlistId, { cookie = '', token = '' } = {}) {
  const cleanId = (playlistId || '')
    .replace(/^spotify:playlist:/, '')
    .replace(/^spotify:album:/, '')
    .replace(/^spotify:collection:/, '')
    .split('?')[0]
    .trim();

  if (!cleanId) {
    throw new Error('ID de playlist no proporcionado');
  }

  // Check in-memory instant cache
  if (MEMORY_PLAYLIST_CACHE.has(cleanId)) {
    const cached = MEMORY_PLAYLIST_CACHE.get(cleanId);
    if (cached?.tracks?.items?.length > 0) {
      return cached;
    }
  }

  // Deezer playlist direct fast-path
  if (cleanId.startsWith('dz-') || /^\d+$/.test(cleanId)) {
    const dzId = cleanId.replace(/^dz-(pl-)?/, '');
    try {
      const dzRes = await fetch(`https://api.deezer.com/playlist/${dzId}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        signal: AbortSignal.timeout ? AbortSignal.timeout(4000) : undefined,
      });
      if (dzRes.ok) {
        const data = await dzRes.json();
        if (data && data.title) {
          const cover = toHDImage(data.picture_xl || data.picture_big || data.picture_medium || data.picture);
          const tracks = (data.tracks?.data || []).map((t, idx) => ({
            id: `dz-${t.id}`,
            name: t.title || t.title_short,
            artists: [{ id: `art-${t.artist?.id || idx}`, name: t.artist?.name || 'Artista' }],
            album: {
              id: `alb-${t.album?.id || cleanId}`,
              name: t.album?.title || t.title,
              images: (t.album?.cover_xl || t.album?.cover_big || t.album?.cover_medium)
                ? [{ url: toHDImage(t.album?.cover_xl || t.album?.cover_big || t.album?.cover_medium) }]
                : [],
            },
            duration_ms: (t.duration || 210) * 1000,
            preview_url: null,
            added_at: 'Reciente',
          }));

          const mapped = {
            id: cleanId,
            name: data.title,
            description: stripHtml(data.description) || `Playlist de ${data.creator?.name || 'Usuario'}`,
            type: 'playlist',
            images: cover ? [{ url: cover }] : [],
            owner: {
              display_name: data.creator?.name || 'Deezer',
              id: `user-${data.creator?.id || 'dz'}`,
            },
            color: '#303030',
            tracks: {
              total: data.nb_tracks || tracks.length,
              items: tracks,
            },
          };
          MEMORY_PLAYLIST_CACHE.set(cleanId, mapped);
          return mapped;
        }
      }
    } catch (e) {
      console.warn('[Playlist API] Deezer fetch error:', e.message);
    }
  }

  // Artist profile direct fast-path (art-* / artist-*)
  if (cleanId.startsWith('art-') || cleanId.startsWith('artist-')) {
    const artRaw = cleanId.replace(/^(art-|artist-)/, '');
    let artistName = artRaw;
    try { artistName = decodeURIComponent(artRaw); } catch {}
    try {
      let dzArtist = null;
      if (/^\d+$/.test(artRaw)) {
        const aRes = await fetch(`https://api.deezer.com/artist/${artRaw}`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          signal: AbortSignal.timeout ? AbortSignal.timeout(4000) : undefined,
        });
        if (aRes.ok) dzArtist = await aRes.json();
      }
      if (!dzArtist || !dzArtist.name) {
        const sRes = await fetch(`https://api.deezer.com/search/artist?q=${encodeURIComponent(artistName)}&limit=1`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          signal: AbortSignal.timeout ? AbortSignal.timeout(4000) : undefined,
        });
        if (sRes.ok) {
          const sData = await sRes.json();
          if (sData.data?.length) dzArtist = sData.data[0];
        }
      }
      if (dzArtist && dzArtist.id) {
        const topRes = await fetch(`https://api.deezer.com/artist/${dzArtist.id}/top?limit=40`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          signal: AbortSignal.timeout ? AbortSignal.timeout(4000) : undefined,
        });
        const topData = topRes.ok ? await topRes.json() : { data: [] };
        const cover = toHDImage(dzArtist.picture_xl || dzArtist.picture_big || dzArtist.picture_medium || dzArtist.picture);
        const tracks = (topData.data || []).map((t, idx) => ({
          id: `dz-${t.id}`,
          name: t.title || t.title_short,
          artists: [{ id: `art-${dzArtist.id}`, name: dzArtist.name }],
          album: {
            id: `alb-${t.album?.id || cleanId}`,
            name: t.album?.title || t.title,
            images: (t.album?.cover_xl || t.album?.cover_big || t.album?.cover_medium)
              ? [{ url: toHDImage(t.album?.cover_xl || t.album?.cover_big || t.album?.cover_medium) }]
              : cover ? [{ url: cover }] : [],
          },
          duration_ms: (t.duration || 210) * 1000,
          preview_url: null,
          added_at: 'Popular',
        }));

        const mapped = {
          id: cleanId,
          name: dzArtist.name,
          description: 'Artista',
          type: 'artist',
          images: cover ? [{ url: cover }] : [],
          owner: {
            display_name: 'Spotify',
            id: 'spotify',
          },
          color: '#181818',
          tracks: {
            total: tracks.length,
            items: tracks,
          },
        };
        MEMORY_PLAYLIST_CACHE.set(cleanId, mapped);
        return mapped;
      }
    } catch (e) {
      console.warn('[Playlist API] Artist fetch error:', e.message);
    }
  }

  // 0. Check pre-extracted cached playlist details from session feed (instant resolution for recommended cards & shelves)
  try {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const sessionFile = path.resolve('src/data/liveExtractedSession.json');
    if (fs.existsSync(sessionFile)) {
      const sessionData = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
      // Only Spotify's editorial playlists (37i9dQZF1D…, the same for everyone). Personal lists of
      // the account the file was extracted from (its mixes, its own playlists) are never served.
      const isEditorial = /^37i9dQZF1D/.test(cleanId);
      if (isEditorial && sessionData.cachedPlaylistDetails && sessionData.cachedPlaylistDetails[cleanId]) {
        const cached = sessionData.cachedPlaylistDetails[cleanId];
        if (cached?.tracks?.items && cached.tracks.items.length > 0) {
          const cover = cached.images?.[0]?.url || '';
          if (cover.includes('/img/daily/') && !cached.bannerUrl) {
            cached.bannerUrl = cover;
          }
          return cached;
        }
      }
    }
  } catch {}

  const cleanCookie = cleanSpDcString(cookie);
  const isLikedCheck = cleanId === 'collection-tracks' || cleanId === 'liked-songs' || cleanId === 'tracks' || cleanId === 'collection:tracks';

  // Instant fast-path for public playlists: resolve in < 700ms via embed instead of slow auth handshake
  if (!cleanCookie && !isLikedCheck) {
    for (const et of ['playlist', 'album', 'artist']) {
      try {
        const res = await fetch(`https://open.spotify.com/embed/${et}/${cleanId}`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          signal: AbortSignal.timeout ? AbortSignal.timeout(3000) : undefined,
        });
        if (res.ok) {
          const html = await res.text();
          const parsed = parseEmbedHtml(html, cleanId);
          if (parsed && parsed.tracks?.items?.length > 0) {
            MEMORY_PLAYLIST_CACHE.set(cleanId, parsed);
            return parsed;
          }
        }
      } catch {}
    }
  }

  // 1. Resolve Auth Credentials (access token & client token)
  let activeToken = (token || '').replace(/^Bearer\s+/i, '').trim();
  let clientToken = '';
  try {
    const auth = await getWebPlayerAuth(cleanCookie);
    if (!activeToken && auth.accessToken) {
      activeToken = auth.accessToken;
    }
    clientToken = auth.clientToken || '';
  } catch (e) {
    console.warn('[Playlist API] getWebPlayerAuth error:', e.message);
  }

  const pathfinderHeaders = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'app-platform': 'WebPlayer',
    'Origin': 'https://open.spotify.com',
    'Referer': 'https://open.spotify.com/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  };
  if (activeToken) pathfinderHeaders['Authorization'] = `Bearer ${activeToken}`;
  if (clientToken) pathfinderHeaders['Client-Token'] = clientToken;

  // 2. Liked Songs Resolution (Dynamic & Private per user)
  const isLiked =
    cleanId === 'collection-tracks' ||
    cleanId === 'liked-songs' ||
    cleanId === 'tracks' ||
    cleanId === 'collection:tracks';

  if (isLiked) {
    // 2a. Try official Web API v1/me/tracks with active user token
    if (activeToken) {
      try {
        const meTracksRes = await fetch('https://api.spotify.com/v1/me/tracks?limit=50', {
          headers: {
            'Authorization': `Bearer ${activeToken}`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        });

        if (meTracksRes.ok) {
          const data = await meTracksRes.json();
          const tracks = (data.items || []).map((it, idx) => {
            const tr = it.track || it;
            const cover = toHDImage(tr.album?.images?.[0]?.url || 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg');
            return {
              id: tr.id || `liked-song-${idx}`,
              name: tr.name,
              artists: (tr.artists || []).map(a => ({ id: a.id || `art-${a.name}`, name: a.name })),
              album: {
                id: tr.album?.id || `alb-${idx}`,
                name: tr.album?.name || 'Álbum',
                images: [{ url: cover }],
              },
              duration_ms: tr.duration_ms || 180000,
              preview_url: tr.preview_url || null,
              added_at: it.added_at ? new Date(it.added_at).toLocaleDateString('es-ES') : 'Reciente',
            };
          });

          return {
            id: 'collection-tracks',
            name: 'Canciones que te gustan',
            description: `${data.total || tracks.length} canciones guardadas`,
            type: 'playlist',
            images: [{ url: 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg' }],
            owner: { display_name: 'Tú', id: 'me' },
            color: '#5018F0',
            tracks: {
              total: data.total || tracks.length,
              items: tracks,
            },
          };
        }
      } catch (err) {
        console.warn('[Playlist API] Failed to fetch me/tracks with token:', err.message);
      }
    }

    // 2b. Try Pathfinder fetchLibraryTracks
    if (activeToken) {
      try {
        const libQueryRes = await fetch('https://api-partner.spotify.com/pathfinder/v2/query', {
          method: 'POST',
          headers: pathfinderHeaders,
          body: JSON.stringify({
            operationName: 'fetchLibraryTracks',
            variables: { offset: 0, limit: 50 },
            extensions: {
              persistedQuery: {
                version: 1,
                sha256Hash: '087278b20b743578a6262c2b0b4bcd20d879c503cc359a2285baf083ef944240',
              },
            },
          }),
        });

        if (libQueryRes.ok) {
          const libData = await libQueryRes.json();
          const items =
            libData.data?.me?.library?.tracks?.items ||
            libData.data?.me?.libraryTracks?.items ||
            libData.data?.me?.tracks?.items ||
            [];

          if (items.length > 0) {
            const tracks = items.map((it, idx) => {
              const tr = it.track?.data || it.item?.data || it.track || it;
              const coverUrl = toHDImage(
                tr.albumOfTrack?.coverArt?.sources?.[0]?.url ||
                tr.album?.images?.[0]?.url ||
                'https://misc.scdn.co/liked-songs/liked-songs-640.jpg'
              );
              const artistNames =
                tr.artists?.items?.map(a => a.profile?.name || a.name) ||
                tr.artists?.map(a => a.name) ||
                ['Spotify'];

              return {
                id: tr.uri?.split(':').pop() || tr.id || `liked-${idx}`,
                name: tr.name,
                artists: artistNames.map((name, i) => ({ id: `art-${idx}-${i}`, name })),
                album: {
                  id: tr.albumOfTrack?.uri?.split(':').pop() || tr.album?.id || `alb-${idx}`,
                  name: tr.albumOfTrack?.name || tr.album?.name || 'Álbum',
                  images: [{ url: coverUrl }],
                },
                duration_ms: tr.trackDuration?.totalMilliseconds || tr.duration_ms || 180000,
                added_at: it.addedAt?.isoString ? new Date(it.addedAt.isoString).toLocaleDateString('es-ES') : 'Reciente',
              };
            });

            return {
              id: 'collection-tracks',
              name: 'Canciones que te gustan',
              description: `${tracks.length} canciones guardadas`,
              type: 'playlist',
              images: [{ url: 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg' }],
              owner: { display_name: 'Tú', id: 'me' },
              color: '#5018F0',
              tracks: {
                total: tracks.length,
                items: tracks,
              },
            };
          }
        }
      } catch (err) {
        console.warn('[Playlist API] Pathfinder fetchLibraryTracks error:', err.message);
      }
    }

    return {
      id: 'collection-tracks',
      name: 'Canciones que te gustan',
      description: 'Tu lista de «Canciones que te gustan» es privada en Spotify.',
      type: 'playlist',
      images: [{ url: 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg' }],
      owner: { display_name: 'Tú', id: 'me' },
      color: '#5018F0',
      tracks: {
        total: 0,
        items: [],
      },
    };
  }

  // 3. Regular Playlist Resolution via Pathfinder GraphQL fetchPlaylist
  if (activeToken) {
    const playlistHashes = [
      '21ea11a6ac75a5f3e01fd365d29c18e0a4a8b7dc09f89bbb5d73910190c6acaf',
      '8964e8eafb21aa992a7d951d256d83285c04be2105d209262901de70cb97584a',
    ];

    for (const hash of playlistHashes) {
      try {
        const pfRes = await fetch('https://api-partner.spotify.com/pathfinder/v2/query', {
          method: 'POST',
          headers: pathfinderHeaders,
          body: JSON.stringify({
            operationName: 'fetchPlaylist',
            variables: {
              uri: `spotify:playlist:${cleanId}`,
              offset: 0,
              limit: 100,
              enableWatchFeedEntrypoint: false,
            },
            extensions: {
              persistedQuery: {
                version: 1,
                sha256Hash: hash,
              },
            },
          }),
        });

        if (pfRes.ok) {
          const pfData = await pfRes.json();
          const pl = pfData.data?.playlistV2;
          if (pl && pl.name) {
            const rawCover = pl.images?.items?.[0]?.sources?.[0]?.url || '';
            const coverUrl = toHDImage(rawCover);
            const rawItems = pl.content?.items || [];

            const tracks = rawItems.map((c, idx) => {
              const tr = c.itemV2?.data || c.item?.data || c.track || c;
              const explicitTrackArt =
                tr.albumOfTrack?.coverArt?.sources?.find(s => (s.height || 0) >= 300)?.url ||
                tr.albumOfTrack?.coverArt?.sources?.[0]?.url ||
                tr.album?.images?.[0]?.url;
              const trCover = explicitTrackArt ? toHDImage(explicitTrackArt) : null;
              const artistItems =
                tr.artists?.items?.map(a => ({ id: a.uri?.split(':').pop() || `art-${idx}`, name: a.profile?.name || a.name })) ||
                (tr.artists || []).map(a => ({ id: a.id || `art-${idx}`, name: a.name })) ||
                [{ id: `art-${idx}`, name: 'Spotify' }];

              return {
                id: tr.uri?.split(':').pop() || tr.id || `track-${idx}`,
                name: tr.name || 'Canción',
                artists: artistItems,
                album: {
                  id: tr.albumOfTrack?.uri?.split(':').pop() || tr.album?.id || `alb-${idx}`,
                  name: tr.albumOfTrack?.name || tr.album?.name || pl.name,
                  images: trCover ? [{ url: trCover }] : [],
                },
                duration_ms: tr.trackDuration?.totalMilliseconds || tr.duration_ms || 180000,
                preview_url: tr.preview_url || null,
                added_at: c.addedAt?.isoString ? new Date(c.addedAt.isoString).toLocaleDateString('es-ES') : 'Reciente',
              };
            });

            const rawBanner =
              pl.visualIdentity?.image?.[0]?.url ||
              pl.headerImage?.sources?.[0]?.url ||
              pl.header_image?.url ||
              pl.images?.items?.find(i => (i.sources?.[0]?.width || 0) > (i.sources?.[0]?.height || 0))?.sources?.[0]?.url ||
              null;
            const bannerUrl = rawBanner ? toHDImage(rawBanner) : undefined;

            return {
              id: cleanId,
              name: pl.name,
              description: stripHtml(pl.description || ''),
              type: 'playlist',
              images: coverUrl ? [{ url: coverUrl }] : [],
              ...(bannerUrl ? { bannerUrl } : {}),
              owner: {
                display_name: pl.ownerV2?.data?.name || 'Spotify',
                id: pl.ownerV2?.data?.username || 'spotify',
              },
              color: '#303030',
              tracks: {
                total: pl.content?.totalCount || tracks.length,
                items: tracks,
              },
            };
          }
        }
      } catch (err) {
        console.warn(`[Playlist API] Pathfinder hash ${hash} error:`, err.message);
      }
    }

    // 4. Album Resolution via Pathfinder getAlbum
    try {
      const albRes = await fetch('https://api-partner.spotify.com/pathfinder/v2/query', {
        method: 'POST',
        headers: pathfinderHeaders,
        body: JSON.stringify({
          operationName: 'getAlbum',
          variables: {
            uri: `spotify:album:${cleanId}`,
            locale: '',
            offset: 0,
            limit: 50,
          },
          extensions: {
            persistedQuery: {
              version: 1,
              sha256Hash: '0b6ce3511e1b02e4a40fa95440f992acbe85080eb308af9194322d708fc1914f',
            },
          },
        }),
      });

      if (albRes.ok) {
        const albData = await albRes.json();
        const alb = albData.data?.albumUnion;
        if (alb && alb.name) {
          const rawCover = alb.coverArt?.sources?.find(s => (s.height || 0) >= 300)?.url || alb.coverArt?.sources?.[0]?.url || '';
          const coverUrl = toHDImage(rawCover);
          const rawTracks = alb.tracksV2?.items || alb.tracks?.items || [];

          const tracks = rawTracks.map((it, idx) => {
            const tr = it.track || it;
            const artistNames =
              tr.artists?.items?.map(a => ({ id: a.uri?.split(':').pop() || `art-${idx}`, name: a.profile?.name || a.name })) ||
              (alb.artists?.items || []).map(a => ({ id: a.uri?.split(':').pop() || `art-${idx}`, name: a.profile?.name || a.name })) ||
              [{ id: `art-${idx}`, name: 'Spotify' }];

            return {
              id: tr.uri?.split(':').pop() || tr.id || `track-${idx}`,
              name: tr.name || 'Canción',
              artists: artistNames,
              album: {
                id: cleanId,
                name: alb.name,
                images: coverUrl ? [{ url: coverUrl }] : [],
              },
              duration_ms: tr.trackDuration?.totalMilliseconds || tr.duration_ms || 180000,
              preview_url: null,
              added_at: 'Reciente',
            };
          });

          return {
            id: cleanId,
            name: alb.name,
            description: `Álbum • ${alb.date?.isoString?.slice(0, 4) || ''}`,
            type: 'album',
            images: coverUrl ? [{ url: coverUrl }] : [],
            owner: {
              display_name: alb.artists?.items?.[0]?.profile?.name || 'Spotify',
              id: alb.artists?.items?.[0]?.uri?.split(':').pop() || 'spotify',
            },
            color: '#303030',
            tracks: {
              total: alb.tracksV2?.totalCount || tracks.length,
              items: tracks,
            },
          };
        }
      }
    } catch (err) {
      console.warn('[Playlist API] Pathfinder getAlbum error:', err.message);
    }
  }

  // 5. Authenticated / Public Spotify Embed Scraper Fallback
  const embedTypes = ['playlist', 'album', 'artist'];
  for (const et of embedTypes) {
    try {
      const embedHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      };
      if (cleanCookie) {
        embedHeaders['Cookie'] = `sp_dc=${cleanCookie}`;
      }
      const res = await fetch(`https://open.spotify.com/embed/${et}/${cleanId}`, {
        headers: embedHeaders,
      });
      if (res.ok) {
        const html = await res.text();
        const parsed = parseEmbedHtml(html, cleanId);
        if (parsed && parsed.tracks?.items?.length > 0) {
          return parsed;
        }
      }
    } catch {}
  }

  // 6. Safe empty fallback
  return {
    id: cleanId,
    name: cleanId.replace(/[-_]/g, ' '),
    description: 'Lista de Spotify',
    type: 'playlist',
    images: [{ url: 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg' }],
    owner: { display_name: 'Spotify', id: 'spotify' },
    color: '#303030',
    tracks: { total: 0, items: [] },
  };
}

async function resolveYouTubePlaylist(listId) {
  const cleanListId = listId.replace(/^VL/, '');
  const url = 'https://www.youtube.com/youtubei/v1/browse';
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
    body: JSON.stringify({
      context: {
        client: {
          clientName: 'WEB',
          clientVersion: '2.20240101.01.00',
          hl: 'es',
        },
      },
      browseId: 'VL' + cleanListId,
    }),
    signal: AbortSignal.timeout?.(10000),
  });

  if (!response.ok) {
    throw new Error(`YouTube API returned ${response.status}`);
  }

  const data = await response.json();
  const title =
    data.sidebar?.playlistSidebarRenderer?.items?.[0]?.playlistSidebarPrimaryInfoRenderer?.title?.runs?.[0]?.text ||
    data.header?.playlistHeaderRenderer?.title?.simpleText ||
    'Playlist de YouTube';

  const author =
    data.sidebar?.playlistSidebarRenderer?.items?.[1]?.playlistSidebarSecondaryInfoRenderer?.videoOwner?.videoOwnerRenderer?.title?.runs?.[0]?.text ||
    'YouTube';

  const coverUrl =
    data.sidebar?.playlistSidebarRenderer?.items?.[0]?.playlistSidebarPrimaryInfoRenderer?.thumbnailRenderer?.playlistVideoThumbnailRenderer?.thumbnail?.thumbnails?.pop()?.url ||
    data.header?.playlistHeaderRenderer?.playlistHeaderBanner?.heroPlaylistThumbnailRenderer?.thumbnail?.thumbnails?.pop()?.url ||
    'https://misc.scdn.co/liked-songs/liked-songs-640.jpg';

  const contents =
    data.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents ||
    [];

  const tracks = [];
  for (let idx = 0; idx < contents.length; idx++) {
    const item = contents[idx];
    const l = item.lockupViewModel || item.playlistVideoRenderer;
    if (!l) continue;

    let trackTitle =
      l.metadata?.lockupMetadataViewModel?.title?.content ||
      l.title?.runs?.[0]?.text ||
      l.title?.simpleText;
    if (!trackTitle) continue;

    const thumb =
      l.contentImage?.thumbnailViewModel?.image?.sources?.[0]?.url ||
      l.thumbnails?.[0]?.url ||
      l.thumbnail?.thumbnails?.[0]?.url;
    const vMatch = (thumb || '').match(/\/vi\/([a-zA-Z0-9_-]{11})\//);
    const videoId = vMatch ? vMatch[1] : (l.videoId || `yt-${idx}`);

    let artistName = author;
    const rows = l.metadata?.lockupMetadataViewModel?.metadata?.contentMetadataViewModel?.metadataRows;
    if (rows && rows[0]?.parts?.[0]?.text?.content) {
      artistName = rows[0].parts[0].text.content;
    } else if (l.shortBylineText?.runs?.[0]?.text) {
      artistName = l.shortBylineText.runs[0].text;
    }

    if (trackTitle.includes(' - ')) {
      const parts = trackTitle.split(' - ');
      artistName = parts[0].trim();
      trackTitle = parts
        .slice(1)
        .join(' - ')
        .replace(/\s*\((Official|Video|Audio|Videoclip|Music Video).*?\)/gi, '')
        .replace(/\s*\[(Official|Video|Audio|Videoclip|Music Video).*?\]/gi, '')
        .trim();
    }

    tracks.push({
      id: `yt-${videoId}`,
      name: trackTitle,
      duration_ms: (parseInt(l.lengthSeconds, 10) || 210) * 1000,
      artists: [{ id: `art-yt-${idx}`, name: artistName }],
      album: {
        id: `alb-yt-${cleanListId}`,
        name: title,
        images: [{ url: thumb || coverUrl }],
      },
    });
  }

  return {
    id: `imported-yt-${cleanListId}`,
    name: title,
    description: `Playlist importada de YouTube (${tracks.length} canciones)`,
    type: 'playlist',
    images: [{ url: coverUrl }],
    owner: { display_name: author, id: 'youtube' },
    tracks: {
      total: tracks.length,
      items: tracks,
    },
  };
}

/**
 * Check if a playlist title is generic (e.g., liked songs, favorites, my playlist)
 * across English, Spanish, and other common languages with emojis/numbers stripped,
 * so it is never used as an irrelevant search query term.
 */
function isGenericPlaylistTitle(title) {
  if (!title) return true;
  const normalized = title
    .replace(/[\p{Emoji}\p{Symbol}\p{Punctuation}]/gu, ' ')
    .replace(/\d+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  if (!normalized || normalized.length < 3) return true;

  const genericPatterns = [
    /^(canciones que te gustan|canciones que me gustan|tus me gusta|liked songs|liked tracks|saved songs|saved tracks)$/i,
    /^(favoritas|mis favoritas|favoritos|mis favoritos|favorites|my favorites|favorite songs|favorite tracks)$/i,
    /^(mis canciones|my songs|my tracks|my music|mis temas|mi musica|canciones guardadas)$/i,
    /^(mi playlist|my playlist|playlist|nueva playlist|new playlist|custom playlist|lista|mi lista|tu biblioteca|your library|library|biblioteca)$/i,
    /^(top tracks|top canciones|top songs|top hits|mejores canciones|best songs|starred|collection tracks)$/i,
    /^(que te gustan|que me gustan|liked|favoris|titres likes|chansons preferees|musicas curtidas|lieblingssongs)$/i,
  ];

  return genericPatterns.some((pattern) => pattern.test(normalized));
}

const NOISE_FILTER_REGEX = /\b(ruido\s+blanco|white\s+noise|ruido\s+rosa|pink\s+noise|ruido\s+marr[oó]n|brown\s+noise|green\s+noise|static\s+noise|sonido(s)?\s+de\s+(lluvia|agua|olas|mar|viento|tormenta|ventilador|secador|aspiradora|reloj)|(rain|water|ocean|waves|storm|fan|wind)\s+sound(s)?|ambient\s+noise|binaural\s+beat(s)?|ondas\s+(alfa|delta|theta|gamma)|sleep\s+sound(s)?|sonido(s)?\s+para\s+dormir|deep\s+sleep|baby\s+sleep|nature\s+sound(s)?|sound\s+effects?|test\s+tone|\d+\s*hz\b)\b/i;

function isNoiseTrack(title, artist) {
  const combined = `${title || ''} ${artist || ''}`;
  return NOISE_FILTER_REGEX.test(combined);
}

/**
 * Dynamically queries real Spotify recommendations for any playlist
 * using Spotify Pathfinder GraphQL search (backed by Web Player auth) with Deezer fallback.
 */
async function getSpotifyRecommendations({ playlistId = '', playlistTitle = '', artists = '', seedTracks = '', cookie = '', limit = 10 }) {
  const auth = await getWebPlayerAuth(cookie).catch(() => ({ accessToken: '' }));
  const existingIdSet = new Set((seedTracks || '').split(',').map((s) => s.trim()).filter(Boolean));

  // Determine smart query terms based on playlist artists and title
  const queryTerms = [];
  const artistList = (artists || '')
    .split(',')
    .map((a) => a.trim())
    .filter((a) => a && a.length > 1 && a.toLowerCase() !== 'spotify');

  // Randomize artists on every call so recommendations are fresh and varied on every visit
  const shuffledArtists = [...artistList].sort(() => Math.random() - 0.5);

  // 1. Query individual artists directly (never join multiple artists into one search phrase)
  for (const art of shuffledArtists.slice(0, 6)) {
    queryTerms.push(art);
  }

  // 2. If the playlist has a real, semantic title (e.g., "Rock Clásico", "Reggaeton 2025", "Synthwave"), add it
  // Stripping both Spanish and English stop words
  if (!isGenericPlaylistTitle(playlistTitle)) {
    const stopWords = /\b(playlist|de|para|mis|tus|sus|las|los|el|la|del|al|canciones|favoritas|favoritos|musica|exitos|que|te|me|gustan|gusta|my|your|the|of|for|songs|tracks|favorites|favorite|liked|music|best|top|hits|new|custom|collection|by|vol|volume|edition|2024|2025|2026)\b/gi;
    const cleanTitle = (playlistTitle || '')
      .replace(/[()[\]{}_-]/g, ' ')
      .replace(stopWords, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (cleanTitle.length >= 3 && !isGenericPlaylistTitle(cleanTitle)) {
      queryTerms.push(cleanTitle);

      // Expand specific popular themes to ensure rich, diverse music catalogs
      const lower = cleanTitle.toLowerCase();
      if (/^(gaming|games|gamer|videojuegos)$/i.test(lower)) {
        queryTerms.push('electronic gaming music', 'ncs hits', 'dance edm');
      } else if (/^(workout|gym|entreno|fitness)$/i.test(lower)) {
        queryTerms.push('workout motivation edm', 'gym energetic hits');
      } else if (/^(chill|relax|estudio|study|calma)$/i.test(lower)) {
        queryTerms.push('lofi chill beats', 'indie folk calm');
      }
    }
  }

  // Fallback term only if both artists and title are absent
  if (queryTerms.length === 0) {
    queryTerms.push('top hits', 'pop urbano');
  }

  const tracks = [];
  const seenIds = new Set();
  const seenSignatures = new Set();
  const titleCounts = new Map();
  const artistCounts = new Map();

  const isDuplicateOrExcessive = (title, artist) => {
    const cleanT = (title || '').toLowerCase().trim();
    const cleanA = (artist || '').toLowerCase().trim();
    const sig = `${cleanT}::${cleanA}`;
    if (seenSignatures.has(sig)) return true;
    if (cleanT && (titleCounts.get(cleanT) || 0) >= 2) return true;
    if (cleanA && (artistCounts.get(cleanA) || 0) >= 2) return true;
    return false;
  };

  const recordAcceptedTrack = (title, artist) => {
    const cleanT = (title || '').toLowerCase().trim();
    const cleanA = (artist || '').toLowerCase().trim();
    seenSignatures.add(`${cleanT}::${cleanA}`);
    if (cleanT) titleCounts.set(cleanT, (titleCounts.get(cleanT) || 0) + 1);
    if (cleanA) artistCounts.set(cleanA, (artistCounts.get(cleanA) || 0) + 1);
  };

  // 1. Query Spotify Pathfinder GraphQL search (Real Spotify Tracks!)
  if (auth.accessToken) {
    for (const term of queryTerms) {
      if (tracks.length >= limit) break;
      try {
        const offset = Math.floor(Math.random() * 4);
        const variables = { query: term, offset, limit: Math.max(6, Math.ceil(limit / 2)) };
        const extensions = {
          persistedQuery: {
            version: 1,
            sha256Hash: '903df2a65d8121e27d73a2be03c01e88ebe6021bb6d4eb82a389e35d87e51d27',
          },
        };
        const pfUrl = `https://api-partner.spotify.com/pathfinder/v1/query?operationName=findTracks&variables=${encodeURIComponent(JSON.stringify(variables))}&extensions=${encodeURIComponent(JSON.stringify(extensions))}`;
        const pfRes = await fetch(pfUrl, {
          headers: {
            Authorization: `Bearer ${auth.accessToken}`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
          signal: AbortSignal.timeout ? AbortSignal.timeout(3500) : undefined,
        });

        if (pfRes.ok) {
          const pfData = await pfRes.json();
          const items = pfData.data?.searchV2?.tracksV2?.items || [];
          for (const it of items) {
            const d = it.item?.data;
            if (!d) continue;
            const rawUri = d.uri || '';
            const trackId = rawUri.split(':').pop() || d.id;
            if (!trackId || seenIds.has(trackId) || existingIdSet.has(trackId)) continue;
            const artistsStr = (d.artists?.items || []).map((a) => a.profile?.name || a.name || '').join(' ');
            if (isNoiseTrack(d.name, artistsStr)) continue;
            if (isDuplicateOrExcessive(d.name, (d.artists?.items || [])[0]?.profile?.name || (d.artists?.items || [])[0]?.name)) continue;
            seenIds.add(trackId);
            recordAcceptedTrack(d.name, (d.artists?.items || [])[0]?.profile?.name || (d.artists?.items || [])[0]?.name);

            const cover = toHDImage(
              d.albumOfTrack?.coverArt?.sources?.[0]?.url ||
              d.albumOfTrack?.images?.[0]?.url ||
              ''
            );

            tracks.push({
              id: trackId,
              name: d.name,
              artists: (d.artists?.items || []).map((a, i) => ({
                id: a.id || a.uri?.split(':').pop() || `art-${trackId}-${i}`,
                name: a.profile?.name || a.name || 'Artista',
              })),
              album: {
                id: d.albumOfTrack?.uri?.split(':').pop() || `alb-${trackId}`,
                name: d.albumOfTrack?.name || d.name,
                images: cover ? [{ url: cover }] : [],
              },
              duration_ms: d.duration?.totalMilliseconds || 195000,
              preview_url: null,
              added_at: 'Recomendada',
            });
            if (tracks.length >= limit) break;
          }
        }
      } catch (err) {
        console.warn('[Playlist Recommendations] Pathfinder error:', err.message);
      }
    }
  }

  // 2. High-quality Deezer fallback querying each artist individually with audio previews
  if (tracks.length < limit) {
    const termsToTry = queryTerms.length > 0 ? queryTerms : ['top hits'];
    for (const term of termsToTry) {
      if (tracks.length >= limit) break;
      try {
        const dzRes = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(term)}&limit=10`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          signal: AbortSignal.timeout ? AbortSignal.timeout(3000) : undefined,
        });
        if (dzRes.ok) {
          const dzData = await dzRes.json();
          for (const t of dzData.data || []) {
            const tid = `dz-${t.id}`;
            if (seenIds.has(tid) || existingIdSet.has(tid)) continue;
            if (isNoiseTrack(t.title || t.title_short, t.artist?.name)) continue;
            if (isDuplicateOrExcessive(t.title || t.title_short, t.artist?.name)) continue;
            seenIds.add(tid);
            recordAcceptedTrack(t.title || t.title_short, t.artist?.name);
            const cover = toHDImage(t.album?.cover_xl || t.album?.cover_big || t.album?.cover_medium || '');
            tracks.push({
              id: tid,
              name: t.title || t.title_short,
              artists: [{ id: `art-${t.artist?.id || tid}`, name: t.artist?.name || 'Artista' }],
              album: {
                id: `alb-${t.album?.id || tid}`,
                name: t.album?.title || t.title,
                images: cover ? [{ url: cover }] : [],
              },
              duration_ms: (t.duration || 180) * 1000,
              preview_url: t.preview || null,
              added_at: 'Recomendada',
            });
            if (tracks.length >= limit) break;
          }
        }
      } catch {}
    }
  }

  // 3. iTunes search fallback if still below limit
  if (tracks.length < limit) {
    const termsToTry = queryTerms.length > 0 ? queryTerms : ['top hits'];
    for (const term of termsToTry) {
      if (tracks.length >= limit) break;
      try {
        const itRes = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=song&limit=10`, {
          signal: AbortSignal.timeout ? AbortSignal.timeout(3000) : undefined,
        });
        if (itRes.ok) {
          const itData = await itRes.json();
          for (const t of itData.results || []) {
            const tid = `it-${t.trackId}`;
            if (seenIds.has(tid) || existingIdSet.has(tid)) continue;
            if (isNoiseTrack(t.trackName, t.artistName)) continue;
            if (isDuplicateOrExcessive(t.trackName, t.artistName)) continue;
            seenIds.add(tid);
            recordAcceptedTrack(t.trackName, t.artistName);
            const cover = (t.artworkUrl100 || '').replace('100x100bb', '600x600bb');
            tracks.push({
              id: tid,
              name: t.trackName,
              artists: [{ id: `art-${t.artistId || tid}`, name: t.artistName || 'Artista' }],
              album: {
                id: `alb-${t.collectionId || tid}`,
                name: t.collectionName || t.trackName,
                images: cover ? [{ url: cover }] : [],
              },
              duration_ms: t.trackTimeMillis || 180000,
              preview_url: t.previewUrl || null,
              added_at: 'Recomendada',
            });
            if (tracks.length >= limit) break;
          }
        }
      } catch {}
    }
  }

  // 4. Curated catalog so recommendations NEVER fail or display empty
  if (tracks.length < 5) {
    const CURATED_BACKUP = [
      {
        id: 'dz-2432976725',
        name: 'Columbia',
        artists: [{ id: 'art-quevedo', name: 'Quevedo' }],
        album: {
          id: 'alb-columbia',
          name: 'Columbia',
          images: [{ url: 'https://e-cdns-images.dzcdn.net/images/cover/b4ea39ef6ea328ecf4b16260ea8d1159/1000x1000-000000-80-0-0.jpg' }],
        },
        duration_ms: 186000,
        preview_url: 'https://cdns-preview-d.dzcdn.net/stream/c-df51b54c034aefc96cb8a4ebaa9670aa-5.mp3',
        added_at: 'Recomendada',
      },
      {
        id: 'dz-2503254921',
        name: 'MONACO',
        artists: [{ id: 'art-badbunny', name: 'Bad Bunny' }],
        album: {
          id: 'alb-nsneve',
          name: 'nadie sabe lo que va a pasar mañana',
          images: [{ url: 'https://e-cdns-images.dzcdn.net/images/cover/9cb1f1bf40cb7e71f5445ea4e4125b0f/1000x1000-000000-80-0-0.jpg' }],
        },
        duration_ms: 267000,
        preview_url: null,
        added_at: 'Recomendada',
      },
      {
        id: 'dz-2549257631',
        name: 'LUNA',
        artists: [{ id: 'art-feid', name: 'Feid' }, { id: 'art-atljacob', name: 'ATL Jacob' }],
        album: {
          id: 'alb-ferxxocalipsis',
          name: 'FERXXOCALIPSIS',
          images: [{ url: 'https://e-cdns-images.dzcdn.net/images/cover/6c65b53027b165275e01691230678788/1000x1000-000000-80-0-0.jpg' }],
        },
        duration_ms: 196000,
        preview_url: null,
        added_at: 'Recomendada',
      },
      {
        id: 'dz-2228518177',
        name: 'DILUVIO',
        artists: [{ id: 'art-rauw', name: 'Rauw Alejandro' }],
        album: {
          id: 'alb-saturno',
          name: 'SATURNO',
          images: [{ url: 'https://e-cdns-images.dzcdn.net/images/cover/25d3fa961ef0a6a22f307ba4da4a43ef/1000x1000-000000-80-0-0.jpg' }],
        },
        duration_ms: 198000,
        preview_url: null,
        added_at: 'Recomendada',
      },
      {
        id: 'dz-2484089985',
        name: 'REINA',
        artists: [{ id: 'art-mora', name: 'Mora' }, { id: 'art-saiko', name: 'Saiko' }],
        album: {
          id: 'alb-estrella',
          name: 'ESTRELLA',
          images: [{ url: 'https://e-cdns-images.dzcdn.net/images/cover/5f58c7438ae7b3ebfb4f7c2235c05280/1000x1000-000000-80-0-0.jpg' }],
        },
        duration_ms: 228000,
        preview_url: null,
        added_at: 'Recomendada',
      },
      {
        id: 'dz-2358047915',
        name: 'LALA',
        artists: [{ id: 'art-myke', name: 'Myke Towers' }],
        album: {
          id: 'alb-lala',
          name: 'LA VIDA ES UNA',
          images: [{ url: 'https://e-cdns-images.dzcdn.net/images/cover/0bc52251a31b402cf8fa5dcfae69eec4/1000x1000-000000-80-0-0.jpg' }],
        },
        duration_ms: 197000,
        preview_url: null,
        added_at: 'Recomendada',
      },
      {
        id: 'dz-2321568205',
        name: 'LAS BABYS',
        artists: [{ id: 'art-aitana', name: 'Aitana' }],
        album: {
          id: 'alb-alpha',
          name: 'alpha',
          images: [{ url: 'https://e-cdns-images.dzcdn.net/images/cover/19e917d54e44f8f7422dd81f01cb18be/1000x1000-000000-80-0-0.jpg' }],
        },
        duration_ms: 153000,
        preview_url: null,
        added_at: 'Recomendada',
      },
      {
        id: 'dz-1811631527',
        name: 'Quevedo: Bzrp Music Sessions, Vol. 52',
        artists: [{ id: 'art-bizarrap', name: 'Bizarrap' }, { id: 'art-quevedo', name: 'Quevedo' }],
        album: {
          id: 'alb-bzrp52',
          name: 'Quevedo: Bzrp Music Sessions, Vol. 52',
          images: [{ url: 'https://e-cdns-images.dzcdn.net/images/cover/2513a968600d8d42dff0421da1d8a0c2/1000x1000-000000-80-0-0.jpg' }],
        },
        duration_ms: 198000,
        preview_url: null,
        added_at: 'Recomendada',
      },
    ];

    for (const item of CURATED_BACKUP) {
      if (!seenIds.has(item.id) && !existingIdSet.has(item.id)) {
        seenIds.add(item.id);
        tracks.push(item);
        if (tracks.length >= limit) break;
      }
    }
  }

  return tracks;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-spotify-cookie');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const action = url.searchParams.get('action') || '';

    // ACTION: IMPORT A PLAYLIST FROM YOUTUBE MUSIC / YOUTUBE / APPLE MUSIC (songs to look up)
    if (action === 'import') {
      try {
        const result = await readExternalPlaylist(url.searchParams.get('url') || '');
        return res.status(200).json({ success: true, ...result });
      } catch (e) {
        const reason = String(e?.message || e);
        return res.status(reason === 'unsupported' || reason === 'amazon' ? 400 : 502).json({ success: false, reason });
      }
    }

    // ACTION: RECOMMENDATIONS FOR PLAYLIST
    if (action === 'recommendations') {
      const playlistId = url.searchParams.get('id') || url.searchParams.get('playlistId') || '';
      const playlistTitle = url.searchParams.get('title') || url.searchParams.get('playlistTitle') || '';
      const artists = url.searchParams.get('artists') || '';
      const seedTracks = url.searchParams.get('seedTracks') || url.searchParams.get('seeds') || '';
      const cookie = req.headers['x-spotify-cookie'] || '';
      const limit = parseInt(url.searchParams.get('limit') || '8', 10);

      const tracks = await getSpotifyRecommendations({
        playlistId,
        playlistTitle,
        artists,
        seedTracks,
        cookie,
        limit,
      });

      return res.status(200).json({ success: true, tracks });
    }

    let id = url.searchParams.get('id');
    if (!id) {
      const parts = url.pathname.split('/').filter(Boolean);
      id = parts[parts.length - 1];
      if (id === 'playlist') id = '';
    }

    if (!id) {
      return res.status(400).json({ error: 'Falta el ID de la playlist.' });
    }

    const reqType = url.searchParams.get('type') || '';
    if (id.startsWith('sc-vault-')) {
      const artistEncoded = id.slice('sc-vault-'.length);
      let artistName = artistEncoded;
      try { artistName = decodeURIComponent(artistEncoded); } catch {}
      const cached = MEMORY_PLAYLIST_CACHE.get(id);
      if (cached?.tracks?.items?.length > 0) {
        return res.status(200).json(cached);
      }
      const vault = await buildArtistSoundCloudVault(artistName);
      if (vault) {
        MEMORY_PLAYLIST_CACHE.set(id, vault);
        return res.status(200).json(vault);
      }
      return res.status(404).json({ error: `No se encontraron remixes o inéditas de ${artistName}` });
    }
    if (id.startsWith('sc-pl-url:')) {
      const rawUrl = decodeURIComponent(id.slice('sc-pl-url:'.length));
      const scResolved = await resolveSoundCloudUrl(rawUrl);
      if (scResolved?.kind === 'playlist' && scResolved.playlist) {
        return res.status(200).json(scResolved.playlist);
      }
      return res.status(404).json({ error: 'No se pudo resolver la playlist de SoundCloud.' });
    }
    if (reqType === 'youtube' || id.startsWith('PL') || id.startsWith('RD') || id.startsWith('OLAK5uy_') || id.startsWith('yt-')) {
      const cleanListId = id.replace(/^yt-/, '');
      try {
        const ytResult = await resolveYouTubePlaylist(cleanListId);
        return res.status(200).json(ytResult);
      } catch (ytErr) {
        console.warn('[api/playlist] YouTube resolve error:', ytErr.message);
      }
    }

    const cookie = req.headers['x-spotify-cookie'] || '';
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');

    const result = await resolveSpotifyPlaylist(id, { cookie, token });
    return res.status(200).json(result);
  } catch (err) {
    console.error('[api/playlist] Error:', err.message);
    return res.status(500).json({ error: err.message || 'Error al obtener la playlist.' });
  }
}