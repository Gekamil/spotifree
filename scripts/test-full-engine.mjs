import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

async function testFullEngine() {
  const candidatePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ];
  const executablePath = candidatePaths.find(p => fs.existsSync(p));

  const browser = await puppeteer.launch({
    executablePath,
    headless: false,
    args: [
      '--window-position=-32000,-32000',
      '--window-size=200,200',
      '--autoplay-policy=no-user-gesture-required',
      '--no-first-run',
      '--no-default-browser-check',
    ],
  });

  const page = (await browser.pages())[0];
  const videoId = 'HfzbN5ky5Co'; // La Diabla
  console.log('1. Loading YouTube Music for La Diabla...');
  await page.goto(`https://music.youtube.com/watch?v=${videoId}`, { waitUntil: 'domcontentloaded' });
  
  await page.waitForSelector('video', { timeout: 8000 }).catch(() => {});
  
  // Wait 2s for buffer
  await new Promise(r => setTimeout(r, 2000));

  const state1 = await page.evaluate(() => {
    const v = document.querySelector('video');
    if (!v) return null;
    v.muted = false;
    v.play().catch(() => {});
    return {
      paused: v.paused,
      currentTime: v.currentTime,
      duration: v.duration,
      volume: v.volume,
    };
  });
  console.log('2. State after initial play:', state1);

  // Play for 3 seconds
  await new Promise(r => setTimeout(r, 3000));

  const state2 = await page.evaluate(() => {
    const v = document.querySelector('video');
    return {
      paused: v?.paused,
      currentTime: v?.currentTime,
      duration: v?.duration,
    };
  });
  console.log('3. State after 3 seconds playback (should be ~3s):', state2);

  // Pause test
  await page.evaluate(() => {
    const v = document.querySelector('video');
    v?.pause();
  });
  await new Promise(r => setTimeout(r, 1000));

  const state3 = await page.evaluate(() => {
    const v = document.querySelector('video');
    return { paused: v?.paused, currentTime: v?.currentTime };
  });
  console.log('4. State after pause (paused should be true):', state3);

  await browser.close();
  console.log('Test completed successfully!');
}

testFullEngine().catch(console.error);
