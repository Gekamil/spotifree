import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

async function testWwwWithUblock() {
  const userDataDir = 'C:\\Users\\jorge\\.gemini\\antigravity\\ytm_profile';
  const ublockPath = path.resolve('extensions/ublock/uBlock0.chromium');

  const devToolsPortFile = path.join(userDataDir, 'DevToolsActivePort');
  if (fs.existsSync(devToolsPortFile)) {
    try {
      const portContent = fs.readFileSync(devToolsPortFile, 'utf8').trim().split('\n')[0];
      const port = parseInt(portContent, 10);
      const b = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}` });
      await b.close();
    } catch {}
    try { fs.unlinkSync(devToolsPortFile); } catch {}
  }

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  console.log('Launching Chrome with uBlock Origin...');
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

  const page = (await browser.pages())[0];

  console.log('Navigating to www.youtube.com/watch?v=IOHh7vkX5O0 with uBlock...');
  await page.goto('https://www.youtube.com/watch?v=IOHh7vkX5O0', { waitUntil: 'domcontentloaded' });
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

  console.log('Monitoring www.youtube.com with uBlock for 80s...');
  for (let s = 0; s <= 80; s += 5) {
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
        bufferEnd: timeRanges[0]?.end || null,
        timeRanges
      };
    });
    console.log(`www+uBlock t=${s}s:`, status);
  }

  browser.disconnect();
}

testWwwWithUblock().catch(console.error);
