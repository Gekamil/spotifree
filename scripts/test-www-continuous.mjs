import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

async function testWwwContinuous() {
  const userDataDir = 'C:\\Users\\jorge\\.gemini\\antigravity\\ytm_profile';
  const devToolsPortFile = path.join(userDataDir, 'DevToolsActivePort');
  const portContent = fs.readFileSync(devToolsPortFile, 'utf8').trim().split('\n')[0];
  const port = parseInt(portContent, 10);
  const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}` });
  const page = (await browser.pages())[0];

  console.log('Navigating to www.youtube.com/watch?v=IOHh7vkX5O0 (Boza - Hecha Pa Mi)...');
  await page.goto('https://www.youtube.com/watch?v=IOHh7vkX5O0', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('video', { timeout: 10000 });

  await page.evaluate(() => {
    const v = document.querySelector('video');
    const mp = window.movie_player;
    if (mp && typeof mp.playVideo === 'function') mp.playVideo();
    if (v) {
      v.muted = false;
      v.volume = 1;
      v.play();
    }
  });

  console.log('Monitoring on www.youtube.com every 5s up to 75s...');
  for (let s = 0; s <= 75; s += 5) {
    await new Promise(r => setTimeout(r, 5000));
    const status = await page.evaluate(() => {
      const v = document.querySelector('video');
      const mp = window.movie_player;
      const timeRanges = [];
      if (v && v.buffered) {
        for (let i = 0; i < v.buffered.length; i++) {
          timeRanges.push({ start: Math.round(v.buffered.start(i)), end: Math.round(v.buffered.end(i)) });
        }
      }
      return {
        sec: Math.round(v?.currentTime || 0),
        paused: v?.paused,
        mpState: mp ? mp.getPlayerState() : null,
        bufferEnd: timeRanges[0]?.end || null,
        timeRanges
      };
    });
    console.log(`www.youtube.com t=${s}s:`, status);
  }
}

testWwwContinuous().catch(console.error);
