import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('open.spotify.com'));

  const tokenData = await spotifyPage.evaluate(async () => {
    try {
      const res = await fetch('/get_access_token?reason=transport&productType=web_player');
      if (res.ok) {
        return await res.json();
      }
      return { status: res.status, statusText: res.statusText };
    } catch(err) {
      return { error: err.message };
    }
  });

  console.log('Real Spotify /get_access_token response:');
  console.log({
    ...tokenData,
    accessToken: tokenData.accessToken ? tokenData.accessToken.slice(0, 25) + '...' : null
  });

  browser.disconnect();
}

main().catch(console.error);
