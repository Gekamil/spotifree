import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const spotifreePage = pages.find(p => p.url().includes('5173'));

  if (!spotifreePage) return;
  await spotifreePage.bringToFront();

  // Click Search input or explore button
  await spotifreePage.click('input[placeholder*="reproducir"]');
  await new Promise(r => setTimeout(r, 400));

  const artifactDir = 'C:/Users/jorge/.gemini/antigravity/brain/b7d3ec29-c076-4935-90b5-23f42c286313';
  await spotifreePage.screenshot({
    path: `${artifactDir}/spotifree-search-active.png`,
  });

  console.log('Search active screenshot captured');

  // Click home again to return
  await spotifreePage.click('button[title="Inicio"]');
  await new Promise(r => setTimeout(r, 400));

  browser.disconnect();
}

main().catch(console.error);
