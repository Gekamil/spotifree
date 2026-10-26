import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

async function monitorEvents() {
  const devToolsPortFile = 'C:\\Users\\jorge\\.gemini\\antigravity\\ytm_profile\\DevToolsActivePort';
  const port = parseInt(fs.readFileSync(devToolsPortFile, 'utf8').trim().split('\n')[0], 10);
  const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}` });
  const page = (await browser.pages())[0];

  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.text().includes('error') || msg.text().includes('ad') || msg.text().includes('video')) {
      console.log('[BROWSER LOG]', msg.type(), msg.text().slice(0, 150));
    }
  });

  page.on('requestfailed', (req) => {
    console.log('[REQ FAILED]', req.url().slice(0, 100), req.failure()?.errorText);
  });

  console.log('Loading video from start and watching what causes reset...');
  await page.goto('https://www.youtube.com/watch?v=2_x_xgFuz1o', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('video', { timeout: 10000 });

  await page.evaluate(() => {
    const v = document.querySelector('video');
    const mp = window.movie_player;
    if (mp && typeof mp.playVideo === 'function') mp.playVideo();
    if (v) {
      v.muted = false;
      v.volume = 1;
      v.currentTime = 52;
      v.play();
    }
  });

  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const st = await page.evaluate(() => {
      const v = document.querySelector('video');
      const mp = window.movie_player;
      return {
        t: v?.currentTime,
        paused: v?.paused,
        src: v?.src ? 'has-src' : 'NO-SRC',
        mpState: mp?.getPlayerState ? mp.getPlayerState() : null,
      };
    });
    console.log(`Sec ${i}:`, st);
  }
}
monitorEvents().catch(console.error);
