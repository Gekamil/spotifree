import puppeteer from 'puppeteer-core';
import fs from 'fs';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const p = pages.find(p => p.url().includes('spotify.com'));
  if (p) {
    const rows = await p.evaluate(() => {
      return Array.from(document.querySelectorAll('div[data-testid="tracklist-row"]')).map((r, idx) => {
        const cell2 = r.querySelector('div[role="gridcell"]:nth-child(2)');
        const title = (cell2?.querySelector('div[dir="auto"], a[href*="/track/"]')?.textContent || '').trim();
        const artists = Array.from(cell2?.querySelectorAll('a[href*="/artist/"]') || []).map(a => (a.textContent || '').trim());
        const album = (r.querySelector('div[role="gridcell"]:nth-child(3)')?.textContent || '').trim();
        const lastCell = r.querySelector('div[role="gridcell"]:last-child');
        const allText = lastCell ? Array.from(lastCell.querySelectorAll('*')).map(e => (e.textContent || '').trim()) : [];
        const dur = allText.find(t => /^\d+:\d+$/.test(t)) || '3:30';
        const [m, s] = dur.split(':').map(Number);
        const duration_ms = ((m || 3) * 60 + (s || 30)) * 1000;
        const img = cell2?.querySelector('img')?.src || '';
        const dateCell = r.querySelector('div[role="gridcell"]:nth-child(4) span');
        const added_at = (dateCell?.textContent || 'Reciente').trim();

        return {
          id: `romeo-${idx + 1}`,
          name: title,
          duration_ms,
          preview_url: null,
          album: {
            id: `album-romeo-${idx + 1}`,
            name: album,
            images: img ? [{ url: img, width: 300, height: 300 }] : []
          },
          artists: artists.map((name, i) => ({ id: `artist-${i}`, name })),
          added_at
        };
      });
    });

    console.log('Romeo tracks count:', rows.length);
    console.log(JSON.stringify(rows.slice(0, 5), null, 2));

    // Update src/data/allRealPlaylistTracks.json with Romeo & Prince
    const data = JSON.parse(fs.readFileSync('src/data/allRealPlaylistTracks.json', 'utf-8'));
    data['romeo-prince'] = {
      id: 'romeo-prince',
      name: 'Romeo & Prince',
      description: 'Lista • Jorgeperezvk',
      image: 'https://image-cdn-ak.spotifycdn.com/image/ab67706c0000dec5fd28fd6f3ec5b7002c5649d7',
      color: '#533c30',
      total: rows.length,
      tracks: rows
    };
    fs.writeFileSync('src/data/allRealPlaylistTracks.json', JSON.stringify(data, null, 2), 'utf-8');
    console.log('Updated romeo-prince in allRealPlaylistTracks.json');
  }
  browser.disconnect();
}

main().catch(console.error);
