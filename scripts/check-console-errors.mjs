import puppeteer from 'puppeteer-core';

async function checkErrors() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const page = (await browser.pages())[0];

  page.on('console', msg => console.log('PAGE LOG:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  console.log('Reloading page to capture console errors...');
  await page.reload({ waitUntil: 'networkidle0' });
  console.log('Reload finished.');
}

checkErrors().catch(console.error);
