import puppeteer from 'puppeteer-core';

async function run() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('open.spotify.com'));
  
  if (spotifyPage) {
    const list = await spotifyPage.evaluate(() => {
      // Find left column elements
      const allText = Array.from(document.querySelectorAll('*')).filter(el => {
        const rect = el.getBoundingClientRect();
        return rect.left < 350 && rect.top > 120 && rect.top < 800 && el.children.length === 0 && el.textContent.trim().length > 2;
      }).map(el => ({ text: el.textContent.trim(), tag: el.tagName, class: el.className }));
      return allText.slice(0, 30);
    });

    console.log(JSON.stringify(list, null, 2));
  }
  browser.disconnect();
}
run().catch(console.error);
