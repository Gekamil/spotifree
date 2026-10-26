import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('open.spotify.com'));
  if (!spotifyPage) {
    console.log('No spotify page found');
    browser.disconnect();
    return;
  }

  const libraryItems = await spotifyPage.evaluate(() => {
    // In Spotify web, left sidebar items are in nav or section
    const links = Array.from(document.querySelectorAll('a[href*="/playlist/"], a[href*="/collection/tracks"], a[href*="/artist/"], a[href*="/album/"]'));
    const items = [];
    for (const a of links) {
      // Find title, subtitle, image inside the card or row
      const title = a.querySelector('[data-encore-id="text"], p, span')?.textContent?.trim() || a.textContent?.trim();
      const img = a.querySelector('img')?.src;
      const href = a.getAttribute('href');
      items.push({ title, href, img });
    }
    return items;
  });

  console.log('Found Library Items in open Spotify page:', libraryItems.length);
  for (const item of libraryItems.slice(0, 15)) {
    console.log(item.title, '->', item.href);
  }

  browser.disconnect();
}

main().catch(console.error);
