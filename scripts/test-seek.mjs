import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

async function testSeek() {
  const userDataDir = 'C:\\Users\\jorge\\.gemini\\antigravity\\ytm_profile';
  const port = parseInt(fs.readFileSync(path.join(userDataDir, 'DevToolsActivePort'), 'utf8').split('\n')[0].trim(), 10);
  const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}` });
  const page = (await browser.pages())[0];

  console.log('1. Checking current playback state before seek...');
  const before = await page.evaluate(() => {
    const v = document.querySelector('video');
    const mp = document.getElementById('movie_player');
    return {
      paused: v?.paused,
      currentTime: v?.currentTime,
      duration: v?.duration,
      mpDuration: mp?.getDuration ? mp.getDuration() : null,
      playerState: mp?.getPlayerState ? mp.getPlayerState() : null,
    };
  });
  console.log('Before seek:', before);

  console.log('2. Seeking to 60 seconds via mp.seekTo(60, true)...');
  await page.evaluate(() => {
    const mp = document.getElementById('movie_player');
    const v = document.querySelector('video');
    if (mp && typeof mp.seekTo === 'function') {
      mp.seekTo(60, true);
      mp.playVideo();
    } else if (v) {
      v.currentTime = 60;
      v.play().catch(() => {});
    }
  });

  for (let step = 1; step <= 5; step++) {
    await new Promise(r => setTimeout(r, 500));
    const state = await page.evaluate((s) => {
      const v = document.querySelector('video');
      const mp = document.getElementById('movie_player');
      return {
        step: s,
        paused: v?.paused,
        currentTime: v?.currentTime,
        playerState: mp?.getPlayerState ? mp.getPlayerState() : null,
      };
    }, step);
    console.log(`State at +${step * 500}ms:`, state);
  }

  browser.disconnect();
}

testSeek().catch(console.error);
