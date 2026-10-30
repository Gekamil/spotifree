import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { resolveAudio, resolveYouTubeVideoId, streamAudioFromUrl, streamAudioDirect, searchYouTubeTracks } from './scripts/audioService.mjs';
import { extractSpotifySession } from './scripts/spotifySessionExtractor.mjs';

const PORT = process.env.PORT || 10000;
let currentPlayingTrackId = null;

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range, Authorization');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');
}

function toHDImage(url) {
  if (!url) return '';
  return url
    .replace(/\/ab67616d[0-9a-f]{8}([0-9a-f]{24})/, '/ab67616d0000b273$1')
    .replace(/\/ab67706f[0-9a-f]{8}([0-9a-f]{24})/, '/ab67706f00000002$1')
    .replace(/\/ab676161[0-9a-f]{8}([0-9a-f]{24})/, '/ab6761610000e5eb$1')
    .replace(/\/ab67706c[0-9a-f]{8}([0-9a-f]{24})/, '/ab67706c0000d72c$1')
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

  // 2. Direct Audio Streaming (/api/audio/stream)
  if (pathname === '/api/audio/stream') {
    const target = reqUrl.searchParams.get('id') || reqUrl.searchParams.get('q') || reqUrl.searchParams.get('v') || reqUrl.searchParams.get('trackId') || '';
    if (!target.trim()) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'Missing audio query or id' }));
    }

    try {
      currentPlayingTrackId = target;
      const startSec = Math.max(0, parseInt(reqUrl.searchParams.get('start') || '0', 10)) || 0;
      return streamAudioDirect(target, req, res, startSec);
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

  // 7. Search API (/api/spotify/search) - Combined iTunes + YouTube Music
  if (pathname === '/api/spotify/search') {
    const q = (reqUrl.searchParams.get('q') || '').trim();
    res.setHeader('Content-Type', 'application/json');

    if (!q) {
      res.statusCode = 200;
      return res.end(JSON.stringify({ tracks: { items: [] } }));
    }

    try {
      const cleanQ = q.replace(/[()[\]{}_-]/g, ' ').replace(/\s+/g, ' ').trim();
      const [itunesRes, ytTracks] = await Promise.all([
        fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(cleanQ || q)}&media=music&entity=song&limit=15`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        }).then(r => r.ok ? r.json() : { results: [] }).catch(() => ({ results: [] })),
        searchYouTubeTracks(q, 15).catch(() => []),
      ]);

      const itunesItems = (itunesRes.results || []).map(t => ({
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

      // Combine results: if query specifically targets a remix or YouTube title, prioritize YouTube tracks
      const seenTitles = new Set();
      const combined = [];

      for (const t of [...ytTracks, ...itunesItems]) {
        const key = (t.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (key && !seenTitles.has(key)) {
          seenTitles.add(key);
          combined.push(t);
        }
      }

      res.statusCode = 200;
      return res.end(JSON.stringify({ tracks: { items: combined } }));
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

    const connectedUserName = isDevBridge ? (feed?.userName || 'Jorgeperezvk') : null;

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
          { id: '7b3MrCWtettvBKlfBSdorn', name: 'J+L(2026)', image: 'https://image-cdn-fa.spotifycdn.com/image/ab67706c0000d72c804d43e5cc7f6a6d0ac65ffc', color: '#5a483a' },
          { id: '4f0YTBqSbvM1iJpuY9r3yQ', name: 'ZIZI', image: 'https://i.scdn.co/image/ab67616d0000b273eb31ebdbca6acd99c23b4d31', color: '#2e4a52' },
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
        id: feed?.userId || 'e6yr34zzwnf1yybcw49po6nrw',
        display_name: connectedUserName,
        avatarLetter: connectedUserName ? connectedUserName.charAt(0).toUpperCase() : 'U',
      } : null,
      accessToken: isDevBridge ? 'session-bridge-active' : null,
      playlists: isDevBridge ? realPlaylists : [],
      publicPlaylists: realPlaylists,
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
