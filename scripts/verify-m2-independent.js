import puppeteer from 'puppeteer-core';

async function run() {
  console.log('=== STARTING INDEPENDENT REVIEWER VERIFICATION ===');
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle2' });

  // 1. Initial State & TopNav
  console.log('\n--- 1. INITIAL AUTHENTICATED STATE ---');
  const initData = await page.evaluate(() => {
    const s = window.__useSpotifyDataStore?.getState();
    const header = document.querySelector('header');
    const loginBtn = Array.from(header?.querySelectorAll('button') || []).find(b => b.textContent?.includes('Iniciar sesión con Spotify'));
    const avatar = header?.querySelector('button[title="Jorgeperezvk"], button[title="Perfil"]');
    return {
      auth: s?.isAuthenticated,
      user: s?.user?.display_name,
      hasLoginBtn: !!loginBtn,
      hasAvatar: !!avatar,
      playlistsCount: s?.playlists?.length
    };
  });
  console.log('Init state:', JSON.stringify(initData, null, 2));

  // 2. Typography & Fonts in Sidebar
  console.log('\n--- 2. TYPOGRAPHY PARITY & COMPUTED STYLES ---');
  const typography = await page.evaluate(() => {
    const sidebar = document.querySelector('aside.w-\\[330px\\]');
    const firstTitle = sidebar?.querySelector('div.min-w-0 p');
    const firstSubtitle = sidebar?.querySelector('div.min-w-0 div span.truncate');

    if (!firstTitle || !firstSubtitle) return { error: 'Sidebar items not found' };

    const titleStyle = window.getComputedStyle(firstTitle);
    const subtitleStyle = window.getComputedStyle(firstSubtitle);

    return {
      titleText: firstTitle.innerText,
      titleFontSize: titleStyle.fontSize,
      titleFontFamily: titleStyle.fontFamily,
      titleColor: titleStyle.color,
      titleClasses: firstTitle.className,
      subtitleText: firstSubtitle.innerText,
      subtitleFontSize: subtitleStyle.fontSize,
      subtitleFontFamily: subtitleStyle.fontFamily,
      subtitleColor: subtitleStyle.color,
      subtitleClasses: firstSubtitle.className
    };
  });
  console.log('Sidebar typography:', JSON.stringify(typography, null, 2));

  // 3. Selection vs Playing State Parity in Sidebar
  console.log('\n--- 3. SELECTION VS PLAYING STATE PARITY ---');
  const parity = await page.evaluate(async () => {
    const dataStore = window.__useSpotifyDataStore;
    const playerStore = (await import('/src/store/usePlayerStore.ts')).usePlayerStore;
    const playlists = dataStore.getState().playlists;
    if (!playlists || playlists.length === 0) return { error: 'No playlists' };

    const target = playlists[0];
    
    // Select first playlist (NOT playing)
    playerStore.setState({ currentTrack: null, isPlaying: false });
    const pEls = Array.from(document.querySelectorAll('aside.w-\\[330px\\] p')).filter(p => p.innerText === target.name);
    pEls[0]?.closest('div.cursor-pointer')?.click();
    await new Promise(r => setTimeout(r, 200));

    const selectedPausedEl = Array.from(document.querySelectorAll('aside.w-\\[330px\\] p')).find(p => p.innerText === target.name);
    const pausedColor = window.getComputedStyle(selectedPausedEl).color;
    const pausedEqualizer = !!selectedPausedEl?.closest('div.cursor-pointer')?.querySelector('.animate-bounce');

    // Now actively play track from target playlist
    playerStore.setState({
      currentTrack: {
        id: 'track-live-1',
        name: 'Live Playing Track',
        duration_ms: 180000,
        artists: [{ id: 'a1', name: 'Artist' }],
        album: { id: 'alb1', name: 'Album', images: [] },
        playlistId: target.id
      },
      isPlaying: true
    });
    await new Promise(r => setTimeout(r, 200));

    const selectedPlayingEl = Array.from(document.querySelectorAll('aside.w-\\[330px\\] p')).find(p => p.innerText === target.name);
    const playingColor = window.getComputedStyle(selectedPlayingEl).color;
    const playingEqualizer = !!selectedPlayingEl?.closest('div.cursor-pointer')?.querySelector('.animate-bounce');

    // Now pause playback
    playerStore.setState({ isPlaying: false });
    await new Promise(r => setTimeout(r, 200));

    const pausedAgainEl = Array.from(document.querySelectorAll('aside.w-\\[330px\\] p')).find(p => p.innerText === target.name);
    const pausedAgainColor = window.getComputedStyle(pausedAgainEl).color;
    const pausedAgainEqualizer = !!pausedAgainEl?.closest('div.cursor-pointer')?.querySelector('.animate-bounce');

    return {
      playlistName: target.name,
      caseA_selected_paused: { color: pausedColor, equalizer: pausedEqualizer },
      caseB_selected_playing: { color: playingColor, equalizer: playingEqualizer },
      caseC_paused_again: { color: pausedAgainColor, equalizer: pausedAgainEqualizer }
    };
  });
  console.log('Parity results:', JSON.stringify(parity, null, 2));

  // 4. Right Sidebar Queue & Now-Playing Connectivity
  console.log('\n--- 4. RIGHT SIDEBAR LIVE PLAYER & QUEUE CONNECTIVITY ---');
  // Open Queue
  await page.evaluate(() => {
    const queueBtn = document.querySelector('button[title="Cola"]');
    queueBtn?.click();
  });
  await new Promise(r => setTimeout(r, 400));

  const queueData = await page.evaluate(() => {
    const aside = document.querySelector('aside.w-\\[320px\\]');
    if (!aside) return { error: 'Right sidebar not mounted' };
    const headings = Array.from(aside.querySelectorAll('h3, h4')).map(h => h.innerText);
    const sonandoTrack = aside.querySelector('p.text-\\[\\#1ed760\\]')?.innerText;
    const queueList = Array.from(aside.querySelectorAll('div.min-w-0 p.text-white')).map(p => p.innerText);
    return {
      headings,
      sonandoTrack,
      queueCount: queueList.length,
      queueSample: queueList.slice(0, 3)
    };
  });
  console.log('Right sidebar queue:', JSON.stringify(queueData, null, 2));

  // Open Now-Playing View
  await page.evaluate(() => {
    const npvBtn = document.querySelector('button[title="Vista que se está reproduciendo"]');
    npvBtn?.click();
  });
  await new Promise(r => setTimeout(r, 400));

  const npvData = await page.evaluate(() => {
    const aside = document.querySelector('aside.w-\\[320px\\]');
    return {
      headerAlbum: aside?.querySelector('h3')?.innerText,
      trackTitle: aside?.querySelector('h2')?.innerText,
      artists: aside?.querySelector('h2 + p')?.innerText,
      hasArtwork: !!aside?.querySelector('img')
    };
  });
  console.log('Right sidebar NPV:', JSON.stringify(npvData, null, 2));

  // 5. Unauthenticated Shimmer Transition
  console.log('\n--- 5. UNAUTHENTICATED & LOGOUT TRANSITION ---');
  await page.evaluate(() => window.__useSpotifyDataStore?.getState().logout());
  await new Promise(r => setTimeout(r, 500));

  const unauthData = await page.evaluate(() => {
    const header = document.querySelector('header');
    const loginBtn = Array.from(header?.querySelectorAll('button') || []).find(b => b.textContent?.includes('Iniciar sesión con Spotify'));
    const avatar = header?.querySelector('button[title="Jorgeperezvk"], button[title="Perfil"]');
    const ctaBanner = document.body.innerText.includes('Conecta tu cuenta de Spotify');
    const pulseCount = document.querySelectorAll('.animate-pulse').length;
    const greetings = /Buenos d[ií]as|Buenas tardes|Buenas noches/i.test(document.body.innerText);

    return {
      auth: window.__useSpotifyDataStore?.getState().isAuthenticated,
      hasLoginBtn: !!loginBtn,
      hasAvatar: !!avatar,
      hasCtaBanner: ctaBanner,
      pulseCount,
      greetingsFound: greetings
    };
  });
  console.log('Unauth state:', JSON.stringify(unauthData, null, 2));

  // Close page
  await page.close();
  browser.disconnect();
  console.log('\n=== INDEPENDENT VERIFICATION COMPLETE ===');
}

run().catch(console.error);
