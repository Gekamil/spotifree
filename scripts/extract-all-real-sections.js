import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('open.spotify.com'));
  if (spotifyPage) {
    const data = await spotifyPage.evaluate(async () => {
      const allDivs = Array.from(document.querySelectorAll('*'));
      const mainScroll = allDivs.find(d => {
        const style = window.getComputedStyle(d);
        return (style.overflowY === 'auto' || style.overflowY === 'scroll') && d.scrollHeight > 2500;
      });
      if (!mainScroll) return 'Main scroll not found';

      let foundCards = [];
      // Scroll through gradually to capture all sections and their real images
      const sectionsMap = {};

      for (let y = 0; y <= mainScroll.scrollHeight; y += 450) {
        mainScroll.scrollTop = y;
        await new Promise(r => setTimeout(r, 250));

        const sections = Array.from(document.querySelectorAll('section'));
        for (const sec of sections) {
          const header = sec.querySelector('h2, [data-encore-id="textHeadline"], a[title]');
          const title = header?.innerText?.trim();
          if (!title || title.length > 50) continue;

          if (!sectionsMap[title]) sectionsMap[title] = [];

          const cards = Array.from(sec.querySelectorAll('div[data-testid*="card"], div[class*="Card"], div[role="group"]'));
          for (const c of cards) {
            const cTitle = c.querySelector('a[title], h3, [data-encore-id="text"]:not([data-encore-id="textSubdued"])')?.innerText?.trim();
            const cSub = c.querySelector('[data-encore-id="textSubdued"]')?.innerText?.trim();
            const img = c.querySelector('img')?.src;
            const link = c.querySelector('a[href]')?.getAttribute('href');

            if (cTitle && cTitle !== 'Mostrar todos' && img && img.startsWith('http')) {
              if (!sectionsMap[title].some(existing => existing.title === cTitle)) {
                sectionsMap[title].push({ title: cTitle, subtitle: cSub, img, link });
              }
            }
          }
        }
      }

      // Reset scroll
      mainScroll.scrollTop = 0;
      return sectionsMap;
    });

    console.log(JSON.stringify(data, null, 2));
  }
  browser.disconnect();
}

main().catch(console.error);
