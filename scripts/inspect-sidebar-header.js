import puppeteer from 'puppeteer-core';

async function inspectSidebarHeader() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const sp = pages.find(p => p.url().includes('open.spotify.com'));
  if (!sp) {
    browser.disconnect();
    return;
  }

  const headerInfo = await sp.evaluate(() => {
    // Find the button with text "Tu biblioteca"
    const libBtn = Array.from(document.querySelectorAll('header button, [data-testid="your-library"] button, button')).find(b => b.innerText.includes('Tu biblioteca'));
    if (!libBtn) return { error: 'Not found' };

    return {
      text: libBtn.innerText,
      ariaLabel: libBtn.getAttribute('aria-label'),
      title: libBtn.getAttribute('title'),
      html: libBtn.outerHTML,
      svg: libBtn.querySelector('svg')?.outerHTML
    };
  });

  console.log('Sidebar header button in real Spotify:', headerInfo);
  browser.disconnect();
}

inspectSidebarHeader().catch(console.error);
