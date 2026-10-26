import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

async function testMoveWindow() {
  const userDataDir = 'C:\\Users\\jorge\\.gemini\\antigravity\\ytm_profile';
  const devToolsPortFile = path.join(userDataDir, 'DevToolsActivePort');
  const portContent = fs.readFileSync(devToolsPortFile, 'utf8').trim().split('\n')[0];
  const port = parseInt(portContent, 10);
  const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}` });
  const page = (await browser.pages())[0];

  const session = await page.createCDPSession();
  const { windowId } = await session.send('Browser.getWindowForTarget');
  console.log('Window ID:', windowId);
  
  // Set bounds to normal on-screen coordinates
  await session.send('Browser.setWindowBounds', {
    windowId,
    bounds: {
      left: 100,
      top: 100,
      width: 800,
      height: 600,
      windowState: 'normal'
    }
  });

  console.log('Window moved to normal 100,100. Reloading track to test playback past 60s...');
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

  console.log('Monitoring playback every 4s up to 72s...');
  for (let s = 0; s <= 72; s += 4) {
    await new Promise(r => setTimeout(r, 4000));
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
        bufferEnd: timeRanges[0]?.end || null,
      };
    });
    console.log(`t=${s}s:`, status);
  }
}

testMoveWindow().catch(console.error);
