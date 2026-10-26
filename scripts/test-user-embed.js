async function testUserPlaylist() {
  const url = 'https://open.spotify.com/embed/playlist/43GWp9FbN9nHihudedyVQM';
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });
  const html = await res.text();
  const scriptMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (scriptMatch) {
    const data = JSON.parse(scriptMatch[1]);
    const entity = data.props?.pageProps?.state?.data?.entity;
    console.log('Playlist title:', entity.name);
    console.log('Total tracks:', entity.trackList?.length);
    for (const t of (entity.trackList || []).slice(0, 5)) {
      console.log(`- ${t.title} | ${t.subtitle} | preview: ${!!t.audioPreview?.url}`);
    }
  }
}

testUserPlaylist().catch(console.error);
