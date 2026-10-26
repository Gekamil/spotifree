import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

async function monitor() {
  const userDataDir = 'C:\\Users\\jorge\\.gemini\\antigravity\\ytm_profile';
  const devToolsPortFile = path.join(userDataDir, 'DevToolsActivePort');
  const port = parseInt(fs.readFileSync(devToolsPortFile, 'utf8').trim().split('\n')[0], 10);
  const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}` });
  const page = (await browser.pages())[0];

  for (let i = 0; i < 8; i++) {
    const data = await page.evaluate(() => {
      const v = document.querySelector('video');
      const mp = window.movie_player;
      return {
        ct: Math.round(v?.currentTime || 0),
        paused: v?.paused,
        adShowing: !!document.querySelector('.ad-showing, .ad-interrupting'),
        mpState: mp?.getPlayerState ? mp.getPlayerState() : null,
        adState: mp?.getAdState ? mp.getAdState() : null,
      };
    });
    console.log(`t+${i * 2}s:`, data);
    await new Promise((r) => setTimeout(r, 2000));
  }
}
monitor().catch(console.error);
