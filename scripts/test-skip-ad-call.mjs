import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

async function testSkipAdCall() {
  const userDataDir = 'C:\\Users\\jorge\\.gemini\\antigravity\\ytm_profile';
  const devToolsPortFile = path.join(userDataDir, 'DevToolsActivePort');
  const port = parseInt(fs.readFileSync(devToolsPortFile, 'utf8').trim().split('\n')[0], 10);
  const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}` });
  const page = (await browser.pages())[0];

  console.log('Testing skipAd and unstick on page...');
  const res = await page.evaluate(() => {
    const mp = window.movie_player;
    const v = document.querySelector('video');
    const adState = mp?.getAdState ? mp.getAdState() : null;
    const playerState = mp?.getPlayerState ? mp.getPlayerState() : null;

    let skipped = false;
    if (mp && typeof mp.skipAd === 'function') {
      try {
        mp.skipAd();
        skipped = true;
      } catch (e) {}
    }

    if (v && v.paused) {
      v.play();
    }
    if (mp && typeof mp.playVideo === 'function') {
      mp.playVideo();
    }

    return {
      adState,
      playerState,
      skipped,
      ct: v?.currentTime,
    };
  });
  console.log('Result:', res);

  await new Promise((r) => setTimeout(r, 3000));

  const after = await page.evaluate(() => {
    const mp = window.movie_player;
    const v = document.querySelector('video');
    return {
      ct: Math.round(v?.currentTime || 0),
      dur: Math.round(v?.duration || 0),
      state: mp?.getPlayerState ? mp.getPlayerState() : null,
      adState: mp?.getAdState ? mp.getAdState() : null,
      bufferedEnd: v?.buffered?.length ? Math.round(v.buffered.end(v.buffered.length - 1)) : 0,
    };
  });
  console.log('After skipAd + 3s:', after);
}

testSkipAdCall().catch(console.error);
