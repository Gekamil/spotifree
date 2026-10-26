import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

async function checkScreen() {
  const userDataDir = 'C:\\Users\\jorge\\.gemini\\antigravity\\ytm_profile';
  const port = parseInt(fs.readFileSync(path.join(userDataDir, 'DevToolsActivePort'), 'utf8').split('\n')[0].trim(), 10);
  const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}` });
  const page = (await browser.pages())[0];
  await page.screenshot({ path: 'scripts/ytm-page-screenshot.png' });
  const info = await page.evaluate(() => {
    const v = document.querySelector('video');
    const mp = document.getElementById('movie_player');
    const title = document.querySelector('ytmusic-player-bar .title')?.innerText;
    const playBtn = document.querySelector('#play-pause-button');
    return {
      title,
      url: window.location.href,
      vPaused: v?.paused,
      vCurrentTime: v?.currentTime,
      vDuration: v?.duration,
      playBtnTitle: playBtn?.getAttribute('title'),
      adShowing: !!document.querySelector('.ad-showing, .ad-interrupting'),
    };
  });
  console.log('YTM Info:', info);
  browser.disconnect();
}

checkScreen().catch(console.error);
