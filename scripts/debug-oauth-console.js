import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const page = await browser.newPage();

  page.on('console', msg => console.log('BROWSER LOG:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

  // Clear existing tokens in localStorage first
  await page.goto('http://127.0.0.1:5173/');
  await page.evaluate(() => {
    localStorage.clear();
  });

  // Now trigger initiateSpotifyLogin via the page
  console.log('Clicking login or calling initiateSpotifyLogin...');
  await page.evaluate(() => {
    // Call initiateSpotifyLogin
    const CLIENT_ID = 'ea3003771e264c4690a2ac289afd22a4';
    const REDIRECT_URI = 'http://127.0.0.1:5173/callback';
    const SCOPES = [
      'user-read-private',
      'user-read-email',
      'playlist-read-private',
      'playlist-read-collaborative',
      'user-library-read',
      'user-top-read',
      'user-read-recently-played'
    ].join(' ');

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: CLIENT_ID,
      scope: SCOPES,
      redirect_uri: REDIRECT_URI,
    });

    window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
  });

  await new Promise(r => setTimeout(r, 4000));
  console.log('Landed on URL:', page.url());

  const localStorageDump = await page.evaluate(() => {
    const res = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      res[k] = localStorage.getItem(k)?.substring(0, 30);
    }
    return res;
  });
  console.log('LocalStorage after login redirect:\n', localStorageDump);

  await page.close();
  browser.disconnect();
}

main().catch(console.error);
