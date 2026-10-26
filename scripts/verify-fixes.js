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

    // 1. Capture Home view with the fixed centered player and clean logo
    await page.screenshot({ path: path.join(artifactDir, 'spotifree-fixed-home.png') });
    console.log('Saved spotifree-fixed-home.png');

    // 2. Click on "Canciones que te gustan" in the sidebar
    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('aside p, aside span'));
      const likedItem = items.find(el => el.textContent?.includes('Canciones que te gustan'));
      if (likedItem) {
        likedItem.closest('div[class*="cursor-pointer"]')?.click();
      }
    });

    await new Promise(r => setTimeout(r, 1000));
    // Capture the playlist view of "Canciones que te gustan"
    await page.screenshot({ path: path.join(artifactDir, 'spotifree-fixed-playlist.png') });
    console.log('Saved spotifree-fixed-playlist.png');

    // 3. Capture a close-up of the player bar to verify centered controls and numbers
    const playerEl = await page.$('footer');
    if (playerEl) {
      await playerEl.screenshot({ path: path.join(artifactDir, 'spotifree-fixed-player-bar.png') });
      console.log('Saved spotifree-fixed-player-bar.png');
    }
  }
  browser.disconnect();
}
run().catch(console.error);
