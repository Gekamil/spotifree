import puppeteer from 'puppeteer-core';

async function inspectSortDropdown() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const sp = pages.find(p => p.url().includes('open.spotify.com'));
  if (!sp) {
    console.log('No Spotify tab');
    browser.disconnect();
    return;
  }

  // Find the sort button in the sidebar (usually "Recientes" with an arrow or similar)
  const sortInfo = await sp.evaluate(async () => {
    // Find sort trigger button
    const buttons = Array.from(document.querySelectorAll('button'));
    const sortBtn = buttons.find(b => b.innerText.includes('Recientes') || b.getAttribute('aria-label')?.includes('Ordenar') || b.innerText.includes('Ordenar por'));
    
    if (!sortBtn) {
      return { error: 'No sort button found in sidebar' };
    }

    sortBtn.click();
    await new Promise(r => setTimeout(r, 600));

    const menu = document.querySelector('#context-menu, [data-testid="context-menu"], div[role="menu"]');
    if (!menu) return { error: 'No sort menu found after click' };

    const menuHtml = menu.innerHTML;
    const items = Array.from(menu.querySelectorAll('button, li, [role="menuitem"], [role="menuitemradio"]')).map(el => {
      const text = el.innerText.trim();
      const svg = el.querySelector('svg')?.outerHTML;
      const role = el.getAttribute('role');
      const ariaChecked = el.getAttribute('aria-checked');
      return { text, role, ariaChecked, svg };
    });

    return {
      sortBtnText: sortBtn.innerText,
      items,
      menuHtml: menuHtml.slice(0, 1500)
    };
  });

  console.log('Sort dropdown info:', JSON.stringify(sortInfo, null, 2));

  await sp.keyboard.press('Escape');
  browser.disconnect();
}

inspectSortDropdown().catch(console.error);
