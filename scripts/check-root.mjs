import puppeteer from 'puppeteer-core';

async function checkConsole() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const page = (await browser.pages())[0];
  
  const rootHtml = await page.evaluate(() => {
    return {
      bodyHtml: document.body.innerHTML.slice(0, 1000),
      rootChildren: document.getElementById('root')?.children.length,
      rootHtml: document.getElementById('root')?.innerHTML.slice(0, 1000)
    };
  });
  console.log('Root HTML:', rootHtml);
}

checkConsole().catch(console.error);
