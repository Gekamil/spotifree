import puppeteer from 'puppeteer-core';
import fs from 'fs';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('spotify.com'));
  if (!spotifyPage) return;

  const targetPlaylists = [
    'Canciones que te gustan',
    'My top tracks playlist',
    'J+L(2026)',
    'Romeo & Prince',
    'Radio Prince Royce',
    'Tus canciones más escuchadas en 2025',
    'Random',
    'Spidey',
    '♡ nuestro amor ♡ (2024-25)',
    'Romeo Santos'
  ];

  const results = {};

  for (const plName of targetPlaylists) {
    console.log(`Extracting: ${plName}`);
    // Click on row
    const clicked = await spotifyPage.evaluate((name) => {
      const rows = Array.from(document.querySelectorAll('nav div[role="row"]'));
      const row = rows.find(r => r.innerText.includes(name));
      if (row) {
        const btn = row.querySelector('[role="button"]') || row;
        btn.click();
        return true;
      }
      return false;
    }, plName);

    if (!clicked) {
      console.log(`Could not find row for ${plName}`);
      continue;
    }

    // Wait for view to update
    await new Promise(r => setTimeout(r, 1500));

    // Extract tracks
    const playlistData = await spotifyPage.evaluate((name) => {
      // Find main scrollable
      const allDivs = Array.from(document.querySelectorAll('*'));
      const scrollable = allDivs.find(d => {
        const s = window.getComputedStyle(d);
        return (s.overflowY === 'auto' || s.overflowY === 'scroll') && d.scrollHeight > 600;
      });

      const headerTitle = document.querySelector('h1')?.innerText?.trim() || name;
      const headerDesc = document.querySelector('[data-encore-id="textSubTitle"], div[data-testid="playlist-description"]')?.innerText?.trim();
      const headerImg = document.querySelector('div[data-testid="playlist-image"] img, img[data-testid="entity-image"]')?.src;

      const collected = new Map();

      function grab() {
        const rows = Array.from(document.querySelectorAll('div[data-testid="tracklist-row"]'));
        for (const r of rows) {
          const titleEl = r.querySelector('[data-testid="internal-track-link"], a[href*="/track/"]');
          const title = titleEl?.innerText?.trim() || r.querySelector('[data-encore-id="text"]:not([data-encore-id="textSubdued"])')?.innerText?.trim();
          const trackHref = titleEl?.getAttribute('href') || '';
          const trackIdMatch = trackHref.match(/\/track\/([a-zA-Z0-9]+)/);
          const trackId = trackIdMatch ? trackIdMatch[1] : `${name}-${collected.size + 1}`;

          const artistEls = Array.from(r.querySelectorAll('a[href*="/artist/"]'));
          const artists = artistEls.length > 0
            ? artistEls.map(a => ({ id: a.getAttribute('href')?.split('/artist/')[1] || 'artist', name: a.innerText.trim() }))
            : [{ id: 'artist-1', name: 'Various Artists' }];

          const albumEl = r.querySelector('a[href*="/album/"]');
          const albumName = albumEl?.innerText?.trim() || title;
          const albumImg = r.querySelector('img')?.src || '';

          // duration from last cell
          const lastCell = r.querySelector('div[role="gridcell"]:last-child');
          const allText = lastCell ? Array.from(lastCell.querySelectorAll('*')).map(e => e.innerText.trim()) : [];
          const durMatch = allText.find(t => /^\d+:\d+$/.test(t));
          let duration_ms = 180000;
          if (durMatch) {
            const [m, s] = durMatch.split(':').map(Number);
            duration_ms = (m * 60 + s) * 1000;
          }

          // date added from cell 4
          const cell4 = r.querySelector('div[role="gridcell"]:nth-child(4) span');
          const added_at = cell4?.innerText?.trim() || 'Reciente';

          if (title && !collected.has(title)) {
            collected.set(title, {
              id: trackId,
              name: title,
              duration_ms,
              preview_url: null,
              album: {
                id: `album-${trackId}`,
                name: albumName,
                images: albumImg ? [{ url: albumImg, width: 300, height: 300 }] : []
              },
              artists,
              added_at
            });
          }
        }
      }

      grab();
      // small scroll
      if (scrollable) {
        scrollable.scrollTop = 400;
      }
      return {
        headerTitle,
        headerDesc,
        headerImg,
        tracks: Array.from(collected.values())
      };
    }, plName);

    console.log(`Extracted ${playlistData.tracks.length} tracks for ${plName}`);
    results[plName] = playlistData;
    await new Promise(r => setTimeout(r, 600));
  }

  // Navigate back home
  await spotifyPage.evaluate(() => {
    const homeBtn = document.querySelector('button[aria-label="Inicio"], a[href="/"]');
    if (homeBtn) homeBtn.click();
  });

  fs.writeFileSync('src/data/allUserExtractedTracks.json', JSON.stringify(results, null, 2), 'utf-8');
  console.log('Saved all extracted tracks to src/data/allUserExtractedTracks.json');
  browser.disconnect();
}

main().catch(console.error);
