import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('open.spotify.com'));

  // Scroll main view down incrementally to extract all sections
  const mainFeed = await spotifyPage.evaluate(async () => {
    // 1. Top quick access grid
    const topGridItems = Array.from(document.querySelectorAll('main div[role="grid"] div[role="row"], main section:first-of-type div[role="button"]')).map(el => {
      const texts = Array.from(el.querySelectorAll('*'))
        .filter(c => c.children.length === 0 && c.textContent.trim())
        .map(c => c.textContent.trim());
      const img = el.querySelector('img')?.src;
      return { title: texts[0], img };
    }).filter(i => i.title);

    // 2. All section shelves
    const sections = Array.from(document.querySelectorAll('main section'));
    const shelves = [];

    for (const sec of sections) {
      const heading = sec.querySelector('h2, [data-encore-id="textHeading"]')?.innerText;
      const subtitle = sec.querySelector('p, [data-encore-id="textSubdued"]')?.innerText;
      const prefix = sec.querySelector('span, [data-encore-id="textSmall"]')?.innerText;

      // Cards
      const cardNodes = Array.from(sec.querySelectorAll('div[data-testid*="card"], div[class*="Card"], div[role="group"]'));
      const cards = [];

      for (const cn of cardNodes) {
        const title = cn.querySelector('a[title], h3, [data-encore-id="text"]:not([data-encore-id="textSubdued"])')?.innerText;
        const sub = cn.querySelector('p, [data-encore-id="textSubdued"]')?.innerText;
        const img = cn.querySelector('img')?.src;
        const badge = cn.querySelector('div[style*="background"]')?.innerText || cn.querySelector('[class*="badge"]')?.innerText;

        if (title && !cards.find(c => c.title === title) && title !== 'Mostrar todos') {
          cards.push({ title, sub, img, badge });
        }
      }

      if (heading || cards.length > 0) {
        shelves.push({
          prefix,
          heading,
          subtitle,
          cards
        });
      }
    }

    return {
      topGridItems,
      shelves
    };
  });

  console.log('--- REAL SPOTIFY MAIN FEED ---');
  console.log(`Top grid items count: ${mainFeed.topGridItems.length}`);
  for (const g of mainFeed.topGridItems) {
    console.log(`  - ${g.title} (${g.img ? 'img' : 'no-img'})`);
  }

  console.log(`\nShelves count: ${mainFeed.shelves.length}`);
  for (const s of mainFeed.shelves) {
    console.log(`\n[SHELF] Prefix: "${s.prefix}" | Heading: "${s.heading}" | Sub: "${s.subtitle}" (${s.cards.length} cards)`);
    for (const c of s.cards) {
      console.log(`   * ${c.title} | ${c.sub} (Badge: ${c.badge})`);
    }
  }

  browser.disconnect();
}

main().catch(console.error);
