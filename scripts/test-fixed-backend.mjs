import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

async function testFixedBackend() {
  const userDataDir = 'C:\\Users\\jorge\\.gemini\\antigravity\\ytm_profile';
  const ublockPath = path.resolve('extensions/ublock/uBlock0.chromium');

  // Close any existing instance
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
  const session = await page.createCDPSession();
  await session.send('Emulation.setFocusEmulationEnabled', { enabled: true });
  await session.send('Page.setWebLifecycleState', { state: 'active' });

  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(document, 'hidden', { get: () => false, configurable: true });
    Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });
    Object.defineProperty(document, 'webkitVisibilityState', { get: () => 'visible', configurable: true });
    window.addEventListener('visibilitychange', e => e.stopImmediatePropagation(), true);
    window.addEventListener('blur', e => e.stopImmediatePropagation(), true);
    document.hasFocus = () => true;
  });

  console.log('Navigating to music.youtube.com for Boza - Hecha Pa Mi (IOHh7vkX5O0)...');
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

  console.log('Monitoring playback with fixed backend for 80s...');
  let stalledCount = 0;
  for (let s = 0; s <= 80; s += 4) {
    await new Promise(r => setTimeout(r, 4000));
    const status = await page.evaluate(() => {
      const v = document.querySelector('video');
      const mp = window.movie_player;

      // Auto-recover if buffering
      const isBuffering = mp && mp.getPlayerState() === 3;
      if (isBuffering && v && v.currentTime >= 45) {
        mp.seekTo(v.currentTime + 0.5, true);
        mp.playVideo();
      }

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
    console.log(`t=${s}s:`, status);
  }

  browser.disconnect();
}

testFixedBackend().catch(console.error);
