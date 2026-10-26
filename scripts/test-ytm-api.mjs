import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

async function testYtmApi() {
  const userDataDir = 'C:\\Users\\jorge\\.gemini\\antigravity\\ytm_profile';
  const port = parseInt(fs.readFileSync(path.join(userDataDir, 'DevToolsActivePort'), 'utf8').split('\n')[0].trim(), 10);
  const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}` });
  const page = (await browser.pages())[0];

  console.log('Testing movie_player methods on YouTube Music...');
  const methods = await page.evaluate(() => {
    const mp = document.getElementById('movie_player');
    if (!mp) return { found: false };
    const methodNames = [];
    for (const k in mp) {
      if (typeof mp[k] === 'function') methodNames.push(k);
    }
    return {
      found: true,
      hasLoadVideoById: typeof mp.loadVideoById === 'function',
      hasCueVideoById: typeof mp.cueVideoById === 'function',
      hasPlayVideo: typeof mp.playVideo === 'function',
      hasPauseVideo: typeof mp.pauseVideo === 'function',
      hasSkipAd: typeof mp.skipAd === 'function',
      hasGetVideoData: typeof mp.getVideoData === 'function',
      videoData: typeof mp.getVideoData === 'function' ? mp.getVideoData() : null,
      videoDuration: typeof mp.getDuration === 'function' ? mp.getDuration() : null,
      sampleMethods: methodNames.filter(m => m.includes('Video') || m.includes('Ad') || m.includes('Play') || m.includes('Seek')),
    };
  });

  console.log('Movie player inspection result:', methods);
  browser.disconnect();
}

testYtmApi().catch(console.error);
