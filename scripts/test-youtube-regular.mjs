import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

async function testRegularYouTube() {
  const userDataDir = 'C:\\Users\\jorge\\.gemini\\antigravity\\ytm_profile';
  const devToolsPortFile = path.join(userDataDir, 'DevToolsActivePort');
  const port = parseInt(fs.readFileSync(devToolsPortFile, 'utf8').trim().split('\n')[0], 10);
  const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}` });
  const page = (await browser.pages())[0];

  console.log('Navigating to standard youtube.com/watch?v=2_x_xgFuz1o ...');
  await page.goto('https://www.youtube.com/watch?v=2_x_xgFuz1o', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('video', { timeout: 12000 });

  await page.evaluate(() => {
    const v = document.querySelector('video');
    const mp = window.movie_player;
    if (mp && typeof mp.playVideo === 'function') mp.playVideo();
    if (v) {
      v.muted = false;
      v.volume = 1;
      v.currentTime = 45; // Jump right to 45s to see if it buffers past 50s!
      v.play();
    }
  });

  console.log('Jumped to 45s on youtube.com, monitoring...');
  for (let s = 45; s <= 90; s += 5) {
    await new Promise((r) => setTimeout(r, 5000));
    const status = await page.evaluate(() => {
      const v = document.querySelector('video');
      const mp = window.movie_player;
      return {
        sec: Math.round(v?.currentTime || 0),
        paused: v?.paused,
        mpState: mp?.getPlayerState ? mp.getPlayerState() : null,
        bufferedEnd: v?.buffered?.length ? Math.round(v.buffered.end(v.buffered.length - 1)) : 0,
      };
    });
    console.log(`Regular YT t=${s}s:`, status);
  }
}
testRegularYouTube().catch(console.error);
