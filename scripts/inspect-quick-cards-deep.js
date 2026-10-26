import puppeteer from 'puppeteer-core';

async function run() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('open.spotify.com'));
  
  if (spotifyPage) {
    const data = await spotifyPage.evaluate(() => {
      // Find all elements with background rgba(255, 255, 255, 0.1) or similar
      const allElements = Array.from(document.querySelectorAll('*'));
      const quickCards = allElements.filter(el => {
        const bg = window.getComputedStyle(el).backgroundColor;
        const rect = el.getBoundingClientRect();
        return (bg.includes('rgba(255, 255, 255, 0.1') || bg.includes('rgba(255, 255, 255, 0.07)')) && rect.height > 40 && rect.height < 90 && rect.width > 120 && rect.width < 400;
      });

      const cardsData = quickCards.map(c => {
        const text = c.textContent?.trim();
        const img = c.querySelector('img')?.src;
        const rect = c.getBoundingClientRect();
        return { text, img, w: rect.width, h: rect.height };
      });

      // Find Daily Mix cards
      const allSections = Array.from(document.querySelectorAll('section'));
      const sectionsInfo = allSections.map(s => {
        const h2 = s.querySelector('h2')?.textContent?.trim();
        const p = s.querySelector('p')?.textContent?.trim();
        const span = s.querySelector('span[data-encore-id="text"]')?.textContent?.trim();
        const firstCard = s.querySelector('[data-testid*="card"], [role="group"]');
        return {
          h2, p, span,
          firstCardText: firstCard?.textContent?.trim()
        };
      });

      return {
        cardsData,
        sectionsInfo: sectionsInfo.slice(0, 10),
      };
    });

    console.log(JSON.stringify(data, null, 2));
  }
  browser.disconnect();
}
run().catch(console.error);
