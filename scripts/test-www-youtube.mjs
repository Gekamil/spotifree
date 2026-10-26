import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

async function testWwwYoutube() {
  const userDataDir = 'C:\\Users\\jorge\\.gemini\\antigravity\\ytm_profile';
  const devToolsPortFile = path.join(userDataDir, 'DevToolsActivePort');
  const portContent = fs.readFileSync(devToolsPortFile, 'utf8').trim().split('\n')[0];
  const port = parseInt(portContent, 10);
  const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}` });
  const page = (await browser.pages())[0];

  console.log('Navigating to www.youtube.com/watch?v=KKc8jsO0nIM ...');
  await page.goto('https://www.youtube.com/watch?v=KKc8jsO0nIM', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('video', { timeout: 8000 });

  await page.evaluate(() => {
    const v = document.querySelector('video');
    if (v) {
      v.muted = false;
      v.volume = 1;
      v.play();
    }
  });

  console.log('Playing on www.youtube.com. Waiting 10s...');
  await new Promise(r => setTimeout(r, 10000));

  const stats = await page.evaluate(() => {
    const v = document.querySelector('video');
    const timeRanges = [];
    if (v && v.buffered) {
      for (let i = 0; i < v.buffered.length; i++) {
        timeRanges.push({ start: v.buffered.start(i), end: v.buffered.end(i) });
      }
    }
    return {
      title: document.title,
      currentTime: v?.currentTime,
      duration: v?.duration,
      paused: v?.paused,
      timeRanges,
      spinner: document.querySelector('.ytp-spinner-message')?.textContent || null
    };
  });
  console.log('Stats on www.youtube.com after 10s:', JSON.stringify(stats, null, 2));

  // Now seek to 70s and let it play past 80s
  console.log('Seeking to 70s on www.youtube.com...');
  await page.evaluate(() => {
    const v = document.querySelector('video');
    if (v) v.currentTime = 70;
  });
  await new Promise(r => setTimeout(r, 6000));

  const statsAfterSeek = await page.evaluate(() => {
    const v = document.querySelector('video');
    const timeRanges = [];
    if (v && v.buffered) {
      for (let i = 0; i < v.buffered.length; i++) {
        timeRanges.push({ start: v.buffered.start(i), end: v.buffered.end(i) });
      }
    }
    return {
      currentTime: v?.currentTime,
      paused: v?.paused,
      timeRanges,
      spinner: document.querySelector('.ytp-spinner-message')?.textContent || null
    };
  });
  console.log('Stats after seek to 70s:', JSON.stringify(statsAfterSeek, null, 2));
}

testWwwYoutube().catch(console.error);
