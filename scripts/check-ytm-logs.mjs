import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

async function checkYtmLogs() {
  const userDataDir = 'C:\\Users\\jorge\\.gemini\\antigravity\\ytm_profile';
  const devToolsPortFile = path.join(userDataDir, 'DevToolsActivePort');
  const portContent = fs.readFileSync(devToolsPortFile, 'utf8').trim().split('\n')[0];
  const port = parseInt(portContent, 10);
  const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}` });
  const page = (await browser.pages())[0];

  const logData = await page.evaluate(() => {
    const mp = window.movie_player;
    const stats = mp && typeof mp.getVideoLoadedFraction === 'function' ? mp.getVideoLoadedFraction() : null;
    const buffer = mp && typeof mp.getVideoBytesLoaded === 'function' ? mp.getVideoBytesLoaded() : null;
    const media = document.querySelector('video');
    const timeRanges = [];
    if (media && media.buffered) {
      for (let i = 0; i < media.buffered.length; i++) {
        timeRanges.push({ start: media.buffered.start(i), end: media.buffered.end(i) });
      }
    }
    return {
      stats,
      buffer,
      timeRanges,
      currentTime: media ? media.currentTime : null,
      readyState: media ? media.readyState : null,
      networkState: media ? media.networkState : null
    };
  });

  console.log('Buffer and network stats:', JSON.stringify(logData, null, 2));
}

checkYtmLogs().catch(console.error);
