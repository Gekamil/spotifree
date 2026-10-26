import puppeteer from 'puppeteer-core';

async function testUnauth() {
  console.log('='.repeat(80));
  console.log('   EMPIRICAL CHALLENGER: UNAUTHENTICATED VISIT & SKELETON VERIFICATION');
  console.log('='.repeat(80));

  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const page = await browser.newPage();
  
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    if (req.url().includes('/api/session-sync')) {
      req.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ connected: false, error: 'No active session' }),
      });
    } else {
      req.continue();
    }
  });

  // Navigate to 5173
  await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle2' });
  
  // Clear any existing storage
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 1000));

  const authState = await page.evaluate(() => {
    const s = window.__useSpotifyDataStore?.getState();
    const p = window.__usePlayerStore?.getState();
    return {
      isAuthenticated: s?.isAuthenticated,
      user: s?.user,
      playlistsCount: s?.playlists?.length,
      shelvesCount: s?.dynamicShelves?.length,
      playerTrack: p?.currentTrack?.name,
    };
  });
  console.log('Unauth state from store:', JSON.stringify(authState, null, 2));

  const pageText = await page.evaluate(() => document.body.innerText);
  
  const hasLoginCTA = pageText.includes('Conecta tu cuenta de Spotify');
  const hasCanciones = pageText.includes('Canciones que te gustan');
  const hasMockUser = pageText.includes('mockUser');
  const hasJorgeperezvk = pageText.includes('Jorgeperezvk');
  const hasHechoPara = pageText.includes('Hecho para');

  console.log('1. Page text includes "Conecta tu cuenta de Spotify":', hasLoginCTA);
  console.log('2. Page text includes "Canciones que te gustan":', hasCanciones);
  console.log('3. Page text includes "mockUser":', hasMockUser);
  console.log('4. Page text includes "Jorgeperezvk":', hasJorgeperezvk);
  console.log('5. Page text includes "Hecho para":', hasHechoPara);

  // Check shimmer skeletons
  const shimmerCount = await page.evaluate(() => document.querySelectorAll('.animate-pulse').length);
  console.log('6. Shimmer animate-pulse element count:', shimmerCount);

  // Check button Iniciar sesión con Spotify
  const loginBtns = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button'))
      .map((b) => b.innerText.trim())
      .filter((t) => t.includes('Iniciar sesión con Spotify'));
  });
  console.log('7. "Iniciar sesión con Spotify" buttons found:', loginBtns.length, loginBtns);

  // Check if sidebar has shimmer
  const sidebarShimmers = await page.evaluate(() => {
    const aside = document.querySelector('aside');
    return aside ? aside.querySelectorAll('.animate-pulse').length : 0;
  });
  console.log('8. Sidebar shimmer count:', sidebarShimmers);

  // Check greetings in DOM
  const textLower = pageText.toLowerCase();
  const greetings = ['buenos días', 'buenos dias', 'buenas tardes', 'buenas noches'];
  const foundGreetings = greetings.filter((g) => textLower.includes(g));
  console.log('9. Greetings in unauthenticated DOM:', foundGreetings);

  console.log('='.repeat(80));

  await page.close();
  browser.disconnect();

  const success =
    authState.isAuthenticated === false &&
    authState.user === null &&
    authState.playlistsCount === 0 &&
    hasLoginCTA === true &&
    hasCanciones === false &&
    hasMockUser === false &&
    hasJorgeperezvk === false &&
    hasHechoPara === false &&
    shimmerCount > 0 &&
    sidebarShimmers > 0 &&
    foundGreetings.length === 0;

  console.log('FINAL UNAUTH VERDICT:', success ? 'ALL CRITERIA PASSED' : 'VERIFICATION FAILED');
  if (!success) {
    process.exit(1);
  }
}

testUnauth().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
