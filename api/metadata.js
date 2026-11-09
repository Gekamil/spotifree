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

/**
 * Dynamically resolves any searched track (Deezer ID, iTunes, or track name + artist)
 * to its official 22-character Spotify track ID using Spotify's Pathfinder findTracks query.
 */
async function resolveSpotifyTrackId(trackId = '', name = '', artist = '', cookie = '') {
  let cleanId = (trackId || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
  if (/^[0-9a-zA-Z]{22}$/.test(cleanId)) return cleanId;

  let searchTitle = (name || '').trim();
  let searchArtist = (artist || '').trim();

  // If Deezer track ID (e.g. 'dz-580851082' or digits) and missing name/artist, resolve from Deezer API
  if ((!searchTitle || !searchArtist) && (cleanId.startsWith('dz-') || /^\d+$/.test(cleanId))) {
    const dzId = cleanId.replace(/^dz-/, '');
    try {
      const dRes = await fetch(`https://api.deezer.com/track/${dzId}`, {
        headers: { 'User-Agent': 'Spotifree/1.0' },
        signal: AbortSignal.timeout ? AbortSignal.timeout(3000) : undefined,
      });
      if (dRes.ok) {
        const dJson = await dRes.json();
        if (dJson.title) searchTitle = dJson.title;
        if (dJson.artist?.name) searchArtist = dJson.artist.name;
      }
    } catch {}
  }

  if (!searchTitle && !searchArtist) return null;

  try {
    const auth = await getWebPlayerAuth(cookie);
    if (auth.accessToken) {
      const queryStr = `${searchArtist} ${searchTitle}`.trim();
      const variables = { query: queryStr, offset: 0, limit: 3 };
      const extensions = {
        persistedQuery: {
          version: 1,
          sha256Hash: '903df2a65d8121e27d73a2be03c01e88ebe6021bb6d4eb82a389e35d87e51d27',
        },
      };
      const pfUrl = `https://api-partner.spotify.com/pathfinder/v1/query?operationName=findTracks&variables=${encodeURIComponent(JSON.stringify(variables))}&extensions=${encodeURIComponent(JSON.stringify(extensions))}`;
      const pfRes = await fetch(pfUrl, {
        headers: {
          'Authorization': 'Bearer ' + auth.accessToken,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'App-Platform': 'WebPlayer',
          'Accept': 'application/json',
          'Origin': 'https://open.spotify.com',
          'Referer': 'https://open.spotify.com/',
        },
        signal: AbortSignal.timeout ? AbortSignal.timeout(3500) : undefined,
      });
      if (pfRes.ok) {
        const pfJson = await pfRes.json();
        const items = pfJson.data?.searchV2?.tracksV2?.items || [];
        if (items.length > 0) {
          const firstUri = items[0].item?.data?.uri || '';
          const spId = firstUri.replace(/^spotify:track:/i, '').trim();
          if (/^[0-9a-zA-Z]{22}$/.test(spId)) {
            return spId;
          }
        }
      }
    }
  } catch {}

  return null;
}

async function handleCanvas(req, res, url) {
  const { trackId = '', trackUri = '', name = '', artist = '' } = req.query || {};
  const rawId = (trackId || trackUri || url.searchParams.get('trackId') || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
  const trackName = (name || url.searchParams.get('name') || '').trim();
  const artistName = (artist || url.searchParams.get('artist') || '').trim();
  const cookie = req.headers['x-spotify-cookie'] || req.query?.cookie || '';

  if (!rawId && !trackName) return res.status(200).json({ canvasUrl: null });

  const cacheKey = `${rawId}_${trackName}_${artistName}`;
  if (CANVAS_CACHE.has(cacheKey)) return res.status(200).json({ canvasUrl: CANVAS_CACHE.get(cacheKey) });
  if (rawId && CANVAS_CACHE.has(rawId)) return res.status(200).json({ canvasUrl: CANVAS_CACHE.get(rawId) });

  let cleanId = rawId;

  // If not already a 22-character Spotify track ID, resolve dynamically using Spotify search
  if (!/^[0-9a-zA-Z]{22}$/.test(cleanId)) {
    const resolvedSpId = await resolveSpotifyTrackId(cleanId, trackName, artistName, cookie);
    if (resolvedSpId) {
      cleanId = resolvedSpId;
      if (CANVAS_CACHE.has(cleanId)) {
        const cached = CANVAS_CACHE.get(cleanId);
        if (rawId) CANVAS_CACHE.set(rawId, cached);
        CANVAS_CACHE.set(cacheKey, cached);
        return res.status(200).json({ canvasUrl: cached });
      }
    } else {
      CANVAS_CACHE.set(cacheKey, null);
      if (rawId) CANVAS_CACHE.set(rawId, null);
      return res.status(200).json({ canvasUrl: null });
    }
  }

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
            signal: AbortSignal.timeout ? AbortSignal.timeout(3500) : undefined,
          });
          if (pathfinderRes.ok) {
            const json = await pathfinderRes.json();
            const canvas = json.data?.trackUnion?.canvas;
            if (canvas?.url) {
              CANVAS_CACHE.set(cleanId, canvas.url);
              if (rawId) CANVAS_CACHE.set(rawId, canvas.url);
              CANVAS_CACHE.set(cacheKey, canvas.url);
              res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
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
          signal: AbortSignal.timeout ? AbortSignal.timeout(3500) : undefined,
        });
        if (spRes.ok) {
          const buf = await spRes.arrayBuffer();
          const str = Buffer.from(buf).toString('binary');
          const urlMatch = str.match(/https:\/\/[a-zA-Z0-9.\-_/]+\.mp4/);
          if (urlMatch) {
            CANVAS_CACHE.set(cleanId, urlMatch[0]);
            if (rawId) CANVAS_CACHE.set(rawId, urlMatch[0]);
            CANVAS_CACHE.set(cacheKey, urlMatch[0]);
            res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
            return res.status(200).json({ canvasUrl: urlMatch[0] });
          }
        }
      } catch {}
    }
  } catch {}

  CANVAS_CACHE.set(cleanId, null);
  if (rawId) CANVAS_CACHE.set(rawId, null);
  CANVAS_CACHE.set(cacheKey, null);
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

// Real BPM lookup in Deezer's public catalogue (it exposes a measured `bpm` per track).
const DEEZER_BPM_CACHE = new Map();

function normalizeForSearch(s = '') {
  return String(s)
    .replace(/\s*[([].*?[)\]]/g, '')
    .replace(/\s*-\s*(remaster|remix|radio|edit|version|live).*$/i, '')
    .replace(/\b(feat|ft)\.?\s.*$/i, '')
    .trim();
}

async function lookupDeezerBpm(title, artist) {
  const t = normalizeForSearch(title);
  const a = normalizeForSearch(artist);
  if (!t) return null;
  const cacheKey = `${t}__${a}`.toLowerCase();
  if (DEEZER_BPM_CACHE.has(cacheKey)) return DEEZER_BPM_CACHE.get(cacheKey);
  let bpm = null;
  try {
    const q = a ? `${a} ${t}` : t;
    const sRes = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=1`, {
      headers: { 'User-Agent': 'Spotifree/1.0' },
      signal: AbortSignal.timeout ? AbortSignal.timeout(4000) : undefined,
    });
    const sData = sRes.ok ? await sRes.json() : null;
    const hit = sData?.data?.[0];
    if (hit?.id) {
      const tRes = await fetch(`https://api.deezer.com/track/${hit.id}`, {
        headers: { 'User-Agent': 'Spotifree/1.0' },
        signal: AbortSignal.timeout ? AbortSignal.timeout(4000) : undefined,
      });
      const tData = tRes.ok ? await tRes.json() : null;
      const v = Number(tData?.bpm);
      if (Number.isFinite(v) && v > 40 && v < 250) bpm = Math.round(v * 10) / 10;
    }
  } catch {}
  DEEZER_BPM_CACHE.set(cacheKey, bpm);
  return bpm;
}

async function handleAudioFeatures(req, res) {
  let ids = [];
  let tracks = [];
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
    // The web client sends [{ id, name, artist }]
    tracks = Array.isArray(body?.tracks) ? body.tracks.slice(0, 60) : [];
  } else {
    const qIds = req.query?.ids || '';
    ids = qIds ? qIds.split(',') : [];
  }
  if (tracks.length === 0) tracks = ids.map((id) => ({ id, name: '', artist: '' }));

  // Look up real BPMs with a small concurrency pool
  const bpms = new Array(tracks.length).fill(null);
  let next = 0;
  const worker = async () => {
    while (next < tracks.length) {
      const i = next++;
      const tr = tracks[i];
      if (tr?.name) bpms[i] = await lookupDeezerBpm(tr.name, tr.artist);
    }
  };
  await Promise.all(Array.from({ length: Math.min(6, tracks.length) }, worker));

  const results = tracks.map((tr, i) => {
    const id = tr.id;
    const matched = VERIFIED_CATALOG[id] || null;
    const key = matched?.key ?? 5;
    const mode = matched?.mode ?? 1;
    const camelot = matched?.camelot || getCamelot(key, mode);
    const realBpm = bpms[i];
    return {
      id,
      tempo: realBpm ?? matched?.tempo ?? 105,
      // 'deezer' = measured BPM; anything else is a placeholder the client must not trust
      tempo_source: realBpm ? 'deezer' : matched ? 'catalog' : 'default',
      key,
      mode,
      camelot,
      time_signature: 4,
    };
  });

  return res.status(200).json({ audio_features: results });
}

// ---------------------------------------------------------------------------
// Apple Music animated covers ("motion artwork"). The public album page of music.apple.com
// lists them (motionDetailSquare / motionDetailTall: an HLS .m3u8 video + a still frame).
// ?id=<Apple album id>&country=es, or ?title=&artist= (found with the iTunes Search API).
// ---------------------------------------------------------------------------
const MOTION_CACHE = new Map();

function pickMotion(html, key) {
  const i = html.indexOf(`"${key}":{`);
  if (i < 0) return null;
  const block = html.slice(i, i + 2500);
  const video = block.match(/"video":"(https:[^"]+?\.m3u8)"/);
  if (!video) return null;
  const frame = block.match(/"previewFrame":\{[^}]*?"url":"(https:[^"]+?)"/);
  return {
    video: video[1].replace(/\\u002F/g, '/').replace(/\\\//g, '/'),
    poster: frame ? frame[1].replace(/\\u002F/g, '/').replace('{w}x{h}bb.{f}', '600x600bb.jpg') : null,
  };
}

async function findAppleAlbumId(title, artist, country = 'es') {
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s*[([].*?[)\]]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const cleanTitle = String(title || '').replace(/\s*[\(\[][^)]*(feat\.|remix|ft\.|with|version|remaster)[^)]*[\)\]]/gi, '').trim();
  const countries = country === 'us' ? ['us'] : [country, 'us'];

  for (const c of countries) {
    const term = encodeURIComponent(`${artist} ${cleanTitle || title}`.trim());
    try {
      const r = await fetch(`https://itunes.apple.com/search?term=${term}&entity=song&limit=6&country=${c}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      if (!r.ok) continue;
      const data = await r.json();
      const a = norm(artist);
      const t = norm(cleanTitle || title);
      const hit = (data.results || []).find((x) => {
        const xa = norm(x.artistName);
        const xt = norm(x.trackName);
        const artistMatch = xa === a || xa.startsWith(a) || a.startsWith(xa);
        const trackMatch = xt === t || xt.replace(/\s*[([].*?[)\]]/g, '').trim() === t;
        const notComp = x.collectionArtistName !== 'Various Artists' || a.includes('various');
        return artistMatch && trackMatch && notComp;
      });
      if (hit?.collectionId) return String(hit.collectionId);
    } catch {}
  }
  return null;
}

async function handleMotionCover(req, res) {
  const country = /^[a-z]{2}$/.test(req.query?.country || '') ? req.query.country : 'es';
  let id = /^\d{5,14}$/.test(req.query?.id || '') ? req.query.id : null;
  try {
    if (!id && (req.query?.title || req.query?.artist)) id = await findAppleAlbumId(req.query.title || '', req.query.artist || '', country);
    if (!id) {
      res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
      return res.status(200).json({ id: null, square: null, tall: null });
    }
    const key = `${country}:${id}`;
    if (MOTION_CACHE.has(key)) {
      res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800');
      return res.status(200).json(MOTION_CACHE.get(key));
    }
    let page = await fetch(`https://music.apple.com/${country}/album/${id}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
        'Accept-Language': 'es-ES,es;q=0.9',
      },
    });
    let html = page.ok ? await page.text() : '';
    let square = pickMotion(html, 'motionDetailSquare');
    let tall = pickMotion(html, 'motionDetailTall');

    // If not found in the regional store (e.g. 'es'), fallback to US global storefront!
    if (!square && !tall && country !== 'us') {
      try {
        const usPage = await fetch(`https://music.apple.com/us/album/${id}`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
          },
        });
        if (usPage.ok) {
          const usHtml = await usPage.text();
          square = pickMotion(usHtml, 'motionDetailSquare');
          tall = pickMotion(usHtml, 'motionDetailTall');
        }
      } catch {}
    }

    const out = { id, square, tall };
    if (page.ok) MOTION_CACHE.set(key, out);
    res.setHeader('Cache-Control', page.ok ? 'public, max-age=86400, s-maxage=604800' : 'no-store');
    return res.status(200).json(out);
  } catch (e) {
    return res.status(200).json({ id, square: null, tall: null, error: String(e?.message || e) });
  }
}

// ---------------------------------------------------------------------------
// Discovery for the Spotifree playlists (Deezer's public API; the browser can't call it: no CORS).
// ?artist=Name -> the artist (the real one: same name, most fans), their top songs, similar
// artists with a few songs each, and songs from their releases of the last weeks.
// ---------------------------------------------------------------------------
const DISCOVER_CACHE = new Map();

const dzNorm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

async function dz(path) {
  const r = await fetch(`https://api.deezer.com${path}`, { headers: { 'User-Agent': 'Spotifree/1.0' } });
  if (!r.ok) throw new Error(`deezer ${r.status}`);
  const j = await r.json();
  if (j?.error) throw new Error(j.error.message || 'deezer error');
  return j;
}

function dzTrack(t, fallbackArtist) {
  if (!t?.id || !t.title) return null;
  return {
    id: `dz-${t.id}`,
    name: t.title,
    duration_ms: (t.duration || 200) * 1000,
    artists: [{ id: `dz-art-${t.artist?.id || ''}`, name: t.artist?.name || fallbackArtist || '' }],
    album: {
      id: `dz-alb-${t.album?.id || ''}`,
      name: t.album?.title || '',
      images: t.album?.cover_xl || t.album?.cover_big ? [{ url: t.album.cover_xl || t.album.cover_big }] : [],
    },
    rank: t.rank || 0,
    explicit: Boolean(t.explicit_lyrics),
  };
}

async function handleDiscover(req, res) {
  const name = String(req.query?.artist || '').trim();
  if (!name) return res.status(400).json({ error: 'Missing artist' });
  const key = dzNorm(name);
  if (DISCOVER_CACHE.has(key)) {
    res.setHeader('Cache-Control', 'public, max-age=21600, s-maxage=86400');
    return res.status(200).json(DISCOVER_CACHE.get(key));
  }
  try {
    const found = await dz(`/search/artist?q=${encodeURIComponent(name)}&limit=8`);
    const candidates = (found.data || []).filter((a) => dzNorm(a.name) === key);
    const artist = (candidates.length ? candidates : found.data || []).sort((a, b) => (b.nb_fan || 0) - (a.nb_fan || 0))[0];
    if (!artist) {
      res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
      return res.status(200).json({ artist: null, top: [], related: [], recent: [] });
    }
    const [top, related, albums] = await Promise.all([
      dz(`/artist/${artist.id}/top?limit=15`).catch(() => ({ data: [] })),
      dz(`/artist/${artist.id}/related?limit=8`).catch(() => ({ data: [] })),
      // Deezer doesn't list albums by date: ask for many and sort them below
      dz(`/artist/${artist.id}/albums?limit=100`).catch(() => ({ data: [] })),
    ]);
    const rel = (related.data || []).slice(0, 6);
    const relTops = await Promise.all(rel.map((r) => dz(`/artist/${r.id}/top?limit=6`).catch(() => ({ data: [] }))));
    // Releases of the last 8 weeks
    const since = Date.now() - 56 * 24 * 3600 * 1000;
    const fresh = (albums.data || [])
      .filter((a) => a.release_date && Date.parse(a.release_date) >= since && Date.parse(a.release_date) <= Date.now())
      .sort((a, b) => Date.parse(b.release_date) - Date.parse(a.release_date))
      // The same single often comes twice (clean / explicit, remix pack…): one per title
      .filter((a, i, list) => list.findIndex((b) => dzNorm(b.title) === dzNorm(a.title)) === i)
      .slice(0, 4);
    const freshTracks = await Promise.all(fresh.map((a) => dz(`/album/${a.id}/tracks?limit=6`).catch(() => ({ data: [] }))));
    const out = {
      artist: { id: artist.id, name: artist.name, picture: artist.picture_xl || artist.picture_big || null, fans: artist.nb_fan || 0 },
      top: (top.data || []).map((t) => dzTrack(t, artist.name)).filter(Boolean),
      related: rel.map((r, i) => ({
        name: r.name,
        picture: r.picture_xl || r.picture_big || null,
        fans: r.nb_fan || 0,
        top: (relTops[i].data || []).map((t) => dzTrack(t, r.name)).filter(Boolean),
      })),
      recent: fresh.map((a, i) => ({
        title: a.title,
        date: a.release_date,
        cover: a.cover_xl || a.cover_big || null,
        tracks: (freshTracks[i].data || [])
          .map((t) => dzTrack({ ...t, album: { id: a.id, title: a.title, cover_xl: a.cover_xl, cover_big: a.cover_big } }, artist.name))
          .filter(Boolean),
      })),
    };
    DISCOVER_CACHE.set(key, out);
    res.setHeader('Cache-Control', 'public, max-age=21600, s-maxage=86400');
    return res.status(200).json(out);
  } catch (e) {
    return res.status(200).json({ artist: null, top: [], related: [], recent: [], error: String(e?.message || e) });
  }
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
  if (action === 'motion-cover') return handleMotionCover(req, res);
  if (action === 'discover') return handleDiscover(req, res);
  return handleAudioFeatures(req, res);
}
