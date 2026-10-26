import puppeteer from 'puppeteer-core';

async function run() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('open.spotify.com'));
  
  if (spotifyPage) {
    const data = await spotifyPage.evaluate(() => {
      const section = Array.from(document.querySelectorAll('section')).find(s => s.textContent?.includes('Jorgeperezvk'));
      if (!section) return null;

      const cards = Array.from(section.querySelectorAll('[data-testid*="card"], [role="group"]')).map(c => {
        const title = c.querySelector('a[title], [data-encore-id="text"]')?.textContent?.trim();
        const subtitle = c.querySelectorAll('[data-encore-id="text"]')[1]?.textContent?.trim();
        const img = c.querySelector('img')?.src;
        return { title, subtitle, img };
      });

      return {
        sectionTitle: section.querySelector('h2')?.textContent?.trim(),
        sectionSubtitle: section.querySelector('p')?.textContent?.trim(),
        cards: cards.slice(0, 6)
      };
    });

    console.log(JSON.stringify(data, null, 2));
  }
  browser.disconnect();
}
run().catch(console.error);
