import puppeteer from 'puppeteer-core';
import fs from 'fs';

async function extractContextMenu() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const sp = pages.find(p => p.url().includes('open.spotify.com'));
  if (!sp) {
    console.log('No Spotify tab');
    browser.disconnect();
    return;
  }

  // Click on the more options button (three dots)
  const menuData = await sp.evaluate(async () => {
    const dotsBtn = document.querySelector('button[aria-label*="Más opciones"]');
    if (!dotsBtn) return { error: 'No dots button found' };
    
    dotsBtn.click();
    await new Promise(r => setTimeout(r, 600));

    // Look for context menu
    const menu = document.querySelector('#context-menu, [data-testid="context-menu"], ul[role="menu"]');
    if (!menu) return { error: 'No menu found after click' };

    const items = Array.from(menu.querySelectorAll('li, button[role="menuitem"], [role="menuitem"]')).map(el => {
      const text = el.innerText.trim();
      const svg = el.querySelector('svg')?.innerHTML;
      const isSeparator = el.getAttribute('role') === 'separator' || el.className.includes('divider');
      return { text, hasSvg: !!svg, svg, isSeparator };
    });

    const menuComputed = window.getComputedStyle(menu);

    return {
      items,
      background: menuComputed.backgroundColor,
      boxShadow: menuComputed.boxShadow,
      borderRadius: menuComputed.borderRadius,
      padding: menuComputed.padding
    };
  });

  console.log('Context menu data:', JSON.stringify(menuData, null, 2));
  fs.writeFileSync('src/data/realContextMenu.json', JSON.stringify(menuData, null, 2));

  // Also close the menu by pressing Escape or clicking outside
  await sp.keyboard.press('Escape');

  browser.disconnect();
}

extractContextMenu().catch(console.error);
