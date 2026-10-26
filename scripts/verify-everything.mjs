import puppeteer from 'puppeteer-core';

async function verifyEverything() {
  console.log('Connecting to Chrome on port 9222...');
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const page = pages[0];

  await page.bringToFront();
  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));

  console.log('\n=== 1. Starting Playback of Track ===');
  // Play a track with full metadata
  await page.evaluate(() => {
    window.__usePlayerStore.getState().playTrack({
      id: 'track-romeo-better-late',
      name: 'Better Late Than Never',
      duration_ms: 248000,
      artists: [{ id: 'a1', name: 'Romeo Santos' }, { id: 'a2', name: 'Prince Royce' }],
      album: {
        id: 'alb1',
        name: 'Romeo & Prince',
        images: [{ url: 'https://i.scdn.co/image/ab67616d0000b273eb31ebdbca6acd99c23b4d31', width: 640, height: 640 }]
      }
    });
  });
  await new Promise(r => setTimeout(r, 1000));

  const playerState = await page.evaluate(() => {
    const track = document.querySelector('footer span.text-white')?.textContent;
    const scrubber = !!document.querySelector('footer div[class*="group relative flex-1 h-3"]');
    return { track, scrubber };
  });
  console.log('Player status:', playerState);

  // === 2. Test Draggable Scrubber ===
  console.log('\n=== 2. Testing Scrubber Dragging Real-time ===');
  const dragTest = await page.evaluate(() => {
    const bar = document.querySelector('footer div[class*="group relative flex-1 h-3"]');
    if (!bar) return { error: 'No scrubber' };
    const rect = bar.getBoundingClientRect();

    // 1. Mouse down at 25%
    bar.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: rect.left + rect.width * 0.25 }));
    // 2. Drag to 50%
    window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: rect.left + rect.width * 0.50 }));
    const fillEl = bar.querySelector('div > div');
    const widthAt50 = fillEl ? fillEl.style.width : null;

    // 3. Drag to 75%
    window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: rect.left + rect.width * 0.75 }));
    const widthAt75 = fillEl ? fillEl.style.width : null;

    // 4. Mouse up at 75%
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: rect.left + rect.width * 0.75 }));

    return { widthAt50, widthAt75 };
  });
  console.log('Scrubber Drag Widths during drag:', dragTest);

  // === 3. Test Audio Progression Past 60 Seconds ===
  console.log('\n=== 3. Testing Audio Past 60 Seconds ===');
  await page.evaluate(async () => {
    await fetch('/api/audio/control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'seek', position: 65 }),
    });
  });
  await new Promise(r => setTimeout(r, 2000));

  const audio1 = await page.evaluate(async () => {
    const res = await fetch('/api/audio/status');
    return await res.json();
  });
  console.log('Status at 65s+:', { isPlaying: audio1.isPlaying, currentTime: audio1.currentTime });

  await new Promise(r => setTimeout(r, 2000));
  const audio2 = await page.evaluate(async () => {
    const res = await fetch('/api/audio/status');
    return await res.json();
  });
  console.log('Status 2s later (should have advanced):', { isPlaying: audio2.isPlaying, currentTime: audio2.currentTime });

  // === 4. Test Expand Button ("<") ===
  console.log('\n=== 4. Testing Expand Handle ("<") ===');
  // Close right sidebar if open
  await page.evaluate(() => {
    const closeBtn = document.querySelector('button[aria-label="Ocultar la vista Sonando"]');
    if (closeBtn) closeBtn.click();
  });
  await new Promise(r => setTimeout(r, 500));

  const hasExpand = await page.evaluate(() => {
    const btn = document.querySelector('button[aria-label="Mostrar la vista Sonando"]');
    return !!btn;
  });
  console.log('Expand handle ("<") present on main right edge:', hasExpand);

  // Click "<" to open right sidebar
  await page.evaluate(() => {
    const btn = document.querySelector('button[aria-label="Mostrar la vista Sonando"]');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 1200));

  // === 5. Inspect Right Sidebar Sections ===
  console.log('\n=== 5. Inspecting Right Sidebar Content ===');
  const sidebarData = await page.evaluate(() => {
    const aside = document.querySelector('aside#Desktop_PanelContainer_Id');
    if (!aside) return { error: 'No right sidebar open' };

    const collapseBtn = !!aside.querySelector('button[aria-label="Ocultar la vista Sonando"]');
    const headerTitle = aside.querySelector('div > span.font-bold')?.textContent;
    const trackTitle = aside.querySelector('h2')?.textContent;
    const hasLyrics = (aside.textContent || '').includes('Vista previa de la letra');
    const lyricsLines = Array.from(aside.querySelectorAll('p[class*="font-black text-"]')).map(p => p.textContent);
    const hasVideos = (aside.textContent || '').includes('Vídeos musicales relacionados');
    const hasArtist = (aside.textContent || '').includes('Información sobre el artista');
    const hasCredits = (aside.textContent || '').includes('Créditos');
    const hasQueue = (aside.textContent || '').includes('A continuación en la cola');

    return {
      collapseBtn,
      headerTitle,
      trackTitle,
      hasLyrics,
      lyricsLines,
      hasVideos,
      hasArtist,
      hasCredits,
      hasQueue,
    };
  });
  console.log('Right Sidebar Info:', JSON.stringify(sidebarData, null, 2));

  // Save screenshot of Right Sidebar
  await page.screenshot({ path: 'scripts/verified-right-sidebar-final.png' });
  console.log('Saved screenshot to scripts/verified-right-sidebar-final.png');

  // === 6. Test Collapse Button [>|] ===
  console.log('\n=== 6. Testing Collapse Button [>|] ===');
  await page.evaluate(() => {
    const closeBtn = document.querySelector('button[aria-label="Ocultar la vista Sonando"]');
    if (closeBtn) closeBtn.click();
  });
  await new Promise(r => setTimeout(r, 800));

  const afterCollapse = await page.evaluate(() => {
    const aside = document.querySelector('aside#Desktop_PanelContainer_Id');
    const expandBtn = document.querySelector('button[aria-label="Mostrar la vista Sonando"]');
    return {
      sidebarClosed: !aside,
      expandHandleVisible: !!expandBtn
    };
  });
  console.log('After collapse state:', afterCollapse);

  browser.disconnect();
}

verifyEverything().catch(console.error);
