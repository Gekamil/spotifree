import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

async function checkYTMPage() {
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
      '--window-size=400,400',
      '--autoplay-policy=no-user-gesture-required',
      '--no-first-run',
    ],
  });

  const page = (await browser.pages())[0];
  console.log('Opening music.youtube.com...');
  await page.goto('https://music.youtube.com/watch?v=Zn37zIBGv5M', { waitUntil: 'networkidle2' });
  
  const pageInfo = await page.evaluate(() => {
    // Check consent buttons
    const buttons = Array.from(document.querySelectorAll('button')).map(b => b.innerText.trim()).filter(Boolean);
    const video = document.querySelector('video');
    return {
      title: document.title,
      url: window.location.href,
      hasVideo: !!video,
      videoSrc: video?.src || video?.currentSrc || null,
      videoPaused: video?.paused,
      buttons: buttons.slice(0, 10),
    };
  });

  console.log('Page info:', pageInfo);
  await browser.close();
}

checkYTMPage().catch(console.error);
