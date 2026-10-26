async function checkTrueno() {
  const res = await fetch('https://open.spotify.com/embed/artist/1fctva4iZegL9J1oVff86V', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  });
  const html = await res.text();
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (match) {
    const data = JSON.parse(match[1]);
    console.log('Keys in pageProps:', Object.keys(data.props?.pageProps || {}));
    console.log('pageProps state:', data.props?.pageProps?.state);
  }
}
checkTrueno();
