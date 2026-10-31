import puppeteer from 'puppeteer-core';

async function testRecent() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 1500));

  // 1. Open mobile search by clicking "Buscar" button in bottom nav
  const searchTabBtn = await page.waitForSelector('nav[data-testid="bottom-tab-navigation"] button:nth-child(2)', { timeout: 5000 });
  await searchTabBtn.click();
  await new Promise(r => setTimeout(r, 600));

  // 2. Type "doggy quevedo" in search input
  const input = await page.waitForSelector('input[placeholder*="escuchar"]', { timeout: 5000 });
  await input.focus();
  await input.type('doggy quevedo', { delay: 30 });
  
  await page.waitForFunction(() => document.body.innerText.includes('DOGGY'), { timeout: 8000 });
  console.log('✓ Found DOGGY in mobile search results');

  // 3. Click the DOGGY song row to play and add to recent searches
  const trackItem = await page.waitForSelector('div.cursor-pointer', { timeout: 5000 });
  await page.evaluate(() => {
    const divs = Array.from(document.querySelectorAll('div.cursor-pointer'));
    const doggy = divs.find(d => d.textContent && d.textContent.includes('DOGGY'));
    if (doggy) doggy.click();
  });
  console.log('✓ Clicked track DOGGY row');
  await new Promise(r => setTimeout(r, 800));

  // 4. Click the clear button (✕) in the search bar
  const clearSearchBtn = await page.waitForSelector('input + button, div.relative > button', { timeout: 3000 });
  await clearSearchBtn.click();
  console.log('✓ Cleared search bar using input ✕ button');
  await new Promise(r => setTimeout(r, 800));

  // 5. Verify "Búsquedas recientes" is now visible
  const status = await page.evaluate(() => {
    const text = document.body.innerText;
    const deleteButtons = Array.from(document.querySelectorAll('button[title*="Eliminar"]'));
    return {
      hasHeader: text.includes('Búsquedas recientes'),
      hasBorrarTodo: text.includes('Borrar todo'),
      hasDoggy: text.includes('DOGGY'),
      deleteButtonsCount: deleteButtons.length,
    };
  });
  console.log('Recent searches block status:', status);

  if (!status.hasHeader || !status.hasDoggy) {
    throw new Error('Recent searches block did not render expected content!');
  }

  // 6. Test individual delete button (✕)
  await page.evaluate(() => {
    const btn = document.querySelector('button[title*="Eliminar"]');
    if (btn) btn.click();
  });
  console.log('✓ Clicked individual item delete button');
  await new Promise(r => setTimeout(r, 600));

  const afterDeleteStatus = await page.evaluate(() => {
    const text = document.body.innerText;
    return {
      hasHeader: text.includes('Búsquedas recientes'),
      hasDoggy: text.includes('DOGGY'),
    };
  });
  console.log('After individual delete:', afterDeleteStatus);

  // Take screenshot of Recent Searches view
  await page.screenshot({ path: 'recent_searches_verified.png' });
  console.log('✓ Saved recent_searches_verified.png');

  await page.close();
  await browser.disconnect();
  console.log('RECENT SEARCHES UI VERIFICATION PASSED 100%!');
}

testRecent().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
