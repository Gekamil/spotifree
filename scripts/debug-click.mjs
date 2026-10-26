import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const appPage = pages.find(p => p.url().includes('5173'));

  const cards = await appPage.evaluate(() => {
    const list = Array.from(document.querySelectorAll('div[class*="group h-[56px]"]'));
    return list.map(c => c.innerText);
  });
  console.log('Home quick cards:', cards);

  const clicked = await appPage.evaluate(() => {
    const card = document.querySelector('div[class*="group h-[56px]"]');
    if (card) {
      card.click();
      return true;
    }
    return false;
  });
  console.log('Clicked card:', clicked);

  await new Promise(r => setTimeout(r, 1500));

  const plView = await appPage.evaluate(() => {
    const h1 = document.querySelector('h1')?.innerText;
    const rows = document.querySelectorAll('div[class*="grid-cols-[20px"]:not(.border-b)').length;
    return { h1, rows };
  });
  console.log('Playlist view after click:', plView);

  // Click row 0
  const rowClicked = await appPage.evaluate(() => {
    const row = document.querySelector('div[class*="grid-cols-[20px"]:not(.border-b)');
    if (row) {
      row.click();
      return true;
    }
    return false;
  });
  console.log('Row clicked:', rowClicked);

  await new Promise(r => setTimeout(r, 1500));

  const playerState = await appPage.evaluate(() => {
    const trackName = document.querySelector('footer span.text-white')?.innerText;
    const progressBar = !!document.querySelector('footer div[class*="group relative flex-1 h-3"]');
    return { trackName, progressBar };
  });
  console.log('Player state after row click:', playerState);

  browser.disconnect();
}

main().catch(console.error);
