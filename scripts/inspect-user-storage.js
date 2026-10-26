import puppeteer from 'puppeteer-core';

async function run() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('open.spotify.com'));
  
  if (spotifyPage) {
    const data = await spotifyPage.evaluate(() => {
      const userKeys = Object.keys(localStorage).filter(k => k.startsWith('e6yr34zzwnf1yybcw49po6nrw'));
      const obj = {};
      for (const k of userKeys) {
        obj[k] = localStorage.getItem(k);
      }
      return {
        userId: 'e6yr34zzwnf1yybcw49po6nrw',
        data: obj
      };
    });

    console.log(JSON.stringify(data, null, 2));
  }
  browser.disconnect();
}
run().catch(console.error);
