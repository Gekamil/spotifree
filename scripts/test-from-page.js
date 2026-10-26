import puppeteer from 'puppeteer-core';

async function testFromPage() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('open.spotify.com'));
  if (spotifyPage) {
    const res = await spotifyPage.evaluate(async () => {
      try {
        const r = await fetch('/get_access_token?reason=transport&productType=web_player');
        const text = await r.text();
        return { status: r.status, text: text.substring(0, 300) };
      } catch (e) {
        return { error: e.message };
      }
    });
    console.log('From spotifyPage result:', res);
  }
  browser.disconnect();
}

testFromPage().catch(console.error);
