import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

async function testRafFix() {
  const userDataDir = 'C:\\Users\\jorge\\.gemini\\antigravity\\ytm_profile';
  const devToolsPortFile = path.join(userDataDir, 'DevToolsActivePort');
  const port = parseInt(fs.readFileSync(devToolsPortFile, 'utf8').trim().split('\n')[0], 10);
  const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}` });
  const page = await browser.newPage();

  // Patch requestAnimationFrame so background throttling CANNOT freeze YouTube's DASH loop!
  await page.evaluateOnNewDocument(() => {
    let lastTime = performance.now();
    window.requestAnimationFrame = function (callback) {
      const currTime = performance.now();
      const timeToCall = Math.max(0, 16 - (currTime - lastTime));
      const id = window.setTimeout(() => {
        callback(currTime + timeToCall);
      }, timeToCall);
      lastTime = currTime + timeToCall;
      return id;
    };
    window.cancelAnimationFrame = function (id) {
      clearTimeout(id);
    };

    Object.defineProperty(document, 'hidden', { get: () => false });
    Object.defineProperty(document, 'visibilityState', { get: () => 'visible' });
    document.hasFocus = () => true;
  });

  console.log('Navigating with unthrottled requestAnimationFrame...');
  await page.goto('https://music.youtube.com/watch?v=2_x_xgFuz1o', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('video', { timeout: 12000 });

  await page.evaluate(() => {
    const v = document.querySelector('video');
    const mp = window.movie_player;
    if (mp && typeof mp.playVideo === 'function') mp.playVideo();
    if (v) {
      v.muted = false;
      v.volume = 1;
      v.currentTime = 45; // Start at 45s
      v.play();
    }
  });

  console.log('Monitoring playback past 60s with RAF polyfill...');
  for (let s = 45; s <= 90; s += 5) {
    await new Promise((r) => setTimeout(r, 5000));
    const st = await page.evaluate(() => {
      const v = document.querySelector('video');
      const mp = window.movie_player;
      return {
        sec: Math.round(v?.currentTime || 0),
        paused: v?.paused,
        dur: Math.round(v?.duration || 0),
        mpState: mp?.getPlayerState ? mp.getPlayerState() : null,
        bufferedEnd: v?.buffered?.length ? Math.round(v.buffered.end(v.buffered.length - 1)) : 0,
      };
    });
    console.log(`t=${s}s:`, st);
  }

  await page.close();
}

testRafFix().catch(console.error);
