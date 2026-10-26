import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

async function diagnoseMse() {
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
      readyState: v?.readyState,
      networkState: v?.networkState,
      error: v?.error ? { code: v.error.code, message: v.error.message } : null,
      statsForNerds: mp && typeof mp.getVideoStats === 'function' ? mp.getVideoStats() : null,
      audioTrack: v?.audioTracks ? v.audioTracks.length : null,
      volume: v?.volume,
      muted: v?.muted,
      paused: v?.paused,
      playbackRate: v?.playbackRate,
      spinner: document.querySelector('.ytp-spinner-message')?.textContent || null
    };
  });

  console.log('MSE Diagnostic:', JSON.stringify(diag, null, 2));
}

diagnoseMse().catch(console.error);
