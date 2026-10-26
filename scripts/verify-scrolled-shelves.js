import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const spotifreePage = pages.find(p => p.url().includes('5173'));

  if (spotifreePage) {
    await spotifreePage.reload({ waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1200));

    await spotifreePage.evaluate(() => {
      const scrollable = document.querySelector('main > div:first-child');
      if (scrollable) {
        scrollable.scrollTop = 520;
      }
    });
    await new Promise(r => setTimeout(r, 1500));

    const artifactDir = 'C:/Users/jorge/.gemini/antigravity/brain/b7d3ec29-c076-4935-90b5-23f42c286313';
    await spotifreePage.screenshot({
      path: `${artifactDir}/spotifree-live-scrolled-shelves.png`,
      fullPage: false
    });
    console.log('Scrolled screenshot captured');

    // Scroll back to top
    await spotifreePage.evaluate(() => {
      const scrollable = document.querySelector('main > div:first-child');
      if (scrollable) {
        scrollable.scrollTop = 0;
      }
    });
  }
  browser.disconnect();
}

main().catch(console.error);
