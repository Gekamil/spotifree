import puppeteer from 'puppeteer-core';

async function checkTab() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const sp = pages.find(p => p.url().includes('open.spotify.com'));
  if (sp) {
    const info = await sp.evaluate(() => ({
      title: document.title,
      url: window.location.href,
      userWidget: document.querySelector('button[data-testid="user-widget-link"]')?.innerText || 'No widget'
    }));
    console.log('Spotify tab state:', info);
  }
  browser.disconnect();
}

checkTab().catch(console.error);
