import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('open.spotify.com'));
  if (spotifyPage) {
    const html = await spotifyPage.evaluate(() => {
      const bib = Array.from(document.querySelectorAll('*')).find(el => el.children.length === 0 && el.textContent.trim() === 'Tu biblioteca');
      const nav = bib?.closest('nav') || bib?.closest('[role="navigation"]') || bib?.closest('.your-library');
      return nav ? nav.outerHTML.substring(0, 1500) : 'None';
    });
    console.log('Nav HTML:', html);
  }
  browser.disconnect();
}

main().catch(console.error);
