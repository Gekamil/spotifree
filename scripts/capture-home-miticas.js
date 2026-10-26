import puppeteer from 'puppeteer-core';

async function captureHomeMiticas() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  let appPage = pages.find(p => p.url().includes('127.0.0.1:5173') || p.url().includes('localhost:5173'));

  if (!appPage) {
    browser.disconnect();
    return;
  }

  // Click home button
  await appPage.evaluate(() => {
    const homeBtn = document.querySelector('button[title="Inicio"]');
    if (homeBtn) homeBtn.click();
  });
  await new Promise(r => setTimeout(r, 600));

  // Find exact coordinates of míticas card
  const coords = await appPage.evaluate(() => {
    const allDivs = Array.from(document.querySelectorAll('div'));
    const miticas = allDivs.find(d => d.innerText && d.innerText.includes('míticas') && d.className.includes('group'));
    if (!miticas) return null;
    const rect = miticas.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  });

  if (coords) {
    console.log('Hovering at:', coords);
    await appPage.mouse.move(coords.x, coords.y);
    await new Promise(r => setTimeout(r, 600));
  }

  await appPage.screenshot({
    path: 'C:/Users/jorge/.gemini/antigravity/brain/b7d3ec29-c076-4935-90b5-23f42c286313/spotifree-home-miticas-hover.png'
  });

  console.log('Home with míticas hover captured!');
  browser.disconnect();
}

captureHomeMiticas().catch(console.error);
