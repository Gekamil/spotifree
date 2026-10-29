import { toHDImage, cleanSpDcString, getWebPlayerAuth, extractEntityImage } from './extract-session.js';

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

  return {
    id: cleanId,
    name: entity.name,
    description: entity.description || '',
    type: entity.type || 'playlist',
    images: [{ url: coverUrl }],
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

  const cleanCookie = cleanSpDcString(cookie);

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

            return {
              id: cleanId,
              name: pl.name,
              description: pl.description || '',
              type: 'playlist',
              images: coverUrl ? [{ url: coverUrl }] : [],
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