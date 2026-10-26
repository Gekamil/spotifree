import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

async function testLifecycle() {
  const userDataDir = 'C:\\Users\\jorge\\.gemini\\antigravity\\ytm_profile';
  const devToolsPortFile = path.join(userDataDir, 'DevToolsActivePort');
  const portContent = fs.readFileSync(devToolsPortFile, 'utf8').trim().split('\n')[0];
  const port = parseInt(portContent, 10);
  const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}` });
  const page = (await browser.pages())[0];

  const session = await page.createCDPSession();
  await session.send('Emulation.setFocusEmulationEnabled', { enabled: true });
  await session.send('Page.setWebLifecycleState', { state: 'active' });
  console.log('CDP active lifecycle set.');

  // Try to click "Canción" toggle button on ytmusic-av-toggle
  await page.evaluate(() => {
    const toggle = document.querySelector('ytmusic-av-toggle');
    if (toggle) {
      const songBtn = Array.from(toggle.querySelectorAll('tp-yt-paper-tab, [role="tab"], button, div')).find(el => el.textContent?.includes('Canción'));
      if (songBtn) songBtn.click();
    }
    const mp = window.movie_player;
    if (mp && typeof mp.playVideo === 'function') mp.playVideo();
    const v = document.querySelector('video');
    if (v) {
      v.muted = false;
      v.volume = 1;
      v.play();
    }
  });

  console.log('Monitoring playback past 50s...');
  for (let s = 40; s <= 80; s += 2) {
    await new Promise(r => setTimeout(r, 2000));
    const status = await page.evaluate(() => {
      const v = document.querySelector('video');
      const mp = window.movie_player;
      const timeRanges = [];
      if (v && v.buffered) {
        for (let i = 0; i < v.buffered.length; i++) {
          timeRanges.push({ start: Math.round(v.buffered.start(i)), end: Math.round(v.buffered.end(i)) });
        }
      }

      // If stuck in buffering (mpState === 3), wake it up:
      if (mp && mp.getPlayerState() === 3 && v && v.currentTime >= 45) {
        mp.seekTo(v.currentTime + 0.1, true);
        mp.playVideo();
      }

      return {
        sec: Math.round(v?.currentTime || 0),
        paused: v?.paused,
        mpState: mp ? mp.getPlayerState() : null,
        bufferEnd: timeRanges[0]?.end || null,
        timeRanges
      };
    });
    console.log(`t=${s}s:`, status);
  }
}

testLifecycle().catch(console.error);
