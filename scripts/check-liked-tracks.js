import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('open.spotify.com'));
  if (spotifyPage) {
    await spotifyPage.goto('https://open.spotify.com/collection/tracks');
    await new Promise(r => setTimeout(r, 3000));
    const liked = await spotifyPage.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('[data-testid="tracklist-row"]'));
      return {
        rowCount: rows.length,
        tracks: rows.slice(0, 10).map((r, i) => {
          const title = r.querySelector('[data-encore-id="text"], a[href*="/track/"]')?.textContent?.trim();
          const artists = Array.from(r.querySelectorAll('a[href*="/artist/"]')).map(a => a.textContent?.trim()).join(', ');
          const album = r.querySelector('a[href*="/album/"]')?.textContent?.trim();
          const duration = r.querySelector('[data-testid="tracklist-row-duration"], .standalone-ellipsis-one-line')?.textContent?.trim();
          return { index: i + 1, title, artists, album, duration };
        })
      };
    });
    console.log('Liked tracks scan:', liked);
  }
  browser.disconnect();
}

main().catch(console.error);
