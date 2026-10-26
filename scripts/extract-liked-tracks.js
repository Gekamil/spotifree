import puppeteer from 'puppeteer-core';
import fs from 'fs';

async function run() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const sp = pages.find(p => p.url().includes('open.spotify.com'));
  if (sp) {
    await sp.goto('https://open.spotify.com/collection/tracks', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1500));

    const tracks = await sp.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('[role="row"], [data-testid="tracklist-row"]'));
      return rows.map((r, idx) => {
        const title = r.querySelector('a[href*="/track/"], [data-encore-id="text"]')?.textContent?.trim();
        const artist = r.querySelectorAll('a[href*="/artist/"], [data-encore-id="text"]')[1]?.textContent?.trim();
        const album = r.querySelector('a[href*="/album/"]')?.textContent?.trim();
        const img = r.querySelector('img')?.src;
        return { idx, title, artist, album, img };
      }).filter(t => t.title);
    });

    console.log('Liked songs count:', tracks.length);
    console.log(JSON.stringify(tracks.slice(0, 8), null, 2));

    fs.writeFileSync('src/data/realLikedSongs.json', JSON.stringify(tracks, null, 2));
  }
  browser.disconnect();
}
run().catch(console.error);
