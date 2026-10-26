import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('open.spotify.com'));
  if (spotifyPage) {
    // Navigate to collection/tracks
    await spotifyPage.goto('https://open.spotify.com/collection/tracks', { waitUntil: 'domcontentloaded', timeout: 10000 });
    await new Promise(r => setTimeout(r, 2000));

    const tracks = await spotifyPage.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('div[data-testid="tracklist-row"], div[role="row"]'));
      return rows.map(r => {
        const title = r.querySelector('[data-encore-id="text"]:not([data-encore-id="textSubdued"]), a[data-testid="internal-track-link"], div[dir="auto"]')?.innerText?.trim();
        const artists = Array.from(r.querySelectorAll('a[href*="/artist/"]')).map(a => a.innerText.trim());
        const album = r.querySelector('a[href*="/album/"]')?.innerText?.trim();
        const duration = r.querySelector('div[data-encore-id="text"]:last-child, span[data-encore-id="text"]:last-child')?.innerText?.trim();
        const img = r.querySelector('img')?.src;
        return { title, artists, album, duration, img };
      }).filter(t => t.title && t.artists.length > 0);
    });

    console.log('Liked songs count:', tracks.length);
    console.log(JSON.stringify(tracks.slice(0, 5), null, 2));
  }
  browser.disconnect();
}

main().catch(console.error);
