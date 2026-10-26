import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

async function checkWhyReset() {
  const userDataDir = 'C:\\Users\\jorge\\.gemini\\antigravity\\ytm_profile';
  const devToolsPortFile = path.join(userDataDir, 'DevToolsActivePort');
  const portContent = fs.readFileSync(devToolsPortFile, 'utf8').trim().split('\n')[0];
  const port = parseInt(portContent, 10);
  const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}` });
  const page = (await browser.pages())[0];

  const diag = await page.evaluate(() => {
    const v = document.querySelector('video');
    const mp = window.movie_player;
    return {
      url: window.location.href,
      vSrc: v?.src,
      vCurrentTime: v?.currentTime,
      vDuration: v?.duration,
      vPaused: v?.paused,
      mpState: mp ? mp.getPlayerState() : null,
      errorText: document.querySelector('.ytp-error, .ytp-error-content, ytd-player #error-screen')?.textContent || null,
      overlayText: document.querySelector('.ytp-ad-overlay-container, .ytp-ad-text, .ytp-ad-preview-text')?.textContent || null,
      adShowing: !!document.querySelector('.ad-showing, .ad-interrupting'),
    };
  });
  console.log('Page state at reset:', JSON.stringify(diag, null, 2));
}

checkWhyReset().catch(console.error);
