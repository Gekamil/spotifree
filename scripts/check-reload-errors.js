import puppeteer from 'puppeteer-core';

async function checkReloadErrors() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  let appPage = pages.find(p => p.url().includes('127.0.0.1:5173') || p.url().includes('localhost:5173'));

  appPage.on('console', msg => console.log('PAGE LOG:', msg.type(), msg.text()));
  appPage.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  await appPage.reload({ waitUntil: 'networkidle0' });

  browser.disconnect();
}

checkReloadErrors().catch(console.error);
