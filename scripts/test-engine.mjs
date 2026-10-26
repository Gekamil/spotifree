import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

async function testEngine() {
  const userDataDir = 'C:\\Users\\jorge\\.gemini\\antigravity\\ytm_profile';
  const port = parseInt(fs.readFileSync(path.join(userDataDir, 'DevToolsActivePort'), 'utf8').split('\n')[0].trim(), 10);
  const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}` });
  const page = (await browser.pages())[0];

  console.log('1. Switching to Reina Pepiada Alvaro Diaz (Zn37zIBGv5M)...');
  const res = await page.evaluate((vId) => {
    const mp = document.getElementById('movie_player');
    if (mp && mp.loadVideoById) {
      mp.loadVideoById(vId);
      mp.playVideo();
      return { success: true, title: mp.getVideoData()?.title };
    }
    return { success: false };
  }, 'Zn37zIBGv5M');
  console.log('Switch result:', res);

  await new Promise(r => setTimeout(r, 1000));

  console.log('2. Testing pauseVideo()...');
  await page.evaluate(() => {
    const mp = document.getElementById('movie_player');
    mp?.pauseVideo();
  });
  await new Promise(r => setTimeout(r, 500));
  const pausedState = await page.evaluate(() => {
    const v = document.querySelector('video');
    return { paused: v?.paused, ct: v?.currentTime };
  });
  console.log('Paused state (should be paused: true):', pausedState);

  console.log('3. Testing playVideo()...');
  await page.evaluate(() => {
    const mp = document.getElementById('movie_player');
    mp?.playVideo();
  });
  await new Promise(r => setTimeout(r, 500));
  const playingState = await page.evaluate(() => {
    const v = document.querySelector('video');
    return { paused: v?.paused, ct: v?.currentTime, dur: v?.duration };
  });
  console.log('Playing state (should be paused: false):', playingState);

  browser.disconnect();
}

testEngine().catch(console.error);
