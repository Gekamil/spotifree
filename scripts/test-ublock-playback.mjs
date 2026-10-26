import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

async function testWithUblock() {
  const userDataDir = 'C:\\Users\\jorge\\.gemini\\antigravity\\ytm_profile';
  const ublockPath = path.resolve('extensions/ublock/uBlock0.chromium');

  // Close existing instance if running
  const devToolsPortFile = path.join(userDataDir, 'DevToolsActivePort');
  if (fs.existsSync(devToolsPortFile)) {
    try {
      const portContent = fs.readFileSync(devToolsPortFile, 'utf8').trim().split('\n')[0];
      const port = parseInt(portContent, 10);
      const b = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}` });
      await b.close();
      console.log('Closed old browser instance.');
    } catch {}
    try { fs.unlinkSync(devToolsPortFile); } catch {}
  }

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  console.log('Launching new Chromium with uBlock Origin...');
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: false,
    userDataDir,
    args: [
      `--disable-extensions-except=${ublockPath}`,
      `--load-extension=${ublockPath}`,
      '--window-position=100,100',
      '--window-size=800,600',
      '--autoplay-policy=no-user-gesture-required',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--no-first-run',
      '--no-default-browser-check',
    ],
  });

  const pages = await browser.pages();
  const page = pages[0];

  console.log('Navigating to music.youtube.com/watch?v=IOHh7vkX5O0 (Boza - Hecha Pa Mi)...');
  await page.goto('https://music.youtube.com/watch?v=IOHh7vkX5O0', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('video', { timeout: 12000 });

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

  console.log('Monitoring playback with uBlock Origin every 5s up to 75s...');
  for (let s = 0; s <= 75; s += 5) {
    await new Promise(r => setTimeout(r, 5000));
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
        allRanges: timeRanges
      };
    });
    console.log(`With uBlock t=${s}s:`, status);
  }

  browser.disconnect();
}

testWithUblock().catch(console.error);
