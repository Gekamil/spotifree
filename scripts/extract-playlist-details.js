import puppeteer from 'puppeteer-core';
import fs from 'fs';

const playlists = [
  { id: 'liked-songs', name: 'Canciones que te gustan', path: '/collection/tracks' },
  { id: 'my-top-tracks', name: 'My top tracks playlist', path: '/playlist/4Jf0fa5p0ajOnSriA9cYGS' },
  { id: 'jl-2026', name: 'J+L(2026)', path: '/playlist/7b3MrCWtettvBKlfBSdorn' },
  { id: 'romeo-prince', name: 'Romeo & Prince', path: '/playlist/43GWp9FbN9nHihudedyVQM' },
  { id: 'radio-prince-royce', name: 'Radio Prince Royce', path: '/playlist/37i9dQZF1E4oYmauGa1rTt' },
  { id: 'tus-canciones-mas-escuchadas-2025', name: 'Tus canciones más escuchadas en 2025', path: '/playlist/37i9dQZEVXcXHWVVT0lfDq' },
  { id: 'random', name: 'Random', path: '/playlist/3x7gz85amxEplGx7LQxE7Z' },
  { id: 'spidey', name: 'Spidey', path: '/playlist/4H4hFDhvUcfzVHpXLJKFyH' },
  { id: 'nuestro-amor', name: '♡ nuestro amor ♡ (2024-25)', path: '/playlist/7HsL4sBaR3dJMa0UJ5e4zG' },
  { id: 'el-nuevo-urbano', name: 'el nuevo urbano', path: '/playlist/37i9dQZF1DWZdsS73T1ogG' },
  { id: 'miticas', name: 'míticas', path: '/playlist/37i9dQZF1DX2EiUAL7Wdfc' },
  { id: 'dm-1', name: 'Mix diario 1', path: '/playlist/37i9dQZF1E35QYVMBRlDph' },
  { id: 'radio-1', name: 'Radio Aventura', path: '/playlist/37i9dQZF1E4rIBRtvqoJh8' }
];

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const p = pages.find(p => p.url().includes('spotify.com'));
  if (!p) return;

  const results = {};

  for (const pl of playlists) {
    console.log(`Navigating to ${pl.name} (${pl.path})...`);
    await p.evaluate((targetPath) => {
      const link = document.createElement('a');
      link.href = targetPath;
      document.body.appendChild(link);
      link.click();
      link.remove();
    }, pl.path);

    await new Promise(r => setTimeout(r, 2200));

    const extracted = await p.evaluate((plId, plName) => {
      const headerTitle = document.querySelector('h1, [data-encore-id="textTitle"]')?.innerText?.trim() || plName;
      const headerDesc = document.querySelector('[data-encore-id="textSubTitle"], div[data-testid="playlist-description"]')?.innerText?.trim() || '';
      const headerImg = document.querySelector('div[data-testid="playlist-image"] img, img[data-testid="entity-image"]')?.src || '';

      const rows = Array.from(document.querySelectorAll('div[data-testid="tracklist-row"]'));
      const tracks = rows.map((r, idx) => {
        const titleEl = r.querySelector('[data-testid="internal-track-link"], a[href*="/track/"]');
        const title = (titleEl?.textContent || r.querySelector('[data-encore-id="text"]:not([data-encore-id="textSubdued"])')?.textContent || '').trim();
        const href = titleEl?.getAttribute('href') || '';
        const idMatch = href.match(/\/track\/([a-zA-Z0-9]+)/);
        const id = idMatch ? idMatch[1] : `${plId}-track-${idx + 1}`;

        const artistEls = Array.from(r.querySelectorAll('a[href*="/artist/"]'));
        const artists = artistEls.length > 0
          ? artistEls.map(a => ({ id: a.getAttribute('href')?.split('/artist/')[1] || 'artist', name: (a.textContent || '').trim() }))
          : [{ id: 'artist-1', name: 'Artista' }];

        const albumEl = r.querySelector('a[href*="/album/"]');
        const albumName = (albumEl?.textContent || title).trim();
        const albumImg = r.querySelector('img')?.src || '';

        // duration
        const lastCell = r.querySelector('div[role="gridcell"]:last-child');
        const allText = lastCell ? Array.from(lastCell.querySelectorAll('*')).map(e => (e.textContent || '').trim()) : [];
        const durMatch = allText.find(t => /^\d+:\d+$/.test(t));
        let duration_ms = 180000;
        if (durMatch) {
          const [m, s] = durMatch.split(':').map(Number);
          duration_ms = (m * 60 + s) * 1000;
        }

        // date
        const dateCell = r.querySelector('div[role="gridcell"]:nth-child(4) span');
        const added_at = (dateCell?.textContent || 'Reciente').trim();

        return {
          id,
          name: title,
          duration_ms,
          preview_url: null,
          album: {
            id: `album-${id}`,
            name: albumName,
            images: albumImg ? [{ url: albumImg, width: 300, height: 300 }] : []
          },
          artists,
          added_at
        };
      }).filter(t => t.name && t.name.length > 0);

      return {
        id: plId,
        name: headerTitle,
        description: headerDesc,
        image: headerImg,
        total: tracks.length,
        tracks
      };
    }, pl.id, pl.name);

    console.log(`Extracted ${extracted.tracks.length} tracks for ${pl.name}`);
    results[pl.id] = extracted;
    await new Promise(r => setTimeout(r, 600));
  }

  // Navigate back home
  await p.evaluate(() => {
    const link = document.createElement('a');
    link.href = '/';
    document.body.appendChild(link);
    link.click();
    link.remove();
  });

  fs.writeFileSync('src/data/allRealPlaylistTracks.json', JSON.stringify(results, null, 2), 'utf-8');
  console.log('Successfully saved src/data/allRealPlaylistTracks.json');
  browser.disconnect();
}

main().catch(console.error);
