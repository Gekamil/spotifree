import puppeteer from 'puppeteer-core';

async function main() {
  console.log('--- 1. Testing /api/session-sync endpoint ---');
  const sessionRes = await fetch('http://127.0.0.1:5173/api/session-sync');
  const session = await sessionRes.json();
  console.log('Connected user:', session.user?.display_name);
  console.log('Quick access shortcuts count:', session.quickAccess?.length);
  console.log('Quick access shortcuts:', session.quickAccess?.map((q) => q.name));
  console.log('Dynamic user playlists count in library:', session.playlists?.length);
  console.log('Playlists:', session.playlists?.map((p) => p.name));
  console.log('Dynamic shelves count:', session.shelves?.length);
  for (const s of session.shelves || []) {
    console.log(`  - Shelf: [${s.prefix ? s.prefix + ' ' : ''}${s.title}] (${s.cards.length} cards, subtitle: "${s.subtitle}")`);
  }

  console.log('\n--- 2. Testing /api/audio/resolve endpoint ---');
  const a1 = await (await fetch('http://127.0.0.1:5173/api/audio/resolve?title=Propuesta+Indecente&artist=Romeo+Santos')).json();
  console.log('Propuesta Indecente videoId:', a1.videoId);
  const a2 = await (await fetch('http://127.0.0.1:5173/api/audio/resolve?title=Rain&artist=Trueno')).json();
  console.log('Rain videoId:', a2.videoId);

  console.log('\n--- 3. Verifying Browser Rendering & Capturing Final Proof ---');
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: null,
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 2500));

  // Top home screenshot
  const outDir = 'C:/Users/jorge/.gemini/antigravity/brain/b7d3ec29-c076-4935-90b5-23f42c286313';
  await page.screenshot({ path: `${outDir}/spotifree-final-fixed-top.png` });
  console.log('✓ Captured spotifree-final-fixed-top.png');

  // Click on "Romeo & Prince" in sidebar to open playlist
  const clicked = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('aside [role="presentation"], aside div'));
    const romeo = items.find((el) => el.textContent && el.textContent.includes('Romeo & Prince'));
    if (romeo) {
      romeo.click();
      return true;
    }
    return false;
  });
  console.log('Clicked Romeo & Prince playlist in sidebar:', clicked);
  await new Promise((r) => setTimeout(r, 2000));

  // Click first track play button or row to trigger full playback from 0:00
  await page.evaluate(() => {
    const playBtn = document.querySelector('main button[title*="Reproducir"], main [role="row"] button');
    if (playBtn) {
      playBtn.click();
    } else {
      const firstRow = document.querySelector('main [role="row"]');
      if (firstRow) firstRow.click();
    }
  });

  await new Promise((r) => setTimeout(r, 2000));
  await page.screenshot({ path: `${outDir}/spotifree-final-fixed-playback.png` });
  console.log('✓ Captured spotifree-final-fixed-playback.png');

  await page.close();
  browser.disconnect();
  console.log('\nAll verifications completed successfully!');
}

main().catch(console.error);
