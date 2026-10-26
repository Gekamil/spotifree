import puppeteer from 'puppeteer-core';

async function extractExploreIcon() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const sp = pages.find(p => p.url().includes('open.spotify.com'));
  if (!sp) {
    console.log('No Spotify tab');
    browser.disconnect();
    return;
  }

  const iconData = await sp.evaluate(async () => {
    // Find the browse / search button in the top bar
    const exploreBtn = document.querySelector('button[aria-label*="Explorar"], a[aria-label*="Explorar"], [data-testid="search-input"] ~ button, header button:has(svg)');
    
    // Find all svgs in header
    const headerSvgs = Array.from(document.querySelectorAll('header svg, [data-testid="top-bar"] svg, form svg')).map(svg => ({
      viewBox: svg.getAttribute('viewBox'),
      html: svg.outerHTML,
      ariaLabel: svg.closest('button')?.getAttribute('aria-label') || svg.getAttribute('aria-label')
    }));

    return {
      headerSvgs
    };
  });

  console.log('Explore icon in Spotify:', JSON.stringify(iconData, null, 2));
  browser.disconnect();
}

extractExploreIcon().catch(console.error);
