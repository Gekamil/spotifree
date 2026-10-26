import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

async function monitor() {
  const userDataDir = 'C:\\Users\\jorge\\.gemini\\antigravity\\ytm_profile';
  const devToolsPortFile = path.join(userDataDir, 'DevToolsActivePort');
  const portContent = fs.readFileSync(devToolsPortFile, 'utf8').trim().split('\n')[0];
  const port = parseInt(portContent, 10);
  const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}` });
  const page = (await browser.pages())[0];

  console.log('Navigating to music.youtube.com for Boza - Hecha Pa Mi (IOHh7vkX5O0)...');
  await page.goto('https://music.youtube.com/watch?v=IOHh7vkX5O0', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('video', { timeout: 10000 });

  await page.evaluate(() => {
    const v = document.querySelector('video');
    const mp = window.movie_player;
    if (mp && typeof mp.playVideo === 'function') mp.playVideo();
    if (v) {
      v.muted = false;
      v.volume = 1;
      v.play();
    }
  });

  console.log('Monitoring playback every 3s up to 75s...');
  for (let s = 0; s <= 75; s += 3) {
    await new Promise(r => setTimeout(r, 3000));
    const status = await page.evaluate(() => {
      const v = document.querySelector('video');
      const mp = window.movie_player;
      const timeRanges = [];
      if (v && v.buffered) {
        for (let i = 0; i < v.buffered.length; i++) {
          timeRanges.push({ start: Math.round(v.buffered.start(i)), end: Math.round(v.buffered.end(i)) });
        }
      }
      return {
        sec: Math.round(v?.currentTime || 0),
        paused: v?.paused,
        mpState: mp ? mp.getPlayerState() : null,
        ad: mp ? mp.getAdState() : null,
        bufferEnd: timeRanges[0]?.end || null,
        dialog: !!document.querySelector('tp-yt-paper-dialog[aria-hidden="false"], ytmusic-popup-container yt-confirm-dialog-renderer')
      };
    });
    console.log(`t=${s}s:`, status);
    if (status.paused || status.mpState === 3 || status.mpState === 2) {
      // Check why it paused/buffered
      const errorMsg = await page.evaluate(() => {
        return {
          errorMsg: document.querySelector('.ytp-error')?.textContent || null,
          dialogs: Array.from(document.querySelectorAll('tp-yt-paper-dialog, yt-confirm-dialog-renderer')).map(d => d.textContent?.trim()).filter(Boolean)
        };
      });
      console.log('Pause details:', errorMsg);
    }
  }
}

monitor().catch(console.error);
