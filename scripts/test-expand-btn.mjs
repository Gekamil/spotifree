import puppeteer from 'puppeteer-core';

async function testExpandBtn() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const page = (await browser.pages())[0];

  const info = await page.evaluate(() => {
    const btn = document.querySelector('button[aria-label="Mostrar la vista Sonando"]');
    const allButtons = Array.from(document.querySelectorAll('button')).map(b => ({
      ariaLabel: b.getAttribute('aria-label'),
      title: b.title,
      text: b.textContent?.trim(),
      className: b.className.slice(0, 30)
    }));
    return {
      hasExpandBtn: !!btn,
      expandBtnHtml: btn ? btn.outerHTML : null,
      buttonsMatching: allButtons.filter(b => (b.ariaLabel || '').includes('Sonando') || (b.title || '').includes('Sonando'))
    };
  });
  console.log(JSON.stringify(info, null, 2));
}

testExpandBtn().catch(console.error);
