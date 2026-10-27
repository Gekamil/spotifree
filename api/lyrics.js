export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const { title = '', artist = '' } = req.query;
  const cleanTitle = (title || '').trim();
  const cleanArtist = (artist || '').trim();

  if (!cleanTitle) {
    return res.status(200).json({ syncedLyrics: null, plainLyrics: null });
  }

  try {
    // 1. Try exact match by track_name and artist_name
    const exactUrl = `https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanTitle)}&artist_name=${encodeURIComponent(cleanArtist)}`;
    const exactRes = await fetch(exactUrl, {
      headers: { 'User-Agent': 'Spotifree/1.0 (https://github.com/Gekamil/spotifree)' },
      signal: AbortSignal.timeout(6000),
    });

    if (exactRes.ok) {
      const data = await exactRes.json();
      if (data && (data.syncedLyrics || data.plainLyrics)) {
        return res.status(200).json(data);
      }
    }

    // 2. Fallback to broad search query
    const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(`${cleanTitle} ${cleanArtist}`.trim())}`;
    const searchRes = await fetch(searchUrl, {
      headers: { 'User-Agent': 'Spotifree/1.0 (https://github.com/Gekamil/spotifree)' },
      signal: AbortSignal.timeout(6000),
    });

    if (searchRes.ok) {
      const results = await searchRes.json();
      if (Array.isArray(results) && results.length > 0) {
        const best = results.find(r => r.syncedLyrics) || results[0];
        return res.status(200).json(best);
      }
    }
  } catch (err) {
    console.warn('[api/lyrics] Fetch error:', err.message);
  }

  return res.status(200).json({ syncedLyrics: null, plainLyrics: null });
}
