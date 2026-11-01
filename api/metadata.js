/**
 * Consolidated Spotifree Metadata API
 * Serves /api/canvas, /api/audio-features, and /api/artist-image
 */
import fs from 'node:fs';
import path from 'node:path';
import { getWebPlayerAuth } from './_lib/extract-session.js';

const CANVAS_CACHE = new Map();
const AUDIO_FEATURES_CACHE = new Map();

// 1. Audio Features verified catalog
let VERIFIED_CATALOG = {};
try {
  const catalogPath = path.resolve('src/data/realAudioFeatures.json');
  if (fs.existsSync(catalogPath)) {
    VERIFIED_CATALOG = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  }
} catch {}

const MAJOR_CAMELOT = { 0: '8B', 1: '3B', 2: '10B', 3: '5B', 4: '12B', 5: '7B', 6: '2B', 7: '9B', 8: '4B', 9: '11B', 10: '6B', 11: '1B' };
const MINOR_CAMELOT = { 0: '5A', 1: '12A', 2: '7A', 3: '2A', 4: '9A', 5: '4A', 6: '11A', 7: '6A', 8: '1A', 9: '8A', 10: '3A', 11: '10A' };

function getCamelot(key, mode) {
  const k = ((key % 12) + 12) % 12;
  return mode === 1 ? (MAJOR_CAMELOT[k] || '8B') : (MINOR_CAMELOT[k] || '9A');
}

function normalize(str = '') {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s*-\s*(bachata|remix|version|radio|edit).*/i, '')
    .replace(/\(.*\)/g, '')
    .replace(/\[.*\]/g, '')
    .replace(/\b(ft|feat|featuring)\b.*/i, '')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanArtist(artist) {
  return (artist || '')
    .split(/[,&]/)[0]
    .replace(/\s*feat\..*$/i, '')
    .replace(/\s*ft\..*$/i, '')
    .trim();
}

function encodeCanvasRequest(trackId) {
  const uri = 'spotify:track:' + trackId;
  const uriBuf = Buffer.from(uri, 'utf8');
  const inner = Buffer.concat([Buffer.from([0x0A, uriBuf.length]), uriBuf]);
  return Buffer.concat([Buffer.from([0x0A, inner.length]), inner]);
}

async function handleCanvas(req, res, url) {
  const { trackId = '', trackUri = '' } = req.query || {};
  const cleanId = (trackId || trackUri || url.searchParams.get('trackId') || '').replace(/^spotify:track:/i, '').split('?')[0].trim();

  if (!cleanId) return res.status(200).json({ canvasUrl: null });
  if (CANVAS_CACHE.has(cleanId)) return res.status(200).json({ canvasUrl: CANVAS_CACHE.get(cleanId) });

  const cookie = req.headers['x-spotify-cookie'] || req.query?.cookie || '';
  const uri = `spotify:track:${cleanId}`;

  try {
    const auth = await getWebPlayerAuth(cookie);
    if (auth.accessToken) {
      if (auth.clientToken) {
        try {
          const body = {
            operationName: 'canvas',
            variables: { trackUri: uri },
            extensions: { persistedQuery: { version: 1, sha256Hash: '575138ab27cd5c1b3e54da54d0a7cc8d85485402de26340c2145f0f6bb5e7a9f' } },
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
          });
          if (pathfinderRes.ok) {
            const json = await pathfinderRes.json();
            const canvas = json.data?.trackUnion?.canvas;
            if (canvas?.url) {
              CANVAS_CACHE.set(cleanId, canvas.url);
              return res.status(200).json({ canvasUrl: canvas.url });
            }
          }
        } catch {}
      }

      // SpClient fallback
      try {
        const protoBody = encodeCanvasRequest(cleanId);
        const spRes = await fetch('https://spclient.wg.spotify.com/canvaz-cache/v0/canvases', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-protobuf',
            'Authorization': `Bearer ${auth.accessToken}`,
            'User-Agent': 'Spotify/8.8.0 iOS/16.0 (iPhone14,2)',
          },
          body: protoBody,
        });
        if (spRes.ok) {
          const buf = await spRes.arrayBuffer();
          const str = Buffer.from(buf).toString('binary');
          const urlMatch = str.match(/https:\/\/[a-zA-Z0-9.\-_/]+\.mp4/);
          if (urlMatch) {
            CANVAS_CACHE.set(cleanId, urlMatch[0]);
            return res.status(200).json({ canvasUrl: urlMatch[0] });
          }
        }
      } catch {}
    }
  } catch {}

  CANVAS_CACHE.set(cleanId, null);
  return res.status(200).json({ canvasUrl: null });
}

async function handleArtistImage(req, res) {
  const { name = '', artist = '' } = req.query || {};
  const targetArtist = cleanArtist(name || artist);
  if (!targetArtist) return res.status(200).json({ picture: null });

  try {
    const dRes = await fetch(`https://api.deezer.com/search/artist?q=${encodeURIComponent(targetArtist)}&limit=1`, {
      headers: { 'User-Agent': 'Spotifree/1.0' },
      signal: AbortSignal.timeout ? AbortSignal.timeout(4000) : undefined,
    });
    if (dRes.ok) {
      const data = await dRes.json();
      const first = data.data?.[0];
      const picture = first?.picture_big || first?.picture_medium || first?.picture_small;
      if (picture) {
        res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
        return res.status(200).json({ picture, name: first.name || targetArtist });
      }
    }
  } catch {}

  return res.status(200).json({ picture: null });
}

async function handleAudioFeatures(req, res) {
  let ids = [];
  if (req.method === 'POST') {
    let body = req.body;
    if (!body || typeof body !== 'object') {
      try {
        let raw = '';
        for await (const chunk of req) raw += chunk;
        if (raw) body = JSON.parse(raw);
      } catch {}
    }
    ids = body?.ids || [];
  } else {
    const qIds = req.query?.ids || '';
    ids = qIds ? qIds.split(',') : [];
  }

  const results = ids.map((id) => {
    let matched = VERIFIED_CATALOG[id] || null;
    let tempo = matched?.tempo || 105;
    let key = matched?.key ?? 5;
    let mode = matched?.mode ?? 1;
    let camelot = matched?.camelot || getCamelot(key, mode);

    return {
      id,
      tempo,
      key,
      mode,
      camelot,
      time_signature: 4,
    };
  });

  return res.status(200).json({ audio_features: results });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-spotify-cookie');

  if (req.method === 'OPTIONS') return res.status(204).end();

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const action = req.query?.action || (url.pathname.includes('/canvas') ? 'canvas' : url.pathname.includes('/artist-image') ? 'artist-image' : 'audio-features');

  if (action === 'canvas') return handleCanvas(req, res, url);
  if (action === 'artist-image') return handleArtistImage(req, res);
  return handleAudioFeatures(req, res);
}
