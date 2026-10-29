export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const q = (req.query?.q || '').trim();
  if (!q) {
    return res.status(400).json({ error: 'Missing query' });
  }

  try {
    // 1. Search iTunes for instant high quality audio stream
    const itunesRes = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&entity=song&limit=1`
    );
    if (itunesRes.ok) {
      const data = await itunesRes.json();
      const preview = data.results?.[0]?.previewUrl;
      if (preview) {
        return res.redirect(302, preview);
      }
    }

    // 2. Fallback: query piped/invidious audio stream
    return res.status(404).json({ error: 'Stream not found' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
