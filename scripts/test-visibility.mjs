import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

async function testVisibilityAndPlayback() {
  const userDataDir = 'C:\\Users\\jorge\\.gemini\\antigravity\\ytm_profile';
  const devToolsPortFile = path.join(userDataDir, 'DevToolsActivePort');
  const portContent = fs.readFileSync(devToolsPortFile, 'utf8').trim().split('\n')[0];
  const port = parseInt(portContent, 10);
  const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}` });
  const page = (await browser.pages())[0];

  // Inspect what document.visibilityState and document.hidden are currently
  const vis = await page.evaluate(() => {
    return {
      hidden: document.hidden,
      visibilityState: document.visibilityState,
      hasFocus: document.hasFocus()
    };
  });
  console.log('Current page visibility:', vis);

  // Now, inject visibility spoofing:
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { get: () => false, configurable: true });
    Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });
    Object.defineProperty(document, 'webkitVisibilityState', { get: () => 'visible', configurable: true });
    window.addEventListener('visibilitychange', (e) => e.stopImmediatePropagation(), true);
    window.addEventListener('blur', (e) => e.stopImmediatePropagation(), true);
    document.hasFocus = () => true;

    // Trigger focus event
    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange'));

    // Resume video
    const mp = window.movie_player;
    if (mp && typeof mp.playVideo === 'function') mp.playVideo();
    const v = document.querySelector('video');
    if (v) {
      v.play();
    }
  });

  console.log('Injected visibility spoof. Waiting 5s to see if buffer increases...');
  await new Promise(r => setTimeout(r, 5000));

  const afterStats = await page.evaluate(() => {
    const media = document.querySelector('video');
    const timeRanges = [];
    if (media && media.buffered) {
      for (let i = 0; i < media.buffered.length; i++) {
        timeRanges.push({ start: media.buffered.start(i), end: media.buffered.end(i) });
      }
    }
    const mp = window.movie_player;
    return {
      currentTime: media?.currentTime,
      paused: media?.paused,
      timeRanges,
      mpState: mp ? mp.getPlayerState() : null,
      spinner: document.querySelector('.ytp-spinner-message')?.textContent || null
    };
  });

  console.log('After stats:', JSON.stringify(afterStats, null, 2));
}

testVisibilityAndPlayback().catch(console.error);
