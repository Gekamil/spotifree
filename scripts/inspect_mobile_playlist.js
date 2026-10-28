import puppeteer from 'puppeteer-core';

async function inspectPlaylistDOM() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 393, height: 852, isMobile: true, hasTouch: true });
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1');

  await page.goto('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M', { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));

  const info = await page.evaluate(() => {
    const title = document.querySelector('h1')?.innerText;
    const subtitle = document.querySelector('h1')?.parentElement?.innerText;
    const playBtn = document.querySelector('button[data-testid=\"play-button\"]')?.outerHTML;
    const firstRow = document.querySelector('[data-testid=\"tracklist-row\"]')?.outerHTML;
    return { title, subtitle, playBtnExists: !!playBtn, firstRowExists: !!firstRow };
  });

  console.log('Mobile Playlist DOM info:', info);
  await browser.close();
}

inspectPlaylistDOM().catch(console.error);
