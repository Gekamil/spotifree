import puppeteer from 'puppeteer-core';

async function testSidebarFilters() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const page = (await browser.pages()).find(p => p.url().includes('5173'));

  console.log('1. Testing "Artistas" filter button...');
  const artistsCount = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('aside button')).find(b => b.innerText?.trim() === 'Artistas');
    if (btn) btn.click();
    const rows = Array.from(document.querySelectorAll('aside [data-testid="playlist-item"], aside div.cursor-pointer'));
    return rows.length;
  });
  console.log('Rows showing with "Artistas" filter:', artistsCount);

  await new Promise(r => setTimeout(r, 1000));

  console.log('2. Testing "Listas" filter button...');
  const playlistsCount = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('aside button')).find(b => b.innerText?.trim() === 'Listas');
    if (btn) btn.click();
    const rows = Array.from(document.querySelectorAll('aside [data-testid="playlist-item"], aside div.cursor-pointer'));
    return rows.length;
  });
  console.log('Rows showing with "Listas" filter:', playlistsCount);

  await new Promise(r => setTimeout(r, 1000));

  console.log('3. Testing sorting (Orden alfabético)...');
  await page.evaluate(() => {
    // Open sort menu
    const sortBtn = Array.from(document.querySelectorAll('aside button')).find(b => b.innerText?.includes('Recientes') || b.innerText?.includes('Orden'));
    if (sortBtn) sortBtn.click();
  });

  await new Promise(r => setTimeout(r, 600));

  const sortedList = await page.evaluate(() => {
    const alphaBtn = Array.from(document.querySelectorAll('div, button')).find(el => el.innerText?.trim() === 'Orden alfabético');
    if (alphaBtn) alphaBtn.click();
    const names = Array.from(document.querySelectorAll('aside p')).map(p => p.innerText.trim()).filter(Boolean);
    return names.slice(0, 8);
  });
  console.log('Playlists sorted alphabetically:', sortedList);

  browser.disconnect();
}

testSidebarFilters().catch(console.error);
