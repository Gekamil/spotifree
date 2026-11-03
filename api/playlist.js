const MEMORY_PLAYLIST_CACHE = new Map();
import { toHDImage, cleanSpDcString, getWebPlayerAuth, extractEntityImage } from './_lib/extract-session.js';

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

  // 0. Check pre-extracted cached playlist details from session feed (instant resolution for recommended cards & shelves)
  try {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const sessionFile = path.resolve('src/data/liveExtractedSession.json');
    if (fs.existsSync(sessionFile)) {
      const sessionData = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
      if (sessionData.cachedPlaylistDetails && sessionData.cachedPlaylistDetails[cleanId]) {
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-spotify-cookie');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
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