import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

async function inspectAudioPage() {
  const userDataDir = 'C:\\Users\\jorge\\.gemini\\antigravity\\ytm_profile';
  const devToolsPortFile = path.join(userDataDir, 'DevToolsActivePort');
  const portContent = fs.readFileSync(devToolsPortFile, 'utf8').trim().split('\n')[0];
  const port = parseInt(portContent, 10);
  console.log('Connecting to YTM browser at port:', port);
  const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}` });
  const pages = await browser.pages();
  console.log('Open pages:', pages.map(p => p.url()));
  const page = pages[0];

  const info = await page.evaluate(() => {
    const doc = document;
    const v = doc.querySelector('video');
    const mp = window.movie_player || doc.getElementById('movie_player');
    return {
      url: window.location.href,
      vSrc: v ? v.src.slice(0, 50) : null,
      vCurrentTime: v ? v.currentTime : null,
      vDuration: v ? v.duration : null,
      vPaused: v ? v.paused : null,
      vMuted: v ? v.muted : null,
      vVolume: v ? v.volume : null,
      mpState: mp && typeof mp.getPlayerState === 'function' ? mp.getPlayerState() : null,
      mpAd: mp && typeof mp.getAdState === 'function' ? mp.getAdState() : null,
      error: doc.querySelector('.ytp-error')?.textContent || null,
      spinner: doc.querySelector('.ytp-spinner-message')?.textContent || null,
      popups: Array.from(doc.querySelectorAll('tp-yt-paper-dialog, ytmusic-popup-container, yt-confirm-dialog-renderer')).map(p => p.textContent?.trim().slice(0, 100))
    };
  });
  console.log('Audio page state:', JSON.stringify(info, null, 2));
}

inspectAudioPage().catch(console.error);
