import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

async function checkNetwork() {
  const userDataDir = 'C:\\Users\\jorge\\.gemini\\antigravity\\ytm_profile';
  const devToolsPortFile = path.join(userDataDir, 'DevToolsActivePort');
  const port = parseInt(fs.readFileSync(devToolsPortFile, 'utf8').trim().split('\n')[0], 10);
  const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}` });
  const page = (await browser.pages())[0];

  const session = await page.createCDPSession();
  await session.send('Network.enable');

  session.on('Network.loadingFailed', (params) => {
    console.log('[BLOCKED / FAILED]', params.errorText, params.canceled, params.blockedReason);
  });

  session.on('Network.requestWillBeSent', (params) => {
    const url = params.request.url;
    if (url.includes('videoplayback') || url.includes('player') || url.includes('qoe') || url.includes('watch')) {
      console.log('[REQ]', url.slice(0, 100));
    }
  });

  console.log('Testing nudge at 55.2s...');
  const res = await page.evaluate(() => {
    const mp = window.movie_player;
    const v = document.querySelector('video');
    if (mp && typeof mp.playVideo === 'function') mp.playVideo();
    return {
      ct: v?.currentTime,
      state: mp?.getPlayerState ? mp.getPlayerState() : null,
    };
  });
  console.log('Current state before nudge:', res);

  // Nudge forward by 1 second to see if next chunk is requested
  await page.evaluate(() => {
    const mp = window.movie_player;
    if (mp && typeof mp.seekTo === 'function') {
      mp.seekTo(56, true);
      mp.playVideo();
    }
  });

  await new Promise((r) => setTimeout(r, 4000));

  const after = await page.evaluate(() => {
    const v = document.querySelector('video');
    const mp = window.movie_player;
    return {
      ct: v?.currentTime,
      state: mp?.getPlayerState ? mp.getPlayerState() : null,
      buffered: v?.buffered?.length ? [v.buffered.start(0), v.buffered.end(0)] : [],
    };
  });
  console.log('After nudge to 56s:', after);
}

checkNetwork().catch(console.error);
