import puppeteer from 'puppeteer-core';

async function getFilledExploreIcon() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const sp = pages.find(p => p.url().includes('open.spotify.com'));
  if (!sp) {
    browser.disconnect();
    return;
  }

  // Click on the explore button
  const filledIcon = await sp.evaluate(async () => {
    const exploreBtn = Array.from(document.querySelectorAll('button, a')).find(b => b.getAttribute('aria-label') === 'Explorar');
    if (!exploreBtn) return { error: 'No explore button' };

    exploreBtn.click();
    await new Promise(r => setTimeout(r, 600));

    // Now inspect the explore button svg
    const svg = exploreBtn.querySelector('svg');
    return {
      viewBox: svg?.getAttribute('viewBox'),
      html: svg?.outerHTML
    };
  });

  console.log('Filled explore icon after click:', JSON.stringify(filledIcon, null, 2));
  browser.disconnect();
}

getFilledExploreIcon().catch(console.error);
