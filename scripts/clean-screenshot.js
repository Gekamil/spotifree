import puppeteer from 'puppeteer-core';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const spotifreePage = pages.find((p) => p.url().includes('localhost:5173'));

  if (spotifreePage) {
    await spotifreePage.bringToFront();
    await spotifreePage.setViewport({ width: 1366, height: 768 });
    await spotifreePage.reload({ waitUntil: 'domcontentloaded' });
    await sleep(1200);

    const artifactDir = 'C:\\Users\\jorge\\.gemini\\antigravity\\brain\\b7d3ec29-c076-4935-90b5-23f42c286313';
    
    // Screenshot 1: Home View
    await spotifreePage.screenshot({
      path: path.join(artifactDir, 'spotifree-home-exact-clone.png'),
      fullPage: false,
    });
    console.log('Saved spotifree-home-exact-clone.png');

    // Click on playlist in sidebar to view Playlist view
    await spotifreePage.evaluate(() => {
      const row = document.querySelector('aside div.cursor-pointer');
      if (row) row.click();
    });
    await sleep(1000);

    // Screenshot 2: Playlist View
    await spotifreePage.screenshot({
      path: path.join(artifactDir, 'spotifree-playlist-exact-clone.png'),
      fullPage: false,
    });
    console.log('Saved spotifree-playlist-exact-clone.png');
  }

  browser.disconnect();
}

run().catch(console.error);
