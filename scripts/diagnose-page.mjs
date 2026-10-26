import puppeteer from 'puppeteer-core';

async function diagnose() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const page = (await browser.pages())[0];

  page.on('console', msg => console.log('CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGEERROR:', err.stack || err.message));
  page.on('error', err => console.log('ERROR:', err));

  console.log('Navigating to http://127.0.0.1:5173/ ...');
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'load' });
  await new Promise(r => setTimeout(r, 2000));

  const content = await page.evaluate(() => {
    return {
      rootKids: document.getElementById('root')?.children.length,
      html: document.getElementById('root')?.innerHTML.slice(0, 200)
    };
  });
  console.log('Content:', content);
}

diagnose().catch(console.error);
