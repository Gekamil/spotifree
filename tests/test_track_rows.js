import puppeteer from 'puppeteer-core';

function rgbToHex(rgbStr) {
  if (!rgbStr) return rgbStr;
  if (rgbStr.startsWith('#')) return rgbStr.toLowerCase();
  const match = rgbStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return rgbStr;
  const r = parseInt(match[1], 10).toString(16).padStart(2, '0');
  const g = parseInt(match[2], 10).toString(16).padStart(2, '0');
  const b = parseInt(match[3], 10).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`.toLowerCase();
}

async function testTrackRows() {
  console.log('='.repeat(80));
  console.log('TESTING PLAYLIST DETAIL VIEW TRACK ROW COLOR PARITY');
  console.log('='.repeat(80));

  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const page = pages.find((p) => p.url().includes('5173'));

  // Use window.__useSpotifyDataStore to inject jl-2026
  await page.evaluate(() => {
    const s = window.__useSpotifyDataStore;
    const current = s.getState().playlists;
    const jlPlaylist = {
      id: 'jl-2026',
      name: 'J+L(2026)',
      description: 'Lista • Lucía :)',
      images: [{ url: 'https://image-cdn-fa.spotifycdn.com/image/ab67706c0000dec5804d43e5cc7f6a6d0ac65ffc' }],
      owner: { display_name: 'Lucía :)', id: 'lucia' },
      tracks: { total: 88 },
    };
    s.setState({ playlists: [jlPlaylist, ...current] });
  });

  await new Promise((r) => setTimeout(r, 500));

  // Click J+L(2026) in the sidebar
  const clickedName = await page.evaluate(() => {
    const aside = document.querySelector('aside');
    const items = Array.from(aside.querySelectorAll('div.cursor-pointer.group'));
    const target = items.find(it => it.querySelector('p')?.innerText === 'J+L(2026)');
    if (target) {
      target.click();
      return 'Clicked J+L(2026)';
    }
    return 'Target not found';
  });
  console.log('Click status:', clickedName);
  await new Promise((r) => setTimeout(r, 600));

  // Inspect detail view track rows
  const detailRows = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('main div.space-y-0\\.5 > div'));
    return rows.slice(0, 5).map((row, idx) => {
      const p = row.querySelector('p.text-sm');
      const artists = row.querySelectorAll('p')[1]?.innerText;
      return {
        idx,
        title: p?.innerText,
        artists,
        rawColor: window.getComputedStyle(p).color,
        hasEqualizer: !!row.querySelector('.animate-bounce'),
        isSelected: row.className.includes('bg-white/10'),
      };
    });
  });

  console.log(`\nFound ${detailRows.length} track rows in detail view.`);
  for (const r of detailRows) {
    console.log(`  [${r.idx}] "${r.title}" by ${r.artists} | color: ${rgbToHex(r.rawColor)} | hasEq: ${r.hasEqualizer} | isSelected: ${r.isSelected}`);
  }

  // 1. Click first track row to select and play it
  console.log('\n--- Clicking Track 0 ("Te Robaré") to play ---');
  await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('main div.space-y-0\\.5 > div'));
    if (rows[0]) rows[0].click();
  });
  await new Promise((r) => setTimeout(r, 500));

  const afterPlayRows = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('main div.space-y-0\\.5 > div'));
    return rows.slice(0, 3).map((row, idx) => {
      const p = row.querySelector('p.text-sm');
      return {
        idx,
        title: p?.innerText,
        rawColor: window.getComputedStyle(p).color,
        hasEqualizer: !!row.querySelector('.animate-bounce'),
        isSelected: row.className.includes('bg-white/10'),
      };
    });
  });

  for (const r of afterPlayRows) {
    console.log(`  [${r.idx}] "${r.title}" | color: ${rgbToHex(r.rawColor)} | hasEq: ${r.hasEqualizer} | isSelected: ${r.isSelected}`);
  }

  const t0Hex = rgbToHex(afterPlayRows[0].rawColor);
  const t1Hex = rgbToHex(afterPlayRows[1].rawColor);

  console.log(`\nCheck: Track 0 turns #1ed760 when playing? ${t0Hex === '#1ed760'} (${t0Hex})`);
  console.log(`Check: Track 0 has equalizer waves? ${afterPlayRows[0].hasEqualizer}`);
  console.log(`Check: Track 1 stays #ffffff? ${t1Hex === '#ffffff'} (${t1Hex})`);

  // 2. Pause playback via bottom bar
  console.log('\n--- Pausing playback via bottom bar ---');
  await page.evaluate(() => {
    const pauseBtn = document.querySelector('footer button[title="Pausa"]');
    if (pauseBtn) pauseBtn.click();
  });
  await new Promise((r) => setTimeout(r, 500));

  const afterPauseRows = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('main div.space-y-0\\.5 > div'));
    return rows.slice(0, 3).map((row, idx) => {
      const p = row.querySelector('p.text-sm');
      return {
        idx,
        title: p?.innerText,
        rawColor: window.getComputedStyle(p).color,
        hasEqualizer: !!row.querySelector('.animate-bounce'),
        isSelected: row.className.includes('bg-white/10'),
      };
    });
  });

  for (const r of afterPauseRows) {
    console.log(`  [${r.idx}] "${r.title}" | color: ${rgbToHex(r.rawColor)} | hasEq: ${r.hasEqualizer} | isSelected: ${r.isSelected}`);
  }

  const t0PausedHex = rgbToHex(afterPauseRows[0].rawColor);
  console.log(`\nCheck: Track 0 reverts to #ffffff when paused? ${t0PausedHex === '#ffffff'} (${t0PausedHex})`);
  console.log(`Check: Track 0 removes equalizer waves when paused? ${afterPauseRows[0].hasEqualizer === false}`);
  console.log(`Check: Track 0 remains selected (bg-white/10)? ${afterPauseRows[0].isSelected === true}`);

  browser.disconnect();
}

testTrackRows().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
