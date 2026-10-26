import puppeteer from 'puppeteer-core';
import path from 'node:path';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  let appPage = pages.find(p => p.url().includes('127.0.0.1:5173'));
  if (!appPage) appPage = await browser.newPage();

  await appPage.setViewport({ width: 1440, height: 960 });
  await appPage.goto('http://127.0.0.1:5173/');

  // Wait for session and live shelves to load
  await new Promise(r => setTimeout(r, 2500));

  // Check state
  const state = await appPage.evaluate(() => {
    const store = window.__useSpotifyDataStore ? window.__useSpotifyDataStore.getState() : null;
    return {
      user: store?.user?.display_name,
      shelvesCount: store?.dynamicShelves?.length,
      shelves: store?.dynamicShelves?.map(s => ({
        title: s.title,
        subtitle: s.subtitle,
        cardsCount: s.cards?.length,
        firstCard: s.cards?.[0]?.title,
        hasRadio: s.cards?.some(c => c.isRadio)
      }))
    };
  });
  console.log('Live App State in Browser:\n', JSON.stringify(state, null, 2));

  // 1. Screenshot Home Top (Quick access + Recientes + Emisoras)
  const topPath = path.resolve('C:/Users/jorge/.gemini/antigravity/brain/b7d3ec29-c076-4935-90b5-23f42c286313/spotifree-live-full-feed-top.png');
  await appPage.screenshot({ path: topPath });
  console.log('✓ Captured top feed screenshot:', topPath);

  // 2. Scroll down to show "Emisoras recomendadas" and "Sumérgete de nuevo en tu música"
  await appPage.evaluate(() => {
    const main = document.querySelector('main > div');
    if (main) main.scrollBy(0, 500);
  });
  await new Promise(r => setTimeout(r, 1000));

  const midPath = path.resolve('C:/Users/jorge/.gemini/antigravity/brain/b7d3ec29-c076-4935-90b5-23f42c286313/spotifree-live-full-feed-mid.png');
  await appPage.screenshot({ path: midPath });
  console.log('✓ Captured mid feed screenshot with radio and video carousels:', midPath);

  // 3. Scroll down further to show "Tus mixes más escuchados" and "Más como Romeo Santos"
  await appPage.evaluate(() => {
    const main = document.querySelector('main > div');
    if (main) main.scrollBy(0, 600);
  });
  await new Promise(r => setTimeout(r, 1000));

  const bottomPath = path.resolve('C:/Users/jorge/.gemini/antigravity/brain/b7d3ec29-c076-4935-90b5-23f42c286313/spotifree-live-full-feed-bottom.png');
  await appPage.screenshot({ path: bottomPath });
  console.log('✓ Captured bottom feed screenshot:', bottomPath);

  browser.disconnect();
}

main().catch(console.error);
