import puppeteer from 'puppeteer-core';

async function inspectBar() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const page = (await browser.pages())[0];

  const html = await page.evaluate(() => {
    const bar = document.querySelector('footer div[class*="group relative flex-1 h-3"]');
    return {
      outer: bar?.outerHTML,
      children: Array.from(bar?.children || []).map(c => ({ tag: c.tagName, class: c.className, style: c.getAttribute('style') })),
      grandChildren: Array.from(bar?.querySelectorAll('*') || []).map(c => ({ tag: c.tagName, class: c.className, style: c.getAttribute('style') }))
    };
  });
  console.log('Bar structure:', JSON.stringify(html, null, 2));
}

inspectBar().catch(console.error);
