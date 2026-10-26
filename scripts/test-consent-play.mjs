import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

async function testConsentAndPlay() {
  const candidatePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ];
  const executablePath = candidatePaths.find(p => fs.existsSync(p));
  const userDataDir = 'C:\\Users\\jorge\\.gemini\\antigravity\\ytm_profile';

  console.log('Launching browser with profile dir...');
  const browser = await puppeteer.launch({
    executablePath,
    headless: false,
    userDataDir,
    args: [
      '--window-position=-32000,-32000',
      '--window-size=500,500',
      '--autoplay-policy=no-user-gesture-required',
      '--no-first-run',
      '--no-default-browser-check',
    ],
  });

  const page = (await browser.pages())[0];
  console.log('Navigating to YouTube Music...');
  await page.goto('https://music.youtube.com/watch?v=Zn37zIBGv5M', { waitUntil: 'domcontentloaded' });
  
  // Wait a moment and check if consent modal is there
  await new Promise(r => setTimeout(r, 2000));
  const currentUrl = page.url();
  console.log('Current URL:', currentUrl);

  if (currentUrl.includes('consent.youtube.com')) {
    console.log('Clicking "Aceptar todo" on consent page...');
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Aceptar todo'));
      if (btn) btn.click();
    });
    console.log('Waiting for navigation back to music.youtube.com...');
    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
  }

  console.log('Now waiting for <video> on YouTube Music...');
  await page.waitForSelector('video', { timeout: 10000 });
  
  const playRes = await page.evaluate(() => {
    const v = document.querySelector('video');
    if (v) {
      v.muted = false;
      v.volume = 1;
      v.play();
      return {
        playing: !v.paused,
        currentTime: v.currentTime,
        duration: v.duration,
      };
    }
    return null;
  });

  console.log('Playback started:', playRes);

  // Listen to 3 seconds of sound!
  await new Promise(r => setTimeout(r, 3500));

  const statusAfter = await page.evaluate(() => {
    const v = document.querySelector('video');
    return {
      playing: !v?.paused,
      currentTime: v?.currentTime,
      duration: v?.duration,
    };
  });
  console.log('Status after 3.5s (currentTime should be ~3.5):', statusAfter);

  await browser.close();
}

testConsentAndPlay().catch(console.error);
