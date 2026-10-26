import puppeteer from 'puppeteer-core';

async function run() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('open.spotify.com'));
  
  if (spotifyPage) {
    const sessionInfo = await spotifyPage.evaluate(async () => {
      // 1. Check localStorage keys
      const lsKeys = Object.keys(localStorage);
      const sessionKeys = lsKeys.filter(k => k.toLowerCase().includes('token') || k.toLowerCase().includes('session') || k.toLowerCase().includes('auth') || k.toLowerCase().includes('user'));
      
      // 2. Check if there's an accessToken or session in localStorage or sessionStorage
      let accessToken = null;
      for (const k of lsKeys) {
        try {
          const val = localStorage.getItem(k);
          if (val && val.includes('accessToken')) {
            const parsed = JSON.parse(val);
            accessToken = parsed.accessToken || parsed;
          }
        } catch (e) {}
      }

      // 3. Try to fetch Spotify's internal token endpoint
      let internalToken = null;
      try {
        const res = await fetch('https://open.spotify.com/get_access_token?reason=transport&productType=web_player');
        if (res.ok) {
          internalToken = await res.json();
        }
      } catch (e) {}

      return {
        lsKeys: lsKeys.slice(0, 20),
        sessionKeys,
        internalToken: internalToken ? {
          clientId: internalToken.clientId,
          accessToken: internalToken.accessToken ? (internalToken.accessToken.slice(0, 15) + '...') : null,
          hasToken: !!internalToken.accessToken,
          accessTokenExpirationTimestampMs: internalToken.accessTokenExpirationTimestampMs,
          isAnonymous: internalToken.isAnonymous,
        } : null,
      };
    });

    console.log(JSON.stringify(sessionInfo, null, 2));
  }
  browser.disconnect();
}
run().catch(console.error);
