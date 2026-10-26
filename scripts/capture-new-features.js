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
  const spotifreePage = pages.find((p) => p.url().includes('localhost:5173') || p.url().includes('127.0.0.1:5173'));

  if (spotifreePage) {
    await spotifreePage.bringToFront();
    await spotifreePage.setViewport({ width: 1366, height: 768 });
    await spotifreePage.reload({ waitUntil: 'domcontentloaded' });
    await sleep(1500);

    const artifactDir = 'C:\\Users\\jorge\\.gemini\\antigravity\\brain\\b7d3ec29-c076-4935-90b5-23f42c286313';

    // 1. Capture Home view with carousels
    await spotifreePage.screenshot({
      path: path.join(artifactDir, 'spotifree-home-carousels.png'),
      fullPage: false,
    });
    console.log('Saved spotifree-home-carousels.png');

    // 2. Click on Search capsule's "Explorar" drawer button to open Explorar todo
    await spotifreePage.evaluate(() => {
      const exploreBtn = document.querySelector('button[title="Explorar"]');
      if (exploreBtn) exploreBtn.click();
    });
    await sleep(1200);

    // Capture Explorar todo view with rotated 25deg cards
    await spotifreePage.screenshot({
      path: path.join(artifactDir, 'spotifree-explorar-todo-rotated.png'),
      fullPage: false,
    });
    console.log('Saved spotifree-explorar-todo-rotated.png');
  }

  browser.disconnect();
}

run().catch(console.error);
