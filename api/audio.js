/**
 * Consolidated Spotifree Audio API: Resolve & Stream
 * Serves /api/audio/resolve and /api/audio/stream
 */

const RESOLVE_CACHE = new Map();

const VERIFIED_TRACK_VIDEOS = {
  'planteamiento erroneo': 'aWewyeC49e8',
  'planteamiento erróneo': 'aWewyeC49e8',
  'quevedo planteamiento erroneo': 'aWewyeC49e8',
  'quevedo planteamiento erróneo': 'aWewyeC49e8',
  'quevedo - planteamiento erroneo': 'aWewyeC49e8',
  'quevedo - planteamiento erróneo': 'aWewyeC49e8',
  'la graciosa': 'LZPLBSRnxSY',
  'graciosa': 'LZPLBSRnxSY',
  'quevedo la graciosa': 'LZPLBSRnxSY',
  'quevedo - la graciosa': 'LZPLBSRnxSY',
  'la graciosa quevedo': 'LZPLBSRnxSY',
};

function getVerifiedVideoId(q) {
  if (!q) return null;
  const norm = q
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  for (const [key, id] of Object.entries(VERIFIED_TRACK_VIDEOS)) {
    const normKey = key
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
    if (norm === normKey || norm.includes(normKey) || (norm.includes('quevedo') && norm.includes('planteamiento'))) {
      return id;
    }
  }
  if (norm.includes('graciosa') && (norm.includes('quevedo') || norm.includes('crespo') || norm.includes('buenas noches'))) {
    return 'LZPLBSRnxSY';
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
    .replace(/\s*\(feat\..*?\)/gi, '')
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

async function resolveViaYouTubeMusic(q, excludeSet = new Set()) {
  const queryWords = cleanQuery(q)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2);

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

  for (const sec of sections) {
    // 1. Check Top Result Card (official #1 match on YouTube Music, e.g. Quevedo Planteamiento Erróneo)
    if (sec.musicCardShelfRenderer) {
      const card = sec.musicCardShelfRenderer;
      const cardTitle = card.title?.runs?.[0]?.text || '';
      const cardSub = card.subtitle?.runs?.map((x) => x.text).join('') || '';
      const cardVid =
        card.onTap?.watchEndpoint?.videoId ||
        card.title?.runs?.[0]?.navigationEndpoint?.watchEndpoint?.videoId ||
        card.buttons?.[0]?.buttonRenderer?.command?.watchEndpoint?.videoId;
      if (cardVid && /^[a-zA-Z0-9_-]{11}$/.test(cardVid) && !excludeSet.has(cardVid)) {
        const combined = `${cardTitle} ${cardSub}`.toLowerCase();
        if (queryWords.length === 0 || queryWords.some((w) => combined.includes(w))) {
          return { videoId: cardVid };
        }
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
          const combined = `${itemTitle} ${itemArtist}`.toLowerCase();

          if (queryWords.length === 0 || queryWords.some((w) => combined.includes(w))) {
            return { videoId };
          }
        }
      }
    }
  }

  // 3. Fallback: match any videoId in response if not excluded
  const text = JSON.stringify(data);
  const matches = [...text.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g)].map((m) => m[1]);
  for (const vid of matches) {
    if (!excludeSet.has(vid)) {
      return { videoId: vid };
    }
  }

  throw new Error('YTM: no videoId found');
}

async function resolveViaYouTubeSearch(q, excludeSet = new Set()) {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(q + ' official video')}`;
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

  const matches = [...html.matchAll(/\/watch\?v=([a-zA-Z0-9_-]{11})/g)].map((m) => m[1]);
  for (const vid of matches) {
    if (!excludeSet.has(vid)) {
      return { videoId: vid };
    }
  }

  const jsonMatches = [...html.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g)].map((m) => m[1]);
  for (const vid of jsonMatches) {
    if (!excludeSet.has(vid)) {
      return { videoId: vid };
    }
  }

  throw new Error('YT search: no videoId found');
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
  if (!rawQ) {
    return res.status(400).json({ error: 'Missing query' });
  }

  const excludeParam = (req.query?.exclude || '').trim();
  const excludeSet = new Set(excludeParam ? excludeParam.split(',').map((s) => s.trim()) : []);

  const q = cleanQuery(rawQ);
  const cacheKey = q.toLowerCase();

  const verifiedId = getVerifiedVideoId(q) || getVerifiedVideoId(rawQ);
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
      result = await resolveViaYouTubeMusic(q, excludeSet);
    } catch {
      result = await resolveViaYouTubeSearch(q, excludeSet);
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
        const retryResult = await resolveViaYouTubeMusic(simplified, excludeSet);
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
