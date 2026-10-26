import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const p = pages.find(p => p.url().includes('spotify.com'));
  if (p) {
    const tracks = await p.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('div[data-testid="tracklist-row"]'));
      return rows.map(r => {
        const title = (r.querySelector('[data-encore-id="text"]:not([data-encore-id="textSubdued"])')?.textContent || '').trim();
        const artists = Array.from(r.querySelectorAll('a[href*="/artist/"]')).map(a => (a.textContent || '').trim());
        const album = (r.querySelector('a[href*="/album/"]')?.textContent || '').trim();
        const lastCell = r.querySelector('div[role="gridcell"]:last-child');
        const allText = lastCell ? Array.from(lastCell.querySelectorAll('*')).map(e => (e.textContent || '').trim()) : [];
        const dur = allText.find(t => /^\d+:\d+$/.test(t)) || '3:00';
        const img = r.querySelector('img')?.src;
        return { title, artists, album, duration: dur, img };
      });
    });
    console.log('Tracks in Random:', tracks.length);
    console.log(JSON.stringify(tracks.slice(0, 5), null, 2));
  }
  browser.disconnect();
}

main().catch(console.error);
