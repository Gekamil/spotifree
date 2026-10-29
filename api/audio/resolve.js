/**
 * Spotifree Audio Resolve API
 * Resolves a YouTube videoId (or iTunes preview URL) for a given search query.
 *
 * Optimizations:
 *  - All resolution strategies run IN PARALLEL via Promise.race / Promise.any
 *  - Server-side + client-visible cache headers (24h)
 *  - Clean query removes noise like "Remastered", "Explicit", etc.
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

/** Fetch with automatic abort after `ms` milliseconds */
function fetchWithTimeout(url, opts, ms = 4000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

/** Strategy 1: YouTube Music Innertube search */
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
        // Pure songs/audio only filter
        params: 'Eg-KAQwIARAAGAAgACgAMABqChAEEAMQCRAFEAo%3D',
      }),
    },
    5000
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
        if (videoId) return { videoId };
      }
    }
  }

  // Generic regex fallback on JSON body
  const text = JSON.stringify(data);
  const matches = [...text.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g)].map((m) => m[1]);
  if (matches.length > 0) return { videoId: matches[0] };

  throw new Error('YTM: no videoId found');
}

/** Strategy 2: YouTube web search scrape */
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

/** Strategy 3: Invidious API (tries instances in parallel, uses fastest) */
async function resolveViaInvidious(q) {
  const instances = [
    'https://inv.tux.pizza',
    'https://invidious.nerdvpn.de',
    'https://invidious.drgns.space',
    'https://yt.artemislena.eu',
  ];

  const tries = instances.map(async (inst) => {
    const res = await fetchWithTimeout(
      `${inst}/api/v1/search?q=${encodeURIComponent(q)}&type=video`,
      { headers: { Accept: 'application/json' } },
      4000
    );
    if (!res.ok) throw new Error(`Invidious ${inst} non-ok`);
    const list = await res.json();
    if (Array.isArray(list) && list.length > 0 && list[0].videoId) {
      return { videoId: list[0].videoId };
    }
    throw new Error(`Invidious ${inst}: no results`);
  });

  return Promise.any(tries);
}

/** Strategy 4: iTunes preview URL (30-second preview, always works) */
async function resolveViaItunes(q) {
  const res = await fetchWithTimeout(
    `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&entity=song&limit=1`,
    {},
    5000
  );
  if (!res.ok) throw new Error('iTunes non-ok');
  const data = await res.json();
  const first = data.results?.[0];
  if (first?.previewUrl) {
    return { previewUrl: first.previewUrl, title: first.trackName, artist: first.artistName };
  }
  throw new Error('iTunes: no preview URL');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  // Cache result for 24 hours on CDN/browser
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

  // Serve from memory cache immediately (Vercel serverless keeps warm instances)
  if (RESOLVE_CACHE.has(cacheKey)) {
    const cached = RESOLVE_CACHE.get(cacheKey);
    return res.status(200).json({ success: true, ...cached, cached: true });
  }

  // Run ALL resolution strategies in parallel — first successful wins
  // Priority order: YTM and YT Search run first; Invidious and iTunes are parallel fallbacks
  try {
    const result = await Promise.any([
      resolveViaYouTubeMusic(q),
      resolveViaYouTubeSearch(q),
      resolveViaInvidious(q),
      resolveViaItunes(q),
    ]);

    RESOLVE_CACHE.set(cacheKey, result);
    return res.status(200).json({ success: true, ...result });
  } catch {
    // All strategies failed
    return res.status(404).json({ error: 'No se pudo resolver el audio para esta pista' });
  }
}
