import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const appPage = pages[0];

  console.log('Waiting for sidebar playlists to load...');
  await appPage.waitForSelector('aside p.text-\\[16px\\]', { timeout: 10000 });

  const playlists = await appPage.evaluate(() => {
    return Array.from(document.querySelectorAll('aside p.text-\\[16px\\]')).map(p => p.innerText);
  });
  console.log('Sidebar Playlists:', playlists);

  // Click on playlist "Canciones que te gustan" or "Romeo & Prince"
  console.log('Clicking target playlist...');
  await appPage.evaluate(() => {
    const p = Array.from(document.querySelectorAll('aside p.text-\\[16px\\]'))
      .find(el => el.innerText.includes('Canciones') || el.innerText.includes('Romeo'));
    if (p) {
      const row = p.closest('div[class*="cursor-pointer"]');
      if (row) row.click();
    }
  });
  await new Promise(r => setTimeout(r, 1500));

  // Wait for track rows
  console.log('Waiting for track rows in playlist view...');
  await appPage.waitForSelector('div[class*="grid-cols-[20px"]:not(.border-b)', { timeout: 5000 });

  // Click track 1
  console.log('Clicking track 1...');
  await appPage.evaluate(() => {
    const row = document.querySelector('div[class*="grid-cols-[20px"]:not(.border-b)');
    if (row) row.click();
  });
  await new Promise(r => setTimeout(r, 2000));

  // Check footer player
  const player = await appPage.evaluate(() => {
    const trackName = document.querySelector('footer span.text-white')?.innerText;
    const scrubber = !!document.querySelector('footer div[class*="group relative flex-1 h-3"]');
    return { trackName, scrubber };
  });
  console.log('Player after track click:', player);

  browser.disconnect();
}

main().catch(console.error);
