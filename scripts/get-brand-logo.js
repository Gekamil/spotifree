import puppeteer from 'puppeteer-core';

async function run() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const sp = pages.find(p => p.url().includes('open.spotify.com'));
  if (sp) {
    const svgs = await sp.evaluate(() => {
      // Find all svgs and look for Spotify circle logo
      const allSvgs = Array.from(document.querySelectorAll('svg'));
      const spotifyLogo = allSvgs.find(s => s.closest('a[aria-label*="Spotify"], button[title*="Spotify"]') || s.innerHTML.includes('12 0C5.4') || s.innerHTML.includes('12 2C6.48'));
      if (spotifyLogo) return spotifyLogo.outerHTML;
      // Also look for svg in the very top-left element
      const firstSvg = document.querySelector('header svg, div:first-child > svg');
      return firstSvg ? firstSvg.outerHTML : null;
    });
    console.log('Official Spotify Logo SVG:', svgs);
  }
  browser.disconnect();
}
run().catch(console.error);
