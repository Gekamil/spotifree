import puppeteer from 'puppeteer-core';

async function run() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const sp = pages.find(p => p.url().includes('open.spotify.com'));
  if (sp) {
    await sp.evaluate(() => {
      // Find all buttons in footer
      const footerBtns = Array.from(document.querySelectorAll('footer button'));
      // The now playing button has an SVG with square or is usually the first button on the right
      const npvBtn = footerBtns.find(b => b.getAttribute('aria-label')?.includes('reproducción actual') || b.getAttribute('data-testid')?.includes('npv'));
      if (npvBtn) npvBtn.click();
      else {
        // Find close button in right panel
        const closeBtn = document.querySelector('aside button[aria-label*="Cerrar"], aside button[aria-label*="Contraer"]');
        if (closeBtn) closeBtn.click();
      }
    });

    await new Promise(r => setTimeout(r, 1000));
    await sp.screenshot({ path: 'C:\\Users\\jorge\\.gemini\\antigravity\\brain\\b7d3ec29-c076-4935-90b5-23f42c286313\\spotify-full-1440-perfect.png' });
    console.log('Saved spotify-full-1440-perfect.png');
  }
  browser.disconnect();
}
run().catch(console.error);
