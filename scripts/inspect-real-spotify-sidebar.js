import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('open.spotify.com'));
  if (!spotifyPage) {
    console.log('No spotify page found');
    return;
  }

  // Navigate spotifyPage to / if it's on /search
  if (!spotifyPage.url().endsWith('.com/') && !spotifyPage.url().endsWith('.com/intl-es/')) {
    await spotifyPage.goto('https://open.spotify.com/');
    await new Promise(r => setTimeout(r, 2000));
  }

  const result = await spotifyPage.evaluate(() => {
    // 1. Sidebar playlists
    const sidebar = document.querySelector('[data-testid="your-library"]') ||
                    document.querySelector('[aria-label="Tu biblioteca"]') ||
                    document.querySelector('aside');
    
    // Look for all items in the sidebar
    const allLinks = Array.from(document.querySelectorAll('a[href*="/playlist/"], a[href*="/collection/tracks"], a[href*="/artist/"], a[href*="/album/"]'));
    const sidebarItems = [];

    // All elements in sidebar list
    const rows = Array.from(document.querySelectorAll('li[role="listitem"], [role="row"], div[role="listitem"]'));
    for (const r of rows) {
      const a = r.querySelector('a');
      const text = r.innerText?.trim();
      const img = r.querySelector('img')?.src;
      const isPinned = !!r.querySelector('svg[aria-label*="fijad"], svg[aria-label*="Pin"], svg[data-encore-id*="pin"]');
      if (text && a) {
        sidebarItems.push({
          href: a.href,
          textLines: text.split('\n'),
          img,
          isPinned
        });
      }
    }

    // 2. Main feed sections and all their cards
    const mainSections = Array.from(document.querySelectorAll('section')).map(sec => {
      const h2 = sec.querySelector('h2, [data-encore-id="textHeading"]')?.innerText;
      const p = sec.querySelector('p, [data-encore-id="textSubdued"]')?.innerText;
      const cards = Array.from(sec.querySelectorAll('div[role="group"], div[data-testid*="card"]')).map(c => {
        const title = c.querySelector('a[title], h3, [data-encore-id="text"]:not([data-encore-id="textSubdued"])')?.innerText;
        const sub = c.querySelector('p, [data-encore-id="textSubdued"]')?.innerText;
        const img = c.querySelector('img')?.src;
        const badge = c.querySelector('[class*="badge"], [style*="background"]')?.innerText;
        const href = c.querySelector('a')?.href;
        return { title, sub, img, badge, href };
      }).filter(c => c.title && c.title !== 'Mostrar todos');

      return {
        h2,
        p,
        cardsCount: cards.length,
        cards: cards.slice(0, 10)
      };
    }).filter(s => s.h2 || s.cardsCount > 0);

    // 3. Quick access top grid cards
    // Look for the quick access grid at the top
    const quickGridContainer = document.querySelector('[data-testid="grid-container"], [data-testid="quick-grid"], section[aria-label*="recientes"]') ||
                              document.querySelector('main > div > div > div');
    const quickCards = [];
    const topGridLinks = Array.from(document.querySelectorAll('main a[href*="/playlist/"], main a[href*="/collection/"], main a[href*="/album/"]')).slice(0, 12);
    for (const a of topGridLinks) {
      const text = a.innerText?.trim();
      const img = a.querySelector('img')?.src;
      if (text && !quickCards.find(c => c.text === text)) {
        quickCards.push({
          href: a.href,
          text: text.split('\n')[0],
          img
        });
      }
    }

    return {
      sidebarItemsCount: sidebarItems.length,
      sidebarItems: sidebarItems.slice(0, 20),
      mainSectionsCount: mainSections.length,
      mainSections,
      quickCards: quickCards.slice(0, 8)
    };
  });

  console.log('--- REAL SPOTIFY INSPECTION ---');
  console.log(`Sidebar items found: ${result.sidebarItemsCount}`);
  for (const item of result.sidebarItems) {
    console.log(` - ${item.textLines.join(' | ')} (img: ${item.img ? 'yes' : 'no'}, pinned: ${item.isPinned})`);
  }

  console.log(`\nMain sections found: ${result.mainSectionsCount}`);
  for (const sec of result.mainSections) {
    console.log(` * Section: "${sec.h2}" (${sec.p}) - ${sec.cardsCount} cards`);
    for (const c of sec.cards.slice(0, 3)) {
      console.log(`     Card: "${c.title}" | "${c.sub}" | img: ${c.img ? 'yes' : 'no'}`);
    }
  }

  console.log(`\nQuick cards found: ${result.quickCards.length}`);
  for (const q of result.quickCards) {
    console.log(` # Quick: "${q.text}" (img: ${q.img ? 'yes' : 'no'})`);
  }

  browser.disconnect();
}

main().catch(console.error);
