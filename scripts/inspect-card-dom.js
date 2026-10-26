import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('open.spotify.com'));
  if (spotifyPage) {
    const cardSample = await spotifyPage.evaluate(() => {
      const card = document.querySelector('[role="group"], [data-testid="card-click-handler"]');
      if (!card) return 'No card found';
      return {
        cardHtml: card.outerHTML.substring(0, 800),
        anchors: Array.from(card.querySelectorAll('a')).map(a => ({
          href: a.href,
          title: a.getAttribute('title'),
          text: a.textContent.trim()
        })),
        textElements: Array.from(card.querySelectorAll('[data-encore-id="text"], p, span')).map(el => ({
          tag: el.tagName,
          text: el.textContent.trim(),
          className: el.className
        }))
      };
    });
    console.log('Sample Card DOM:', JSON.stringify(cardSample, null, 2));
  }
  browser.disconnect();
}

main().catch(console.error);
