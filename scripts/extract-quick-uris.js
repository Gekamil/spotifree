import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('open.spotify.com'));
  if (spotifyPage) {
    const quickItems = await spotifyPage.evaluate(() => {
      // Find top cards on home page
      const cards = Array.from(document.querySelectorAll('div[data-testid*="quick"], div[data-testid*="shortcut"], [role="gridcell"] a[href], section a[href]'));
      const relevant = cards.map(c => {
        const text = c.innerText?.trim();
        const href = c.getAttribute('href');
        return { text, href };
      }).filter(i => i.text && (/urbano|ZIZI|míticas|J\+L/i.test(i.text) || (i.href && /playlist|album/i.test(i.href))));
      return relevant;
    });

    console.log(JSON.stringify(quickItems, null, 2));
  }
  browser.disconnect();
}

main().catch(console.error);
