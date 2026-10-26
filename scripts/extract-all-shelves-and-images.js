import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('open.spotify.com'));
  if (spotifyPage) {
    const allShelves = await spotifyPage.evaluate(async () => {
      // scroll down slowly to trigger lazy loading of all shelf images
      const scrollable = document.querySelector('main div[data-overlayscrollbars-viewport]') ||
                         document.querySelector('[data-testid="infinite-scroll-list"]') ||
                         document.querySelector('main');
      
      const results = [];
      const sections = Array.from(document.querySelectorAll('section'));

      for (const sec of sections) {
        const titleEl = sec.querySelector('h2, [data-encore-id="textHeadline"], a[title]');
        const title = titleEl?.innerText?.trim();
        if (!title) continue;

        const cards = Array.from(sec.querySelectorAll('div[data-testid*="card"], div[class*="Card"], div[role="group"]'));
        const cardData = cards.map(c => {
          const cTitle = c.querySelector('a[title], h3, [data-encore-id="text"]:not([data-encore-id="textSubdued"])')?.innerText?.trim();
          const cSub = c.querySelector('[data-encore-id="textSubdued"], [data-encore-id="textSubTitle"]')?.innerText?.trim();
          const img = c.querySelector('img')?.src;
          const link = c.querySelector('a[href]')?.getAttribute('href');
          return { title: cTitle, subtitle: cSub, img, link };
        }).filter(c => c.title && c.title !== 'Mostrar todos');

        results.push({ sectionTitle: title, cards: cardData });
      }

      return results;
    });

    console.log(JSON.stringify(allShelves, null, 2));
  }
  browser.disconnect();
}

main().catch(console.error);
