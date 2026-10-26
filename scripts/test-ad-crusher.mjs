import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

async function testAdCrusher() {
  const userDataDir = 'C:\\Users\\jorge\\.gemini\\antigravity\\ytm_profile';
  const devToolsPortFile = path.join(userDataDir, 'DevToolsActivePort');
  const portContent = fs.readFileSync(devToolsPortFile, 'utf8').trim().split('\n')[0];
  const port = parseInt(portContent, 10);
  const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}` });
  const page = (await browser.pages())[0];

  console.log('Injecting 50ms interval Ad Crusher into YTM page...');
  await page.evaluate(() => {
    if (window.__adCrusherInterval) clearInterval(window.__adCrusherInterval);

    window.__adCrusherInterval = setInterval(() => {
      const doc = document;
      const mp = window.movie_player;
      const v = doc.querySelector('video');
      if (!v) return;

      const isAd = !!doc.querySelector('.ad-showing, .ad-interrupting') || (mp && typeof mp.getAdState === 'function' && mp.getAdState() === 1);
      if (isAd) {
        v.muted = true;
        v.playbackRate = 16;
        if (mp && typeof mp.skipAd === 'function') {
          try { mp.skipAd(); } catch (e) {}
        }
        const skipBtn = doc.querySelector('.ytp-skip-ad-button, .ytp-ad-skip-button, .ytp-ad-skip-button-modern, [class*="skip-button"], button[id*="skip"]');
        if (skipBtn) {
          try { skipBtn.click(); } catch (e) {}
        }
      } else {
        if (v.playbackRate !== 1) v.playbackRate = 1;
        if (v.muted && v.volume > 0) v.muted = false;
      }
    }, 50);
  });

  console.log('Ad Crusher active. Monitoring for 60s...');
  for (let s = 0; s <= 60; s += 3) {
    await new Promise(r => setTimeout(r, 3000));
    const status = await page.evaluate(() => {
      const v = document.querySelector('video');
      const mp = window.movie_player;
      const isAd = !!document.querySelector('.ad-showing, .ad-interrupting') || (mp && typeof mp.getAdState === 'function' && mp.getAdState() === 1);
      return {
        sec: Math.round(v?.currentTime || 0),
        paused: v?.paused,
        muted: v?.muted,
        rate: v?.playbackRate,
        isAd,
        mpState: mp ? mp.getPlayerState() : null
      };
    });
    console.log(`t=${s}s:`, status);
  }
}

testAdCrusher().catch(console.error);
