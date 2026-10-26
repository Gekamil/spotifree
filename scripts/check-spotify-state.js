import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const p = pages.find(p => p.url().includes('spotify.com'));
  if (p) {
    console.log('Current URL:', p.url());
    const info = await p.evaluate(() => {
      const nav = document.querySelector('nav');
      const main = document.querySelector('main');
      return {
        navText: nav?.innerText?.replace(/\n+/g, ' | '),
        mainH1: main?.querySelector('h1')?.innerText,
        trackRows: main?.querySelectorAll('div[data-testid="tracklist-row"]').length
      };
    });
    console.log(JSON.stringify(info, null, 2));
  }
  browser.disconnect();
}

main().catch(console.error);
