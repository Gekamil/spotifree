import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

async function checkConsole() {
  const userDataDir = 'C:\\Users\\jorge\\.gemini\\antigravity\\ytm_profile';
  const port = parseInt(fs.readFileSync(path.join(userDataDir, 'DevToolsActivePort'), 'utf8').split('\n')[0].trim(), 10);
  const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}` });
  const page = (await browser.pages())[0];

  const diag = await page.evaluate(() => {
    const v = document.querySelector('video');
    const mp = document.getElementById('movie_player');
    return {
      error: v?.error ? { code: v.error.code, message: v.error.message } : null,
      src: v?.src?.slice(0, 50),
      currentSrc: v?.currentSrc?.slice(0, 50),
      networkState: v?.networkState, // 1 = IDLE, 2 = LOADING, 3 = NO_SOURCE
      readyState: v?.readyState, // 0 = HAVE_NOTHING, 1 = HAVE_METADATA, 2 = HAVE_CURRENT_DATA, 3 = HAVE_FUTURE_DATA, 4 = HAVE_ENOUGH_DATA
      mpError: mp?.getDebugText ? mp.getDebugText().slice(0, 300) : null
    };
  });
  console.log('Video Element Diagnostic:', diag);
  browser.disconnect();
}

checkConsole().catch(console.error);
