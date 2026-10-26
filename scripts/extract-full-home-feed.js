import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

async function run() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('open.spotify.com'));
  
  if (spotifyPage) {
    await spotifyPage.setViewport({ width: 1440, height: 900 });

    // Scroll through the page to load all lazy-loaded sections
    for (let i = 0; i < 6; i++) {
      await spotifyPage.evaluate((step) => {
        const scrollContainer = document.querySelector('.main-view-container, main') || window;
        scrollContainer.scrollBy ? scrollContainer.scrollBy(0, 800) : window.scrollBy(0, 800);
      }, i);
      await new Promise(r => setTimeout(r, 600));
    }

    // Scroll back to top
    await spotifyPage.evaluate(() => {
      const scrollContainer = document.querySelector('.main-view-container, main') || window;
      scrollContainer.scrollTo ? scrollContainer.scrollTo(0, 0) : window.scrollTo(0, 0);
    });
    await new Promise(r => setTimeout(r, 800));

    // Extract all sections
    const feed = await spotifyPage.evaluate(() => {
      const sections = Array.from(document.querySelectorAll('section'));
      
      const parsedSections = [];

      for (let sIdx = 0; sIdx < sections.length; sIdx++) {
        const s = sections[sIdx];
        const h2 = s.querySelector('h2, [data-testid="shelf-title"]')?.textContent?.trim();
        const subtitle = s.querySelector('p, span[data-encore-id="text"]')?.textContent?.trim();
        const seeAll = !!s.querySelector('a[href*="/section/"], [data-testid="see-all-link"]');

        const cardElements = Array.from(s.querySelectorAll('[data-testid*="card"], [role="group"], div[data-testid*="shelf-item"]'));
        
        const cards = [];
        const seenCards = new Set();

        for (const card of cardElements) {
          const img = card.querySelector('img')?.src;
          const title = card.querySelector('a[title], [data-encore-id="text"], p')?.textContent?.trim();
          const desc = card.querySelectorAll('[data-encore-id="text"]')[1]?.textContent?.trim() || '';
          const href = card.querySelector('a')?.href || '';

          if (img && title && !seenCards.has(title)) {
            seenCards.add(title);
            cards.push({
              id: `card-${cards.length}`,
              title,
              subtitle: desc,
              image: img,
              href,
            });
          }
        }

        if (h2 && cards.length > 0) {
          parsedSections.push({
            id: `shelf-${parsedSections.length}`,
            title: h2,
            subtitle: subtitle !== h2 ? subtitle : '',
            hasSeeAll: seeAll,
            cards,
          });
        }
      }

      return parsedSections;
    });

    const targetFile = 'c:\\Users\\jorge\\Documents\\antigravity\\delightful-borg\\src\\data\\spotifyHomeFeed.json';
    fs.writeFileSync(targetFile, JSON.stringify(feed, null, 2));
    console.log(`Saved ${feed.length} full shelves with ${feed.reduce((acc, s) => acc + s.cards.length, 0)} cards!`);
    feed.forEach((s, idx) => console.log(`${idx + 1}. [${s.title}] (${s.cards.length} cards)`));
  }
  browser.disconnect();
}
run().catch(console.error);
