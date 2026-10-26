import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('spotify.com'));

  const libraryHeader = await spotifyPage.evaluate(() => {
    const btn = document.querySelector('button[aria-label*="Contraer Tu biblioteca"]');
    if (!btn) return 'not found';
    const header = btn.closest('header') || btn.parentElement;
    
    // Find all style rules applying to btn or its children
    const styles = window.getComputedStyle(btn);
    const span = btn.querySelector('span');
    const spanStyles = span ? window.getComputedStyle(span) : null;
    
    // Check siblings or tooltips
    const siblings = Array.from(header.children).map(c => ({
      tag: c.tagName,
      className: c.className,
      ariaLabel: c.getAttribute('aria-label'),
      text: c.innerText
    }));

    return {
      headerHtml: header.outerHTML,
      btnHtml: btn.outerHTML,
      btnOpacity: styles.opacity,
      btnDisplay: styles.display,
      spanWidth: spanStyles?.width,
      spanOpacity: spanStyles?.opacity,
      siblings
    };
  });

  console.log('Library Header Details:', JSON.stringify(libraryHeader, null, 2));
  browser.disconnect();
}

main().catch(console.error);
