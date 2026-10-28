import puppeteer from 'puppeteer-core';

async function testDesktopAdd() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  await page.goto('https://spotifreeweb.vercel.app/', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.evaluate(() => {
    window.localStorage.clear();
    const testUserId = 'test_user_desktop_999';
    window.localStorage.setItem('user_spotify_cookie', 'AQB_desktop_test_12345678901234567890');
    window.localStorage.setItem('spotifree_active_user_id', testUserId);
  });

  await page.goto('https://spotifreeweb.vercel.app/', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 2000));

  // Click Liked Songs
  await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a, button, div, span'));
    const target = links.find((el) => el.innerText && el.innerText.trim() === 'Canciones que te gustan');
    if (target) target.click();
  });
  await new Promise((r) => setTimeout(r, 2000));

  // Type in search bar
  console.log('Typing in desktop search bar...');
  await page.type('input[placeholder*="Buscar canciones"]', 'Quevedo');
  await new Promise((r) => setTimeout(r, 2000));

  const addResult = await page.evaluate(() => {
    const addBtns = Array.from(document.querySelectorAll('button')).filter((b) => b.innerText.trim() === 'Añadir');
    if (addBtns.length > 0) {
      addBtns[0].click();
      return { clicked: true, foundButtons: addBtns.length };
    }
    return { clicked: false, foundButtons: 0 };
  });
  console.log('Add Result on Desktop:', addResult);
  await new Promise((r) => setTimeout(r, 1500));

  const trackState = await page.evaluate(() => {
    const rows = document.querySelectorAll('[data-testid="track-row"]');
    const firstTrack = rows[0]?.querySelector('.text-sm.font-semibold')?.innerText;
    const storageKey = 'spotifree_custom_liked_songs_test_user_desktop_999';
    const saved = window.localStorage.getItem(storageKey);
    return {
      rowCount: rows.length,
      firstTrack,
      savedInStorage: !!saved,
      savedCount: saved ? JSON.parse(saved).length : 0,
    };
  });
  console.log('Desktop Track State after adding:', trackState);

  await page.screenshot({
    path: 'C:\\Users\\jorge\\.gemini\\antigravity\\brain\\b7d3ec29-c076-4935-90b5-23f42c286313\\desktop_liked_songs_with_added_track.png',
  });
  console.log('Saved screenshot: desktop_liked_songs_with_added_track.png');
  await browser.close();
}

testDesktopAdd().catch(console.error);
