import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

async function testSeekWhilePlaying() {
  const userDataDir = 'C:\\Users\\jorge\\.gemini\\antigravity\\ytm_profile';
  const port = parseInt(fs.readFileSync(path.join(userDataDir, 'DevToolsActivePort'), 'utf8').split('\n')[0].trim(), 10);
  const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}` });
  const page = (await browser.pages())[0];

  console.log('1. Ensuring video is playing...');
  await page.evaluate(() => {
    const mp = document.getElementById('movie_player');
    const v = document.querySelector('video');
    if (mp && mp.playVideo) mp.playVideo();
    if (v) v.play().catch(() => {});
  });
  await new Promise(r => setTimeout(r, 2000));

  const state1 = await page.evaluate(() => {
    const v = document.querySelector('video');
    const mp = document.getElementById('movie_player');
    return {
      paused: v?.paused,
      currentTime: v?.currentTime,
      playerState: mp?.getPlayerState ? mp.getPlayerState() : null,
    };
  });
  console.log('Initial Playing State:', state1);

  console.log('2. Seeking to 75 seconds...');
  const seekRes = await page.evaluate((target) => {
    const v = document.querySelector('video');
    const mp = document.getElementById('movie_player');
    if (v) {
      if (mp && mp.seekTo) {
        mp.seekTo(target, true);
        mp.playVideo();
      } else {
        v.currentTime = target;
        v.play().catch(() => {});
      }
      return { success: true, ct: v.currentTime };
    }
    return { success: false };
  }, 75);
  console.log('Seek result:', seekRes);

  for (let i = 1; i <= 6; i++) {
    await new Promise(r => setTimeout(r, 400));
    const s = await page.evaluate((stepNum) => {
      const v = document.querySelector('video');
      const mp = document.getElementById('movie_player');
      return {
        step: stepNum,
        paused: v?.paused,
        currentTime: v?.currentTime,
        playerState: mp?.getPlayerState ? mp.getPlayerState() : null,
      };
    }, i);
    console.log(`At +${i * 400}ms:`, s);
  }

  browser.disconnect();
}

testSeekWhilePlaying().catch(console.error);
