import puppeteer from 'puppeteer-core';

async function testSpotifreeUI() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const page = (await browser.pages()).find(p => p.url().includes('5173'));
  if (!page) {
    console.error('Spotifree page not found on 9222');
    browser.disconnect();
    return;
  }

  console.log('1. Reloading Spotifree page to get latest frontend build...');
  await page.reload({ waitUntil: 'networkidle2' });

  console.log('2. Inspecting page title and header...');
  const title = await page.title();
  console.log('Spotifree title:', title);

  // Check sidebar playlists
  const playlists = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('aside p')).map(p => p.innerText.trim()).filter(Boolean);
  });
  console.log('Sidebar playlists found:', playlists.slice(0, 10));

  // Click on "míticas" playlist
  console.log('3. Clicking on míticas playlist...');
  const clickedMiticas = await page.evaluate(() => {
    const pEls = Array.from(document.querySelectorAll('aside div, aside p'));
    const miticasEl = pEls.find(el => el.innerText && el.innerText.toLowerCase().includes('míticas'));
    if (miticasEl) {
      (miticasEl.closest('[onClick]') || miticasEl).click();
      return true;
    }
    return false;
  });
  console.log('Clicked miticas:', clickedMiticas);

  await new Promise(r => setTimeout(r, 2000));

  // Check tracks in playlist view
  const trackInfo = await page.evaluate(() => {
    const h1 = document.querySelector('h1')?.innerText;
    const metadata = document.querySelector('h1')?.nextElementSibling?.nextElementSibling?.innerText || '';
    const trackRows = document.querySelectorAll('[data-track-row], div.group\\/track, tr, div[role="row"]');
    const tableText = document.querySelector('main')?.innerText;
    return {
      title: h1,
      metadata,
      rowsCount: trackRows.length,
      sampleText: tableText?.substring(0, 200),
    };
  });
  console.log('Playlist view state:', trackInfo);

  browser.disconnect();
}

testSpotifreeUI().catch(console.error);
