import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('open.spotify.com'));

  const radioImgs = await spotifyPage.evaluate(() => {
    const allSecs = Array.from(document.querySelectorAll('section'));
    const radioSec = allSecs.find(s => s.innerText.includes('Emisoras recomendadas'));
    if (!radioSec) return 'Radio section not found';

    const cards = Array.from(radioSec.querySelectorAll('div[data-testid*="card"], div[class*="Card"], div[role="group"]'));
    return cards.map(c => {
      const title = c.querySelector('a[title], h3, [data-encore-id="text"]:not([data-encore-id="textSubdued"])')?.innerText?.trim();
      const img = c.querySelector('img')?.src;
      return { title, img };
    });
  });

  console.log(JSON.stringify(radioImgs, null, 2));
  browser.disconnect();
}

main().catch(console.error);
