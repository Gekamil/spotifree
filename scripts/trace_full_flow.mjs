import puppeteer from 'puppeteer-core';

(async () => {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  let page = pages.find(p => p.url().includes('spotifreeweb.vercel.app') || p.url().includes('spotify.com'));

  if (!page) {
    console.log('Opening new page to spotifreeweb.vercel.app');
    page = await browser.newPage();
    await page.goto('https://spotifreeweb.vercel.app', { waitUntil: 'networkidle2' });
  }

  function attachListeners(p) {
    p.on('console', msg => console.log('[BROWSER CONSOLE]', msg.type(), msg.text()));
    p.on('requestfailed', req => console.log('[REQ FAILED]', req.url(), req.failure()?.errorText));
    p.on('response', async res => {
      const u = res.url();
      if (u.includes('token') || u.includes('/v1/me') || u.includes('callback') || u.includes('api')) {
        let body = '';
        try { body = await res.text(); } catch {}
        console.log(`[HTTP ${res.status()}] ${u}\n   Response: ${body.slice(0, 300)}`);
      }
    });
  }

  attachListeners(page);
  browser.on('targetcreated', async target => {
    if (target.type() === 'page') {
      const newP = await target.page();
      if (newP) attachListeners(newP);
    }
  });

  // Navigate to home first
  console.log('Navigating to home https://spotifreeweb.vercel.app ...');
  await page.goto('https://spotifreeweb.vercel.app', { waitUntil: 'networkidle2' });

  console.log('Triggering login()...');
  await page.evaluate(() => {
    window.__useSpotifyDataStore?.getState?.().login();
  });

  console.log('Waiting for Spotify authorize page...');
  await page.waitForNavigation({ timeout: 15000 }).catch(e => console.log('Nav wait:', e.message));

  console.log('On page:', page.url());

  if (page.url().includes('spotify.com')) {
    // Wait for buttons
    await new Promise(r => setTimeout(r, 2000));
    console.log('Finding and clicking visible Aceptar button...');
    const clicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button[data-testid="auth-accept"]'));
      for (const b of btns) {
        const rect = b.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          b.click();
          return true;
        }
      }
      if (btns.length > 0) {
        btns[btns.length - 1].click();
        return true;
      }
      return false;
    });
    console.log('Clicked visible Aceptar:', clicked);

    console.log('Waiting for callback navigation...');
    await page.waitForNavigation({ timeout: 15000 }).catch(e => console.log('Wait callback:', e.message));
  }

  console.log('Callback reached. Current URL:', page.url());

  // Wait 10 seconds to observe all network requests and console logs
  console.log('Observing execution for 10 seconds...');
  await new Promise(r => setTimeout(r, 10000));

  const finalState = await page.evaluate(() => {
    const s = window.__useSpotifyDataStore?.getState?.();
    return {
      isAuthenticated: s?.isAuthenticated,
      isLoading: s?.isLoading,
      user: s?.user,
      playlists: s?.playlists?.length,
      localStorage: { ...window.localStorage }
    };
  });

  console.log('FINAL STATE:', JSON.stringify(finalState, null, 2));

  await page.screenshot({ path: 'trace-full-flow-result.png' });
  console.log('Screenshot saved.');

  browser.disconnect();
})();
