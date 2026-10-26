async function getLyrics(trackName, artistName) {
  try {
    let url = `https://lrclib.net/api/get?track_name=${encodeURIComponent(trackName)}&artist_name=${encodeURIComponent(artistName)}`;
    let res = await fetch(url, { headers: { 'User-Agent': 'Spotifree/1.0' } });
    if (res.ok) {
      const data = await res.json();
      if (data.syncedLyrics || data.plainLyrics) return data;
    }

    // Fallback: search query
    url = `https://lrclib.net/api/search?q=${encodeURIComponent(trackName + ' ' + artistName)}`;
    res = await fetch(url, { headers: { 'User-Agent': 'Spotifree/1.0' } });
    if (res.ok) {
      const results = await res.json();
      if (Array.isArray(results) && results.length > 0) {
        return results[0];
      }
    }
  } catch (e) {
    console.error('Lyrics error:', e);
  }
  return null;
}

async function run() {
  const lyrics1 = await getLyrics("Hecha Pa' Mi", "Boza");
  console.log('Boza lyrics found:', !!lyrics1, 'hasSynced:', !!lyrics1?.syncedLyrics);

  const lyrics2 = await getLyrics("Rain", "Trueno");
  console.log('Trueno lyrics found:', !!lyrics2, 'hasSynced:', !!lyrics2?.syncedLyrics);

  const lyrics3 = await getLyrics("Better Late Than Never", "Romeo Santos");
  console.log('Romeo lyrics found:', !!lyrics3, 'hasSynced:', !!lyrics3?.syncedLyrics);
}

run();
