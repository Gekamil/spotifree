import puppeteer from 'puppeteer-core';
import fs from 'fs';

async function extractSortMenuCss() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const sp = pages.find(p => p.url().includes('open.spotify.com'));
  if (!sp) {
    browser.disconnect();
    return;
  }

  const cssData = await sp.evaluate(async () => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const sortBtn = buttons.find(b => b.innerText.includes('Recientes') || b.getAttribute('aria-label')?.includes('Ordenar') || b.innerText.includes('Ordenar por'));
    if (!sortBtn) return null;
    sortBtn.click();
    await new Promise(r => setTimeout(r, 600));

    const menu = document.querySelector('#sort-and-view-picker, #context-menu, [data-testid="context-menu"]');
    if (!menu) return null;

    const computed = window.getComputedStyle(menu);
    const ul = menu.querySelector('ul');
    const ulComputed = ul ? window.getComputedStyle(ul) : null;

    // View mode row container
    const viewModeHeader = Array.from(menu.querySelectorAll('li, span')).find(el => el.innerText === 'Ver como');
    const viewButtonsRow = viewModeHeader?.parentElement?.nextElementSibling || viewModeHeader?.nextElementSibling;

    return {
      outerStyles: {
        bg: computed.backgroundColor,
        padding: computed.padding,
        borderRadius: computed.borderRadius,
        boxShadow: computed.boxShadow,
        width: computed.width
      },
      ulStyles: ulComputed ? {
        bg: ulComputed.backgroundColor,
        padding: ulComputed.padding
      } : null,
      fullHtml: menu.outerHTML
    };
  });

  fs.writeFileSync('src/data/sortMenuStructure.json', JSON.stringify(cssData, null, 2));
  console.log('Saved sort menu structure!');
  await sp.keyboard.press('Escape');
  browser.disconnect();
}

extractSortMenuCss().catch(console.error);
