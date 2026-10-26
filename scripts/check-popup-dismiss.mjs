import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

async function checkPopupButtons() {
  const userDataDir = 'C:\\Users\\jorge\\.gemini\\antigravity\\ytm_profile';
  const port = parseInt(fs.readFileSync(path.join(userDataDir, 'DevToolsActivePort'), 'utf8').split('\n')[0].trim(), 10);
  const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}` });
  const page = (await browser.pages())[0];

  const btns = await page.evaluate(() => {
    const pop = document.querySelector('ytmusic-popup-container');
    const buttons = Array.from(pop ? pop.querySelectorAll('button, tp-yt-paper-button, [role="button"]') : []);
    return buttons.map(b => ({
      text: b.innerText,
      ariaLabel: b.getAttribute('aria-label'),
      tag: b.tagName
    }));
  });
  console.log('Popup buttons:', btns);

  // Dismiss it!
  const dismissed = await page.evaluate(() => {
    const pop = document.querySelector('ytmusic-popup-container');
    if (!pop) return false;
    const dismissBtn = Array.from(pop.querySelectorAll('button, tp-yt-paper-button, [role="button"]'))
      .find(b => b.innerText?.toLowerCase().includes('no') || b.innerText?.toLowerCase().includes('rechazar') || b.getAttribute('aria-label')?.toLowerCase().includes('cerrar'));
    if (dismissBtn) {
      dismissBtn.click();
      return { clicked: true, text: dismissBtn.innerText };
    }
    return false;
  });
  console.log('Dismissed:', dismissed);

  await new Promise(r => setTimeout(r, 1000));
  const after = await page.evaluate(() => {
    const v = document.querySelector('video');
    const mp = document.getElementById('movie_player');
    if (mp && mp.playVideo) mp.playVideo();
    return {
      paused: v?.paused,
      currentTime: v?.currentTime,
      playerState: mp?.getPlayerState(),
    };
  });
  console.log('After dismiss and play:', after);

  browser.disconnect();
}

checkPopupButtons().catch(console.error);
