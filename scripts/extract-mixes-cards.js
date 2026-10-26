import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('open.spotify.com'));
  if (spotifyPage) {
    const data = await spotifyPage.evaluate(async () => {
      const scrollable = document.querySelector('main div[data-overlayscrollbars-viewport]');
      if (!scrollable) return 'Scrollable not found';

      let found = null;
      for (let y = 500; y <= 6000; y += 400) {
        scrollable.scrollTop = y;
        await new Promise(r => setTimeout(r, 300));
        const sec = Array.from(document.querySelectorAll('section')).find(s => s.innerText.includes('Tus mixes más escuchados'));
        if (sec) {
          const cards = Array.from(sec.querySelectorAll('div[data-testid*="card"], div[class*="Card"], div[role="group"]'));
          const items = cards.map(c => {
            const title = c.querySelector('a[title], h3, [data-encore-id="text"]:not([data-encore-id="textSubdued"])')?.innerText?.trim();
            const subtitle = c.querySelector('[data-encore-id="textSubdued"]')?.innerText?.trim();
            const img = c.querySelector('img')?.src;
            const link = c.querySelector('a[href]')?.getAttribute('href');
            return { title, subtitle, img, link };
          }).filter(c => c.title && c.title !== 'Mostrar todos');
          if (items.length > 0) {
            found = items;
            break;
          }
        }
      }
      return found;
    });

    console.log(JSON.stringify(data, null, 2));
  }
  browser.disconnect();
}

main().catch(console.error);
