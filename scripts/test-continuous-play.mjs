import puppeteer from 'puppeteer-core';

async function testContinuous() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: false,
    args: [
      '--autoplay-policy=no-user-gesture-required',
      '--window-position=50,50',
      '--window-size=1000,700',
    ],
  });

  const page = (await browser.pages())[0];

  console.log('Navigating to YouTube Music track 2_x_xgFuz1o...');
  await page.goto('https://music.youtube.com/watch?v=2_x_xgFuz1o', { waitUntil: 'networkidle2' });

  // Click anywhere to ensure user interaction
  await page.click('body');

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

  console.log('Playing from beginning. Monitoring every 10s up to 100s...');
  for (let s = 0; s <= 100; s += 10) {
    await new Promise((r) => setTimeout(r, 10000));
    const st = await page.evaluate(() => {
      const v = document.querySelector('video');
      const mp = window.movie_player;
      const bRanges = [];
      if (v?.buffered) {
        for (let i = 0; i < v.buffered.length; i++) {
          bRanges.push([Math.round(v.buffered.start(i)), Math.round(v.buffered.end(i))]);
        }
      }
      return {
        sec: Math.round(v?.currentTime || 0),
        paused: v?.paused,
        dur: Math.round(v?.duration || 0),
        mpState: mp?.getPlayerState ? mp.getPlayerState() : null,
        bufferedRanges: bRanges,
        isAd: !!document.querySelector('.ad-showing, .ad-interrupting'),
      };
    });
    console.log(`t=${s + 10}s:`, st);
  }

  await browser.close();
}
testContinuous().catch(console.error);
