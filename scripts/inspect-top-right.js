import puppeteer from 'puppeteer-core';

async function run() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const page = (await browser.pages()).find(p => p.url().includes('spotify.com'));

  const details = await page.evaluate(() => {
    const installBtn = Array.from(document.querySelectorAll('a')).find(a => a.innerText.includes('Instalar'));
    const userBtn = document.querySelector('[data-testid="user-widget-link"]');
    const userSpan = userBtn ? userBtn.querySelector('[data-testid="username-first-letter"]') : null;

    return {
      installBtn: installBtn ? {
        outerHTML: installBtn.outerHTML,
        padding: window.getComputedStyle(installBtn).padding,
        fontSize: window.getComputedStyle(installBtn).fontSize,
        fontWeight: window.getComputedStyle(installBtn).fontWeight,
        backgroundColor: window.getComputedStyle(installBtn).backgroundColor,
        color: window.getComputedStyle(installBtn).color,
        borderRadius: window.getComputedStyle(installBtn).borderRadius,
        height: window.getComputedStyle(installBtn).height,
        gap: window.getComputedStyle(installBtn).gap,
        svg: installBtn.querySelector('svg')?.outerHTML
      } : null,
      userBtn: userBtn ? {
        outerHTML: userBtn.outerHTML,
        width: window.getComputedStyle(userBtn).width,
        height: window.getComputedStyle(userBtn).height,
        borderRadius: window.getComputedStyle(userBtn).borderRadius,
        backgroundColor: window.getComputedStyle(userBtn).backgroundColor,
        padding: window.getComputedStyle(userBtn).padding
      } : null,
      userSpan: userSpan ? {
        outerHTML: userSpan.outerHTML,
        width: window.getComputedStyle(userSpan).width,
        height: window.getComputedStyle(userSpan).height,
        borderRadius: window.getComputedStyle(userSpan).borderRadius,
        backgroundColor: window.getComputedStyle(userSpan).backgroundColor,
        color: window.getComputedStyle(userSpan).color,
        lineHeight: window.getComputedStyle(userSpan).lineHeight,
        fontSize: window.getComputedStyle(userSpan).fontSize,
        fontWeight: window.getComputedStyle(userSpan).fontWeight
      } : null
    };
  });

  console.log('TOP RIGHT DETAILS:');
  console.log(JSON.stringify(details, null, 2));

  browser.disconnect();
}

run().catch(console.error);
