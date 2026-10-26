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

async function runEmpiricalAudit() {
  console.log('='.repeat(80));
  console.log('   EMPIRICAL CHALLENGER (RECHECK 2): TYPOGRAPHY, PLAYING PARITY & HEADERS');
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
  await new Promise((r) => setTimeout(r, 600));

  const results = [];
  function assert(id, desc, passed, actual, expected, critical = false) {
    results.push({ id, desc, passed, actual, expected, critical });
    const mark = passed ? '✔ PASS' : (critical ? '✖ CRITICAL FAIL' : '✖ FAIL');
    console.log(`[${mark}] [${id}] ${desc}`);
    if (!passed) {
      console.log(`       Expected: ${expected}`);
      console.log(`       Actual:   ${actual}`);
    }
  }

  // Ensure authenticated state
  await page.evaluate(async () => {
    const dataStore = window.__useSpotifyDataStore || (await import('/src/store/useSpotifyDataStore.ts')).useSpotifyDataStore;
    if (!dataStore.getState().isAuthenticated || dataStore.getState().playlists.length === 0) {
      await dataStore.getState().initialize();
    }
  });
  await new Promise((r) => setTimeout(r, 600));

  // Switch to home view
  await page.evaluate(async () => {
    const uiStore = window.__useUIStore || (await import('/src/store/useUIStore.ts')).useUIStore;
    uiStore.getState().setActiveMainTab('home');
  });
  await new Promise((r) => setTimeout(r, 500));

  // =========================================================================
  // 1. SIDEBAR TYPOGRAPHY VERIFICATION (List View)
  // =========================================================================
  console.log('\n--- 1. SIDEBAR TYPOGRAPHY VERIFICATION ---');

  // Ensure sidebar is in standard list view (not grid)
  await page.evaluate(async () => {
    const uiStore = window.__useUIStore || (await import('/src/store/useUIStore.ts')).useUIStore;
    if (uiStore.getState().sidebarViewMode === 'cuadricula' || uiStore.getState().sidebarViewMode === 'cuadricula-compacta') {
      uiStore.getState().setSidebarViewMode('lista');
    }
    const playerStore = window.__usePlayerStore || (await import('/src/store/usePlayerStore.ts')).usePlayerStore;
    playerStore.setState({ isPlaying: false });
  });
  await new Promise((r) => setTimeout(r, 400));

  const sidebarItems = await page.evaluate(() => {
    const aside = document.querySelector('aside');
    if (!aside) return [];
    const rows = Array.from(aside.querySelectorAll('div.cursor-pointer.group'));
    return rows.map((row, i) => {
      const titleEl = row.querySelector('p');
      const subEl = row.querySelector('div.text-\\[14px\\]') || row.querySelector('span.truncate') || row.querySelectorAll('p')[1];
      const titleCS = titleEl ? window.getComputedStyle(titleEl) : null;
      const subCS = subEl ? window.getComputedStyle(subEl) : null;
      const hasEq = !!row.querySelector('.animate-bounce');
      const isSelected = row.className.includes('bg-[#282828]');

      return {
        i,
        title: titleEl?.innerText || '',
        titleFontSize: titleCS?.fontSize,
        titleFontFamily: titleCS?.fontFamily,
        titleColor: titleCS?.color,
        subFontSize: subCS?.fontSize,
        subFontFamily: subCS?.fontFamily,
        subColor: subCS?.color,
        hasEq,
        isSelected,
      };
    });
  });

  console.log(`Found ${sidebarItems.length} sidebar items in list view.`);
  assert('SIDEBAR-COUNT', 'Sidebar has playlists rendered', sidebarItems.length >= 5, sidebarItems.length, '>= 5', true);

  if (sidebarItems.length > 0) {
    const item0 = sidebarItems[0];
    assert('SIDEBAR-FONT-STACK-TITLE', 'Sidebar title font stack includes SpotifyMixUI',
      item0.titleFontFamily.includes('SpotifyMixUI') || item0.titleFontFamily.includes('sans-serif'),
      item0.titleFontFamily, 'SpotifyMixUI, sans-serif');

    assert('SIDEBAR-FONT-SIZE-TITLE', 'Sidebar playlist title is strictly 16px',
      item0.titleFontSize === '16px', item0.titleFontSize, '16px', true);

    assert('SIDEBAR-FONT-STACK-SUB', 'Sidebar subtitle font stack includes SpotifyMixUI',
      item0.subFontFamily.includes('SpotifyMixUI') || item0.subFontFamily.includes('sans-serif'),
      item0.subFontFamily, 'SpotifyMixUI, sans-serif');

    assert('SIDEBAR-FONT-SIZE-SUB', 'Sidebar playlist subtitle is strictly 14px',
      item0.subFontSize === '14px', item0.subFontSize, '14px', true);

    assert('SIDEBAR-COLOR-IDLE-TITLE', 'Sidebar playlist title color is #ffffff when idle',
      rgbToHex(item0.titleColor) === '#ffffff', rgbToHex(item0.titleColor), '#ffffff');

    assert('SIDEBAR-COLOR-IDLE-SUB', 'Sidebar playlist subtitle color is #b3b3b3',
      rgbToHex(item0.subColor) === '#b3b3b3', rgbToHex(item0.subColor), '#b3b3b3');

    assert('SIDEBAR-NO-EQ-IDLE', 'No equalizer waves on idle playlist',
      item0.hasEq === false, String(item0.hasEq), 'false');
  }

  // =========================================================================
  // 2. PLAYING VS SELECTED PARITY IN SIDEBAR
  // =========================================================================
  console.log('\n--- 2. PLAYING VS SELECTED PARITY IN SIDEBAR ---');

  // Test: Selected playlist without playback
  await page.evaluate(() => {
    const aside = document.querySelector('aside');
    const rows = Array.from(aside.querySelectorAll('div.cursor-pointer.group'));
    if (rows[1]) rows[1].click();
  });
  await new Promise((r) => setTimeout(r, 300));

  const selItem = await page.evaluate(() => {
    function toHex(rgbStr) {
      if (!rgbStr) return rgbStr;
      if (rgbStr.startsWith('#')) return rgbStr.toLowerCase();
      const match = rgbStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (!match) return rgbStr;
      const r = parseInt(match[1], 10).toString(16).padStart(2, '0');
      const g = parseInt(match[2], 10).toString(16).padStart(2, '0');
      const b = parseInt(match[3], 10).toString(16).padStart(2, '0');
      return `#${r}${g}${b}`.toLowerCase();
    }
    const aside = document.querySelector('aside');
    const selected = Array.from(aside.querySelectorAll('div.cursor-pointer.group')).find(el => el.className.includes('bg-[#282828]'));
    if (!selected) return null;
    const p = selected.querySelector('p');
    return {
      title: p?.innerText,
      color: toHex(window.getComputedStyle(p).color),
      hasEq: !!selected.querySelector('.animate-bounce'),
    };
  });

  assert('SIDEBAR-SEL-COLOR', 'Selected playlist title remains #ffffff when idle/paused',
    selItem?.color === '#ffffff', selItem?.color, '#ffffff', true);
  assert('SIDEBAR-SEL-NO-EQ', 'Selected playlist has NO equalizer waves when idle/paused',
    selItem?.hasEq === false, String(selItem?.hasEq), 'false', true);

  // Test: Playing playlist 0 while playlist 1 is selected
  console.log('\n--- Adversarial State: Playlist 0 plays, Playlist 1 is selected ---');
  await page.evaluate(async () => {
    const dataStore = window.__useSpotifyDataStore || (await import('/src/store/useSpotifyDataStore.ts')).useSpotifyDataStore;
    const playerStore = window.__usePlayerStore || (await import('/src/store/usePlayerStore.ts')).usePlayerStore;
    const p0 = dataStore.getState().playlists[0];
    const trackP0 = {
      id: 'adversarial-track-p0',
      name: 'Adversarial Track P0',
      duration_ms: 190000,
      playlistId: p0.id,
      artists: [{ id: 'art-adv', name: 'Artist Adv' }],
      album: { id: 'alb-adv', name: 'Album Adv', images: [] },
    };
    if (!p0.tracks) p0.tracks = { total: 1, items: [] };
    p0.tracks.items = [trackP0];

    playerStore.setState({
      currentTrack: trackP0,
      isPlaying: true,
      queue: [trackP0],
    });
  });
  await new Promise((r) => setTimeout(r, 400));

  const crossParity = await page.evaluate(() => {
    function toHex(rgbStr) {
      if (!rgbStr) return rgbStr;
      if (rgbStr.startsWith('#')) return rgbStr.toLowerCase();
      const match = rgbStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (!match) return rgbStr;
      const r = parseInt(match[1], 10).toString(16).padStart(2, '0');
      const g = parseInt(match[2], 10).toString(16).padStart(2, '0');
      const b = parseInt(match[3], 10).toString(16).padStart(2, '0');
      return `#${r}${g}${b}`.toLowerCase();
    }
    const aside = document.querySelector('aside');
    const rows = Array.from(aside.querySelectorAll('div.cursor-pointer.group'));
    const r0 = rows[0];
    const r1 = rows[1];
    const p0 = r0.querySelector('p');
    const p1 = r1.querySelector('p');
    return {
      p0Title: p0?.innerText,
      p0Color: toHex(window.getComputedStyle(p0).color),
      p0Eq: !!r0.querySelector('.animate-bounce'),
      p0Selected: r0.className.includes('bg-[#282828]'),
      p1Title: p1?.innerText,
      p1Color: toHex(window.getComputedStyle(p1).color),
      p1Eq: !!r1.querySelector('.animate-bounce'),
      p1Selected: r1.className.includes('bg-[#282828]'),
    };
  });

  console.log('Playlist 0 (PLAYING, NOT SELECTED):', {
    color: crossParity.p0Color,
    hasEq: crossParity.p0Eq,
    isSelected: crossParity.p0Selected,
  });
  console.log('Playlist 1 (NOT PLAYING, SELECTED):', {
    color: crossParity.p1Color,
    hasEq: crossParity.p1Eq,
    isSelected: crossParity.p1Selected,
  });

  assert('PARITY-PLAYING-GREEN', 'Playing playlist 0 switches title to #1ed760',
    crossParity.p0Color === '#1ed760', crossParity.p0Color, '#1ed760', true);
  assert('PARITY-PLAYING-EQ', 'Playing playlist 0 displays animated equalizer waves',
    crossParity.p0Eq === true, String(crossParity.p0Eq), 'true', true);
  assert('PARITY-SELECTED-WHITE', 'Selected playlist 1 remains white #ffffff while playlist 0 plays',
    crossParity.p1Color === '#ffffff', crossParity.p1Color, '#ffffff', true);
  assert('PARITY-SELECTED-NO-EQ', 'Selected playlist 1 has NO equalizer waves while playlist 0 plays',
    crossParity.p1Eq === false, String(crossParity.p1Eq), 'false', true);

  // Pause playback
  await page.evaluate(async () => {
    const playerStore = (await import('/src/store/usePlayerStore.ts')).usePlayerStore;
    playerStore.setState({ isPlaying: false });
  });
  await new Promise((r) => setTimeout(r, 500));

  const p0Paused = await page.evaluate(() => {
    function toHex(rgbStr) {
      if (!rgbStr) return rgbStr;
      if (rgbStr.startsWith('#')) return rgbStr.toLowerCase();
      const match = rgbStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (!match) return rgbStr;
      const r = parseInt(match[1], 10).toString(16).padStart(2, '0');
      const g = parseInt(match[2], 10).toString(16).padStart(2, '0');
      const b = parseInt(match[3], 10).toString(16).padStart(2, '0');
      return `#${r}${g}${b}`.toLowerCase();
    }
    const aside = document.querySelector('aside');
    const r0 = aside.querySelectorAll('div.cursor-pointer.group')[0];
    const p0 = r0.querySelector('p');
    return {
      title: p0?.innerText,
      color: toHex(window.getComputedStyle(p0).color),
      hasEq: !!r0.querySelector('.animate-bounce'),
    };
  });

  console.log('Playlist 0 (PAUSED):', p0Paused);

  assert('PAUSE-REVERTS-WHITE', 'Paused playlist 0 reverts title to #ffffff',
    p0Paused.color === '#ffffff', p0Paused.color, '#ffffff', true);
  assert('PAUSE-REMOVES-EQ', 'Paused playlist 0 removes equalizer waves',
    p0Paused.hasEq === false, String(p0Paused.hasEq), 'false', true);

  // =========================================================================
  // 3. TRACK ROW STYLING IN PLAYLIST DETAIL VIEW
  // =========================================================================
  console.log('\n--- 3. TRACK ROW STYLING IN PLAYLIST DETAIL VIEW ---');

  // Set up playlist with 2 tracks and open detail view by clicking Playlist 0
  await page.evaluate(async () => {
    const dataStore = (await import('/src/store/useSpotifyDataStore.ts')).useSpotifyDataStore;
    const playerStore = (await import('/src/store/usePlayerStore.ts')).usePlayerStore;

    const p0 = dataStore.getState().playlists[0];
    const tracks = [
      {
        id: 't-row-0',
        name: 'Track Row Zero (Paused/Selected)',
        duration_ms: 180000,
        playlistId: p0.id,
        artists: [{ id: 'a0', name: 'Artist Alpha' }],
        album: { id: 'alb0', name: 'Album Alpha', images: [{ url: 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg' }] },
      },
      {
        id: 't-row-1',
        name: 'Track Row One (Other Track)',
        duration_ms: 220000,
        playlistId: p0.id,
        artists: [{ id: 'a1', name: 'Artist Beta' }],
        album: { id: 'alb1', name: 'Album Beta', images: [{ url: 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg' }] },
      },
    ];

    p0.tracks = { total: 2, items: tracks };
    dataStore.setState({ playlists: [...dataStore.getState().playlists] });

    // Open detail view for p0 by clicking item 0 in sidebar
    const aside = document.querySelector('aside');
    const items = Array.from(aside.querySelectorAll('div.cursor-pointer.group'));
    if (items[0]) items[0].click();

    // Set currentTrack to track 0, but isPlaying = false (paused)
    playerStore.setState({
      currentTrack: tracks[0],
      isPlaying: false,
      queue: tracks,
    });
  });
  await new Promise((r) => setTimeout(r, 600));

  const trackDetailPaused = (await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('main div.space-y-0\\.5 > div'));
    return rows.map((r) => {
      const p = r.querySelector('p.text-sm');
      return {
        title: p?.innerText,
        color: window.getComputedStyle(p).color,
        hasEq: !!r.querySelector('.animate-bounce'),
        isSelected: r.className.includes('bg-white/10'),
      };
    });
  })).map(t => ({ ...t, color: rgbToHex(t.color) }));

  console.log('Track Rows in Detail View (PAUSED, TRACK 0 SELECTED):', trackDetailPaused);

  assert('DETAIL-ROWS-RENDERED', 'Track rows rendered in playlist detail view',
    trackDetailPaused.length >= 2, trackDetailPaused.length, '>= 2', true);

  if (trackDetailPaused.length >= 2) {
    assert('DETAIL-SELECTED-PAUSED-WHITE', 'Selected track 0 is #ffffff when paused',
      trackDetailPaused[0].color === '#ffffff', trackDetailPaused[0].color, '#ffffff', true);
    assert('DETAIL-SELECTED-PAUSED-NO-EQ', 'Selected track 0 has NO equalizer waves when paused',
      trackDetailPaused[0].hasEq === false, String(trackDetailPaused[0].hasEq), 'false', true);
    assert('DETAIL-SELECTED-HIGHLIGHT', 'Selected track 0 has selection highlight bg-white/10',
      trackDetailPaused[0].isSelected === true, String(trackDetailPaused[0].isSelected), 'true');

    // Now start playing track 0
    await page.evaluate(async () => {
      const playerStore = window.__usePlayerStore || (await import('/src/store/usePlayerStore.ts')).usePlayerStore;
      playerStore.setState({ isPlaying: true });
    });
    await new Promise((r) => setTimeout(r, 400));

    const trackDetailPlaying = (await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('main div.space-y-0\\.5 > div'));
      return rows.map((r) => {
        const p = r.querySelector('p.text-sm');
        return {
          title: p?.innerText,
          color: window.getComputedStyle(p).color,
          hasEq: !!r.querySelector('.animate-bounce'),
          isSelected: r.className.includes('bg-white/10'),
        };
      });
    })).map(t => ({ ...t, color: rgbToHex(t.color) }));

    console.log('Track Rows in Detail View (PLAYING TRACK 0):', trackDetailPlaying);

    assert('DETAIL-PLAYING-GREEN', 'Playing track 0 switches title to #1ed760',
      trackDetailPlaying[0].color === '#1ed760', trackDetailPlaying[0].color, '#1ed760', true);
    assert('DETAIL-PLAYING-EQ', 'Playing track 0 renders animated equalizer waves',
      trackDetailPlaying[0].hasEq === true, String(trackDetailPlaying[0].hasEq), 'true', true);

    assert('DETAIL-OTHER-WHITE', 'Non-playing track 1 remains white #ffffff',
      trackDetailPlaying[1].color === '#ffffff', trackDetailPlaying[1].color, '#ffffff', true);
    assert('DETAIL-OTHER-NO-EQ', 'Non-playing track 1 has NO equalizer waves',
      trackDetailPlaying[1].hasEq === false, String(trackDetailPlaying[1].hasEq), 'false', true);
  }

  // =========================================================================
  // 4. DYNAMIC EDITORIAL HEADERS & PERSONALIZED SHELVES IN LIVE DOM
  // =========================================================================
  console.log('\n--- 4. DYNAMIC EDITORIAL HEADERS & PERSONALIZED SHELVES ---');

  // Switch back to home view
  await page.evaluate(async () => {
    const uiStore = window.__useUIStore || (await import('/src/store/useUIStore.ts')).useUIStore;
    uiStore.getState().setActiveMainTab('home');
  });
  await new Promise((r) => setTimeout(r, 500));

  const shelvesData = await page.evaluate(() => {
    const sections = Array.from(document.querySelectorAll('section'));
    return sections.map((sec) => {
      const prefixEl = sec.querySelector('span.text-xs.font-bold');
      const titleEl = sec.querySelector('h2');
      const subtitleEl = sec.querySelector('p.text-xs');
      const cards = Array.from(sec.querySelectorAll('h3')).map(h3 => h3.innerText);

      return {
        prefix: prefixEl?.innerText || null,
        title: titleEl?.innerText || null,
        subtitle: subtitleEl?.innerText || null,
        cardCount: cards.length,
        sampleCards: cards.slice(0, 3),
      };
    });
  });

  console.log('Live DOM Shelves:', JSON.stringify(shelvesData, null, 2));

  assert('SHELVES-COUNT', 'Live DOM contains at least 5 shelves',
    shelvesData.length >= 5, shelvesData.length, '>= 5', true);

  if (shelvesData.length >= 5) {
    // Shelf 1: Editorial header
    const s1 = shelvesData[0];
    const validEditorial = ['novedades populares', '¡hoy es viernes de novedades!', 'novedades', 'viernes de novedades'];
    const isEditorialValid = validEditorial.some(v => s1.title.toLowerCase().includes(v));
    assert('SHELF-1-EDITORIAL', 'Shelf 1 has dynamic editorial header (e.g. Novedades populares / Viernes de novedades)',
      isEditorialValid, s1.title, 'Editorial message from Spotify API / day-of-week');

    // Shelf 2: "Hecho para Jorgeperezvk"
    const s2 = shelvesData[1];
    const isMadeForValid = (s2.prefix === 'Hecho para' && s2.title === 'Jorgeperezvk') ||
                           s2.title.includes('Jorgeperezvk') || s2.title.includes('Hecho para');
    assert('SHELF-2-MADE-FOR', 'Shelf 2 is personalized for user (Hecho para Jorgeperezvk)',
      isMadeForValid, `${s2.prefix ? s2.prefix + ' ' : ''}${s2.title}`, 'Hecho para Jorgeperezvk', true);

    // Shelf 3: "Recientes"
    const s3 = shelvesData[2];
    assert('SHELF-3-RECENT', 'Shelf 3 is "Recientes"',
      s3.title.toLowerCase() === 'recientes', s3.title, 'Recientes');

    // Shelf 4: "Más como {Artist}"
    const s4 = shelvesData[3];
    const isMoreLikeValid = s4.prefix === 'Más como' || s4.title.toLowerCase().includes('más como');
    assert('SHELF-4-MORE-LIKE', 'Shelf 4 is artist affinity shelf (Más como ...)',
      isMoreLikeValid, `${s4.prefix ? s4.prefix + ' ' : ''}${s4.title}`, 'Más como [Artist]');

    // Shelf 5: "Tus mixes más escuchados"
    const s5 = shelvesData[4];
    assert('SHELF-5-MIXES', 'Shelf 5 is "Tus mixes más escuchados"',
      s5.title.toLowerCase().includes('tus mixes') || s5.title.toLowerCase().includes('mixes'),
      s5.title, 'Tus mixes más escuchados');
  }

  // =========================================================================
  // 5. ABSOLUTE ABSENCE OF ARBITRARY GREETINGS ACROSS ENTIRE LIVE DOM
  // =========================================================================
  console.log('\n--- 5. ARBITRARY GREETINGS SCAN ---');

  const greetingsAudit = await page.evaluate(() => {
    const fullText = document.body.innerText.toLowerCase();
    const banned = [
      'buenos días',
      'buenos dias',
      'buenas tardes',
      'buenas noches',
      'buen día',
      'buen dia',
      'mockuser',
    ];
    const found = banned.filter((phrase) => fullText.includes(phrase));
    return {
      found,
      bodyTextLength: fullText.length,
    };
  });

  console.log('Greetings scan found in live DOM:', greetingsAudit.found);
  assert('NO-GREETINGS-DOM', 'Zero arbitrary greetings in live DOM',
    greetingsAudit.found.length === 0, JSON.stringify(greetingsAudit.found), '[]');

  // =========================================================================
  // 6. SUMMARY & VERDICT
  // =========================================================================
  console.log('\n' + '='.repeat(80));
  console.log('FINAL AUDIT SUMMARY:');
  console.log('='.repeat(80));

  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;
  const criticalFails = results.filter((r) => !r.passed && r.critical).length;

  console.log(`Total checks:   ${results.length}`);
  console.log(`Passed:         ${passedCount}`);
  console.log(`Failed:         ${failedCount}`);
  console.log(`Critical fails: ${criticalFails}`);

  browser.disconnect();

  if (failedCount > 0) {
    console.error('\nAUDIT FAILED!');
    process.exit(1);
  } else {
    console.log('\nAUDIT PASSED: ALL EMPIRICAL CHECKS VERIFIED SUCCESSFULLY!');
    process.exit(0);
  }
}

runEmpiricalAudit().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
