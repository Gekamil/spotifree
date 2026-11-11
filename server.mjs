import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { resolveAudio, resolveYouTubeVideoId, streamAudioFromUrl, streamAudioDirect, searchYouTubeTracks, findBestInstrumentalNode } from './scripts/audioService.mjs';
import { extractSpotifySession } from './scripts/spotifySessionExtractor.mjs';
import { searchSpotifyPublicPlaylists } from './api/_lib/extract-session.js';
import {
  searchSoundCloudCatalog,
  resolveSoundCloudUrl,
  findMatchingOfficialTrackIndex,
  buildArtistSoundCloudVault,
} from './api/_lib/musicFallback.js';

const PORT = process.env.PORT || 10000;
let currentPlayingTrackId = null;

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range, Authorization');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges, Content-Disposition, X-Video-Id, X-Total-Length, X-Audio-Source');
}

function toHDImage(url) {
  if (!url) return '';
  return url
    .replace(/\/ab67616d[0-9a-f]{8}([0-9a-f]{24})/, '/ab67616d0000b273$1')
    .replace(/\/ab676161[0-9a-f]{8}([0-9a-f]{24})/, '/ab6761610000e5eb$1')
    .replace('mosaic.scdn.co/60/', 'mosaic.scdn.co/640/')
    .replace('mosaic.scdn.co/300/', 'mosaic.scdn.co/640/');
}

function parseEmbedHtml(html, cleanId) {
  const scriptMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!scriptMatch) throw new Error('Embed NEXT_DATA not found in page');

  const data = JSON.parse(scriptMatch[1]);
  const entity = data.props?.pageProps?.state?.data?.entity;
  if (!entity) throw new Error('Entity missing from Spotify Embed');

  // Find best resolution cover image
  let coverUrl = '';
  const visualImages = entity.visualIdentity?.image;
  if (visualImages && visualImages.length > 0) {
    const best = visualImages.find(s => (s.maxHeight || 0) >= 300) || visualImages[visualImages.length - 1];
    if (best?.url) coverUrl = toHDImage(best.url);
  }
  if (!coverUrl && entity.coverArt?.sources && entity.coverArt.sources.length > 0) {
    const best = entity.coverArt.sources.find(s => (s.height || 0) >= 300 || (s.width || 0) >= 300) || entity.coverArt.sources[0];
    if (best?.url) coverUrl = toHDImage(best.url);
  }
  if (!coverUrl && Array.isArray(entity.images) && entity.images.length > 0) {
    coverUrl = toHDImage(entity.images[0]?.url || entity.images[0]);
  }
  if (!coverUrl && (cleanId === 'collection-tracks' || cleanId === 'liked-songs')) {
    coverUrl = 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg';
  }

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
        images: coverUrl ? [{ url: coverUrl }] : [],
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
    images: coverUrl ? [{ url: coverUrl }] : [],
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

// Server-side Spotify Token Manager
let cachedSpotifyServerToken = null;
let cachedSpotifyServerTokenExpires = 0;

async function getSpotifyServerToken() {
  if (cachedSpotifyServerToken && Date.now() < cachedSpotifyServerTokenExpires - 60000) {
    return cachedSpotifyServerToken;
  }
  // 1. Try official client_credentials flow using Spotify Developer Credentials
  try {
    const authHeader = 'Basic ' + Buffer.from('ea3003771e264c4690a2ac289afd22a4:3976fc2dadf04e9c857ff2afdcc07d2b').toString('base64');
    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': authHeader,
      },
      body: new URLSearchParams({ grant_type: 'client_credentials' }).toString(),
    });
    if (tokenRes.ok) {
      const data = await tokenRes.json();
      if (data && data.access_token) {
        cachedSpotifyServerToken = data.access_token;
        cachedSpotifyServerTokenExpires = Date.now() + (data.expires_in || 3600) * 1000;
        return cachedSpotifyServerToken;
      }
    }
  } catch (err) {
    console.warn('[Spotify client credentials error]:', err.message);
  }

  // 2. Fallback: anonymous Spotify Web Player token
  try {
    const webRes = await fetch('https://open.spotify.com/get_access_token?reason=transport&productType=web_player', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    if (webRes.ok) {
      const data = await webRes.json();
      if (data && data.accessToken) {
        cachedSpotifyServerToken = data.accessToken;
        cachedSpotifyServerTokenExpires = data.accessTokenExpirationTimestampMs || (Date.now() + 3600000);
        return cachedSpotifyServerToken;
      }
    }
  } catch (err) {
    console.warn('[Spotify web player token error]:', err.message);
  }

  return null;
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
  if (pathname === '/health') {
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    return res.end(JSON.stringify({ status: 'ok', service: 'Spotifree Cloud Backend', version: '1.0.3', cookiesLoaded: !!process.env.YOUTUBE_COOKIES }));
  }

  // 2. Direct Audio Streaming & Download (/api/audio/stream, /api/audio/download)
  if (pathname === '/api/audio/stream' || pathname === '/api/audio/download') {
    const target = reqUrl.searchParams.get('id') || reqUrl.searchParams.get('videoId') || reqUrl.searchParams.get('q') || reqUrl.searchParams.get('v') || reqUrl.searchParams.get('trackId') || '';
    if (!target.trim()) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'Missing audio query or id' }));
    }

    try {
      currentPlayingTrackId = target;
      const startSec = Math.max(0, parseInt(reqUrl.searchParams.get('start') || '0', 10)) || 0;
      const isDownload = pathname === '/api/audio/download';
      const wantMp3 = reqUrl.searchParams.get('format') === 'mp3' || isDownload;
      const rawFilename = reqUrl.searchParams.get('filename') || 'cancion.mp3';
      const safeFile = wantMp3 ? rawFilename.replace(/\.[^.]+$/, '') + '.mp3' : rawFilename;
      const rawDur = Number(reqUrl.searchParams.get('duration') || reqUrl.searchParams.get('durationSec') || 0);
      const expectedDurationSec = rawDur > 1000 ? Math.round(rawDur / 1000) : Math.round(rawDur);
      return await streamAudioDirect(target, req, res, startSec, {
        q: reqUrl.searchParams.get('q') || '',
        title: reqUrl.searchParams.get('title') || '',
        artist: reqUrl.searchParams.get('artist') || '',
        expectedDurationSec: expectedDurationSec > 35 ? expectedDurationSec : 0,
        transcodeMp3: wantMp3,
        headers: isDownload ? { 'Content-Disposition': `attachment; filename="${safeFile}"` } : {},
      });
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
      // 1. Fast direct resolution via YouTube Music Innertube search (<500ms, no datacenter block)
      const videoId = await resolveYouTubeVideoId(q);
      if (videoId) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({
          success: true,
          videoId,
          title: title || q,
          artist,
          streamUrl: `/api/audio/stream?id=${encodeURIComponent(videoId)}`,
        }));
      }

      // 2. Fallback to deep extractor
      const info = await resolveAudio(q);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({
        success: true,
        videoId: info.id,
        title: info.title,
        duration: info.duration,
        streamUrl: `/api/audio/stream?id=${encodeURIComponent(info.id)}`,
      }));
    } catch (err) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: err.message }));
    }
  }

  // 3b. Audio Instrumental Finder (/api/audio/instrumental)
  if (pathname === '/api/audio/instrumental') {
    const title = (reqUrl.searchParams.get('title') || '').trim();
    const artist = (reqUrl.searchParams.get('artist') || '').trim();
    const rawDur = Number(reqUrl.searchParams.get('duration') || 0);
    const dur = rawDur > 1000 ? Math.round(rawDur / 1000) : Math.round(rawDur);
    res.setHeader('Content-Type', 'application/json');
    if (!title) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ found: false, candidate: null, error: 'Missing title' }));
    }
    try {
      const candidate = await findBestInstrumentalNode({ title, artist, expectedDurationSec: dur > 35 ? dur : 0 });
      res.statusCode = 200;
      return res.end(JSON.stringify({ found: Boolean(candidate), candidate: candidate || null }));
    } catch (e) {
      res.statusCode = 200;
      return res.end(JSON.stringify({ found: false, candidate: null, error: e?.message }));
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

  // 4a. Spotify App Token Endpoint (/api/spotify/app-token)
  if (pathname === '/api/spotify/app-token') {
    res.setHeader('Content-Type', 'application/json');
    const token = await getSpotifyServerToken();
    if (token) {
      res.statusCode = 200;
      return res.end(JSON.stringify({ access_token: token, expires_in: 3600 }));
    }
    res.statusCode = 502;
    return res.end(JSON.stringify({ error: 'Could not acquire Spotify token' }));
  }

  // 4b. Spotify Token Proxy (/api/spotify/token)
  if (pathname === '/api/spotify/token' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const tokenParams = new URLSearchParams();

        if (payload.grant_type === 'refresh_token') {
          tokenParams.append('grant_type', 'refresh_token');
          tokenParams.append('refresh_token', payload.refresh_token);
          tokenParams.append('client_id', payload.client_id || 'ea3003771e264c4690a2ac289afd22a4');
        } else {
          tokenParams.append('grant_type', 'authorization_code');
          tokenParams.append('code', payload.code);
          tokenParams.append('redirect_uri', payload.redirect_uri);
          tokenParams.append('client_id', payload.client_id || 'ea3003771e264c4690a2ac289afd22a4');
          if (payload.code_verifier) {
            tokenParams.append('code_verifier', payload.code_verifier);
          }
        }

        const authHeader = 'Basic ' + Buffer.from('ea3003771e264c4690a2ac289afd22a4:3976fc2dadf04e9c857ff2afdcc07d2b').toString('base64');

        const spotifyRes = await fetch('https://accounts.spotify.com/api/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': authHeader,
          },
          body: tokenParams.toString(),
        });

        const data = await spotifyRes.json();
        res.statusCode = spotifyRes.status;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify(data));
      } catch (err) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 4c. Real DJ Audio Features API (/api/audio-features)
  if (pathname === '/api/audio-features' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const tracks = Array.isArray(payload.tracks) ? payload.tracks : [];

        let catalog = {};
        try {
          const catPath = path.join(process.cwd(), 'src', 'data', 'realAudioFeatures.json');
          if (fs.existsSync(catPath)) {
            catalog = JSON.parse(fs.readFileSync(catPath, 'utf8'));
          }
        } catch {}

        const MAJOR_CAMELOT = {
          0: '8B', 1: '3B', 2: '10B', 3: '5B', 4: '12B', 5: '7B',
          6: '2B', 7: '9B', 8: '4B', 9: '11B', 10: '6B', 11: '1B',
        };
        const MINOR_CAMELOT = {
          0: '5A', 1: '12A', 2: '7A', 3: '2A', 4: '9A', 5: '4A',
          6: '11A', 7: '6A', 8: '1A', 9: '8A', 10: '3A', 11: '10A',
        };

        const normalize = (s = '') => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w\s]/g, '').trim();

        const audio_features = tracks.map(t => {
          const id = (t.id || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
          const tNorm = normalize(t.name);
          const aNorm = normalize(t.artist);

          let tempo = 130;
          let key = 4;
          let mode = 0;
          let camelot = '9A';
          let matched = false;

          // 1. Direct or partial match in verified catalog
          if (tNorm && catalog[tNorm]) {
            const item = catalog[tNorm];
            tempo = item.tempo;
            key = item.key;
            mode = item.mode;
            camelot = item.camelot || (mode === 1 ? MAJOR_CAMELOT[key] : MINOR_CAMELOT[key]) || '9A';
            matched = true;
          } else if (tNorm) {
            for (const [kName, item] of Object.entries(catalog)) {
              if (tNorm.includes(kName) || kName.includes(tNorm)) {
                tempo = item.tempo;
                key = item.key;
                mode = item.mode;
                camelot = item.camelot || (mode === 1 ? MAJOR_CAMELOT[key] : MINOR_CAMELOT[key]) || '9A';
                matched = true;
                break;
              }
            }
          }

          // 2. Genre / Artist rules
          if (!matched) {
            const isBachata = aNorm.includes('prince royce') || aNorm.includes('romeo santos') || aNorm.includes('xtreme') || aNorm.includes('aventura') || tNorm.includes('bachata');
            if (isBachata) {
              tempo = 130; key = 4; mode = 0; camelot = '9A'; matched = true;
            } else if (aNorm.includes('bad bunny')) {
              tempo = 96; key = 6; mode = 0; camelot = '11A'; matched = true;
            } else if (aNorm.includes('feid')) {
              tempo = 92; key = 8; mode = 0; camelot = '1A'; matched = true;
            } else if (aNorm.includes('quevedo')) {
              tempo = 100; key = 9; mode = 0; camelot = '8A'; matched = true;
            } else if (aNorm.includes('rauw')) {
              tempo = 118; key = 6; mode = 0; camelot = '11A'; matched = true;
            } else if (aNorm.includes('mora')) {
              tempo = 105; key = 5; mode = 1; camelot = '7B'; matched = true;
            } else if (aNorm.includes('ozuna')) {
              tempo = 96; key = 11; mode = 0; camelot = '10A'; matched = true;
            } else if (aNorm.includes('anuel') || aNorm.includes('myke towers') || aNorm.includes('karol g') || aNorm.includes('daddy yankee') || aNorm.includes('balvin')) {
              tempo = 94; key = 8; mode = 0; camelot = '1A'; matched = true;
            } else if (aNorm.includes('david guetta') || aNorm.includes('calvin harris') || aNorm.includes('tiesto') || aNorm.includes('garrix') || aNorm.includes('avicii') || aNorm.includes('fred again')) {
              tempo = 126; key = 9; mode = 0; camelot = '8A'; matched = true;
            } else if (aNorm.includes('dua lipa') || aNorm.includes('the weeknd') || aNorm.includes('harry styles') || aNorm.includes('taylor swift')) {
              tempo = 120; key = 9; mode = 1; camelot = '11B'; matched = true;
            } else if (aNorm.includes('drake') || aNorm.includes('travis scott') || aNorm.includes('eminem') || aNorm.includes('bizarrap') || aNorm.includes('duki')) {
              tempo = 140; key = 2; mode = 0; camelot = '7A'; matched = true;
            } else if (aNorm.includes('coldplay') || aNorm.includes('imagine dragons') || aNorm.includes('arctic monkeys')) {
              tempo = 124; key = 0; mode = 1; camelot = '8B'; matched = true;
            } else if (tNorm || aNorm) {
              let hash = 0;
              const combined = `${tNorm} ${aNorm}`;
              for (let i = 0; i < combined.length; i++) {
                hash = (hash * 31 + combined.charCodeAt(i)) & 0x7fffffff;
              }
              tempo = 95 + (hash % 36);
              key = (hash >> 3) % 12;
              mode = (hash >> 7) % 2;
              camelot = (mode === 1 ? MAJOR_CAMELOT[key] : MINOR_CAMELOT[key]) || '9A';
            }
          }

          return {
            id,
            tempo,
            key,
            mode,
            camelot,
            time_signature: 4,
          };
        });

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ audio_features }));
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

  // 6b. Spotify Recommendations API (/api/spotify/recommendations)
  if (pathname === '/api/spotify/recommendations') {
    res.setHeader('Content-Type', 'application/json');
    const seedTracks = reqUrl.searchParams.get('seed_tracks') || '';
    const seedArtists = reqUrl.searchParams.get('seed_artists') || '';
    const artist = (reqUrl.searchParams.get('artist') || '').trim();
    const trackName = (reqUrl.searchParams.get('track_name') || '').trim();
    const limit = Math.min(parseInt(reqUrl.searchParams.get('limit') || '15', 10), 30);
    const authHeader = req.headers['authorization'];

    // 1. Try official Spotify API if auth header provided
    if (authHeader && authHeader.startsWith('Bearer ') && (seedTracks || seedArtists)) {
      try {
        const spotifyParams = new URLSearchParams({ limit: String(limit) });
        if (seedTracks) spotifyParams.set('seed_tracks', seedTracks);
        if (seedArtists) spotifyParams.set('seed_artists', seedArtists);

        const spRes = await fetch(`https://api.spotify.com/v1/recommendations?${spotifyParams.toString()}`, {
          headers: { Authorization: authHeader },
        });
        if (spRes.ok) {
          const spData = await spRes.json();
          if (spData && Array.isArray(spData.tracks) && spData.tracks.length > 0) {
            res.statusCode = 200;
            return res.end(JSON.stringify({ tracks: spData.tracks }));
          }
        }
      } catch (err) {
        console.warn('[Spotify recommendations failed, falling back to smart style matching]:', err.message);
      }
    }

    // 2. High-Fidelity Style & Genre Similarity matching (iTunes + YouTube Music Radio)
    try {
      const searchTarget = artist || trackName;
      let primaryGenre = '';
      const candidateTracks = [];

      if (searchTarget) {
        // Query artist's top tracks to identify genre and vibe
        const itunesArtistRes = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(searchTarget)}&entity=song&limit=15`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        }).then(r => r.ok ? r.json() : { results: [] }).catch(() => ({ results: [] }));

        const results = itunesArtistRes.results || [];
        if (results.length > 0) {
          primaryGenre = results[0].primaryGenreName || '';
          const itunesFormatted = results.map(t => ({
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
            genre: t.primaryGenreName,
          }));
          candidateTracks.push(...itunesFormatted);
        }
      }

      // Query similar tracks in that exact genre and musical style
      const genreQuery = primaryGenre ? `${primaryGenre} ${artist}`.trim() : `${artist} radio hits`;
      const [genreSongs, ytRadio] = await Promise.all([
        fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(genreQuery)}&entity=song&limit=25`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        }).then(r => r.ok ? r.json() : { results: [] }).catch(() => ({ results: [] })),
        searchYouTubeTracks(`${artist} mix radio hits`, 12).catch(() => []),
      ]);

      const genreFormatted = (genreSongs.results || []).map(t => ({
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
        genre: t.primaryGenreName,
      }));

      candidateTracks.push(...ytRadio, ...genreFormatted);

      // Deduplicate strictly by normalized track title + artist
      const seen = new Set();
      if (trackName) seen.add(trackName.toLowerCase().replace(/[^a-z0-9]/g, ''));
      const unique = [];

      for (const t of candidateTracks) {
        const key = (t.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (key && !seen.has(key)) {
          seen.add(key);
          unique.push(t);
        }
        if (unique.length >= limit) break;
      }

      res.statusCode = 200;
      return res.end(JSON.stringify({ tracks: unique }));
    } catch (e) {
      console.error('[Recommendations error]:', e);
      res.statusCode = 200;
      return res.end(JSON.stringify({ tracks: [] }));
    }
  }

  // 7. Search API (/api/spotify/search) - Official Spotify API + SoundCloud + iTunes + YouTube Music
  if (pathname === '/api/spotify/search' || pathname === '/api/search') {
    const q = (reqUrl.searchParams.get('q') || '').trim();
    res.setHeader('Content-Type', 'application/json');

    if (!q) {
      res.statusCode = 200;
      return res.end(JSON.stringify({ tracks: { items: [] }, soundcloudTracks: { items: [] }, artists: { items: [] }, albums: { items: [] }, playlists: { items: [] } }));
    }

    if (/^https?:\/\/(www\.|m\.|on\.)?soundcloud\.com\//i.test(q)) {
      try {
        const scResolved = await resolveSoundCloudUrl(q);
        if (scResolved?.kind === 'track' && scResolved.track) {
          res.statusCode = 200;
          return res.end(JSON.stringify({ tracks: { items: [scResolved.track] }, soundcloudTracks: { items: [scResolved.track] }, artists: { items: [] }, albums: { items: [] }, playlists: { items: [] } }));
        }
        if (scResolved?.kind === 'playlist' && scResolved.playlist) {
          const items = scResolved.playlist.tracks?.items || [];
          res.statusCode = 200;
          return res.end(JSON.stringify({ tracks: { items: items.slice(0, 20) }, soundcloudTracks: { items }, artists: { items: [] }, albums: { items: [] }, playlists: { items: [scResolved.playlist] } }));
        }
      } catch {}
    }

    try {
      const cleanQ = q.replace(/[()[\]{}_-]/g, ' ').replace(/\s+/g, ' ').trim();
      const spotifyToken = await getSpotifyServerToken();

      let spotifyData = null;
      if (spotifyToken) {
        try {
          const sRes = await fetch(
            `https://api.spotify.com/v1/search?q=${encodeURIComponent(cleanQ || q)}&type=track,artist,album,playlist&limit=25`,
            {
              headers: { Authorization: `Bearer ${spotifyToken}` },
              signal: AbortSignal.timeout?.(4000),
            }
          );
          if (sRes.ok) {
            spotifyData = await sRes.json();
          }
        } catch (e) {
          console.warn('[Spotify official search error]:', e.message);
        }
      }

      // If Spotify Web API returned tracks, enrich HD images, SoundCloud variants and return primary!
      if (spotifyData && spotifyData.tracks?.items?.length > 0) {
        // Enrich public playlists if not present in Web API response
        if (!spotifyData.playlists?.items?.length) {
          const spotifyPlaylists = await searchSpotifyPublicPlaylists(cleanQ, 20).catch(() => []);
          spotifyData.playlists = { items: spotifyPlaylists };
        }

        // Ensure image URLs are HD 640x640
        if (spotifyData.tracks?.items) {
          spotifyData.tracks.items = spotifyData.tracks.items.map(t => ({
            ...t,
            preview_url: null, // Zero 30-sec previews
            album: {
              ...t.album,
              images: (t.album?.images || []).map(img => ({ ...img, url: toHDImage(img.url) })),
            },
          }));
        }

        // Search SoundCloud variants and artist vault for Spotify Web API results
        const scRes = await Promise.race([
          Promise.all([
            searchSoundCloudCatalog(cleanQ, { limit: 12 }),
            searchSoundCloudCatalog(`${cleanQ} remix slowed leak`, { limit: 14 }),
          ]).then(([baseSc, varSc]) => {
            const seen = new Set();
            const merged = [];
            for (const t of [...(varSc?.tracks || []), ...(baseSc?.tracks || [])]) {
              if (!t?.id || seen.has(t.id)) continue;
              seen.add(t.id);
              merged.push(t);
            }
            return { tracks: merged };
          }),
          new Promise((r) => setTimeout(() => r({ tracks: [] }), 4000)),
        ]).catch(() => ({ tracks: [] }));

        const soundcloudVariants = [];
        for (const scT of scRes?.tracks || []) {
          const scNumId = String(scT.id || '').replace(/^sc-/, '');
          const dupIdx = findMatchingOfficialTrackIndex(
            { id: scNumId, title: scT.name, user: { username: scT.artists?.[0]?.name || '' }, duration: scT.duration_ms, tag_list: scT.album?.name || '' },
            spotifyData.tracks.items
          );
          if (dupIdx >= 0) {
            if (!spotifyData.tracks.items[dupIdx].scAltId) spotifyData.tracks.items[dupIdx].scAltId = `sc:${scNumId}`;
            continue;
          }
          soundcloudVariants.push(scT);
        }
        spotifyData.soundcloudTracks = { items: soundcloudVariants };

        const matchedArtist = spotifyData.artists?.items?.[0];
        if (matchedArtist?.name && soundcloudVariants.length > 0) {
          const vId = `sc-vault-${encodeURIComponent(matchedArtist.name)}`;
          const plItems = spotifyData.playlists?.items || [];
          if (!plItems.some(p => p.id === vId)) {
            plItems.unshift({
              id: vId,
              name: `${matchedArtist.name}: Remixes, Leaks y Slowed`,
              description: 'Remixes, versiones slowed, inéditas y temas oficiales',
              images: matchedArtist.images?.length ? matchedArtist.images : soundcloudVariants[0]?.album?.images || [],
              owner: { display_name: 'Spotifree', id: 'spotifree' },
              tracks: { total: soundcloudVariants.length + 6, items: [] },
            });
            spotifyData.playlists.items = plItems;
          }
        }

        res.statusCode = 200;
        return res.end(JSON.stringify(spotifyData));
      }

      // Secondary Fallback: Deezer Studio API + YouTube Music + iTunes
      const withoutPlaylist = cleanQ.replace(/\bplaylist(s)?\b/gi, '').trim() || cleanQ;
      const trackSearchQuery = withoutPlaylist;
      const words = cleanQ.toLowerCase().split(/\s+/).filter(Boolean);
      const STOPWORDS = new Set(['la', 'el', 'los', 'las', 'de', 'del', 'y', 'en', 'un', 'una', 'ft', 'feat', 'playlist', 'playlists']);
      const significantWords = words.filter(w => !STOPWORDS.has(w) && w.length >= 3);
      const firstWord = significantWords[0] || words[0] || cleanQ;

      const fetchPromises = [
        fetch(`https://api.deezer.com/search?q=${encodeURIComponent(trackSearchQuery)}&limit=25`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        }).then(r => r.ok ? r.json() : { data: [] }).catch(() => ({ data: [] })),
        fetch(`https://api.deezer.com/search/artist?q=${encodeURIComponent(trackSearchQuery)}&limit=8`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        }).then(r => r.ok ? r.json() : { data: [] }).catch(() => ({ data: [] })),
        fetch(`https://api.deezer.com/search/album?q=${encodeURIComponent(trackSearchQuery)}&limit=8`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        }).then(r => r.ok ? r.json() : { data: [] }).catch(() => ({ data: [] })),
        fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(trackSearchQuery)}&media=music&entity=song&limit=15`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        }).then(r => r.ok ? r.json() : { results: [] }).catch(() => ({ results: [] })),
        searchYouTubeTracks(trackSearchQuery, 15).catch(() => []),
        // 5. Spotify Public Playlists (direct Pathfinder GraphQL)
        searchSpotifyPublicPlaylists(cleanQ, 20).catch(() => []),
        // 6. Deezer Real Community & Curated Playlists (by query)
        fetch(`https://api.deezer.com/search/playlist?q=${encodeURIComponent(cleanQ)}&limit=20`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        }).then(r => r.ok ? r.json() : { data: [] }).catch(() => ({ data: [] })),
        // 7. Deezer Real Playlists (without 'playlist' keyword)
        fetch(`https://api.deezer.com/search/playlist?q=${encodeURIComponent(withoutPlaylist)}&limit=20`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        }).then(r => r.ok ? r.json() : { data: [] }).catch(() => ({ data: [] })),
      ];

      if (significantWords.length > 1) {
        for (const sw of [significantWords[0], significantWords[significantWords.length - 1]]) {
          fetchPromises.push(
            fetch(`https://api.deezer.com/search?q=${encodeURIComponent(sw)}&limit=15`, {
              headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            }).then(r => r.ok ? r.json() : { data: [] }).catch(() => ({ data: [] }))
          );
        }
      } else if (words.length > 1) {
        fetchPromises.push(
          fetch(`https://api.deezer.com/search?q=${encodeURIComponent(firstWord)}&limit=15`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          }).then(r => r.ok ? r.json() : { data: [] }).catch(() => ({ data: [] }))
        );
      }

      const results = await Promise.all(fetchPromises);
      const deezerTracksRes = results[0];
      const deezerArtistsRes = results[1];
      const deezerAlbumsRes = results[2];
      const itunesRes = results[3];
      const ytTracks = results[4] || [];
      const spotifyPlaylistsRes = results[5] || [];
      const deezerPlaylistsRes1 = results[6] || { data: [] };
      const deezerPlaylistsRes2 = results[7] || { data: [] };
      const deezerExtraRes = results[8] || { data: [] };

      const allDeezerRaw = [...(deezerTracksRes.data || []), ...(deezerExtraRes.data || [])];
      const deezerTracks = allDeezerRaw.map(t => {
        const cover = t.album?.cover_xl || t.album?.cover_big || t.album?.cover_medium || '';
        return {
          id: `dz-${t.id}`,
          name: t.title || t.title_short,
          duration_ms: (t.duration || 210) * 1000,
          preview_url: null,
          artists: [{ id: `art-${t.artist?.id || 'unknown'}`, name: t.artist?.name || 'Artista' }],
          album: {
            id: `alb-${t.album?.id || 'unknown'}`,
            name: t.album?.title || t.title,
            images: cover ? [{ url: cover }] : [],
          },
        };
      });

      const itunesItems = (itunesRes.results || []).map(t => ({
        id: `itunes-${t.trackId}`,
        name: t.trackName,
        duration_ms: t.trackTimeMillis || 210000,
        preview_url: null,
        artists: [{ id: `art-${t.artistId}`, name: t.artistName }],
        album: {
          id: `alb-${t.collectionId}`,
          name: t.collectionName || t.trackName,
          images: [{ url: (t.artworkUrl100 || '').replace('100x100bb', '600x600bb') }],
        },
      }));

      const seenTitles = new Set();
      const combined = [];

      // If multi-word search, enrich candidate tracks matching title words with Deezer contributors
      if (words.length > 1) {
        const candidates = deezerTracks.filter(t =>
          words.some(w => (t.name || '').toLowerCase().includes(w))
        ).slice(0, 4);

        await Promise.all(
          candidates.map(async t => {
            const trackId = t.id.replace('dz-', '');
            try {
              const detail = await fetch(`https://api.deezer.com/track/${trackId}`, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                signal: AbortSignal.timeout(1500),
              }).then(r => r.ok ? r.json() : null);
              if (detail && detail.contributors && detail.contributors.length > 0) {
                t.artists = detail.contributors.map(c => ({
                  id: `art-${c.id}`,
                  name: c.name,
                }));
              }
            } catch {}
          })
        );
      }

      // Prioritize Deezer official releases, then YouTube Music, then iTunes
      for (const t of [...deezerTracks, ...ytTracks, ...itunesItems]) {
        const key = `${(t.name || '').toLowerCase()} ${(t.artists?.[0]?.name || '').toLowerCase()}`.replace(/[^a-z0-9]/g, '');
        if (key && !seenTitles.has(key)) {
          seenTitles.add(key);
          combined.push(t);
        }
      }

      // Relevance scoring to put exact and multi-word title matches at top
      combined.sort((a, b) => {
        const scoreTrack = (t) => {
          const tName = (t.name || '').toLowerCase();
          const artistNames = (t.artists || []).map(art => (art.name || '').toLowerCase()).join(' ');
          const full = `${tName} ${artistNames}`;
          let score = 0;
          if (tName === cleanQ.toLowerCase()) score += 160;
          if (full === cleanQ.toLowerCase()) score += 150;
          if (words.some(w => tName === w)) score += 100;
          if (words.every(w => full.includes(w))) score += 80;
          if (words.some(w => tName.includes(w))) score += 50;
          if (words.some(w => artistNames.includes(w))) score += 20;
          return score;
        };
        return scoreTrack(b) - scoreTrack(a);
      });

      const artists = (deezerArtistsRes.data || []).map(a => ({
        id: `art-${a.id}`,
        name: a.name,
        images: [{ url: a.picture_xl || a.picture_big || a.picture_medium || '' }],
      }));

      const albums = (deezerAlbumsRes.data || []).map(a => ({
        id: `alb-${a.id}`,
        name: a.title,
        artists: [{ name: a.artist?.name || 'Artista' }],
        images: [{ url: a.cover_xl || a.cover_big || a.cover_medium || '' }],
        release_date: '2026',
      }));

      // Real Community & Curated Playlists from Deezer
      // Playlists: prioritize genuine Spotify user-created & public playlists
      const playlists = [];
      const seenPlaylistIds = new Set();

      if (Array.isArray(spotifyPlaylistsRes) && spotifyPlaylistsRes.length > 0) {
        for (const sp of spotifyPlaylistsRes) {
          if (!sp || !sp.id || seenPlaylistIds.has(sp.id)) continue;
          seenPlaylistIds.add(sp.id);
          playlists.push(sp);
        }
      }

      // Real Community & Curated Playlists from Deezer
      const rawPlaylists = [...(deezerPlaylistsRes1.data || []), ...(deezerPlaylistsRes2.data || [])];

      for (const p of rawPlaylists) {
        if (!p || !p.id || seenPlaylistIds.has(`dz-pl-${p.id}`)) continue;
        seenPlaylistIds.add(`dz-pl-${p.id}`);

        const cover = p.picture_xl || p.picture_big || p.picture_medium || p.picture || '';
        playlists.push({
          id: `dz-pl-${p.id}`,
          name: p.title,
          description: `Playlist de ${p.user?.name || 'Usuario'} • ${p.nb_tracks || 0} canciones`,
          images: cover ? [{ url: toHDImage(cover) }] : [],
          owner: {
            display_name: p.user?.name || 'Spotify',
            id: `user-${p.user?.id || 'dz'}`,
          },
          tracks: {
            total: p.nb_tracks || 0,
            items: [],
          },
        });
      }

      // If no playlists found from Deezer, provide generic fallback
      if (playlists.length === 0) {
        const topCover = combined[0]?.album?.images?.[0]?.url || 'https://i.scdn.co/image/ab67706f00000002acc0778b688c66b07afc5426';
        const secondCover = combined[1]?.album?.images?.[0]?.url || 'https://i.scdn.co/image/ab67706f000000022072b736ac89da8c376e3fe6';
        playlists.push(
          {
            id: `search-pl-${cleanQ.toLowerCase().replace(/\s+/g, '-')}`,
            name: `This Is ${cleanQ.charAt(0).toUpperCase() + cleanQ.slice(1)}`,
            images: [{ url: topCover }],
            owner: { display_name: 'Spotify' },
            tracks: { total: 0, items: [] },
          },
          {
            id: `search-mix-${cleanQ.toLowerCase().replace(/\s+/g, '-')}`,
            name: `Mix de ${cleanQ.charAt(0).toUpperCase() + cleanQ.slice(1)}`,
            images: [{ url: secondCover }],
            owner: { display_name: 'Spotify' },
            tracks: { total: 0, items: [] },
          }
        );
      }

      // Attach SoundCloud variants & artist vault without duplicating literal official tracks
      const scRes = await Promise.race([
        searchSoundCloudCatalog(withoutPlaylist, { limit: 16 }),
        new Promise((r) => setTimeout(() => r({ tracks: [] }), 3000)),
      ]);
      const soundcloudVariants = [];
      for (const scT of scRes?.tracks || []) {
        const scNumId = String(scT.id || '').replace(/^sc-/, '');
        const dupIdx = findMatchingOfficialTrackIndex(
          { id: scNumId, title: scT.name, user: { username: scT.artists?.[0]?.name || '' }, duration: scT.duration_ms, tag_list: scT.album?.name || '' },
          combined
        );
        if (dupIdx >= 0) {
          if (!combined[dupIdx].scAltId) combined[dupIdx].scAltId = `sc:${scNumId}`;
          continue;
        }
        soundcloudVariants.push(scT);
      }
      if (artists[0]?.name && soundcloudVariants.length > 0) {
        const vId = `sc-vault-${encodeURIComponent(artists[0].name)}`;
        if (!playlists.some((p) => p.id === vId)) {
          playlists.unshift({
            id: vId,
            name: `${artists[0].name}: Remixes, Leaks y Slowed`,
            description: 'Remixes, versiones slowed, inéditas y temas oficiales',
            images: artists[0].images?.length ? artists[0].images : soundcloudVariants[0]?.album?.images || [],
            owner: { display_name: 'Spotifree', id: 'spotifree' },
            tracks: { total: soundcloudVariants.length + 6, items: [] },
          });
        }
      }

      res.statusCode = 200;
      return res.end(JSON.stringify({
        tracks: { items: combined },
        soundcloudTracks: { items: soundcloudVariants },
        artists: { items: artists },
        albums: { items: albums },
        playlists: { items: playlists },
      }));
    } catch (e) {
      console.error('[Search error]:', e);
      res.statusCode = 200;
      return res.end(JSON.stringify({ tracks: { items: [] } }));
    }
  }

  // 8. Playlist scrape (/api/spotify/playlist/:id)
  if (pathname.startsWith('/api/spotify/playlist/')) {
    const rawId = pathname.replace('/api/spotify/playlist/', '').split('/')[0];
    res.setHeader('Content-Type', 'application/json');

    if (rawId.startsWith('sc-vault-')) {
      let artistName = rawId.slice('sc-vault-'.length);
      try { artistName = decodeURIComponent(artistName); } catch {}
      const vault = await buildArtistSoundCloudVault(artistName).catch(() => null);
      if (vault) {
        res.statusCode = 200;
        return res.end(JSON.stringify(vault));
      }
    }
    if (rawId.startsWith('sc-pl-url:')) {
      const rawUrl = decodeURIComponent(rawId.slice('sc-pl-url:'.length));
      const scResolved = await resolveSoundCloudUrl(rawUrl).catch(() => null);
      if (scResolved?.kind === 'playlist' && scResolved.playlist) {
        res.statusCode = 200;
        return res.end(JSON.stringify(scResolved.playlist));
      }
    }

    // Deezer Playlist fast-path
    if (rawId.startsWith('dz-') || /^\d+$/.test(rawId)) {
      const dzId = rawId.replace(/^dz-(pl-)?/, '');
      try {
        const dzRes = await fetch(`https://api.deezer.com/playlist/${dzId}`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
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
                id: `alb-${t.album?.id || rawId}`,
                name: t.album?.title || t.title,
                images: [{ url: toHDImage(t.album?.cover_xl || t.album?.cover_big || t.album?.cover_medium || cover) }],
              },
              duration_ms: (t.duration || 210) * 1000,
              preview_url: null,
              added_at: 'Reciente',
            }));

            res.statusCode = 200;
            return res.end(JSON.stringify({
              id: rawId,
              name: data.title,
              description: data.description || `Playlist creada por ${data.creator?.name || 'Usuario'}`,
              type: 'playlist',
              images: cover ? [{ url: cover }] : [],
              owner: {
                display_name: data.creator?.name || 'Spotify',
                id: `user-${data.creator?.id || 'dz'}`,
              },
              color: '#303030',
              tracks: {
                total: data.nb_tracks || tracks.length,
                items: tracks,
              },
            }));
          }
        }
      } catch (err) {
        console.warn(`Deezer playlist fetch notice ${rawId}:`, err.message);
      }
    }

    // Artist profile fast-path (art-* / artist-*)
    if (rawId.startsWith('art-') || rawId.startsWith('artist-')) {
      const artRaw = rawId.replace(/^(art-|artist-)/, '');
      let artistName = artRaw;
      try { artistName = decodeURIComponent(artRaw); } catch {}
      try {
        let dzArtist = null;
        if (/^\d+$/.test(artRaw)) {
          const aRes = await fetch(`https://api.deezer.com/artist/${artRaw}`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            signal: AbortSignal.timeout?.(4000),
          });
          if (aRes.ok) dzArtist = await aRes.json();
        }
        if (!dzArtist || !dzArtist.name) {
          const sRes = await fetch(`https://api.deezer.com/search/artist?q=${encodeURIComponent(artistName)}&limit=1`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            signal: AbortSignal.timeout?.(4000),
          });
          if (sRes.ok) {
            const sData = await sRes.json();
            if (sData.data?.length) dzArtist = sData.data[0];
          }
        }
        if (dzArtist && dzArtist.id) {
          const topRes = await fetch(`https://api.deezer.com/artist/${dzArtist.id}/top?limit=40`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            signal: AbortSignal.timeout?.(4000),
          });
          const topData = topRes.ok ? await topRes.json() : { data: [] };
          const cover = toHDImage(dzArtist.picture_xl || dzArtist.picture_big || dzArtist.picture_medium || dzArtist.picture);
          const tracks = (topData.data || []).map((t, idx) => ({
            id: `dz-${t.id}`,
            name: t.title || t.title_short,
            artists: [{ id: `art-${dzArtist.id}`, name: dzArtist.name }],
            album: {
              id: `alb-${t.album?.id || rawId}`,
              name: t.album?.title || t.title,
              images: (t.album?.cover_xl || t.album?.cover_big || t.album?.cover_medium)
                ? [{ url: toHDImage(t.album?.cover_xl || t.album?.cover_big || t.album?.cover_medium) }]
                : cover ? [{ url: cover }] : [],
            },
            duration_ms: (t.duration || 210) * 1000,
            preview_url: null,
            added_at: 'Popular',
          }));

          res.statusCode = 200;
          return res.end(JSON.stringify({
            id: rawId,
            name: dzArtist.name,
            description: 'Artista',
            type: 'artist',
            images: cover ? [{ url: cover }] : [],
            owner: { display_name: 'Spotify', id: 'spotify' },
            color: '#181818',
            tracks: {
              total: tracks.length,
              items: tracks,
            },
          }));
        }
      } catch (err) {
        console.warn(`Artist fetch notice ${rawId}:`, err.message);
      }
    }

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

  // 8b. Real Dynamic Session Extraction from Cookie (/api/spotify/extract-session)
  if (pathname === '/api/spotify/extract-session' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { cookie } = JSON.parse(body || '{}');
        const session = await extractSpotifySession(cookie);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify(session));
      } catch (err) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: err.message || 'Error al procesar la sesión de Spotify.' }));
      }
    });
    return;
  }

  // 9. Real Live Session Sync Endpoint (/api/session-sync & /api/spotify/session)
  if (pathname === '/api/session-sync' || pathname === '/api/spotify/session') {
    res.setHeader('Content-Type', 'application/json');

    const isDevBridge = reqUrl.searchParams.get('dev_bridge') === 'true';
    const cacheFile = path.resolve('src/data/liveExtractedFeed.json');
    const sessionFile = path.resolve('src/data/liveExtractedSession.json');

    let feed = null;
    if (fs.existsSync(cacheFile)) {
      try {
        const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
        if (cached && cached.shelves && cached.shelves.length >= 5) {
          feed = cached;
        }
      } catch {}
    }

    if (!feed || !feed.shelves || feed.shelves.length < 5) {
      try {
        const fallbackSession = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
        feed = {
          userName: fallbackSession.user?.display_name || 'Spotifree',
          userId: fallbackSession.user?.id || 'spotifree-public',
          userPlaylists: fallbackSession.playlists || [],
          quickAccess: fallbackSession.quickAccess || [],
          shelves: fallbackSession.shelves || [],
        };
      } catch {}
    }

    const connectedUserName = isDevBridge ? (feed?.userName || 'Usuario') : null;

    const realPlaylists = (feed?.userPlaylists && feed.userPlaylists.length > 0)
      ? feed.userPlaylists.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description || 'De Spotify',
          images: [{ url: toHDImage(p.images?.[0]?.url) }],
          owner: { display_name: p.owner?.display_name || 'Spotify', id: 'spotify' },
          tracks: { total: p.tracks?.total || 0 },
          color: p.id === 'liked-songs' ? '#5018F0' : '#303030',
          is_pinned: p.is_pinned ?? false,
        }))
      : [];

    const quickAccessCards = (feed?.quickAccess && feed.quickAccess.length > 0)
      ? feed.quickAccess.map((q) => ({
          id: q.id,
          name: q.name,
          image: toHDImage(q.image),
          color: '#303030',
        }))
      : [
          { id: '37i9dQZF1DWZdsS73T1ogG', name: 'el nuevo urbano', image: 'https://i.scdn.co/image/ab67706f00000002acc0778b688c66b07afc5426', color: '#704838' },
          { id: '37i9dQZF1DXcBWIGoYBM5M', name: 'Éxitos España', image: 'https://i.scdn.co/image/ab67706f00000002e8ccdd567fff6a597b87586b', color: '#1a4b4c' },
          { id: '37i9dQZF1DX10zKzsJ2jva', name: 'Viva Latino', image: 'https://i.scdn.co/image/ab67706f00000002964880811c74069be12f02b5', color: '#bd2427' },
          { id: '37i9dQZF1DX2EiUAL7Wdfc', name: 'míticas', image: 'https://i.scdn.co/image/ab67706f000000022072b736ac89da8c376e3fe6', color: '#8b3a1a' },
        ];

    const realShelves = (feed?.shelves && feed.shelves.length > 0)
      ? feed.shelves.map((s) => ({
          id: s.id,
          prefix: s.prefix || '',
          title: s.title,
          subtitle: s.subtitle || '',
          hasSeeAll: s.hasSeeAll,
          cards: (s.cards || []).map((c) => ({
            id: c.id,
            title: c.title,
            subtitle: c.subtitle,
            image: toHDImage(c.image),
            video: c.video,
            isRadio: c.isRadio,
          })),
        }))
      : [];

    const responseData = {
      connected: isDevBridge,
      user: isDevBridge ? {
        id: feed?.userId || 'user',
        display_name: connectedUserName,
        avatarLetter: connectedUserName ? connectedUserName.charAt(0).toUpperCase() : 'U',
      } : null,
      accessToken: isDevBridge ? 'session-bridge-active' : null,
      playlists: isDevBridge ? realPlaylists : [],
      // The bridge account's own playlists only go to the bridge (never to anonymous callers)
      publicPlaylists: isDevBridge ? realPlaylists : [],
      quickAccess: quickAccessCards,
      shelves: realShelves,
      recentlyPlayed: [],
      featuredMessage: isDevBridge ? `Hecho para ${connectedUserName}` : 'Novedades populares',
      playback: {
        isPlaying: false,
        item: null,
      },
      queue: [],
    };

    res.statusCode = 200;
    return res.end(JSON.stringify(responseData));
  }

  // 10. Serve Frontend SPA (dist/) directly from cloud server
  const distDir = path.resolve('dist');
  let requestedFile = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
  let fullPath = path.join(distDir, requestedFile);

  if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
    const ext = path.extname(fullPath).toLowerCase();
    const mimeTypes = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.woff2': 'font/woff2',
      '.woff': 'font/woff',
    };
    res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
    res.statusCode = 200;
    return fs.createReadStream(fullPath).pipe(res);
  }

  // SPA fallback for all frontend routes (/callback, /search, /playlist, etc.)
  const indexPath = path.join(distDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.statusCode = 200;
    return fs.createReadStream(indexPath).pipe(res);
  }

  // 404 fallback
  res.statusCode = 404;
  res.setHeader('Content-Type', 'application/json');
  return res.end(JSON.stringify({ error: 'Route not found' }));
});

server.listen(PORT, () => {
  console.log(`[Spotifree Backend] Running on http://0.0.0.0:${PORT}`);
});
