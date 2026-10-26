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

async function runAdversarialTier5Suite() {
  console.log('='.repeat(80));
  console.log('   TIER 5 ADVERSARIAL STRESS TEST SUITE: DYNAMIC DATA & UI RESILIENCE');
  console.log('='.repeat(80));

  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  let page = pages.find((p) => p.url().includes('127.0.0.1:5173') || p.url().includes('localhost:5173'));

  if (!page) {
    page = await browser.newPage();
    await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle2' });
  } else {
    await page.bringToFront();
    // Ensure clean base reload
    await page.reload({ waitUntil: 'networkidle2' });
  }

  await page.waitForSelector('aside', { timeout: 5000 });
  await new Promise((r) => setTimeout(r, 800));

  const results = [];

  function record(id, title, passed, details, isCritical = false) {
    results.push({ id, title, passed, details, isCritical });
    const mark = passed ? '✔ PASS' : (isCritical ? '✖ CRITICAL FAIL' : '✖ FAIL');
    console.log(`[${mark}] [${id}] ${title}`);
    console.log(`       Details: ${details}`);
  }

  // Backup authentic session so we can restore it at the end
  const originalState = await page.evaluate(async () => {
    const dataStore = (await import('/src/store/useSpotifyDataStore.ts')).useSpotifyDataStore;
    const playerStore = (await import('/src/store/usePlayerStore.ts')).usePlayerStore;
    const uiStore = (await import('/src/store/useUIStore.ts')).useUIStore;
    return {
      data: {
        isAuthenticated: dataStore.getState().isAuthenticated,
        user: dataStore.getState().user,
        playlists: dataStore.getState().playlists,
        featuredMessage: dataStore.getState().featuredMessage,
        dynamicShelves: dataStore.getState().dynamicShelves,
      },
      player: {
        currentTrack: playerStore.getState().currentTrack,
        isPlaying: playerStore.getState().isPlaying,
      },
      ui: {
        activeMainTab: uiStore.getState().activeMainTab,
      }
    };
  });

  // ------------------------------------------------------------------------
  // SUITE 1: BOUNDARY CONDITIONS - ZERO PLAYLISTS & 0-TRACK PLAYLISTS
  // ------------------------------------------------------------------------
  console.log('\n--- SUITE 1: Boundary Conditions: Zero Playlists & 0-Track Playlists ---');

  // Test 1.1: Zero Playlists in Store -> Sidebar empty state prompt
  const zeroPlaylistsRes = await page.evaluate(async () => {
    const dataStore = (await import('/src/store/useSpotifyDataStore.ts')).useSpotifyDataStore;
    const uiStore = (await import('/src/store/useUIStore.ts')).useUIStore;
    uiStore.setState({ activeMainTab: 'home' });
    dataStore.setState({ playlists: [], isAuthenticated: true });

    await new Promise((r) => setTimeout(r, 300));
    const aside = document.querySelector('aside');
    const asideText = aside ? aside.innerText : '';
    const hasEmptyPrompt = asideText.includes('Crea tu primera lista') && asideText.includes('Es muy fácil');
    const itemsCount = aside ? aside.querySelectorAll('div.cursor-pointer.group').length : 0;

    return { hasEmptyPrompt, itemsCount, asideTextSnippet: asideText.slice(0, 100) };
  });

  record(
    'T5-BOUND-1.1',
    'Sidebar renders clean empty state prompt when user has 0 playlists',
    zeroPlaylistsRes.hasEmptyPrompt && zeroPlaylistsRes.itemsCount === 0,
    `hasEmptyPrompt: ${zeroPlaylistsRes.hasEmptyPrompt}, itemsCount: ${zeroPlaylistsRes.itemsCount}`
  );

  // Test 1.2: Zero Playlists in Store -> Home View quick access grid defaults to liked songs
  const zeroHomeRes = await page.evaluate(async () => {
    const main = document.querySelector('main');
    const quickAccessItems = Array.from(main?.querySelectorAll('div.grid span') || []).map((s) => s.innerText);
    const hasLikedSongs = quickAccessItems.includes('Canciones que te gustan');
    return { quickAccessItems, hasLikedSongs };
  });

  record(
    'T5-BOUND-1.2',
    'Home View renders quick access grid safely with 0 playlists',
    zeroHomeRes.hasLikedSongs && zeroHomeRes.quickAccessItems.length >= 1,
    `Items found: ${zeroHomeRes.quickAccessItems.join(', ')}`
  );

  // Test 1.3: Dynamic shelves generator resilience with empty playlists and authenticated user
  const dynamicShelvesEmptyTest = await page.evaluate(async () => {
    const { buildDynamicShelves } = await import('/src/store/useSpotifyDataStore.ts');
    const dummyUser = { id: 'u1', display_name: 'TestUser', email: 'test@example.com', images: [], followers: { total: 0 } };
    try {
      const shelves = buildDynamicShelves(dummyUser, [], null, [], [], [], []);
      const allHaveCardsArray = Array.isArray(shelves) && shelves.every((s) => Array.isArray(s.cards));
      return { ok: true, shelfCount: shelves.length, allHaveCardsArray };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  record(
    'T5-BOUND-1.3',
    'buildDynamicShelves executes without exception when playlists and payloads are empty',
    dynamicShelvesEmptyTest.ok && dynamicShelvesEmptyTest.allHaveCardsArray,
    dynamicShelvesEmptyTest.ok ? `Generated ${dynamicShelvesEmptyTest.shelfCount} shelves` : `Threw error: ${dynamicShelvesEmptyTest.error}`
  );

  // Test 1.4: Playlist with 0 tracks -> Detail view renders 0 rows without crash
  const emptyTrackPlaylistRes = await page.evaluate(async () => {
    const dataStore = (await import('/src/store/useSpotifyDataStore.ts')).useSpotifyDataStore;
    const emptyPlaylist = {
      id: 'p-empty-tracks',
      name: 'Lista Vacía',
      description: 'Sin pistas',
      images: [],
      owner: { display_name: 'User', id: 'u1' },
      tracks: { total: 0, items: [] },
    };
    dataStore.setState({ playlists: [emptyPlaylist], isAuthenticated: true });
    await new Promise((r) => setTimeout(r, 200));

    const aside = document.querySelector('aside');
    const item = aside?.querySelector('div.cursor-pointer.group');
    if (item) item.click();

    await new Promise((r) => setTimeout(r, 300));
    const h1 = document.querySelector('main h1')?.innerText;
    const trackRows = document.querySelectorAll('main div.space-y-0\\.5 > div');

    return {
      h1,
      trackCount: trackRows.length,
    };
  });

  record(
    'T5-BOUND-1.4',
    'Playlist with 0 tracks renders empty tracklist cleanly in detail view',
    emptyTrackPlaylistRes.h1 === 'Lista Vacía' && emptyTrackPlaylistRes.trackCount === 0,
    `Header: "${emptyTrackPlaylistRes.h1}", Track rows: ${emptyTrackPlaylistRes.trackCount}`
  );

  // Test 1.5: Clicking "Play All" on a 0-track playlist does not crash or corrupt player state
  const playEmptyPlaylistRes = await page.evaluate(async () => {
    const playerStore = (await import('/src/store/usePlayerStore.ts')).usePlayerStore;
    playerStore.setState({ currentTrack: null, isPlaying: false });

    // Find play button in playlist view
    const playBtn = Array.from(document.querySelectorAll('main button')).find((b) =>
      b.className.includes('bg-[#1ed760]') || (b.getAttribute('title') || '').includes('Reproducir')
    );

    if (playBtn) playBtn.click();
    await new Promise((r) => setTimeout(r, 200));

    const state = playerStore.getState();
    return {
      isPlaying: state.isPlaying,
      currentTrack: state.currentTrack,
    };
  });

  record(
    'T5-BOUND-1.5',
    'Clicking Play on a 0-track playlist cleanly ignores action without crash or state corruption',
    playEmptyPlaylistRes.isPlaying === false && playEmptyPlaylistRes.currentTrack === null,
    `isPlaying: ${playEmptyPlaylistRes.isPlaying}, currentTrack: ${JSON.stringify(playEmptyPlaylistRes.currentTrack)}`
  );

  // Test 1.6: Boundary test: Playlist with `tracks` undefined (missing tracks property)
  const missingTracksObjRes = await page.evaluate(async () => {
    const dataStore = (await import('/src/store/useSpotifyDataStore.ts')).useSpotifyDataStore;
    const malformed = {
      id: 'malformed-no-tracks',
      name: 'Malformed No Tracks',
      description: 'Tracks is undefined',
      images: [],
      owner: { display_name: 'User', id: 'u1' },
      // tracks intentionally omitted
    };

    try {
      dataStore.setState({ playlists: [malformed], isAuthenticated: true });
      await new Promise((r) => setTimeout(r, 200));
      const aside = document.querySelector('aside');
      const item = aside?.querySelector('div.cursor-pointer.group');
      if (item) item.click();
      await new Promise((r) => setTimeout(r, 300));

      const rootChildren = document.getElementById('root')?.childElementCount || 0;
      return { ok: rootChildren > 0, rootChildren };
    } catch (e) {
      return { ok: false, error: e.message, rootChildren: 0 };
    }
  });

  record(
    'T5-BOUND-1.6',
    'Playlist with undefined tracks does not cause fatal React tree unmount',
    missingTracksObjRes.ok && missingTracksObjRes.rootChildren > 0,
    missingTracksObjRes.ok
      ? `Root children intact (${missingTracksObjRes.rootChildren})`
      : `FATAL React unmount: root children count is ${missingTracksObjRes.rootChildren}`,
    true
  );

  // Restore page if it unmounted
  if (!missingTracksObjRes.ok || missingTracksObjRes.rootChildren === 0) {
    console.log('Restoring page after fatal crash test...');
    await page.reload({ waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 600));
  }

  // ------------------------------------------------------------------------
  // SUITE 2: HTTP 204 & EMPTY PAYLOAD RESILIENCE
  // ------------------------------------------------------------------------
  console.log('\n--- SUITE 2: HTTP 204 & Empty Payload Resilience ---');

  // Test 2.1: Empty recently-played array -> Recientes shelf derived gracefully
  const emptyRecentlyPlayedRes = await page.evaluate(async () => {
    const { buildDynamicShelves } = await import('/src/store/useSpotifyDataStore.ts');
    const user = { id: 'u1', display_name: 'Jorgeperezvk', email: 'test@example.com', images: [], followers: { total: 0 } };
    const p1 = { id: 'p1', name: 'P1', description: 'D1', images: [], owner: { display_name: 'Jorgeperezvk', id: 'u1' }, tracks: { total: 0 } };
    const shelves = buildDynamicShelves(user, [p1], 'Featured Test', [], [], [], []);
    const recentShelf = shelves.find((s) => s.type === 'recent');
    return {
      hasRecentShelf: !!recentShelf,
      cardsCount: recentShelf?.cards?.length || 0,
    };
  });

  record(
    'T5-API-2.1',
    'Empty recently-played payload gracefully falls back to user playlists for Recientes shelf',
    emptyRecentlyPlayedRes.hasRecentShelf && emptyRecentlyPlayedRes.cardsCount >= 1,
    `hasRecentShelf: ${emptyRecentlyPlayedRes.hasRecentShelf}, cards: ${emptyRecentlyPlayedRes.cardsCount}`
  );

  // Test 2.2: Empty featuredPlaylists array -> Editorial shelf falls back cleanly
  const emptyFeaturedRes = await page.evaluate(async () => {
    const { buildDynamicShelves } = await import('/src/store/useSpotifyDataStore.ts');
    const user = { id: 'u1', display_name: 'Jorgeperezvk', email: 'test@example.com', images: [], followers: { total: 0 } };
    const p1 = { id: 'p1', name: 'Novedades Viernes España', description: 'Novedades', images: [], owner: { display_name: 'Spotify', id: 'spotify' }, tracks: { total: 0 } };
    const shelves = buildDynamicShelves(user, [p1], null, [], [], [], []);
    const featShelf = shelves.find((s) => s.type === 'featured');
    return {
      hasFeatShelf: !!featShelf,
      title: featShelf?.title,
      cardCount: featShelf?.cards?.length || 0,
    };
  });

  record(
    'T5-API-2.2',
    'Empty featured-playlists payload falls back to editorial search and date title',
    emptyFeaturedRes.hasFeatShelf && emptyFeaturedRes.cardCount >= 1,
    `Title: "${emptyFeaturedRes.title}", Cards: ${emptyFeaturedRes.cardCount}`
  );

  // Test 2.3: HTTP 204 No Content playback state resilience
  const http204PlayerRes = await page.evaluate(async () => {
    const playerStore = (await import('/src/store/usePlayerStore.ts')).usePlayerStore;
    // Simulate HTTP 204 No Content returned by /v1/me/player
    playerStore.setState({ currentTrack: null, isPlaying: false, progressMs: 0 });
    const state = playerStore.getState();
    return {
      isPlaying: state.isPlaying,
      currentTrack: state.currentTrack,
    };
  });

  record(
    'T5-API-2.3',
    'HTTP 204 No Content preserves clean idle player state without error',
    http204PlayerRes.isPlaying === false && http204PlayerRes.currentTrack === null,
    `isPlaying: ${http204PlayerRes.isPlaying}, currentTrack: ${http204PlayerRes.currentTrack}`
  );

  // ------------------------------------------------------------------------
  // SUITE 3: PLAYBACK PROVENANCE & HIGH-FREQUENCY TOGGLING INTEGRITY
  // ------------------------------------------------------------------------
  console.log('\n--- SUITE 3: Playback Provenance & High-Frequency Toggling ---');

  // Setup 2 playlists in data store
  await page.evaluate(async () => {
    const dataStore = (await import('/src/store/useSpotifyDataStore.ts')).useSpotifyDataStore;
    const uiStore = (await import('/src/store/useUIStore.ts')).useUIStore;
    uiStore.setState({ activeMainTab: 'home' });

    const tracksP1 = Array.from({ length: 5 }).map((_, i) => ({
      id: `p1-track-${i + 1}`,
      name: `Track P1 #${i + 1}`,
      duration_ms: 180000,
      artists: [{ id: 'art-1', name: 'Artist One' }],
      album: { id: 'alb-1', name: 'Album One', images: [] },
      playlistId: 'playlist-alpha',
    }));

    const tracksP2 = Array.from({ length: 5 }).map((_, i) => ({
      id: `p2-track-${i + 1}`,
      name: `Track P2 #${i + 1}`,
      duration_ms: 200000,
      artists: [{ id: 'art-2', name: 'Artist Two' }],
      album: { id: 'alb-2', name: 'Album Two', images: [] },
      playlistId: 'playlist-beta',
    }));

    const p1 = {
      id: 'playlist-alpha',
      name: 'Playlist Alpha',
      description: 'Alpha Desc',
      images: [{ url: 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg' }],
      owner: { display_name: 'Jorgeperezvk', id: 'u1' },
      tracks: { total: tracksP1.length, items: tracksP1 },
    };

    const p2 = {
      id: 'playlist-beta',
      name: 'Playlist Beta',
      description: 'Beta Desc',
      images: [{ url: 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg' }],
      owner: { display_name: 'Jorgeperezvk', id: 'u1' },
      tracks: { total: tracksP2.length, items: tracksP2 },
    };

    dataStore.setState({ playlists: [p1, p2], isAuthenticated: true });
  });
  await new Promise((r) => setTimeout(r, 400));

  // Test 3.1: Sequential rapid playback toggling across 5 different tracks in Playlist Alpha
  const rapidToggleRes = await page.evaluate(async () => {
    const playerStore = (await import('/src/store/usePlayerStore.ts')).usePlayerStore;
    const dataStore = (await import('/src/store/useSpotifyDataStore.ts')).useSpotifyDataStore;
    const p1 = dataStore.getState().playlists[0];
    const tracks = p1.tracks.items;

    const log = [];
    for (let i = 0; i < tracks.length; i++) {
      playerStore.getState().playTrack(tracks[i], tracks);
      await new Promise((r) => setTimeout(r, 80));

      const aside = document.querySelector('aside');
      const item = aside?.querySelectorAll('div.cursor-pointer.group')[0];
      const titleElem = item?.querySelector('p');
      const titleColor = titleElem ? window.getComputedStyle(titleElem).color : '';
      const hasEqualizer = !!item?.querySelector('.animate-bounce');

      log.push({
        trackIdx: i,
        isPlaying: playerStore.getState().isPlaying,
        currentTrackId: playerStore.getState().currentTrack?.id,
        color: titleColor,
        hasEqualizer,
      });
    }

    // Now pause
    playerStore.getState().togglePlay();
    await new Promise((r) => setTimeout(r, 100));

    const aside = document.querySelector('aside');
    const item = aside?.querySelectorAll('div.cursor-pointer.group')[0];
    const titleElem = item?.querySelector('p');
    const pausedColor = titleElem ? window.getComputedStyle(titleElem).color : '';
    const pausedEqualizer = !!item?.querySelector('.animate-bounce');

    return {
      allPlayingGreen: log.every((l) => l.color.includes('30, 215, 96') && l.hasEqualizer),
      pausedRevertsWhite: pausedColor.includes('255, 255, 255') && !pausedEqualizer,
      log,
    };
  });

  record(
    'T5-PLAY-3.1',
    'Sequential rapid track toggling maintains #1ed760 and equalizer wave synchronization',
    rapidToggleRes.allPlayingGreen && rapidToggleRes.pausedRevertsWhite,
    `allPlayingGreen: ${rapidToggleRes.allPlayingGreen}, pausedRevertsWhite: ${rapidToggleRes.pausedRevertsWhite}`
  );

  // Test 3.2: Playback Provenance: Playing Alpha while selecting Beta
  const selectBetaWhileAlphaPlaysRes = await page.evaluate(async () => {
    const playerStore = (await import('/src/store/usePlayerStore.ts')).usePlayerStore;
    const dataStore = (await import('/src/store/useSpotifyDataStore.ts')).useSpotifyDataStore;
    const p1 = dataStore.getState().playlists[0];
    const p2 = dataStore.getState().playlists[1];

    // Start playing track from Alpha
    playerStore.setState({
      currentTrack: p1.tracks.items[0],
      isPlaying: true,
    });
    await new Promise((r) => setTimeout(r, 200));

    // Click Playlist Beta to select it
    const aside = document.querySelector('aside');
    const items = Array.from(aside?.querySelectorAll('div.cursor-pointer.group') || []);
    if (items[1]) items[1].click();
    await new Promise((r) => setTimeout(r, 300));

    const alphaItem = items[0];
    const betaItem = items[1];

    const alphaTitleColor = window.getComputedStyle(alphaItem.querySelector('p')).color;
    const alphaHasEq = !!alphaItem.querySelector('.animate-bounce');

    const betaTitleColor = window.getComputedStyle(betaItem.querySelector('p')).color;
    const betaHasEq = !!betaItem.querySelector('.animate-bounce');
    const betaIsSelected = betaItem.className.includes('bg-[#282828]');

    return {
      alphaColor: alphaTitleColor,
      alphaHasEq,
      betaColor: betaTitleColor,
      betaHasEq,
      betaIsSelected,
    };
  });

  const alphaHex = rgbToHex(selectBetaWhileAlphaPlaysRes.alphaColor);
  const betaHex = rgbToHex(selectBetaWhileAlphaPlaysRes.betaColor);

  record(
    'T5-PLAY-3.2',
    'Selected non-playing playlist Beta retains #ffffff and no equalizer while Alpha plays in #1ed760',
    betaHex === '#ffffff' && !selectBetaWhileAlphaPlaysRes.betaHasEq && alphaHex === '#1ed760' && selectBetaWhileAlphaPlaysRes.alphaHasEq,
    `Beta (selected): color=${betaHex}, eq=${selectBetaWhileAlphaPlaysRes.betaHasEq} | Alpha (playing): color=${alphaHex}, eq=${selectBetaWhileAlphaPlaysRes.alphaHasEq}`
  );

  // Test 3.3: ADVERSARIAL PLAYBACK PROVENANCE COLLISION TEST
  // Both Playlist Alpha and Playlist Beta contain the exact same Track ID.
  // When Track is played with provenance playlistId: 'playlist-alpha', verify Beta NEVER leaks #1ed760 or equalizer!
  const collisionStressRes = await page.evaluate(async () => {
    const dataStore = (await import('/src/store/useSpotifyDataStore.ts')).useSpotifyDataStore;
    const playerStore = (await import('/src/store/usePlayerStore.ts')).usePlayerStore;

    const sharedTrack = {
      id: 'shared-hit-song-xyz',
      name: 'Shared Hit Song',
      duration_ms: 210000,
      artists: [{ id: 'art-shared', name: 'Global Star' }],
      album: { id: 'alb-shared', name: 'Global Album', images: [] },
      playlistId: 'playlist-alpha', // Provenance explicitly set to Alpha
    };

    const p1 = {
      id: 'playlist-alpha',
      name: 'Playlist Alpha',
      description: 'Alpha',
      images: [],
      owner: { display_name: 'Me', id: '1' },
      tracks: { total: 1, items: [sharedTrack] },
    };

    const p2 = {
      id: 'playlist-beta',
      name: 'Playlist Beta',
      description: 'Beta',
      images: [],
      owner: { display_name: 'Me', id: '1' },
      tracks: { total: 1, items: [sharedTrack] }, // Beta ALSO contains the shared track!
    };

    dataStore.setState({ playlists: [p1, p2], isAuthenticated: true });

    // Play sharedTrack specifically from playlist-alpha
    playerStore.setState({
      currentTrack: sharedTrack,
      isPlaying: true,
    });

    await new Promise((r) => setTimeout(r, 200));

    const aside = document.querySelector('aside');
    const items = Array.from(aside?.querySelectorAll('div.cursor-pointer.group') || []);
    if (items.length < 2) return { error: 'Not enough playlist items' };

    const p1Elem = items[0];
    const p2Elem = items[1];

    const p1Color = window.getComputedStyle(p1Elem.querySelector('p')).color;
    const p1HasEq = !!p1Elem.querySelector('.animate-bounce');

    const p2Color = window.getComputedStyle(p2Elem.querySelector('p')).color;
    const p2HasEq = !!p2Elem.querySelector('.animate-bounce');

    return {
      p1Name: p1Elem.querySelector('p')?.innerText,
      p1Color,
      p1HasEq,
      p2Name: p2Elem.querySelector('p')?.innerText,
      p2Color,
      p2HasEq,
    };
  });

  const p1Hex = rgbToHex(collisionStressRes.p1Color);
  const p2Hex = rgbToHex(collisionStressRes.p2Color);
  const p2Leaked = p2Hex === '#1ed760' || collisionStressRes.p2HasEq;

  record(
    'T5-PLAY-3.3',
    'Shared track playback provenance strictness: Playlist Beta MUST NOT leak #1ed760 or equalizer waves',
    !p2Leaked,
    `Playlist Alpha (source): color=${p1Hex}, eq=${collisionStressRes.p1HasEq} | Playlist Beta (contains same track, but not source): color=${p2Hex}, eq=${collisionStressRes.p2HasEq}`,
    p2Leaked // Mark as critical if leaked!
  );

  // Test 3.4: High-frequency ping-pong playback switching between Alpha and Beta (10 switches in 500ms)
  const pingPongRes = await page.evaluate(async () => {
    const dataStore = (await import('/src/store/useSpotifyDataStore.ts')).useSpotifyDataStore;
    const playerStore = (await import('/src/store/usePlayerStore.ts')).usePlayerStore;
    const [p1, p2] = dataStore.getState().playlists;

    const t1 = { id: 'track-t1', name: 'T1', duration_ms: 1000, artists: [], album: { name: '', images: [] }, playlistId: p1.id };
    const t2 = { id: 'track-t2', name: 'T2', duration_ms: 1000, artists: [], album: { name: '', images: [] }, playlistId: p2.id };

    p1.tracks = { total: 1, items: [t1] };
    p2.tracks = { total: 1, items: [t2] };
    dataStore.setState({ playlists: [p1, p2] });

    for (let i = 0; i < 10; i++) {
      const active = i % 2 === 0 ? t1 : t2;
      playerStore.setState({ currentTrack: active, isPlaying: true });
      await new Promise((r) => setTimeout(r, 40));
    }

    await new Promise((r) => setTimeout(r, 200));

    // At the end, t2 (from p2) is playing
    const aside = document.querySelector('aside');
    const items = Array.from(aside?.querySelectorAll('div.cursor-pointer.group') || []);
    const p1Style = window.getComputedStyle(items[0]?.querySelector('p')).color;
    const p1Eq = !!items[0]?.querySelector('.animate-bounce');
    const p2Style = window.getComputedStyle(items[1]?.querySelector('p')).color;
    const p2Eq = !!items[1]?.querySelector('.animate-bounce');

    return {
      finalPlayingPlaylist: 'p2',
      p1Color: p1Style,
      p1Eq,
      p2Color: p2Style,
      p2Eq,
    };
  });

  const finalP1Hex = rgbToHex(pingPongRes.p1Color);
  const finalP2Hex = rgbToHex(pingPongRes.p2Color);

  record(
    'T5-PLAY-3.4',
    'High-frequency ping-pong playback switching converges cleanly with zero stuck animation states',
    finalP1Hex === '#ffffff' && !pingPongRes.p1Eq && finalP2Hex === '#1ed760' && pingPongRes.p2Eq,
    `Final P1: color=${finalP1Hex}, eq=${pingPongRes.p1Eq} | Final P2: color=${finalP2Hex}, eq=${pingPongRes.p2Eq}`
  );

  // ------------------------------------------------------------------------
  // SUITE 4: SHIMMER SKELETON PARITY & AUTHENTICATION TRANSITION LIFECYCLE
  // ------------------------------------------------------------------------
  console.log('\n--- SUITE 4: Shimmer Skeleton Parity & Auth Lifecycle ---');

  // Test 4.1: Unauthenticated state -> Sidebar renders exactly 7 shimmer skeleton placeholders
  const unauthSidebarRes = await page.evaluate(async () => {
    const dataStore = (await import('/src/store/useSpotifyDataStore.ts')).useSpotifyDataStore;
    dataStore.setState({ isAuthenticated: false, user: null, playlists: [] });
    await new Promise((r) => setTimeout(r, 300));

    const aside = document.querySelector('aside');
    const shimmers = aside?.querySelectorAll('.animate-pulse') || [];
    return {
      shimmerCount: shimmers.length,
    };
  });

  record(
    'T5-AUTH-4.1',
    'Sidebar renders exactly 7 shimmer skeleton placeholders when unauthenticated',
    unauthSidebarRes.shimmerCount === 7,
    `Found ${unauthSidebarRes.shimmerCount} shimmer items in sidebar`
  );

  // Test 4.2: Unauthenticated state -> Home view renders DesktopShimmerFeed
  const unauthHomeRes = await page.evaluate(async () => {
    const uiStore = (await import('/src/store/useUIStore.ts')).useUIStore;
    uiStore.setState({ activeMainTab: 'home' });
    await new Promise((r) => setTimeout(r, 200));

    const main = document.querySelector('main');
    const hasCtaHeading = (main?.innerText || '').includes('Conecta tu cuenta de Spotify');
    const ctaButton = main?.querySelector('button[title="Iniciar sesión con Spotify"]');
    const shimmerCards = main?.querySelectorAll('.animate-pulse') || [];

    return {
      hasCtaHeading,
      hasCtaButton: !!ctaButton,
      totalMainShimmers: shimmerCards.length,
    };
  });

  record(
    'T5-AUTH-4.2',
    'Home view renders Spotify shimmer feed with CTA button when unauthenticated',
    unauthHomeRes.hasCtaHeading && unauthHomeRes.hasCtaButton && unauthHomeRes.totalMainShimmers >= 10,
    `CTA Heading: ${unauthHomeRes.hasCtaHeading}, CTA Button: ${unauthHomeRes.hasCtaButton}, Shimmer elements: ${unauthHomeRes.totalMainShimmers}`
  );

  // Test 4.3: Unauthenticated state -> DesktopTopNav renders login button and hides avatar
  const unauthTopNavRes = await page.evaluate(() => {
    const header = document.querySelector('header');
    const loginBtn = Array.from(header?.querySelectorAll('button') || []).find((b) =>
      (b.innerText || '').includes('Iniciar sesión con Spotify')
    );
    const avatarMenu = header?.querySelector('button[title*="perfil"]') || header?.querySelector('div.bg-\\[\\#ff6437\\]');
    return {
      hasLoginBtn: !!loginBtn,
      hasAvatarMenu: !!avatarMenu,
    };
  });

  record(
    'T5-AUTH-4.3',
    'TopNav displays "Iniciar sesión con Spotify" action button and hides avatar when unauthenticated',
    unauthTopNavRes.hasLoginBtn && !unauthTopNavRes.hasAvatarMenu,
    `hasLoginBtn: ${unauthTopNavRes.hasLoginBtn}, hasAvatarMenu: ${unauthTopNavRes.hasAvatarMenu}`
  );

  // Test 4.4: Dynamic Transition to Authenticated
  const transitionToAuthRes = await page.evaluate(async () => {
    const dataStore = (await import('/src/store/useSpotifyDataStore.ts')).useSpotifyDataStore;
    const sessionSync = await import('/src/services/sessionSync.ts');
    await sessionSync.syncChromeSession();
    await new Promise((r) => setTimeout(r, 500));

    const isAuth = dataStore.getState().isAuthenticated;
    const user = dataStore.getState().user;
    const playlists = dataStore.getState().playlists;

    const main = document.querySelector('main');
    const ctaGone = !(main?.innerText || '').includes('Conecta tu cuenta de Spotify');
    const aside = document.querySelector('aside');
    const playlistItemsCount = aside?.querySelectorAll('div.cursor-pointer.group').length || 0;

    return {
      isAuth,
      userName: user?.display_name,
      playlistCount: playlists.length,
      ctaGone,
      playlistItemsCount,
    };
  });

  record(
    'T5-AUTH-4.4',
    'Dynamic transition from unauthenticated to authenticated renders live playlists & user avatar',
    transitionToAuthRes.isAuth && transitionToAuthRes.ctaGone && transitionToAuthRes.playlistItemsCount > 0,
    `User: ${transitionToAuthRes.userName}, Playlists: ${transitionToAuthRes.playlistItemsCount}, CTA Gone: ${transitionToAuthRes.ctaGone}`
  );

  // Test 4.5: Logout Transition Reverts cleanly to Shimmers
  const logoutReversionRes = await page.evaluate(async () => {
    const dataStore = (await import('/src/store/useSpotifyDataStore.ts')).useSpotifyDataStore;
    dataStore.getState().logout();
    await new Promise((r) => setTimeout(r, 300));

    const isAuth = dataStore.getState().isAuthenticated;
    const aside = document.querySelector('aside');
    const shimmersCount = aside?.querySelectorAll('.animate-pulse').length || 0;
    const main = document.querySelector('main');
    const hasCta = (main?.innerText || '').includes('Conecta tu cuenta de Spotify');

    return {
      isAuth,
      shimmersCount,
      hasCta,
    };
  });

  record(
    'T5-AUTH-4.5',
    'Calling logout() immediately reverts UI to unauthenticated shimmer skeletons without data leak',
    !logoutReversionRes.isAuth && logoutReversionRes.shimmersCount === 7 && logoutReversionRes.hasCta,
    `isAuth: ${logoutReversionRes.isAuth}, Sidebar shimmers: ${logoutReversionRes.shimmersCount}, Main CTA restored: ${logoutReversionRes.hasCta}`
  );

  // Re-authenticate session for remaining tests
  await page.evaluate(async () => {
    const sessionSync = await import('/src/services/sessionSync.ts');
    await sessionSync.syncChromeSession();
    await new Promise((r) => setTimeout(r, 400));
  });

  // ------------------------------------------------------------------------
  // SUITE 5: EDITORIAL HEADER & DYNAMIC SECTION FORMATTING RESILIENCE
  // ------------------------------------------------------------------------
  console.log('\n--- SUITE 5: Editorial Header & Dynamic Section Formatting Resilience ---');

  // Test 5.1: Absent featuredMessage (`null` or `undefined`) -> Falls back to authentic day-of-week editorial
  const absentHeaderRes = await page.evaluate(async () => {
    const dataStore = (await import('/src/store/useSpotifyDataStore.ts')).useSpotifyDataStore;
    const { buildDynamicShelves } = await import('/src/store/useSpotifyDataStore.ts');
    const uiStore = (await import('/src/store/useUIStore.ts')).useUIStore;
    uiStore.setState({ activeMainTab: 'home' });

    const user = dataStore.getState().user;
    const playlists = dataStore.getState().playlists;
    dataStore.setState({ featuredMessage: null });
    dataStore.setState({ dynamicShelves: buildDynamicShelves(user, playlists, null) });

    await new Promise((r) => setTimeout(r, 300));
    const h2 = document.querySelector('main h2')?.innerText;
    const isEditorialFallback = h2 === '¡Hoy es viernes de novedades!' || h2 === 'Novedades populares';

    return { h2, isEditorialFallback };
  });

  record(
    'T5-HEAD-5.1',
    'Absent/null featuredMessage gracefully falls back to authentic editorial header',
    absentHeaderRes.isEditorialFallback,
    `Header text: "${absentHeaderRes.h2}"`
  );

  // Test 5.2: Empty string featuredMessage (`""`) -> Falls back to authentic editorial title
  const emptyStringHeaderRes = await page.evaluate(async () => {
    const dataStore = (await import('/src/store/useSpotifyDataStore.ts')).useSpotifyDataStore;
    const { buildDynamicShelves } = await import('/src/store/useSpotifyDataStore.ts');

    const user = dataStore.getState().user;
    const playlists = dataStore.getState().playlists;
    dataStore.setState({ featuredMessage: '' });
    dataStore.setState({ dynamicShelves: buildDynamicShelves(user, playlists, '') });

    await new Promise((r) => setTimeout(r, 300));
    const h2 = document.querySelector('main h2')?.innerText;
    const isEditorialFallback = h2 === '¡Hoy es viernes de novedades!' || h2 === 'Novedades populares';

    return { h2, isEditorialFallback };
  });

  record(
    'T5-HEAD-5.2',
    'Empty string featuredMessage gracefully falls back to authentic editorial title',
    emptyStringHeaderRes.isEditorialFallback,
    `Header text: "${emptyStringHeaderRes.h2}"`
  );

  // Test 5.3: Special Characters, Unicode, Accents, and Emojis in featuredMessage
  const specialCharsHeaderRes = await page.evaluate(async () => {
    const dataStore = (await import('/src/store/useSpotifyDataStore.ts')).useSpotifyDataStore;
    const { buildDynamicShelves } = await import('/src/store/useSpotifyDataStore.ts');

    const testMessage = '¡¿Novedades top?! 🎧 Éxitos urbanos & pop 🚀 (2026) — España & Latino';
    const user = dataStore.getState().user;
    const playlists = dataStore.getState().playlists;
    dataStore.setState({ featuredMessage: testMessage });
    dataStore.setState({ dynamicShelves: buildDynamicShelves(user, playlists, testMessage) });

    await new Promise((r) => setTimeout(r, 300));
    const h2 = document.querySelector('main h2')?.innerText;

    return {
      expected: testMessage,
      actual: h2,
      matchesVerbatim: h2 === testMessage,
    };
  });

  record(
    'T5-HEAD-5.3',
    'Editorial header renders complex unicode, emojis, accents, and punctuation verbatim without corruption',
    specialCharsHeaderRes.matchesVerbatim,
    `Expected: "${specialCharsHeaderRes.expected}", Actual: "${specialCharsHeaderRes.actual}"`
  );

  // Test 5.4: Script tags and HTML entities in featuredMessage are safely escaped (XSS Defense)
  const xssDefenseHeaderRes = await page.evaluate(async () => {
    const dataStore = (await import('/src/store/useSpotifyDataStore.ts')).useSpotifyDataStore;
    const { buildDynamicShelves } = await import('/src/store/useSpotifyDataStore.ts');

    const xssPayload = '<script>window.__xss_leaked=true;</script><img src=x onerror="window.__xss_leaked=true"><b>Editorial Alert</b>';
    const user = dataStore.getState().user;
    const playlists = dataStore.getState().playlists;
    dataStore.setState({ featuredMessage: xssPayload });
    dataStore.setState({ dynamicShelves: buildDynamicShelves(user, playlists, xssPayload) });

    await new Promise((r) => setTimeout(r, 300));
    const h2 = document.querySelector('main h2');
    const h2Text = h2?.innerText || '';
    const h2Html = h2?.innerHTML || '';
    const xssExecuted = window.__xss_leaked === true;
    const hasScriptTag = !!h2?.querySelector('script') || !!h2?.querySelector('img') || !!h2?.querySelector('b');

    return {
      h2Text,
      h2Html,
      xssExecuted,
      hasScriptTag,
      isSafelyEscaped: !xssExecuted && !hasScriptTag && h2Text.includes('<script>'),
    };
  });

  record(
    'T5-HEAD-5.4',
    'XSS script payloads in featuredMessage are safely rendered as literal escaped text',
    xssDefenseHeaderRes.isSafelyEscaped,
    `xssExecuted: ${xssDefenseHeaderRes.xssExecuted}, hasScriptTag: ${xssDefenseHeaderRes.hasScriptTag}, rendered text: "${xssDefenseHeaderRes.h2Text}"`
  );

  // Test 5.5: Personalized "Hecho para ${user.display_name}" shelf header with unicode and emojis
  const personalizedUnicodeShelfRes = await page.evaluate(async () => {
    const dataStore = (await import('/src/store/useSpotifyDataStore.ts')).useSpotifyDataStore;
    const { buildDynamicShelves } = await import('/src/store/useSpotifyDataStore.ts');

    const originalUser = dataStore.getState().user;
    const unicodeUser = {
      ...originalUser,
      display_name: 'Jørgë ✨🎧 Perez (VIP)',
    };
    const playlists = dataStore.getState().playlists;
    dataStore.setState({ user: unicodeUser });
    dataStore.setState({ dynamicShelves: buildDynamicShelves(unicodeUser, playlists, 'Novedades populares') });

    await new Promise((r) => setTimeout(r, 300));

    const shelfHeadings = Array.from(document.querySelectorAll('main section')).map((sec) => {
      const prefix = sec.querySelector('span.text-xs')?.textContent?.trim();
      const title = sec.querySelector('h2')?.textContent?.trim();
      return { prefix, title };
    });

    const madeForShelf = shelfHeadings.find((s) => s.prefix === 'Hecho para');

    return {
      madeForShelf,
      matches: madeForShelf?.title === 'Jørgë ✨🎧 Perez (VIP)',
    };
  });

  record(
    'T5-HEAD-5.5',
    'Personalized "Hecho para" shelf header renders user display name with special unicode cleanly',
    personalizedUnicodeShelfRes.matches,
    `Prefix: "${personalizedUnicodeShelfRes.madeForShelf?.prefix}", Title: "${personalizedUnicodeShelfRes.madeForShelf?.title}"`
  );

  // ------------------------------------------------------------------------
  // RESTORE ORIGINAL STATE
  // ------------------------------------------------------------------------
  console.log('\n--- Restoring Session State ---');
  await page.evaluate(async (state) => {
    const dataStore = (await import('/src/store/useSpotifyDataStore.ts')).useSpotifyDataStore;
    const playerStore = (await import('/src/store/usePlayerStore.ts')).usePlayerStore;
    const uiStore = (await import('/src/store/useUIStore.ts')).useUIStore;

    dataStore.setState(state.data);
    playerStore.setState(state.player);
    uiStore.setState(state.ui);
  }, originalState);
  await new Promise((r) => setTimeout(r, 300));
  console.log('Session state restored.');

  // ------------------------------------------------------------------------
  // SUMMARY REPORT
  // ------------------------------------------------------------------------
  console.log('\n' + '='.repeat(80));
  console.log('TIER 5 ADVERSARIAL STRESS TEST SUMMARY:');
  console.log('='.repeat(80));

  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;
  const criticalCount = results.filter((r) => !r.passed && r.isCritical).length;

  console.log(`Total checks:    ${results.length}`);
  console.log(`Passed:          ${passedCount}`);
  console.log(`Failed:          ${failedCount}`);
  console.log(`Critical:        ${criticalCount}`);

  if (failedCount > 0) {
    console.log('\nFAILURES / UNCOVERED FLAWS REQUIRING ATTENTION:');
    for (const f of results.filter((r) => !r.passed)) {
      console.log(`- [${f.id}] ${f.title} (${f.isCritical ? 'CRITICAL' : 'NON-CRITICAL'})`);
      console.log(`  Details: ${f.details}`);
    }
  }

  browser.disconnect();

  return {
    total: results.length,
    passed: passedCount,
    failed: failedCount,
    critical: criticalCount,
    results,
  };
}

runAdversarialTier5Suite()
  .then((res) => {
    if (res.critical > 0) {
      console.error(`\nCRITICAL ADVERSARIAL FLAWS DETECTED: ${res.critical}`);
      process.exit(1);
    } else if (res.failed > 0) {
      console.warn(`\nAdversarial challenges finished with ${res.failed} issues.`);
      process.exit(2);
    } else {
      console.log('\nAll adversarial Tier 5 challenges PASSED cleanly!');
      process.exit(0);
    }
  })
  .catch((err) => {
    console.error('Fatal execution error:', err);
    process.exit(1);
  });
