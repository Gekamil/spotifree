import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('open.spotify.com'));
  if (spotifyPage) {
    const cardSample = await spotifyPage.evaluate(() => {
      const main = document.querySelector('main');
      if (!main) return 'No main';
      const cards = Array.from(main.querySelectorAll('[data-testid="card-click-handler"], [data-encore-id="card"]'));
      return cards.slice(0, 3).map(c => ({
        html: c.outerHTML.substring(0, 400),
        anchors: Array.from(c.querySelectorAll('a')).map(a => ({ href: a.href, text: a.textContent.trim() })),
        texts: Array.from(c.querySelectorAll('[data-encore-id="text"], p, span')).map(t => t.textContent.trim()).filter(Boolean)
      }));
    });
    console.log('Sample Main Cards DOM:', JSON.stringify(cardSample, null, 2));
  }
  browser.disconnect();
}

main().catch(console.error);
