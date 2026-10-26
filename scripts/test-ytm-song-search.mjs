async function searchSongs() {
  const query = "Boza Hecha Pa Mi";
  const res = await fetch('https://music.youtube.com/youtubei/v1/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
    body: JSON.stringify({
      context: {
        client: {
          clientName: 'WEB_REMIX',
          clientVersion: '1.20240318.01.00',
          hl: 'es',
          gl: 'ES',
        },
      },
      query: query,
      params: 'Eg-KAQwIARAAGAAgACgAMABqChAEEAMQCRAFEAo%3D', // Filter: Songs only (Canciones)!
    }),
  });

  const data = await res.json();
  const sections = data.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents || [];
  console.log('Sections:', sections.length);
  for (const sec of sections) {
    const shelf = sec.musicShelfRenderer;
    if (shelf) {
      console.log('Shelf title:', shelf.title?.runs?.[0]?.text);
      for (const item of (shelf.contents || []).slice(0, 3)) {
        const itemRenderer = item.musicResponsiveListItemRenderer;
        const title = itemRenderer?.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text;
        const artist = itemRenderer?.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text;
        const playNav = itemRenderer?.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint;
        const videoId = playNav?.watchEndpoint?.videoId || itemRenderer?.navigationEndpoint?.watchEndpoint?.videoId;
        console.log('Song item:', { title, artist, videoId });
      }
    }
  }
}

searchSongs().catch(console.error);
