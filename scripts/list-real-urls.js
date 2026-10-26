import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('open.spotify.com'));
  if (spotifyPage) {
    const links = await spotifyPage.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a[href*="/playlist/"]'));
      return anchors.map(a => ({
        href: a.href,
        text: a.textContent.trim()
      })).filter(x => x.text.length > 0);
    });
    console.log('Real Spotify Playlists and their URLs:');
    for (const l of links) {
      console.log(`${l.text} -> ${l.href}`);
    }
  }
  browser.disconnect();
}

main().catch(console.error);
