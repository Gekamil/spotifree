import puppeteer from 'puppeteer-core';

(async () => {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  console.log('Navigating to https://spotifreeweb.vercel.app ...');
  await page.goto('https://spotifreeweb.vercel.app', { waitUntil: 'networkidle2' });

  // Clear previous token/state to ensure test of unauthenticated state
  await page.evaluate(() => {
    localStorage.removeItem('spotify_access_token');
    localStorage.removeItem('user_spotify_cookie');
    localStorage.removeItem('user_imported_playlists');
  });
  await page.reload({ waitUntil: 'networkidle2' });

  // Take screenshot of the unauthenticated gray feed with Spotify design
  await page.screenshot({ path: 'spotifree-clean-unauth-shimmer.png' });
  console.log('Saved spotifree-clean-unauth-shimmer.png');

  // Click '¿Cómo obtener tu cookie?' button to test navigation to guide
  const clicked = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const guideBtn = btns.find(b => b.textContent && b.textContent.includes('Cómo obtener tu cookie'));
    if (guideBtn) {
      guideBtn.click();
      return true;
    }
    return false;
  });
  console.log('Clicked guide button:', clicked);

  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: 'spotifree-clean-guide-view.png' });
  console.log('Saved spotifree-clean-guide-view.png');

  // Also test clicking 'Configuración'
  const clickedSettings = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const settingsBtn = btns.find(b => b.textContent && b.textContent.includes('Conectar cuenta'));
    if (settingsBtn) {
      settingsBtn.click();
      return true;
    }
    return false;
  });
  console.log('Clicked settings button:', clickedSettings);

  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: 'spotifree-clean-settings-view.png' });
  console.log('Saved spotifree-clean-settings-view.png');

  await page.close();
})();
