async function inspectYTM(query) {
  const res = await fetch('https://music.youtube.com/youtubei/v1/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
    body: JSON.stringify({
      context: { client: { clientName: 'WEB_REMIX', clientVersion: '1.20240318.01.00', hl: 'es', gl: 'ES' } },
      query: query,
    })
  });
  const data = await res.json();
  const text = JSON.stringify(data);
  const matches = Array.from(text.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g)).map(m => m[1]);
  console.log('Video IDs found in response for', query, ':', [...new Set(matches)].slice(0, 5));
}

inspectYTM('Bad Bunny DtMF').catch(console.error);
