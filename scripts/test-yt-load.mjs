import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

async function testYt() {
  const userDataDir = 'C:\\Users\\jorge\\.gemini\\antigravity\\ytm_profile';
  const devToolsPortFile = path.join(userDataDir, 'DevToolsActivePort');
  const portContent = fs.readFileSync(devToolsPortFile, 'utf8').trim().split('\n')[0];
  const port = parseInt(portContent, 10);
  const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}` });
  const page = (await browser.pages())[0];

  page.on('console', msg => console.log('YTM CONSOLE:', msg.text()));

  console.log('Reloading page...');
  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 3000));

  const state = await page.evaluate(() => {
    const mp = window.movie_player;
    const v = document.querySelector('video');
    return {
      title: document.title,
      src: v?.src?.slice(0, 50),
      currentTime: v?.currentTime,
      duration: v?.duration,
      paused: v?.paused,
      spinner: document.querySelector('.ytp-spinner-message')?.textContent || null
    };
  });
  console.log('State after reload:', state);
}

testYt().catch(console.error);
