import puppeteer from 'puppeteer-core';

async function run() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const page = (await browser.pages()).find((p) => p.url().includes('5173'));
  if (!page) return console.log('Page not found');

  console.log('1. Clicking on playlist item in sidebar...');
  await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('div, button, a'));
    const liked = items.find((el) => el.textContent?.includes('Canciones que te gustan') && el.children.length > 0);
    if (liked) (liked).click();
  });

  await new Promise((r) => setTimeout(r, 1500));

  console.log('2. Clicking first track row...');
  const rowClick = await page.evaluate(() => {
    // Click track row play button or row itself
    const rows = document.querySelectorAll('[data-testid="track-row"]');
    if (rows && rows.length > 0) {
      const firstRow = rows[0];
      const playBtn = firstRow.querySelector('button[aria-label*="Reproducir"], [data-testid="play-button"]');
      if (playBtn) {
        (playBtn).click();
      } else {
        (firstRow).click();
      }
      return { clicked: true, trackText: firstRow.textContent?.slice(0, 60) };
    }
    return { clicked: false, rowCount: rows.length };
  });
  console.log('Row click:', rowClick);

  console.log('3. Waiting for song playback to start...');
  await new Promise((r) => setTimeout(r, 4000));

  const status = await page.evaluate(() => {
    const ae = window.__audioEngine;
    const store = window.__usePlayerStore?.getState?.();
    return {
      currentTrack: store?.currentTrack?.name,
      artist: store?.currentTrack?.artists?.[0]?.name,
      isPlaying: store?.isPlaying,
      audioPaused: ae?.audio?.paused,
      audioTime: ae?.audio?.currentTime,
      audioDuration: ae?.audio?.duration,
    };
  });
  console.log('Status after playlist track click:', status);

  await page.screenshot({ path: 'scripts/spotifree-playlist-track-verified.png' });
  console.log('4. Screenshot captured: scripts/spotifree-playlist-track-verified.png');
}

run().catch(console.error);
