import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('open.spotify.com'));
  if (spotifyPage) {
    const cardInfo = await spotifyPage.evaluate(() => {
      // Find Radio Aventura or el nuevo urbano card
      const anchors = Array.from(document.querySelectorAll('a'));
      const a = anchors.find(el => el.textContent.includes('Radio Aventura') || el.textContent.includes('el nuevo urbano'));
      if (!a) return 'No anchor found';
      const card = a.closest('[role="group"], [data-encore-id="card"], [data-testid="card-click-handler"]');
      if (!card) return 'No card parent found';

      return {
        cardHtml: card.outerHTML,
        allTextNodes: Array.from(card.querySelectorAll('*')).map(el => ({
          tag: el.tagName,
          classes: el.className,
          text: el.textContent.trim(),
          hasDirectText: Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent.trim().length > 0)
        })).filter(x => x.hasDirectText)
      };
    });
    console.log('Card text nodes:', JSON.stringify(cardInfo, null, 2));
  }
  browser.disconnect();
}

main().catch(console.error);
