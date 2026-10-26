import puppeteer from 'puppeteer-core';

async function run() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const sp = pages.find(p => p.url().includes('open.spotify.com'));
  
  if (sp) {
    await sp.setViewport({ width: 1440, height: 900 });
    await sp.evaluate(() => {
      // Find the first button in the top left under the header
      const btn = document.querySelector('header button, [data-testid="your-library"] button, button[aria-label*="Tu biblioteca"], button[aria-label*="biblioteca"]');
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 1000));
    await sp.screenshot({ path: 'C:\\Users\\jorge\\.gemini\\antigravity\\brain\\b7d3ec29-c076-4935-90b5-23f42c286313\\spotify-debug-expanded.png' });
    console.log('Saved spotify-debug-expanded.png');
  }
  browser.disconnect();
}
run().catch(console.error);
