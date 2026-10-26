import fs from 'node:fs';

async function testPlaylist(id) {
  const url = `https://open.spotify.com/embed/playlist/${id}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });
  console.log(`[${id}] HTTP status:`, res.status);
  const html = await res.text();
  const scriptMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (scriptMatch) {
    const data = JSON.parse(scriptMatch[1]);
    const entity = data.props?.pageProps?.state?.data?.entity;
    console.log(`[${id}] Title:`, entity?.name, 'Total tracks in embed:', entity?.trackList?.length);
    if (entity?.trackList?.length > 0) {
      console.log(`[${id}] Sample track:`, entity.trackList[0].title, 'by', entity.trackList[0].subtitle);
    }
  } else {
    console.log(`[${id}] No NEXT_DATA in embed`);
  }
}

async function run() {
  await testPlaylist('37i9dQZF1DX2EiUAL7Wdfc'); // míticas
  await testPlaylist('37i9dQZF1E36xJocn2Qc0y'); // sample daily mix 1
  await testPlaylist('7b3MrCWtettvBKlfBSdorn'); // J+L(2026)
}

run().catch(console.error);
