import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const spPage = pages.find(p => p.url().includes('open.spotify.com'));
  
  if (!spPage) {
    console.log('No Spotify page found');
    browser.disconnect();
    return;
  }

  const info = await spPage.evaluate(() => {
    return {
      title: document.title,
      url: window.location.href,
      bodyClasses: document.body.className,
      hasSession: !!document.querySelector('[data-testid="user-widget-link"]'),
      userText: document.querySelector('[data-testid="user-widget-link"]')?.textContent || '',
      sidebarPlaylists: Array.from(document.querySelectorAll('ul[tabindex="0"] li, [data-testid="rootlist"] li, nav li')).map(li => li.textContent?.trim()).filter(Boolean).slice(0, 10),
      buttons: Array.from(document.querySelectorAll('button')).map(b => b.textContent?.trim()).filter(Boolean).slice(0, 15)
    };
  });

  console.log('Spotify Info:', JSON.stringify(info, null, 2));
  browser.disconnect();
}

main().catch(console.error);
