import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('open.spotify.com'));

  // Ensure Spotify is on the home feed
  if (!spotifyPage.url().endsWith('.com/') && !spotifyPage.url().endsWith('.com/intl-es/')) {
    try {
      await spotifyPage.goto('https://open.spotify.com/', { waitUntil: 'domcontentloaded', timeout: 5000 });
    } catch(e) {}
    await new Promise(r => setTimeout(r, 1500));
  }

  // Scroll thoroughly to render all virtualized sections
  await spotifyPage.evaluate(async () => {
    const scrollContainer = document.querySelector('.main-view-container__scroll-node, [data-overlayscrollbars-viewport]') || window;
    for (let i = 0; i < 10; i++) {
      if (scrollContainer.scrollBy) {
        scrollContainer.scrollBy(0, 1000);
      } else {
        window.scrollBy(0, 1000);
      }
      await new Promise(r => setTimeout(r, 250));
    }
    if (scrollContainer.scrollTo) scrollContainer.scrollTo(0, 0);
    else window.scrollTo(0, 0);
  });

  await new Promise(r => setTimeout(r, 600));

  const realFeed = await spotifyPage.evaluate(() => {
    // 1. Playlists in left sidebar
    const nav = document.querySelector('nav');
    const rows = Array.from(nav ? nav.querySelectorAll('div[role="row"]') : []);
    const playlists = [];
    const seenPl = new Set();

    for (const r of rows) {
      const titleSpan = r.querySelector('span.e-101040-line-clamp, p[id*="listrow-title-"]');
      const subtitleSpan = r.querySelector('span.AYtovynmfPn0KZi10Nel, p[id*="listrow-subtitle-"]');
      const img = r.querySelector('img')?.src;
      const isPinned = r.innerHTML.includes('fijad') || r.innerHTML.includes('Fijada') || r.innerHTML.includes('pin');

      let name = titleSpan?.textContent?.trim();
      let desc = subtitleSpan?.textContent?.trim() || 'Lista';

      if (desc.startsWith('FijadaLista')) {
        desc = desc.replace('FijadaLista', 'Lista');
      }

      if (name && !seenPl.has(name) && name !== 'Tu biblioteca' && name !== 'Crear') {
        seenPl.add(name);
        playlists.push({
          id: name === 'Canciones que te gustan' ? 'liked-songs' : name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
          name,
          description: desc,
          images: [{ url: img || 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg' }],
          is_pinned: isPinned,
          owner: { display_name: desc.includes('•') ? desc.split('•')[1].trim() : 'Jorgeperezvk' },
          tracks: { total: name === 'Canciones que te gustan' ? 23 : 30 }
        });
      }
    }

    // 2. Top Quick Access Grid: Exactly 4 cards as in user screenshot
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

    // 3. Extract all sections and their cards from DOM
    const sections = Array.from(document.querySelectorAll('main section'));
    const shelves = [];

    const badgeColors = ['#00F0FF', '#FFE600', '#FF4632', '#FF64B4', '#1ED760', '#8C52FF'];

    for (const sec of sections) {
      let h2 = sec.querySelector('h2, [data-encore-id="textHeading"]')?.innerText?.trim();
      let sub = sec.querySelector('p, [data-encore-id="textSubdued"]')?.innerText?.trim();
      let prefix = undefined;

      if (!h2) continue;

      // Clean prefix if "Hecho para" or "Más como"
      if (h2.toLowerCase().includes('jorgeperezvk') || sec.innerText.includes('Hecho para')) {
        prefix = 'Hecho para';
        h2 = 'Jorgeperezvk';
      } else if (sec.innerText.includes('Más como')) {
        prefix = 'Más como';
      }

      const cardNodes = Array.from(sec.querySelectorAll('div[data-testid*="card"], div[class*="Card"], div[role="group"]'));
      const cards = [];
      const seenCard = new Set();

      for (const cn of cardNodes) {
        // Spotify card structure: title is often in an anchor or div with aria-label or bold text
        let title = cn.querySelector('a[title]')?.getAttribute('title') ||
                    cn.querySelector('h3, [data-encore-id="text"]:not([data-encore-id="textSubdued"])')?.innerText?.trim();
        let subtitle = cn.querySelector('p, [data-encore-id="textSubdued"], [class*="Subtitle"]')?.innerText?.trim();
        const img = cn.querySelector('img')?.src;

        // If title and subtitle are swapped
        if (subtitle && /Mix diario \d|Radio /i.test(subtitle) && !/Mix diario \d|Radio /i.test(title)) {
          const temp = title;
          title = subtitle;
          subtitle = temp;
        }

        const matchDaily = title?.match(/Mix diario \d/i);
        const matchRadio = title?.match(/Radio\s+(.+)/i);

        if (title && !seenCard.has(title) && title !== 'Mostrar todos') {
          seenCard.add(title);
          cards.push({
            id: `card-${shelves.length}-${cards.length}`,
            title,
            subtitle: subtitle || '',
            image: img || 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg',
            badge: matchDaily ? matchDaily[0] : (title.startsWith('Radio ') ? 'RADIO' : undefined),
            badgeColor: matchDaily ? badgeColors[(cards.length) % badgeColors.length] : (title.startsWith('Radio ') ? '#FF64B4' : undefined),
          });
        }
      }

      if (cards.length > 0) {
        shelves.push({
          id: `shelf-${shelves.length}`,
          title: h2,
          prefix,
          subtitle: sub || '',
          hasSeeAll: true,
          cards
        });
      }
    }

    return {
      user: {
        id: 'e6yr34zzwnf1yybcw49po6nrw',
        display_name: 'Jorgeperezvk',
        avatarLetter: 'J',
        image: null
      },
      playback: {
        isPlaying: false,
        trackName: 'Solita',
        artistName: 'Kenny Die, Neutro Shorty, Dalex, Los Money Makers',
        trackImage: 'https://i.scdn.co/image/ab67616d000011eb54df907e04bde991a198f0d5'
      },
      playlists,
      quickAccess,
      shelves
    };
  });

  console.log(`Extracted ${realFeed.playlists.length} playlists.`);
  console.log(`Extracted ${realFeed.shelves.length} shelves:`);
  for (const s of realFeed.shelves) {
    console.log(` - [${s.prefix || ''}] "${s.title}" (${s.subtitle}) -> ${s.cards.length} cards`);
  }

  fs.writeFileSync('src/data/liveRealSpotifyFeed.json', JSON.stringify(realFeed, null, 2), 'utf8');
  console.log('Saved to src/data/liveRealSpotifyFeed.json');

  browser.disconnect();
}

main().catch(console.error);
