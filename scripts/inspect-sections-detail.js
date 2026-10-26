import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('open.spotify.com'));
  if (spotifyPage) {
    if (!spotifyPage.url().endsWith('open.spotify.com/') && !spotifyPage.url().endsWith('open.spotify.com')) {
      await spotifyPage.goto('https://open.spotify.com/');
      await new Promise(r => setTimeout(r, 2000));
    }

    // Scroll to load all sections
    for (let i = 0; i < 6; i++) {
      await spotifyPage.evaluate(() => window.scrollBy(0, 800));
      await new Promise(r => setTimeout(r, 400));
    }

    const sectionsData = await spotifyPage.evaluate(() => {
      const sections = Array.from(document.querySelectorAll('section'));
      return sections.map(s => {
        const title = s.querySelector('h2')?.textContent?.trim();
        const subtitle = s.querySelector('p')?.textContent?.trim();
        const sampleCard = s.querySelector('[role="group"], [data-testid="card-click-handler"], [data-encore-id="card"]');

        let cardHtml = null;
        if (sampleCard) {
          cardHtml = sampleCard.outerHTML.substring(0, 600);
        }

        return { title, subtitle, hasCard: !!sampleCard, sampleCardHtml: cardHtml };
      }).filter(s => s.title);
    });

    console.log('Sections inspection:');
    for (const s of sectionsData) {
      console.log(`\n--- Section: ${s.title} --- (Sub: ${s.subtitle})`);
      if (s.sampleCardHtml) console.log(s.sampleCardHtml.substring(0, 300));
    }
  }
  browser.disconnect();
}

main().catch(console.error);
