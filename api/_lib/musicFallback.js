/**
 * Shared datacenter-safe studio audio extraction helpers (Monochrome lossless + SoundCloud progressive)
 * used by Vercel /api/audio, Render scripts/audioService.mjs, and strict match scoring.
 */

const MONO_CACHE = new Map();
const SC_TRACK_CACHE = new Map();
const UNWANTED_TAGS = ['karaoke', 'instrumental', 'tribute', 'backing track', '8d audio', 'slowed', 'sped up', 'nightcore', 'acapella', 'piano cover', 'guitar cover'];
const VARIANT_TAGS = ['remix', 'live', 'en vivo', 'acoustic', 'acustico'];

export async function fetchWithTimeout(url, options = {}, ms = 6000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

export function mimeToAudioExt(mime = '') {
  const m = String(mime).toLowerCase();
  if (m.includes('flac')) return 'flac';
  if (m.includes('wav')) return 'wav';
  if (m.includes('mpeg') || m.includes('mp3')) return 'mp3';
  if (m.includes('webm')) return 'webm';
  if (m.includes('ogg') || m.includes('opus')) return 'ogg';
  return 'm4a';
}

export function sniffAudioSignature(bytes) {
  if (!bytes || bytes.length < 16) return { valid: false, mime: '', ext: 'm4a' };
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);

  // Reject HTML / XML / JSON error payloads
  if (b[0] === 0x3c || b[0] === 0x7b || b[0] === 0x5b) {
    return { valid: false, mime: '', ext: 'm4a' };
  }
  // MP4 / M4A ('ftyp' at bytes 4..7)
  if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) {
    return { valid: true, mime: 'audio/mp4', ext: 'm4a' };
  }
  // ID3 MP3 or raw MPEG ADTS sync
  if ((b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) {
    return { valid: true, mime: 'audio/mpeg', ext: 'mp3' };
  }
  // WebM / EBML
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) {
    return { valid: true, mime: 'audio/webm', ext: 'webm' };
  }
  // Ogg
  if (b[0] === 0x4f && b[1] === 0x67 && b[2] === 0x67 && b[3] === 0x53) {
    return { valid: true, mime: 'audio/ogg', ext: 'ogg' };
  }
  // FLAC ('fLaC')
  if (b[0] === 0x66 && b[1] === 0x4c && b[2] === 0x61 && b[3] === 0x43) {
    return { valid: true, mime: 'audio/flac', ext: 'flac' };
  }
  // RIFF / WAV
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46) {
    return { valid: true, mime: 'audio/wav', ext: 'wav' };
  }
  return { valid: false, mime: '', ext: 'm4a' };
}

export function normalizeMusicText(str = '') {
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function stripMusicNoise(str = '') {
  return String(str)
    .replace(/\s*[-–—]\s*(remastered|radio edit|single version|bonus track).*$/gi, '')
    .replace(/\s*[\[(](official\s*(video|audio|lyric|music video)|visualizer|explicit|remastered.*?|bonus track)[\])]/gi, '')
    .replace(/\s*\b(feat\.?|ft\.?)\s+[^-–—()]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeNormalized(str = '') {
  const norm = normalizeMusicText(str);
  if (!norm) return [];
  const words = norm.split(' ').filter((w) => w.length >= 2);
  return words.length > 0 ? words : norm.split(' ').filter(Boolean);
}

/**
 * Score an external catalog track candidate strictly so remixes, karaokes, and wrong songs never match.
 */
export function scoreMusicCandidate(
  { candTitle = '', candArtist = '', candDurationSec = 0 },
  { title = '', artist = '', query = '', expectedDurationSec = 0 }
) {
  const normCandTitle = normalizeMusicText(candTitle);
  const normCandArtist = normalizeMusicText(candArtist);
  const normCandFull = `${normCandTitle} ${normCandArtist}`.trim();
  if (!normCandTitle) return { matched: false, score: -999 };

  // Reject previews / micro-snippets
  if (candDurationSec > 0 && candDurationSec < 45 && !(expectedDurationSec > 0 && expectedDurationSec < 45)) {
    return { matched: false, score: -999 };
  }
  // Reject major duration mismatches when Spotify/iTunes gave real full-track length
  if (expectedDurationSec > 35 && candDurationSec > 0 && Math.abs(candDurationSec - expectedDurationSec) > 22) {
    return { matched: false, score: -999 };
  }

  const targetFullNorm = normalizeMusicText(`${title} ${artist} ${query}`);
  for (const bad of UNWANTED_TAGS) {
    if (normCandFull.includes(bad) && !targetFullNorm.includes(bad)) {
      return { matched: false, score: -999 };
    }
  }

  let score = 0;

  for (const tag of VARIANT_TAGS) {
    const candHas = normCandFull.includes(tag);
    const reqHas = targetFullNorm.includes(tag);
    if (candHas && !reqHas) score -= 85;
    else if (candHas && reqHas) score += 25;
  }

  const targetTitleBase = normalizeMusicText(stripMusicNoise(title || query));
  const titleTokens = tokenizeNormalized(targetTitleBase);
  if (titleTokens.length > 0) {
    if (normCandTitle === targetTitleBase) score += 90;
    else if (normCandTitle.includes(targetTitleBase) || targetTitleBase.includes(normCandTitle)) score += 55;

    const hits = titleTokens.filter((tok) => normCandTitle.includes(tok) || normCandFull.includes(tok)).length;
    const ratio = hits / titleTokens.length;
    if (ratio < 0.5) return { matched: false, score: -999 };
    score += Math.round(ratio * 50);
  }

  const targetArtistTokens = tokenizeNormalized(artist);
  if (targetArtistTokens.length > 0) {
    const artistHits = targetArtistTokens.filter((tok) => normCandFull.includes(tok)).length;
    if (artistHits === 0) {
      score -= 75;
    } else {
      score += Math.round((artistHits / targetArtistTokens.length) * 55);
    }
  }

  if (expectedDurationSec > 35 && candDurationSec > 0) {
    const diff = Math.abs(candDurationSec - expectedDurationSec);
    if (diff <= 4) score += 35;
    else if (diff <= 10) score += 20;
    else if (diff <= 15) score += 5;
    else score -= 25;
  }

  return { matched: score >= 35, score };
}

export async function verifyDirectAudioStream(url, headers = {}) {
  const res = await fetchWithTimeout(
    url,
    {
      headers: {
        Range: 'bytes=0-63',
        'User-Agent': 'Mozilla/5.0',
        ...headers,
      },
    },
    5500
  );
  if (!res.ok && res.status !== 206) return null;

  const buf = new Uint8Array(await res.arrayBuffer());
  const sniff = sniffAudioSignature(buf);
  if (!sniff.valid) return null;

  const cr = res.headers.get('content-range') || '';
  const rangeTotal = cr.match(/\/(\d+)$/);
  const clen = rangeTotal ? parseInt(rangeTotal[1], 10) : parseInt(res.headers.get('content-length') || '0', 10) || 0;
  if (clen > 0 && clen < 100_000) return null;

  return {
    mime: sniff.mime || res.headers.get('content-type') || 'audio/mp4',
    ext: sniff.ext || mimeToAudioExt(res.headers.get('content-type') || ''),
    clen,
  };
}

export async function extractViaMonochrome({ q = '', title = '', artist = '', expectedDurationSec = 0, explicitId = '' } = {}) {
  const monoMatch = String(explicitId || '').match(/^mono:(\d{10,25})$/);
  if (monoMatch) {
    const id = monoMatch[1];
    const cacheKey = `mono:${id}`;
    const cached = MONO_CACHE.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < 6 * 3600_000) return cached;

    const url = `https://tracks.monochrome.st/track/${id}`;
    const verified = await verifyDirectAudioStream(url).catch(() => null);
    if (verified) {
      const entry = {
        id: cacheKey,
        url,
        mime: verified.mime || 'audio/flac',
        ext: verified.ext || 'flac',
        clen: verified.clen,
        source: 'monochrome-flac',
        directCors: true,
        fetchedAt: Date.now(),
      };
      MONO_CACHE.set(cacheKey, entry);
      return entry;
    }
    return null;
  }

  const queries = Array.from(
    new Set(
      [
        `${stripMusicNoise(title)} ${artist}`.trim(),
        stripMusicNoise(q),
        `${title} ${artist}`.trim(),
        q.trim(),
      ].filter((s) => s && s.length >= 2)
    )
  ).slice(0, 2);

  for (const searchQ of queries) {
    const queryCacheKey = `q:${normalizeMusicText(searchQ)}:${expectedDurationSec}`;
    const cached = MONO_CACHE.get(queryCacheKey);
    if (cached && Date.now() - cached.fetchedAt < 6 * 3600_000) return cached;

    try {
      const res = await fetchWithTimeout(
        `https://tracks.monochrome.st/search/tracks?q=${encodeURIComponent(searchQ)}&limit=8`,
        { headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' } },
        5000
      );
      if (!res.ok) continue;
      const data = await res.json();
      const items = Array.isArray(data?.tracks) ? data.tracks : [];
      if (items.length === 0) continue;

      let best = null;
      let bestScore = -999;

      for (const item of items) {
        if (!item?.id || item.playable === false) continue;
        const candDurationSec = Math.round((Number(item.duration) || 0) / 1000);
        const candArtist = Array.isArray(item.artistNames) ? item.artistNames.join(' ') : '';
        const evalRes = scoreMusicCandidate(
          { candTitle: item.title || '', candArtist, candDurationSec },
          { title, artist, query: searchQ, expectedDurationSec }
        );
        if (evalRes.matched && evalRes.score > bestScore) {
          bestScore = evalRes.score;
          best = item;
        }
      }

      if (!best) continue;
      const trackUrl = `https://tracks.monochrome.st/track/${best.id}`;
      const verified = await verifyDirectAudioStream(trackUrl).catch(() => null);
      if (!verified) continue;

      const idKey = `mono:${best.id}`;
      const entry = {
        id: idKey,
        url: trackUrl,
        mime: verified.mime || 'audio/flac',
        ext: verified.ext || 'flac',
        clen: verified.clen,
        source: 'monochrome-flac',
        directCors: true,
        fetchedAt: Date.now(),
      };
      MONO_CACHE.set(idKey, entry);
      MONO_CACHE.set(queryCacheKey, entry);
      return entry;
    } catch {}
  }
  return null;
}

let SC_CLIENT_CACHE = { value: '', fetchedAt: 0 };

async function getSoundCloudClientId(force = false) {
  if (!force && SC_CLIENT_CACHE.value && Date.now() - SC_CLIENT_CACHE.fetchedAt < 6 * 3600_000) {
    return SC_CLIENT_CACHE.value;
  }
  try {
    const html = await fetchWithTimeout(
      'https://soundcloud.com/discover',
      { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } },
      4500
    ).then((r) => (r.ok ? r.text() : ''));
    const scripts = [...html.matchAll(/src="(https:\/\/a-v2\.sndcdn\.com\/assets\/[^"]+\.js)"/g)].map((m) => m[1]);
    for (const sUrl of scripts.slice(-5).reverse()) {
      const js = await fetchWithTimeout(sUrl, {}, 4000).then((r) => (r.ok ? r.text() : '')).catch(() => '');
      const m = js.match(/client_id\s*:\s*"([a-zA-Z0-9]{20,40})"/);
      if (m?.[1]) {
        SC_CLIENT_CACHE = { value: m[1], fetchedAt: Date.now() };
        return m[1];
      }
    }
  } catch {}
  return '';
}

export async function extractViaSoundCloud({ q = '', title = '', artist = '', expectedDurationSec = 0, explicitId = '' } = {}) {
  const scMatch = String(explicitId || '').match(/^sc:(\d+)$/);
  if (scMatch) {
    const cached = SC_TRACK_CACHE.get(`sc:${scMatch[1]}`);
    if (cached && Date.now() - cached.fetchedAt < 300_000) return cached;
  }

  const clientId = await getSoundCloudClientId();
  if (!clientId) return null;

  const searchQ = stripMusicNoise(`${title} ${artist}`.trim() || q);
  if (!searchQ) return null;

  try {
    const searchUrl = `https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(searchQ)}&client_id=${clientId}&limit=10`;
    let res = await fetchWithTimeout(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, 4500);
    if (res.status === 401 || res.status === 403) {
      const freshId = await getSoundCloudClientId(true);
      if (!freshId) return null;
      res = await fetchWithTimeout(
        `https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(searchQ)}&client_id=${freshId}&limit=10`,
        { headers: { 'User-Agent': 'Mozilla/5.0' } },
        4500
      );
    }
    if (!res.ok) return null;

    const data = await res.json();
    const items = Array.isArray(data?.collection) ? data.collection : [];

    const scored = [];
    for (const item of items) {
      if (!item?.id || item.policy === 'SNIP') continue;
      const transcodings = item.media?.transcodings || [];
      const prog = transcodings.find((x) => x.format?.protocol === 'progressive' && x.url);
      if (!prog) continue;
      const candDurationSec = Math.round((Number(item.duration) || 0) / 1000);
      const candArtist = item.user?.username || '';
      const evalRes = scoreMusicCandidate(
        { candTitle: item.title || '', candArtist, candDurationSec },
        { title, artist, query: searchQ, expectedDurationSec }
      );
      if (evalRes.matched) {
        scored.push({ item, prog, score: evalRes.score });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    for (const { item, prog } of scored.slice(0, 2)) {
      const activeCid = SC_CLIENT_CACHE.value || clientId;
      const trUrl = `${prog.url}?client_id=${activeCid}${item.track_authorization ? `&track_authorization=${encodeURIComponent(item.track_authorization)}` : ''}`;
      const streamMeta = await fetchWithTimeout(trUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, 4000)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
      if (!streamMeta?.url) continue;

      const verified = await verifyDirectAudioStream(streamMeta.url).catch(() => null);
      if (!verified) continue;

      const idKey = `sc:${item.id}`;
      const entry = {
        id: idKey,
        url: streamMeta.url,
        mime: verified.mime || 'audio/mpeg',
        ext: verified.ext || 'mp3',
        clen: verified.clen,
        source: 'soundcloud-mp3',
        directCors: false,
        fetchedAt: Date.now(),
      };
      SC_TRACK_CACHE.set(idKey, entry);
      return entry;
    }
  } catch {}
  return null;
}
