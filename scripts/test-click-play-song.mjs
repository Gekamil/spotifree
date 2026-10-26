import puppeteer from 'puppeteer-core';

async function testClickPlay() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const page = (await browser.pages())[0];
  await page.bringToFront();
  await new Promise((r) => setTimeout(r, 1000));

  console.log('Finding track rows in Spotifree...');
  const clicked = await page.evaluate(() => {
    // Look for track rows in main view
    const rows = document.querySelectorAll('[role="row"], button[aria-label*="Reproducir"], [data-testid="track-row"]');
    for (const r of rows) {
      const title = r.querySelector('[class*="font-semibold"], [class*="text-white"], [class*="title"]')?.textContent?.trim();
      if (title && (title.includes('Hecha') || title.includes('All Night') || title.includes('Propuesta') || title.includes('Mamichula') || title.includes('Inmortal'))) {
        r.scrollIntoView({ behavior: 'smooth', block: 'center' });
        r.click();
        return { clickedTitle: title };
      }
    }
    // If not found, click play button in player or first row
    const firstRow = document.querySelector('[role="row"]');
    if (firstRow) {
      firstRow.click();
      return { clickedTitle: 'first-row' };
    }
    return { clickedTitle: null };
  });
  console.log('Click result:', clicked);

  // Monitor for 12 seconds
  for (let i = 0; i < 4; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const st = await page.evaluate(async () => {
      const res = await fetch('/api/audio/status');
      const data = await res.json();
      const store = window.__usePlayerStore?.getState ? window.__usePlayerStore.getState() : null;
      return {
        track: store?.currentTrack?.name,
        artist: store?.currentTrack?.artists?.[0]?.name,
        uiProgressMs: Math.round(store?.progressMs || 0),
        apiCurrentTime: Math.round(data?.currentTime || 0),
        apiDuration: Math.round(data?.duration || 0),
        apiIsAd: data?.isAd,
        apiIsPlaying: data?.isPlaying,
      };
    });
    console.log(`t=${(i + 1) * 3}s:`, st);
  }

  // Take screenshot
  const screenshotPath = 'C:\\Users\\jorge\\.gemini\\antigravity\\brain\\b7d3ec29-c076-4935-90b5-23f42c286313\\spotifree-final-click-verified.png';
  await page.screenshot({ path: screenshotPath });
  console.log('Screenshot saved to:', screenshotPath);
}

testClickPlay().catch(console.error);
