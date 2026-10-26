import puppeteer from 'puppeteer-core';

async function run() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('open.spotify.com'));
  
  if (spotifyPage) {
    const details = await spotifyPage.evaluate(() => {
      // 1. Grid of quick access
      const quickItems = Array.from(document.querySelectorAll('[data-testid="shortcut-item"]')).map(el => {
        const titleEl = el.querySelector('a, p, span');
        const imgEl = el.querySelector('img');
        const bg = window.getComputedStyle(el).backgroundColor;
        return {
          title: titleEl ? titleEl.textContent.trim() : '',
          img: imgEl ? imgEl.src : '',
          bg: bg,
        };
      });

      // Quick items parent style
      const quickParent = document.querySelector('[data-testid="shortcut-item"]')?.parentElement;
      const quickGridStyle = quickParent ? {
        display: window.getComputedStyle(quickParent).display,
        gridTemplateColumns: window.getComputedStyle(quickParent).gridTemplateColumns,
        gap: window.getComputedStyle(quickParent).gap,
      } : null;

      // 2. All sections on the main page
      const sections = Array.from(document.querySelectorAll('section')).map(s => {
        const titleEl = s.querySelector('h2, [data-testid="shelf-title"]');
        const subtitleEl = s.querySelector('span[data-encore-id="text"]');
        const cards = Array.from(s.querySelectorAll('img')).map(img => {
          const cardParent = img.closest('[data-testid="card-click-handler"], [role="group"], div[data-testid*="card"]');
          const title = cardParent?.querySelector('a[title], [data-encore-id="text"], p')?.textContent?.trim() || '';
          const subtitle = cardParent?.querySelectorAll('[data-encore-id="text"]')[1]?.textContent?.trim() || '';
          return {
            title,
            subtitle,
            img: img.src,
            alt: img.alt,
          };
        });
        return {
          title: titleEl?.textContent?.trim() || '',
          subtitle: subtitleEl?.textContent?.trim() || '',
          cardsCount: cards.length,
          cards: cards.slice(0, 10),
        };
      });

      // 3. Top bar + Biblioteca details
      const libraryCreateBtn = document.querySelector('button[aria-label*="Crear"], [data-testid="create-playlist-button"]');
      const createBtnText = libraryCreateBtn ? libraryCreateBtn.textContent?.trim() : null;
      const createBtnHtml = libraryCreateBtn ? libraryCreateBtn.outerHTML : null;

      return {
        quickGridStyle,
        quickItems,
        sections,
        createBtnText,
        createBtnHtml,
      };
    });

    console.log(JSON.stringify(details, null, 2));
  }
  browser.disconnect();
}
run().catch(console.error);
