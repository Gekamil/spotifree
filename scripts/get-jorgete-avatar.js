import puppeteer from 'puppeteer-core';

async function getJorgeteAvatar() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const sp = pages.find(p => p.url().includes('open.spotify.com'));
  if (!sp) {
    browser.disconnect();
    return;
  }

  const avatar = await sp.evaluate(() => {
    const profileImg = document.querySelector('button[data-testid="user-widget-link"] img, img[alt*="Jorge"], img[alt*="Jorgete"]');
    return profileImg?.src;
  });

  console.log('Jorgete avatar:', avatar);
  browser.disconnect();
}

getJorgeteAvatar().catch(console.error);
