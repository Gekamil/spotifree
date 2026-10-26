import puppeteer from 'puppeteer-core';

async function testGoHomeAndSelectMix() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const page = (await browser.pages()).find(p => p.url().includes('5173'));

  console.log('1. Clicking Home button in top nav...');
  await page.evaluate(() => {
    const homeBtn = document.querySelector('button[title="Inicio"], a[href="/"], button svg[data-icon="home"]')?.closest('button');
    if (homeBtn) {
      homeBtn.click();
    } else {
      // Find home button by icon or first button in header
      const topBtns = Array.from(document.querySelectorAll('header button, nav button'));
      if (topBtns[0]) topBtns[0].click();
    }
  });

  await new Promise(r => setTimeout(r, 1500));

  console.log('2. Finding Mix diario 1 on Home shelves...');
  const found = await page.evaluate(() => {
    const allEls = Array.from(document.querySelectorAll('p, span, h2, h3, div'));
    const mix = allEls.find(el => el.innerText?.trim()?.toLowerCase() === 'mix diario 1');
    if (mix) {
      const card = mix.closest('.cursor-pointer, [onClick]') || mix;
      card.click();
      return true;
    }
    return false;
  });
  console.log('Found and clicked Mix diario 1:', found);

  await new Promise(r => setTimeout(r, 2000));

  const state = await page.evaluate(() => {
    const h1 = document.querySelector('h1')?.innerText;
    const text = document.querySelector('main')?.innerText;
    return { h1, sample: text?.substring(0, 300) };
  });
  console.log('Page state:', state);

  await page.screenshot({ path: 'spotifree-mixdiario-view.png' });
  console.log('Screenshot saved to spotifree-mixdiario-view.png');

  browser.disconnect();
}

testGoHomeAndSelectMix().catch(console.error);
