import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('open.spotify.com'));
  if (!spotifyPage) {
    browser.disconnect();
    return;
  }

  const result = await spotifyPage.evaluate(() => {
    // Find the library pane
    const libraryPane = document.querySelector('[aria-label="Tu biblioteca"], [data-testid="rootlist-container"], [data-testid="your-library"]');
    const container = libraryPane || document.querySelector('nav');
    if (!container) return { error: 'No library container' };

    const items = [];
    const elements = container.querySelectorAll('li, [role="listitem"], a[href*="/playlist/"], a[href*="/collection/tracks"]');
    for (const el of elements) {
      const link = el.tagName === 'A' ? el : el.querySelector('a');
      if (!link) continue;
      const href = link.getAttribute('href');
      const text = el.textContent?.trim();
      const img = el.querySelector('img')?.src;
      items.push({ text: text?.replace(/\s+/g, ' ').substring(0, 80), href, img });
    }
    return { count: items.length, items: items.slice(0, 20) };
  });

  console.log('Library pane scan:', result);
  browser.disconnect();
}

main().catch(console.error);
