import puppeteer from 'puppeteer-core';

async function testMainApp() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const appPage = pages.find(p => p.url().includes('5173'));
  if (!appPage) return;

  console.log('Navigating to http://127.0.0.1:5173/ ...');
  await appPage.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));

  const info = await appPage.evaluate(() => {
    const pills = Array.from(document.querySelectorAll('div[class*="sticky"] button')).map(b => b.innerText);
    const shortcuts = Array.from(document.querySelectorAll('div[class*="group h-[56px]"] span')).map(s => s.innerText);
    const shelves = Array.from(document.querySelectorAll('h2')).map(h => h.innerText);
    return { pills, shortcuts, shelves };
  });
  console.log('Main App on Home:', info);

  // Test clicking "Música"
  console.log('Clicking "Música"...');
  await appPage.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('div[class*="sticky"] button'));
    const m = btns.find(b => b.innerText === 'Música');
    if (m) m.click();
  });
  await new Promise(r => setTimeout(r, 500));

  const pillsMusic = await appPage.evaluate(() => {
    return Array.from(document.querySelectorAll('div[class*="sticky"] button')).map(b => b.innerText);
  });
  console.log('Pills on Música:', pillsMusic);

  // Test clicking "Pódcasts"
  console.log('Clicking "Pódcasts"...');
  await appPage.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('div[class*="sticky"] button'));
    const p = btns.find(b => b.innerText === 'Pódcasts');
    if (p) p.click();
  });
  await new Promise(r => setTimeout(r, 500));

  const podShelves = await appPage.evaluate(() => {
    return Array.from(document.querySelectorAll('h2')).map(h => h.innerText);
  });
  console.log('Shelves on Pódcasts:', podShelves);

  // Test clicking "Audiolibros"
  console.log('Clicking "Audiolibros"...');
  await appPage.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('div[class*="sticky"] button'));
    const a = btns.find(b => b.innerText === 'Audiolibros');
    if (a) a.click();
  });
  await new Promise(r => setTimeout(r, 500));

  const audioShelves = await appPage.evaluate(() => {
    return Array.from(document.querySelectorAll('h2')).map(h => h.innerText);
  });
  console.log('Shelves on Audiolibros:', audioShelves);

  // Return to "Todo"
  await appPage.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('div[class*="sticky"] button'));
    const t = btns.find(b => b.innerText === 'Todo');
    if (t) t.click();
  });
  await new Promise(r => setTimeout(r, 500));

  await appPage.screenshot({ path: 'scripts/verified-home-filters.png' });
  console.log('Screenshot saved to scripts/verified-home-filters.png');

  browser.disconnect();
}

testMainApp().catch(console.error);
