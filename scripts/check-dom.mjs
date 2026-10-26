import puppeteer from 'puppeteer-core';

async function checkDom() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const page = (await browser.pages())[0];
  
  const leftSidebarItems = await page.evaluate(() => {
    const aside = document.querySelector('aside');
    if (!aside) return 'No left aside';
    const spans = Array.from(aside.querySelectorAll('span, p')).map(el => el.textContent?.trim()).filter(Boolean);
    return spans.slice(0, 30);
  });
  console.log('Left sidebar items:', leftSidebarItems);

  const mainTracks = await page.evaluate(() => {
    const main = document.querySelector('main');
    if (!main) return 'No main';
    const text = main.textContent?.slice(0, 300);
    const divs = Array.from(main.querySelectorAll('div[role="row"], div[class*="grid"]')).length;
    return { text, divs };
  });
  console.log('Main info:', mainTracks);
}

checkDom().catch(console.error);
