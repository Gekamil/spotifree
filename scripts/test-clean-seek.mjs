import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

async function testCleanSeek() {
  const userDataDir = 'C:\\Users\\jorge\\.gemini\\antigravity\\ytm_profile';
  const port = parseInt(fs.readFileSync(path.join(userDataDir, 'DevToolsActivePort'), 'utf8').split('\n')[0].trim(), 10);
  const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}` });
  const page = (await browser.pages())[0];

  console.log('1. Loading Reina Pepiada from 0...');
  await page.evaluate(() => {
    const mp = document.getElementById('movie_player');
    if (mp && mp.loadVideoById) {
      mp.loadVideoById('Zn37zIBGv5M', 0);
      mp.playVideo();
    }
  });

  // Wait 3s until playing smoothly
  await new Promise(r => setTimeout(r, 3000));

  const s1 = await page.evaluate(() => {
    const v = document.querySelector('video');
    const mp = document.getElementById('movie_player');
    return { paused: v?.paused, ct: v?.currentTime, state: mp?.getPlayerState() };
  });
  console.log('Playing state:', s1);

  // Now seek to 30s
  console.log('2. Seeking to 30s with mp.seekTo(30, true)...');
  await page.evaluate(() => {
    const mp = document.getElementById('movie_player');
    if (mp && mp.seekTo) {
      mp.seekTo(30, true);
    }
  });

  for (let i = 1; i <= 6; i++) {
    await new Promise(r => setTimeout(r, 500));
    const s = await page.evaluate(() => {
      const v = document.querySelector('video');
      const mp = document.getElementById('movie_player');
      return { paused: v?.paused, ct: v?.currentTime, state: mp?.getPlayerState() };
    });
    console.log(`At +${i * 500}ms:`, s);
  }

  browser.disconnect();
}

testCleanSeek().catch(console.error);
