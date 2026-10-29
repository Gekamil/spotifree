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

  const { name = '', artist = '' } = req.query;
  const targetArtist = cleanArtist(name || artist);

  if (!targetArtist) {
    return res.status(200).json({ picture: null });
  }

  try {
    const deezerUrl = `https://api.deezer.com/search/artist?q=${encodeURIComponent(targetArtist)}&limit=1`;
    const dRes = await fetch(deezerUrl, {
      headers: { 'User-Agent': 'Spotifree/1.0' },
      signal: AbortSignal.timeout(4000),
    });

    if (dRes.ok) {
      const data = await dRes.json();
      const first = data.data?.[0];
      const picture = first?.picture_big || first?.picture_medium || first?.picture_small;
      if (picture) {
        res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
        return res.status(200).json({ picture, name: first.name || targetArtist });
      }
    }
  } catch (err) {
    // Continue to fallback
  }

  // Fallback to iTunes track search for this artist to get artwork
  try {
    const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(targetArtist)}&media=music&entity=song&limit=1`;
    const itRes = await fetch(itunesUrl, { signal: AbortSignal.timeout(3000) });
    if (itRes.ok) {
      const itData = await itRes.json();
      const first = itData.results?.[0];
      if (first?.artworkUrl100) {
        const hd = first.artworkUrl100.replace('100x100bb', '600x600bb');
        res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
        return res.status(200).json({ picture: hd, name: targetArtist });
      }
    }
  } catch (err) {}

  return res.status(200).json({ picture: null });
}
