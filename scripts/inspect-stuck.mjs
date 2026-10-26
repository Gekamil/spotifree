import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

async function checkStuck() {
  const userDataDir = 'C:\\Users\\jorge\\.gemini\\antigravity\\ytm_profile';
  const devToolsPortFile = path.join(userDataDir, 'DevToolsActivePort');
  const port = parseInt(fs.readFileSync(devToolsPortFile, 'utf8').trim().split('\n')[0], 10);
  const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}` });
  const page = (await browser.pages())[0];

  const info = await page.evaluate(() => {
    const v = document.querySelector('video');
    const mp = window.movie_player;
    return {
      url: window.location.href,
      vCurrentTime: v?.currentTime,
      vPaused: v?.paused,
      vMuted: v?.muted,
      vVolume: v?.volume,
      mpState: mp?.getPlayerState ? mp.getPlayerState() : null,
      adState: mp?.getAdState ? mp.getAdState() : null,
      buffered: v?.buffered?.length ? [v.buffered.start(0), v.buffered.end(0)] : [],
      adShowing: !!document.querySelector('.ad-showing, .ad-interrupting'),
      popups: Array.from(document.querySelectorAll('ytmusic-popup-container, tp-yt-paper-dialog')).map((p) => p.textContent?.trim().slice(0, 100)),
    };
  });
  console.log('Stuck Page State:', JSON.stringify(info, null, 2));
}

checkStuck().catch(console.error);
