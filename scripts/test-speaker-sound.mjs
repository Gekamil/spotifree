import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

async function testSound() {
  const candidatePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ];
  const executablePath = candidatePaths.find(p => fs.existsSync(p));
  console.log('Using browser:', executablePath);

  // Launch minimized/offscreen browser with audio enabled
  const browser = await puppeteer.launch({
    executablePath,
    headless: false, // Non-headless so Windows routes audio to speakers!
    args: [
      '--window-position=-32000,-32000', // Completely invisible offscreen
      '--window-size=200,200',
      '--autoplay-policy=no-user-gesture-required',
      '--no-first-run',
      '--no-default-browser-check',
    ],
  });

  const page = (await browser.pages())[0];
  console.log('Navigating to YouTube Music track...');
  await page.goto('https://music.youtube.com/watch?v=Zn37zIBGv5M', { waitUntil: 'domcontentloaded' });
  
  await page.waitForSelector('video', { timeout: 8000 }).catch(() => {});
  const res = await page.evaluate(() => {
    const v = document.querySelector('video');
    if (v) {
      v.muted = false;
      v.volume = 1;
      v.play();
      return { playing: !v.paused, currentTime: v.currentTime, duration: v.duration };
    }
    return { noVideo: true };
  });

  console.log('Playback state:', res);
  // Let it play for 4 seconds so sound is heard
  await new Promise(r => setTimeout(r, 4000));

  const afterRes = await page.evaluate(() => {
    const v = document.querySelector('video');
    return { playing: !v?.paused, currentTime: v?.currentTime };
  });
  console.log('After 4s state:', afterRes);

  await browser.close();
}

testSound().catch(console.error);
