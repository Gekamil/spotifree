async function test() {
  console.log('Testing /api/lyrics...');
  const lRes = await fetch('http://127.0.0.1:5173/api/lyrics?title=Hecha+Pa+Mi&artist=Boza');
  const lData = await lRes.json();
  console.log('Lyrics status:', lRes.status, 'hasSynced:', !!lData.syncedLyrics, 'lines:', lData.syncedLyrics?.split('\n').length);

  console.log('Testing /api/spotify/playlist/5lwmRuXgjX8xIwlnauTZIP...');
  const pRes = await fetch('http://127.0.0.1:5173/api/spotify/playlist/5lwmRuXgjX8xIwlnauTZIP');
  const pData = await pRes.json();
  console.log('Playlist status:', pRes.status, 'name:', pData.name, 'type:', pData.type, 'tracks:', pData.tracks?.items?.length);

  console.log('Testing /api/spotify/playlist/trueno...');
  const tRes = await fetch('http://127.0.0.1:5173/api/spotify/playlist/trueno');
  const tData = await tRes.json();
  console.log('Trueno status:', tRes.status, 'name:', tData.name, 'type:', tData.type, 'tracks:', tData.tracks?.items?.length);
}

test().catch(console.error);
