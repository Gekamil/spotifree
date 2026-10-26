import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const p = pages.find(p => p.url().includes('spotify.com'));
  if (p) {
    const tracks = await p.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('div[data-testid="tracklist-row"]'));
      return rows.map(r => {
        const cell2 = r.querySelector('div[role="gridcell"]:nth-child(2)');
        const titleLink = cell2?.querySelector('a[data-testid="internal-track-link"], a[href*="/track/"]');
        const title = (titleLink?.textContent || cell2?.querySelector('div[dir="auto"]')?.textContent || '').trim();
        const artists = Array.from(cell2?.querySelectorAll('a[href*="/artist/"]') || []).map(a => (a.textContent || '').trim());

        const cell3 = r.querySelector('div[role="gridcell"]:nth-child(3)');
        const album = (cell3?.querySelector('a[href*="/album/"]')?.textContent || cell3?.textContent || title).trim();

        const lastCell = r.querySelector('div[role="gridcell"]:last-child');
        const allText = lastCell ? Array.from(lastCell.querySelectorAll('*')).map(e => (e.textContent || '').trim()) : [];
        const dur = allText.find(t => /^\d+:\d+$/.test(t)) || '3:00';
        const img = cell2?.querySelector('img')?.src;
        return { title, artists, album, duration: dur, img };
      });
    });
    console.log(JSON.stringify(tracks.slice(0, 5), null, 2));
  }
  browser.disconnect();
}

main().catch(console.error);
