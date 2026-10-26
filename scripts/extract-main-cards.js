import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const page = (await browser.pages()).find((p) => p.url().includes('spotify.com'));

  const images = await page.evaluate(() => {
    const main = document.querySelector('main');
    if (!main) return [];
    return Array.from(main.querySelectorAll('img')).map((img) => {
      let p = img.parentElement;
      let title = '';
      for (let i = 0; i < 5 && p; i++) {
        if (p.innerText && p.innerText.trim()) {
          title = p.innerText.trim().split('\n')[0];
          break;
        }
        p = p.parentElement;
      }
      return {
        title,
        src: img.src,
        width: img.width,
        height: img.height
      };
    });
  });

  fs.writeFileSync(
    path.resolve(__dirname, '../main-images.json'),
    JSON.stringify(images, null, 2)
  );

  console.log('Saved main-images.json. Count:', images.length);
  browser.disconnect();
}

run().catch(console.error);
