import puppeteer from 'puppeteer-core';

async function testDragRender() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const page = (await browser.pages())[0];

  const results = await page.evaluate(async () => {
    const bar = document.querySelector('footer div[class*="group relative flex-1 h-3"]');
    if (!bar) return { error: 'no bar' };
    const rect = bar.getBoundingClientRect();
    const fill = bar.querySelector('div > div');

    // Mousedown at 25%
    bar.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: rect.left + rect.width * 0.25 }));
    await new Promise(r => setTimeout(r, 50));
    const w25 = fill ? fill.style.width : null;

    // Mousemove to 50%
    window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: rect.left + rect.width * 0.50 }));
    await new Promise(r => setTimeout(r, 50));
    const w50 = fill ? fill.style.width : null;

    // Mousemove to 80%
    window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: rect.left + rect.width * 0.80 }));
    await new Promise(r => setTimeout(r, 50));
    const w80 = fill ? fill.style.width : null;

    // Mouseup
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: rect.left + rect.width * 0.80 }));
    await new Promise(r => setTimeout(r, 50));
    const wFinal = fill ? fill.style.width : null;

    return { w25, w50, w80, wFinal };
  });

  console.log('Real-time drag test with render yields:', results);
}

testDragRender().catch(console.error);
