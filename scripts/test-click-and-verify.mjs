import puppeteer from 'puppeteer-core';

async function run() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const page = (await browser.pages()).find((p) => p.url().includes('5173'));
  if (!page) return console.log('Page not found');

  console.log('1. Clicking on playlist item in sidebar...');
  await page.evaluate(() => {
    // Find sidebar playlist item with text 'Canciones que te gustan'
    const aside = document.querySelector('aside');
    const items = aside ? Array.from(aside.querySelectorAll('div[class*="cursor-pointer"]')) : [];
    const liked = items.find((el) => el.textContent?.includes('Canciones que te gustan'));
    if (liked) {
      (liked).click();
      console.log('Clicked Canciones que te gustan');
    }
  });

  console.log('2. Waiting for playlist view to render...');
  await page.waitForSelector('[data-testid="track-row"]', { timeout: 6000 }).catch(() => null);

  const rowCount = await page.evaluate(() => {
    return document.querySelectorAll('[data-testid="track-row"]').length;
  });
  console.log('Track rows count:', rowCount);

  if (rowCount > 0) {
    console.log('3. Clicking second track row...');
    const clickedInfo = await page.evaluate(() => {
      const rows = document.querySelectorAll('[data-testid="track-row"]');
      const targetRow = rows[1] || rows[0];
      targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
      (targetRow).click();
      return targetRow.textContent?.slice(0, 80);
    });
    console.log('Clicked track:', clickedInfo);

    console.log('4. Waiting 4s for audio to resolve and play...');
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
    console.log('Playback status after track click:', status);
  }

  await page.screenshot({ path: 'scripts/spotifree-playlist-verified-playback.png' });
  console.log('5. Screenshot saved: scripts/spotifree-playlist-verified-playback.png');
}

run().catch(console.error);
