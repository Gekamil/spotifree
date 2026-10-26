import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

async function testAdSkip() {
  const userDataDir = 'C:\\Users\\jorge\\.gemini\\antigravity\\ytm_profile';
  const port = parseInt(fs.readFileSync(path.join(userDataDir, 'DevToolsActivePort'), 'utf8').split('\n')[0].trim(), 10);
  const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}` });
  const page = (await browser.pages())[0];

  const before = await page.evaluate(() => {
    const v = document.querySelector('video');
    const mp = document.getElementById('movie_player');
    const isAd = !!document.querySelector('.ad-showing, .ad-interrupting');
    return { isAd, vDuration: v?.duration, vCurrentTime: v?.currentTime, mpDuration: mp?.getDuration() };
  });
  console.log('Before skip attempt:', before);

  // Skip ad
  const res = await page.evaluate(() => {
    const v = document.querySelector('video');
    const skipBtn = document.querySelector('.ytp-skip-ad-button, .ytp-ad-skip-button, .ytp-ad-skip-button-modern, button[id*="skip"]');
    if (skipBtn) skipBtn.click();
    if (document.querySelector('.ad-showing, .ad-interrupting') && v && v.duration) {
      v.currentTime = v.duration;
    }
    return { clicked: !!skipBtn };
  });
  console.log('Skip attempt result:', res);

  await new Promise(r => setTimeout(r, 1500));

  const after = await page.evaluate(() => {
    const v = document.querySelector('video');
    const mp = document.getElementById('movie_player');
    const isAd = !!document.querySelector('.ad-showing, .ad-interrupting');
    return {
      isAd,
      vDuration: v?.duration,
      vCurrentTime: v?.currentTime,
      mpDuration: mp?.getDuration(),
      mpCurrentTime: mp?.getCurrentTime()
    };
  });
  console.log('After skip:', after);

  browser.disconnect();
}

testAdSkip().catch(console.error);
