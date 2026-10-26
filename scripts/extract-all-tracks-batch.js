import puppeteer from 'puppeteer-core';
import fs from 'fs';

const playlists = [
  { id: 'liked-songs', name: 'Canciones que te gustan', path: '/collection/tracks', color: '#5018F0' },
  { id: 'my-top-tracks', name: 'My top tracks playlist', path: '/playlist/4Jf0fa5p0ajOnSriA9cYGS', color: '#2f4347' },
  { id: 'jl-2026', name: 'J+L(2026)', path: '/playlist/7b3MrCWtettvBKlfBSdorn', color: '#544e47' },
  { id: 'romeo-prince', name: 'Romeo & Prince', path: '/playlist/43GWp9FbN9nHihudedyVQM', color: '#533c30' },
  { id: 'radio-prince-royce', name: 'Radio Prince Royce', path: '/playlist/37i9dQZF1E4oYmauGa1rTt', color: '#4a422b' },
  { id: 'tus-canciones-mas-escuchadas-2025', name: 'Tus canciones más escuchadas en 2025', path: '/playlist/37i9dQZEVXcXHWVVT0lfDq', color: '#31445b' },
  { id: 'random', name: 'Random', path: '/playlist/3x7gz85amxEplGx7LQxE7Z', color: '#453229' },
  { id: 'spidey', name: 'Spidey', path: '/playlist/4H4hFDhvUcfzVHpXLJKFyH', color: '#8b1d24' },
  { id: 'nuestro-amor', name: '♡ nuestro amor ♡ (2024-25)', path: '/playlist/7HsL4sBaR3dJMa0UJ5e4zG', color: '#583642' },
  { id: 'el-nuevo-urbano', name: 'el nuevo urbano', path: '/playlist/37i9dQZF1DWZdsS73T1ogG', color: '#704838' },
  { id: 'miticas', name: 'míticas', path: '/playlist/37i9dQZF1DX2EiUAL7Wdfc', color: '#8b3a1a' },
  { id: 'zizi', name: 'ZIZI', path: '/intl-es/album/4f0YTBqSbvM1iJpuY9r3yQ', color: '#2e4a52' },
  { id: 'dm-1', name: 'Mix diario 1', path: '/playlist/37i9dQZF1E35QYVMBRlDph', color: '#00F0FF' },
  { id: 'radio-1', name: 'Radio Aventura', path: '/playlist/37i9dQZF1E4rIBRtvqoJh8', color: '#FF64B4' }
];

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const p = pages.find(p => p.url().includes('spotify.com'));
  if (!p) return;

  const results = {};

  for (const pl of playlists) {
    try {
      console.log(`Processing ${pl.name}...`);
      await p.goto(`https://open.spotify.com${pl.path}`, { waitUntil: 'domcontentloaded', timeout: 12000 });
      try {
        await p.waitForSelector('div[data-testid="tracklist-row"]', { timeout: 7000 });
      } catch (e) {
        console.log(`Timeout waiting for tracklist-row in ${pl.name}`);
      }

      const extracted = await p.evaluate((plId, plName, plColor) => {
        const headerTitle = (document.querySelector('h1, [data-encore-id="textTitle"]')?.textContent || plName).trim();
        const headerDesc = (document.querySelector('[data-encore-id="textSubTitle"], div[data-testid="playlist-description"]')?.textContent || '').trim();
        const headerImg = document.querySelector('div[data-testid="playlist-image"] img, img[data-testid="entity-image"]')?.src || '';

        const scrollable = document.querySelector('main div[data-overlayscrollbars-viewport]') ||
                           Array.from(document.querySelectorAll('*')).find(d => {
                             const s = window.getComputedStyle(d);
                             return (s.overflowY === 'auto' || s.overflowY === 'scroll') && d.scrollHeight > 600;
                           });

        const collected = new Map();

        function grab() {
          const rows = Array.from(document.querySelectorAll('div[data-testid="tracklist-row"]'));
          for (const r of rows) {
            const cell2 = r.querySelector('div[role="gridcell"]:nth-child(2)');
            const titleLink = cell2?.querySelector('a[data-testid="internal-track-link"], a[href*="/track/"]');
            const title = (titleLink?.textContent || cell2?.querySelector('div[dir="auto"]')?.textContent || '').trim();
            if (!title) continue;

            const href = titleLink?.getAttribute('href') || '';
            const idMatch = href.match(/\/track\/([a-zA-Z0-9]+)/);
            const id = idMatch ? idMatch[1] : `${plId}-${collected.size + 1}`;

            const artists = Array.from(cell2?.querySelectorAll('a[href*="/artist/"]') || []).map(a => ({
              id: a.getAttribute('href')?.split('/artist/')[1] || 'artist',
              name: (a.textContent || '').trim()
            }));
            if (artists.length === 0) {
              artists.push({ id: 'artist-1', name: 'Artista' });
            }

            const cell3 = r.querySelector('div[role="gridcell"]:nth-child(3)');
            const albumName = (cell3?.querySelector('a[href*="/album/"]')?.textContent || cell3?.textContent || title).trim();

            const lastCell = r.querySelector('div[role="gridcell"]:last-child');
            const allText = lastCell ? Array.from(lastCell.querySelectorAll('*')).map(e => (e.textContent || '').trim()) : [];
            const dur = allText.find(t => /^\d+:\d+$/.test(t)) || '3:00';
            const [m, s] = dur.split(':').map(Number);
            const duration_ms = ((m || 3) * 60 + (s || 0)) * 1000;

            const img = cell2?.querySelector('img')?.src || headerImg;
            const dateCell = r.querySelector('div[role="gridcell"]:nth-child(4) span');
            const added_at = (dateCell?.textContent || 'Reciente').trim();

            if (!collected.has(id)) {
              collected.set(id, {
                id,
                name: title,
                duration_ms,
                preview_url: null,
                album: {
                  id: `album-${id}`,
                  name: albumName,
                  images: img ? [{ url: img, width: 300, height: 300 }] : []
                },
                artists,
                added_at
              });
            }
          }
        }

        grab();
        if (scrollable) {
          scrollable.scrollTop = 450;
        }
        grab();

        return {
          id: plId,
          name: headerTitle,
          description: headerDesc,
          image: headerImg,
          color: plColor,
          total: collected.size,
          tracks: Array.from(collected.values())
        };
      }, pl.id, pl.name, pl.color);

      console.log(`Extracted ${extracted.tracks.length} tracks for ${pl.name}`);
      results[pl.id] = extracted;
    } catch (err) {
      console.error(`Error on ${pl.name}:`, err.message);
    }
  }

  // Navigate back home
  try {
    await p.goto('https://open.spotify.com/', { waitUntil: 'domcontentloaded' });
  } catch (e) {}

  fs.writeFileSync('src/data/allRealPlaylistTracks.json', JSON.stringify(results, null, 2), 'utf-8');
  console.log('Saved all tracks to src/data/allRealPlaylistTracks.json');
  browser.disconnect();
}

main().catch(console.error);
