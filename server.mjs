import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { resolveAudio, streamAudioFromUrl } from './scripts/audioService.mjs';

const PORT = process.env.PORT || 10000;
let currentPlayingTrackId = null;

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range, Authorization');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');
}

function parseEmbedHtml(html, cleanId) {
  const scriptMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!scriptMatch) throw new Error('Embed NEXT_DATA not found in page');

  const data = JSON.parse(scriptMatch[1]);
  const entity = data.props?.pageProps?.state?.data?.entity;
  if (!entity) throw new Error('Entity missing from Spotify Embed');

  const coverUrl = entity.visualIdentity?.image?.[0]?.url ||
    entity.coverArt?.sources?.[0]?.url ||
    'https://misc.scdn.co/liked-songs/liked-songs-640.jpg';

  const tracks = (entity.trackList || []).map((t, idx) => {
    const rawUri = t.uri || '';
    const trackId = rawUri.split(':').pop() || `track-${idx}`;
    const artistNames = t.subtitle ? t.subtitle.split(', ') : ['Spotify'];

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
        images: [{ url: coverUrl }],
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
      display_name: entity.owner?.name || 'Spotify',
      id: entity.owner?.id || 'spotify',
    },
    color: '#303030',
    tracks: {
      total: tracks.length,
      items: tracks,
    },
  };
}

const server = http.createServer(async (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = reqUrl.pathname;

  // 1. Health check
  if (pathname === '/' || pathname === '/health') {
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    return res.end(JSON.stringify({ status: 'ok', service: 'Spotifree Cloud Backend', version: '1.0.0' }));
  }

  // 2. Direct Audio Streaming (/api/audio/stream)
  if (pathname === '/api/audio/stream') {
    const target = reqUrl.searchParams.get('id') || reqUrl.searchParams.get('q') || reqUrl.searchParams.get('v') || reqUrl.searchParams.get('trackId') || '';
    if (!target.trim()) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'Missing audio query or id' }));
    }

    try {
      const info = await resolveAudio(target);
      if (!info || !info.url) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: 'Stream URL not found' }));
      }
      currentPlayingTrackId = info.id;
      return streamAudioFromUrl(info.url, req, res);
    } catch (err) {
      console.error('[AudioStream error]:', err.message);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }
  }

  // 3. Audio Resolve Endpoint (/api/audio/resolve)
  if (pathname === '/api/audio/resolve') {
    const title = reqUrl.searchParams.get('title') || '';
    const artist = reqUrl.searchParams.get('artist') || '';
    const q = reqUrl.searchParams.get('q') || `${title} ${artist}`.trim();

    if (!q) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'Missing query' }));
    }

    try {
      const info = await resolveAudio(q);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ videoId: info.id, title: info.title, duration: info.duration }));
    } catch (err) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: err.message }));
    }
  }

  // 4. Audio Play Metadata (/api/audio/play)
  if (pathname === '/api/audio/play' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { query, videoId, title, artist } = JSON.parse(body || '{}');
        const target = videoId || query || `${title || ''} ${artist || ''}`.trim();
        if (!target) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'Missing target query or videoId' }));
        }

        const info = await resolveAudio(target);
        currentPlayingTrackId = info.id;

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({
          success: true,
          videoId: info.id,
          duration: info.duration,
          title: info.title,
          streamUrl: `/api/audio/stream?id=${encodeURIComponent(info.id)}`,
        }));
      } catch (err) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 5. Audio Status (/api/audio/status)
  if (pathname === '/api/audio/status') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      isPlaying: true,
      currentTime: 0,
      duration: 0,
      ended: false,
      isAd: false,
      videoId: currentPlayingTrackId,
    }));
  }

  // 6. Lyrics API (/api/lyrics)
  if (pathname === '/api/lyrics') {
    const title = (reqUrl.searchParams.get('title') || '').trim();
    const artist = (reqUrl.searchParams.get('artist') || '').trim();
    res.setHeader('Content-Type', 'application/json');

    if (!title) {
      res.statusCode = 200;
      return res.end(JSON.stringify({ syncedLyrics: null, plainLyrics: null }));
    }

    try {
      const lrcUrl = `https://lrclib.net/api/get?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist)}`;
      const lrcRes = await fetch(lrcUrl, {
        headers: { 'User-Agent': 'Spotifree/1.0' },
        signal: AbortSignal.timeout(4000),
      });
      if (lrcRes.ok) {
        const data = await lrcRes.json();
        res.statusCode = 200;
        return res.end(JSON.stringify(data));
      }

      const sUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(title + ' ' + artist)}`;
      const sRes = await fetch(sUrl, {
        headers: { 'User-Agent': 'Spotifree/1.0' },
        signal: AbortSignal.timeout(4000),
      });
      if (sRes.ok) {
        const list = await sRes.json();
        if (Array.isArray(list) && list.length > 0) {
          res.statusCode = 200;
          return res.end(JSON.stringify(list[0]));
        }
      }
    } catch {}

    res.statusCode = 200;
    return res.end(JSON.stringify({ syncedLyrics: null, plainLyrics: null }));
  }

  // 7. Search API (/api/spotify/search)
  if (pathname === '/api/spotify/search') {
    const q = (reqUrl.searchParams.get('q') || '').trim();
    res.setHeader('Content-Type', 'application/json');

    if (!q) {
      res.statusCode = 200;
      return res.end(JSON.stringify({ tracks: { items: [] } }));
    }

    try {
      const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&entity=song&limit=25`;
      const itunesRes = await fetch(itunesUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      });

      if (itunesRes.ok) {
        const itunesData = await itunesRes.json();
        const items = (itunesData.results || []).map(t => ({
          id: `itunes-${t.trackId}`,
          name: t.trackName,
          duration_ms: t.trackTimeMillis || 210000,
          preview_url: t.previewUrl || null,
          artists: [{ id: `art-${t.artistId}`, name: t.artistName }],
          album: {
            id: `alb-${t.collectionId}`,
            name: t.collectionName || t.trackName,
            images: [{ url: (t.artworkUrl100 || '').replace('100x100bb', '600x600bb') }],
          },
        }));

        res.statusCode = 200;
        return res.end(JSON.stringify({ tracks: { items } }));
      }
    } catch (e) {
      console.error('[Search error]:', e);
    }

    res.statusCode = 200;
    return res.end(JSON.stringify({ tracks: { items: [] } }));
  }

  // 8. Playlist scrape (/api/spotify/playlist/:id)
  if (pathname.startsWith('/api/spotify/playlist/')) {
    const rawId = pathname.replace('/api/spotify/playlist/', '').split('/')[0];
    res.setHeader('Content-Type', 'application/json');

    try {
      const embedUrl = `https://open.spotify.com/embed/playlist/${rawId}`;
      const response = await fetch(embedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });
      if (response.ok) {
        const html = await response.text();
        const playlist = parseEmbedHtml(html, rawId);
        res.statusCode = 200;
        return res.end(JSON.stringify(playlist));
      }
    } catch (err) {
      console.error(`Playlist scrape error ${rawId}:`, err.message);
    }

    res.statusCode = 404;
    return res.end(JSON.stringify({ error: 'Playlist not found' }));
  }

  // 9. Session / Fallback (/api/session-sync & /api/spotify/session)
  if (pathname === '/api/session-sync' || pathname === '/api/spotify/session') {
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    return res.end(JSON.stringify({
      connected: true,
      user: { id: 'spotifree-user', display_name: 'Spotifree Web' },
      playlists: [],
    }));
  }

  // 404 fallback
  res.statusCode = 404;
  res.setHeader('Content-Type', 'application/json');
  return res.end(JSON.stringify({ error: 'Route not found' }));
});

server.listen(PORT, () => {
  console.log(`[Spotifree Backend] Running on http://0.0.0.0:${PORT}`);
});
