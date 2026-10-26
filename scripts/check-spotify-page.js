import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('open.spotify.com'));
  if (spotifyPage) {
    const info = await spotifyPage.evaluate(() => {
      const userBtn = document.querySelector('[data-testid="user-widget-link"]') || document.querySelector('[data-testid="username-first-letter"]');
      const profile = userBtn ? (userBtn.getAttribute('aria-label') || userBtn.textContent) : 'no user widget';
      return {
        title: document.title,
        url: window.location.href,
        profile,
      };
    });
    console.log('Spotify page info:', info);
  }
  browser.disconnect();
}

main().catch(console.error);
