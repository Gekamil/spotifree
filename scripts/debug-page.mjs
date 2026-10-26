import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const appPage = pages.find(p => p.url().includes('5173'));
  console.log('URL:', appPage.url());

  const info = await appPage.evaluate(() => {
    return {
      title: document.title,
      mainHtml: document.querySelector('main')?.innerHTML.slice(0, 500),
      navButtons: Array.from(document.querySelectorAll('header button, nav button')).map(b => b.innerText || b.getAttribute('aria-label'))
    };
  });
  console.log('Page info:', JSON.stringify(info, null, 2));
  await appPage.screenshot({ path: 'scripts/current-page-view.png' });
  browser.disconnect();
}

main().catch(console.error);
