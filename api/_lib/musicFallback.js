/**
 * Shared datacenter-safe studio audio extraction, SoundCloud catalog search / HLS assembly,
 * official-vs-variant classification, and verified instrumental ("sin voces") discovery.
 */

const MONO_CACHE = new Map();
const SC_TRACK_CACHE = new Map();
const SC_HLS_BUFFER_CACHE = new Map();
const SC_HLS_MAX_ENTRIES = 4;

const UNWANTED_TAGS = ['karaoke', 'instrumental', 'tribute', 'backing track', '8d audio', 'slowed', 'sped up', 'nightcore', 'acapella', 'piano cover', 'guitar cover'];
const VARIANT_TAGS = ['remix', 'live', 'en vivo', 'acoustic', 'acustico'];

export const INSTRUMENTAL_MARKER_REGEX = /\b(instrumental|karaoke|sin\s+voces|sin\s+voz|no\s+vocals?|vocals?\s+removed|off\s+vocal|backing\s+track|accompaniment|tv\s+track|only\s+beat|beat\s+only|pista\s+original)\b/i;
const INSTRUMENTAL_DISQUALIFY_REGEX = /\b(acapella|a\s*capella|slowed|sped\s*up|speed\s*up|nightcore|8d\s*audio|piano\s+cover|guitar\s+cover|violin\s+cover|sax\s+cover|drum\s+cover|bass\s+cover|fingerstyle|ukulele|tutorial|reaction|reaccion|parodia|parody|medley|mashup)\b/i;

const SC_SLOWED_REGEX = /\b(slowed|reverb|sped\s*up|speed\s*up|nightcore|chopped|screwed|8d)\b/i;
const SC_LEAK_REGEX = /\b(unreleased|leak|leaked|inedita|inédita|demo|snippet|outtake|vault|unheard|filtrada|filtracion|filtración)\b/i;
const SC_REMIX_REGEX = /\b(remix|rmx|bootleg|flip|mashup|edit|vip|rework|club\s*mix|extended\s*mix|hardstyle|techno\s*mix)\b/i;
const SC_LIVE_REGEX = /\b(live|en\s*vivo|en\s*directo|session|sesión|concierto|festival|boiler\s*room|acoustic|acustico|acústico)\b/i;
const SC_NOISE_REGEX = /\b(white\s*noise|rain\s*sounds|podcast|audiobook|asmr|interview|entrevista|sleep\s*sounds|guided\s*meditation)\b/i;

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

/**
 * Validate whether an external candidate is genuinely an instrumental / "sin voces" track for a song.
 */
export function scoreInstrumentalCandidate(
  { candTitle = '', candArtist = '', candDurationSec = 0 },
  { title = '', artist = '', expectedDurationSec = 0 }
) {
  const fullRaw = `${candTitle} ${candArtist}`.trim();
  if (!INSTRUMENTAL_MARKER_REGEX.test(fullRaw)) {
    return { matched: false, score: -999 };
  }
  const origNorm = normalizeMusicText(`${title} ${artist}`);
  if (INSTRUMENTAL_DISQUALIFY_REGEX.test(fullRaw)) {
    const allowedByOrig = /\b(remix|acoustic|acustico)\b/i.test(origNorm);
    if (!allowedByOrig) return { matched: false, score: -999 };
  }
  if (/\b(remix|rmx|mashup|edit|live|en\s*vivo)\b/i.test(fullRaw) && !/\b(remix|rmx|live|en\s*vivo)\b/i.test(origNorm)) {
    return { matched: false, score: -999 };
  }
  if (candDurationSec > 0 && candDurationSec < 45 && !(expectedDurationSec > 0 && expectedDurationSec < 45)) {
    return { matched: false, score: -999 };
  }
  if (expectedDurationSec > 35 && candDurationSec > 0 && Math.abs(candDurationSec - expectedDurationSec) > 18) {
    return { matched: false, score: -999 };
  }

  const normCand = normalizeMusicText(fullRaw);
  const titleTokens = tokenizeNormalized(stripMusicNoise(title));
  if (titleTokens.length > 0) {
    const hits = titleTokens.filter((tok) => normCand.includes(tok)).length;
    if (hits / titleTokens.length < 0.6) return { matched: false, score: -999 };
  }

  let score = 50;
  if (/\b(official\s*instrumental|instrumental\s*oficial|sin\s+voces|backing\s+track|off\s+vocal)\b/i.test(fullRaw)) score += 30;
  else if (/\bkaraoke\b/i.test(fullRaw)) score += 10;

  const artistTokens = tokenizeNormalized(artist);
  if (artistTokens.length > 0) {
    const artistHits = artistTokens.filter((tok) => normCand.includes(tok)).length;
    if (artistHits > 0) score += Math.round((artistHits / artistTokens.length) * 35);
    else score -= 20;
  }

  if (expectedDurationSec > 35 && candDurationSec > 0) {
    const diff = Math.abs(candDurationSec - expectedDurationSec);
    if (diff <= 3) score += 35;
    else if (diff <= 8) score += 20;
    else if (diff <= 14) score += 5;
    else score -= 15;
  }

  return { matched: score >= 55, score };
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

/**
 * Search Monochrome specifically for an instrumental / "sin voces" track.
 */
export async function findInstrumentalOnMonochrome({ title = '', artist = '', expectedDurationSec = 0 } = {}) {
  const cleanT = stripMusicNoise(title);
  if (!cleanT) return null;
  const searchQ = `${cleanT} instrumental`.trim();
  try {
    const res = await fetchWithTimeout(
      `https://tracks.monochrome.st/search/tracks?q=${encodeURIComponent(searchQ)}&limit=8`,
      { headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' } },
      4000
    );
    if (!res.ok) return null;
    const data = await res.json();
    const items = Array.isArray(data?.tracks) ? data.tracks : [];
    let best = null;
    let bestScore = -999;
    for (const item of items) {
      if (!item?.id || item.playable === false) continue;
      const candDurationSec = Math.round((Number(item.duration) || 0) / 1000);
      const candArtist = Array.isArray(item.artistNames) ? item.artistNames.join(' ') : '';
      const ev = scoreInstrumentalCandidate(
        { candTitle: item.title || '', candArtist, candDurationSec },
        { title, artist, expectedDurationSec }
      );
      if (ev.matched && ev.score > bestScore) {
        bestScore = ev.score;
        best = {
          sourceId: `mono:${item.id}`,
          title: item.title || '',
          artist: candArtist || artist,
          durationSec: candDurationSec,
          score: ev.score,
          provider: 'monochrome',
        };
      }
    }
    return best;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// SoundCloud Dynamic Client, Progressive + HLS fMP4 Extractor, Classifier & Catalog
// ---------------------------------------------------------------------------
let SC_CLIENT_CACHE = { value: '', fetchedAt: 0 };
let SC_CLIENT_INFLIGHT = null;

export async function getSoundCloudClientId(force = false) {
  if (!force && SC_CLIENT_CACHE.value && Date.now() - SC_CLIENT_CACHE.fetchedAt < 6 * 3600_000) {
    return SC_CLIENT_CACHE.value;
  }
  if (!force && SC_CLIENT_INFLIGHT) {
    return SC_CLIENT_INFLIGHT;
  }
  const job = (async () => {
    try {
      const html = await fetchWithTimeout(
        'https://soundcloud.com/discover',
        { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } },
        4500
      ).then((r) => (r.ok ? r.text() : ''));
      const scripts = [...html.matchAll(/src="(https:\/\/a-v2\.sndcdn\.com\/assets\/[^"]+\.js)"/g)].map((m) => m[1]);
      for (const sUrl of scripts.slice(-6).reverse()) {
        const js = await fetchWithTimeout(sUrl, {}, 4000).then((r) => (r.ok ? r.text() : '')).catch(() => '');
        const m = js.match(/client_id\s*:\s*"([a-zA-Z0-9]{20,40})"/);
        if (m?.[1]) {
          SC_CLIENT_CACHE = { value: m[1], fetchedAt: Date.now() };
          return m[1];
        }
      }
    } catch {}
    return '';
  })();
  SC_CLIENT_INFLIGHT = job;
  try {
    return await job;
  } finally {
    if (SC_CLIENT_INFLIGHT === job) SC_CLIENT_INFLIGHT = null;
  }
}

async function fetchSoundCloudJson(urlBuilder) {
  let cid = await getSoundCloudClientId();
  if (!cid) return null;
  let res = await fetchWithTimeout(urlBuilder(cid), { headers: { 'User-Agent': 'Mozilla/5.0' } }, 4500);
  if (res.status === 401 || res.status === 403) {
    cid = await getSoundCloudClientId(true);
    if (!cid) return null;
    res = await fetchWithTimeout(urlBuilder(cid), { headers: { 'User-Agent': 'Mozilla/5.0' } }, 4500);
  }
  if (!res.ok) return null;
  return res.json();
}

function selectSoundCloudTranscoding(item) {
  const transcodings = item?.media?.transcodings || [];
  const prog = transcodings.find((x) => x?.format?.protocol === 'progressive' && x?.url);
  if (prog) return { transcoding: prog, mode: 'progressive' };

  const hlsMp4 =
    transcodings.find((x) => x?.format?.protocol === 'hls' && String(x?.preset || '').includes('160k') && String(x?.format?.mime_type || '').includes('mp4') && x?.url) ||
    transcodings.find((x) => x?.format?.protocol === 'hls' && String(x?.format?.mime_type || '').includes('mp4') && x?.url);
  if (hlsMp4) return { transcoding: hlsMp4, mode: 'hls-fmp4' };

  return null;
}

function storeHlsBuffer(cacheKey, buf) {
  SC_HLS_BUFFER_CACHE.delete(cacheKey);
  while (SC_HLS_BUFFER_CACHE.size >= SC_HLS_MAX_ENTRIES) {
    const oldestKey = SC_HLS_BUFFER_CACHE.keys().next().value;
    if (oldestKey) SC_HLS_BUFFER_CACHE.delete(oldestKey);
    else break;
  }
  SC_HLS_BUFFER_CACHE.set(cacheKey, { buf, fetchedAt: Date.now() });
}

export function getCachedSoundCloudHlsBuffer(cacheKey) {
  const entry = SC_HLS_BUFFER_CACHE.get(cacheKey);
  if (entry && Date.now() - entry.fetchedAt < 3600_000) {
    return entry.buf;
  }
  return null;
}

// Background prewarm client ID immediately so first track doesn't pay discovery penalty
if (typeof setTimeout !== 'undefined') {
  setTimeout(() => {
    getSoundCloudClientId().catch(() => {});
  }, 250);
}

async function fetchSoundCloudHlsBuffer(m3u8Url, cacheKey) {
  const existing = getCachedSoundCloudHlsBuffer(cacheKey);
  if (existing) return existing;

  const m3u8Text = await fetchWithTimeout(m3u8Url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, 3500).then((r) => (r.ok ? r.text() : ''));
  if (!m3u8Text || /#EXT-X-KEY/i.test(m3u8Text)) return null;

  const mapMatch = m3u8Text.match(/#EXT-X-MAP:URI="([^"]+)"/i);
  const segUrls = m3u8Text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));

  if (!mapMatch?.[1] || segUrls.length === 0 || segUrls.length > 160) return null;

  const allUrls = [mapMatch[1], ...segUrls];
  const fetchSegOnce = async (u, idx) => {
    for (let attempt = 0; attempt < 2; attempt++) {
      const buf = await fetchWithTimeout(u, { headers: { 'User-Agent': 'Mozilla/5.0' } }, 3500)
        .then((r) => (r.ok ? r.arrayBuffer().then((ab) => Buffer.from(ab)) : null))
        .catch(() => null);
      if (buf && buf.length > 0) return { idx, buf };
    }
    return { idx, buf: null };
  };

  // Full parallel segment fetching across all audio chunks
  const results = await Promise.all(allUrls.map((u, idx) => fetchSegOnce(u, idx)));
  if (results.some((r) => !r.buf || r.buf.length === 0)) return null;

  const parts = results.sort((a, b) => a.idx - b.idx).map((r) => r.buf);
  const fullBuf = Buffer.concat(parts);
  const sniff = sniffAudioSignature(fullBuf.subarray(0, 32));
  if (!sniff.valid || fullBuf.length < 100_000) return null;

  storeHlsBuffer(cacheKey, fullBuf);
  return fullBuf;
}

async function resolveSoundCloudItemToStream(item) {
  if (!item?.id || item.policy === 'SNIP') return null;
  const durSec = Math.round((Number(item.duration) || 0) / 1000);
  if (durSec > 0 && durSec < 45) return null;

  const picked = selectSoundCloudTranscoding(item);
  if (!picked) return null;

  const streamMeta = await fetchSoundCloudJson(
    (cid) => `${picked.transcoding.url}?client_id=${cid}${item.track_authorization ? `&track_authorization=${encodeURIComponent(item.track_authorization)}` : ''}`
  ).catch(() => null);
  if (!streamMeta?.url) return null;

  const idKey = `sc:${item.id}`;

  if (picked.mode === 'progressive') {
    const verified = await verifyDirectAudioStream(streamMeta.url).catch(() => null);
    if (!verified) return null;
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

  // HLS fMP4: assemble init segment + media segments cleanly into contiguous audio/mp4
  const fullBuf = await fetchSoundCloudHlsBuffer(streamMeta.url, idKey);
  if (!fullBuf) return null;

  const entry = {
    id: idKey,
    url: `sc-hls:${item.id}`,
    streamBuffer: fullBuf,
    mime: 'audio/mp4',
    ext: 'm4a',
    clen: fullBuf.length,
    source: 'soundcloud-hls',
    directCors: false,
    fetchedAt: Date.now(),
  };
  SC_TRACK_CACHE.set(idKey, entry);
  return entry;
}

export async function extractViaSoundCloud({ q = '', title = '', artist = '', expectedDurationSec = 0, explicitId = '' } = {}) {
  const scMatch = String(explicitId || '').match(/^sc[:\-](\d+)$/);
  if (scMatch) {
    const trackNum = scMatch[1];
    const idKey = `sc:${trackNum}`;
    const cached = SC_TRACK_CACHE.get(idKey);
    if (cached && Date.now() - cached.fetchedAt < 3600_000) {
      if (cached.streamBuffer || !String(cached.url).startsWith('sc-hls:')) return cached;
      const buf = getCachedSoundCloudHlsBuffer(idKey);
      if (buf) return { ...cached, streamBuffer: buf };
    }

    try {
      const item = await fetchSoundCloudJson((cid) => `https://api-v2.soundcloud.com/tracks/${trackNum}?client_id=${cid}`);
      if (item?.id) {
        const directEntry = await resolveSoundCloudItemToStream(item);
        if (directEntry) return directEntry;
      }
    } catch {}
    return null;
  }

  const searchQ = stripMusicNoise(`${title} ${artist}`.trim() || q);
  if (!searchQ) return null;

  try {
    const data = await fetchSoundCloudJson(
      (cid) => `https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(searchQ)}&client_id=${cid}&limit=10`
    );
    const items = Array.isArray(data?.collection) ? data.collection : [];

    const scored = [];
    for (const item of items) {
      if (!item?.id || item.policy === 'SNIP' || !selectSoundCloudTranscoding(item)) continue;
      const candDurationSec = Math.round((Number(item.duration) || 0) / 1000);
      const candArtist = item.user?.username || '';
      const evalRes = scoreMusicCandidate(
        { candTitle: item.title || '', candArtist, candDurationSec },
        { title, artist, query: searchQ, expectedDurationSec }
      );
      if (evalRes.matched) {
        scored.push({ item, score: evalRes.score });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    for (const { item } of scored.slice(0, 2)) {
      const entry = await resolveSoundCloudItemToStream(item);
      if (entry) return entry;
    }
  } catch {}
  return null;
}

export async function findInstrumentalOnSoundCloud({ title = '', artist = '', expectedDurationSec = 0 } = {}) {
  const cleanT = stripMusicNoise(title);
  if (!cleanT) return null;
  const queries = [`${cleanT} ${artist} instrumental`.trim(), `${cleanT} karaoke`.trim()];

  let best = null;
  let bestScore = -999;

  for (const searchQ of queries) {
    try {
      const data = await fetchSoundCloudJson(
        (cid) => `https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(searchQ)}&client_id=${cid}&limit=8`
      );
      const items = Array.isArray(data?.collection) ? data.collection : [];
      for (const item of items) {
        if (!item?.id || item.policy === 'SNIP' || !selectSoundCloudTranscoding(item)) continue;
        const candDurationSec = Math.round((Number(item.duration) || 0) / 1000);
        const candArtist = item.user?.username || '';
        const ev = scoreInstrumentalCandidate(
          { candTitle: item.title || '', candArtist, candDurationSec },
          { title, artist, expectedDurationSec }
        );
        if (ev.matched && ev.score > bestScore) {
          bestScore = ev.score;
          best = {
            sourceId: `sc:${item.id}`,
            title: item.title || '',
            artist: candArtist || artist,
            durationSec: candDurationSec,
            score: ev.score,
            provider: 'soundcloud',
          };
        }
      }
      if (best && bestScore >= 95) break;
    } catch {}
  }

  return best;
}

// ---------------------------------------------------------------------------
// SoundCloud Variant Classifier, Catalog Search & Artist Vault Builder
// ---------------------------------------------------------------------------
export function normalizeSoundCloudArtwork(url = '') {
  if (!url || typeof url !== 'string') return '';
  return url
    .replace('-large.', '-t500x500.')
    .replace('-t200x200.', '-t500x500.')
    .replace('-crop.', '-t500x500.');
}

export function classifySoundCloudVariant(trackTitle = '', tagList = '', genre = '') {
  const raw = `${trackTitle} ${tagList} ${genre}`.trim();
  if (INSTRUMENTAL_MARKER_REGEX.test(trackTitle)) return { variant: 'instrumental', label: 'Sin voces' };
  if (SC_SLOWED_REGEX.test(raw)) return { variant: 'slowed', label: 'Slowed / Sped Up' };
  if (SC_LEAK_REGEX.test(raw)) return { variant: 'leak', label: 'Inédita / Leak' };
  if (SC_REMIX_REGEX.test(raw)) return { variant: 'remix', label: 'Remix' };
  if (SC_LIVE_REGEX.test(raw)) return { variant: 'live', label: 'En vivo' };
  return { variant: 'official_like', label: 'SoundCloud' };
}

function cleanOfficialCompareTitle(str = '') {
  return normalizeMusicText(
    String(str)
      .replace(/\s*[\[(][^)\]]*(feat\.?|ft\.?|official|audio|video|remaster|explicit|bonus|version|remix)[^)\]]*[\])]/gi, '')
      .replace(/\s*[-–—]\s*(remaster|radio edit|single version|bonus track).*$/gi, '')
  );
}

/**
 * Checks whether a SoundCloud track literally duplicates one of the official catalog tracks.
 * Returns matching official track index or -1.
 */
export function findMatchingOfficialTrackIndex(scItem, officialTracks = []) {
  if (!scItem || !Array.isArray(officialTracks) || officialTracks.length === 0) return -1;
  const cls = classifySoundCloudVariant(scItem.title || '', scItem.tag_list || '', scItem.genre || '');
  if (cls.variant !== 'official_like') return -1;

  const scNormTitle = cleanOfficialCompareTitle(scItem.title || '');
  if (!scNormTitle) return -1;
  const scUploader = normalizeMusicText(scItem.user?.username || '');
  const scDurSec = Math.round((Number(scItem.duration) || 0) / 1000);

  for (let i = 0; i < officialTracks.length; i++) {
    const off = officialTracks[i];
    if (!off?.name) continue;
    const offTitle = cleanOfficialCompareTitle(off.name || '');
    const offArtist = normalizeMusicText(off.artists?.[0]?.name || '');
    const offDurSec = Math.round((Number(off.duration_ms) || 0) / 1000);

    if (!offTitle) continue;
    const titleAligned =
      scNormTitle === offTitle ||
      scNormTitle === `${offArtist} ${offTitle}`.trim() ||
      scNormTitle === `${offTitle} ${offArtist}`.trim() ||
      (scNormTitle.includes(offTitle) && (!offArtist || scNormTitle.includes(offArtist) || scUploader.includes(offArtist)));
    if (!titleAligned) continue;

    if (offDurSec > 35 && scDurSec > 35 && Math.abs(scDurSec - offDurSec) > 14) continue;

    const artistMatch =
      !offArtist ||
      scUploader.includes(offArtist) ||
      offArtist.includes(scUploader) ||
      scNormTitle.includes(offArtist);

    if (artistMatch) return i;
  }
  return -1;
}

export function scItemToSpotifreeTrack(item, variantInfo = null) {
  const cls = variantInfo || classifySoundCloudVariant(item.title || '', item.tag_list || '', item.genre || '');
  const cover = normalizeSoundCloudArtwork(item.artwork_url || item.user?.avatar_url || '');
  const artistName = String(item.user?.username || 'SoundCloud').trim() || 'SoundCloud';
  const durationMs = Math.max(45000, Number(item.duration) || 180000);

  return {
    id: `sc-${item.id}`,
    name: String(item.title || 'SoundCloud Track').trim(),
    duration_ms: durationMs,
    preview_url: null,
    artists: [{ id: `sc-art-${item.user?.id || 'sc'}`, name: artistName }],
    album: {
      id: `sc-alb-${item.id}`,
      name: cls.label && cls.label !== 'SoundCloud' ? cls.label : 'Versión alternativa',
      images: cover ? [{ url: cover }] : [],
    },
    scVariant: cls.variant,
    scVariantLabel: cls.label && cls.label !== 'SoundCloud' ? cls.label : 'Versión alternativa',
    scUrl: item.permalink_url || undefined,
    source: 'soundcloud',
  };
}

export async function searchSoundCloudCatalog(
  query,
  { limit = 16, officialTracks = [], includeOfficialDuplicates = false, artistFilter = '' } = {}
) {
  const cleanQ = String(query || '').trim();
  if (!cleanQ) return { tracks: [], officialAltIds: {} };

  try {
    const data = await fetchSoundCloudJson(
      (cid) => `https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(cleanQ)}&client_id=${cid}&limit=${Math.min(30, limit + 10)}`
    );
    const items = Array.isArray(data?.collection) ? data.collection : [];

    const officialAltIds = {};
    const out = [];
    const seenNorm = new Set();
    const artistTokens = tokenizeNormalized(artistFilter);

    for (const item of items) {
      if (!item?.id || item.policy === 'SNIP' || !selectSoundCloudTranscoding(item)) continue;
      const durSec = Math.round((Number(item.duration) || 0) / 1000);
      if (durSec < 45 || durSec > 900) continue; // Keep genuine songs/remixes (exclude 2h podcasts/long sets)

      const rawCombined = `${item.title || ''} ${item.user?.username || ''} ${item.genre || ''}`;
      if (SC_NOISE_REGEX.test(rawCombined)) continue;

      if (artistTokens.length > 0) {
        const hay = normalizeMusicText(`${item.title || ''} ${item.user?.username || ''} ${item.tag_list || ''} ${item.description || ''}`);
        const matchesArtist = artistTokens.every((t) => hay.includes(t)) || (artistTokens.length >= 2 && artistTokens.filter((t) => hay.includes(t)).length >= Math.ceil(artistTokens.length * 0.75));
        if (!matchesArtist) continue;
      }

      const dupIdx = findMatchingOfficialTrackIndex(item, officialTracks);
      if (dupIdx >= 0) {
        const offId = officialTracks[dupIdx]?.id;
        if (offId && !officialAltIds[offId]) {
          officialAltIds[offId] = `sc:${item.id}`;
        }
        if (!includeOfficialDuplicates) continue;
      }

      const normKey = normalizeMusicText(`${item.title || ''} ${item.user?.username || ''}`);
      if (!normKey || seenNorm.has(normKey)) continue;
      seenNorm.add(normKey);

      out.push(scItemToSpotifreeTrack(item));
      if (out.length >= limit) break;
    }

    return { tracks: out, officialAltIds };
  } catch {
    return { tracks: [], officialAltIds: {} };
  }
}

export async function resolveSoundCloudUrl(rawUrl = '') {
  const cleanUrl = String(rawUrl || '').trim();
  if (!/^https?:\/\/(www\.|m\.|on\.)?soundcloud\.com\//i.test(cleanUrl)) return null;

  try {
    const resolved = await fetchSoundCloudJson(
      (cid) => `https://api-v2.soundcloud.com/resolve?url=${encodeURIComponent(cleanUrl)}&client_id=${cid}`
    );
    if (!resolved) return null;

    if (resolved.kind === 'track' && resolved.id) {
      if (resolved.policy === 'SNIP' || !selectSoundCloudTranscoding(resolved)) return null;
      return { kind: 'track', track: scItemToSpotifreeTrack(resolved) };
    }

    if (resolved.kind === 'playlist' && Array.isArray(resolved.tracks)) {
      const tracks = resolved.tracks
        .filter((t) => t?.id && t.policy !== 'SNIP' && selectSoundCloudTranscoding(t))
        .map((t) => scItemToSpotifreeTrack(t));
      const cover = normalizeSoundCloudArtwork(resolved.artwork_url || resolved.user?.avatar_url || tracks[0]?.album?.images?.[0]?.url || '');
      return {
        kind: 'playlist',
        playlist: {
          id: `sc-pl-${resolved.id}`,
          name: resolved.title || 'Playlist de SoundCloud',
          description: `SoundCloud • ${tracks.length} canciones`,
          type: 'playlist',
          images: cover ? [{ url: cover }] : [],
          owner: {
            display_name: resolved.user?.username || 'SoundCloud',
            id: `sc-art-${resolved.user?.id || 'sc'}`,
          },
          tracks: { total: tracks.length, items: tracks },
        },
      };
    }
  } catch {}
  return null;
}

/**
 * Builds an artist "Remixes, Slowed, Oficiales & Leaks" SoundCloud Vault playlist,
 * automatically deduplicating official originals while preserving scAltIds as extra sources.
 */
export async function buildArtistSoundCloudVault(artistName = '') {
  const cleanName = String(artistName || '').trim();
  if (!cleanName) return null;

  const [dzOfficialRes, leakRes, remixRes, generalRes] = await Promise.all([
    fetchWithTimeout(
      `https://api.deezer.com/search?q=artist:"${encodeURIComponent(cleanName)}"&limit=10`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } },
      3500
    )
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .catch(() => ({ data: [] })),
    searchSoundCloudCatalog(`${cleanName} unreleased leak`, { limit: 12, artistFilter: cleanName }),
    searchSoundCloudCatalog(`${cleanName} remix slowed`, { limit: 14, artistFilter: cleanName }),
    searchSoundCloudCatalog(`${cleanName}`, { limit: 14, artistFilter: cleanName }),
  ]);

  const officialTracks = (dzOfficialRes?.data || []).slice(0, 6).map((t) => {
    const cover = t.album?.cover_xl || t.album?.cover_big || t.album?.cover_medium || '';
    return {
      id: `dz-${t.id}`,
      name: t.title || t.title_short,
      duration_ms: (t.duration || 210) * 1000,
      preview_url: null,
      artists: [{ id: `art-${t.artist?.id || 'dz'}`, name: t.artist?.name || cleanName }],
      album: {
        id: `alb-${t.album?.id || 'dz'}`,
        name: t.album?.title || t.title,
        images: cover ? [{ url: cover }] : [],
      },
      scVariantLabel: 'Oficial',
    };
  });

  // Deduplicate SoundCloud pool against official tracks (exact official dupes only attach as alt source)
  const rawPool = [...leakRes.tracks, ...remixRes.tracks, ...generalRes.tracks];
  const scTracks = [];
  const seenScIds = new Set();
  const seenScTitles = new Set();

  for (const scT of rawPool) {
    if (!scT?.id || seenScIds.has(scT.id)) continue;
    const fakeScObj = {
      id: scT.id.replace(/^sc-/, ''),
      title: scT.name,
      user: { username: scT.artists?.[0]?.name || '' },
      duration: scT.duration_ms,
      tag_list: scT.album?.name || '',
    };
    const dupIdx = findMatchingOfficialTrackIndex(fakeScObj, officialTracks);
    if (dupIdx >= 0) {
      if (!(officialTracks[dupIdx]).scAltId) {
        (officialTracks[dupIdx]).scAltId = `sc:${fakeScObj.id}`;
      }
      continue;
    }
    const normT = normalizeMusicText(scT.name);
    if (!normT || seenScTitles.has(normT)) continue;
    seenScIds.add(scT.id);
    seenScTitles.add(normT);
    scTracks.push(scT);
  }

  // Only include genuine variants: Leaks, Remixes, Slowed, Instrumental or Live.
  // Unedited normal songs from SoundCloud are discarded; the original official tracks are used instead.
  const isRealVariant = (t) => {
    if (!t) return false;
    if (t.scVariant === 'leak' || t.scVariant === 'remix' || t.scVariant === 'slowed' || t.scVariant === 'instrumental' || t.scVariant === 'live') {
      return true;
    }
    const n = (t.name || '').toLowerCase();
    return /\b(remix|slowed|reverb|leak|unreleased|in[eé]dita|ac[uú]stic[ao]|sped up|live|en vivo|mashup|instrumental)\b/i.test(n);
  };

  const leaks = scTracks.filter((t) => t.scVariant === 'leak' || /\b(leak|unreleased|in[eé]dita)\b/i.test(t.name || ''));
  const remixesSlowed = scTracks.filter(
    (t) => (t.scVariant === 'remix' || t.scVariant === 'slowed') || /\b(remix|slowed|sped up|reverb|mashup)\b/i.test(t.name || '')
  );
  const otherVariants = scTracks.filter(
    (t) => isRealVariant(t) && !leaks.includes(t) && !remixesSlowed.includes(t)
  );

  // Pure collection: genuine modifications + real official studio originals with authentic album names
  const combined = [...remixesSlowed.slice(0, 12), ...leaks.slice(0, 10), ...otherVariants.slice(0, 4), ...officialTracks.slice(0, 6)].slice(0, 30);
  if (combined.length === 0) return null;

  const coverImg =
    remixesSlowed.find((t) => t.album?.images?.[0]?.url)?.album?.images?.[0]?.url ||
    officialTracks.find((t) => t.album?.images?.[0]?.url)?.album?.images?.[0]?.url ||
    combined[0]?.album?.images?.[0]?.url ||
    '';

  return {
    id: `sc-vault-${encodeURIComponent(cleanName)}`,
    name: `${cleanName}: Remixes, Leaks y Slowed`,
    description: `${remixesSlowed.length + otherVariants.length} remixes/versiones, ${leaks.length} inéditas y temas oficiales`,
    type: 'playlist',
    images: coverImg ? [{ url: coverImg }] : [],
    owner: { display_name: 'Spotifree', id: 'spotifree' },
    tracks: { total: combined.length, items: combined },
  };
}
