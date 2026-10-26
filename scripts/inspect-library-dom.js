import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('open.spotify.com'));

  const libraryInspection = await spotifyPage.evaluate(() => {
    // Find "Tu biblioteca" heading or button
    const libBtn = Array.from(document.querySelectorAll('*')).find(
      el => el.textContent === 'Tu biblioteca' && (el.tagName === 'BUTTON' || el.tagName === 'H1' || el.tagName === 'SPAN')
    );
    if (!libBtn) return 'No Tu biblioteca button found';

    // The container for the entire sidebar
    const container = libBtn.closest('nav') || libBtn.closest('aside') || libBtn.closest('.Root__nav-bar') || libBtn.parentElement?.parentElement?.parentElement?.parentElement;
    
    // Find all links inside this sidebar container
    const links = Array.from(container ? container.querySelectorAll('a') : []).map(a => {
      const parentRow = a.closest('li') || a.parentElement;
      const text = parentRow ? parentRow.innerText : a.innerText;
      const img = parentRow ? parentRow.querySelector('img')?.src : a.querySelector('img')?.src;
      const isPinned = !!(parentRow && parentRow.querySelector('svg[aria-label*="fijad"], svg[data-encore-id*="pin"], svg[aria-label*="Pin"]'));
      return {
        href: a.href,
        text: text ? text.split('\n').filter(Boolean) : [],
        img,
        isPinned
      };
    });

    return {
      containerTag: container?.tagName,
      containerClass: container?.className,
      linksCount: links.length,
      links: links.slice(0, 25)
    };
  });

  console.log('Sidebar Details:', JSON.stringify(libraryInspection, null, 2));
  browser.disconnect();
}

main().catch(console.error);
