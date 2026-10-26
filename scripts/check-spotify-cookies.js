import puppeteer from 'puppeteer-core';

async function run() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('open.spotify.com'));
  
  if (spotifyPage) {
    const cookies = await spotifyPage.cookies();
    const importantCookies = cookies.map(c => ({
      name: c.name,
      domain: c.domain,
      expires: c.expires,
      httpOnly: c.httpOnly,
      secure: c.secure,
      valuePreview: c.value.slice(0, 10) + '...',
    }));

    console.log(JSON.stringify(importantCookies, null, 2));
  }
  browser.disconnect();
}
run().catch(console.error);
