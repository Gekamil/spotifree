import puppeteer from 'puppeteer-core';

async function checkYTCookies() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  console.log('Open pages:', pages.map(p => p.url()));
  
  // Check cookies on browser context
  const targets = await browser.targets();
  console.log('Targets count:', targets.length);
  
  browser.disconnect();
}

checkYTCookies().catch(console.error);
