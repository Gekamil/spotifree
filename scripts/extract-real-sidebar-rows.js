import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('open.spotify.com'));

  const extracted = await spotifyPage.evaluate(() => {
    const nav = document.querySelector('nav');
    if (!nav) return [];

    const rows = Array.from(nav.querySelectorAll('div[role="row"]'));
    return rows.map((r, idx) => {
      const titleEl = r.querySelector('[id*="listrow-title-"], .e-101040-legacy-list-row-title, p, span');
      const subtitleEl = r.querySelector('[id*="listrow-subtitle-"], .e-101040-legacy-list-row-subtitle, p:nth-of-type(2)');
      const img = r.querySelector('img')?.src;
      const isPinned = !!r.querySelector('svg[aria-label*="fijad"], svg[data-encore-id*="pin"]');
      
      // Extract uri or id from titleEl id attribute
      let uri = '';
      if (titleEl && titleEl.id) {
        uri = titleEl.id.replace('listrow-title-', '');
      }

      // Also get any other text
      const allTexts = Array.from(r.querySelectorAll('p, span')).map(e => e.textContent?.trim()).filter(Boolean);

      return {
        idx,
        uri,
        title: titleEl?.textContent?.trim(),
        subtitle: subtitleEl?.textContent?.trim(),
        allTexts,
        img,
        isPinned
      };
    });
  });

  console.log(`Extracted ${extracted.length} real playlists from sidebar:`);
  for (const item of extracted) {
    console.log(`[${item.idx}] URI: ${item.uri}`);
    console.log(`     Title: ${item.title}`);
    console.log(`     Sub: ${item.subtitle} (Pinned: ${item.isPinned})`);
    console.log(`     Img: ${item.img ? item.img.slice(0, 70) : 'none'}`);
  }

  browser.disconnect();
}

main().catch(console.error);
