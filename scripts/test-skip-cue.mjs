import puppeteer from 'puppeteer-core';

async function testSkipCue() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: false,
    args: [
      '--autoplay-policy=no-user-gesture-required',
      '--window-position=50,50',
      '--window-size=900,700',
    ],
  });

  const page = (await browser.pages())[0];
  console.log('Navigating to Boza - Hecha Pa Mi...');
  await page.goto('https://music.youtube.com/watch?v=2_x_xgFuz1o', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('video', { timeout: 12000 });

  await page.evaluate(() => {
    const v = document.querySelector('video');
    const mp = window.movie_player;
    if (mp && typeof mp.playVideo === 'function') mp.playVideo();
    if (v) {
      v.muted = false;
      v.volume = 1;
      v.currentTime = 48; // Jump to 48s, 2s before the stall!
      v.play();
    }
  });

  console.log('Monitoring and testing unstick at stall point...');
  for (let s = 48; s <= 95; s += 2) {
    await new Promise((r) => setTimeout(r, 2000));
    const st = await page.evaluate(() => {
      const v = document.querySelector('video');
      const mp = window.movie_player;

      // Check if stuck in buffering or ad
      const isBuffering = mp && typeof mp.getPlayerState === 'function' && mp.getPlayerState() === 3;
      const isAd = !!document.querySelector('.ad-showing, .ad-interrupting') || (mp && typeof mp.getAdState === 'function' && mp.getAdState() === 1);

      let actionTaken = 'none';
      if (isAd) {
        if (mp && typeof mp.skipAd === 'function') {
          try { mp.skipAd(); actionTaken = 'skipAd'; } catch (e) {}
        }
      } else if (isBuffering && v && v.currentTime >= 48 && v.currentTime <= 65) {
        // Nudge forward past the ad cue point!
        try {
          if (mp && typeof mp.seekTo === 'function') {
            mp.seekTo(v.currentTime + 1.0, true);
            mp.playVideo();
            actionTaken = 'seekTo+1';
          }
        } catch (e) {}
      }

      return {
        sec: Math.round(v?.currentTime || 0),
        paused: v?.paused,
        dur: Math.round(v?.duration || 0),
        mpState: mp?.getPlayerState ? mp.getPlayerState() : null,
        isAd,
        isBuffering,
        actionTaken,
        bufferedEnd: v?.buffered?.length ? Math.round(v.buffered.end(v.buffered.length - 1)) : 0,
      };
    });
    console.log(`t=${s}s:`, st);
  }

  await browser.close();
}
testSkipCue().catch(console.error);
