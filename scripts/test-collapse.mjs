import puppeteer from 'puppeteer-core';

async function testCollapse() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const page = (await browser.pages())[0];

  console.log('Clicking collapse button [>|] ...');
  await page.evaluate(() => {
    const btn = document.querySelector('button[aria-label="Ocultar la vista Sonando"]');
    if (btn) btn.click();
  });

  await new Promise(r => setTimeout(r, 600));

  const result = await page.evaluate(() => {
    const aside = document.querySelector('aside#Desktop_PanelContainer_Id');
    const expandBtn = document.querySelector('button[aria-label="Mostrar la vista Sonando"]');
    return {
      asidePresent: !!aside,
      expandBtnPresent: !!expandBtn
    };
  });
  console.log('After collapse result:', result);
}

testCollapse().catch(console.error);
