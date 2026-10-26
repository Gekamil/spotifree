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

async function runAdversarialChallenge() {
  console.log('='.repeat(80));
  console.log('   ADVERSARIAL STRESS TEST: PLAYLIST SELECTION FIDELITY & ZERO VIEW-HIJACKING');
  console.log('='.repeat(80));

  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle2' });

  // Wait for sidebar and data
  await page.waitForFunction(() => {
    const s = window.__useSpotifyDataStore?.getState();
    return s && s.isAuthenticated && s.playlists && s.playlists.length >= 4;
  }, { timeout: 10000 });
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

  // 1. Setup: Start playing Playlist 0 with an active track
  console.log('\n--- PHASE 1: START PLAYBACK OF PLAYLIST 0 ---');
  const setupData = await page.evaluate(async () => {
    const dataStore = window.__useSpotifyDataStore;
    const playerStore = window.__usePlayerStore;
    const playlists = dataStore.getState().playlists;

    const p0 = playlists[0];
    const p1 = playlists[1];
    const p2 = playlists[2];
    const p3 = playlists[3];

    // Ensure p0 has tracks, and p1 has 0 tracks / empty items to trigger any potential facade
    const testTrackP0 = {
      id: 'active-track-p0',
      name: 'Active Track P0 Playing',
      duration_ms: 200000,
      playlistId: p0.id,
      artists: [{ id: 'art-0', name: 'Artist Zero' }],
      album: { id: 'alb-0', name: 'Album Zero', images: [] },
    };

    p0.tracks = { total: 1, items: [testTrackP0] };
    p1.tracks = { total: 0, items: [] }; // Explicitly zero tracks!
    p2.tracks = { total: 0, items: [] }; // Explicitly zero tracks!
    p3.tracks = { total: 5, items: [] };

    playerStore.setState({
      currentTrack: testTrackP0,
      isPlaying: true,
      queue: [testTrackP0],
    });

    return {
      p0: { id: p0.id, name: p0.name },
      p1: { id: p1.id, name: p1.name },
      p2: { id: p2.id, name: p2.name },
      p3: { id: p3.id, name: p3.name },
    };
  });

  console.log(`Setup complete. Playlist 0 ("${setupData.p0.name}") is playing.`);
  console.log(`Playlist 1 ("${setupData.p1.name}") has 0 tracks.`);
  console.log(`Playlist 2 ("${setupData.p2.name}") has 0 tracks.`);
  await new Promise((r) => setTimeout(r, 400));

  // 2. User clicks Playlist 1 in sidebar while Playlist 0 is playing
  console.log('\n--- PHASE 2: CLICK PLAYLIST 1 (0 TRACKS) WHILE PLAYLIST 0 PLAYS ---');
  await page.evaluate(() => {
    const aside = document.querySelector('aside');
    const items = aside.querySelectorAll('div.cursor-pointer.group');
    if (items[1]) items[1].click();
  });
  await new Promise((r) => setTimeout(r, 500));

  // Verify view fidelity: Header MUST display Playlist 1 title, NOT Playlist 0 title
  const view1 = await page.evaluate(() => {
    const main = document.querySelector('main');
    const h1 = main?.querySelector('h1')?.innerText?.trim();
    const aside = document.querySelector('aside');
    const items = Array.from(aside?.querySelectorAll('div.cursor-pointer.group') || []);
    const r0 = items[0];
    const r1 = items[1];
    const p0Style = window.getComputedStyle(r0.querySelector('p'));
    const p1Style = window.getComputedStyle(r1.querySelector('p'));

    return {
      h1,
      r0Color: p0Style.color,
      r0Eq: !!r0.querySelector('.animate-bounce'),
      r0Selected: r0.className.includes('bg-[#282828]'),
      r1Color: p1Style.color,
      r1Eq: !!r1.querySelector('.animate-bounce'),
      r1Selected: r1.className.includes('bg-[#282828]'),
    };
  });

  const r0Hex = rgbToHex(view1.r0Color);
  const r1Hex = rgbToHex(view1.r1Color);

  console.log('Main View Header H1:', view1.h1);
  assert('FIDELITY-P1-RENDER', 'Main view renders selected Playlist 1 title (NO facade hijacking to P0)',
    view1.h1 === setupData.p1.name, view1.h1, setupData.p1.name, true);

  assert('FIDELITY-P1-NOT-P0', 'Main view strictly does NOT render Playlist 0 title',
    view1.h1 !== setupData.p0.name, view1.h1, `NOT ${setupData.p0.name}`, true);

  assert('SIDEBAR-P1-SELECTED-BG', 'Playlist 1 in sidebar has selected highlight (bg-[#282828])',
    view1.r1Selected === true, String(view1.r1Selected), 'true', true);

  assert('SIDEBAR-P1-SELECTED-WHITE', 'Playlist 1 in sidebar has white #ffffff title (selected, not playing)',
    r1Hex === '#ffffff', r1Hex, '#ffffff', true);

  assert('SIDEBAR-P1-SELECTED-NO-EQ', 'Playlist 1 in sidebar has NO equalizer waves',
    view1.r1Eq === false, String(view1.r1Eq), 'false', true);

  assert('SIDEBAR-P0-PLAYING-GREEN', 'Playlist 0 in sidebar retains green #1ed760 title (playing in background)',
    r0Hex === '#1ed760', r0Hex, '#1ed760', true);

  assert('SIDEBAR-P0-PLAYING-EQ', 'Playlist 0 in sidebar retains animated equalizer waves',
    view1.r0Eq === true, String(view1.r0Eq), 'true', true);

  assert('SIDEBAR-P0-NOT-SELECTED', 'Playlist 0 in sidebar is NOT selected',
    view1.r0Selected === false, String(view1.r0Selected), 'false', true);

  // 3. User clicks Playlist 2 (also 0 tracks)
  console.log('\n--- PHASE 3: CLICK PLAYLIST 2 (0 TRACKS) ---');
  await page.evaluate(() => {
    const aside = document.querySelector('aside');
    const items = aside.querySelectorAll('div.cursor-pointer.group');
    if (items[2]) items[2].click();
  });
  await new Promise((r) => setTimeout(r, 500));

  const view2 = await page.evaluate(() => {
    const main = document.querySelector('main');
    const h1 = main?.querySelector('h1')?.innerText?.trim();
    const aside = document.querySelector('aside');
    const items = Array.from(aside?.querySelectorAll('div.cursor-pointer.group') || []);
    return {
      h1,
      r2Selected: items[2]?.className.includes('bg-[#282828]'),
    };
  });

  assert('FIDELITY-P2-RENDER', 'Main view renders selected Playlist 2 title',
    view2.h1 === setupData.p2.name, view2.h1, setupData.p2.name, true);
  assert('SIDEBAR-P2-SELECTED-BG', 'Playlist 2 in sidebar is selected',
    view2.r2Selected === true, String(view2.r2Selected), 'true', true);

  // 4. Playback State Toggle While Viewing an Empty Selected Playlist
  console.log('\n--- PHASE 4: TOGGLE PLAYBACK (PAUSE -> PLAY) WHILE VIEWING EMPTY PLAYLIST 2 ---');
  // Pause
  await page.evaluate(async () => {
    const playerStore = window.__usePlayerStore;
    playerStore.setState({ isPlaying: false });
  });
  await new Promise((r) => setTimeout(r, 300));

  const afterPause = await page.evaluate(() => {
    const main = document.querySelector('main');
    const h1 = main?.querySelector('h1')?.innerText?.trim();
    const aside = document.querySelector('aside');
    const items = Array.from(aside?.querySelectorAll('div.cursor-pointer.group') || []);
    const r0Style = window.getComputedStyle(items[0].querySelector('p'));
    return {
      h1,
      r0Color: r0Style.color,
      r0Eq: !!items[0].querySelector('.animate-bounce'),
    };
  });

  assert('FIDELITY-PAUSE-NO-HIJACK', 'Pausing does NOT hijack view from Playlist 2',
    afterPause.h1 === setupData.p2.name, afterPause.h1, setupData.p2.name, true);
  assert('SIDEBAR-P0-PAUSED-WHITE', 'Paused Playlist 0 reverts to #ffffff',
    rgbToHex(afterPause.r0Color) === '#ffffff', rgbToHex(afterPause.r0Color), '#ffffff', true);
  assert('SIDEBAR-P0-PAUSED-NO-EQ', 'Paused Playlist 0 removes equalizer waves',
    afterPause.r0Eq === false, String(afterPause.r0Eq), 'false', true);

  // Resume Play
  await page.evaluate(async () => {
    const playerStore = window.__usePlayerStore;
    playerStore.setState({ isPlaying: true });
  });
  await new Promise((r) => setTimeout(r, 300));

  const afterResume = await page.evaluate(() => {
    const main = document.querySelector('main');
    const h1 = main?.querySelector('h1')?.innerText?.trim();
    return { h1 };
  });

  assert('FIDELITY-RESUME-NO-HIJACK', 'Resuming playback does NOT hijack view from Playlist 2',
    afterResume.h1 === setupData.p2.name, afterResume.h1, setupData.p2.name, true);

  // 5. User clicks Playlist 0 (the playing playlist)
  console.log('\n--- PHASE 5: CLICK PLAYLIST 0 (PLAYING PLAYLIST) ---');
  await page.evaluate(() => {
    const aside = document.querySelector('aside');
    const items = aside.querySelectorAll('div.cursor-pointer.group');
    if (items[0]) items[0].click();
  });
  await new Promise((r) => setTimeout(r, 500));

  const view0 = await page.evaluate(() => {
    const main = document.querySelector('main');
    const h1 = main?.querySelector('h1')?.innerText?.trim();
    const aside = document.querySelector('aside');
    const items = Array.from(aside?.querySelectorAll('div.cursor-pointer.group') || []);
    const r0 = items[0];
    const p0Style = window.getComputedStyle(r0.querySelector('p'));
    return {
      h1,
      r0Color: p0Style.color,
      r0Eq: !!r0.querySelector('.animate-bounce'),
      r0Selected: r0.className.includes('bg-[#282828]'),
    };
  });

  assert('FIDELITY-P0-RENDER', 'Main view renders Playlist 0 title when selected',
    view0.h1 === setupData.p0.name, view0.h1, setupData.p0.name, true);
  assert('SIDEBAR-P0-SELECTED-AND-PLAYING', 'Playlist 0 is BOTH selected (bg-[#282828]) and playing (#1ed760 with equalizer)',
    view0.r0Selected === true && rgbToHex(view0.r0Color) === '#1ed760' && view0.r0Eq === true,
    `selected=${view0.r0Selected}, color=${rgbToHex(view0.r0Color)}, eq=${view0.r0Eq}`,
    'selected=true, color=#1ed760, eq=true', true);

  // 6. Navigation: Home Navigation and Return
  console.log('\n--- PHASE 6: TOPNAV HOME NAVIGATION & RETURN ---');
  await page.evaluate(() => {
    // Click home button in topnav
    const homeBtn = document.querySelector('button[title*="Inicio"]') ||
                    Array.from(document.querySelectorAll('button')).find(b => b.querySelector('svg') && b.title === 'Inicio') ||
                    document.querySelector('header button');
    if (homeBtn) homeBtn.click();
  });
  await new Promise((r) => setTimeout(r, 400));

  const homeState = await page.evaluate(() => {
    const uiStore = window.__useUIStore;
    const isHome = uiStore?.getState()?.activeMainTab === 'home';
    const sectionsCount = document.querySelectorAll('section').length;
    return { isHome, sectionsCount };
  });

  assert('NAV-HOME-TAB', 'Navigates to Home tab',
    homeState.isHome, String(homeState.isHome), 'true');
  assert('NAV-HOME-SECTIONS', 'Home tab renders section carousels',
    homeState.sectionsCount >= 4, homeState.sectionsCount, '>= 4');

  // Re-select Playlist 3 from sidebar
  await page.evaluate(() => {
    const aside = document.querySelector('aside');
    const items = aside.querySelectorAll('div.cursor-pointer.group');
    if (items[3]) items[3].click();
  });
  await new Promise((r) => setTimeout(r, 500));

  const view3 = await page.evaluate(() => {
    const main = document.querySelector('main');
    const h1 = main?.querySelector('h1')?.innerText?.trim();
    const uiStore = window.__useUIStore;
    return {
      h1,
      tab: uiStore?.getState()?.activeMainTab,
    };
  });

  assert('NAV-RETURN-P3', 'Clicking Playlist 3 from home tab successfully switches to playlist view for Playlist 3',
    view3.tab === 'playlist' && view3.h1 === setupData.p3.name,
    `tab=${view3.tab}, h1=${view3.h1}`,
    `tab=playlist, h1=${setupData.p3.name}`, true);

  // 7. Typography Exact Measurements Across Sidebar
  console.log('\n--- PHASE 7: TYPOGRAPHY EXACT PARITY CHECK ---');
  const typoAudit = await page.evaluate(() => {
    const aside = document.querySelector('aside');
    const items = Array.from(aside?.querySelectorAll('div.cursor-pointer.group') || []).slice(0, 5);
    return items.map((item, idx) => {
      const p = item.querySelector('p');
      const sub = item.querySelector('div.text-\\[14px\\]') || item.querySelector('span.truncate') || item.querySelectorAll('p')[1];
      const pStyle = p ? window.getComputedStyle(p) : null;
      const subStyle = sub ? window.getComputedStyle(sub) : null;
      return {
        idx,
        name: p?.innerText,
        titleSize: pStyle?.fontSize,
        titleFamily: pStyle?.fontFamily,
        subSize: subStyle?.fontSize,
        subFamily: subStyle?.fontFamily,
      };
    });
  });

  let allTitles16px = true;
  let allSubs14px = true;
  let allFontsValid = true;

  for (const t of typoAudit) {
    if (t.titleSize !== '16px') allTitles16px = false;
    if (t.subSize !== '14px') allSubs14px = false;
    if (!t.titleFamily.includes('SpotifyMixUI') && !t.titleFamily.includes('sans-serif')) allFontsValid = false;
  }

  assert('TYPO-ALL-TITLES-16PX', 'All checked sidebar playlist titles are strictly 16px',
    allTitles16px, JSON.stringify(typoAudit.map(t => t.titleSize)), 'all 16px', true);

  assert('TYPO-ALL-SUBS-14PX', 'All checked sidebar playlist subtitles are strictly 14px',
    allSubs14px, JSON.stringify(typoAudit.map(t => t.subSize)), 'all 14px', true);

  assert('TYPO-FONT-FAMILY', 'Sidebar typography uses SpotifyMixUI / Circular font stack',
    allFontsValid, typoAudit[0]?.titleFamily, 'SpotifyMixUI, sans-serif', true);

  // Final Summary
  console.log('\n' + '='.repeat(80));
  console.log('ADVERSARIAL STRESS TEST SUMMARY:');
  console.log('='.repeat(80));

  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;
  const criticalCount = results.filter((r) => !r.passed && r.critical).length;

  console.log(`Total checks:   ${results.length}`);
  console.log(`Passed:         ${passedCount}`);
  console.log(`Failed:         ${failedCount}`);
  console.log(`Critical fails: ${criticalCount}`);

  await page.close();
  browser.disconnect();

  if (failedCount > 0) {
    console.error('\nADVERSARIAL STRESS TEST FAILED!');
    process.exit(1);
  } else {
    console.log('\nADVERSARIAL STRESS TEST PASSED: ZERO FACADES, STRICT SELECTION FIDELITY CONFIRMED!');
    process.exit(0);
  }
}

runAdversarialChallenge().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
