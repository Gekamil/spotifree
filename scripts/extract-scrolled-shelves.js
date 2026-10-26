import puppeteer from 'puppeteer-core';
import fs from 'fs';

async function run() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const sp = pages.find(p => p.url().includes('open.spotify.com'));
  
  if (sp) {
    // Scroll the main content container multiple times
    const allShelves = [];

    for (let scrollStep = 0; scrollStep < 5; scrollStep++) {
      const capturedThisStep = await sp.evaluate(() => {
        const sections = Array.from(document.querySelectorAll('section'));
        return sections.map(s => {
          const h2 = s.querySelector('h2, [data-testid="shelf-title"]')?.textContent?.trim();
          const subtitle = s.querySelector('p, span[data-encore-id="text"]')?.textContent?.trim();
          const cards = Array.from(s.querySelectorAll('[data-testid*="card"], [role="group"], div[data-testid*="shelf-item"]')).map(card => {
            const img = card.querySelector('img')?.src;
            const title = card.querySelector('a[title], [data-encore-id="text"], p')?.textContent?.trim();
            const desc = card.querySelectorAll('[data-encore-id="text"]')[1]?.textContent?.trim() || '';
            const href = card.querySelector('a')?.href || '';
            return { title, desc, img, href };
          }).filter(c => c.title && c.img);

          return { h2, subtitle, cards };
        }).filter(s => s.h2 && s.cards.length > 0);
      });

      for (const s of capturedThisStep) {
        if (!allShelves.find(existing => existing.h2 === s.h2)) {
          allShelves.push(s);
        }
      }

      // Scroll down main area
      await sp.evaluate(() => {
        const scrollable = document.querySelector('[data-overlayscrollbars-viewport], .main-view-container, main') || window;
        if (scrollable.scrollBy) {
          scrollable.scrollBy(0, 700);
        } else {
          window.scrollBy(0, 700);
        }
      });
      await new Promise(r => setTimeout(r, 800));
    }

    // Scroll back up
    await sp.evaluate(() => {
      const scrollable = document.querySelector('[data-overlayscrollbars-viewport], .main-view-container, main') || window;
      if (scrollable.scrollTo) scrollable.scrollTo(0, 0);
      else window.scrollTo(0, 0);
    });

    console.log(`Extracted ${allShelves.length} unique shelves!`);
    allShelves.forEach((s, idx) => console.log(`${idx + 1}. [${s.h2}] -> ${s.cards.length} cards`));

    const targetFile = 'c:\\Users\\jorge\\Documents\\antigravity\\delightful-borg\\src\\data\\spotifyRealShelves.json';
    fs.writeFileSync(targetFile, JSON.stringify(allShelves, null, 2));
    console.log('Saved to:', targetFile);
  }
  browser.disconnect();
}
run().catch(console.error);
