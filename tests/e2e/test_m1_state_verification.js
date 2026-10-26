import puppeteer from 'puppeteer-core';

async function runEmpiricalVerification() {
  console.log('--- STARTING EMPIRICAL VERIFICATION OF MILESTONE 1 STATE TRANSITIONS ---');
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  let appPage = pages.find((p) => p.url().includes('127.0.0.1:5173') || p.url().includes('localhost:5173'));

  if (!appPage) {
    console.log('App page not found, opening new page...');
    appPage = await browser.newPage();
    await appPage.goto('http://127.0.0.1:5173');
  } else {
    console.log('Found existing app page:', appPage.url());
  }

  // Ensure page is ready
  await appPage.bringToFront();
  await appPage.waitForSelector('header', { timeout: 5000 });

  const results = [];
  function record(title, pass, details = '') {
    results.push({ title, pass, details });
    console.log(`[${pass ? 'PASS' : 'FAIL'}] ${title} ${details ? `(${details})` : ''}`);
    if (!pass) {
      throw new Error(`Assertion failed: ${title} - ${details}`);
    }
  }

  // 1. Initial State Check
  console.log('\n--- 1. Testing Authenticated State ---');
  // Trigger sync if not authenticated yet
  await appPage.evaluate(async () => {
    // If not authenticated, try syncing
    const sessionSync = await import('/src/services/sessionSync.ts');
    await sessionSync.syncChromeSession();
  });
  await new Promise((r) => setTimeout(r, 1000));

  const authState = await appPage.evaluate(async () => {
    const store = (await import('/src/store/useSpotifyDataStore.ts')).useSpotifyDataStore;
    const state = store.getState();
    return {
      isAuthenticated: state.isAuthenticated,
      displayName: state.user?.display_name,
      avatarUrl: state.user?.images?.[0]?.url,
    };
  });

  record('User is authenticated', authState.isAuthenticated === true, `User: ${authState.displayName}`);

  // Check DesktopTopNav elements in Authenticated state
  const authNavElements = await appPage.evaluate(() => {
    const header = document.querySelector('header');
    if (!header) return null;
    const loginBtn = Array.from(header.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Iniciar sesión con Spotify')
    );
    const premiumBtn = Array.from(header.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Descubrir Premium')
    );
    const avatarImg = header.querySelector('img[alt="Jorgeperezvk"], img[alt="Usuario"]');
    const avatarBadge = Array.from(header.querySelectorAll('span')).find(
      (s) => s.textContent === 'J' && s.className.includes('bg-[#ff6437]')
    );
    return {
      hasLoginButton: !!loginBtn,
      hasPremiumButton: !!premiumBtn,
      hasAvatarImg: !!avatarImg,
      hasAvatarBadge: !!avatarBadge,
      hasAvatar: !!(avatarImg || avatarBadge),
    };
  });

  record(
    'Authenticated: "Iniciar sesión con Spotify" button is HIDDEN',
    authNavElements.hasLoginButton === false
  );
  record(
    'Authenticated: "Descubrir Premium" button is VISIBLE',
    authNavElements.hasPremiumButton === true
  );
  record(
    'Authenticated: User avatar (badge or image) is VISIBLE in TopNav',
    authNavElements.hasAvatar === true,
    `badge: ${authNavElements.hasAvatarBadge}, img: ${authNavElements.hasAvatarImg}`
  );

  // 2. Open ProfileDropdown
  console.log('\n--- 2. Testing ProfileDropdown Toggle & Rendering ---');
  // Click avatar button
  const avatarClicked = await appPage.evaluate(() => {
    const header = document.querySelector('header');
    const avatarBtn = header?.querySelector('button[title="Jorgeperezvk"], button[title="Perfil"]');
    if (avatarBtn) {
      avatarBtn.click();
      return true;
    }
    return false;
  });
  record('Avatar button clicked to open ProfileDropdown', avatarClicked === true);

  await new Promise((r) => setTimeout(r, 400));

  const dropdownState = await appPage.evaluate(() => {
    const menuButtons = Array.from(document.querySelectorAll('div.absolute button')).map((b) =>
      b.textContent?.trim()
    );
    const logoutBtn = menuButtons.find((t) => t?.includes('Cerrar sesión'));
    return {
      menuButtons,
      hasLogout: !!logoutBtn,
    };
  });

  record(
    'ProfileDropdown is mounted and visible with options',
    dropdownState.menuButtons.length >= 5,
    `Found options: ${dropdownState.menuButtons.join(', ')}`
  );
  record('ProfileDropdown contains "Cerrar sesión" action button', dropdownState.hasLogout === true);

  // 3. Test Logout Action
  console.log('\n--- 3. Testing Logout Action & Unauthenticated State Transition ---');
  const logoutClicked = await appPage.evaluate(() => {
    const menuButtons = Array.from(document.querySelectorAll('div.absolute button'));
    const logoutBtn = menuButtons.find((b) => b.textContent?.includes('Cerrar sesión'));
    if (logoutBtn) {
      logoutBtn.click();
      return true;
    }
    return false;
  });
  record('Clicked "Cerrar sesión" in ProfileDropdown', logoutClicked === true);

  await new Promise((r) => setTimeout(r, 500));

  const unauthState = await appPage.evaluate(async () => {
    const store = (await import('/src/store/useSpotifyDataStore.ts')).useSpotifyDataStore;
    const uiStore = (await import('/src/store/useUIStore.ts')).useUIStore;
    const state = store.getState();
    const token = localStorage.getItem('spotify_access_token');
    const header = document.querySelector('header');

    const loginBtn = Array.from(header?.querySelectorAll('button') || []).find((b) =>
      b.textContent?.includes('Iniciar sesión con Spotify')
    );
    const premiumBtn = Array.from(header?.querySelectorAll('button') || []).find((b) =>
      b.textContent?.includes('Descubrir Premium')
    );
    const avatarBtn = header?.querySelector('button[title="Jorgeperezvk"], button[title="Perfil"]');
    const avatarBadge = Array.from(header?.querySelectorAll('span') || []).find(
      (s) => s.textContent === 'J' && s.className.includes('bg-[#ff6437]')
    );
    const avatarImg = header?.querySelector('img[alt="Jorgeperezvk"], img[alt="Usuario"]');
    const isProfileOpen = uiStore.getState().isProfileOpen;
    const dropdownMenu = document.querySelector('div.absolute.top-14.right-4');

    return {
      isAuthenticated: state.isAuthenticated,
      tokenRemoved: token === null,
      isProfileOpen,
      hasDropdownInDOM: !!dropdownMenu,
      hasLoginButton: !!loginBtn,
      loginButtonText: loginBtn?.textContent?.trim(),
      hasPremiumButton: !!premiumBtn,
      hasAvatarBtn: !!avatarBtn,
      hasAvatarBadge: !!avatarBadge,
      hasAvatarImg: !!avatarImg,
      avatarVisible: !!(avatarBtn || avatarBadge || avatarImg),
    };
  });

  record(
    'Unauthenticated state: store isAuthenticated is false',
    unauthState.isAuthenticated === false
  );
  record(
    'Unauthenticated state: localStorage access token is removed',
    unauthState.tokenRemoved === true
  );
  record(
    'ProfileDropdown is closed and removed after logout',
    unauthState.isProfileOpen === false && unauthState.hasDropdownInDOM === false
  );
  record(
    'Unauthenticated state: Avatar is completely HIDDEN from DesktopTopNav',
    unauthState.avatarVisible === false,
    `avatarVisible: ${unauthState.avatarVisible}`
  );
  record(
    'Unauthenticated state: "Iniciar sesión con Spotify" button is VISIBLE in TopNav',
    unauthState.hasLoginButton === true,
    `Text: "${unauthState.loginButtonText}"`
  );
  record(
    'Unauthenticated state: exact button text matches "Iniciar sesión con Spotify"',
    unauthState.loginButtonText === 'Iniciar sesión con Spotify'
  );
  record(
    'Unauthenticated state: "Descubrir Premium" button is HIDDEN',
    unauthState.hasPremiumButton === false
  );

  // 4. Test Re-Authentication State Transition
  console.log('\n--- 4. Testing Re-Authentication Transition ---');
  await appPage.evaluate(async () => {
    const sessionSync = await import('/src/services/sessionSync.ts');
    await sessionSync.syncChromeSession();
  });
  await new Promise((r) => setTimeout(r, 600));

  const reAuthState = await appPage.evaluate(async () => {
    const store = (await import('/src/store/useSpotifyDataStore.ts')).useSpotifyDataStore;
    const state = store.getState();
    const header = document.querySelector('header');
    const loginBtn = Array.from(header?.querySelectorAll('button') || []).find((b) =>
      b.textContent?.includes('Iniciar sesión con Spotify')
    );
    const avatarBadge = Array.from(header?.querySelectorAll('span') || []).find(
      (s) => s.textContent === 'J' && s.className.includes('bg-[#ff6437]')
    );
    const avatarImg = header?.querySelector('img[alt="Jorgeperezvk"], img[alt="Usuario"]');
    return {
      isAuthenticated: state.isAuthenticated,
      hasLoginButton: !!loginBtn,
      avatarVisible: !!(avatarBadge || avatarImg),
      userName: state.user?.display_name,
    };
  });

  record('Re-authenticated successfully', reAuthState.isAuthenticated === true, `User: ${reAuthState.userName}`);
  record('Re-authenticated: Login button is HIDDEN', reAuthState.hasLoginButton === false);
  record('Re-authenticated: Avatar is VISIBLE again in TopNav', reAuthState.avatarVisible === true);

  console.log('\n========================================================');
  console.log(`ALL ${results.length} EMPIRICAL VERIFICATION TESTS PASSED CLEANLY!`);
  console.log('========================================================');

  browser.disconnect();
}

runEmpiricalVerification().catch((err) => {
  console.error('\nEMPIRICAL VERIFICATION FAILED:', err);
  process.exit(1);
});
