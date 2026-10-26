import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('open.spotify.com'));
  if (spotifyPage) {
    await spotifyPage.goto('https://open.spotify.com/collection/playlists');
    await new Promise(r => setTimeout(r, 3000));
    const playlists = await spotifyPage.evaluate(() => {
      const items = Array.from(document.querySelectorAll('a[href*="/playlist/"]')).map(a => ({
        title: a.querySelector('span, div, p')?.textContent?.trim() || a.textContent.trim(),
        href: a.href,
        img: a.querySelector('img')?.src
      }));
      return items;
    });
    console.log('Collection playlists:', playlists);
  }
  browser.disconnect();
}

main().catch(console.error);
