import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const page = (await browser.pages()).find((p) => p.url().includes('spotify.com'));

  const categories = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href*="/genre/"], a[href*="/section/"]'));
    return links.map((c) => {
      const inner = c.querySelector('div') || c;
      const titleEl = c.querySelector('span[title]') || c.querySelector('span');
      const img = c.querySelector('img');
      const s = window.getComputedStyle(inner);

      return {
        title: titleEl?.getAttribute('title') || titleEl?.textContent?.trim() || '',
        href: c.getAttribute('href'),
        backgroundColor: inner.style.backgroundColor || s.backgroundColor,
        borderRadius: s.borderRadius,
        imgSrc: img ? img.src : null,
      };
    }).filter(c => c.title && c.imgSrc);
  });

  fs.writeFileSync(
    path.resolve(__dirname, '../all-official-categories.json'),
    JSON.stringify(categories, null, 2)
  );

  console.log(`Extracted ${categories.length} official categories:`);
  console.log(categories.slice(0, 8));

  browser.disconnect();
}

run().catch(console.error);
