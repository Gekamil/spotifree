import puppeteer from 'puppeteer-core';
import path from 'path';

async function run() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const page = pages.find(p => p.url().includes('5173'));
  
  if (page) {
    await page.bringToFront();
    await page.setViewport({ width: 1440, height: 900 });
    await page.reload({ waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1200));

    const artifactDir = 'C:\\Users\\jorge\\.gemini\\antigravity\\brain\\b7d3ec29-c076-4935-90b5-23f42c286313';

    // 1. Capture Home
    await page.screenshot({ path: path.join(artifactDir, 'spotifree-fixed-home-perfect.png') });
    console.log('Saved spotifree-fixed-home-perfect.png');

    // 2. Click on "Canciones que te gustan" in sidebar
    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('aside p, aside span'));
      const likedItem = items.find(el => el.textContent?.includes('Canciones que te gustan'));
      if (likedItem) {
        likedItem.closest('div[class*="cursor-pointer"]')?.click();
      }
    });

    await new Promise(r => setTimeout(r, 1000));

    // 3. Capture Playlist View
    await page.screenshot({ path: path.join(artifactDir, 'spotifree-fixed-playlist-perfect.png') });
    console.log('Saved spotifree-fixed-playlist-perfect.png');

    // 4. Capture player bar
    const footer = await page.$('footer');
    if (footer) {
      await footer.screenshot({ path: path.join(artifactDir, 'spotifree-fixed-player-bar-perfect.png') });
      console.log('Saved spotifree-fixed-player-bar-perfect.png');
    }
  }
  browser.disconnect();
}
run().catch(console.error);
