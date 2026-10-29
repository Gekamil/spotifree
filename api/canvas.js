import { getWebPlayerAuth } from './extract-session.js';

const CANVAS_CACHE = new Map();

function encodeCanvasRequest(trackId) {
  const uri = 'spotify:track:' + trackId;
  const uriBuf = Buffer.from(uri, 'utf8');
  const inner = Buffer.concat([Buffer.from([0x0A, uriBuf.length]), uriBuf]);
  return Buffer.concat([Buffer.from([0x0A, inner.length]), inner]);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-spotify-cookie');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const { trackId = '', trackUri = '' } = req.query || {};
  const cleanId = (trackId || trackUri).replace(/^spotify:track:/i, '').split('?')[0].trim();

  if (!cleanId) {
    return res.status(200).json({ canvasUrl: null });
  }

  if (CANVAS_CACHE.has(cleanId)) {
    return res.status(200).json({ canvasUrl: CANVAS_CACHE.get(cleanId) });
  }

  const cookie = req.headers['x-spotify-cookie'] || req.query.cookie || '';
  const uri = `spotify:track:${cleanId}`;

  try {
    const auth = await getWebPlayerAuth(cookie);
    if (auth.accessToken) {
      // 1. Try Pathfinder GraphQL first
      if (auth.clientToken) {
        try {
          const body = {
            operationName: 'canvas',
            variables: { trackUri: uri },
            extensions: {
              persistedQuery: {
                version: 1,
                sha256Hash: '575138ab27cd5c1b3e54da54d0a7cc8d85485402de26340c2145f0f6bb5e7a9f',
              },
            },
          };

          const pathfinderRes = await fetch('https://api-partner.spotify.com/pathfinder/v2/query', {
            method: 'POST',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36',
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Origin': 'https://open.spotify.com',
              'Referer': 'https://open.spotify.com/',
              'Authorization': `Bearer ${auth.accessToken}`,
              'client-token': auth.clientToken,
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout ? AbortSignal.timeout(3500) : undefined,
          });

          if (pathfinderRes.ok) {
            const json = await pathfinderRes.json();
            const canvas = json.data?.trackUnion?.canvas;
            if (canvas?.url) {
              CANVAS_CACHE.set(cleanId, canvas.url);
              res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
              return res.status(200).json({ canvasUrl: canvas.url });
            }
          }
        } catch {
          // ignore error
        }
      }

      // 2. Try canvaz-cache protobuf endpoint as fallback
      try {
        const protoBody = encodeCanvasRequest(cleanId);
        const spRes = await fetch('https://spclient.wg.spotify.com/canvaz-cache/v0/canvases', {
          method: 'POST',
          headers: {
            'Accept': 'application/protobuf',
            'Content-Type': 'application/protobuf',
            'Authorization': `Bearer ${auth.accessToken}`,
            'User-Agent': 'Spotify/8.5.49 iOS/Version 13.3.1 (Build 17D50)',
          },
          body: protoBody,
          signal: AbortSignal.timeout ? AbortSignal.timeout(3500) : undefined,
        });

        if (spRes.ok) {
          const buf = Buffer.from(await spRes.arrayBuffer());
          const str = buf.toString('binary');
          const urlMatch = str.match(/https:\/\/[a-zA-Z0-9_.\-/]+\.(?:cnvs\.mp4|mp4)/i) || str.match(/https:\/\/canvaz\.scdn\.co\/[a-zA-Z0-9_.\-/]+/i);
          if (urlMatch && urlMatch[0]) {
            CANVAS_CACHE.set(cleanId, urlMatch[0]);
            res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
            return res.status(200).json({ canvasUrl: urlMatch[0] });
          }
        }
      } catch {
        // ignore error
      }
    }
  } catch {
    // ignore error
  }

  CANVAS_CACHE.set(cleanId, null);
  return res.status(200).json({ canvasUrl: null });
}
