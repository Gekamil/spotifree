import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('open.spotify.com'));
  if (spotifyPage) {
    const text = await spotifyPage.evaluate(() => {
      const ylx = document.querySelector('.YourLibraryX');
      return ylx ? ylx.innerText : 'No ylx';
    });
    console.log('YLX text:\n', text);
  }
  browser.disconnect();
}

main().catch(console.error);
