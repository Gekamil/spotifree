import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const page = await browser.newPage();
  await page.setViewport({ width: 393, height: 852, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await page.setUserAgent(
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
  );

  await page.goto('https://open.spotify.com/intl-es/', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));

  const topSection = await page.evaluate(() => {
    const main = document.querySelector('main');
    if (!main) return 'no main';
    // First 4 children of main
    const children = Array.from(main.children).slice(0, 5).map(c => ({
      tag: c.tagName,
      className: c.className,
      text: c.textContent?.trim().slice(0, 100),
      html: c.outerHTML.slice(0, 500)
    }));
    return children;
  });

  console.log('Top section under main:', JSON.stringify(topSection, null, 2));

  await page.close();
  browser.disconnect();
}

main().catch(console.error);
