import puppeteer from 'puppeteer-core';
import path from 'path';

async function run() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const page = pages.find(p => p.url().includes('5173'));
  
  if (page) {
    const artifactDir = 'C:\\Users\\jorge\\.gemini\\antigravity\\brain\\b7d3ec29-c076-4935-90b5-23f42c286313';

    // Scroll down the main scrollable container
    await page.evaluate(() => {
      const scrollable = document.querySelector('main > div.overflow-y-auto');
      if (scrollable) {
        scrollable.scrollTop = 550;
      }
    });
    await new Promise(r => setTimeout(r, 600));

    await page.screenshot({
      path: path.join(artifactDir, 'spotifree-live-enhanced-scrolled-mid.png'),
      fullPage: false,
    });
    console.log('Saved spotifree-live-enhanced-scrolled-mid.png');

    // Scroll all the way down
    await page.evaluate(() => {
      const scrollable = document.querySelector('main > div.overflow-y-auto');
      if (scrollable) {
        scrollable.scrollTop = 1200;
      }
    });
    await new Promise(r => setTimeout(r, 600));

    await page.screenshot({
      path: path.join(artifactDir, 'spotifree-live-enhanced-scrolled-bottom.png'),
      fullPage: false,
    });
    console.log('Saved spotifree-live-enhanced-scrolled-bottom.png');

    // Scroll back to top
    await page.evaluate(() => {
      const scrollable = document.querySelector('main > div.overflow-y-auto');
      if (scrollable) {
        scrollable.scrollTop = 0;
      }
    });
  }
  browser.disconnect();
}
run().catch(console.error);
