import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const p = pages.find(p => p.url().includes('spotify.com'));
  if (p) {
    await p.evaluate(() => {
      const link = document.createElement('a');
      link.href = '/playlist/4Jf0fa5p0ajOnSriA9cYGS';
      document.body.appendChild(link);
      link.click();
      link.remove();
    });
    await new Promise(r => setTimeout(r, 2000));
    console.log('Current URL:', p.url());
    const h1 = await p.evaluate(() => document.querySelector('h1')?.innerText);
    console.log('H1:', h1);
    const rows = await p.evaluate(() => document.querySelectorAll('div[data-testid="tracklist-row"]').length);
    console.log('Track rows:', rows);
  }
  browser.disconnect();
}

main().catch(console.error);
