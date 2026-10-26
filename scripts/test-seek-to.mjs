import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

async function testSeekTo() {
  const userDataDir = 'C:\\Users\\jorge\\.gemini\\antigravity\\ytm_profile';
  const devToolsPortFile = path.join(userDataDir, 'DevToolsActivePort');
  const portContent = fs.readFileSync(devToolsPortFile, 'utf8').trim().split('\n')[0];
  const port = parseInt(portContent, 10);
  const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}` });
  const page = (await browser.pages())[0];

  console.log('Testing movie_player.seekTo(70, true)...');
  await page.evaluate(() => {
    const mp = window.movie_player;
    if (mp && typeof mp.seekTo === 'function') {
      mp.seekTo(70, true);
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
        timeRanges.push({ start: v.buffered.start(i), end: v.buffered.end(i) });
      }
    }
    return {
      currentTime: v?.currentTime,
      mpCurrentTime: mp ? mp.getCurrentTime() : null,
      mpState: mp ? mp.getPlayerState() : null,
      paused: v?.paused,
      timeRanges
    };
  });
  console.log('Stats after mp.seekTo(70, true):', JSON.stringify(stats, null, 2));
}

testSeekTo().catch(console.error);
