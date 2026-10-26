import puppeteer from 'puppeteer-core';

async function checkPlayerDur() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const page = (await browser.pages())[0];

  const info = await page.evaluate(() => {
    const times = Array.from(document.querySelectorAll('footer span.w-8')).map(s => s.textContent);
    const fill = document.querySelector('footer div[class*="group relative"] div > div');
    return {
      times,
      styleWidth: fill ? fill.style.width : null,
      outerHtml: fill ? fill.outerHTML : null
    };
  });
  console.log('Player Bar Duration Info:', info);
}

checkPlayerDur().catch(console.error);
