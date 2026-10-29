function cleanTitle(title) {
  return (title || '')
    .replace(/\s*-\s*Remastered(\s*\d+)?/gi, '')
    .replace(/\s*\(Remastered(\s*\d+)?\)/gi, '')
    .replace(/\s*\[Explicit\]/gi, '')
    .replace(/\s*\(Explicit\)/gi, '')
    .replace(/\s*\(feat\..*?\)/gi, '')
    .replace(/\s*\[feat\..*?\]/gi, '')
    .replace(/\s*\(ft\..*?\)/gi, '')
    .replace(/\s*\[ft\..*?\]/gi, '')
    .replace(/\s*\(Official.*?\)/gi, '')
    .replace(/\s*-\s*Radio Edit/gi, '')
    .trim();
}

function cleanArtist(artist) {
  return (artist || '')
    .split(/[,&]/)[0]
    .replace(/\s*feat\..*$/i, '')
    .replace(/\s*ft\..*$/i, '')
    .trim();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const { title = '', artist = '' } = req.query;
  const t = cleanTitle(title);
  const a = cleanArtist(artist);

  if (!t) {
    return res.status(200).json({ syncedLyrics: null, plainLyrics: null });
  }

  try {
    // 1. Exact match by clean title and artist
    const exactUrl = `https://lrclib.net/api/get?track_name=${encodeURIComponent(t)}&artist_name=${encodeURIComponent(a)}`;
    const exactRes = await fetch(exactUrl, {
      headers: { 'User-Agent': 'Spotifree/1.0' },
      signal: AbortSignal.timeout(5000),
    });

    if (exactRes.ok) {
      const data = await exactRes.json();
      if (data && (data.syncedLyrics || data.plainLyrics)) {
        return res.status(200).json(data);
      }
    }

    // 2. Fallback to broad search query
    const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(`${t} ${a}`.trim())}`;
    const searchRes = await fetch(searchUrl, {
      headers: { 'User-Agent': 'Spotifree/1.0' },
      signal: AbortSignal.timeout(5000),
    });

    if (searchRes.ok) {
      const results = await searchRes.json();
      if (Array.isArray(results) && results.length > 0) {
        const best = results.find(r => r.syncedLyrics) || results[0];
        if (best) return res.status(200).json(best);
      }
    }

    // 3. Fallback to Lyrics.ovh
    try {
      const ovhRes = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(a)}/${encodeURIComponent(t)}`, {
        signal: AbortSignal.timeout(3000),
      });
      if (ovhRes.ok) {
        const ovhData = await ovhRes.json();
        if (ovhData?.lyrics) {
          return res.status(200).json({ syncedLyrics: null, plainLyrics: ovhData.lyrics });
        }
      }
    } catch {}
  } catch (err) {
    console.warn('[api/lyrics] Fetch error:', err.message);
  }

  return res.status(200).json({ syncedLyrics: null, plainLyrics: null });
}
