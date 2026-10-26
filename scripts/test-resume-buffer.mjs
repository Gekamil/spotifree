import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

async function testResume() {
  const userDataDir = 'C:\\Users\\jorge\\.gemini\\antigravity\\ytm_profile';
  const devToolsPortFile = path.join(userDataDir, 'DevToolsActivePort');
  const port = parseInt(fs.readFileSync(devToolsPortFile, 'utf8').trim().split('\n')[0], 10);
  const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}` });
  const page = (await browser.pages())[0];

  console.log('Attempting to unstick player...');
  const res = await page.evaluate(() => {
    const v = document.querySelector('video');
    const mp = window.movie_player;
    if (mp && typeof mp.seekTo === 'function') {
      mp.seekTo(50.1, true);
      mp.playVideo();
    }
    return {
      ct: v?.currentTime,
      paused: v?.paused,
      readyState: v?.readyState,
    };
  });
  console.log('Immediate evaluate:', res);

  await new Promise((r) => setTimeout(r, 3000));

  const after = await page.evaluate(() => {
    const v = document.querySelector('video');
    const mp = window.movie_player;
    return {
      ct: v?.currentTime,
      paused: v?.paused,
      readyState: v?.readyState,
      bufferedEnd: v?.buffered?.length ? v.buffered.end(0) : 0,
      mpState: mp?.getPlayerState ? mp.getPlayerState() : null,
    };
  });
  console.log('After 3s:', after);
}
testResume().catch(console.error);
