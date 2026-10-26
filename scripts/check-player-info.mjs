import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

async function test() {
  const userDataDir = 'C:\\Users\\jorge\\.gemini\\antigravity\\ytm_profile';
  const port = parseInt(fs.readFileSync(path.join(userDataDir, 'DevToolsActivePort'), 'utf8').split('\n')[0].trim(), 10);
  const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}` });
  const page = (await browser.pages())[0];
  const info = await page.evaluate(() => {
    const mp = document.getElementById('movie_player');
    const v = document.querySelector('video');
    return {
      vDuration: v?.duration,
      vCurrentTime: v?.currentTime,
      mpDuration: mp?.getDuration ? mp.getDuration() : null,
      mpCurrentTime: mp?.getCurrentTime ? mp.getCurrentTime() : null,
      adState: mp?.getAdState ? mp.getAdState() : null,
      isAd: !!document.querySelector('.ad-showing, .ad-interrupting'),
      videoData: mp?.getVideoData ? mp.getVideoData() : null,
    };
  });
  console.log('Player Info:', JSON.stringify(info, null, 2));
  browser.disconnect();
}

test().catch(console.error);
