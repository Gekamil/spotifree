import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const appPage = pages.find(p => p.url().includes('5173'));

  // 1. Click playlist "Romeo & Prince" in sidebar
  await appPage.evaluate(() => {
    const asideItems = Array.from(document.querySelectorAll('aside p'));
    const target = asideItems.find(p => p.innerText.includes('Romeo & Prince') || p.innerText.includes('Canciones'));
    if (target) {
      const container = target.closest('div[class*="cursor-pointer"]') || target;
      container.click();
    }
  });
  await new Promise(r => setTimeout(r, 1200));

  // 2. Click track 1
  await appPage.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('div[class*="grid-cols-[20px"]:not(.border-b)'));
    if (rows[0]) rows[0].click();
  });
  await new Promise(r => setTimeout(r, 1500));

  // 3. Click '<' button on the right edge of main view
  const expandClicked = await appPage.evaluate(() => {
    const btn = document.querySelector('button[aria-label="Mostrar la vista Sonando"]');
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  });
  console.log('Expand handle clicked:', expandClicked);
  await new Promise(r => setTimeout(r, 1200));

  // 4. Check right sidebar DOM
  const sidebarData = await appPage.evaluate(() => {
    const aside = document.querySelector('aside#Desktop_PanelContainer_Id');
    if (!aside) return { error: 'No right sidebar' };
    const headings = Array.from(aside.querySelectorAll('h2, h3, h4')).map(h => h.innerText);
    const lyrics = Array.from(aside.querySelectorAll('p[class*="font-black"]')).map(p => p.innerText);
    const collapseBtn = !!aside.querySelector('button[aria-label="Ocultar la vista Sonando"]');
    return {
      title: aside.querySelector('h2')?.innerText,
      headings,
      lyrics,
      collapseBtn
    };
  });
  console.log('Sidebar Data:', JSON.stringify(sidebarData, null, 2));

  await appPage.screenshot({ path: 'scripts/live-right-sidebar-open.png' });
  console.log('Screenshot saved to scripts/live-right-sidebar-open.png');

  browser.disconnect();
}

main().catch(console.error);
