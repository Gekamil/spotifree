import puppeteer from 'puppeteer-core';

async function run() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const sp = pages.find(p => p.url().includes('open.spotify.com'));
  
  if (sp) {
    await sp.setViewport({ width: 1440, height: 900 });
    await sp.evaluate(() => {
      // 1. Expand library: click the 3 books icon button on top left
      const collapseBtn = document.querySelector('button[aria-label*="biblioteca"], button[title*="biblioteca"]');
      if (collapseBtn) collapseBtn.click();

      // 2. Close right sidebar: look for close button or toggle button
      const closeButtons = Array.from(document.querySelectorAll('button[aria-label*="Cerrar"], button[aria-label*="Contraer"], button[title*="Cerrar"]'));
      closeButtons.forEach(b => b.click());
    });

    await new Promise(r => setTimeout(r, 1000));
    await sp.screenshot({ path: 'C:\\Users\\jorge\\.gemini\\antigravity\\brain\\b7d3ec29-c076-4935-90b5-23f42c286313\\spotify-reset-1440.png' });
    console.log('Saved spotify-reset-1440.png');
  }
  browser.disconnect();
}
run().catch(console.error);
