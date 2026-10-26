import puppeteer from 'puppeteer-core';

async function testStealth() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: false,
    ignoreDefaultArgs: ['--enable-automation'],
    args: [
      '--disable-blink-features=AutomationControlled',
      '--autoplay-policy=no-user-gesture-required',
      '--window-position=50,50',
      '--window-size=900,700',
    ],
  });

  const page = (await browser.pages())[0];

  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  console.log('Navigating with stealth flags to youtube.com/watch?v=2_x_xgFuz1o ...');
  await page.goto('https://www.youtube.com/watch?v=2_x_xgFuz1o', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('video', { timeout: 12000 });

  await page.evaluate(() => {
    const v = document.querySelector('video');
    const mp = window.movie_player;
    if (mp && typeof mp.playVideo === 'function') mp.playVideo();
    if (v) {
      v.muted = false;
      v.volume = 1;
      v.currentTime = 50;
      v.play();
    }
  });

  console.log('Monitoring playback past 60s...');
  for (let s = 50; s <= 85; s += 5) {
    await new Promise((r) => setTimeout(r, 5000));
    const st = await page.evaluate(() => {
      const v = document.querySelector('video');
      const mp = window.movie_player;
      return {
        sec: Math.round(v?.currentTime || 0),
        paused: v?.paused,
        mpState: mp?.getPlayerState ? mp.getPlayerState() : null,
        bufferedEnd: v?.buffered?.length ? Math.round(v.buffered.end(v.buffered.length - 1)) : 0,
      };
    });
    console.log(`Stealth t=${s}s:`, st);
  }

  await browser.close();
}
testStealth().catch(console.error);
