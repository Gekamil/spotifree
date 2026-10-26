import puppeteer from 'puppeteer-core';

async function run() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const sp = pages.find(p => p.url().includes('open.spotify.com'));
  if (sp) {
    // Search or look for Rain Trueno cover on page
    const rainImg = await sp.evaluate(() => {
      const allImgs = Array.from(document.querySelectorAll('img'));
      const rain = allImgs.find(img => img.alt?.includes('Rain') || img.closest('[aria-label*="Rain"]'));
      return rain ? rain.src : null;
    });
    console.log('Rain Image:', rainImg);
  }
  browser.disconnect();
}
run().catch(console.error);
