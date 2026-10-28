import puppeteer from 'puppeteer-core';

async function diagnose() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: 'new',
    args: [
      '--autoplay-policy=no-user-gesture-required',
      '--disable-web-security',
      '--no-sandbox',
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const consoleLogs = [];
  page.on('console', (msg) => {
    consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
  });

  page.on('pageerror', (err) => {
    consoleLogs.push(`[PAGE ERROR] ${err.message}`);
  });

  console.log('Navigating to https://spotifreeweb.vercel.app ...');
  await page.goto('https://spotifreeweb.vercel.app', { waitUntil: 'networkidle2', timeout: 30000 });

  console.log('--- BROWSER CONSOLE LOGS ---');
  consoleLogs.slice(-25).forEach((l) => console.log(l));

  const pageState = await page.evaluate(() => {
    const dataStore = window.__useSpotifyDataStore?.getState();
    const playerStore = window.__usePlayerStore?.getState();
    const engine = window.__audioEngine;

    return {
      isAuthenticated: dataStore?.isAuthenticated,
      user: dataStore?.user,
      playlistsCount: dataStore?.playlists?.length,
      shelvesCount: dataStore?.dynamicShelves?.length,
      firstShelfCards: dataStore?.dynamicShelves?.[0]?.cards?.length,
      quickAccessCount: dataStore?.quickAccessCards?.length,
      isPlaying: playerStore?.isPlaying,
      currentTrack: playerStore?.currentTrack?.name,
      engineState: engine?.getState ? engine.getState() : null,
      domCardsCount: document.querySelectorAll('.group').length,
    };
  });

  console.log('--- PAGE STORE STATE ---', pageState);

  // Take screenshot
  await page.screenshot({ path: 'spotifree-diagnose-prod.png' });
  console.log('Saved screenshot to spotifree-diagnose-prod.png');

  await browser.close();
}

diagnose().catch(console.error);
