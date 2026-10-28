import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

async function extractPerfectLiveFeed() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const spPage = pages.find(p => p.url().includes('open.spotify.com'));

  if (!spPage) {
    console.error('No Spotify page found');
    browser.disconnect();
    return;
  }

  // Scroll page slightly to trigger lazy-load on all shelves
  await spPage.evaluate(async () => {
    const scrollContainer = document.querySelector('.main-view-container__scroll-node') || window;
    scrollContainer.scrollBy(0, 1000);
    await new Promise(r => setTimeout(r, 1000));
    scrollContainer.scrollBy(0, 1000);
    await new Promise(r => setTimeout(r, 1000));
    scrollContainer.scrollTo(0, 0);
  });

  const fullData = await spPage.evaluate(() => {
    const sections = Array.from(document.querySelectorAll('section'));
    const cleanShelves = [];

    sections.forEach((sec, sIdx) => {
      const heading = sec.querySelector('h2, h3, [role="heading"]')?.textContent?.trim();
      if (!heading) return;

      const lower = heading.toLowerCase();
      if (lower.includes('cookie') || lower.includes('privacidad') || lower.includes('consentimiento')) return;

      const cards = [];
      const seen = new Set();
      const cardNodes = Array.from(sec.querySelectorAll('[role="gridcell"], [data-encore-id="card"]'));

      cardNodes.forEach((cNode, cIdx) => {
        const titleEl = cNode.querySelector('.e-101040-card-title, [data-testid="card-title"]');
        const title = titleEl?.textContent?.trim();
        const subtitleEl = cNode.querySelector('.encore-internal-color-text-subdued');
        const subtitle = subtitleEl?.textContent?.trim() || 'De Spotify';
        const img = cNode.querySelector('img')?.src;
        const link = cNode.querySelector('a')?.getAttribute('href') || '';
        const idMatch = link.match(/\/(playlist|album|artist|show|episode)\/([a-zA-Z0-9]+)/);
        const id = idMatch ? idMatch[2] : `shelf-${sIdx}-${cIdx}`;
        const type = idMatch ? idMatch[1] : 'playlist';

        if (title && img && !seen.has(id)) {
          seen.add(id);
          cards.push({
            id,
            title,
            subtitle,
            image: img,
            type,
            href: link
          });
        }
      });

      if (cards.length > 0) {
        cleanShelves.push({
          id: `shelf-${sIdx}-${heading.toLowerCase().replace(/\s+/g, '-')}`,
          title: heading,
          cards
        });
      }
    });

    return cleanShelves;
  });

  console.log(`Extracted ${fullData.length} clean shelves!`);
  fullData.forEach(s => {
    console.log(`\n=== Shelf: "${s.title}" (${s.cards.length} cards) ===`);
    s.cards.slice(0, 4).forEach(c => {
      console.log(`   - [${c.type}] "${c.title}" (${c.subtitle})`);
    });
  });

  fs.writeFileSync('src/data/liveExtractedFeed.json', JSON.stringify(fullData, null, 2), 'utf8');
  browser.disconnect();
}

extractPerfectLiveFeed().catch(console.error);
