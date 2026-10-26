import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

async function testCleanPlayback() {
  const candidatePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ];
  const executablePath = candidatePaths[0];

  console.log('Launching clean Chrome...');
  const browser = await puppeteer.launch({
    executablePath,
    headless: false,
    args: [
      '--window-position=50,50', // Normal visible window
      '--window-size=600,600',
      '--autoplay-policy=no-user-gesture-required',
      '--no-first-run',
    ],
  });

  const page = (await browser.pages())[0];
  console.log('Navigating to YouTube Music song (Bad Bunny DtMF)...');
  await page.goto('https://music.youtube.com/watch?v=v9T_MGfzq7I', { waitUntil: 'domcontentloaded' });

  await page.waitForSelector('video', { timeout: 10000 });
  await page.evaluate(() => {
    const v = document.querySelector('video');
    if (v) {
      v.muted = false;
      v.play();
    }
  });

  console.log('Checking playback every 500ms for 6 seconds...');
  for (let i = 0; i < 12; i++) {
    await new Promise(r => setTimeout(r, 500));
    const data = await page.evaluate(() => {
      const v = document.querySelector('video');
      return { paused: v?.paused, ct: v?.currentTime, dur: v?.duration };
    });
    console.log(`Step ${i+1}:`, data);
  }

  await browser.close();
}

testCleanPlayback().catch(console.error);
