import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

async function extractFullLiveHome() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const spPage = pages.find(p => p.url().includes('open.spotify.com'));

  if (!spPage) {
    console.error('No open Spotify page found in Chrome!');
    browser.disconnect();
    return;
  }

  console.log('Extracting live Spotify Home feed from active tab:', spPage.url());

  const liveFeed = await spPage.evaluate(() => {
    // 1. Get user profile
    const userWidget = document.querySelector('[data-testid="user-widget-link"]');
    const userName = userWidget?.textContent?.trim() || 'Jorgeperezvk';

    // 2. Extract sections / shelves from main
    const sections = Array.from(document.querySelectorAll('section, [data-testid="component-shelf"], [data-testid="home-section"]'));

    const extractedShelves = [];

    sections.forEach((sec, sIdx) => {
      const headingEl = sec.querySelector('h2, h3, [role="heading"]');
      const title = headingEl?.textContent?.trim();
      if (!title) return;

      // Filter out cookie / legal banners
      if (title.toLowerCase().includes('cookie') || title.toLowerCase().includes('consentimiento') || title.toLowerCase().includes('privacidad')) {
        return;
      }

      // Extract cards inside this section
      const cardEls = Array.from(sec.querySelectorAll('[role="gridcell"], [data-testid="card"], a[draggable="false"]')).filter(el => {
        // Must contain an image and a title
        return el.querySelector('img') && el.textContent?.trim();
      });

      const cards = [];
      const seenIds = new Set();

      cardEls.forEach((card, cIdx) => {
        const imgEl = card.querySelector('img');
        const img = imgEl?.src || '';
        
        // Find title & subtitle
        const textNodes = Array.from(card.querySelectorAll('div, span, a, p'))
          .map(t => t.textContent?.trim())
          .filter(Boolean);

        // Link
        const anchor = card.tagName === 'A' ? card : card.querySelector('a');
        const href = anchor?.getAttribute('href') || '';
        const idMatch = href.match(/\/(playlist|album|artist|show|episode)\/([a-zA-Z0-9]+)/);
        const type = idMatch ? idMatch[1] : 'playlist';
        const rawId = idMatch ? idMatch[2] : `shelf-${sIdx}-card-${cIdx}`;

        if (seenIds.has(rawId)) return;
        seenIds.add(rawId);

        // Extract title
        let cardTitle = card.querySelector('[data-testid="card-title"], .encore-text-body-medium-bold, strong, h3, [data-encore-id="text"]')?.textContent?.trim();
        if (!cardTitle && textNodes.length > 0) {
          cardTitle = textNodes[0];
        }

        // Subtitle
        let cardSubtitle = card.querySelector('[data-testid="card-subtitle"], .encore-text-body-small, [data-encore-id="textSubdued"]')?.textContent?.trim();
        if (!cardSubtitle && textNodes.length > 1) {
          cardSubtitle = textNodes.find(t => t !== cardTitle) || '';
        }

        if (cardTitle && img && !img.includes('data:image/svg')) {
          cards.push({
            id: rawId,
            type,
            title: cardTitle,
            subtitle: cardSubtitle || `De Spotify`,
            image: img,
            href: href || `/playlist/${rawId}`
          });
        }
      });

      if (cards.length > 0) {
        extractedShelves.push({
          id: `shelf-live-${sIdx}`,
          title,
          cards
        });
      }
    });

    // 3. Extract Quick Access / Top shortcuts
    const shortcutGrid = document.querySelector('[data-testid="grid-container"], [role="grid"]');
    const shortcutItems = shortcutGrid ? Array.from(shortcutGrid.querySelectorAll('[role="gridcell"], a')).map((item, idx) => {
      const img = item.querySelector('img')?.src;
      const text = item.textContent?.trim();
      const href = item.querySelector('a')?.getAttribute('href') || item.getAttribute('href') || '';
      const idMatch = href.match(/\/(playlist|album|artist)\/([a-zA-Z0-9]+)/);
      return {
        id: idMatch ? idMatch[2] : `shortcut-${idx}`,
        name: text || 'Playlist',
        image: img || 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg',
        href
      };
    }).filter(s => s.name && s.image) : [];

    // 4. Extract left sidebar playlists
    const sidebarItems = Array.from(document.querySelectorAll('[data-testid="rootlist-item"], [data-testid="CustomPlaylistRow"]')).map(li => {
      const name = li.querySelector('span, a')?.textContent?.trim();
      const href = li.querySelector('a')?.getAttribute('href') || '';
      const img = li.querySelector('img')?.src;
      return { name, href, img };
    }).filter(p => p.name);

    return {
      userName,
      shelvesCount: extractedShelves.length,
      shelves: extractedShelves,
      shortcuts: shortcutItems,
      sidebarCount: sidebarItems.length,
      sidebarItems
    };
  });

  console.log(`Extracted live feed successfully!`);
  console.log(`Shelves found: ${liveFeed.shelvesCount}`);
  liveFeed.shelves.forEach(s => {
    console.log(`  - "${s.title}" (${s.cards.length} cards)`);
  });
  console.log(`Shortcuts found: ${liveFeed.shortcuts?.length || 0}`);

  fs.writeFileSync('src/data/liveRealSpotifyFeed.json', JSON.stringify(liveFeed, null, 2), 'utf8');
  browser.disconnect();
}

extractFullLiveHome().catch(console.error);
