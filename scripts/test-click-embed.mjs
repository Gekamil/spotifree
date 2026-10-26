import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

async function testClickEmbed() {
  const userDataDir = 'C:\\Users\\jorge\\.gemini\\antigravity\\ytm_profile';
  const devToolsPortFile = path.join(userDataDir, 'DevToolsActivePort');
  const portContent = fs.readFileSync(devToolsPortFile, 'utf8').trim().split('\n')[0];
  const port = parseInt(portContent, 10);
  const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}` });
  const page = (await browser.pages())[0];

  await page.evaluate(() => {
    const playBtn = document.querySelector('.ytp-large-play-button, button.ytp-play-button');
    if (playBtn) playBtn.click();
  });

  await new Promise(r => setTimeout(r, 3000));

  const stats = await page.evaluate(() => {
    const v = document.querySelector('video');
    return {
      sec: v?.currentTime,
      duration: v?.duration,
      paused: v?.paused
    };
  });
  console.log('After clicking play button:', stats);
}

testClickEmbed().catch(console.error);
