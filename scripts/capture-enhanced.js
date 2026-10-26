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
    await new Promise(r => setTimeout(r, 1500));

    const artifactDir = 'C:\\Users\\jorge\\.gemini\\antigravity\\brain\\b7d3ec29-c076-4935-90b5-23f42c286313';
    
    // Top view
    await page.screenshot({
      path: path.join(artifactDir, 'spotifree-live-enhanced-top.png'),
      fullPage: false,
    });
    console.log('Saved spotifree-live-enhanced-top.png');

    // Scroll down to show all shelves
    await page.evaluate(() => {
      const main = document.querySelector('main, .overflow-y-auto') || window;
      if (main.scrollBy) main.scrollBy(0, 600);
      else window.scrollBy(0, 600);
    });
    await new Promise(r => setTimeout(r, 1000));

    await page.screenshot({
      path: path.join(artifactDir, 'spotifree-live-enhanced-scrolled.png'),
      fullPage: false,
    });
    console.log('Saved spotifree-live-enhanced-scrolled.png');
  }
  browser.disconnect();
}
run().catch(console.error);
