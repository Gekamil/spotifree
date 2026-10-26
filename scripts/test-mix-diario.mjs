import puppeteer from 'puppeteer-core';

async function testMixDiario() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const page = (await browser.pages()).find(p => p.url().includes('5173'));

  console.log('Navigating / selecting Mix diario 1...');
  await page.evaluate(() => {
    // Select via handleSelectPlaylistById on window or finding card
    const allDivs = Array.from(document.querySelectorAll('div, span, p'));
    const mixCard = allDivs.find(d => d.innerText?.trim()?.toLowerCase() === 'mix diario 1');
    if (mixCard) {
      (mixCard.closest('.cursor-pointer') || mixCard).click();
    }
  });

  await new Promise(r => setTimeout(r, 2000));

  const mixState = await page.evaluate(() => {
    const h1 = document.querySelector('h1')?.innerText;
    const text = document.querySelector('main')?.innerText;
    return {
      h1,
      snippet: text?.substring(0, 300),
    };
  });

  console.log('Mix diario 1 state:', mixState);
  await page.screenshot({ path: 'spotifree-mixdiario-verified.png' });
  console.log('Screenshot saved to spotifree-mixdiario-verified.png');

  browser.disconnect();
}

testMixDiario().catch(console.error);
