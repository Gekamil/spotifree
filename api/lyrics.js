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
    .replace(/\s*\(with\s+.*?\)/gi, '')
    .replace(/\s*\[with\s+.*?\]/gi, '')
    .replace(/\s*\(Official.*?\)/gi, '')
    .replace(/\s*\[Official.*?\]/gi, '')
    .replace(/\s*\(Audio.*?\)/gi, '')
    .replace(/\s*\[Audio.*?\]/gi, '')
    .replace(/\s*\(Video.*?\)/gi, '')
    .replace(/\s*\[Video.*?\]/gi, '')
    .replace(/\s*\(Visualizer.*?\)/gi, '')
    .replace(/\s*\[Visualizer.*?\]/gi, '')
    .replace(/\s*\(Live.*?\)/gi, '')
    .replace(/\s*\[Live.*?\]/gi, '')
    .replace(/\s*-\s*Radio Edit/gi, '')
    .replace(/\s*-\s*Single Version/gi, '')
    .replace(/\s*-\s*Original Mix/gi, '')
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

  const { title = '', artist = '', duration = '' } = req.query;
  const t = cleanTitle(title);
  const a = cleanArtist(artist);
  const durSec = parseInt(duration, 10) || 0;

  if (!t) {
    return res.status(200).json({ syncedLyrics: null, plainLyrics: null });
  }

  try {
    // 1. Exact match by clean title, artist, and optional duration
    let exactUrl = `https://lrclib.net/api/get?track_name=${encodeURIComponent(t)}&artist_name=${encodeURIComponent(a)}`;
    if (durSec > 0) exactUrl += `&duration=${durSec}`;

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

    // 2. Fallback exact match without duration if duration filter failed
    if (durSec > 0) {
      const fallbackUrl = `https://lrclib.net/api/get?track_name=${encodeURIComponent(t)}&artist_name=${encodeURIComponent(a)}`;
      const fallbackRes = await fetch(fallbackUrl, {
        headers: { 'User-Agent': 'Spotifree/1.0' },
        signal: AbortSignal.timeout(4000),
      });
      if (fallbackRes.ok) {
        const fbData = await fallbackRes.json();
        if (fbData && (fbData.syncedLyrics || fbData.plainLyrics)) {
          return res.status(200).json(fbData);
        }
      }
    }

    // 3. Fallback to broad search query on LRCLib
    const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(`${t} ${a}`.trim())}`;
    const searchRes = await fetch(searchUrl, {
      headers: { 'User-Agent': 'Spotifree/1.0' },
      signal: AbortSignal.timeout(5000),
    });

    if (searchRes.ok) {
      const results = await searchRes.json();
      if (Array.isArray(results) && results.length > 0) {
        let best = null;
        // Prioritize candidate with syncedLyrics whose duration matches within +/- 4 seconds
        if (durSec > 0) {
          best = results.find((r) => r.syncedLyrics && Math.abs((r.duration || 0) - durSec) <= 4);
        }
        if (!best) {
          // Match by title inclusion + syncedLyrics
          const normT = t.toLowerCase();
          best =
            results.find((r) => r.syncedLyrics && (r.trackName || '').toLowerCase().includes(normT)) ||
            results.find((r) => r.syncedLyrics) ||
            results[0];
        }
        if (best && (best.syncedLyrics || best.plainLyrics)) {
          return res.status(200).json(best);
        }
      }
    }

    // 4. Fallback to Lyrics.ovh
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
