import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

function toHDImage(url) {
  if (!url) return 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg';
  return url
    .replace('/ab67616d00004851/', '/ab67616d0000b273/')
    .replace('/ab67616d00001e02/', '/ab67616d0000b273/')
    .replace('/ab67706f00004851/', '/ab67706f00000002/')
    .replace('/ab67706c00004851/', '/ab67706c0000d72c/')
    .replace('/ab67706c00001e02/', '/ab67706c0000d72c/')
    .replace('/ab67706f000036f3/', '/ab67706f00000002/');
}

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('open.spotify.com'));
  if (!spotifyPage) {
    browser.disconnect();
    return;
  }

  if (!spotifyPage.url().endsWith('open.spotify.com/') && !spotifyPage.url().endsWith('open.spotify.com')) {
    await spotifyPage.goto('https://open.spotify.com/');
    await new Promise(r => setTimeout(r, 2000));
  }

  // Scroll to load carousels
  for (let i = 0; i < 7; i++) {
    await spotifyPage.evaluate(() => window.scrollBy(0, 900));
    await new Promise(r => setTimeout(r, 450));
  }
  await spotifyPage.evaluate(() => window.scrollTo(0, 0));
  await new Promise(r => setTimeout(r, 600));

  const result = await spotifyPage.evaluate(() => {
    const userBtn = document.querySelector('[data-testid="user-widget-link"]') ||
                    document.querySelector('[data-testid="username-first-letter"]');
    const userName = userBtn ? (userBtn.getAttribute('aria-label') || userBtn.textContent) : 'Jorgeperezvk';

    const sections = Array.from(document.querySelectorAll('main section'));
    const shelves = [];

    for (let sIdx = 0; sIdx < sections.length; sIdx++) {
      const sec = sections[sIdx];
      const h2 = sec.querySelector('h2');
      if (!h2) continue;
      const title = h2.textContent?.trim();
      if (!title || title.toLowerCase() === 'puede que te guste') continue;

      const subtitle = sec.querySelector('p')?.textContent?.trim() || '';

      const cardElements = Array.from(sec.querySelectorAll('[data-encore-id="card"]'));
      const cards = [];

      for (let cIdx = 0; cIdx < cardElements.length; cIdx++) {
        const el = cardElements[cIdx];
        const anchor = el.querySelector('a[href*="/playlist/"], a[href*="/album/"], a[href*="/artist/"], a[href*="/episode/"]') || el.querySelector('a');
        const href = anchor ? anchor.getAttribute('href') : null;
        const id = href ? href.split('/').filter(Boolean).pop()?.split('?')[0] : `card-${sIdx}-${cIdx}`;

        const cardTitle = el.querySelector('[data-encore-id="cardTitle"]')?.textContent?.trim() || anchor?.textContent?.trim() || `Item ${cIdx+1}`;
        const cardSubtitle = el.querySelector('[data-encore-id="cardSubtitle"]')?.textContent?.trim() || el.querySelector('p')?.textContent?.trim() || '';
        const img = el.querySelector('img[data-testid="card-image"], img')?.src || null;
        const video = el.querySelector('video')?.src || null;
        const isRadio = cardTitle.toLowerCase().includes('radio') ||
                        cardSubtitle.toLowerCase().includes('radio') ||
                        title.toLowerCase().includes('emisoras');

        cards.push({
          id,
          title: cardTitle,
          subtitle: cardSubtitle,
          image: img,
          video,
          link: href,
          isRadio: !!isRadio
        });
      }

      if (cards.length > 0) {
        shelves.push({
          id: `shelf-${sIdx}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
          title,
          subtitle,
          hasSeeAll: !!sec.querySelector('a[href*="/section/"], a[href*="/recents"]'),
          cards
        });
      }
    }

    return { userName, shelves };
  });

  browser.disconnect();

  console.log(`Extracted ${result.shelves.length} shelves:`);
  for (const s of result.shelves) {
    console.log(`\n• [${s.title}] (${s.cards.length} cards, subtitle: "${s.subtitle}")`);
    for (const c of s.cards.slice(0, 4)) {
      console.log(`    - Title: "${c.title}" | Sub: "${c.subtitle}" | Radio: ${c.isRadio}`);
    }
  }

  // Save to src/data/liveExtractedFeed.json
  const processed = {
    userName: result.userName,
    shelves: result.shelves.map(s => ({
      ...s,
      cards: s.cards.map(c => ({
        ...c,
        image: toHDImage(c.image)
      }))
    }))
  };

  fs.writeFileSync('src/data/liveExtractedFeed.json', JSON.stringify(processed, null, 2));
}

main().catch(console.error);
