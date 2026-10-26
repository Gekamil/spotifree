import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('open.spotify.com'));

  const internalData = await spotifyPage.evaluate(() => {
    // Check localStorage
    const lsKeys = Object.keys(localStorage);
    const sessionTokenKey = lsKeys.find(k => k.includes('token') || k.includes('auth') || k.includes('session'));
    
    // Check if there is an access token in document or scripts
    let accessToken = null;
    try {
      const script = document.getElementById('session');
      if (script) {
        accessToken = JSON.parse(script.textContent)?.accessToken;
      }
    } catch(e) {}

    // Check fetch or apollo or redux
    let apolloData = null;
    if (window.__APOLLO_CLIENT__) {
      apolloData = 'Apollo client exists';
    }

    return {
      lsKeysCount: lsKeys.length,
      lsKeys: lsKeys.slice(0, 20),
      hasSessionScript: !!document.getElementById('session'),
      sessionScriptToken: accessToken ? accessToken.slice(0, 20) + '...' : null
    };
  });

  console.log('Internal Spotify data:', JSON.stringify(internalData, null, 2));
  browser.disconnect();
}

main().catch(console.error);
