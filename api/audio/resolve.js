/**
 * Spotifree Audio Resolve API
 * Resolves a real YouTube videoId for a Spotify track.
 *
 * Strategies:
 *  1. YouTube Music Innertube API (Instant ~600-800ms official audio track resolution)
 *  2. YouTube web search fallback (High resilience)
 *  Zero iTunes 30-second clips — always resolves full-length songs.
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
    .trim();
}

function fetchWithTimeout(url, opts, ms = 5000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

/** Strategy 1: YouTube Music Innertube Search (fastest & high-fidelity) */
async function resolveViaYouTubeMusic(q) {
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
        // Music only filter
        params: 'Eg-KAQwIARAAGAAgACgAMABqChAEEAMQCRAFEAo%3D',
      }),
    },
    4500
  );

  if (!res.ok) throw new Error('YTM non-ok');
  const data = await res.json();

  const sections =
    data.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content
      ?.sectionListRenderer?.contents || [];

  for (const sec of sections) {
    const shelf = sec.musicShelfRenderer || sec.musicCardShelfRenderer;
    if (shelf) {
      if (shelf.title?.runs?.[0]?.navigationEndpoint?.watchEndpoint?.videoId) {
        return { videoId: shelf.title.runs[0].navigationEndpoint.watchEndpoint.videoId };
      }
      for (const item of shelf.contents || []) {
        const renderer = item.musicResponsiveListItemRenderer;
        const playNav =
          renderer?.overlay?.musicItemThumbnailOverlayRenderer?.content
            ?.musicPlayButtonRenderer?.playNavigationEndpoint;
        const videoId =
          playNav?.watchEndpoint?.videoId ||
          renderer?.navigationEndpoint?.watchEndpoint?.videoId;
        if (videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId)) return { videoId };
      }
    }
  }

  // Regex match
  const text = JSON.stringify(data);
  const matches = [...text.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g)].map((m) => m[1]);
  if (matches.length > 0) return { videoId: matches[0] };

  throw new Error('YTM: no videoId found');
}

/** Strategy 2: YouTube Web Search Scrape */
async function resolveViaYouTubeSearch(q) {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(q + ' audio')}`;
  const res = await fetchWithTimeout(
    url,
    {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      },
    },
    5000
  );

  if (!res.ok) throw new Error('YT search non-ok');
  const html = await res.text();

  const matches = [...html.matchAll(/\/watch\?v=([a-zA-Z0-9_-]{11})/g)].map((m) => m[1]);
  if (matches.length > 0) return { videoId: matches[0] };

  const jsonMatches = [...html.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g)].map((m) => m[1]);
  if (jsonMatches.length > 0) return { videoId: jsonMatches[0] };

  throw new Error('YT search: no videoId found');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader(
    'Cache-Control',
    'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800'
  );

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const rawQ = (req.query?.q || req.query?.query || '').trim();
  if (!rawQ) {
    return res.status(400).json({ error: 'Missing query' });
  }

  const q = cleanQuery(rawQ);
  const cacheKey = q.toLowerCase();

  if (RESOLVE_CACHE.has(cacheKey)) {
    const cached = RESOLVE_CACHE.get(cacheKey);
    return res.status(200).json({ success: true, ...cached, cached: true });
  }

  try {
    // Run YouTube Music and YouTube Web search in parallel
    const result = await Promise.any([
      resolveViaYouTubeMusic(q),
      resolveViaYouTubeSearch(q),
    ]);

    if (result && result.videoId) {
      RESOLVE_CACHE.set(cacheKey, result);
      return res.status(200).json({ success: true, ...result });
    }
  } catch (err) {
    // Retry once with simplified query (e.g. first 2 words if query is long)
    try {
      const simplified = q.split(' ').slice(0, 4).join(' ');
      if (simplified !== q) {
        const retryResult = await resolveViaYouTubeMusic(simplified);
        if (retryResult?.videoId) {
          RESOLVE_CACHE.set(cacheKey, retryResult);
          return res.status(200).json({ success: true, ...retryResult });
        }
      }
    } catch {}
  }

  return res.status(404).json({ error: 'No se pudo resolver el audio para esta pista' });
}
