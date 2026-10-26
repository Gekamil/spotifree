import puppeteer from 'puppeteer-core';

async function verifyInteractions() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  let appPage = pages.find(p => p.url().includes('127.0.0.1:5173') || p.url().includes('localhost:5173'));

  if (!appPage) {
    appPage = await browser.newPage();
    await appPage.goto('http://127.0.0.1:5173/');
  }

  await appPage.bringToFront();
  await appPage.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await new Promise(r => setTimeout(r, 1000));

  console.log('1. Hovering "míticas" card...');
  await appPage.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('div'));
    const miticas = cards.find(c => c.innerText && c.innerText.includes('míticas') && c.className.includes('group'));
    if (miticas) {
      miticas.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    }
  });
  await new Promise(r => setTimeout(r, 500));
  await appPage.screenshot({
    path: 'C:/Users/jorge/.gemini/antigravity/brain/b7d3ec29-c076-4935-90b5-23f42c286313/spotifree-hover-miticas-gradient.png'
  });

  console.log('2. Opening Sort & View dropdown menu in sidebar...');
  await appPage.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const sortBtn = buttons.find(b => b.innerText.includes('Recientes') || b.innerText.includes('Ordenar'));
    if (sortBtn) sortBtn.click();
  });
  await new Promise(r => setTimeout(r, 600));
  await appPage.screenshot({
    path: 'C:/Users/jorge/.gemini/antigravity/brain/b7d3ec29-c076-4935-90b5-23f42c286313/spotifree-sort-dropdown-perfect.png'
  });

  console.log('3. Navigating to J+L(2026) playlist...');
  await appPage.evaluate(() => {
    // Close modal first
    const items = Array.from(document.querySelectorAll('p, span'));
    const jl = items.find(el => el.innerText.trim() === 'J+L(2026)');
    if (jl) jl.click();
  });
  await new Promise(r => setTimeout(r, 800));

  await appPage.screenshot({
    path: 'C:/Users/jorge/.gemini/antigravity/brain/b7d3ec29-c076-4935-90b5-23f42c286313/spotifree-jl2026-view-perfect.png'
  });

  console.log('4. Clicking More options (...) on J+L(2026) to open exact context menu...');
  await appPage.evaluate(() => {
    const dotsBtn = document.querySelector('button[title*="Más opciones"]');
    if (dotsBtn) dotsBtn.click();
  });
  await new Promise(r => setTimeout(r, 600));

  await appPage.screenshot({
    path: 'C:/Users/jorge/.gemini/antigravity/brain/b7d3ec29-c076-4935-90b5-23f42c286313/spotifree-jl2026-context-menu-perfect.png'
  });

  console.log('All verification screenshots captured!');
  browser.disconnect();
}

verifyInteractions().catch(console.error);
