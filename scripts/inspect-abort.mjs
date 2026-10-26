import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

async function inspectAbort() {
  const userDataDir = 'C:\\Users\\jorge\\.gemini\\antigravity\\ytm_profile';
  const devToolsPortFile = path.join(userDataDir, 'DevToolsActivePort');
  const portContent = fs.readFileSync(devToolsPortFile, 'utf8').trim().split('\n')[0];
  const port = parseInt(portContent, 10);
  const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}` });
  const page = (await browser.pages())[0];

  const info = await page.evaluate(() => {
    const v = document.querySelector('video');
    const mp = window.movie_player;
    return {
      vSrc: v?.src,
      readyState: v?.readyState,
      networkState: v?.networkState,
      error: v?.error,
      currentTime: v?.currentTime,
      duration: v?.duration,
      stats: mp?.getVideoStats ? mp.getVideoStats() : null
    };
  });
  console.log('Abort info:', info);
}

inspectAbort().catch(console.error);
