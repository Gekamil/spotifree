import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('open.spotify.com'));
  if (spotifyPage) {
    const formHtml = await spotifyPage.evaluate(() => {
      const input = document.querySelector('input[placeholder*="reproducir"]');
      const form = input?.closest('form') || input?.parentElement;
      return {
        html: form?.outerHTML,
        placeholderColor: window.getComputedStyle(input, '::placeholder').color
      };
    });
    console.log(JSON.stringify(formHtml, null, 2));
  }
  browser.disconnect();
}

main().catch(console.error);
