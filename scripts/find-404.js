import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  let appPage = pages.find(p => p.url().includes('127.0.0.1:5173'));
  if (!appPage) appPage = await browser.newPage();

  appPage.on('response', res => {
    if (res.status() === 404) {
      console.log('404 URL:', res.url());
    }
  });

  await appPage.reload({ waitUntil: 'networkidle2' });
  browser.disconnect();
}

main().catch(console.error);
