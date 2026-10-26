import puppeteer from 'puppeteer-core';

async function testCard() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const appPage = pages.find(p => p.url().includes('5173'));
  if (!appPage) return;

  // Click on "el nuevo urbano" or "J+L(2026)" card text/container to open the playlist
  console.log('1. Opening "el nuevo urbano" playlist...');
  const res = await appPage.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('main div'));
    const jlCard = cards.find(el => el.innerText && el.innerText.includes('el nuevo urbano') && el.innerText.length < 50);
    if (jlCard) {
      jlCard.click();
      return { clicked: true, text: jlCard.innerText };
    }
    return { clicked: false };
  });
  console.log('Playlist open result:', res);
  await new Promise(r => setTimeout(r, 1500));

  // Check tracks in playlist view
  const trackInfo = await appPage.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('.group\\/row, [role="row"]'));
    return {
      rowCount: rows.length,
      first3: rows.slice(0, 3).map(r => r.innerText.replace(/\n/g, ' - ')),
    };
  });
  console.log('Tracks loaded in view:', trackInfo);

  // Click first track row
  console.log('2. Clicking first track to play...');
  const playRes = await appPage.evaluate(() => {
    const rows = document.querySelectorAll('.group\\/row');
    if (rows.length > 0) {
      rows[0].click();
      return { clicked: true, text: rows[0].innerText.replace(/\n/g, ' ') };
    }
    return { clicked: false };
  });
  console.log('Play clicked:', playRes);

  await new Promise(r => setTimeout(r, 1000));

  // Check /api/audio/status
  const status1 = await appPage.evaluate(async () => {
    const res = await fetch('/api/audio/status');
    return await res.json();
  });
  console.log('Status 1 (Track 1 playing):', status1);

  // Click track 1 again to PAUSE
  console.log('3. Clicking track 1 again (should pause)...');
  await appPage.evaluate(() => {
    const rows = document.querySelectorAll('.group\\/row');
    if (rows.length > 0) rows[0].click();
  });
  await new Promise(r => setTimeout(r, 800));

  const status2 = await appPage.evaluate(async () => {
    const res = await fetch('/api/audio/status');
    return await res.json();
  });
  console.log('Status 2 (Should be paused):', status2);

  // Click track 1 again to RESUME
  console.log('4. Clicking track 1 again (should resume)...');
  await appPage.evaluate(() => {
    const rows = document.querySelectorAll('.group\\/row');
    if (rows.length > 0) rows[0].click();
  });
  await new Promise(r => setTimeout(r, 800));

  const status3 = await appPage.evaluate(async () => {
    const res = await fetch('/api/audio/status');
    return await res.json();
  });
  console.log('Status 3 (Should be playing):', status3);

  // Click track 2 to switch instantly
  console.log('5. Clicking track 2 to switch...');
  const t0 = Date.now();
  await appPage.evaluate(() => {
    const rows = document.querySelectorAll('.group\\/row');
    if (rows.length > 1) rows[1].click();
  });

  await new Promise(r => setTimeout(r, 800));
  const status4 = await appPage.evaluate(async () => {
    const res = await fetch('/api/audio/status');
    return await res.json();
  });
  console.log(`Status 4 (Track 2 playing after ${Date.now() - t0}ms):`, status4);

  // Screenshot
  await appPage.screenshot({ path: 'scripts/playlist-playback-verified.png' });
  console.log('Saved screenshot to scripts/playlist-playback-verified.png');

  browser.disconnect();
}

testCard().catch(console.error);
