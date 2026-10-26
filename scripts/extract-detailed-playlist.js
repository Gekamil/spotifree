import puppeteer from 'puppeteer-core';
import fs from 'fs';

async function extractDetailedPlaylist() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const sp = pages.find(p => p.url().includes('open.spotify.com'));
  if (!sp) {
    console.log('No Spotify tab');
    browser.disconnect();
    return;
  }

  const details = await sp.evaluate(() => {
    // Header section
    const headerEl = document.querySelector('section[data-testid="playlist-page"] header, div[data-testid="playlist-page"] > div:first-child');
    
    // Action bar SVGs
    const actionButtons = Array.from(document.querySelectorAll('[data-testid="action-bar-row"] button, [data-testid="action-bar-row"] > div')).map(btn => ({
      ariaLabel: btn.getAttribute('aria-label') || btn.innerText,
      svgViewBox: btn.querySelector('svg')?.getAttribute('viewBox'),
      svgInner: btn.querySelector('svg')?.innerHTML,
      className: btn.className
    }));

    // Action bar container styles
    const actionBar = document.querySelector('[data-testid="action-bar-row"]');
    const actionBarComputed = actionBar ? window.getComputedStyle(actionBar) : null;

    // Track table header
    const tableHeader = document.querySelector('[data-testid="playlist-tracklist"] [role="row"], [role="columnheader"]')?.parentElement?.innerText;

    // Column structure
    const headerCols = Array.from(document.querySelectorAll('[role="columnheader"]')).map(col => ({
      text: col.innerText.trim(),
      style: col.getAttribute('style')
    }));

    // Find all track items with exact info
    const trackRows = Array.from(document.querySelectorAll('[data-testid="tracklist-row"]')).map((row, idx) => {
      const titleLink = row.querySelector('[data-testid="internal-track-link"]');
      const artistLinks = Array.from(row.querySelectorAll('a[href*="/artist/"]')).map(a => a.innerText);
      const albumLink = row.querySelector('a[href*="/album/"]');
      const img = row.querySelector('img')?.src;
      const durationDiv = row.querySelector('div[data-encore-id="text"]:last-child');
      const addedBy = Array.from(row.querySelectorAll('a[href*="/user/"]')).map(a => a.innerText);
      const cells = Array.from(row.children).map(c => c.innerText.trim().replace(/\n+/g, ' '));

      return {
        index: idx + 1,
        title: titleLink?.innerText || '',
        artists: artistLinks,
        album: albumLink?.innerText || '',
        img,
        cells
      };
    });

    // Background gradient / dominant color
    const contentContainer = document.querySelector('[data-testid="playlist-page"]');
    const colorBg = document.querySelector('div[style*="background-color"]')?.style.backgroundColor;

    return {
      actionButtons,
      headerCols,
      tableHeader,
      trackCount: trackRows.length,
      tracks: trackRows,
      colorBg
    };
  });

  fs.writeFileSync('src/data/playlistDetailsExtracted.json', JSON.stringify(details, null, 2));
  console.log('Action buttons count:', details.actionButtons.length);
  console.log('Tracks count:', details.tracks.length);
  console.log('Header cols:', details.headerCols);
  browser.disconnect();
}

extractDetailedPlaylist().catch(console.error);
