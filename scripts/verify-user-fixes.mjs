import puppeteer from 'puppeteer-core';

async function verifyAll() {
  console.log('Connecting to Chrome on port 9222...');
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const appPage = pages.find(p => p.url().includes('5173'));
  if (!appPage) {
    console.error('No Spotifree tab found at 5173');
    browser.disconnect();
    return;
  }

  await appPage.bringToFront();
  await appPage.reload({ waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));

  // --- 1. Filter Pills Test (Home View) ---
  console.log('\n=== 1. Testing Home Filter Pills ===');
  const pillsInitial = await appPage.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('div[class*="sticky"] button'));
    return btns.map(b => b.innerText);
  });
  console.log('Initial pills on Home:', pillsInitial);

  // Click "Música"
  console.log('Clicking "Música" filter...');
  await appPage.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('div[class*="sticky"] button'));
    const musica = btns.find(b => b.innerText === 'Música');
    if (musica) musica.click();
  });
  await new Promise(r => setTimeout(r, 600));

  const pillsAfterMusica = await appPage.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('div[class*="sticky"] button'));
    return btns.map(b => b.innerText);
  });
  console.log('Pills when on Música (should include Siguiendo):', pillsAfterMusica);

  // Click "Pódcasts"
  console.log('Clicking "Pódcasts" filter...');
  await appPage.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('div[class*="sticky"] button'));
    const pod = btns.find(b => b.innerText === 'Pódcasts');
    if (pod) pod.click();
  });
  await new Promise(r => setTimeout(r, 600));

  const podcastsShelves = await appPage.evaluate(() => {
    const h2s = Array.from(document.querySelectorAll('h2')).map(h => h.innerText);
    return h2s;
  });
  console.log('Shelves on Pódcasts view:', podcastsShelves);

  // Click "Audiolibros"
  console.log('Clicking "Audiolibros" filter...');
  await appPage.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('div[class*="sticky"] button'));
    const b = btns.find(b => b.innerText === 'Audiolibros');
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 600));

  const audiobooksShelves = await appPage.evaluate(() => {
    const h2s = Array.from(document.querySelectorAll('h2')).map(h => h.innerText);
    return h2s;
  });
  console.log('Shelves on Audiolibros view:', audiobooksShelves);

  // Return to "Todo"
  await appPage.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('div[class*="sticky"] button'));
    const todo = btns.find(b => b.innerText === 'Todo');
    if (todo) todo.click();
  });
  await new Promise(r => setTimeout(r, 600));

  // --- 2. Playlist Playback, Sidebar Speaker Icon & Track EQ Animation ---
  console.log('\n=== 2. Testing Playlist Playback, Sidebar Speaker & Track EQ ===');
  // Open playlist from sidebar (e.g. J+L(2026) or first playlist row)
  await appPage.evaluate(() => {
    const sidebarRows = Array.from(document.querySelectorAll('aside p.text-\\[16px\\]'));
    const target = sidebarRows.find(p => p.innerText.includes('J+L') || p.innerText.includes('Canciones') || p.innerText.includes('Romeo'));
    if (target) {
      target.closest('div[class*="cursor-pointer"]').click();
    }
  });
  await new Promise(r => setTimeout(r, 1500));

  // Click track 1 to play
  await appPage.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('div[class*="grid-cols-[20px"]:not(.border-b)'));
    if (rows[0]) rows[0].click();
  });
  await new Promise(r => setTimeout(r, 2000));

  // Check audio status
  const playStatus = await appPage.evaluate(async () => {
    const res = await fetch('/api/audio/status');
    return await res.json();
  });
  console.log('Playback status after track 1 start:', playStatus);

  // Check Sidebar green speaker icon
  const sidebarSpeakerFound = await appPage.evaluate(() => {
    const speakerSvg = document.querySelector('aside svg[viewBox="0 0 16 16"].text-\\[\\#1ed760\\]') ||
      document.querySelector('aside span.text-\\[\\#1ed760\\] svg');
    return !!speakerSvg;
  });
  console.log('Sidebar green speaker icon present (instead of bars):', sidebarSpeakerFound);

  // Check Track row animated equalizer
  const trackEqClasses = await appPage.evaluate(() => {
    const eqBars = Array.from(document.querySelectorAll('[class*="animate-spotify-eq"]'));
    return eqBars.map(b => b.className);
  });
  console.log('Track equalizer bar classes (should be animate-spotify-eq-1, 2, 3):', trackEqClasses);

  // --- 3. Seeking Test (Advance 60 seconds) ---
  console.log('\n=== 3. Testing Seeking / Advancing 60 seconds ===');
  const seekTarget = 65;
  await appPage.evaluate(async (target) => {
    await fetch('/api/audio/control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'seek', position: target }),
    });
  }, seekTarget);

  // Wait 1.5s for audio to catch up
  await new Promise(r => setTimeout(r, 1500));

  const afterSeekStatus1 = await appPage.evaluate(async () => {
    const res = await fetch('/api/audio/status');
    return await res.json();
  });
  console.log('Status 1.5s after seek to 65s:', afterSeekStatus1);

  // Check if it is progressing (not silent/stalled)
  await new Promise(r => setTimeout(r, 1200));
  const afterSeekStatus2 = await appPage.evaluate(async () => {
    const res = await fetch('/api/audio/status');
    return await res.json();
  });
  console.log('Status 2.7s after seek (should show progressing time):', afterSeekStatus2);

  // --- 4. Settings View & Real Equalizer Test ---
  console.log('\n=== 4. Testing Settings View & Real Equalizer ===');
  // Open Settings via Profile
  await appPage.evaluate(() => {
    const headerBtns = Array.from(document.querySelectorAll('header button'));
    const avatar = headerBtns.find(b => b.querySelector('img') || b.querySelector('span.rounded-full'));
    if (avatar) avatar.click();
  });
  await new Promise(r => setTimeout(r, 500));

  await appPage.evaluate(() => {
    const dropdownBtns = Array.from(document.querySelectorAll('div[class*="absolute"] button'));
    const cfg = dropdownBtns.find(b => b.innerText.includes('Configuración'));
    if (cfg) cfg.click();
  });
  await new Promise(r => setTimeout(r, 1000));

  const settingsCheck = await appPage.evaluate(() => {
    const h1 = document.querySelector('h1')?.innerText;
    const h2s = Array.from(document.querySelectorAll('h2')).map(h => h.innerText);
    const hasFooter = !!document.querySelector('footer a[href*="about-us"]');
    const presets = Array.from(document.querySelectorAll('select option')).map(o => o.text);
    const eqSliders = document.querySelectorAll('input[type="range"]').length;
    return { h1, h2s, hasFooter, presets, eqSliders };
  });
  console.log('Settings Check Result:', settingsCheck);

  // Test Equalizer Preset Change (e.g. Bass Boost)
  console.log('Changing EQ preset to "Refuerzo de graves"...');
  const eqSyncRes = await appPage.evaluate(async () => {
    const select = Array.from(document.querySelectorAll('select')).find(s => s.innerText.includes('Plano'));
    if (select) {
      select.value = 'bassBoost';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    return false;
  });
  console.log('Changed EQ preset in UI:', eqSyncRes);

  await appPage.screenshot({ path: 'scripts/verified-all-fixes.png' });
  console.log('Saved screenshot to scripts/verified-all-fixes.png');

  browser.disconnect();
}

verifyAll().catch(console.error);
