import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const page = (await browser.pages()).find(p => p.url().includes('spotify.com'));

  const data = await page.evaluate(() => {
    const toRect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
    };

    const getCSS = (el) => {
      if (!el) return null;
      const s = window.getComputedStyle(el);
      return {
        display: s.display,
        width: s.width,
        height: s.height,
        padding: s.padding,
        margin: s.margin,
        gap: s.gap,
        borderRadius: s.borderRadius,
        backgroundColor: s.backgroundColor,
        color: s.color,
        fontSize: s.fontSize,
        fontWeight: s.fontWeight,
        fontFamily: s.fontFamily,
      };
    };

    // 1. Quick Access Cards
    const cards = Array.from(document.querySelectorAll('[data-testid="card-click-handler"], a[href^="/playlist/"], a[href^="/collection/tracks"]')).map(el => {
      const cardContainer = el.closest('div[class*="Card"], div[role="button"], div[class*="grid"]') || el.parentElement;
      const img = cardContainer ? cardContainer.querySelector('img') : null;
      const title = cardContainer ? (cardContainer.querySelector('span, a, p') ? cardContainer.innerText.trim().split('\n')[0] : '') : '';
      const playBtn = cardContainer ? cardContainer.querySelector('button[data-testid="play-button"], button') : null;
      const playSvg = playBtn ? playBtn.querySelector('svg') : null;

      return {
        title,
        rect: toRect(cardContainer),
        css: getCSS(cardContainer),
        imgRect: toRect(img),
        imgRadius: img ? window.getComputedStyle(img).borderRadius : null,
        playBtn: playBtn ? {
          rect: toRect(playBtn),
          css: getCSS(playBtn),
          svg: playSvg ? {
            viewBox: playSvg.getAttribute('viewBox'),
            paths: Array.from(playSvg.querySelectorAll('path')).map(p => p.getAttribute('d'))
          } : null
        } : null
      };
    }).filter(c => c.rect && c.rect.width > 100 && c.rect.height > 30).slice(0, 8);

    // 2. Sidebar items & filters
    const libraryNav = document.querySelector('nav') || document.querySelector('[aria-label="Tu biblioteca"]');
    const filterPills = libraryNav ? Array.from(libraryNav.querySelectorAll('button[role="checkbox"], button')).map(b => ({
      text: b.innerText.trim(),
      rect: toRect(b),
      css: getCSS(b)
    })).filter(b => b.text.length > 0 && b.text.length < 20).slice(0, 5) : [];

    // Sidebar playlist items
    const playlistItems = libraryNav ? Array.from(libraryNav.querySelectorAll('li, div[role="listitem"], a[role="row"]')).map(item => {
      const img = item.querySelector('img');
      const text = item.innerText.trim().replace(/\n+/g, ' • ');
      const pinSvg = item.querySelector('svg');
      return {
        text,
        rect: toRect(item),
        css: getCSS(item),
        imgRect: toRect(img),
        pinSvg: pinSvg ? {
          viewBox: pinSvg.getAttribute('viewBox'),
          paths: Array.from(pinSvg.querySelectorAll('path')).map(p => p.getAttribute('d'))
        } : null
      };
    }).filter(i => i.rect && i.rect.height > 20).slice(0, 10) : [];

    return {
      cards,
      filterPills,
      playlistItems
    };
  });

  fs.writeFileSync(
    path.resolve(__dirname, '../inspected-cards-and-sidebar.json'),
    JSON.stringify(data, null, 2)
  );

  console.log('Saved inspected-cards-and-sidebar.json');
  console.log(`Extracted ${data.cards.length} cards, ${data.filterPills.length} filter pills, ${data.playlistItems.length} playlist items.`);

  browser.disconnect();
}

run().catch(console.error);
