import puppeteer from 'puppeteer-core';

async function dumpFilterHtml() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const spotifyPage = (await browser.pages()).find(p => p.url().includes('open.spotify.com'));
  if (!spotifyPage) return;

  const html = await spotifyPage.evaluate(() => {
    const siguiendo = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Siguiendo');
    const container = siguiendo?.parentElement || siguiendo?.closest('div');
    return {
      containerHtml: container?.outerHTML,
      grandParentHtml: container?.parentElement?.outerHTML
    };
  });
  console.log('Filter HTML:', JSON.stringify(html, null, 2));
}

dumpFilterHtml().catch(console.error);
