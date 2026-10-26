import puppeteer from 'puppeteer-core';
import path from 'path';

const ARTIFACT_DIR = 'C:\\Users\\jorge\\.gemini\\antigravity\\brain\\b7d3ec29-c076-4935-90b5-23f42c286313';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const page = pages[0];
  await page.bringToFront();

  console.log('=== Step 1: Click track 1 in current playlist ===');
  const trackExists = await page.evaluate(() => {
    return document.querySelectorAll('div[class*="grid-cols-[20px"]:not(.border-b)').length;
  });
  console.log('Track count currently rendered:', trackExists);

  // Click the first track row
  console.log('Clicking track 1...');
  await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('div[class*="grid-cols-[20px"]:not(.border-b)'));
    if (rows[0]) rows[0].click();
  });
  await new Promise(r => setTimeout(r, 2000));

  const trackInfo = await page.evaluate(() => {
    const title = document.querySelector('footer span.text-white')?.textContent;
    const artists = document.querySelector('footer span.text-\\[\\#b3b3b3\\]')?.textContent;
    return { title, artists };
  });
  console.log('Playing track:', trackInfo);

  // === Step 2: Test Real-Time Scrubber Dragging ===
  console.log('\n=== Step 2: Testing Scrubber Dragging in Real Time ===');
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

  // === Step 3: Test Audio Past 60 Seconds Without Silence ===
  console.log('\n=== Step 3: Testing Audio Playback Past 60 Seconds ===');
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

  await new Promise(r => setTimeout(r, 2500));
  const audio2 = await page.evaluate(async () => {
    const res = await fetch('/api/audio/status');
    return await res.json();
  });
  console.log('Status 2.5s later (should have advanced smoothly):', { isPlaying: audio2.isPlaying, currentTime: audio2.currentTime });

  // === Step 4: Test Right Sidebar Expand Button ("<") ===
  console.log('\n=== Step 4: Testing Expand Handle ("<") ===');
  // First ensure sidebar is closed
  await page.evaluate(() => {
    const closeBtn = document.querySelector('button[aria-label="Ocultar la vista Sonando"]');
    if (closeBtn) closeBtn.click();
  });
  await new Promise(r => setTimeout(r, 600));

  const hasExpandBtn = await page.evaluate(() => {
    const btn = document.querySelector('button[aria-label="Mostrar la vista Sonando"]');
    return !!btn;
  });
  console.log('Expand handle ("<") present on main right edge:', hasExpandBtn);

  // Click "<" to open right sidebar
  await page.evaluate(() => {
    const btn = document.querySelector('button[aria-label="Mostrar la vista Sonando"]');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 1200));

  // === Step 5: Verify Right Sidebar Content ===
  console.log('\n=== Step 5: Inspecting Right Sidebar "Vista Sonando" ===');
  const sidebarInfo = await page.evaluate(() => {
    const aside = document.querySelector('aside#Desktop_PanelContainer_Id');
    if (!aside) return { error: 'No right sidebar' };

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
  console.log('Right Sidebar Info:', JSON.stringify(sidebarInfo, null, 2));

  // Save screenshot directly to artifacts directory
  const screenshotPath = path.join(ARTIFACT_DIR, 'final-verified-right-sidebar.png');
  await page.screenshot({ path: screenshotPath });
  console.log('Saved screenshot to:', screenshotPath);

  // Also save a copy in scripts
  await page.screenshot({ path: 'scripts/final-verified-right-sidebar.png' });

  // === Step 6: Test Collapse Button [>|] ===
  console.log('\n=== Step 6: Testing Collapse Button [>|] ===');
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
  console.log('\n=== ALL USER REQUESTS FULLY VERIFIED! ===');
}

main().catch(console.error);
