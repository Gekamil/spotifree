import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

async function extractAllLikedTracks() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('open.spotify.com'));
  if (!spotifyPage) {
    browser.disconnect();
    return;
  }

  await spotifyPage.goto('https://open.spotify.com/collection/tracks');
  await new Promise(r => setTimeout(r, 2000));

  const allTracksMap = new Map();

  for (let scroll = 0; scroll < 6; scroll++) {
    const batch = await spotifyPage.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('[data-testid="tracklist-row"]'));
      return rows.map((r, idx) => {
        const titleLink = r.querySelector('a[href*="/track/"]');
        const trackUri = titleLink ? titleLink.getAttribute('href')?.split('/track/')?.[1]?.split('?')?.[0] : null;
        const title = titleLink?.textContent?.trim() || r.querySelector('[data-encore-id="text"]')?.textContent?.trim() || `Canción`;

        const artistLinks = Array.from(r.querySelectorAll('a[href*="/artist/"]'));
        const artists = artistLinks.map((a, aIdx) => ({
          id: a.getAttribute('href')?.split('/artist/')?.[1]?.split('?')?.[0] || `art-${aIdx}`,
          name: a.textContent?.trim() || 'Artista'
        }));

        const albumLink = r.querySelector('a[href*="/album/"]');
        const albumName = albumLink?.textContent?.trim() || title;
        const albumId = albumLink?.getAttribute('href')?.split('/album/')?.[1]?.split('?')?.[0] || `alb-${idx}`;

        const img = r.querySelector('img')?.src || 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg';

        const durationText = r.querySelector('[data-testid="tracklist-row-duration"], .standalone-ellipsis-one-line:last-child')?.textContent?.trim();
        let durationMs = 180000;
        if (durationText && durationText.includes(':')) {
          const parts = durationText.split(':').map(Number);
          if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            durationMs = (parts[0] * 60 + parts[1]) * 1000;
          }
        }

        return {
          id: trackUri || `liked-${title}`,
          name: title,
          artists: artists.length > 0 ? artists : [{ id: 'art-unknown', name: 'Desconocido' }],
          album: {
            id: albumId,
            name: albumName,
            images: [{ url: img }]
          },
          duration_ms: durationMs,
          added_at: 'Hace 3 días',
          is_liked: true
        };
      });
    });

    for (const t of batch) {
      if (!allTracksMap.has(t.id)) {
        allTracksMap.set(t.id, t);
      }
    }

    await spotifyPage.evaluate(() => {
      window.scrollBy(0, 400);
    });
    await new Promise(r => setTimeout(r, 600));
  }

  const tracks = Array.from(allTracksMap.values());
  console.log(`Extracted total ${tracks.length} unique liked tracks:`);
  for (const t of tracks) {
    console.log(`- ${t.name} | ${t.artists.map(a => a.name).join(', ')} | ${t.id}`);
  }

  // Save to src/data/realLikedSongs.json
  fs.writeFileSync('src/data/realLikedSongs.json', JSON.stringify(tracks, null, 2));

  // Reset page to home
  await spotifyPage.goto('https://open.spotify.com/');

  browser.disconnect();
}

extractAllLikedTracks().catch(console.error);
