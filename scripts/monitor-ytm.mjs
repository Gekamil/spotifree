import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

async function monitorYTM() {
  const userDataDir = 'C:\\Users\\jorge\\.gemini\\antigravity\\ytm_profile';
  const port = parseInt(fs.readFileSync(path.join(userDataDir, 'DevToolsActivePort'), 'utf8').split('\n')[0].trim(), 10);
  const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}` });
  const page = (await browser.pages())[0];

  // Play video
  await page.evaluate(() => {
    const v = document.querySelector('video');
    if (v) {
      v.muted = false;
      v.volume = 1;
      v.play();
    }
  });

  console.log('Started play. Monitoring for 6 seconds...');
  for (let i = 0; i < 6; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const s = await page.evaluate(() => {
      const v = document.querySelector('video');
      return { paused: v?.paused, ct: v?.currentTime, dur: v?.duration };
    });
    console.log(`Second ${i+1}:`, s);
  }

  browser.disconnect();
}

monitorYTM().catch(console.error);
