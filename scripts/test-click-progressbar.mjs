import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

async function testClickSlider() {
  const userDataDir = 'C:\\Users\\jorge\\.gemini\\antigravity\\ytm_profile';
  const port = parseInt(fs.readFileSync(path.join(userDataDir, 'DevToolsActivePort'), 'utf8').split('\n')[0].trim(), 10);
  const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}` });
  const page = (await browser.pages())[0];

  console.log('Testing shadowRoot seek...');
  const res = await page.evaluate((targetSec) => {
    const bar = document.querySelector('ytmusic-player-bar');
    const sr = bar ? bar.shadowRoot : null;
    const pb = sr ? sr.querySelector('#progress-bar') : document.querySelector('#progress-bar');
    const mp = document.getElementById('movie_player');
    const v = document.querySelector('video');

    // Does pb have value?
    if (pb) {
      // Dispatch change event or fire onValueChange
      pb.value = targetSec;
      pb.dispatchEvent(new CustomEvent('change', { bubbles: true }));
      pb.dispatchEvent(new CustomEvent('immediate-value-change', { bubbles: true }));
    }

    // Try player seek
    if (mp && typeof mp.seekTo === 'function') {
      mp.seekTo(targetSec, true);
      mp.playVideo();
    }
    if (v) v.play().catch(() => {});

    return { hasSr: !!sr, hasPb: !!pb, pbValue: pb?.value };
  }, 80);
  console.log('ShadowRoot seek result:', res);

  for (let i = 1; i <= 5; i++) {
    await new Promise(r => setTimeout(r, 600));
    const s = await page.evaluate(() => {
      const v = document.querySelector('video');
      const mp = document.getElementById('movie_player');
      return {
        paused: v?.paused,
        currentTime: v?.currentTime,
        playerState: mp?.getPlayerState ? mp.getPlayerState() : null,
        buffered: v?.buffered?.length > 0 ? Array.from({length: v.buffered.length}, (_, idx) => [v.buffered.start(idx), v.buffered.end(idx)]) : []
      };
    });
    console.log(`At +${i * 600}ms:`, s);
  }

  browser.disconnect();
}

testClickSlider().catch(console.error);
