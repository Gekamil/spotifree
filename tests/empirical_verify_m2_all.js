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

async function runAudit() {
  console.log('='.repeat(80));
  console.log('EMPIRICAL VERIFICATION AUDIT — MILESTONE 2 (TYPOGRAPHY & PLAYBACK PARITY)');
  console.log('='.repeat(80));

  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  let page = pages.find((p) => p.url().includes('127.0.0.1:5173') || p.url().includes('localhost:5173'));

  if (!page) {
    page = await browser.newPage();
    await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle2' });
  } else {
    await page.bringToFront();
  }

  await page.waitForSelector('aside', { timeout: 5000 });
  await new Promise((r) => setTimeout(r, 500));

  const results = [];
  function assertCheck(id, description, passed, actual, expected, severity = 'FAIL') {
    results.push({ id, description, passed, actual, expected, severity });
    const mark = passed ? '✔ PASS' : `✖ ${severity}`;
    console.log(`[${mark}] [${id}] ${description}`);
    console.log(`       Expected: ${expected}`);
    console.log(`       Actual:   ${actual}`);
  }

  // Step 1: Ensure authenticated state and data loaded
  const initResult = await page.evaluate(async () => {
    const store = window.__useSpotifyDataStore || (await import('/src/store/useSpotifyDataStore.ts')).useSpotifyDataStore;
    if (!store.getState().isAuthenticated || store.getState().playlists.length === 0) {
      await store.getState().initialize();
    }
    const st = store.getState();
    return {
      isAuth: st.isAuthenticated,
      playlistCount: st.playlists.length,
      firstPlaylist: st.playlists[0]?.name,
    };
  });
  console.log('\n[Setup] Authenticated state:', initResult);

  // Wait for sidebar playlist rows to be rendered (transition out of shimmer)
  await page.waitForFunction(() => {
    const aside = document.querySelector('aside');
    if (!aside) return false;
    return aside.querySelectorAll('div.cursor-pointer.group').length > 0;
  }, { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 500));

  // Step 2: Sidebar Typography Tests (Idle State)
  console.log('\n--- Section 1: Sidebar Playlist Typography (Idle & Selected) ---');
  await page.evaluate(async () => {
    const playerStore = (await import('/src/store/usePlayerStore.ts')).usePlayerStore;
    playerStore.setState({ isPlaying: false });
  });
  await new Promise((r) => setTimeout(r, 300));

  const sidebarRows = await page.evaluate(() => {
    const aside = document.querySelector('aside');
    if (!aside) return [];
    const items = Array.from(aside.querySelectorAll('div.cursor-pointer.group'));
    return items.map((item, idx) => {
      const titleElem = item.querySelector('p');
      const subtitleElem = item.querySelector('div.text-\\[14px\\]') || item.querySelectorAll('p')[1] || item.querySelector('span.truncate');
      const titleStyle = titleElem ? window.getComputedStyle(titleElem) : null;
      const subtitleStyle = subtitleElem ? window.getComputedStyle(subtitleElem) : null;
      const hasEq = !!item.querySelector('.animate-bounce');
      const isSelected = item.className.includes('bg-[#282828]');

      return {
        idx,
        title: titleElem?.innerText || '',
        titleSize: titleStyle?.fontSize,
        titleColor: titleStyle?.color,
        titleWeight: titleStyle?.fontWeight,
        titleFont: titleStyle?.fontFamily,
        subtitleSize: subtitleStyle?.fontSize,
        subtitleColor: subtitleStyle?.color,
        subtitleFont: subtitleStyle?.fontFamily,
        hasEq,
        isSelected,
      };
    });
  });

  const row0 = sidebarRows[0];
  assertCheck('TYPO-1.1', 'Sidebar playlist title font size is 16px',
    row0.titleSize === '16px', row0.titleSize, '16px');

  assertCheck('TYPO-1.2', 'Sidebar playlist subtitle font size is 14px',
    row0.subtitleSize === '14px', row0.subtitleSize, '14px');

  assertCheck('TYPO-1.3', 'Sidebar playlist title font family includes SpotifyMixUI or sans-serif',
    row0.titleFont.includes('SpotifyMixUI') || row0.titleFont.includes('sans-serif'),
    row0.titleFont, 'SpotifyMixUI, sans-serif');

  assertCheck('TYPO-1.4', 'Sidebar playlist title color is white #ffffff when idle',
    rgbToHex(row0.titleColor) === '#ffffff', rgbToHex(row0.titleColor), '#ffffff');

  assertCheck('TYPO-1.5', 'Sidebar playlist subtitle color is #b3b3b3',
    rgbToHex(row0.subtitleColor) === '#b3b3b3', rgbToHex(row0.subtitleColor), '#b3b3b3');

  assertCheck('TYPO-1.6', 'No equalizer waves on idle playlist',
    row0.hasEq === false, String(row0.hasEq), 'false');

  // Step 3: Selected Playlist (Idle / Paused)
  console.log('\n--- Section 2: Selected Playlist Typography (Paused) ---');
  await page.evaluate(() => {
    const aside = document.querySelector('aside');
    const items = Array.from(aside.querySelectorAll('div.cursor-pointer.group'));
    if (items[0]) items[0].click();
  });
  await new Promise((r) => setTimeout(r, 400));

  const selectedRowInfo = await page.evaluate(() => {
    const aside = document.querySelector('aside');
    const selected = Array.from(aside.querySelectorAll('div.cursor-pointer.group')).find(el => el.className.includes('bg-[#282828]'));
    if (!selected) return null;
    const p = selected.querySelector('p');
    return {
      title: p?.innerText,
      color: window.getComputedStyle(p).color,
      hasEq: !!selected.querySelector('.animate-bounce'),
    };
  });

  assertCheck('SEL-2.1', 'Selected playlist title remains white #ffffff when paused',
    rgbToHex(selectedRowInfo.color) === '#ffffff', rgbToHex(selectedRowInfo.color), '#ffffff');

  assertCheck('SEL-2.2', 'Selected playlist has NO equalizer waves when paused',
    selectedRowInfo.hasEq === false, String(selectedRowInfo.hasEq), 'false');

  // Step 4: Active Playback State in Sidebar
  console.log('\n--- Section 3: Active Playback State in Sidebar ---');

  // Set Playlist 0 as playing
  await page.evaluate(async () => {
    const dataStore = window.__useSpotifyDataStore || (await import('/src/store/useSpotifyDataStore.ts')).useSpotifyDataStore;
    const playerStore = (await import('/src/store/usePlayerStore.ts')).usePlayerStore;
    const p0 = dataStore.getState().playlists[0];

    const track = {
      id: 'playing-track-p0',
      name: 'P0 Playing Track',
      duration_ms: 180000,
      playlistId: p0.id,
      artists: [{ id: 'a1', name: 'Artist 1' }],
      album: { id: 'alb1', name: 'Album 1', images: [] },
    };

    if (!p0.tracks) p0.tracks = { total: 1, items: [] };
    p0.tracks.items = [track];
    dataStore.setState({ playlists: [...dataStore.getState().playlists] });

    playerStore.setState({
      currentTrack: track,
      isPlaying: true,
      queue: [track],
    });
  });
  await new Promise((r) => setTimeout(r, 400));

  const playingRowStyles = await page.evaluate(() => {
    const aside = document.querySelector('aside');
    const items = Array.from(aside.querySelectorAll('div.cursor-pointer.group'));
    return items.slice(0, 2).map((item) => {
      const p = item.querySelector('p');
      return {
        title: p?.innerText,
        color: window.getComputedStyle(p).color,
        hasEq: !!item.querySelector('.animate-bounce'),
        isSelected: item.className.includes('bg-[#282828]'),
      };
    });
  });

  assertCheck('PLAY-3.1', 'Playing playlist title turns Spotify green #1ed760',
    rgbToHex(playingRowStyles[0].color) === '#1ed760', rgbToHex(playingRowStyles[0].color), '#1ed760');

  assertCheck('PLAY-3.2', 'Playing playlist renders animated equalizer waves',
    playingRowStyles[0].hasEq === true, String(playingRowStyles[0].hasEq), 'true');

  // Step 5: Pausing reverts to #ffffff and removes equalizer waves
  console.log('\n--- Section 4: Pausing Playback ---');
  await page.evaluate(async () => {
    const playerStore = (await import('/src/store/usePlayerStore.ts')).usePlayerStore;
    playerStore.setState({ isPlaying: false });
  });
  await new Promise((r) => setTimeout(r, 400));

  const pausedRowStyles = await page.evaluate(() => {
    const aside = document.querySelector('aside');
    const items = Array.from(aside.querySelectorAll('div.cursor-pointer.group'));
    const p = items[0]?.querySelector('p');
    return {
      title: p?.innerText,
      color: window.getComputedStyle(p).color,
      hasEq: !!items[0]?.querySelector('.animate-bounce'),
    };
  });

  assertCheck('PAUSE-4.1', 'Pausing reverts playlist title to white #ffffff',
    rgbToHex(pausedRowStyles.color) === '#ffffff', rgbToHex(pausedRowStyles.color), '#ffffff');

  assertCheck('PAUSE-4.2', 'Pausing removes equalizer waves from playlist item',
    pausedRowStyles.hasEq === false, String(pausedRowStyles.hasEq), 'false');

  // Step 6: CRITICAL ADVERSARIAL TEST: Separation of Selected Playlist vs Playing Playlist
  console.log('\n--- Section 5: CRITICAL ADVERSARIAL TEST: Playlist A playing, user selects Playlist B ---');
  // Re-start playing Playlist 0
  await page.evaluate(async () => {
    const playerStore = (await import('/src/store/usePlayerStore.ts')).usePlayerStore;
    playerStore.setState({ isPlaying: true });
  });
  await new Promise((r) => setTimeout(r, 300));

  // User clicks Playlist 1 to select/view it
  await page.evaluate(() => {
    const aside = document.querySelector('aside');
    const items = Array.from(aside.querySelectorAll('div.cursor-pointer.group'));
    if (items[1]) items[1].click();
  });
  await new Promise((r) => setTimeout(r, 400));

  const crossStateRows = await page.evaluate(() => {
    const aside = document.querySelector('aside');
    const items = Array.from(aside.querySelectorAll('div.cursor-pointer.group'));
    return items.slice(0, 3).map((item) => {
      const p = item.querySelector('p');
      return {
        title: p?.innerText,
        color: window.getComputedStyle(p).color,
        hasEq: !!item.querySelector('.animate-bounce'),
        isSelected: item.className.includes('bg-[#282828]'),
      };
    });
  });

  console.log('Playlist 0 (playing, NOT selected):', {
    title: crossStateRows[0].title,
    color: rgbToHex(crossStateRows[0].color),
    hasEq: crossStateRows[0].hasEq,
    isSelected: crossStateRows[0].isSelected,
  });
  console.log('Playlist 1 (NOT playing, SELECTED):', {
    title: crossStateRows[1].title,
    color: rgbToHex(crossStateRows[1].color),
    hasEq: crossStateRows[1].hasEq,
    isSelected: crossStateRows[1].isSelected,
  });

  assertCheck('CROSS-5.1', 'Selected non-playing playlist B MUST retain #ffffff white text',
    rgbToHex(crossStateRows[1].color) === '#ffffff', rgbToHex(crossStateRows[1].color), '#ffffff', 'CRITICAL');

  assertCheck('CROSS-5.2', 'Selected non-playing playlist B MUST NOT render equalizer waves',
    crossStateRows[1].hasEq === false, String(crossStateRows[1].hasEq), 'false', 'CRITICAL');

  assertCheck('CROSS-5.3', 'Playing unselected playlist A MUST retain #1ed760 green text',
    rgbToHex(crossStateRows[0].color) === '#1ed760', rgbToHex(crossStateRows[0].color), '#1ed760', 'CRITICAL');

  assertCheck('CROSS-5.4', 'Playing unselected playlist A MUST retain equalizer waves',
    crossStateRows[0].hasEq === true, String(crossStateRows[0].hasEq), 'true', 'CRITICAL');

  // Step 7: Detail View Track Rows (Selected vs Playing)
  console.log('\n--- Section 6: Detail View Track Rows ---');

  // Populate Playlist 1 with 2 tracks and open it in detail view
  await page.evaluate(async () => {
    const dataStore = window.__useSpotifyDataStore || (await import('/src/store/useSpotifyDataStore.ts')).useSpotifyDataStore;
    const playerStore = (await import('/src/store/usePlayerStore.ts')).usePlayerStore;

    const p1 = dataStore.getState().playlists[1];
    const trackT1 = {
      id: 'detail-track-t1',
      name: 'Detail Track T1',
      duration_ms: 210000,
      playlistId: p1.id,
      artists: [{ id: 'art-1', name: 'Detail Artist 1' }],
      album: { id: 'alb-1', name: 'Detail Album 1', images: [{ url: 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg' }] },
    };
    const trackT2 = {
      id: 'detail-track-t2',
      name: 'Detail Track T2',
      duration_ms: 240000,
      playlistId: p1.id,
      artists: [{ id: 'art-2', name: 'Detail Artist 2' }],
      album: { id: 'alb-2', name: 'Detail Album 2', images: [{ url: 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg' }] },
    };

    p1.tracks = { total: 2, items: [trackT1, trackT2] };
    dataStore.setState({ playlists: [...dataStore.getState().playlists] });

    // Click Playlist 1 again to refresh DesktopPlaylistView with the new tracks
    const aside = document.querySelector('aside');
    const items = Array.from(aside.querySelectorAll('div.cursor-pointer.group'));
    if (items[1]) items[1].click();

    // Set currentTrack to trackT1, but paused
    playerStore.setState({
      currentTrack: trackT1,
      isPlaying: false,
    });
  });
  await new Promise((r) => setTimeout(r, 600));

  const trackRowsPaused = await page.evaluate(() => {
    const trackElems = Array.from(document.querySelectorAll('main div.space-y-0\\.5 > div'));
    return trackElems.map((el) => {
      const p = el.querySelector('p.text-sm');
      return {
        title: p?.innerText,
        color: window.getComputedStyle(p).color,
        hasEq: !!el.querySelector('.animate-bounce'),
        isSelected: el.className.includes('bg-white/10'),
      };
    });
  });

  if (trackRowsPaused.length < 2) {
    assertCheck('DETAIL-6.1', 'Track rows rendered in playlist detail view', false,
      `Rendered ${trackRowsPaused.length} rows`, '>= 2 rows', 'CRITICAL');
  } else {
    assertCheck('DETAIL-6.1', 'Track rows rendered in playlist detail view', true,
      `Rendered ${trackRowsPaused.length} rows`, '>= 2 rows');

    assertCheck('DETAIL-6.2', 'Selected track row title stays white #ffffff when paused',
      rgbToHex(trackRowsPaused[0].color) === '#ffffff', rgbToHex(trackRowsPaused[0].color), '#ffffff');

    assertCheck('DETAIL-6.3', 'Selected track row has NO equalizer waves when paused',
      trackRowsPaused[0].hasEq === false, String(trackRowsPaused[0].hasEq), 'false');

    // Now start playing trackT1
    await page.evaluate(async () => {
      const playerStore = (await import('/src/store/usePlayerStore.ts')).usePlayerStore;
      playerStore.setState({ isPlaying: true });
    });
    await new Promise((r) => setTimeout(r, 400));

    const trackRowsPlaying = await page.evaluate(() => {
      const trackElems = Array.from(document.querySelectorAll('main div.space-y-0\\.5 > div'));
      return trackElems.map((el) => {
        const p = el.querySelector('p.text-sm');
        return {
          title: p?.innerText,
          color: window.getComputedStyle(p).color,
          hasEq: !!el.querySelector('.animate-bounce'),
          isSelected: el.className.includes('bg-white/10'),
        };
      });
    });

    assertCheck('DETAIL-6.4', 'Playing track row title switches to Spotify green #1ed760',
      rgbToHex(trackRowsPlaying[0].color) === '#1ed760', rgbToHex(trackRowsPlaying[0].color), '#1ed760');

    assertCheck('DETAIL-6.5', 'Playing track row displays animated equalizer waves',
      trackRowsPlaying[0].hasEq === true, String(trackRowsPlaying[0].hasEq), 'true');

    assertCheck('DETAIL-6.6', 'Non-playing track row title remains white #ffffff',
      rgbToHex(trackRowsPlaying[1].color) === '#ffffff', rgbToHex(trackRowsPlaying[1].color), '#ffffff');

    assertCheck('DETAIL-6.7', 'Non-playing track row has NO equalizer waves',
      trackRowsPlaying[1].hasEq === false, String(trackRowsPlaying[1].hasEq), 'false');
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('AUDIT SUMMARY');
  console.log('='.repeat(80));
  const passedCount = results.filter(r => r.passed).length;
  const failedCount = results.filter(r => !r.passed).length;
  const criticalCount = results.filter(r => !r.passed && r.severity === 'CRITICAL').length;

  console.log(`Total checks:    ${results.length}`);
  console.log(`Passed:          ${passedCount}`);
  console.log(`Failed:          ${failedCount}`);
  console.log(`Critical fails:  ${criticalCount}`);

  browser.disconnect();

  if (criticalCount > 0) {
    process.exitCode = 1;
  }
}

runAudit().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
