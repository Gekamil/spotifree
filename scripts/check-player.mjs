import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

async function checkPlayer() {
  const userDataDir = 'C:\\Users\\jorge\\.gemini\\antigravity\\ytm_profile';
  const port = parseInt(fs.readFileSync(path.join(userDataDir, 'DevToolsActivePort'), 'utf8').split('\n')[0].trim(), 10);
  const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}` });
  const page = (await browser.pages())[0];
  const info = await page.evaluate(() => {
    const v = document.querySelector('video');
    return {
      paused: v?.paused,
      muted: v?.muted,
      currentTime: v?.currentTime,
      duration: v?.duration,
      readyState: v?.readyState,
      error: v?.error,
      playButton: document.querySelector('#play-pause-button')?.getAttribute('title'),
      modal: document.querySelector('tp-yt-paper-dialog')?.innerText,
    };
  });
  console.log('Video element details:', info);
  browser.disconnect();
}

checkPlayer().catch(console.error);
