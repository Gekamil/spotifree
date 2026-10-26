import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('open.spotify.com'));

  const rowDetails = await spotifyPage.evaluate(() => {
    const nav = document.querySelector('nav');
    if (!nav) return [];

    const rows = Array.from(nav.querySelectorAll('div[role="row"]'));
    return rows.slice(1, 10).map((r, i) => {
      // Find all text elements inside
      const texts = Array.from(r.querySelectorAll('*'))
        .filter(el => el.children.length === 0 && el.textContent.trim())
        .map(el => ({ tag: el.tagName, text: el.textContent.trim(), class: el.className }));
      
      const img = r.querySelector('img')?.src;
      const isPinned = r.innerHTML.includes('fijad') || r.innerHTML.includes('pin') || r.innerHTML.includes('Pin');

      return {
        i,
        texts,
        img,
        isPinned,
        innerHTML: r.innerHTML.slice(0, 300)
      };
    });
  });

  console.log(JSON.stringify(rowDetails, null, 2));
  browser.disconnect();
}

main().catch(console.error);
