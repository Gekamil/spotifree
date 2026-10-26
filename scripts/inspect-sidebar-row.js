import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('open.spotify.com'));
  if (spotifyPage) {
    const rowHtml = await spotifyPage.evaluate(() => {
      const row = Array.from(document.querySelectorAll('nav div[role="row"]')).find(r => r.innerText.includes('Canciones que te gustan') || r.innerText.includes('Romeo & Prince'));
      return {
        html: row?.outerHTML
      };
    });
    console.log(JSON.stringify(rowHtml, null, 2));
  }
  browser.disconnect();
}

main().catch(console.error);
