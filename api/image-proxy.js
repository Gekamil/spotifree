// Image proxy endpoint for fetching remote images with CORS headers and caching
export default async function handler(req, res) {
  const targetUrl = req.query?.url || new URL(req.url, 'http://localhost').searchParams.get('url');
  if (!targetUrl) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: 'Missing url parameter' }));
    return;
  }

  try {
    const upstream = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
    });

    if (!upstream.ok) {
      res.statusCode = upstream.status;
      res.end();
      return;
    }

    const contentType = upstream.headers.get('content-type') || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    const arrayBuffer = await upstream.arrayBuffer();
    res.end(Buffer.from(arrayBuffer));
  } catch (err) {
    res.statusCode = 502;
    res.end(JSON.stringify({ error: 'Failed to proxy image', details: String(err) }));
  }
}
