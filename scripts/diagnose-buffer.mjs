import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

async function diagnose() {
  const userDataDir = 'C:\\Users\\jorge\\.gemini\\antigravity\\ytm_profile';
  const devToolsPortFile = path.join(userDataDir, 'DevToolsActivePort');
  const port = parseInt(fs.readFileSync(devToolsPortFile, 'utf8').trim().split('\n')[0], 10);
  const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}` });
  const page = (await browser.pages())[0];

  const diag = await page.evaluate(() => {
    const v = document.querySelector('video');
    const mp = window.movie_player;
    const ranges = [];
    if (v && v.buffered) {
      for (let i = 0; i < v.buffered.length; i++) {
        ranges.push({ start: v.buffered.start(i), end: v.buffered.end(i) });
      }
    }
    return {
      currentTime: v?.currentTime,
      duration: v?.duration,
      paused: v?.paused,
      ended: v?.ended,
      readyState: v?.readyState,
      networkState: v?.networkState,
      error: v?.error ? { code: v.error.code, message: v.error.message } : null,
      ranges,
      mpState: mp?.getPlayerState ? mp.getPlayerState() : null,
      statsForNerds: mp?.getStatsForNerds ? mp.getStatsForNerds() : null,
      playbackQuality: mp?.getPlaybackQuality ? mp.getPlaybackQuality() : null,
    };
  });
  console.log('Buffer Diagnosis:', JSON.stringify(diag, null, 2));
}
diagnose().catch(console.error);
