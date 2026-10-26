import puppeteer from 'puppeteer-core';

async function testScrubberAndAudio() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const page = (await browser.pages())[0];

  console.log('1. Navigating into Canciones que te gustan...');
  await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('aside p.text-\\[16px\\]'));
    const target = items.find(p => (p.textContent || '').includes('Canciones'));
    if (target) {
      const row = target.closest('div[class*="cursor-pointer"]');
      if (row) row.click();
    }
  });

  // Wait for playlist track row
  await page.waitForFunction(
    () => document.querySelectorAll('div[class*="grid-cols-[20px"]:not(.border-b)').length > 0,
    { timeout: 5000 }
  );

  console.log('2. Clicking track 1...');
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
  console.log('Currently playing in footer:', trackInfo);

  console.log('3. Testing real-time scrubber dragging...');
  const dragResult = await page.evaluate(() => {
    const bar = document.querySelector('footer div[class*="group relative flex-1 h-3"]');
    if (!bar) return { error: 'No scrubber' };
    const rect = bar.getBoundingClientRect();
    const fillEl = bar.querySelector('div > div');

    // Mousedown at 25%
    bar.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: rect.left + rect.width * 0.25 }));
    const wInit = fillEl ? fillEl.style.width : null;

    // Mousemove to 50%
    window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: rect.left + rect.width * 0.50 }));
    const w50 = fillEl ? fillEl.style.width : null;

    // Mousemove to 75%
    window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: rect.left + rect.width * 0.75 }));
    const w75 = fillEl ? fillEl.style.width : null;

    // Mouseup
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: rect.left + rect.width * 0.75 }));

    return { wInit, w50, w75 };
  });
  console.log('Scrubber widths during drag:', dragResult);

  console.log('4. Testing audio past minute 1 (seek to 65s)...');
  await page.evaluate(async () => {
    await fetch('/api/audio/control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'seek', position: 65 }),
    });
  });

  await new Promise(r => setTimeout(r, 2000));
  const status1 = await page.evaluate(async () => {
    const res = await fetch('/api/audio/status');
    return await res.json();
  });
  console.log('Status at 65s:', { isPlaying: status1.isPlaying, currentTime: status1.currentTime });

  await new Promise(r => setTimeout(r, 2500));
  const status2 = await page.evaluate(async () => {
    const res = await fetch('/api/audio/status');
    return await res.json();
  });
  console.log('Status 2.5s later:', { isPlaying: status2.isPlaying, currentTime: status2.currentTime });

  console.log('5. Opening Right Sidebar via < button...');
  await page.evaluate(() => {
    const btn = document.querySelector('button[aria-label="Mostrar la vista Sonando"]');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 1000));

  await page.screenshot({ path: 'scripts/final-verified-right-sidebar.png' });
  await page.screenshot({ path: 'C:\\Users\\jorge\\.gemini\\antigravity\\brain\\b7d3ec29-c076-4935-90b5-23f42c286313\\final-verified-right-sidebar.png' });
  console.log('Saved screenshot to scripts and artifacts directory!');
}

testScrubberAndAudio().catch(console.error);
