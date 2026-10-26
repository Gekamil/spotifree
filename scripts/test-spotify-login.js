import puppeteer from 'puppeteer-core';

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const spotifreePage = pages.find((p) => p.url().includes('localhost:5173') || p.url().includes('127.0.0.1:5173'));

  if (spotifreePage) {
    await spotifreePage.bringToFront();
    console.log('Current page URL:', spotifreePage.url());

    // Click the "Conectar Spotify" button
    const loginClicked = await spotifreePage.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Conectar Spotify'));
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });

    console.log('Login button clicked:', loginClicked);
    await sleep(2500);
    console.log('Navigated to:', spotifreePage.url());
  }

  browser.disconnect();
}

run().catch(console.error);
