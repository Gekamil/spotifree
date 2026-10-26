import puppeteer from 'puppeteer-core';

async function run() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('open.spotify.com'));
  
  if (spotifyPage) {
    const data = await spotifyPage.evaluate(() => {
      // Find the grid container that has the 8 cards
      const allDivs = Array.from(document.querySelectorAll('main div'));
      // Find grid div
      const grid = allDivs.find(d => {
        const style = window.getComputedStyle(d);
        return style.display === 'grid' && d.children.length >= 6 && d.children.length <= 12;
      });

      if (!grid) return { found: false };

      const gridStyle = {
        gridTemplateColumns: window.getComputedStyle(grid).gridTemplateColumns,
        gap: window.getComputedStyle(grid).gap,
        padding: window.getComputedStyle(grid).padding,
        margin: window.getComputedStyle(grid).margin,
      };

      const items = Array.from(grid.children).map(child => {
        const title = child.querySelector('span[data-encore-id="text"], p, a')?.textContent?.trim();
        const img = child.querySelector('img')?.src;
        const bg = window.getComputedStyle(child).backgroundColor;
        const borderRadius = window.getComputedStyle(child).borderRadius;
        const height = child.getBoundingClientRect().height;
        return { title, img, bg, borderRadius, height };
      });

      // Also get the gradient of the main background
      const mainContainer = document.querySelector('main')?.parentElement || document.querySelector('main');
      const bgImage = window.getComputedStyle(mainContainer).backgroundImage;
      const bgColor = window.getComputedStyle(mainContainer).backgroundColor;

      // Also inspect the section "Hecho para Jorgeperezvk"
      const hechoPara = Array.from(document.querySelectorAll('section')).find(s => s.textContent?.includes('Jorgeperezvk'));
      let hechoParaInfo = null;
      if (hechoPara) {
        const header = hechoPara.querySelector('h2')?.parentElement?.outerHTML;
        const cards = Array.from(hechoPara.querySelectorAll('img')).map(img => {
          const card = img.closest('div[data-testid*="card"], [role="group"]');
          return {
            title: card?.querySelector('a[title], [data-encore-id="text"]')?.textContent?.trim(),
            subtitle: card?.querySelectorAll('[data-encore-id="text"]')[1]?.textContent?.trim(),
            img: img.src,
            alt: img.alt,
          };
        });
        hechoParaInfo = { header, cards };
      }

      return {
        found: true,
        gridStyle,
        items,
        mainBg: { bgImage, bgColor },
        hechoParaInfo,
      };
    });

    console.log(JSON.stringify(data, null, 2));
  }
  browser.disconnect();
}
run().catch(console.error);
