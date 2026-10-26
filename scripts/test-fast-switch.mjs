import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

async function testFastSwitch() {
  const userDataDir = 'C:\\Users\\jorge\\.gemini\\antigravity\\ytm_profile';
  const port = parseInt(fs.readFileSync(path.join(userDataDir, 'DevToolsActivePort'), 'utf8').split('\n')[0].trim(), 10);
  const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}` });
  const page = (await browser.pages())[0];

  console.log('1. Testing instant song switch to "HfzbN5ky5Co" (La Diabla)...');
  const start = Date.now();
  const switchRes = await page.evaluate((vId) => {
    const mp = document.getElementById('movie_player');
    if (mp && typeof mp.loadVideoById === 'function') {
      mp.loadVideoById(vId);
      mp.playVideo();
      return { success: true, method: 'loadVideoById' };
    }
    return { success: false };
  }, 'HfzbN5ky5Co');
  const elapsed = Date.now() - start;
  console.log(`Switched in ${elapsed}ms:`, switchRes);

  await new Promise(r => setTimeout(r, 1500));

  const afterData = await page.evaluate(() => {
    const mp = document.getElementById('movie_player');
    const v = document.querySelector('video');
    return {
      title: mp?.getVideoData?.()?.title,
      author: mp?.getVideoData?.()?.author,
      ct: v?.currentTime,
      dur: v?.duration,
      paused: v?.paused,
    };
  });
  console.log('State after 1.5s:', afterData);

  browser.disconnect();
}

testFastSwitch().catch(console.error);
