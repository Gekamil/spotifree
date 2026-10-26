import puppeteer from 'puppeteer-core';

async function probe() {
  try {
    const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
    console.log('Connected to Chrome!');
    const pages = await browser.pages();
    console.log(`Found ${pages.length} pages:`);
    for (let i = 0; i < pages.length; i++) {
      console.log(`Page ${i}: ${pages[i].url()} (title: ${await pages[i].title()})`);
    }
    browser.disconnect();
  } catch (err) {
    console.error('Error connecting to Chrome:', err);
  }
}

probe();
