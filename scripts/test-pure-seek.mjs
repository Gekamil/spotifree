import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

async function testPureSeekTo() {
  const userDataDir = 'C:\\Users\\jorge\\.gemini\\antigravity\\ytm_profile';
  const port = parseInt(fs.readFileSync(path.join(userDataDir, 'DevToolsActivePort'), 'utf8').split('\n')[0].trim(), 10);
  const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}` });
  const page = (await browser.pages())[0];

  console.log('1. Loading Reina Pepiada fresh...');
  await page.evaluate(() => {
    const mp = document.getElementById('movie_player');
    if (mp && mp.loadVideoById) {
      mp.loadVideoById('Zn37zIBGv5M');
      mp.playVideo();
    }
  });

  await new Promise(r => setTimeout(r, 2000));

  // Skip any ad
  await page.evaluate(() => {
    const v = document.querySelector('video');
    const skipBtn = document.querySelector('.ytp-skip-ad-button, .ytp-ad-skip-button, .ytp-ad-skip-button-modern');
    if (skipBtn) skipBtn.click();
    if (document.querySelector('.ad-showing') && v) v.currentTime = v.duration;
  });

  await new Promise(r => setTimeout(r, 1500));

  const statePlaying = await page.evaluate(() => {
    const v = document.querySelector('video');
    const mp = document.getElementById('movie_player');
    return {
      paused: v?.paused,
      currentTime: v?.currentTime,
      playerState: mp?.getPlayerState(),
    };
  });
  console.log('State before seek:', statePlaying);

  console.log('2. Seeking to 65s using ONLY mp.seekTo(65, true)...');
  await page.evaluate(() => {
    const mp = document.getElementById('movie_player');
    if (mp && mp.seekTo) {
      mp.seekTo(65, true);
    }
  });

  for (let i = 1; i <= 5; i++) {
    await new Promise(r => setTimeout(r, 500));
    const s = await page.evaluate(() => {
      const v = document.querySelector('video');
      const mp = document.getElementById('movie_player');
      return {
        paused: v?.paused,
        currentTime: v?.currentTime,
        playerState: mp?.getPlayerState(),
      };
    });
    console.log(`At +${i * 500}ms:`, s);
  }

  browser.disconnect();
}

testPureSeekTo().catch(console.error);
