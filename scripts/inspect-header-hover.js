import puppeteer from 'puppeteer-core';

async function inspectHeaderHover() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const sp = pages.find(p => p.url().includes('open.spotify.com'));
  if (!sp) {
    browser.disconnect();
    return;
  }

  const buttons = await sp.evaluate(() => {
    const header = document.querySelector('header, [data-testid="your-library"]');
    if (!header) return null;
    const allBtns = Array.from(header.querySelectorAll('button')).map(b => ({
      text: b.innerText,
      ariaLabel: b.getAttribute('aria-label'),
      className: b.className,
      opacity: window.getComputedStyle(b).opacity,
      visibility: window.getComputedStyle(b).visibility
    }));
    return allBtns;
  });

  console.log('Header buttons styles:', buttons);
  browser.disconnect();
}

inspectHeaderHover().catch(console.error);
