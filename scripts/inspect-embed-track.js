import puppeteer from 'puppeteer-core';

function toHDImage(url) {
  if (!url) return '';
  return url
    .replace('/ab67616d000011eb/', '/ab67616d0000b273/')
    .replace('/ab67616d00004851/', '/ab67616d0000b273/')
    .replace('/ab67616d00001e02/', '/ab67616d0000b273/')
    .replace('/ab67616d0000ab87/', '/ab67616d0000b273/')
    .replace('/ab67706c00004851/', '/ab67706c0000d72c/')
    .replace('/ab67706c00001e02/', '/ab67706c0000d72c/')
    .replace('/ab67706c0000dec5/', '/ab67706c0000d72c/')
    .replace('/ab67706f00004851/', '/ab67706f00000002/')
    .replace('/ab67706f000036f3/', '/ab67706f00000002/')
    .replace('mosaic.scdn.co/60/', 'mosaic.scdn.co/640/')
    .replace('mosaic.scdn.co/300/', 'mosaic.scdn.co/640/');
}

async function scrapePlaylistFromWeb(playlistId) {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const page = await browser.newPage();
  const start = Date.now();
  await page.goto(`https://open.spotify.com/playlist/${playlistId}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="tracklist-row"]', { timeout: 6000 }).catch(() => {});

  const data = await page.evaluate(() => {
    const title = document.querySelector('h1')?.textContent?.trim() || 'Playlist';
    const desc = document.querySelector('[data-testid="playlist-description"], p')?.textContent?.trim() || '';
    const cover = document.querySelector('img[data-testid="playlist-image"], img[data-encore-id="image"], [data-testid="entity-image"] img')?.src;

    const rows = Array.from(document.querySelectorAll('[data-testid="tracklist-row"]'));
    const tracks = rows.map((r, i) => {
      const link = r.querySelector('a[href*="/track/"]');
      const href = link?.getAttribute('href') || '';
      const id = href.split('/').pop()?.split('?')[0] || `track-${i}`;
      const name = r.querySelector('[data-encore-id="textLarge"], a[href*="/track/"]')?.textContent?.trim() || 'Track';
      const artist = r.querySelector('span[data-encore-id="textSmall"], a[href*="/artist/"]')?.textContent?.trim() || '';
      const album = r.querySelector('a[href*="/album/"]')?.textContent?.trim() || title;
      const img = r.querySelector('img')?.src;
      const durationText = r.querySelector('[data-encore-id="textSmall"]:last-child, div:last-child')?.textContent?.trim() || '3:30';

      return {
        id,
        name,
        artists: [{ id: 'a-' + i, name: artist }],
        album: {
          id: 'alb-' + i,
          name: album,
          images: [{ url: img }]
        },
        duration_ms: 210000,
        added_at: '2025-01-01'
      };
    });

    return { title, desc, cover, tracks };
  });

  await page.close();
  browser.disconnect();

  console.log(`Extracted in ${Date.now() - start}ms:`, data.title, `${data.tracks.length} tracks`);
  console.log('Sample track with real album cover:', JSON.stringify({
    name: data.tracks[1]?.name,
    album: data.tracks[1]?.album?.name,
    cover: toHDImage(data.tracks[1]?.album?.images[0]?.url)
  }, null, 2));
}

scrapePlaylistFromWeb('43GWp9FbN9nHihudedyVQM');
