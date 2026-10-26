import puppeteer from 'puppeteer-core';
import fs from 'fs';

async function inspectPlaylist() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const sp = pages.find(p => p.url().includes('open.spotify.com'));
  if (!sp) {
    console.log('No Spotify tab found');
    browser.disconnect();
    return;
  }

  const playlistData = await sp.evaluate(() => {
    const title = document.querySelector('h1')?.innerText || '';
    const coverImg = document.querySelector('img[data-testid="playlist-image"], [data-testid="entity-image"] img, img')?.src || '';
    
    // Find metadata elements in header
    const type = document.querySelector('span[data-testid="entityTitle"]')?.parentElement?.previousElementSibling?.innerText || 'Playlist';
    
    // Creator info
    const creators = Array.from(document.querySelectorAll('a[data-testid="creator-link"], a[href*="/user/"]')).map(a => a.innerText.trim());
    
    // Header text
    const fullHeaderText = document.querySelector('[data-testid="playlist-page"]')?.innerText || '';
    
    // Track count, save count, duration
    const allSpans = Array.from(document.querySelectorAll('span')).map(s => s.innerText.trim()).filter(Boolean);

    // Track rows
    const trackRows = Array.from(document.querySelectorAll('[data-testid="tracklist-row"]')).map((row, index) => {
      const trackName = row.querySelector('[data-testid="internal-track-link"], div[dir="auto"]')?.innerText;
      const artists = Array.from(row.querySelectorAll('a[href*="/artist/"]')).map(a => a.innerText);
      const album = row.querySelector('a[href*="/album/"]')?.innerText;
      const duration = row.querySelector('div[data-encore-id="text"]:last-child, [class*="playbackDuration"]')?.innerText;
      const addedDate = Array.from(row.querySelectorAll('span')).find(s => s.innerText.match(/hace|días|horas|meses|semanas|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre/i))?.innerText;
      const img = row.querySelector('img')?.src;
      return { index: index + 1, trackName, artists, album, duration, addedDate, img };
    });

    // Action buttons in playlist header
    const actionButtons = Array.from(document.querySelectorAll('[data-testid="action-bar-row"] button, [data-testid="action-bar-row"] div[role="button"]')).map(b => ({
      ariaLabel: b.getAttribute('aria-label'),
      title: b.getAttribute('title'),
      text: b.innerText,
      svg: b.querySelector('svg')?.innerHTML?.slice(0, 50)
    }));

    return {
      title,
      coverImg,
      creators,
      trackCount: trackRows.length,
      sampleTracks: trackRows.slice(0, 15),
      actionButtons,
      rawHeader: fullHeaderText.slice(0, 1000)
    };
  });

  console.log('Playlist Data extracted:');
  console.log('Title:', playlistData.title);
  console.log('Creators:', playlistData.creators);
  console.log('Tracks count:', playlistData.trackCount);
  console.log('First 3 tracks:', playlistData.sampleTracks.slice(0, 3));
  console.log('Action buttons:', playlistData.actionButtons);
  console.log('Raw header preview:', playlistData.rawHeader.slice(0, 300));

  fs.writeFileSync('src/data/realActivePlaylist.json', JSON.stringify(playlistData, null, 2));
  console.log('Saved to src/data/realActivePlaylist.json');

  browser.disconnect();
}

inspectPlaylist().catch(console.error);
