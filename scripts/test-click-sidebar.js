import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('spotify.com'));
  if (spotifyPage) {
    // Click on "Canciones que te gustan"
    await spotifyPage.evaluate(() => {
      const row = Array.from(document.querySelectorAll('nav div[role="row"]')).find(r => r.innerText.includes('Canciones que te gustan'));
      if (row) {
        const btn = row.querySelector('[role="button"]') || row;
        btn.click();
      }
    });

    await spotifyPage.waitForSelector('div[data-testid="tracklist-row"]', { timeout: 8000 });

    // Scroll main panel to get all 23 tracks
    const tracks = await spotifyPage.evaluate(async () => {
      const scrollable = document.querySelector('div[data-overlayscrollbars-viewport]') ||
                         Array.from(document.querySelectorAll('*')).find(d => {
                           const s = window.getComputedStyle(d);
                           return (s.overflowY === 'auto' || s.overflowY === 'scroll') && d.scrollHeight > 600;
                         });

      const collected = new Map();

      function grab() {
        const rows = Array.from(document.querySelectorAll('div[data-testid="tracklist-row"]'));
        for (const r of rows) {
          const indexEl = r.querySelector('[data-encore-id="text"]');
          const titleEl = r.querySelector('[data-testid="internal-track-link"], a[href*="/track/"]');
          const title = titleEl?.innerText?.trim() || r.querySelector('[data-encore-id="text"]:not([data-encore-id="textSubdued"])')?.innerText?.trim();
          const artists = Array.from(r.querySelectorAll('a[href*="/artist/"]')).map(a => a.innerText.trim());
          const album = r.querySelector('a[href*="/album/"]')?.innerText?.trim() || title;
          const duration = r.querySelector('div[data-encore-id="text"]:last-child, span[data-encore-id="text"]:last-child')?.innerText?.trim();
          const img = r.querySelector('img')?.src;
          const added_at = r.querySelector('div[role="gridcell"]:nth-child(4) span')?.innerText?.trim() || 'Reciente';

          if (title && !collected.has(title)) {
            collected.set(title, { title, artists, album, duration, img, added_at });
          }
        }
      }

      grab();
      if (scrollable) {
        for (let y = 300; y <= scrollable.scrollHeight; y += 400) {
          scrollable.scrollTop = y;
          await new Promise(r => setTimeout(r, 200));
          grab();
        }
        scrollable.scrollTop = 0;
      }

      return Array.from(collected.values());
    });

    console.log(`Liked songs extracted: ${tracks.length}`);
    console.log(JSON.stringify(tracks, null, 2));
  }
  browser.disconnect();
}

main().catch(console.error);
