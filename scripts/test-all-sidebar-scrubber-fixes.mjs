import puppeteer from 'puppeteer-core';

async function testAll() {
  console.log('Connecting to Chrome on 9222...');
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const appPage = pages.find(p => p.url().includes('5173'));
  if (!appPage) {
    console.error('No Spotifree app page found');
    browser.disconnect();
    return;
  }

  await appPage.bringToFront();
  await appPage.reload({ waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));

  // --- 1. Select a Playlist and Play Track ---
  console.log('\n=== 1. Opening Playlist and Starting Playback ===');
  await appPage.evaluate(() => {
    const p = Array.from(document.querySelectorAll('aside p')).find(el => el.innerText.includes('Canciones que te gustan') || el.innerText.includes('Romeo'));
    if (p) {
      const container = p.closest('div[class*="cursor-pointer"]') || p;
      container.click();
    }
  });
  await new Promise(r => setTimeout(r, 1500));

  // Click the big green play button
  await appPage.evaluate(() => {
    const playBtn = document.querySelector('button[title="Reproducir"]');
    if (playBtn) playBtn.click();
  });
  await new Promise(r => setTimeout(r, 2000));

  // --- 2. Test Draggable Scrubber Progress Bar ---
  console.log('\n=== 2. Testing Draggable Scrubber Progress Bar ===');
  const scrubberTest = await appPage.evaluate(async () => {
    const bar = document.querySelector('footer div[class*="group relative flex-1 h-3"]');
    if (!bar) return { error: 'No progress bar found' };

    const rect = bar.getBoundingClientRect();
    const startX = rect.left + rect.width * 0.2;
    const moveX = rect.left + rect.width * 0.6;
    const endX = rect.left + rect.width * 0.75;

    // Simulate MouseDown at 20%
    bar.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: startX }));
    // Simulate Drag to 60%
    window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: moveX }));

    // Read drag percentage
    const fillEl = bar.querySelector('div > div');
    const dragWidthDuringMove = fillEl ? fillEl.style.width : null;

    // Simulate MouseUp at 75%
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: endX }));

    return { dragWidthDuringMove, rectWidth: rect.width };
  });
  console.log('Scrubber Drag Result:', scrubberTest);

  // --- 3. Verify Audio Progresses Past 60 Seconds Smoothly ---
  console.log('\n=== 3. Testing Audio Past 60 Seconds Without Silence ===');
  // Seek to 65s
  await appPage.evaluate(async () => {
    await fetch('/api/audio/control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'seek', position: 65 }),
    });
  });
  await new Promise(r => setTimeout(r, 2000));

  const statusAt67 = await appPage.evaluate(async () => {
    const res = await fetch('/api/audio/status');
    return await res.json();
  });
  console.log('Audio Status after seek to 65s:', statusAt67);

  await new Promise(r => setTimeout(r, 2000));
  const statusAt69 = await appPage.evaluate(async () => {
    const res = await fetch('/api/audio/status');
    return await res.json();
  });
  console.log('Audio Status 2s later (should be > 65s and progressing):', statusAt69);

  // --- 4. Test Right Sidebar Expand Button ("<") ---
  console.log('\n=== 4. Testing Expand Right Sidebar Button ("<") ===');
  // Ensure sidebar is closed first
  await appPage.evaluate(() => {
    const closeBtn = document.querySelector('button[aria-label="Ocultar la vista Sonando"]');
    if (closeBtn) closeBtn.click();
  });
  await new Promise(r => setTimeout(r, 500));

  const hasExpandHandle = await appPage.evaluate(() => {
    const btn = document.querySelector('button[aria-label="Mostrar la vista Sonando"]');
    return !!btn;
  });
  console.log('Expand handle ("<") present on main right edge:', hasExpandHandle);

  // Click the "<" handle to open right sidebar
  await appPage.evaluate(() => {
    const btn = document.querySelector('button[aria-label="Mostrar la vista Sonando"]');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 1000));

  // --- 5. Inspect Right Sidebar "Vista Sonando" Content ---
  console.log('\n=== 5. Inspecting Right Sidebar "Vista Sonando" Sections ===');
  const rightSidebarInfo = await appPage.evaluate(() => {
    const aside = document.querySelector('aside#Desktop_PanelContainer_Id');
    if (!aside) return { error: 'No right sidebar found' };

    const collapseBtn = !!aside.querySelector('button[aria-label="Ocultar la vista Sonando"]');
    const title = aside.querySelector('h2')?.innerText;
    const hasLyricsPreview = aside.innerText.includes('Vista previa de la letra');
    const lyricsLines = Array.from(aside.querySelectorAll('p[class*="font-black text-"]')).map(p => p.innerText);
    const hasRelatedVideos = aside.innerText.includes('Vídeos musicales relacionados');
    const hasArtistInfo = aside.innerText.includes('Información sobre el artista');
    const hasCredits = aside.innerText.includes('Créditos');
    const hasQueuePreview = aside.innerText.includes('A continuación en la cola');

    return {
      collapseBtn,
      title,
      hasLyricsPreview,
      lyricsLines,
      hasRelatedVideos,
      hasArtistInfo,
      hasCredits,
      hasQueuePreview,
    };
  });
  console.log('Right Sidebar Info:', rightSidebarInfo);

  // Take screenshot of Right Sidebar
  await appPage.screenshot({ path: 'scripts/verified-right-sidebar.png' });
  console.log('Saved screenshot to scripts/verified-right-sidebar.png');

  // Test Collapse button [>|]
  console.log('Clicking collapse button [>|]...');
  await appPage.evaluate(() => {
    const closeBtn = document.querySelector('button[aria-label="Ocultar la vista Sonando"]');
    if (closeBtn) closeBtn.click();
  });
  await new Promise(r => setTimeout(r, 600));

  const closedCheck = await appPage.evaluate(() => {
    const aside = document.querySelector('aside#Desktop_PanelContainer_Id');
    const expandBtn = document.querySelector('button[aria-label="Mostrar la vista Sonando"]');
    return { sidebarClosed: !aside, expandBtnVisible: !!expandBtn };
  });
  console.log('After collapse check:', closedCheck);

  browser.disconnect();
}

testAll().catch(console.error);
