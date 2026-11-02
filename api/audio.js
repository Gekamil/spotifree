/**
 * Consolidated Spotifree Audio API: Resolve & Stream
 * Serves /api/audio/resolve and /api/audio/stream
 */

const RESOLVE_CACHE = new Map();

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
        params: 'Eg-KAQwIARAAGAAgACgAMABqChAEEAMQCRAFEAo%3D',
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
    const shelf = sec.musicShelfRenderer || sec.musicCardShelfRenderer;
    if (shelf) {
      const topVid = shelf.title?.runs?.[0]?.navigationEndpoint?.watchEndpoint?.videoId;
      if (topVid && !excludeSet.has(topVid)) {
        return { videoId: topVid };
      }
      for (const item of shelf.contents || []) {
        const renderer = item.musicResponsiveListItemRenderer;
        const playNav =
          renderer?.overlay?.musicItemThumbnailOverlayRenderer?.content
            ?.musicPlayButtonRenderer?.playNavigationEndpoint;
        const videoId =
          playNav?.watchEndpoint?.videoId ||
          renderer?.navigationEndpoint?.watchEndpoint?.videoId;
        if (videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId) && !excludeSet.has(videoId)) {
          return { videoId };
        }
      }
    }
  }

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

  if (excludeSet.size === 0 && RESOLVE_CACHE.has(cacheKey)) {
    const cached = RESOLVE_CACHE.get(cacheKey);
    return res.status(200).json({ success: true, ...cached, cached: true });
  }

  try {
    const result = await Promise.any([
      resolveViaYouTubeMusic(q, excludeSet),
      resolveViaYouTubeSearch(q, excludeSet),
    ]);

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
