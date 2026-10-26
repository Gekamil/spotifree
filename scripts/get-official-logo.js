import puppeteer from 'puppeteer-core';

async function run() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const sp = pages.find(p => p.url().includes('open.spotify.com'));
  if (sp) {
    const logoSvg = await sp.evaluate(() => {
      // Find the logo SVG in the top-left or header
      const logo = document.querySelector('header a[href="/"] svg, header [aria-label*="Spotify"] svg, [data-testid="home-button"] svg, a[aria-label="Spotify"] svg');
      return logo ? logo.outerHTML : null;
    });
    console.log('Official Spotify Logo SVG:', logoSvg);
  }
  browser.disconnect();
}
run().catch(console.error);
