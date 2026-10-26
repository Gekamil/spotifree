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

async function runAdversarialRecheck() {
  console.log('='.repeat(80));
  console.log('   EMPIRICAL CHALLENGER: ADVERSARIAL STRESS-TESTING HARNESS');
  console.log('='.repeat(80));

  const results = [];
  function assertCheck(name, condition, details) {
    results.push({ name, passed: !!condition, details });
    const mark = condition ? '✔ PASS' : '✖ FAIL';
    console.log(`[${mark}] ${name}`);
    if (details) console.log(`       Details: ${details}`);
  }

  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const page = await browser.newPage();

  try {
    await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle2' });
    await page.waitForFunction(() => {
      const s = window.__useSpotifyDataStore?.getState();
      return s && s.playlists && s.playlists.length >= 2;
    }, { timeout: 10000 });

    // ---------------------------------------------------------------------------
    // SECTION 1: buildDynamicShelves Adversarial Edge Case Oracle
    // ---------------------------------------------------------------------------
    console.log('\n--- Section 1: buildDynamicShelves Adversarial Edge Cases ---');

    const s1Results = await page.evaluate(async () => {
      const { buildDynamicShelves } = await import('/src/store/useSpotifyDataStore.ts');
      const checks = [];

      // 1.1: Unauthenticated empty state
      const emptyShelves = buildDynamicShelves(null, [], null);
      checks.push({
        id: 'S1.1',
        name: 'Unauth empty input returns strictly empty array',
        passed: Array.isArray(emptyShelves) && emptyShelves.length === 0,
        details: `Returned length: ${emptyShelves.length}`,
      });

      // 1.2: Authenticated user but empty playlists
      const mockUser = { id: 'u1', display_name: 'Carlos', images: [] };
      const userEmptyPlaylists = buildDynamicShelves(mockUser, [], null);
      checks.push({
        id: 'S1.2',
        name: 'User with 0 playlists does not crash and produces 5 shelves',
        passed: Array.isArray(userEmptyPlaylists) && userEmptyPlaylists.length === 5,
        details: `Shelves returned: ${userEmptyPlaylists.map((s) => s.id).join(', ')}`,
      });

      // 1.3: Playlists missing fields (null descriptions, missing images, missing owners)
      const malformedPlaylists = [
        { id: 'p1', name: 'Mix diario 1' },
        { id: 'p2', name: 'Rock Urbano', description: null, images: [] },
        { id: 'p3', name: 'Radio de Rosalía', owner: null },
      ];
      let malformedDidNotCrash = true;
      let malformedShelves = [];
      try {
        malformedShelves = buildDynamicShelves(mockUser, malformedPlaylists, null);
      } catch (err) {
        malformedDidNotCrash = false;
      }
      checks.push({
        id: 'S1.3',
        name: 'Malformed playlists without descriptions/images/owners do not crash',
        passed: malformedDidNotCrash && malformedShelves.length === 5,
        details: `Produced ${malformedShelves.length} shelves safely`,
      });

      // 1.4: Greeting Elimination across all 7 days of week
      const greetingWords = ['buenos días', 'buenos dias', 'buenas tardes', 'buenas noches', 'good morning', 'good evening'];
      let greetingFound = false;
      for (let day = 0; day < 7; day++) {
        const origGetDay = Date.prototype.getDay;
        Date.prototype.getDay = () => day;
        try {
          const shelves = buildDynamicShelves(mockUser, malformedPlaylists, null);
          for (const s of shelves) {
            const textToScan = `${s.title} ${s.prefix || ''} ${s.subtitle || ''} ${s.cards.map((c) => `${c.title} ${c.subtitle}`).join(' ')}`.toLowerCase();
            for (const g of greetingWords) {
              if (textToScan.includes(g)) {
                greetingFound = true;
              }
            }
          }
        } finally {
          Date.prototype.getDay = origGetDay;
        }
      }
      checks.push({
        id: 'S1.4',
        name: '0 greetings found across all 7 days of the week',
        passed: !greetingFound,
        details: 'Clean editorial headers verified on all days',
      });

      // 1.5: Priority Order Verification
      const priorityOrder = ['featured', 'made_for', 'recent', 'artist', 'mixes'];
      const shelfTypes = malformedShelves.map((s) => s.type);
      const typesMatch = JSON.stringify(shelfTypes) === JSON.stringify(priorityOrder);
      checks.push({
        id: 'S1.5',
        name: 'Shelf types match Priority Order 1..5',
        passed: typesMatch,
        details: `Expected ${priorityOrder.join('->')}, got ${shelfTypes.join('->')}`,
      });

      return checks;
    });

    for (const c of s1Results) {
      assertCheck(`[${c.id}] ${c.name}`, c.passed, c.details);
    }

    // ---------------------------------------------------------------------------
    // SECTION 2: Browser State Parity & Lifecycle Transitions
    // ---------------------------------------------------------------------------
    console.log('\n--- Section 2: Browser State Parity & Lifecycle Transitions ---');

    // Ensure clean initial playback state
    await page.evaluate(() => {
      window.__usePlayerStore?.setState({ isPlaying: false, currentTrack: null });
    });
    await new Promise((r) => setTimeout(r, 400));

    // 2.1: Test selection transitions with idle playback (should stay #ffffff across all selections)
    const selectPlaylistIndices = [0, 1, 2];
    let allIdleSelectedWhite = true;
    for (const idx of selectPlaylistIndices) {
      await page.evaluate((targetIdx) => {
        const items = Array.from(document.querySelectorAll('aside div.cursor-pointer.group'));
        if (items[targetIdx]) items[targetIdx].click();
      }, idx);
      await new Promise((r) => setTimeout(r, 300));

      const itemInfo = await page.evaluate((targetIdx) => {
        const items = Array.from(document.querySelectorAll('aside div.cursor-pointer.group'));
        const item = items[targetIdx];
        if (!item) return null;
        const p = item.querySelector('p');
        const color = window.getComputedStyle(p).color;
        const hasEq = !!item.querySelector('.animate-bounce');
        const isSel = item.className.includes('bg-[#282828]');
        return { color, hasEq, isSel };
      }, idx);

      const hex = rgbToHex(itemInfo?.color);
      if (hex !== '#ffffff' || itemInfo?.hasEq !== false || itemInfo?.isSel !== true) {
        allIdleSelectedWhite = false;
        console.error(`Selection index ${idx} failed: color=${hex}, hasEq=${itemInfo?.hasEq}, isSel=${itemInfo?.isSel}`);
      }
    }
    assertCheck('S2.1: Selecting playlists 0, 1, 2 while idle maintains #ffffff and NO equalizer waves',
      allIdleSelectedWhite,
      'All tested selections remained #ffffff with no false equalizer triggers');

    // 2.2: Cross-selection while playing Playlist 0
    await page.evaluate(() => {
      const dStore = window.__useSpotifyDataStore?.getState();
      const p0 = dStore.playlists[0];
      const testTracks = [
        {
          id: 'track-p0-test-0',
          name: 'Track Row Zero (Playing)',
          duration_ms: 180000,
          playlistId: p0.id,
          artists: [{ name: 'Artist Alpha' }],
          album: { name: 'Album Alpha', images: [] },
        },
        {
          id: 'track-p0-test-1',
          name: 'Track Row One (Idle)',
          duration_ms: 220000,
          playlistId: p0.id,
          artists: [{ name: 'Artist Beta' }],
          album: { name: 'Album Beta', images: [] },
        },
      ];
      p0.tracks = { total: 2, items: testTracks };
      window.__usePlayerStore.setState({ currentTrack: testTracks[0], isPlaying: true, queue: testTracks });
    });
    await new Promise((r) => setTimeout(r, 400));

    // Now select Playlist 1, then Playlist 2
    for (const otherIdx of [1, 2]) {
      await page.evaluate((idx) => {
        const items = Array.from(document.querySelectorAll('aside div.cursor-pointer.group'));
        if (items[idx]) items[idx].click();
      }, otherIdx);
      await new Promise((r) => setTimeout(r, 300));

      const check = await page.evaluate((idx) => {
        const items = Array.from(document.querySelectorAll('aside div.cursor-pointer.group'));
        const p0Item = items[0];
        const selectedItem = items[idx];

        const p0Color = window.getComputedStyle(p0Item.querySelector('p')).color;
        const p0Eq = !!p0Item.querySelector('.animate-bounce');
        const p0Sel = p0Item.className.includes('bg-[#282828]');

        const selColor = window.getComputedStyle(selectedItem.querySelector('p')).color;
        const selEq = !!selectedItem.querySelector('.animate-bounce');
        const selSel = selectedItem.className.includes('bg-[#282828]');

        return { p0Color, p0Eq, p0Sel, selColor, selEq, selSel };
      }, otherIdx);

      const p0Hex = rgbToHex(check.p0Color);
      const selHex = rgbToHex(check.selColor);

      assertCheck(`S2.2.${otherIdx}: Playlist 0 remains green/eq while Playlist ${otherIdx} is selected & stays white/no-eq`,
        p0Hex === '#1ed760' && check.p0Eq === true && check.p0Sel === false &&
        selHex === '#ffffff' && check.selEq === false && check.selSel === true,
        `P0: color=${p0Hex}, eq=${check.p0Eq}, sel=${check.p0Sel} | P${otherIdx}: color=${selHex}, eq=${check.selEq}, sel=${check.selSel}`);
    }

    // 2.3: Select Playlist 0 itself while playing Playlist 0 (both playing AND selected)
    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('aside div.cursor-pointer.group'));
      if (items[0]) items[0].click();
    });
    await new Promise((r) => setTimeout(r, 300));

    const p0PlayingAndSelected = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('aside div.cursor-pointer.group'));
      const p0Item = items[0];
      const color = window.getComputedStyle(p0Item.querySelector('p')).color;
      const hasEq = !!p0Item.querySelector('.animate-bounce');
      const isSel = p0Item.className.includes('bg-[#282828]');
      return { color, hasEq, isSel };
    });
    const p0PlayingAndSelectedHex = rgbToHex(p0PlayingAndSelected.color);
    assertCheck('S2.3: When playing AND selected, Playlist 0 shows green #1ed760, equalizer, AND selected bg',
      p0PlayingAndSelectedHex === '#1ed760' && p0PlayingAndSelected.hasEq === true && p0PlayingAndSelected.isSel === true,
      `Color: ${p0PlayingAndSelectedHex}, eq: ${p0PlayingAndSelected.hasEq}, selected: ${p0PlayingAndSelected.isSel}`);

    // 2.4: Detail view track rows parity check
    await page.evaluate(() => {
      window.__useUIStore?.getState().setActiveMainTab('playlist');
    });
    await new Promise((r) => setTimeout(r, 500));

    const detailViewStatus = await page.evaluate(() => {
      const main = document.querySelector('main');
      const rows = Array.from(main.querySelectorAll('div.space-y-0\\.5 > div'));
      if (rows.length === 0) return { error: 'No rows' };

      const r0Title = rows[0].querySelector('p.text-sm');
      const r0Color = window.getComputedStyle(r0Title).color;
      const r0Eq = !!rows[0].querySelector('.animate-bounce');

      let r1Color = null;
      let r1Eq = null;
      if (rows.length > 1) {
        const r1Title = rows[1].querySelector('p.text-sm');
        r1Color = window.getComputedStyle(r1Title).color;
        r1Eq = !!rows[1].querySelector('.animate-bounce');
      }
      return { rowCount: rows.length, r0Color, r0Eq, r1Color, r1Eq };
    });

    if (detailViewStatus.error) {
      assertCheck('S2.4: Detail view track rows render', false, detailViewStatus.error);
    } else {
      const r0Hex = rgbToHex(detailViewStatus.r0Color);
      assertCheck('S2.4: Playing track row in detail view is green #1ed760 with equalizer',
        r0Hex === '#1ed760' && detailViewStatus.r0Eq === true,
        `r0 color=${r0Hex}, eq=${detailViewStatus.r0Eq}`);

      if (detailViewStatus.rowCount > 1) {
        const r1Hex = rgbToHex(detailViewStatus.r1Color);
        assertCheck('S2.5: Non-playing track row in detail view is white #ffffff with NO equalizer',
          r1Hex === '#ffffff' && detailViewStatus.r1Eq === false,
          `r1 color=${r1Hex}, eq=${detailViewStatus.r1Eq}`);
      }
    }

    // 2.5: Unauthenticated state transition via logout
    console.log('\n--- Section 3: Clean Logout & State Purge ---');
    await page.evaluate(() => {
      window.__useSpotifyDataStore?.getState().logout();
    });
    await new Promise((r) => setTimeout(r, 500));

    const postLogoutState = await page.evaluate(() => {
      const s = window.__useSpotifyDataStore?.getState();
      const p = window.__usePlayerStore?.getState();
      const shimmers = document.querySelectorAll('.animate-pulse').length;
      const text = document.body.innerText;
      return {
        isAuthenticated: s?.isAuthenticated,
        user: s?.user,
        playlistsLength: s?.playlists?.length,
        shelvesLength: s?.dynamicShelves?.length,
        currentTrack: p?.currentTrack,
        isPlaying: p?.isPlaying,
        shimmersCount: shimmers,
        hasLoginPrompt: text.includes('Conecta tu cuenta de Spotify') || text.includes('Iniciar sesión con Spotify'),
      };
    });

    assertCheck('S3.1: Logout resets isAuthenticated to false',
      postLogoutState.isAuthenticated === false,
      `isAuthenticated: ${postLogoutState.isAuthenticated}`);
    assertCheck('S3.2: Logout purges user profile and playlists from store',
      postLogoutState.user === null && postLogoutState.playlistsLength === 0 && postLogoutState.shelvesLength === 0,
      `user: ${postLogoutState.user}, playlists: ${postLogoutState.playlistsLength}, shelves: ${postLogoutState.shelvesLength}`);
    assertCheck('S3.3: Logout renders shimmer skeletons and login prompt',
      postLogoutState.shimmersCount > 0 && postLogoutState.hasLoginPrompt === true,
      `shimmers: ${postLogoutState.shimmersCount}, hasLoginPrompt: ${postLogoutState.hasLoginPrompt}`);

    // Re-sync session before exit so browser is left in a clean authenticated state
    await page.evaluate(async () => {
      const { syncChromeSession } = await import('/src/services/sessionSync.ts');
      await syncChromeSession();
    });
    await new Promise((r) => setTimeout(r, 800));

  } finally {
    await page.close();
    browser.disconnect();
  }

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log('\n' + '='.repeat(80));
  console.log('ADVERSARIAL STRESS-TEST RESULTS SUMMARY:');
  console.log('='.repeat(80));
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`Total checks:  ${total}`);
  console.log(`Passed:        ${passed}`);
  console.log(`Failed:        ${failed}`);

  if (failed > 0) {
    console.log('\nFAILED CHECKS:');
    for (const f of results.filter((r) => !r.passed)) {
      console.log(`- ${f.name}: ${f.details}`);
    }
    process.exit(1);
  } else {
    console.log('\nALL ADVERSARIAL STRESS CHECKS PASSED WITH ZERO DEFECTS.');
  }
}

runAdversarialRecheck().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
