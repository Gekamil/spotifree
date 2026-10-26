import puppeteer from 'puppeteer-core';
import path from 'node:path';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  let appPage = pages.find(p => p.url().includes('127.0.0.1:5173'));
  if (!appPage) appPage = await browser.newPage();

  // Navigate to Romeo & Prince
  await appPage.goto('http://127.0.0.1:5173/');
  await new Promise(r => setTimeout(r, 1500));

  // Click Romeo & Prince
  await appPage.evaluate(() => {
    const items = Array.from(document.querySelectorAll('aside p, aside span'));
    const romeo = items.find(el => el.textContent.trim() === 'Romeo & Prince');
    if (romeo) romeo.click();
  });

  await new Promise(r => setTimeout(r, 2000));

  // Click the big green play button
  const clickedPlay = await appPage.evaluate(() => {
    const playBtn = document.querySelector('button[title="Reproducir"]');
    if (playBtn) {
      playBtn.click();
      return true;
    }
    return false;
  });
  console.log('Clicked big green play button:', clickedPlay);

  await new Promise(r => setTimeout(r, 2500));

  // Check state
  const state = await appPage.evaluate(() => {
    const store = window.__usePlayerStore ? window.__usePlayerStore.getState() : null;
    return {
      isPlaying: store ? store.isPlaying : false,
      trackName: store?.currentTrack ? store.currentTrack.name : null,
      artist: store?.currentTrack?.artists?.[0]?.name,
      durationMs: store?.durationMs,
      progressMs: store?.progressMs,
      previewUrl: store?.currentTrack?.preview_url
    };
  });

  console.log('Playback state after clicking play:\n', JSON.stringify(state, null, 2));

  const screenshotPath = path.resolve('C:/Users/jorge/.gemini/antigravity/brain/b7d3ec29-c076-4935-90b5-23f42c286313/spotifree-romeo-playing-active.png');
  await appPage.screenshot({ path: screenshotPath });
  console.log('✓ Captured playback screenshot:', screenshotPath);

  browser.disconnect();
}

main().catch(console.error);
