import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('spotify.com'));

  // Scroll down smoothly to trigger hydration of all shelves
  await spotifyPage.evaluate(async () => {
    const scrollContainer = document.querySelector('.main-view-container__scroll-node, [data-overlayscrollbars-viewport]') || window;
    for (let i = 0; i < 6; i++) {
      if (scrollContainer.scrollBy) {
        scrollContainer.scrollBy(0, 700);
      } else {
        window.scrollBy(0, 700);
      }
      await new Promise(r => setTimeout(r, 600));
    }
  });

  const fullData = await spotifyPage.evaluate(() => {
    const sections = Array.from(document.querySelectorAll('section'));
    return sections.map(sec => {
      const heading = sec.querySelector('h2, [data-encore-id="textHeading"]')?.innerText;
      const sub = sec.querySelector('p, [data-encore-id="textSubdued"]')?.innerText;
      
      const cards = Array.from(sec.querySelectorAll('div[data-testid*="card"], div[class*="Card"]')).map(card => {
        const title = card.querySelector('a[title], h3, [data-encore-id="text"]:not([data-encore-id="textSubdued"])')?.innerText;
        const subtitle = card.querySelector('p, [data-encore-id="textSubdued"]')?.innerText;
        const img = card.querySelector('img')?.src;
        return { title, subtitle, img };
      }).filter(c => c.title && c.title !== 'Mostrar todos');

      return {
        heading,
        sub,
        cardsCount: cards.length,
        cards: cards.slice(0, 8)
      };
    }).filter(s => s.heading && s.cardsCount > 0);
  });

  console.log('Hydrated shelves count:', fullData.length);
  for (const s of fullData) {
    console.log(`- "${s.heading}" (${s.sub}): ${s.cardsCount} cards`);
    if (s.cards[0]) {
      console.log(`    Card 1: ${s.cards[0].title} (${s.cards[0].subtitle})`);
    }
  }

  // Scroll back to top
  await spotifyPage.evaluate(() => {
    const scrollContainer = document.querySelector('.main-view-container__scroll-node, [data-overlayscrollbars-viewport]') || window;
    if (scrollContainer.scrollTo) scrollContainer.scrollTo(0, 0);
  });

  browser.disconnect();
}

main().catch(console.error);
