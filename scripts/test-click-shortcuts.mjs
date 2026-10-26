import puppeteer from 'puppeteer-core';

async function testClickShortcuts() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const page = (await browser.pages()).find(p => p.url().includes('5173'));

  console.log('Finding and clicking "míticas" on home view...');
  await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('span, p, div'));
    const miticasCard = cards.find(el => el.innerText?.trim() === 'míticas');
    if (miticasCard) {
      console.log('Found card:', miticasCard.innerText);
      const clickable = miticasCard.closest('.cursor-pointer, [onClick]') || miticasCard;
      clickable.click();
    }
  });

  await new Promise(r => setTimeout(r, 2000));

  const pageState = await page.evaluate(() => {
    const h1 = document.querySelector('h1')?.innerText;
    const allText = document.querySelector('main')?.innerText;
    const trackTitles = Array.from(document.querySelectorAll('.font-medium, [data-track-row] span'))
      .map(el => el.innerText?.trim())
      .filter(t => t && t.length > 1 && !t.includes('\n'));
    return {
      h1,
      textSample: allText?.substring(0, 300),
      sampleTracks: trackTitles.slice(0, 10),
    };
  });

  console.log('After clicking míticas:', pageState);

  // Take a screenshot of the míticas view to verify
  await page.screenshot({ path: 'spotifree-miticas-verified.png' });
  console.log('Screenshot saved to spotifree-miticas-verified.png');

  browser.disconnect();
}

testClickShortcuts().catch(console.error);
