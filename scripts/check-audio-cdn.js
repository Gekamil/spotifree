async function main() {
  const res = await fetch('https://open.spotify.com/embed/playlist/43GWp9FbN9nHihudedyVQM', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  });
  const html = await res.text();
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (match) {
    const data = JSON.parse(match[1]);
    const track = data.props?.pageProps?.state?.data?.entity?.trackList?.[0];
    console.log('Sample track with preview:', track.title, track.audioPreview?.url);
    if (track.audioPreview?.url) {
      const audioRes = await fetch(track.audioPreview.url, { method: 'HEAD' });
      console.log('Audio CDN HEAD status:', audioRes.status, 'Content-Type:', audioRes.headers.get('content-type'));
    }
  }
}

main().catch(console.error);
