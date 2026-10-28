import puppeteer from 'puppeteer-core';

async function inspectCards() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const spPage = pages.find(p => p.url().includes('open.spotify.com'));

  const details = await spPage.evaluate(() => {
    const firstSection = document.querySelectorAll('section')[2]; // Shelf 2 (Emisoras recomendadas)
    if (!firstSection) return null;
    const cards = Array.from(firstSection.querySelectorAll('[role="gridcell"]')).slice(0, 3);
    return cards.map(c => {
      const allTexts = Array.from(c.querySelectorAll('*')).map(el => ({
        tag: el.tagName,
        className: el.className,
        text: el.textContent?.trim()
      })).filter(t => t.text && t.text.length < 100);
      return { html: c.innerHTML.slice(0, 400), allTexts };
    });
  });

  console.log(JSON.stringify(details, null, 2));
  browser.disconnect();
}

inspectCards().catch(console.error);
