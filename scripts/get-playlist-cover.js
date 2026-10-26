import puppeteer from 'puppeteer-core';

async function getPlaylistCover() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const sp = pages.find(p => p.url().includes('open.spotify.com'));
  if (!sp) {
    browser.disconnect();
    return;
  }

  const coverUrl = await sp.evaluate(() => {
    const img = document.querySelector('img[data-testid="playlist-image"], [data-testid="entity-image"] img, section img');
    return img?.src;
  });

  console.log('J+L(2026) cover URL:', coverUrl);
  browser.disconnect();
}

getPlaylistCover().catch(console.error);
