import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

async function main() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 393, height: 852, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1');
  await page.goto('https://open.spotify.com/', { waitUntil: 'networkidle2', timeout: 35000 });
  await new Promise(r => setTimeout(r, 2000));

  const details = await page.evaluate(() => {
    const bottomFixed = document.querySelector('[class*="bottomFixed"]');
    const header = document.querySelector('[class*="M8GeCA3rM6ORM7XTED7w"]');
    
    function getStyles(el) {
      if (!el) return null;
      const s = window.getComputedStyle(el);
      return {
        bg: s.backgroundColor,
        bgImg: s.backgroundImage,
        backdropFilter: s.backdropFilter || s.webkitBackdropFilter,
        padding: s.padding,
        margin: s.margin,
        height: s.height,
        position: s.position,
        bottom: s.bottom,
        boxShadow: s.boxShadow,
        border: s.border,
      };
    }

    return {
      bottomFixedHtml: bottomFixed ? bottomFixed.innerHTML : null,
      bottomFixedStyles: getStyles(bottomFixed),
      headerHtml: header ? header.innerHTML : null,
      headerStyles: getStyles(header),
    };
  });

  fs.writeFileSync('public/spotify_real_mobile_elements.json', JSON.stringify(details, null, 2));
  console.log('Saved public/spotify_real_mobile_elements.json');
  console.log('Bottom fixed styles:', JSON.stringify(details.bottomFixedStyles, null, 2));
  console.log('Header styles:', JSON.stringify(details.headerStyles, null, 2));

  await browser.close();
}

main().catch(console.error);
