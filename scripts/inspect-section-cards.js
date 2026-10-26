import puppeteer from 'puppeteer-core';

async function run() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const sp = pages.find(p => p.url().includes('open.spotify.com'));
  
  if (sp) {
    const sectionInfo = await sp.evaluate(() => {
      const section = Array.from(document.querySelectorAll('section')).find(s => s.querySelector('h2')?.textContent?.includes('viernes'));
      if (!section) return null;

      // Find all images in section
      const imgs = Array.from(section.querySelectorAll('img')).map(img => {
        // Walk up to find the card container
        let parent = img.parentElement;
        let cardContainer = null;
        for (let i = 0; i < 6; i++) {
          if (!parent) break;
          if (parent.querySelector('a[title], [data-encore-id="text"]')) {
            cardContainer = parent;
          }
          parent = parent.parentElement;
        }

        const title = cardContainer?.querySelector('a[title], [data-encore-id="text"]')?.textContent?.trim();
        const desc = cardContainer?.querySelectorAll('[data-encore-id="text"]')[1]?.textContent?.trim() || '';

        return {
          src: img.src,
          alt: img.alt,
          title,
          desc,
        };
      });

      return {
        h2: section.querySelector('h2')?.textContent?.trim(),
        imgs,
      };
    });

    console.log(JSON.stringify(sectionInfo, null, 2));
  }
  browser.disconnect();
}
run().catch(console.error);
