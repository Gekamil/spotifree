import puppeteer from 'puppeteer-core';
import path from 'path';

async function run() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const page = pages.find(p => p.url().includes('5173'));
  
  if (page) {
    await page.bringToFront();
    await page.setViewport({ width: 1440, height: 900 });
    await new Promise(r => setTimeout(r, 600));

    const artifactDir = 'C:\\Users\\jorge\\.gemini\\antigravity\\brain\\b7d3ec29-c076-4935-90b5-23f42c286313';

    // 1. Top
    await page.evaluate(() => {
      const scrollable = document.querySelector('main > div.overflow-y-auto');
      if (scrollable) scrollable.scrollTop = 0;
    });
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: path.join(artifactDir, 'spotifree-1440-top.png') });

    // 2. Mid
    await page.evaluate(() => {
      const scrollable = document.querySelector('main > div.overflow-y-auto');
      if (scrollable) scrollable.scrollTop = 450;
    });
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: path.join(artifactDir, 'spotifree-1440-mid.png') });

    // 3. Bottom
    await page.evaluate(() => {
      const scrollable = document.querySelector('main > div.overflow-y-auto');
      if (scrollable) scrollable.scrollTop = 1000;
    });
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: path.join(artifactDir, 'spotifree-1440-bottom.png') });

    // Back to top
    await page.evaluate(() => {
      const scrollable = document.querySelector('main > div.overflow-y-auto');
      if (scrollable) scrollable.scrollTop = 0;
    });

    console.log('Saved spotifree-1440-top.png, mid.png, bottom.png!');
  }
  browser.disconnect();
}
run().catch(console.error);
