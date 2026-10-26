import puppeteer from 'puppeteer-core';

async function testClick() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const page = (await browser.pages())[0];

  const clicked = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('aside p.text-\\[16px\\]'));
    const target = items.find(p => (p.textContent || '').includes('Romeo') || (p.textContent || '').includes('Canciones'));
    if (target) {
      const row = target.closest('div[class*="cursor-pointer"]');
      if (row) {
        row.click();
        return { clicked: true, text: target.textContent };
      }
    }
    return { clicked: false, available: items.map(i => i.textContent) };
  });

  console.log('Click result:', clicked);
  await new Promise(r => setTimeout(r, 1500));

  const mainView = await page.evaluate(() => {
    return {
      h1: document.querySelector('h1')?.textContent,
      tracksCount: document.querySelectorAll('div[class*="grid-cols-[20px"]:not(.border-b)').length,
      firstTrack: document.querySelector('div[class*="grid-cols-[20px"]:not(.border-b)')?.textContent?.slice(0, 100)
    };
  });
  console.log('Main view after click:', mainView);
}

testClick().catch(console.error);
