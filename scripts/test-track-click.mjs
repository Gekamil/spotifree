import puppeteer from 'puppeteer-core';

async function testTrackClick() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const page = (await browser.pages())[0];

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));

  const res = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('div[class*="grid-cols-[20px"]:not(.border-b)'));
    console.log('Found rows:', rows.length);
    if (rows.length > 0) {
      console.log('Row 0 text:', rows[0].textContent);
      rows[0].click();
      return true;
    }
    return false;
  });

  console.log('Click executed:', res);
  await new Promise(r => setTimeout(r, 2000));

  const playerState = await page.evaluate(() => {
    return {
      footerHtml: document.querySelector('footer')?.innerHTML.slice(0, 300),
      hasScrubber: !!document.querySelector('footer div[class*="group relative flex-1 h-3"]'),
    };
  });
  console.log('Player state:', playerState);
}

testTrackClick().catch(console.error);
