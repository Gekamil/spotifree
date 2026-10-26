async function resolveYouTubeMusicId(query) {
  try {
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
          }
        },
        query: query,
      })
    });
    if (!res.ok) return null;
    const data = await res.json();
    
    // Parse musicResponsiveListItemRenderer items
    const sections = data.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents || [];
    for (const sec of sections) {
      const shelf = sec.musicShelfRenderer || sec.musicCardShelfRenderer;
      if (shelf) {
        // If musicCardShelfRenderer (top result)
        if (shelf.title?.runs?.[0]?.text) {
          const navEndpoint = shelf.title?.runs?.[0]?.navigationEndpoint || shelf.onTap?.watchEndpoint;
          const vId = navEndpoint?.watchEndpoint?.videoId;
          if (vId) return vId;
        }
        for (const item of shelf.contents || []) {
          const itemRenderer = item.musicResponsiveListItemRenderer;
          const flexColumns = itemRenderer?.flexColumns || [];
          const playNav = itemRenderer?.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint;
          const videoId = playNav?.watchEndpoint?.videoId;
          if (videoId) return videoId;
        }
      }
    }
  } catch (err) {
    console.error('YTM search err:', err);
  }
  return null;
}

async function test() {
  const q1 = 'La Diabla Xavi';
  const id1 = await resolveYouTubeMusicId(q1);
  console.log('Result for', q1, '->', id1);

  const q2 = 'Romeo Santos Necio';
  const id2 = await resolveYouTubeMusicId(q2);
  console.log('Result for', q2, '->', id2);

  const q3 = 'Bad Bunny DtMF';
  const id3 = await resolveYouTubeMusicId(q3);
  console.log('Result for', q3, '->', id3);
}

test().catch(console.error);
