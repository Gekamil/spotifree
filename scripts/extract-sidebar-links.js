import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('open.spotify.com'));
  if (spotifyPage) {
    const sidebarItems = await spotifyPage.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('nav div[role="row"]'));
      return rows.map(r => {
        const title = r.querySelector('span.e-101040-line-clamp, [data-encore-id="text"]')?.innerText?.trim();
        const sub = r.querySelector('span.AYtovynmfPn0KZi10Nel, span.e-101040-text-subdued')?.innerText?.trim();
        const img = r.querySelector('img')?.src;
        const link = r.querySelector('a')?.getAttribute('href') || r.getAttribute('data-href');
        return { title, sub, img, link };
      });
    });

    console.log(JSON.stringify(sidebarItems, null, 2));
  }
  browser.disconnect();
}

main().catch(console.error);
