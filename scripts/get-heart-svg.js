import puppeteer from 'puppeteer-core';

async function run() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const sp = pages.find(p => p.url().includes('open.spotify.com'));
  if (sp) {
    const svgs = await sp.evaluate(() => {
      const allSvgs = Array.from(document.querySelectorAll('svg'));
      const heart = allSvgs.find(s => s.closest('a[href*="/collection/tracks"], div[data-testid*="liked"]') || s.innerHTML.includes('15.724') || s.innerHTML.includes('heart'));
      return heart ? heart.outerHTML : null;
    });
    console.log('Heart SVG:', svgs);
  }
  browser.disconnect();
}
run().catch(console.error);
