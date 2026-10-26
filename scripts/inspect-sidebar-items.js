import puppeteer from 'puppeteer-core';

async function run() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('open.spotify.com'));
  
  if (spotifyPage) {
    const sidebarData = await spotifyPage.evaluate(() => {
      const items = Array.from(document.querySelectorAll('nav[aria-label="Tu biblioteca"] [role="listitem"], [data-testid="rootlist-item"], [data-testid="your-library"] li, [data-testid="your-library"] div[role="row"]')).map(el => {
        const title = el.querySelector('p, span, [data-encore-id="text"]')?.textContent?.trim();
        const subtitle = el.querySelectorAll('p, span, [data-encore-id="text"]')[1]?.textContent?.trim();
        const img = el.querySelector('img')?.src;
        const isPinned = !!el.querySelector('svg[aria-label*="fijad"], svg[data-encore-id="icon"]');
        return { title, subtitle, img, isPinned };
      });

      return items.filter(i => i.title);
    });

    console.log(JSON.stringify(sidebarData, null, 2));
  }
  browser.disconnect();
}
run().catch(console.error);
