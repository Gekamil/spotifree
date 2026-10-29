const RESOLVE_CACHE = new Map();

function cleanQuery(query) {
  return query
    .replace(/\s*-\s*Remastered(\s*\d+)?/gi, '')
    .replace(/\s*\(Remastered(\s*\d+)?\)/gi, '')
    .replace(/\s*\[Explicit\]/gi, '')
    .replace(/\s*\(Explicit\)/gi, '')
    .replace(/\s*\(Bonus Track\)/gi, '')
    .replace(/\s*-\s*Radio Edit/gi, '')
    .trim();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800');

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

  // 1. YouTube Music Innertube search
  try {
    const ytmRes = await fetch('https://music.youtube.com/youtubei/v1/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
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
    });

    if (ytmRes.ok) {
      const data = await ytmRes.json();
      const sections = data.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents || [];
      for (const sec of sections) {
        const shelf = sec.musicShelfRenderer || sec.musicCardShelfRenderer;
        if (shelf) {
          if (shelf.title?.runs?.[0]?.navigationEndpoint?.watchEndpoint?.videoId) {
            const vId = shelf.title.runs[0].navigationEndpoint.watchEndpoint.videoId;
            const resObj = { videoId: vId };
            RESOLVE_CACHE.set(cacheKey, resObj);
            return res.status(200).json({ success: true, ...resObj });
          }
          for (const item of shelf.contents || []) {
            const itemRenderer = item.musicResponsiveListItemRenderer;
            const playNav = itemRenderer?.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint;
            const videoId = playNav?.watchEndpoint?.videoId || itemRenderer?.navigationEndpoint?.watchEndpoint?.videoId;
            if (videoId) {
              const resObj = { videoId };
              RESOLVE_CACHE.set(cacheKey, resObj);
              return res.status(200).json({ success: true, ...resObj });
            }
          }
        }
      }
      const text = JSON.stringify(data);
      const matches = Array.from(text.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g)).map((m) => m[1]);
      if (matches.length > 0) {
        const resObj = { videoId: matches[0] };
        RESOLVE_CACHE.set(cacheKey, resObj);
        return res.status(200).json({ success: true, ...resObj });
      }
    }
  } catch {}

  // 2. YouTube web search scraping
  try {
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(q + ' audio')}`;
    const ytRes = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      },
    });
    if (ytRes.ok) {
      const html = await ytRes.text();
      const matches = Array.from(html.matchAll(/\/watch\?v=([a-zA-Z0-9_-]{11})/g)).map((m) => m[1]);
      if (matches.length > 0) {
        const resObj = { videoId: matches[0] };
        RESOLVE_CACHE.set(cacheKey, resObj);
        return res.status(200).json({ success: true, ...resObj });
      }
      const jsonMatches = Array.from(html.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g)).map((m) => m[1]);
      if (jsonMatches.length > 0) {
        const resObj = { videoId: jsonMatches[0] };
        RESOLVE_CACHE.set(cacheKey, resObj);
        return res.status(200).json({ success: true, ...resObj });
      }
    }
  } catch {}

  // 3. Invidious / Piped search fallback
  const invidiousInstances = [
    'https://inv.tux.pizza',
    'https://invidious.nerdvpn.de',
    'https://invidious.drgns.space',
  ];
  for (const inst of invidiousInstances) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2500);
      const invRes = await fetch(`${inst}/api/v1/search?q=${encodeURIComponent(q)}&type=video`, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
      });
      clearTimeout(timeout);
      if (invRes.ok) {
        const list = await invRes.json();
        if (Array.isArray(list) && list.length > 0 && list[0].videoId) {
          const resObj = { videoId: list[0].videoId };
          RESOLVE_CACHE.set(cacheKey, resObj);
          return res.status(200).json({ success: true, ...resObj });
        }
      }
    } catch {}
  }

  // 4. iTunes Music search fallback (guaranteed preview audio stream)
  try {
    const itunesRes = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&entity=song&limit=1`
    );
    if (itunesRes.ok) {
      const itunesData = await itunesRes.json();
      const first = itunesData.results?.[0];
      if (first && first.previewUrl) {
        const resObj = {
          previewUrl: first.previewUrl,
          title: first.trackName,
          artist: first.artistName,
        };
        RESOLVE_CACHE.set(cacheKey, resObj);
        return res.status(200).json({ success: true, ...resObj });
      }
    }
  } catch {}

  return res.status(404).json({ error: 'No se pudo resolver el audio para esta pista' });
}
