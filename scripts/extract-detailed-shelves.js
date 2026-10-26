import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('spotify.com'));

  const fullShelves = await spotifyPage.evaluate(() => {
    const sections = Array.from(document.querySelectorAll('section'));
    const result = [];

    for (const sec of sections) {
      const heading = sec.querySelector('h2, [data-encore-id="textHeading"]')?.innerText;
      const subtitle = sec.querySelector('p, [data-encore-id="textSubdued"]')?.innerText;
      
      // Find all grid/carousel items in this section
      const cardNodes = Array.from(sec.querySelectorAll('div[role="group"], div[data-testid*="card"], div[class*="Card"]'));
      const cards = [];

      for (const node of cardNodes) {
        const titleEl = node.querySelector('a[title], [data-encore-id="text"]:not([data-encore-id="textSubdued"]), h3, [class*="Title"]');
        const imgEl = node.querySelector('img');
        const descEl = node.querySelector('[data-encore-id="textSubdued"], [class*="Subtitle"], p');
        const linkEl = node.querySelector('a[href]');

        const title = titleEl ? (titleEl.getAttribute('title') || titleEl.innerText) : null;
        if (title && !cards.find(c => c.title === title)) {
          cards.push({
            title,
            subtitle: descEl ? descEl.innerText : '',
            image: imgEl ? imgEl.src : '',
            href: linkEl ? linkEl.getAttribute('href') : '',
          });
        }
      }

      if (heading || cards.length > 0) {
        result.push({
          title: heading || 'Destacado',
          subtitle: subtitle || '',
          cards: cards.slice(0, 10),
        });
      }
    }

    return result;
  });

  console.log('Extracted live shelves count:', fullShelves.length);
  for (const s of fullShelves) {
    console.log(`Shelf: "${s.title}" (${s.subtitle}) -> ${s.cards.length} cards`);
    if (s.cards.length > 0) {
      console.log('  First card:', s.cards[0].title, '| img:', s.cards[0].image.slice(0, 60));
    }
  }

  browser.disconnect();
}

main().catch(console.error);
