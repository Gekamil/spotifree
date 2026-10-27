import fs from 'node:fs';
import path from 'node:path';
import { toHDImage, getAccessTokenFromCookie } from './extract-session.js';

let cachedLikedSongs = null;
function getFallbackLikedSongs() {
  if (cachedLikedSongs && cachedLikedSongs.length > 0) return cachedLikedSongs;
  try {
    const fileUrl = new URL('./realLikedSongs.json', import.meta.url);
    cachedLikedSongs = JSON.parse(fs.readFileSync(fileUrl, 'utf-8'));
    return cachedLikedSongs;
  } catch (e) {
    try {
      const filePath = path.join(process.cwd(), 'src', 'data', 'realLikedSongs.json');
      if (fs.existsSync(filePath)) {
        cachedLikedSongs = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        return cachedLikedSongs;
      }
    } catch (err2) {
      console.warn('[Playlist API] Could not read realLikedSongs.json:', err2.message);
    }
  }
  return [];
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
    const trackCover = toHDImage(t.visualIdentity?.image?.[0]?.url || t.coverArt?.sources?.[0]?.url || coverUrl);

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
        images: [{ url: trackCover }],
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

  // 1. Resolve Access Token if not provided but cookie is available
  let activeToken = (token || '').replace(/^Bearer\s+/i, '').trim();
  if (!activeToken && cookie) {
    try {
      activeToken = (await getAccessTokenFromCookie(cookie)) || '';
    } catch {}
  }

  // 2. Liked Songs Resolution (Dynamic & Private per user)
  const isLiked =
    cleanId === 'collection-tracks' ||
    cleanId === 'liked-songs' ||
    cleanId === 'tracks' ||
    cleanId === 'collection:tracks';

  if (isLiked) {
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

    return {
      id: 'collection-tracks',
      name: 'Canciones que te gustan',
      description: 'Tus canciones favoritas guardadas',
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

  // 3. Regular Playlist Resolution via Spotify Web API
  if (activeToken) {
    try {
      const plRes = await fetch(`https://api.spotify.com/v1/playlists/${cleanId}`, {
        headers: {
          'Authorization': `Bearer ${activeToken}`,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      if (plRes.ok) {
        const pl = await plRes.json();
        const coverUrl = toHDImage(pl.images?.[0]?.url || '');
        const tracks = (pl.tracks?.items || []).map((it, idx) => {
          const tr = it.track || it;
          const trackCover = toHDImage(tr.album?.images?.[0]?.url || coverUrl);
          return {
            id: tr.id || `track-${idx}`,
            name: tr.name,
            artists: (tr.artists || []).map(a => ({ id: a.id || `art-${a.name}`, name: a.name })),
            album: {
              id: tr.album?.id || `alb-${idx}`,
              name: tr.album?.name || pl.name,
              images: trackCover ? [{ url: trackCover }] : [],
            },
            duration_ms: tr.duration_ms || 180000,
            preview_url: tr.preview_url || null,
            added_at: it.added_at ? new Date(it.added_at).toLocaleDateString('es-ES') : 'Reciente',
          };
        });

        return {
          id: pl.id,
          name: pl.name,
          description: pl.description || '',
          type: 'playlist',
          images: coverUrl ? [{ url: coverUrl }] : [],
          owner: {
            display_name: pl.owner?.display_name || 'Spotify',
            id: pl.owner?.id || 'spotify',
          },
          color: '#303030',
          tracks: {
            total: pl.tracks?.total || tracks.length,
            items: tracks,
          },
        };
      } else if (plRes.status === 404) {
        // Maybe it's an album?
        const albRes = await fetch(`https://api.spotify.com/v1/albums/${cleanId}`, {
          headers: {
            'Authorization': `Bearer ${activeToken}`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        });
        if (albRes.ok) {
          const alb = await albRes.json();
          const coverUrl = toHDImage(alb.images?.[0]?.url || '');
          const tracks = (alb.tracks?.items || []).map((tr, idx) => ({
            id: tr.id || `track-${idx}`,
            name: tr.name,
            artists: (tr.artists || alb.artists || []).map(a => ({ id: a.id || `art-${a.name}`, name: a.name })),
            album: {
              id: alb.id,
              name: alb.name,
              images: coverUrl ? [{ url: coverUrl }] : [],
            },
            duration_ms: tr.duration_ms || 180000,
            preview_url: tr.preview_url || null,
            added_at: 'Reciente',
          }));

          return {
            id: alb.id,
            name: alb.name,
            description: `Álbum • ${alb.release_date?.slice(0, 4) || ''}`,
            type: 'album',
            images: coverUrl ? [{ url: coverUrl }] : [],
            owner: {
              display_name: alb.artists?.[0]?.name || 'Spotify',
              id: alb.artists?.[0]?.id || 'spotify',
            },
            color: '#303030',
            tracks: {
              total: alb.tracks?.total || tracks.length,
              items: tracks,
            },
          };
        }
      }
    } catch (e) {
      console.warn('[Playlist API] Spotify Web API error:', e.message);
    }
  }

  // 4. Authenticated / Public Spotify Embed Scraper Fallback
  const embedTypes = ['playlist', 'album', 'artist'];
  for (const et of embedTypes) {
    try {
      const embedHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      };
      if (cookie) {
        embedHeaders['Cookie'] = `sp_dc=${cookie}`;
      }
      const res = await fetch(`https://open.spotify.com/embed/${et}/${cleanId}`, {
        headers: embedHeaders,
      });
      if (res.ok) {
        const html = await res.text();
        return parseEmbedHtml(html, cleanId);
      }
    } catch {}
  }

  // 5. Final fallback to prevent crash
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
