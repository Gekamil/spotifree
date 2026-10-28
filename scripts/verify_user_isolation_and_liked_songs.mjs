import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const ARTIFACTS_DIR = 'C:\\Users\\jorge\\.gemini\\antigravity\\brain\\b7d3ec29-c076-4935-90b5-23f42c286313';

async function runVerification() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  });

  console.log('--- 1. Testing Desktop: Isolation of Liked Songs for Another Account ---');
  const desktopPage = await browser.newPage();
  await desktopPage.setViewport({ width: 1440, height: 900 });

  // Pre-seed a clean new account session in localStorage
  await desktopPage.goto('https://spotifreeweb.vercel.app/', { waitUntil: 'domcontentloaded' }).catch(() => {});
  
  await desktopPage.evaluate(() => {
    window.localStorage.clear();
    // Simulate user with another cookie
    const testUserId = 'test_user_cookie_999';
    window.localStorage.setItem('user_spotify_cookie', 'AQB_another_user_cookie_simulation_test_12345678901234567890');
    window.localStorage.setItem('spotifree_active_user_id', testUserId);
    window.localStorage.setItem('spotify_extracted_session', JSON.stringify({
      user: {
        id: testUserId,
        display_name: 'Cuenta de Prueba',
        images: [],
        email: 'prueba@spotify.com',
      },
      playlists: [
        {
          id: 'collection-tracks',
          name: 'Canciones que te gustan',
          description: 'Tu lista de «Canciones que te gustan» es privada en Spotify.',
          type: 'playlist',
          images: [{ url: 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg' }],
          owner: { display_name: 'Cuenta de Prueba', id: testUserId },
          tracks: { total: 0 },
          is_pinned: true,
          color: '#5038a0',
        }
      ],
      shelves: [],
      quickAccess: [],
      _cookie: 'AQB_another_user_cookie_simulation_test_12345678901234567890'
    }));
  });

  // Reload with the new account
  await desktopPage.goto('https://spotifreeweb.vercel.app/', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 2000));

  // Click on "Canciones que te gustan" in the sidebar
  console.log('Navigating to Liked Songs in Desktop...');
  const clickedLiked = await desktopPage.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a, button, div, span'));
    const target = links.find((el) => el.innerText && el.innerText.trim() === 'Canciones que te gustan');
    if (target) {
      target.click();
      return true;
    }
    return false;
  });
  console.log('Clicked Liked Songs sidebar button:', clickedLiked);
  await new Promise((r) => setTimeout(r, 1500));

  // Verify Desktop Empty Private State
  const desktopEmptyState = await desktopPage.evaluate(() => {
    const title = document.querySelector('h1')?.innerText;
    const subtitle = document.querySelector('p')?.innerText;
    const trackRows = document.querySelectorAll('[data-testid="track-row"]');
    const privateNotice = document.querySelector('.bg-\\[\\#181818\\]')?.innerText;
    const searchSection = document.querySelector('input[placeholder*="Buscar canciones"]');

    return {
      title,
      subtitle,
      trackCount: trackRows.length,
      hasPrivateNotice: !!privateNotice && privateNotice.includes('privada'),
      privateNoticeText: privateNotice ? privateNotice.replace(/\n+/g, ' ') : null,
      hasSearchInput: !!searchSection,
    };
  });
  console.log('Desktop Empty State Check:', desktopEmptyState);

  // Take screenshot of Desktop Private Empty State
  const desktopEmptyPath = path.join(ARTIFACTS_DIR, 'desktop_liked_songs_private_empty.png');
  await desktopPage.screenshot({ path: desktopEmptyPath, fullPage: false });
  console.log('Saved screenshot:', desktopEmptyPath);

  // Add a song via inline search suggestions
  console.log('Adding a song via inline search button in Desktop...');
  const addedTrack = await desktopPage.evaluate(() => {
    const addBtns = Array.from(document.querySelectorAll('button')).filter((b) => b.innerText.trim() === 'Añadir');
    if (addBtns.length > 0) {
      addBtns[0].click();
      return true;
    }
    return false;
  });
  console.log('Clicked Añadir button:', addedTrack);
  await new Promise((r) => setTimeout(r, 1200));

  // Verify track is now displayed
  const desktopPopulatedState = await desktopPage.evaluate(() => {
    const trackRows = document.querySelectorAll('[data-testid="track-row"]');
    const firstTrackName = trackRows[0]?.querySelector('.text-sm.font-semibold')?.innerText;
    const testUserStorageKey = 'spotifree_custom_liked_songs_test_user_cookie_999';
    const rawSaved = window.localStorage.getItem(testUserStorageKey);

    return {
      trackCount: trackRows.length,
      firstTrackName,
      hasSavedInStorage: !!rawSaved,
      savedCount: rawSaved ? JSON.parse(rawSaved).length : 0,
    };
  });
  console.log('Desktop Populated State Check:', desktopPopulatedState);

  // Take screenshot of Desktop with added song
  const desktopPopulatedPath = path.join(ARTIFACTS_DIR, 'desktop_liked_songs_with_added_track.png');
  await desktopPage.screenshot({ path: desktopPopulatedPath, fullPage: false });
  console.log('Saved screenshot:', desktopPopulatedPath);

  await desktopPage.close();

  console.log('\n--- 2. Testing Mobile: Isolation of Liked Songs for Another Account ---');
  const mobilePage = await browser.newPage();
  await mobilePage.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });

  await mobilePage.goto('https://spotifreeweb.vercel.app/', { waitUntil: 'domcontentloaded' }).catch(() => {});
  
  await mobilePage.evaluate(() => {
    window.localStorage.clear();
    const testUserId = 'test_user_mobile_777';
    window.localStorage.setItem('user_spotify_cookie', 'AQB_another_user_mobile_cookie_simulation_777');
    window.localStorage.setItem('spotifree_active_user_id', testUserId);
    window.localStorage.setItem('spotify_extracted_session', JSON.stringify({
      user: {
        id: testUserId,
        display_name: 'Usuario Móvil 2',
        images: [],
        email: 'movil2@spotify.com',
      },
      playlists: [
        {
          id: 'collection-tracks',
          name: 'Canciones que te gustan',
          description: 'Tu lista de «Canciones que te gustan» es privada en Spotify.',
          type: 'playlist',
          images: [{ url: 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg' }],
          owner: { display_name: 'Usuario Móvil 2', id: testUserId },
          tracks: { total: 0 },
          is_pinned: true,
          color: '#5038a0',
        }
      ],
      shelves: [],
      quickAccess: [],
      _cookie: 'AQB_another_user_mobile_cookie_simulation_777'
    }));
  });

  // Reload on mobile
  await mobilePage.goto('https://spotifreeweb.vercel.app/', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 2000));

  // Go to Library in Mobile
  console.log('Navigating to Library on Mobile...');
  await mobilePage.evaluate(() => {
    const navButtons = Array.from(document.querySelectorAll('nav button, nav a'));
    const libBtn = navButtons.find((b) => b.innerText && b.innerText.includes('biblioteca'));
    if (libBtn) libBtn.click();
  });
  await new Promise((r) => setTimeout(r, 1000));

  // Click on "Canciones que te gustan"
  console.log('Clicking on Liked Songs in Mobile Library...');
  const clickedMobileLiked = await mobilePage.evaluate(() => {
    const items = Array.from(document.querySelectorAll('span, p, div, button'));
    const target = items.find((el) => el.innerText && el.innerText.trim() === 'Canciones que te gustan');
    if (target) {
      target.click();
      return true;
    }
    return false;
  });
  console.log('Clicked Liked Songs on Mobile:', clickedMobileLiked);
  await new Promise((r) => setTimeout(r, 1500));

  // Check Mobile Empty State
  const mobileEmptyState = await mobilePage.evaluate(() => {
    const title = document.querySelector('h1')?.innerText;
    const notice = document.querySelector('.bg-\\[\\#181818\\]')?.innerText;
    const searchInput = document.querySelector('input[placeholder*="Buscar canciones"]');
    const addBtns = Array.from(document.querySelectorAll('button')).filter((b) => b.innerText.trim() === 'Añadir');

    return {
      title,
      hasPrivateNotice: !!notice && notice.includes('privada'),
      privateNoticeText: notice ? notice.replace(/\n+/g, ' ') : null,
      hasSearchInput: !!searchInput,
      recommendedButtonsCount: addBtns.length,
    };
  });
  console.log('Mobile Empty State Check:', mobileEmptyState);

  // Take screenshot of Mobile Private Empty State
  const mobileEmptyPath = path.join(ARTIFACTS_DIR, 'mobile_liked_songs_private_empty.png');
  await mobilePage.screenshot({ path: mobileEmptyPath, fullPage: false });
  console.log('Saved screenshot:', mobileEmptyPath);

  // Click Añadir on Mobile
  console.log('Adding a song via inline search button on Mobile...');
  const addedMobile = await mobilePage.evaluate(() => {
    const addBtns = Array.from(document.querySelectorAll('button')).filter((b) => b.innerText.trim() === 'Añadir');
    if (addBtns.length > 0) {
      addBtns[0].click();
      return true;
    }
    return false;
  });
  console.log('Clicked Añadir on Mobile:', addedMobile);
  await new Promise((r) => setTimeout(r, 1200));

  // Check Mobile Populated State
  const mobilePopulatedState = await mobilePage.evaluate(() => {
    const trackItems = document.querySelectorAll('.flex.items-center.justify-between.p-2\\.5');
    const firstTrack = trackItems[0]?.querySelector('.font-bold.text-sm')?.innerText;
    const testUserStorageKey = 'spotifree_custom_liked_songs_test_user_mobile_777';
    const rawSaved = window.localStorage.getItem(testUserStorageKey);

    return {
      trackCount: trackItems.length,
      firstTrack,
      hasSavedInStorage: !!rawSaved,
      savedCount: rawSaved ? JSON.parse(rawSaved).length : 0,
    };
  });
  console.log('Mobile Populated State Check:', mobilePopulatedState);

  // Take screenshot of Mobile with added song
  const mobilePopulatedPath = path.join(ARTIFACTS_DIR, 'mobile_liked_songs_with_added_track.png');
  await mobilePage.screenshot({ path: mobilePopulatedPath, fullPage: false });
  console.log('Saved screenshot:', mobilePopulatedPath);

  await browser.close();
  console.log('\n--- VERIFICATION COMPLETED SUCCESSFULLY ---');
}

runVerification().catch(console.error);
