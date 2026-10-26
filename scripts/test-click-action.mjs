import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const page = (await browser.pages())[0];

  const clickRes = await page.evaluate(() => {
    const asideItems = Array.from(document.querySelectorAll('aside p.text-\\[16px\\]'));
    const target = asideItems[0]; // First playlist: Canciones que te gustan
    if (!target) return { found: false };
    const row = target.closest('div[class*="cursor-pointer"]');
    if (!row) return { foundRow: false };
    row.click();
    return { clicked: target.textContent };
  });
  console.log('Click result:', clickRes);

  await new Promise(r => setTimeout(r, 1000));

  const pageView = await page.evaluate(() => {
    const h1 = document.querySelector('h1')?.textContent;
    const rows = document.querySelectorAll('div[class*="grid-cols-[20px"]:not(.border-b)').length;
    return { h1, rows };
  });
  console.log('Page view after click:', pageView);

  browser.disconnect();
}

main().catch(console.error);
