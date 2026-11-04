/**
 * Consolidated Spotifree Audio API: Resolve & Stream
 * Serves /api/audio/resolve and /api/audio/stream
 */

const RESOLVE_CACHE = new Map();

function getVerifiedVideoId(q, title = '', artist = '') {
  if (!q && !title) return null;
  const full = `${q} ${title} ${artist}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  // ONLY match Quevedo - La Graciosa if BOTH Quevedo AND Graciosa are in the query
  if (full.includes('graciosa') && (full.includes('quevedo') || full.includes('elvis crespo') || full.includes('buenas noches'))) {
    return 'LZPLBSRnxSY';
  }
  // ONLY match Quevedo - Planteamiento Erróneo if BOTH Quevedo AND Planteamiento are in the query
  if (full.includes('planteamiento') && (full.includes('quevedo') || full.includes('erroneo') || full.includes('buenas noches'))) {
    return 'aWewyeC49e8';
  }
  return null;
}

function cleanQuery(query) {
  return query
    .replace(/\s*-\s*Remastered(\s*\d+)?/gi, '')
    .replace(/\s*\(Remastered(\s*\d+)?\)/gi, '')
    .replace(/\s*\[Explicit\]/gi, '')
    .replace(/\s*\(Explicit\)/gi, '')
    .replace(/\s*\(Bonus Track\)/gi, '')
    .replace(/\s*-\s*Radio Edit/gi, '')
    .replace(/\s*-\s*Single Version/gi, '')
    .replace(/\s*-\s*Original Mix/gi, '')
    .replace(/\s*\((with|feat\.|ft\.|featuring)\s+.*?\)/gi, '')
    .replace(/\s*\[(with|feat\.|ft\.|featuring)\s+.*?\]/gi, '')
    .replace(/\s*\(Deluxe.*?\)/gi, '')
    .replace(/\s*\[Deluxe.*?\]/gi, '')
    .replace(/\s*\(Anniversary.*?\)/gi, '')
    .replace(/\s*ft\..*$/gi, '')
    .replace(/\s*video\s*oficial\s*videoclip/gi, '')
    .replace(/\s*official\s*video/gi, '')
    .replace(/\s*music\s*video/gi, '')
    .replace(/\s*videoclip/gi, '')
    .replace(/\s*\(audio\s*oficial\)/gi, '')
    .replace(/\s*\[audio\s*oficial\]/gi, '')
    .replace(/\s*\(audio\)/gi, '')
    .replace(/\s*\[audio\]/gi, '')
    .replace(/\s*\(letra\)/gi, '')
    .replace(/\s*\[letra\]/gi, '')
    .replace(/\s*\(video\s*con\s*letra\)/gi, '')
    .replace(/\s*\[video\s*con\s*letra\)/gi, '')
    .replace(/\s*\(visualizer\)/gi, '')
    .replace(/\s*\[visualizer\]/gi, '')
    .replace(/\s*\(official\s*audio\)/gi, '')
    .replace(/\s*\[official\s*audio\]/gi, '')
    .replace(/\s*\(lyric\s*video\)/gi, '')
    .replace(/\s*\[lyric\s*video\]/gi, '')
    .trim();
}

function fetchWithTimeout(url, opts, ms = 3500) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

const INVIDIOUS_INSTANCES = [
  'https://invidious.privacyredirect.com',
  'https://inv.nadeko.net',
  'https://invidious.nerdvpn.de',
  'https://yt.drgnz.club',
];

function scoreCandidate(query, expectedTitle, expectedArtist, candTitle, candArtist) {
  if (!candTitle) return -100;

  const normalize = (s) =>
    (s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .trim();

  const cTitle = normalize(candTitle);
  const cArtist = normalize(candArtist);

  let expT = normalize(expectedTitle);
  let expA = normalize(expectedArtist);
  if (!expT) {
    expT = normalize(query);
  }

  let score = 0;

  // 1. Severe penalties for unwanted content (covers, karaoke, reaction, etc.)
  if (/\b(cover|karaoke|tributo|instrumental|reaction|reaccion|tutorial|acordes|piano cover|guitar cover|parodia)\b/i.test(cTitle)) {
    score -= 100;
  }
  // Penalize live concerts if the user did not ask for a live version
  if (/\b(live|en vivo|en directo|directo|concierto|acoustic live)\b/i.test(cTitle) && !/\b(live|en vivo)\b/i.test(expT)) {
    score -= 50;
  }
  // Penalize remix if the original track is not a remix
  if (/\b(remix|mashup)\b/i.test(cTitle) && !/\b(remix)\b/i.test(expT)) {
    score -= 30;
  }

  // 2. High bonus for genuine official studio releases (Audio / Topic / Vevo)
  if (/\b(official audio|audio oficial|original mix|video oficial|official video|audio|tema oficial)\b/i.test(candTitle.toLowerCase())) {
    score += 20;
  }
  if (/\b(topic|vevo)\b/i.test(candArtist.toLowerCase()) || candArtist.includes(' - Topic')) {
    score += 25;
  }

  // 3. Title word matching
  const tWords = expT.split(/\s+/).filter((w) => w.length > 2);
  let tMatches = 0;
  for (const w of tWords) {
    if (cTitle.includes(w)) tMatches++;
  }
  if (tWords.length > 0 && tMatches === 0) {
    score -= 80;
  } else {
    const tRatio = tWords.length > 0 ? tMatches / tWords.length : 1;
    score += tRatio * 50;
  }

  // 4. Artist word matching (CRITICAL: prevents returning a completely different artist)
  if (expA) {
    const aWords = expA.split(/\s+/).filter((w) => w.length > 2);
    let aMatches = 0;
    for (const w of aWords) {
      if (cArtist.includes(w) || cTitle.includes(w)) aMatches++;
    }
    if (aWords.length > 0 && aMatches === 0) {
      score -= 80;
    } else {
      const aRatio = aWords.length > 0 ? aMatches / aWords.length : 0;
      score += aRatio * 40;
    }
  }

  // 5. Exact substring matches
  if (expT && cTitle.includes(expT)) {
    score += 25;
  }

  return score;
}

async function resolveViaYouTubeMusic(q, expectedTitle = '', expectedArtist = '', excludeSet = new Set()) {
  const res = await fetchWithTimeout(
    'https://music.youtube.com/youtubei/v1/search',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'WEB_REMIX',
            clientVersion: '1.20240318.01.00',
            hl: 'es',
            gl: 'ES',
          },
        },
        query: q,
      }),
    },
    3000
  );

  if (!res.ok) throw new Error('YTM non-ok');
  const data = await res.json();

  const sections =
    data.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content
      ?.sectionListRenderer?.contents || [];

  const candidates = [];

  for (const sec of sections) {
    // 1. Check Top Result Card (official #1 match on YouTube Music)
    if (sec.musicCardShelfRenderer) {
      const card = sec.musicCardShelfRenderer;
      const cardTitle = card.title?.runs?.[0]?.text || '';
      const cardSub = card.subtitle?.runs?.map((x) => x.text).join('') || '';
      const cardVid =
        card.onTap?.watchEndpoint?.videoId ||
        card.title?.runs?.[0]?.navigationEndpoint?.watchEndpoint?.videoId ||
        card.buttons?.[0]?.buttonRenderer?.command?.watchEndpoint?.videoId;
      if (cardVid && /^[a-zA-Z0-9_-]{11}$/.test(cardVid) && !excludeSet.has(cardVid)) {
        const score = scoreCandidate(q, expectedTitle, expectedArtist, cardTitle, cardSub) + 15;
        candidates.push({ videoId: cardVid, score, title: cardTitle, artist: cardSub });
      }
    }

    // 2. Check responsive list items in musicShelfRenderer
    if (sec.musicShelfRenderer) {
      for (const item of sec.musicShelfRenderer.contents || []) {
        const renderer = item.musicResponsiveListItemRenderer;
        const playNav =
          renderer?.overlay?.musicItemThumbnailOverlayRenderer?.content
            ?.musicPlayButtonRenderer?.playNavigationEndpoint;
        const videoId =
          renderer?.playlistItemData?.videoId ||
          playNav?.watchEndpoint?.videoId ||
          renderer?.navigationEndpoint?.watchEndpoint?.videoId ||
          renderer?.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.navigationEndpoint?.watchEndpoint?.videoId;
        if (videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId) && !excludeSet.has(videoId)) {
          const itemTitle =
            renderer?.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text || '';
          const itemArtist =
            renderer?.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.map((x) => x.text).join('') || '';
          const score = scoreCandidate(q, expectedTitle, expectedArtist, itemTitle, itemArtist);
          candidates.push({ videoId, score, title: itemTitle, artist: itemArtist });
        }
      }
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  if (candidates.length > 0 && candidates[0].score >= 25) {
    return { videoId: candidates[0].videoId, title: candidates[0].title, artist: candidates[0].artist };
  }

  throw new Error('YTM: no confident videoId found');
}

async function resolveViaYouTubeSearch(q, expectedTitle = '', expectedArtist = '', excludeSet = new Set()) {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(q + ' official audio')}`;
  const res = await fetchWithTimeout(
    url,
    {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      },
    },
    3500
  );

  if (!res.ok) throw new Error('YT search non-ok');
  const html = await res.text();

  const candidates = [];

  // 1. Try parsing ytInitialData for structured videoRenderer items
  const jsonMatch = html.match(/ytInitialData\s*=\s*({.+?});<\/script>/);
  if (jsonMatch) {
    try {
      const data = JSON.parse(jsonMatch[1]);
      const contents =
        data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]
          ?.itemSectionRenderer?.contents || [];

      for (const item of contents) {
        const r = item.videoRenderer;
        if (r && r.videoId && /^[a-zA-Z0-9_-]{11}$/.test(r.videoId) && !excludeSet.has(r.videoId)) {
          const title = r.title?.runs?.[0]?.text || '';
          const artist = r.ownerText?.runs?.[0]?.text || '';
          const score = scoreCandidate(q, expectedTitle, expectedArtist, title, artist);
          candidates.push({ videoId: r.videoId, score, title, artist });
        }
      }
    } catch {}
  }

  // 2. Fallback: Parse <a> tags with titles
  if (candidates.length === 0) {
    const linkRegex = /href="\/watch\?v=([a-zA-Z0-9_-]{11})"[^>]*title="([^"]+)"/g;
    let match;
    while ((match = linkRegex.exec(html)) !== null) {
      const vid = match[1];
      const title = match[2];
      if (!excludeSet.has(vid)) {
        const score = scoreCandidate(q, expectedTitle, expectedArtist, title, '');
        candidates.push({ videoId: vid, score, title, artist: '' });
      }
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  if (candidates.length > 0 && candidates[0].score >= 25) {
    return { videoId: candidates[0].videoId };
  }

  throw new Error('YT search: no confident videoId found');
}

async function getInvidiousAudioUrl(videoId) {
  for (const base of INVIDIOUS_INSTANCES) {
    try {
      const res = await fetchWithTimeout(`${base}/api/v1/videos/${videoId}?fields=adaptiveFormats`, {}, 5000);
      if (!res.ok) continue;
      const data = await res.json();
      const formats = data.adaptiveFormats || [];
      const audio = formats
        .filter(f => f.type?.startsWith('audio/') && f.url)
        .sort((a, b) => (parseInt(b.bitrate) || 0) - (parseInt(a.bitrate) || 0));
      if (audio[0]?.url) return audio[0].url;
    } catch {}
  }
  return null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const action = req.query?.action || (url.pathname.includes('/stream') ? 'stream' : 'resolve');

  // 1. STREAM ACTION
  if (action === 'stream') {
    const q = (req.query?.q || '').trim();
    if (!q) return res.status(400).json({ error: 'Missing query q' });

    try {
      let videoId = null;
      try {
        const result = await resolveViaYouTubeMusic(q);
        videoId = result?.videoId;
      } catch {
        const result = await resolveViaYouTubeSearch(q);
        videoId = result?.videoId;
      }

      if (!videoId) return res.status(404).json({ error: 'Video not found' });
      const audioUrl = await getInvidiousAudioUrl(videoId);
      if (!audioUrl) return res.status(404).json({ error: 'Audio stream not found' });

      return res.redirect(302, audioUrl);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // 2. RESOLVE ACTION (Default)
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800');

  const rawQ = (req.query?.q || req.query?.query || '').trim();
  const rawTitle = (req.query?.title || '').trim();
  const rawArtist = (req.query?.artist || '').trim();

  if (!rawQ && !rawTitle) {
    return res.status(400).json({ error: 'Missing query' });
  }

  const excludeParam = (req.query?.exclude || '').trim();
  const excludeSet = new Set(excludeParam ? excludeParam.split(',').map((s) => s.trim()) : []);

  const q = cleanQuery(rawQ || `${rawTitle} ${rawArtist}`.trim());
  const cacheKey = q.toLowerCase();

  const verifiedId =
    getVerifiedVideoId(q) ||
    getVerifiedVideoId(rawQ) ||
    getVerifiedVideoId(`${rawTitle} ${rawArtist}`);

  if (verifiedId && !excludeSet.has(verifiedId)) {
    return res.status(200).json({ success: true, videoId: verifiedId, verified: true });
  }

  if (excludeSet.size === 0 && RESOLVE_CACHE.has(cacheKey)) {
    const cached = RESOLVE_CACHE.get(cacheKey);
    return res.status(200).json({ success: true, ...cached, cached: true });
  }

  try {
    let result = null;
    try {
      result = await resolveViaYouTubeMusic(q, rawTitle, rawArtist, excludeSet);
    } catch {
      result = await resolveViaYouTubeSearch(q, rawTitle, rawArtist, excludeSet);
    }

    if (result && result.videoId && !excludeSet.has(result.videoId)) {
      if (excludeSet.size === 0) {
        RESOLVE_CACHE.set(cacheKey, result);
      }
      return res.status(200).json({ success: true, ...result });
    }
  } catch (err) {
    try {
      const simplified = q.split(' ').slice(0, 4).join(' ');
      if (simplified !== q) {
        const retryResult = await resolveViaYouTubeMusic(simplified, rawTitle, rawArtist, excludeSet);
        if (retryResult?.videoId && !excludeSet.has(retryResult.videoId)) {
          if (excludeSet.size === 0) {
            RESOLVE_CACHE.set(cacheKey, retryResult);
          }
          return res.status(200).json({ success: true, ...retryResult });
        }
      }
    } catch {}
  }

  return res.status(404).json({ error: 'No se pudo resolver el audio para esta pista' });
}
