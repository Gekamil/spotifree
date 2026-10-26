import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const page = (await browser.pages()).find((p) => p.url().includes('spotify.com'));

  const imagesData = await page.evaluate(() => {
    // 1. Current player track image
    const playerImg = document.querySelector('footer img, [data-testid="now-playing-bar"] img');
    
    // 2. Quick access cards images & titles
    const cards = Array.from(document.querySelectorAll('section [role="button"], section a[href^="/playlist/"], section a[href^="/collection/"]')).slice(0, 10).map(c => {
      const img = c.querySelector('img');
      const title = c.innerText.trim().split('\n')[0];
      return {
        title,
        imgSrc: img ? img.src : null
      };
    }).filter(c => c.title && c.imgSrc);

    // 3. Sidebar playlist images & titles
    const libraryGrid = document.querySelector('div[aria-label="Tu biblioteca"][role="grid"]');
    const libraryItems = Array.from(libraryGrid ? libraryGrid.querySelectorAll('div[role="row"]') : []).map(row => {
      const img = row.querySelector('img');
      const texts = Array.from(row.querySelectorAll('p, span')).map(t => t.innerText.trim()).filter(Boolean);
      return {
        title: texts[0] || '',
        subtitle: texts[1] || '',
        imgSrc: img ? img.src : null
      };
    }).filter(i => i.title);

    // 4. Shelf cards (¡Hoy es viernes de...)
    const shelfCards = Array.from(document.querySelectorAll('[data-testid="card-click-handler"], [data-testid="grid-container"] [role="group"]')).slice(0, 8).map(card => {
      const img = card.querySelector('img');
      const title = card.querySelector('a, h3, [class*="title"]')?.innerText.trim() || '';
      const subtitle = card.querySelector('[class*="subTitle"], [class*="description"], p')?.innerText.trim() || '';
      return {
        title,
        subtitle,
        imgSrc: img ? img.src : null
      };
    }).filter(s => s.title && s.imgSrc);

    return {
      nowPlayingImg: playerImg ? playerImg.src : null,
      cards,
      libraryItems,
      shelfCards
    };
  });

  fs.writeFileSync(
    path.resolve(__dirname, '../extracted-real-images.json'),
    JSON.stringify(imagesData, null, 2)
  );

  console.log('Saved extracted-real-images.json');
  console.log('Now playing image:', imagesData.nowPlayingImg);
  console.log('Quick cards extracted:', imagesData.cards.length);
  console.log('Library items extracted:', imagesData.libraryItems.length);
  console.log('Shelf cards extracted:', imagesData.shelfCards.length);

  browser.disconnect();
}

run().catch(console.error);
