import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

async function testLoad() {
  const userDataDir = 'C:\\Users\\jorge\\.gemini\\antigravity\\ytm_profile';
  const devToolsPortFile = path.join(userDataDir, 'DevToolsActivePort');
  const portContent = fs.readFileSync(devToolsPortFile, 'utf8').trim().split('\n')[0];
  const port = parseInt(portContent, 10);
  const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}` });
  const page = (await browser.pages())[0];

  console.log('Calling mp.loadVideoById with startSeconds = 50...');
  await page.evaluate(() => {
    const mp = window.movie_player;
    if (mp) {
      mp.loadVideoById('IOHh7vkX5O0', 50);
      mp.playVideo();
    }
  });

  await new Promise(r => setTimeout(r, 4000));

  const stats = await page.evaluate(() => {
    const v = document.querySelector('video');
    const mp = window.movie_player;
    const timeRanges = [];
    if (v && v.buffered) {
      for (let i = 0; i < v.buffered.length; i++) {
        timeRanges.push({ start: Math.round(v.buffered.start(i)), end: Math.round(v.buffered.end(i)) });
      }
    }
    return {
      currentTime: v?.currentTime,
      mpState: mp ? mp.getPlayerState() : null,
      timeRanges
    };
  });
  console.log('Stats after loadVideoById(50):', stats);
}

testLoad().catch(console.error);
