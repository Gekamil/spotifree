import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('spotify.com'));

  const details = await spotifyPage.evaluate(() => {
    // 1. Home button SVG and styles
    const homeBtn = document.querySelector('button[aria-label="Inicio"], a[aria-label="Inicio"], [data-testid="home-button"], button[aria-label*="Inicio"]') ||
                    document.querySelector('ul li a[href="/"]');
    let homeData = null;
    if (homeBtn) {
      const svg = homeBtn.querySelector('svg');
      homeData = {
        html: homeBtn.outerHTML,
        svgHtml: svg ? svg.outerHTML : null,
        classes: homeBtn.className,
      };
    } else {
      // Look for any link or button with home icon
      const allSvgs = Array.from(document.querySelectorAll('svg'));
      const homeSvg = allSvgs.find(s => s.getAttribute('data-encore-id')?.toLowerCase().includes('home') || s.getAttribute('aria-label')?.toLowerCase().includes('inicio'));
      if (homeSvg) {
        homeData = {
          svgHtml: homeSvg.outerHTML,
          parentHtml: homeSvg.parentElement?.outerHTML?.slice(0, 300)
        };
      }
    }

    // 2. Library header and collapse button
    const collapseBtn = document.querySelector('button[aria-label*="Contraer"], button[aria-label*="Tu biblioteca"], [data-testid="your-library-button"]');
    let collapseData = null;
    if (collapseBtn) {
      const parent = collapseBtn.parentElement;
      const computed = window.getComputedStyle(collapseBtn);
      collapseData = {
        html: collapseBtn.outerHTML,
        svg: collapseBtn.querySelector('svg')?.outerHTML,
        opacity: computed.opacity,
        visibility: computed.visibility,
        transition: computed.transition,
        parentHtml: parent ? parent.outerHTML.slice(0, 400) : null
      };
    }

    // 3. Right side player controls (bottom right)
    const playerRight = document.querySelector('[data-testid="now-playing-bar-right-controls"], .now-playing-bar__right, footer [data-testid="now-playing-bar"] > div:last-child');
    let playerRightButtons = [];
    if (playerRight) {
      playerRightButtons = Array.from(playerRight.querySelectorAll('button')).map(b => ({
        label: b.getAttribute('aria-label') || b.getAttribute('data-testid') || b.innerText,
        title: b.title,
        svgId: b.querySelector('svg')?.getAttribute('data-encore-id') || b.querySelector('svg')?.getAttribute('role'),
        svg: b.querySelector('svg')?.outerHTML?.slice(0, 250),
      }));
    } else {
      // Find all buttons in footer
      const footerButtons = Array.from(document.querySelectorAll('footer button')).map(b => ({
        label: b.getAttribute('aria-label') || b.getAttribute('data-testid'),
        svg: b.querySelector('svg')?.outerHTML?.slice(0, 200)
      }));
      playerRightButtons = footerButtons;
    }

    // 4. Search bar & Explore icon in top header
    const searchHeader = document.querySelector('[data-testid="search-bar"]')?.closest('header') ||
                         document.querySelector('header');
    
    return {
      homeData,
      collapseData,
      playerRightButtons,
      headerHtml: searchHeader ? searchHeader.outerHTML.slice(0, 500) : null
    };
  });

  console.log('Spotify Detailed inspection:', JSON.stringify(details, null, 2));
  browser.disconnect();
}

main().catch(console.error);
