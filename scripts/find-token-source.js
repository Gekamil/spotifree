import puppeteer from 'puppeteer-core';

async function findTokenSource() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('open.spotify.com'));
  if (spotifyPage) {
    const info = await spotifyPage.evaluate(() => {
      // Check session storage
      const sessionKeys = Object.keys(sessionStorage);
      const sessionData = {};
      for (const k of sessionKeys) {
        sessionData[k] = sessionStorage.getItem(k)?.substring(0, 100);
      }
      return { sessionData };
    });
    console.log('Session storage:', info);
  }
  browser.disconnect();
}

findTokenSource().catch(console.error);
