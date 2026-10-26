import puppeteer from 'puppeteer-core';

async function run() {
  console.log('1. Connecting to port 9222...');
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const page = (await browser.pages()).find((p) => p.url().includes('5173'));
  if (!page) throw new Error('Page not found on 5173');

  console.log('2. Clicking liked-songs in left sidebar...');
  const clicked = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="playlist-item-liked-songs"]');
    if (el) {
      (el).click();
      return true;
    }
    // Fallback: search by text
    const all = Array.from(document.querySelectorAll('div, a, button'));
    const match = all.find(e => e.textContent?.trim() === 'Canciones que te gustan' && e.children.length === 0);
    if (match) {
      match.click();
      return true;
    }
    return false;
  });
  console.log('Playlist clicked:', clicked);

  console.log('3. Waiting for track rows...');
  await page.waitForSelector('[data-testid="track-row"]', { timeout: 8000 });
  const rowCount = await page.evaluate(() => document.querySelectorAll('[data-testid="track-row"]').length);
  console.log('Found track rows:', rowCount);

  console.log('4. Clicking on track row 0...');
  const trackName = await page.evaluate(() => {
    const row = document.querySelectorAll('[data-testid="track-row"]')[0];
    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    (row).click();
    return row.querySelector('p')?.textContent;
  });
  console.log('Clicked track name:', trackName);

  console.log('5. Waiting 4s for playback...');
  await new Promise(r => setTimeout(r, 4000));

  const initialStatus = await page.evaluate(() => {
    const ae = window.__audioEngine;
    const store = window.__usePlayerStore?.getState();
    return {
      track: store?.currentTrack?.name,
      artist: store?.currentTrack?.artists?.[0]?.name,
      isPlaying: store?.isPlaying,
      currentTime: ae?.audio?.currentTime,
      duration: ae?.audio?.duration,
      paused: ae?.audio?.paused,
    };
  });
  console.log('Initial playback status:', initialStatus);

  console.log('6. Seeking to 65s (past the 59s boundary!)...');
  await page.evaluate(() => {
    window.__audioEngine?.seek(65);
  });

  await new Promise(r => setTimeout(r, 2000));
  const postSeek = await page.evaluate(() => {
    const ae = window.__audioEngine;
    return {
      currentTime: ae?.audio?.currentTime,
      paused: ae?.audio?.paused,
    };
  });
  console.log('Immediately after seek:', postSeek);

  console.log('7. Monitoring unbroken playback past 75s...');
  for (let i = 1; i <= 3; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const tick = await page.evaluate(() => {
      const ae = window.__audioEngine;
      return {
        currentTime: ae?.audio?.currentTime,
        paused: ae?.audio?.paused,
      };
    });
    console.log(`t=+${i * 3}s:`, tick);
  }

  await page.screenshot({ path: 'scripts/final-verification-e2e.png' });
  console.log('8. Screenshot captured: scripts/final-verification-e2e.png');
}

run().catch((e) => {
  console.error('Test failed:', e);
  process.exit(1);
});
