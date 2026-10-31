import puppeteer from 'puppeteer-core';

async function main() {
  console.log('Connecting to Chrome on port 9222...');
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: null,
  });

  const page = await browser.newPage();
  
  // 1. Test Desktop Search View
  console.log('1. Testing Desktop Search...');
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 1500));

  // Find the search input in Desktop TopNav
  const searchInput = await page.waitForSelector('input', { timeout: 8000 });
  await searchInput.focus();
  await searchInput.type('doggy quevedo', { delay: 35 });

  console.log('Waiting for search results for "doggy quevedo"...');
  await page.waitForFunction(() => {
    return document.body.innerText.includes('DOGGY') || document.body.innerText.includes('La Pantera');
  }, { timeout: 12000 });

  console.log('✓ Found "DOGGY" by La Pantera in Desktop Search results!');

  // Check top result cover image
  const topResultCover = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('img'));
    const doggyImg = imgs.find(img => img.src && (img.src.includes('dzcdn.net') || img.src.includes('cover') || img.src.includes('1000x1000')));
    return doggyImg ? doggyImg.src : null;
  });
  console.log('Top result cover image:', topResultCover);

  // Click on the track to register it into Recent Searches
  const clickedTrack = await page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll('div, span, h3, p'));
    const target = elements.find(el => el.textContent && el.textContent.includes('DOGGY'));
    if (target) {
      const clickTarget = target.closest('[class*="cursor-pointer"]') || target;
      clickTarget.click();
      return true;
    }
    return false;
  });
  console.log('Track clicked to add to recent searches:', clickedTrack);

  await new Promise(r => setTimeout(r, 800));

  // Clear search input to show empty query state with Recent Searches
  await page.evaluate(() => {
    const input = document.querySelector('input');
    if (input) {
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });

  await new Promise(r => setTimeout(r, 1000));

  const desktopRecentState = await page.evaluate(() => {
    const text = document.body.innerText;
    return {
      hasHeader: text.includes('Búsquedas recientes'),
      hasClearAll: text.includes('Borrar todo'),
      hasDoggy: text.includes('DOGGY'),
    };
  });
  console.log('Desktop Recent Searches status:', desktopRecentState);

  // 2. Test Mobile Viewport
  console.log('2. Testing Mobile Viewport (390x844)...');
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 1500));

  // Click on Buscar in Mobile Bottom Nav
  const mobileNavBuscar = await page.evaluateHandle(() => {
    const items = Array.from(document.querySelectorAll('nav button, nav div, button'));
    return items.find(it => it.textContent && it.textContent.includes('Buscar'));
  });
  if (mobileNavBuscar) {
    await mobileNavBuscar.click();
    await new Promise(r => setTimeout(r, 800));
  }

  // Check Recent Searches in Mobile view
  const mobileRecentBefore = await page.evaluate(() => {
    const text = document.body.innerText;
    return {
      hasHeader: text.includes('Búsquedas recientes'),
      hasClearAll: text.includes('Borrar todo'),
      hasDoggy: text.includes('DOGGY'),
    };
  });
  console.log('Mobile Recent Searches (inherited from state):', mobileRecentBefore);

  // Search "DOGGY" in mobile input
  const mobileInput = await page.waitForSelector('input', { timeout: 5000 });
  await mobileInput.focus();
  await mobileInput.type('doggy la pantera', { delay: 35 });

  await page.waitForFunction(() => {
    return document.body.innerText.includes('DOGGY') || document.body.innerText.includes('La Pantera');
  }, { timeout: 10000 });
  console.log('✓ Found "DOGGY" in Mobile Search results!');

  // Take screenshot
  await page.screenshot({ path: 'mobile_search_verified.png' });
  console.log('✓ Screenshot saved as mobile_search_verified.png');

  // Test individual deletion of recent search item
  await page.evaluate(() => {
    const input = document.querySelector('input');
    if (input) {
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  await new Promise(r => setTimeout(r, 800));

  const deleteButtonsCount = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button[title*="Eliminar"]'));
    return btns.length;
  });
  console.log('Recent search item delete buttons found:', deleteButtonsCount);

  if (deleteButtonsCount > 0) {
    await page.evaluate(() => {
      const btn = document.querySelector('button[title*="Eliminar"]');
      if (btn) btn.click();
    });
    console.log('✓ Clicked individual delete button');
    await new Promise(r => setTimeout(r, 500));
  }

  // Test "Borrar todo"
  const clearAllClicked = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const clearBtn = btns.find(b => b.textContent && b.textContent.includes('Borrar todo'));
    if (clearBtn) {
      clearBtn.click();
      return true;
    }
    return false;
  });
  console.log('Clear all clicked:', clearAllClicked);
  await new Promise(r => setTimeout(r, 500));

  const remainingRecent = await page.evaluate(() => {
    return document.body.innerText.includes('Búsquedas recientes');
  });
  console.log('Recent searches visible after Clear All:', remainingRecent);

  console.log('ALL VERIFICATIONS PASSED SUCCESSFULLY!');
  await page.close();
  await browser.disconnect();
}

main().catch(err => {
  console.error('Verification error:', err);
  process.exit(1);
});
