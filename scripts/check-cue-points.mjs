import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

async function checkCuePoints() {
  const devToolsPortFile = 'C:\\Users\\jorge\\.gemini\\antigravity\\ytm_profile\\DevToolsActivePort';
  const port = parseInt(fs.readFileSync(devToolsPortFile, 'utf8').trim().split('\n')[0], 10);
  const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}` });
  const page = (await browser.pages())[0];

  const info = await page.evaluate(() => {
    const mp = window.movie_player;
    const v = document.querySelector('video');
    return {
      adState: mp?.getAdState ? mp.getAdState() : null,
      videoData: mp?.getVideoData ? mp.getVideoData() : null,
      playerResponse: mp?.getPlayerResponse ? {
        playabilityStatus: mp.getPlayerResponse().playabilityStatus,
        videoDetails: mp.getPlayerResponse().videoDetails?.title,
      } : null,
      adProgress: mp?.getAdProgress ? mp.getAdProgress() : null,
      isAd: !!document.querySelector('.ad-showing, .ad-interrupting'),
      videoAttributes: {
        src: v?.src,
        currentSrc: v?.currentSrc,
        currentTime: v?.currentTime,
        duration: v?.duration,
        networkState: v?.networkState,
        readyState: v?.readyState,
      },
    };
  });
  console.log('Cue info:', JSON.stringify(info, null, 2));
}
checkCuePoints().catch(console.error);
