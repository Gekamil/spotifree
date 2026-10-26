import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

async function testEmbed() {
  const devToolsPortFile = 'C:\\Users\\jorge\\.gemini\\antigravity\\ytm_profile\\DevToolsActivePort';
  const port = parseInt(fs.readFileSync(devToolsPortFile, 'utf8').trim().split('\n')[0], 10);
  const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}` });
  const page = (await browser.pages())[0];

  console.log('Navigating to embed player: https://www.youtube-nocookie.com/embed/2_x_xgFuz1o?autoplay=1&enablejsapi=1 ...');
  await page.goto('https://www.youtube-nocookie.com/embed/2_x_xgFuz1o?autoplay=1&enablejsapi=1', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('video', { timeout: 10000 });

  await page.evaluate(() => {
    const v = document.querySelector('video');
    if (v) {
      v.muted = false;
      v.volume = 1;
      v.currentTime = 50; // Jump to 50s!
      v.play();
    }
  });

  console.log('Jumped to 50s on youtube-nocookie embed, monitoring...');
  for (let s = 50; s <= 90; s += 5) {
    await new Promise((r) => setTimeout(r, 5000));
    const st = await page.evaluate(() => {
      const v = document.querySelector('video');
      const mp = window.movie_player;
      return {
        ct: Math.round(v?.currentTime || 0),
        paused: v?.paused,
        dur: Math.round(v?.duration || 0),
        mpState: mp?.getPlayerState ? mp.getPlayerState() : null,
        src: v?.src?.slice(0, 40),
        bufferedEnd: v?.buffered?.length ? Math.round(v.buffered.end(v.buffered.length - 1)) : 0,
      };
    });
    console.log(`Embed t=${s}s:`, st);
  }
}
testEmbed().catch(console.error);
