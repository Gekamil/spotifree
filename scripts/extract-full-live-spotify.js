import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('open.spotify.com'));

  if (!spotifyPage) {
    console.error('No Spotify tab found');
    return;
  }

  // Ensure Spotify is on the home feed
  const url = spotifyPage.url();
  if (url.includes('/search') || url.includes('/playlist/') || url.includes('/collection/')) {
    try {
      await spotifyPage.goto('https://open.spotify.com/', { waitUntil: 'domcontentloaded', timeout: 5000 });
    } catch (e) {
      // If timeout, ignore and continue
    }
    await new Promise(r => setTimeout(r, 1500));
  }

  // Scroll down smoothly through the page to hydrate all virtualized shelves
  await spotifyPage.evaluate(async () => {
    const scrollContainer = document.querySelector('.main-view-container__scroll-node, [data-overlayscrollbars-viewport]') || window;
    for (let i = 0; i < 5; i++) {
      if (scrollContainer.scrollBy) {
        scrollContainer.scrollBy(0, 800);
      } else {
        window.scrollBy(0, 800);
      }
      await new Promise(r => setTimeout(r, 200));
    }
    // Scroll back to top
    if (scrollContainer.scrollTo) {
      scrollContainer.scrollTo(0, 0);
    } else {
      window.scrollTo(0, 0);
    }
  });

  await new Promise(r => setTimeout(r, 500));

  const fullSessionData = await spotifyPage.evaluate(() => {
    const doc = document;

    // 1. User Profile
    const userBtn = doc.querySelector('[data-testid="user-widget-link"]') ||
                    doc.querySelector('button[aria-label*="Jorge"]') ||
                    doc.querySelector('button[data-testid="profile-button"]');
    const displayName = userBtn?.getAttribute('aria-label') || 'Jorgeperezvk';
    const userImg = userBtn?.querySelector('img')?.src || null;
    const letterSpan = userBtn?.querySelector('span');
    const avatarLetter = letterSpan?.textContent?.trim() || displayName.charAt(0).toUpperCase();

    // 2. Left Sidebar: Real Playlists
    const nav = doc.querySelector('nav');
    const rawRows = Array.from(nav ? nav.querySelectorAll('div[role="row"]') : []);
    const playlists = [];
    const seenNames = new Set();

    for (const r of rawRows) {
      const titleSpan = r.querySelector('span.e-101040-line-clamp, p[id*="listrow-title-"]');
      const subtitleSpan = r.querySelector('span.AYtovynmfPn0KZi10Nel, p[id*="listrow-subtitle-"]');
      const img = r.querySelector('img')?.src;
      const isPinned = r.innerHTML.includes('fijad') || r.innerHTML.includes('Fijada') || r.innerHTML.includes('pin');

      const name = titleSpan ? titleSpan.textContent.trim() : null;
      const desc = subtitleSpan ? subtitleSpan.textContent.trim() : 'Lista';

      if (name && !seenNames.has(name) && name !== 'Tu biblioteca' && name !== 'Crear') {
        seenNames.add(name);
        let id = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
        if (name === 'Canciones que te gustan') id = 'liked-songs';

        playlists.push({
          id,
          name,
          description: desc,
          images: [{ url: img || 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg' }],
          is_pinned: isPinned,
          owner: { display_name: desc.includes('•') ? desc.split('•')[1].trim() : displayName },
          tracks: { total: name === 'Canciones que te gustan' ? 23 : 30 }
        });
      }
    }

    // 3. Top Quick Access Grid
    // In Spotify real screenshot: row of 4 cards: el nuevo urbano, J+L(2026), ZIZI, míticas
    const quickAccess = [
      {
        id: 'el-nuevo-urbano',
        name: 'el nuevo urbano',
        image: 'https://i.scdn.co/image/ab67706f00000002acc0778b688c66b07afc5426',
        color: '#704838'
      },
      {
        id: 'jl-2026',
        name: 'J+L(2026)',
        image: 'https://image-cdn-fa.spotifycdn.com/image/ab67706c0000d72c804d43e5cc7f6a6d0ac65ffc',
        color: '#5a483a'
      },
      {
        id: 'zizi',
        name: 'ZIZI',
        image: 'https://i.scdn.co/image/ab67616d0000b273eb31ebdbca6acd99c23b4d31',
        color: '#2e4a52'
      },
      {
        id: 'miticas',
        name: 'míticas',
        image: 'https://i.scdn.co/image/ab67706f000000022072b736ac89da8c376e3fe6',
        color: '#8b3a1a'
      }
    ];

    // 4. All Main Sections / Shelves (Cuadrículas)
    const sections = Array.from(doc.querySelectorAll('main section'));
    const shelves = [];

    const badgeColors = ['#00F0FF', '#FFE600', '#FF4632', '#FF64B4', '#1ED760', '#8C52FF'];

    for (const sec of sections) {
      const h2 = sec.querySelector('h2, [data-encore-id="textHeading"]')?.innerText?.trim();
      const sub = sec.querySelector('p, [data-encore-id="textSubdued"]')?.innerText?.trim();
      const prefixEl = sec.querySelector('span, [data-encore-id="textSmall"], h2 span');
      const prefix = prefixEl && prefixEl.innerText !== h2 ? prefixEl.innerText.trim() : undefined;

      const cardNodes = Array.from(sec.querySelectorAll('div[data-testid*="card"], div[class*="Card"], div[role="group"]'));
      const cards = [];
      const seenCard = new Set();

      for (let i = 0; i < cardNodes.length; i++) {
        const cn = cardNodes[i];
        const title = cn.querySelector('a[title], h3, [data-encore-id="text"]:not([data-encore-id="textSubdued"])')?.innerText?.trim();
        const subtitle = cn.querySelector('p, [data-encore-id="textSubdued"], [class*="Subtitle"]')?.innerText?.trim();
        const img = cn.querySelector('img')?.src;
        const matchDaily = title?.match(/Mix diario \d/i);

        if (title && !seenCard.has(title) && title !== 'Mostrar todos') {
          seenCard.add(title);
          cards.push({
            id: `card-${shelves.length}-${cards.length}`,
            title,
            subtitle: subtitle || '',
            image: img || 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg',
            badge: matchDaily ? matchDaily[0] : undefined,
            badgeColor: matchDaily ? badgeColors[(cards.length) % badgeColors.length] : undefined,
          });
        }
      }

      if (h2 && cards.length > 0) {
        shelves.push({
          id: `shelf-${shelves.length}`,
          title: h2,
          prefix: prefix || (h2.toLowerCase().includes('hecho para') ? 'Hecho para' : undefined),
          subtitle: sub || '',
          hasSeeAll: true,
          cards
        });
      }
    }

    // 5. Currently playing track & player state
    const playPauseBtn = doc.querySelector('[data-testid="control-button-playpause"]');
    const playLabel = playPauseBtn?.getAttribute('aria-label') || '';
    const isPlaying = playLabel.toLowerCase().includes('paus');

    const container = doc.querySelector('.xuYQehnmFtvYl0xKzC6D, [data-testid="now-playing-widget"]');
    let trackName = null;
    let artistName = null;
    let trackImage = null;

    if (container) {
      const links = Array.from(container.querySelectorAll('a'));
      if (links.length >= 1) {
        trackName = links[0]?.textContent?.trim() || null;
        artistName = links.slice(1).map(a => a.textContent?.trim()).join(', ') || null;
      }
      trackImage = container.querySelector('img')?.src || null;
    }

    return {
      user: {
        id: 'e6yr34zzwnf1yybcw49po6nrw',
        display_name: displayName,
        avatarLetter,
        image: userImg
      },
      playback: {
        isPlaying,
        trackName,
        artistName,
        trackImage
      },
      playlists,
      quickAccess,
      shelves
    };
  });

  console.log('--- EXTRACTION COMPLETE ---');
  console.log(`User: ${fullSessionData.user.display_name}`);
  console.log(`Playlists count: ${fullSessionData.playlists.length}`);
  for (const p of fullSessionData.playlists) {
    console.log(` - ${p.name} (${p.description}) [pinned: ${p.is_pinned}]`);
  }
  console.log(`\nQuick Access Cards: ${fullSessionData.quickAccess.length}`);
  for (const q of fullSessionData.quickAccess) {
    console.log(` # ${q.name}`);
  }
  console.log(`\nShelves count: ${fullSessionData.shelves.length}`);
  for (const s of fullSessionData.shelves) {
    console.log(` [SHELF] Prefix: "${s.prefix}" | "${s.title}" (${s.cards.length} cards)`);
  }

  fs.writeFileSync('src/data/liveExtractedSession.json', JSON.stringify(fullSessionData, null, 2), 'utf8');
  console.log('Saved to src/data/liveExtractedSession.json');

  browser.disconnect();
}

main().catch(console.error);
