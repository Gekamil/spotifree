import puppeteer from 'puppeteer-core';

async function run() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const page = pages[0];
  await page.bringToFront();
  await page.screenshot({ path: 'scripts/current-spotifree.png' });
  const info = await page.evaluate(() => {
    return {
      title: document.title,
      currentTrack: document.querySelector('footer span.text-white')?.textContent,
      asides: Array.from(document.querySelectorAll('aside')).map(a => a.className),
      url: window.location.href,
      mainText: document.querySelector('main')?.textContent?.slice(0, 200)
    };
  });
  console.log(JSON.stringify(info, null, 2));
}

run().catch(console.error);
