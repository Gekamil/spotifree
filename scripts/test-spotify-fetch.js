import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('open.spotify.com'));
  if (spotifyPage) {
    const tokens = await spotifyPage.evaluate(async () => {
      // Check if session token or fetch can be done directly from page
      // In open.spotify.com, any fetch to https://api.spotify.com/v1/... will have the Authorization header or session cookie!
      // Or we can query the internal Spicetify / session object:
      let token = null;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('token') || key.includes('session') || key.includes('auth'))) {
          token = { key, val: localStorage.getItem(key)?.substring(0, 50) };
        }
      }
      
      // Test fetching liked tracks using page fetch
      try {
        const res = await fetch('https://api.spotify.com/v1/me/tracks?limit=25');
        const status = res.status;
        const json = status === 200 ? await res.json() : null;
        return { status, tracksCount: json?.items?.length, sample: json?.items?.[0]?.track?.name, token };
      } catch (err) {
        return { error: err.message, token };
      }
    });

    console.log(JSON.stringify(tokens, null, 2));
  }
  browser.disconnect();
}

main().catch(console.error);
