import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const playlistsToExtract = [
  { id: 'liked-songs', name: 'Canciones que te gustan', url: 'https://open.spotify.com/collection/tracks' },
  { id: 'my-top-tracks', name: 'My top tracks playlist', url: 'https://open.spotify.com/playlist/4Jf0fa5p0ajOnSriA9cYGS' },
  { id: 'jl-2026', name: 'J+L(2026)', url: 'https://open.spotify.com/playlist/7b3MrCWtettvBKlfBSdorn' },
  { id: 'romeo-prince', name: 'Romeo & Prince', url: 'https://open.spotify.com/playlist/43GWp9FbN9nHihudedyVQM' },
  { id: 'radio-prince-royce', name: 'Radio Prince Royce', url: 'https://open.spotify.com/playlist/37i9dQZF1E4oYmauGa1rTt' },
  { id: 'tus-canciones-mas-escuchadas-2025', name: 'Tus canciones más escuchadas en 2025', url: 'https://open.spotify.com/playlist/37i9dQZEVXcXHWVVT0lfDq' },
  { id: 'random', name: 'Random', url: 'https://open.spotify.com/playlist/3x7gz85amxEplGx7LQxE7Z' },
  { id: 'spidey', name: 'Spidey', url: 'https://open.spotify.com/playlist/4H4hFDhvUcfzVHpXLJKFyH' },
  { id: 'nuestro-amor', name: '♡ nuestro amor ♡ (2024-25)', url: 'https://open.spotify.com/playlist/7HsL4sBaR3dJMa0UJ5e4zG' },
  { id: 'el-nuevo-urbano', name: 'el nuevo urbano', url: 'https://open.spotify.com/playlist/37i9dQZF1DWZdsS73T1ogG' },
  { id: 'miticas', name: 'míticas', url: 'https://open.spotify.com/playlist/37i9dQZF1DX2EiUAL7Wdfc' },
  { id: 'dm-1', name: 'Mix diario 1', url: 'https://open.spotify.com/playlist/37i9dQZF1E35QYVMBRlDph' },
  { id: 'radio-1', name: 'Radio Aventura', url: 'https://open.spotify.com/playlist/37i9dQZF1E4rIBRtvqoJh8' }
];

async function extractPlaylist(page, pl) {
  try {
    console.log(`Extracting: ${pl.name}...`);
    await page.goto(pl.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await new Promise(r => setTimeout(r, 2000));

    const data = await page.evaluate(() => {
      // Get header info if possible
      const headerTitle = document.querySelector('h1, [data-encore-id="textTitle"]')?.innerText?.trim();
      const headerDesc = document.querySelector('[data-encore-id="textSubTitle"], div[data-testid="playlist-description"]')?.innerText?.trim();
      const headerImg = document.querySelector('div[data-testid="playlist-image"] img, img[data-testid="entity-image"]')?.src;

      const rows = Array.from(document.querySelectorAll('div[data-testid="tracklist-row"]'));
      const items = rows.map((r, index) => {
        const titleEl = r.querySelector('[data-testid="internal-track-link"], a[href*="/track/"]');
        const title = titleEl?.innerText?.trim() || r.querySelector('[data-encore-id="text"]:not([data-encore-id="textSubdued"])')?.innerText?.trim();
        const trackHref = titleEl?.getAttribute('href') || '';
        const trackIdMatch = trackHref.match(/\/track\/([a-zA-Z0-9]+)/);
        const trackId = trackIdMatch ? trackIdMatch[1] : `track-${index + 1}`;

        const artistEls = Array.from(r.querySelectorAll('a[href*="/artist/"]'));
        const artists = artistEls.length > 0 ? artistEls.map(a => ({
          id: a.getAttribute('href')?.split('/artist/')[1] || 'artist',
          name: a.innerText.trim()
        })) : [{ id: 'artist-1', name: 'Various Artists' }];

        const albumEl = r.querySelector('a[href*="/album/"]');
        const albumName = albumEl?.innerText?.trim() || title;
        const albumImg = r.querySelector('img')?.src || '';

        // duration
        const durationText = r.querySelector('div[data-encore-id="text"]:last-child, span[data-encore-id="text"]:last-child')?.innerText?.trim();
        let duration_ms = 180000;
        if (durationText && durationText.includes(':')) {
          const parts = durationText.split(':').map(Number);
          if (parts.length === 2) {
            duration_ms = (parts[0] * 60 + parts[1]) * 1000;
          }
        }

        // date added
        const addedEl = r.querySelector('div[role="gridcell"]:nth-child(4) span');
        const added_at = addedEl?.innerText?.trim() || 'Reciente';

        return {
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
        };
      }).filter(t => t.name);

      return {
        headerTitle,
        headerDesc,
        headerImg,
        tracks: items
      };
    });

    console.log(`Extracted ${data.tracks.length} tracks for ${pl.name}`);
    return { ...pl, ...data };
  } catch (err) {
    console.error(`Error extracting ${pl.name}:`, err.message);
    return null;
  }
}

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('spotify.com'));
  if (!spotifyPage) {
    console.error('Spotify page not found');
    browser.disconnect();
    return;
  }

  const results = {};
  for (const pl of playlistsToExtract) {
    const res = await extractPlaylist(spotifyPage, pl);
    if (res && res.tracks.length > 0) {
      results[pl.id] = res;
    }
    await new Promise(r => setTimeout(r, 600));
  }

  // Navigate back to home
  await spotifyPage.goto('https://open.spotify.com/', { waitUntil: 'domcontentloaded' });

  // Save to disk
  const outPath = path.resolve('src/data/realPlaylistsTracks.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf-8');
  console.log('Saved all real playlist tracks to', outPath);

  browser.disconnect();
}

main().catch(console.error);
