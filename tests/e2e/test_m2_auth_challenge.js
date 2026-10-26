import puppeteer from 'puppeteer-core';

async function testAuth() {
  console.log('='.repeat(80));
  console.log('   EMPIRICAL CHALLENGER: AUTHENTICATED FEED & REAL DATA VERIFICATION');
  console.log('='.repeat(80));

  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const page = await browser.newPage();

  // Navigate to 5173
  await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 1200));

  const authState = await page.evaluate(() => {
    const s = window.__useSpotifyDataStore?.getState();
    return {
      isAuthenticated: s?.isAuthenticated,
      userDisplayName: s?.user?.display_name,
      userId: s?.user?.id,
      playlistsCount: s?.playlists?.length,
      firstPlaylistName: s?.playlists?.[0]?.name,
      featuredMessage: s?.featuredMessage,
      shelvesCount: s?.dynamicShelves?.length,
      shelfTitles: s?.dynamicShelves?.map((sh) => `${sh.prefix ? sh.prefix + ' ' : ''}${sh.title}`),
    };
  });
  console.log('Auth state from store:', JSON.stringify(authState, null, 2));

  // Inspect DOM elements
  const domInfo = await page.evaluate(() => {
    const aside = document.querySelector('aside');
    const sidebarPlaylists = Array.from(aside ? aside.querySelectorAll('div.cursor-pointer.group p') : []).map(
      (p) => p.innerText
    );

    const sections = Array.from(document.querySelectorAll('section')).map((sec) => {
      const h2 = sec.querySelector('h2')?.innerText;
      const cards = Array.from(sec.querySelectorAll('p.font-bold, span.font-bold, div[title]')).map(
        (c) => c.innerText
      );
      return { title: h2, cardCount: cards.length };
    });

    const quickAccessGrid = document.querySelector('.grid.grid-cols-2.lg\\:grid-cols-4');
    const quickAccessItems = Array.from(quickAccessGrid ? quickAccessGrid.querySelectorAll('span') : []).map(
      (s) => s.innerText
    );

    const fullText = document.body.innerText;
    const greetings = ['buenos días', 'buenos dias', 'buenas tardes', 'buenas noches'];
    const foundGreetings = greetings.filter((g) => fullText.toLowerCase().includes(g));

    return {
      sidebarPlaylists: sidebarPlaylists.slice(0, 5),
      sidebarTotal: sidebarPlaylists.length,
      sections,
      quickAccessItems,
      foundGreetings,
      hasMockUser: fullText.includes('mockUser'),
    };
  });

  console.log('DOM Sidebar Playlists (sample 5):', domInfo.sidebarPlaylists);
  console.log('DOM Sidebar Playlists total:', domInfo.sidebarTotal);
  console.log('DOM Sections:', JSON.stringify(domInfo.sections, null, 2));
  console.log('DOM Quick Access (top 8):', domInfo.quickAccessItems);
  console.log('DOM Greetings found:', domInfo.foundGreetings);
  console.log('DOM has mockUser:', domInfo.hasMockUser);

  console.log('='.repeat(80));

  await page.close();
  browser.disconnect();

  const isAuth = authState.isAuthenticated === true;
  const isJorge = authState.userDisplayName === 'Jorgeperezvk';
  const hasPlaylists = authState.playlistsCount > 0 && domInfo.sidebarTotal > 0;
  const has5Shelves = authState.shelvesCount === 5;
  const hasQuickAccess8 = domInfo.quickAccessItems.length === 8;
  const quickAccessFirstIsLiked = domInfo.quickAccessItems[0] === 'Canciones que te gustan';
  const noGreetings = domInfo.foundGreetings.length === 0;
  const noMockUser = domInfo.hasMockUser === false;

  console.log('CHECKS SUMMARY:');
  console.log('- Authenticated is true:', isAuth);
  console.log('- User display_name is Jorgeperezvk:', isJorge);
  console.log('- Has real playlists in store & sidebar:', hasPlaylists);
  console.log('- Has 5 dynamic shelves in store:', has5Shelves);
  console.log('- Quick access top 8 grid rendered:', hasQuickAccess8);
  console.log('- Quick access top 8 starts with "Canciones que te gustan":', quickAccessFirstIsLiked);
  console.log('- Zero greeting words in DOM:', noGreetings);
  console.log('- Zero mockUser in DOM:', noMockUser);

  const allPassed =
    isAuth &&
    isJorge &&
    hasPlaylists &&
    has5Shelves &&
    hasQuickAccess8 &&
    quickAccessFirstIsLiked &&
    noGreetings &&
    noMockUser;

  console.log('FINAL AUTH VERDICT:', allPassed ? 'ALL CRITERIA PASSED' : 'VERIFICATION FAILED');
  if (!allPassed) {
    process.exit(1);
  }
}

testAuth().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
