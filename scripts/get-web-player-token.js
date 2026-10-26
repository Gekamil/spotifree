import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('open.spotify.com'));
  if (spotifyPage) {
    const tokenData = await spotifyPage.evaluate(async () => {
      try {
        const res = await fetch('/get_access_token?reason=transport&productType=web_player');
        const json = await res.json();
        return {
          accessToken: json.accessToken ? json.accessToken.substring(0, 20) + '...' : null,
          hasFullToken: !!json.accessToken,
          fullToken: json.accessToken,
          clientId: json.clientId,
          isAnonymous: json.isAnonymous
        };
      } catch (err) {
        return { error: err.message };
      }
    });

    console.log(JSON.stringify(tokenData, null, 2));
  }
  browser.disconnect();
}

main().catch(console.error);
