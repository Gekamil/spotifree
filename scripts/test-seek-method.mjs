import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

async function testLoadWithTime() {
  const userDataDir = 'C:\\Users\\jorge\\.gemini\\antigravity\\ytm_profile';
  const port = parseInt(fs.readFileSync(path.join(userDataDir, 'DevToolsActivePort'), 'utf8').split('\n')[0].trim(), 10);
  const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}` });
  const page = (await browser.pages())[0];

  console.log('Testing loadVideoById with startSeconds = 60...');
  const res = await page.evaluate((pos) => {
    const mp = document.getElementById('movie_player');
    const v = document.querySelector('video');
    const vId = mp?.getVideoData()?.video_id || 'Zn37zIBGv5M';
    if (mp && mp.loadVideoById) {
      mp.loadVideoById(vId, pos);
      mp.playVideo();
      if (v) v.play().catch(() => {});
      return { success: true, vId, pos };
    }
    return { success: false };
  }, 60);
  console.log('Result:', res);

  for (let i = 1; i <= 5; i++) {
    await new Promise(r => setTimeout(r, 400));
    const s = await page.evaluate(() => {
      const v = document.querySelector('video');
      const mp = document.getElementById('movie_player');
      return {
        paused: v?.paused,
        currentTime: v?.currentTime,
        playerState: mp?.getPlayerState ? mp.getPlayerState() : null,
      };
    });
    console.log(`At +${i * 400}ms:`, s);
  }

  browser.disconnect();
}

testLoadWithTime().catch(console.error);
