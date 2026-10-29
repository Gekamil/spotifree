const RESOLVE_CACHE = new Map();

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const q = (req.query?.q || req.query?.query || '').trim();
  if (!q) {
    return res.status(400).json({ error: 'Missing query' });
  }

  const cacheKey = q.toLowerCase();
  if (RESOLVE_CACHE.has(cacheKey)) {
    return res.status(200).json({ success: true, videoId: RESOLVE_CACHE.get(cacheKey), cached: true });
  }

  try {
    // 1. YouTube Music Innertube search (official songs/audio)
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
            RESOLVE_CACHE.set(cacheKey, vId);
            return res.status(200).json({ success: true, videoId: vId });
          }
          for (const item of shelf.contents || []) {
            const itemRenderer = item.musicResponsiveListItemRenderer;
            const playNav = itemRenderer?.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint;
            const videoId = playNav?.watchEndpoint?.videoId || itemRenderer?.navigationEndpoint?.watchEndpoint?.videoId;
            if (videoId) {
              RESOLVE_CACHE.set(cacheKey, videoId);
              return res.status(200).json({ success: true, videoId });
            }
          }
        }
      }
      const text = JSON.stringify(data);
      const matches = Array.from(text.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g)).map((m) => m[1]);
      if (matches.length > 0) {
        RESOLVE_CACHE.set(cacheKey, matches[0]);
        return res.status(200).json({ success: true, videoId: matches[0] });
      }
    }

    // 2. Fallback to YouTube web search
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(q + ' audio')}`;
    const ytRes = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    const html = await ytRes.text();
    const matches = Array.from(html.matchAll(/\/watch\?v=([a-zA-Z0-9_-]{11})/g)).map((m) => m[1]);
    if (matches.length > 0) {
      RESOLVE_CACHE.set(cacheKey, matches[0]);
      return res.status(200).json({ success: true, videoId: matches[0] });
    }

    return res.status(404).json({ error: 'Video not found' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
