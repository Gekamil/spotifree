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

async function runEmpiricalChallenge() {
  console.log('='.repeat(80));
  console.log('   EMPIRICAL CHALLENGER: MILESTONE 2 TYPOGRAPHY & PLAYBACK PARITY AUDIT');
  console.log('='.repeat(80));

  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  let page = pages.find((p) => p.url().includes('127.0.0.1:5173') || p.url().includes('localhost:5173'));

  if (!page) {
    console.log('Opening new page for http://127.0.0.1:5173...');
    page = await browser.newPage();
    await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle2' });
  } else {
    console.log('Using existing page:', page.url());
    await page.bringToFront();
  }

  await page.waitForSelector('aside', { timeout: 5000 });
  await new Promise((r) => setTimeout(r, 1000));

  const report = [];

  function record(id, title, passed, details, isCritical = false) {
    report.push({ id, title, passed, details, isCritical });
    const mark = passed ? '✔ PASS' : (isCritical ? '✖ CRITICAL FAIL' : '✖ FAIL');
    console.log(`[${mark}] [${id}] ${title}`);
    console.log(`       Details: ${details}`);
  }

  // Ensure state is authenticated via Chrome sync or store
  const isAuth = await page.evaluate(async () => {
    const dataStore = (await import('/src/store/useSpotifyDataStore.ts')).useSpotifyDataStore;
    let s = dataStore.getState();
    if (!s.isAuthenticated) {
      const sessionSync = await import('/src/services/sessionSync.ts');
      await sessionSync.syncChromeSession();
      s = dataStore.getState();
    }
    return s.isAuthenticated;
  });
  console.log(`Authenticated: ${isAuth}`);

  // Test Group 1: Sidebar Playlist Typography (Idle & Selected)
  console.log('\n--- Test Group 1: Sidebar Typography (16px title, 14px subtitle, #ffffff text) ---');

  // Pause playback first
  await page.evaluate(async () => {
    const playerStore = (await import('/src/store/usePlayerStore.ts')).usePlayerStore;
    playerStore.setState({ isPlaying: false });
  });
  await new Promise((r) => setTimeout(r, 300));

  const sidebarItemsInfo = await page.evaluate(() => {
    const aside = document.querySelector('aside');
    if (!aside) return null;
    const items = Array.from(aside.querySelectorAll('div.cursor-pointer.group'));
    return items.map((item, idx) => {
      const titleElem = item.querySelector('p');
      const subtitleElem = item.querySelector('div.text-\\[14px\\]') || item.querySelector('span.truncate') || item.querySelectorAll('p')[1];
      const titleStyle = titleElem ? window.getComputedStyle(titleElem) : null;
      const subtitleStyle = subtitleElem ? window.getComputedStyle(subtitleElem) : null;
      const hasEqualizer = !!item.querySelector('.animate-bounce');

      return {
        index: idx,
        titleText: titleElem?.innerText || '',
        titleFontSize: titleStyle?.fontSize,
        titleFontFamily: titleStyle?.fontFamily,
        titleFontWeight: titleStyle?.fontWeight,
        titleColor: titleStyle?.color,
        subtitleFontSize: subtitleStyle?.fontSize,
        subtitleFontFamily: subtitleStyle?.fontFamily,
        subtitleColor: subtitleStyle?.color,
        hasEqualizer,
      };
    });
  });

  if (!sidebarItemsInfo || sidebarItemsInfo.length === 0) {
    record('TYPO-1', 'Sidebar playlist items exist', false, 'No playlist items found in sidebar', true);
  } else {
    console.log(`Found ${sidebarItemsInfo.length} sidebar playlist items.`);
    const firstItem = sidebarItemsInfo[0];
    const titleHex = rgbToHex(firstItem.titleColor);
    const subtitleHex = rgbToHex(firstItem.subtitleColor);

    record('TYPO-1.1', 'Sidebar playlist title font size is 16px', firstItem.titleFontSize === '16px',
      `Expected: 16px, Computed: ${firstItem.titleFontSize}`);

    record('TYPO-1.2', 'Sidebar playlist subtitle font size is 14px', firstItem.subtitleFontSize === '14px',
      `Expected: 14px, Computed: ${firstItem.subtitleFontSize}`);

    record('TYPO-1.3', 'Sidebar playlist title color is #ffffff (idle)', titleHex === '#ffffff',
      `Expected: #ffffff, Computed: ${titleHex} (${firstItem.titleColor})`);

    record('TYPO-1.4', 'Sidebar playlist subtitle color is #b3b3b3', subtitleHex === '#b3b3b3',
      `Expected: #b3b3b3, Computed: ${subtitleHex} (${firstItem.subtitleColor})`);

    record('TYPO-1.5', 'Sidebar font stack includes SpotifyMixUI or sans-serif',
      firstItem.titleFontFamily.includes('SpotifyMixUI') || firstItem.titleFontFamily.includes('sans-serif'),
      `Computed fontFamily: ${firstItem.titleFontFamily}`);

    record('TYPO-1.6', 'No equalizer waves when playback is idle/paused', !firstItem.hasEqualizer,
      `hasEqualizer: ${firstItem.hasEqualizer}`);
  }

  // Test Selected State (without playback)
  console.log('\n--- Test Group 2: Selected Playlist State (Without Playback) ---');
  // Click second playlist if available, or first
  const selectResult = await page.evaluate(async () => {
    const dataStore = (await import('/src/store/useSpotifyDataStore.ts')).useSpotifyDataStore;
    const playlists = dataStore.getState().playlists;
    if (playlists.length === 0) return null;
    const target = playlists.length > 1 ? playlists[1] : playlists[0];

    const aside = document.querySelector('aside');
    const items = Array.from(aside.querySelectorAll('div.cursor-pointer.group'));
    const itemElem = items[playlists.length > 1 ? 1 : 0];
    if (itemElem) itemElem.click();

    return { id: target.id, name: target.name };
  });

  await new Promise((r) => setTimeout(r, 400));

  const selectedItemInfo = await page.evaluate(() => {
    const aside = document.querySelector('aside');
    const selectedElem = aside.querySelector('div.bg-\\[\\#282828\\].cursor-pointer') ||
                         Array.from(aside.querySelectorAll('div.cursor-pointer.group')).find(el => el.className.includes('bg-[#282828]'));
    if (!selectedElem) return null;
    const titleElem = selectedElem.querySelector('p');
    const titleStyle = window.getComputedStyle(titleElem);
    const hasEqualizer = !!selectedElem.querySelector('.animate-bounce');
    return {
      titleText: titleElem?.innerText,
      titleColor: titleStyle.color,
      hasEqualizer,
    };
  });

  if (!selectedItemInfo) {
    record('SEL-1', 'Selected playlist highlighted with bg-[#282828]', false, 'Selected element not found with bg-[#282828]', true);
  } else {
    const selHex = rgbToHex(selectedItemInfo.titleColor);
    record('SEL-1.1', 'Selected playlist title remains white #ffffff when idle', selHex === '#ffffff',
      `Expected: #ffffff, Computed: ${selHex} (${selectedItemInfo.titleColor})`);
    record('SEL-1.2', 'Selected playlist does NOT show equalizer waves when idle', !selectedItemInfo.hasEqualizer,
      `hasEqualizer: ${selectedItemInfo.hasEqualizer}`);
  }

  // Test Group 3: Active Playback State in Sidebar
  console.log('\n--- Test Group 3: Active Playback State in Sidebar ---');

  // Case 3A: Play a track from Playlist 0
  const playPlaylist0Result = await page.evaluate(async () => {
    const dataStore = (await import('/src/store/useSpotifyDataStore.ts')).useSpotifyDataStore;
    const playerStore = (await import('/src/store/usePlayerStore.ts')).usePlayerStore;
    const playlists = dataStore.getState().playlists;
    if (playlists.length < 2) return null;

    const p0 = playlists[0];
    const p1 = playlists[1];

    // Set playing track with playlistId = p0.id
    const track = {
      id: 'test-track-p0-1',
      name: 'Test P0 Track',
      duration_ms: 180000,
      playlistId: p0.id,
      artists: [{ id: 'a1', name: 'Test Artist' }],
      album: { id: 'al1', name: 'Test Album', images: [] },
    };

    // Set test track on p0
    p0.tracks = { total: 1, items: [track] };

    playerStore.setState({
      currentTrack: track,
      isPlaying: true,
      queue: [track],
    });

    return { p0Id: p0.id, p0Name: p0.name, p1Id: p1.id, p1Name: p1.name };
  });

  await new Promise((r) => setTimeout(r, 400));

  const playbackStylesA = await page.evaluate(() => {
    const aside = document.querySelector('aside');
    const items = Array.from(aside.querySelectorAll('div.cursor-pointer.group'));
    return items.map((item) => {
      const titleElem = item.querySelector('p');
      const titleStyle = titleElem ? window.getComputedStyle(titleElem) : null;
      const hasEqualizer = !!item.querySelector('.animate-bounce');
      return {
        titleText: titleElem?.innerText || '',
        color: titleStyle?.color,
        hasEqualizer,
      };
    });
  });

  if (playbackStylesA && playbackStylesA.length >= 2) {
    const p0Hex = rgbToHex(playbackStylesA[0].color);
    const p1Hex = rgbToHex(playbackStylesA[1].color);

    record('PLAY-1.1', 'Playing playlist switches title to Spotify green #1ed760',
      p0Hex === '#1ed760',
      `Playlist 0 ("${playbackStylesA[0].titleText}"): Expected: #1ed760, Computed: ${p0Hex}`);

    record('PLAY-1.2', 'Playing playlist displays animated equalizer waves',
      playbackStylesA[0].hasEqualizer === true,
      `Playlist 0 hasEqualizer: ${playbackStylesA[0].hasEqualizer}`);

    record('PLAY-1.3', 'Non-playing playlist remains white #ffffff',
      p1Hex === '#ffffff',
      `Playlist 1 ("${playbackStylesA[1].titleText}"): Expected: #ffffff, Computed: ${p1Hex}`);

    record('PLAY-1.4', 'Non-playing playlist has NO equalizer waves',
      playbackStylesA[1].hasEqualizer === false,
      `Playlist 1 hasEqualizer: ${playbackStylesA[1].hasEqualizer}`);
  }

  // Case 3B: Pause playback
  console.log('\n--- Case 3B: Pausing active playback ---');
  await page.evaluate(async () => {
    const playerStore = (await import('/src/store/usePlayerStore.ts')).usePlayerStore;
    playerStore.getState().togglePlay(); // pause
  });
  await new Promise((r) => setTimeout(r, 400));

  const pausedStyles = await page.evaluate(() => {
    const aside = document.querySelector('aside');
    const items = Array.from(aside.querySelectorAll('div.cursor-pointer.group'));
    return items.map((item) => {
      const titleElem = item.querySelector('p');
      const titleStyle = titleElem ? window.getComputedStyle(titleElem) : null;
      const hasEqualizer = !!item.querySelector('.animate-bounce');
      return {
        titleText: titleElem?.innerText || '',
        color: titleStyle?.color,
        hasEqualizer,
      };
    });
  });

  if (pausedStyles && pausedStyles.length >= 1) {
    const p0PausedHex = rgbToHex(pausedStyles[0].color);
    record('PLAY-2.1', 'Paused playlist title reverts to white #ffffff',
      p0PausedHex === '#ffffff',
      `Playlist 0: Expected: #ffffff, Computed: ${p0PausedHex}`);

    record('PLAY-2.2', 'Paused playlist removes equalizer waves',
      pausedStyles[0].hasEqualizer === false,
      `Playlist 0 hasEqualizer: ${pausedStyles[0].hasEqualizer}`);
  }

  // Case 3C: ADVERSARIAL STRESS TEST: Selected playlist vs Playing playlist separation
  console.log('\n--- Case 3C: ADVERSARIAL TEST: Playlist A is playing, but user selects/clicks Playlist B ---');
  // Re-start playing Playlist 0
  await page.evaluate(async () => {
    const playerStore = (await import('/src/store/usePlayerStore.ts')).usePlayerStore;
    playerStore.setState({ isPlaying: true });
  });
  await new Promise((r) => setTimeout(r, 200));

  // Now click Playlist 1 in sidebar to select Playlist 1
  await page.evaluate(() => {
    const aside = document.querySelector('aside');
    const items = Array.from(aside.querySelectorAll('div.cursor-pointer.group'));
    if (items[1]) items[1].click();
  });
  await new Promise((r) => setTimeout(r, 400));

  const crossSelectStyles = await page.evaluate(() => {
    const aside = document.querySelector('aside');
    const items = Array.from(aside.querySelectorAll('div.cursor-pointer.group'));
    return items.map((item) => {
      const titleElem = item.querySelector('p');
      const titleStyle = titleElem ? window.getComputedStyle(titleElem) : null;
      const hasEqualizer = !!item.querySelector('.animate-bounce');
      const isSelected = item.className.includes('bg-[#282828]');
      return {
        titleText: titleElem?.innerText || '',
        color: titleStyle?.color,
        hasEqualizer,
        isSelected,
      };
    });
  });

  if (crossSelectStyles && crossSelectStyles.length >= 2) {
    const p0CrossHex = rgbToHex(crossSelectStyles[0].color);
    const p1CrossHex = rgbToHex(crossSelectStyles[1].color);

    console.log(`Playlist 0 (playing, not selected): color=${p0CrossHex}, hasEqualizer=${crossSelectStyles[0].hasEqualizer}, isSelected=${crossSelectStyles[0].isSelected}`);
    console.log(`Playlist 1 (NOT playing, SELECTED): color=${p1CrossHex}, hasEqualizer=${crossSelectStyles[1].hasEqualizer}, isSelected=${crossSelectStyles[1].isSelected}`);

    // REQUIREMENT: Playlist 1 is SELECTED, but NOT playing -> Must be #ffffff and have NO equalizer waves!
    record('PLAY-3.1', 'Selected non-playing playlist B MUST stay white #ffffff while playlist A plays',
      p1CrossHex === '#ffffff',
      `Playlist 1 (selected): Expected: #ffffff, Got: ${p1CrossHex}`, true);

    record('PLAY-3.2', 'Selected non-playing playlist B MUST NOT show equalizer waves while playlist A plays',
      crossSelectStyles[1].hasEqualizer === false,
      `Playlist 1 hasEqualizer: ${crossSelectStyles[1].hasEqualizer}`, true);

    // Playlist 0 is PLAYING -> Must be #1ed760 and have equalizer waves
    record('PLAY-3.3', 'Playing unselected playlist A MUST retain #1ed760 green',
      p0CrossHex === '#1ed760',
      `Playlist 0 (playing): Expected: #1ed760, Got: ${p0CrossHex}`, true);

    record('PLAY-3.4', 'Playing unselected playlist A MUST retain equalizer waves',
      crossSelectStyles[0].hasEqualizer === true,
      `Playlist 0 hasEqualizer: ${crossSelectStyles[0].hasEqualizer}`, true);
  }

  // Test Group 4: Playlist Detail View Track Rows (Selected vs Playing)
  console.log('\n--- Test Group 4: Playlist Detail View Track Rows ---');

  // Navigate to playlist detail view by explicitly selecting Playlist 0 (the playlist with test tracks)
  await page.evaluate(() => {
    const aside = document.querySelector('aside');
    const items = Array.from(aside?.querySelectorAll('div.cursor-pointer.group') || []);
    if (items[0]) {
      items[0].click();
    }
  });
  await new Promise((r) => setTimeout(r, 500));

  // Inspect track rows
  const detailTracksCheck = await page.evaluate(async () => {
    const playerStore = (await import('/src/store/usePlayerStore.ts')).usePlayerStore;
    const main = document.querySelector('main');
    if (!main) return { error: 'No main element' };

    const trackRows = Array.from(main.querySelectorAll('div.space-y-0\\.5 > div'));
    if (trackRows.length === 0) return { error: 'No track rows found in detail view' };

    // Select track 0, but set isPlaying = false
    const firstRowTitle = trackRows[0].querySelector('p.text-sm');
    const firstRowText = firstRowTitle?.innerText || '';

    // First test: Idle / Selected (not playing)
    // Click track row 0 or set currentTrack to it with isPlaying = false
    playerStore.setState({ isPlaying: false });

    return {
      rowCount: trackRows.length,
      firstTrackName: firstRowText,
    };
  });

  if (detailTracksCheck.error) {
    record('DETAIL-1', 'Playlist detail track rows found', false, detailTracksCheck.error, true);
  } else {
    await new Promise((r) => setTimeout(r, 300));

    // Check track 0 color when selected but paused
    const track0PausedInfo = await page.evaluate(() => {
      const main = document.querySelector('main');
      const trackRows = Array.from(main.querySelectorAll('div.space-y-0\\.5 > div'));
      const firstRow = trackRows[0];
      const titleElem = firstRow.querySelector('p.text-sm');
      const titleStyle = window.getComputedStyle(titleElem);
      const hasEqualizer = !!firstRow.querySelector('.animate-bounce');
      return {
        color: titleStyle.color,
        hasEqualizer,
        isSelected: firstRow.className.includes('bg-white/10'),
      };
    });

    const track0PausedHex = rgbToHex(track0PausedInfo.color);
    record('DETAIL-1.1', 'Track row in detail view remains white #ffffff when selected but paused',
      track0PausedHex === '#ffffff',
      `Track 0 (paused): Expected: #ffffff, Got: ${track0PausedHex} (${track0PausedInfo.color})`);

    record('DETAIL-1.2', 'Track row has NO equalizer waves when paused',
      track0PausedInfo.hasEqualizer === false,
      `hasEqualizer: ${track0PausedInfo.hasEqualizer}`);

    // Now set isPlaying = true for track 0
    await page.evaluate(async () => {
      const playerStore = (await import('/src/store/usePlayerStore.ts')).usePlayerStore;
      playerStore.setState({ isPlaying: true });
    });
    await new Promise((r) => setTimeout(r, 400));

    const track0PlayingInfo = await page.evaluate(() => {
      const main = document.querySelector('main');
      const trackRows = Array.from(main.querySelectorAll('div.space-y-0\\.5 > div'));
      const firstRow = trackRows[0];
      const titleElem = firstRow.querySelector('p.text-sm');
      const titleStyle = window.getComputedStyle(titleElem);
      const hasEqualizer = !!firstRow.querySelector('.animate-bounce');
      return {
        color: titleStyle.color,
        hasEqualizer,
      };
    });

    const track0PlayingHex = rgbToHex(track0PlayingInfo.color);
    record('DETAIL-2.1', 'Playing track row title switches to Spotify green #1ed760',
      track0PlayingHex === '#1ed760',
      `Track 0 (playing): Expected: #1ed760, Got: ${track0PlayingHex} (${track0PlayingInfo.color})`);

    record('DETAIL-2.2', 'Playing track row displays animated equalizer waves',
      track0PlayingInfo.hasEqualizer === true,
      `hasEqualizer: ${track0PlayingInfo.hasEqualizer}`);

    // Non-playing second track
    if (detailTracksCheck.rowCount > 1) {
      const track1Info = await page.evaluate(() => {
        const main = document.querySelector('main');
        const trackRows = Array.from(main.querySelectorAll('div.space-y-0\\.5 > div'));
        const secondRow = trackRows[1];
        const titleElem = secondRow.querySelector('p.text-sm');
        const titleStyle = window.getComputedStyle(titleElem);
        const hasEqualizer = !!secondRow.querySelector('.animate-bounce');
        return {
          color: titleStyle.color,
          hasEqualizer,
        };
      });
      const track1Hex = rgbToHex(track1Info.color);
      record('DETAIL-2.3', 'Non-playing track row remains white #ffffff while another track plays',
        track1Hex === '#ffffff',
        `Track 1: Expected: #ffffff, Got: ${track1Hex}`);

      record('DETAIL-2.4', 'Non-playing track row has NO equalizer waves',
        track1Info.hasEqualizer === false,
        `hasEqualizer: ${track1Info.hasEqualizer}`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY OF EMPIRICAL VERIFICATION FINDINGS:');
  console.log('='.repeat(80));
  const passedCount = report.filter((r) => r.passed).length;
  const failedCount = report.filter((r) => !r.passed).length;
  const criticalFailures = report.filter((r) => !r.passed && r.isCritical);

  console.log(`Total checks: ${report.length}`);
  console.log(`Passed:       ${passedCount}`);
  console.log(`Failed:       ${failedCount}`);
  console.log(`Critical:     ${criticalFailures.length}`);

  if (failedCount > 0) {
    console.log('\nFAILURES DETAILS:');
    for (const f of report.filter((r) => !r.passed)) {
      console.log(`- [${f.id}] ${f.title}`);
      console.log(`  Details: ${f.details}`);
    }
  }

  browser.disconnect();
}

runEmpiricalChallenge().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
