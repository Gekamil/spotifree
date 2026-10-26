import puppeteer from 'puppeteer-core';

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  let spotifreePage = pages.find((p) => p.url().includes('5173'));

  if (!spotifreePage) {
    spotifreePage = await browser.newPage();
  }

  await spotifreePage.bringToFront();
  await spotifreePage.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded' });
  await sleep(1500);

  console.log('Opened Spotifree on 127.0.0.1:5173');

  // Check if "Conectar Spotify" exists
  const connectBtn = await spotifreePage.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Conectar Spotify'));
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  });

  console.log('Connect Spotify clicked:', connectBtn);
  if (connectBtn) {
    await sleep(2500);
    // Find if on auth page
    const authPage = (await browser.pages()).find(p => p.url().includes('accounts.spotify.com'));
    if (authPage) {
      console.log('On Spotify Auth page. Clicking accept...');
      await authPage.evaluate(() => {
        const accept = document.querySelector('button[data-testid="auth-accept"]') ||
                       Array.from(document.querySelectorAll('button')).find(b => b.innerText.toLowerCase().includes('aceptar'));
        if (accept) accept.click();
      });
      await sleep(3000);
    }
  }

  // Reload spotifree and check authentication status
  const status = await spotifreePage.evaluate(() => {
    return {
      token: !!window.localStorage.getItem('spotify_access_token'),
      appToken: !!window.localStorage.getItem('spotify_app_token'),
      playlistsCount: document.querySelectorAll('aside div.cursor-pointer').length,
      userBtnText: document.querySelector('header button[title]')?.getAttribute('title')
    };
  });

  console.log('SPOTIFREE AUTH STATUS:', status);

  const artifactDir = 'C:\\Users\\jorge\\.gemini\\antigravity\\brain\\b7d3ec29-c076-4935-90b5-23f42c286313';
  await spotifreePage.screenshot({
    path: `${artifactDir}/spotifree-live-developer-connected.png`,
    fullPage: false,
  });
  console.log('Saved spotifree-live-developer-connected.png');

  browser.disconnect();
}

run().catch(console.error);
