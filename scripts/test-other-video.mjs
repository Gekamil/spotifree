import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

async function testOtherVideo() {
  const userDataDir = 'C:\\Users\\jorge\\.gemini\\antigravity\\ytm_profile';
  const devToolsPortFile = path.join(userDataDir, 'DevToolsActivePort');
  const portContent = fs.readFileSync(devToolsPortFile, 'utf8').trim().split('\n')[0];
  const port = parseInt(portContent, 10);
  const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}` });
  const page = (await browser.pages())[0];

  console.log('Resolving YouTube video for Trueno - Rain ...');
  const res = await fetch('https://www.youtube.com/results?search_query=' + encodeURIComponent('Trueno Rain audio'));
  const html = await res.text();
  const vId = Array.from(html.matchAll(/\/watch\?v=([a-zA-Z0-9_-]{11})/g)).map(m => m[1])[0];
  console.log('Found video ID for Trueno Rain:', vId);

  await page.goto(`https://music.youtube.com/watch?v=${vId}`, { waitUntil: 'domcontentloaded' });
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

  console.log('Monitoring Trueno Rain playback...');
  for (let s = 0; s <= 80; s += 5) {
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
    console.log(`Rain t=${s}s:`, status);
  }
}

testOtherVideo().catch(console.error);
