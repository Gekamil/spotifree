import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  let appPage = pages.find(p => p.url().includes('127.0.0.1:5173'));
  if (!appPage) appPage = await browser.newPage();

  appPage.on('console', msg => console.log('PAGE LOG:', msg.type(), msg.text()));
  appPage.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  await appPage.goto('http://127.0.0.1:5173/');
  await new Promise(r => setTimeout(r, 2000));

  const bodyText = await appPage.evaluate(() => document.body.innerText);
  console.log('Body Text:\n', bodyText.substring(0, 500));

  browser.disconnect();
}

main().catch(console.error);
