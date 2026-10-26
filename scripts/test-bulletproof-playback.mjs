import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

async function testBulletproof() {
  const userDataDir = 'C:\\Users\\jorge\\.gemini\\antigravity\\ytm_profile';
  const devToolsPortFile = path.join(userDataDir, 'DevToolsActivePort');
  const port = parseInt(fs.readFileSync(devToolsPortFile, 'utf8').trim().split('\n')[0], 10);
  const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}` });
  const page = await browser.newPage();

  // 1. CDP Network Block
  const session = await page.createCDPSession();
  await session.send('Network.enable');
  await session.send('Network.setBlockedURLs', {
    urls: [
      '*googleads*',
      '*doubleclick.net*',
      '*/pagead/*',
      '*ad_break*',
      '*ptracking*',
      '*/api/stats/ads*',
      '*&ad_type=*',
      '*youtube.com/pagead/*',
      '*youtube.com/api/stats/ads*',
      '*youtube.com/get_midroll_info*',
    ],
  });
  await session.send('Page.setWebLifecycleState', { state: 'active' });
  await session.send('Emulation.setFocusEmulationEnabled', { enabled: true });

  // 2. Ad Stripper
  await page.evaluateOnNewDocument(() => {
    let _pr = window.ytInitialPlayerResponse;
    Object.defineProperty(window, 'ytInitialPlayerResponse', {
      get: () => _pr,
      set: (val) => {
        if (val) {
          if (val.adPlacements) val.adPlacements = [];
          delete val.playerAds;
          delete val.adSlots;
        }
        _pr = val;
      },
      configurable: true,
    });

    const origParse = JSON.parse;
    JSON.parse = function (...args) {
      const res = origParse.apply(this, args);
      if (res && typeof res === 'object') {
        if (res.adPlacements) res.adPlacements = [];
        if (res.playerAds) delete res.playerAds;
        if (res.adSlots) delete res.adSlots;
      }
      return res;
    };

    const origJson = Response.prototype.json;
    Response.prototype.json = async function () {
      const data = await origJson.call(this);
      if (data && typeof data === 'object') {
        if (data.adPlacements) data.adPlacements = [];
        if (data.playerAds) delete data.playerAds;
        if (data.adSlots) delete data.adSlots;
      }
      return data;
    };

    Object.defineProperty(document, 'hidden', { get: () => false });
    Object.defineProperty(document, 'visibilityState', { get: () => 'visible' });
    document.hasFocus = () => true;
  });

  console.log('Navigating to Boza - Hecha Pa Mi on YouTube Music...');
  await page.goto('https://music.youtube.com/watch?v=2_x_xgFuz1o', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('video', { timeout: 12000 });

  await page.evaluate(() => {
    const v = document.querySelector('video');
    const mp = window.movie_player;
    if (mp && typeof mp.playVideo === 'function') mp.playVideo();
    if (v) {
      v.muted = false;
      v.volume = 1;
      v.currentTime = 50; // Jump right to 50s!
      v.play();
    }
  });

  console.log('Monitoring playback from 50s through 90s...');
  for (let s = 50; s <= 90; s += 4) {
    await new Promise((r) => setTimeout(r, 4000));
    const st = await page.evaluate(() => {
      const v = document.querySelector('video');
      const mp = window.movie_player;
      return {
        sec: Math.round(v?.currentTime || 0),
        paused: v?.paused,
        dur: Math.round(v?.duration || 0),
        mpState: mp?.getPlayerState ? mp.getPlayerState() : null,
        adState: mp?.getAdState ? mp.getAdState() : null,
        bufferedEnd: v?.buffered?.length ? Math.round(v.buffered.end(v.buffered.length - 1)) : 0,
        isAdShowing: !!document.querySelector('.ad-showing, .ad-interrupting'),
      };
    });
    console.log(`t=${s}s:`, st);
  }

  await page.close();
}
testBulletproof().catch(console.error);
