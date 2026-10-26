async function run() {
  const res = await fetch('https://open.spotify.com/embed/artist/5lwmRuXgjX8xIwlnauTZIP', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  });
  const html = await res.text();
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (match) {
    const data = JSON.parse(match[1]);
    const entity = data.props?.pageProps?.state?.data?.entity;
    console.log('Entity name:', entity?.name, 'type:', entity?.type);
    console.log('Track count:', entity?.trackList?.length);
    if (entity?.trackList?.length > 0) {
      console.log('Sample track:', entity.trackList[0]);
    }
  }
}
run();
