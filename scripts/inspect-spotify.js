import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function inspect() {
  console.log('Connecting to Chrome DevTools on http://127.0.0.1:9222 ...');
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  console.log(`Found ${pages.length} open tab(s).`);

  let spotifyPage = pages.find((p) => p.url().includes('spotify.com'));
  if (!spotifyPage) {
    console.log('Opening https://open.spotify.com/ ...');
    spotifyPage = await browser.newPage();
    await spotifyPage.goto('https://open.spotify.com/', { waitUntil: 'networkidle2' });
  } else {
    console.log('Found existing Spotify tab:', spotifyPage.url());
  }

  await spotifyPage.bringToFront();
  await new Promise((r) => setTimeout(r, 2000));

  // 1. Take snapshot screenshot of open.spotify.com
  const spotifyHomeShot = path.resolve(__dirname, '../spotify-live-home.png');
  await spotifyPage.screenshot({ path: spotifyHomeShot });
  console.log('Saved live Spotify screenshot:', spotifyHomeShot);

  // 2. Extract DOM details & UI tree
  const details = await spotifyPage.evaluate(() => {
    // Top bar elements
    const topBar = document.querySelector('header') || document.querySelector('[data-testid="top-bar"]') || document.querySelector('.Root__top-bar');
    const topBarComputed = topBar ? window.getComputedStyle(topBar) : null;

    // Search bar
    const searchInput = document.querySelector('input[data-testid="search-input"]') || document.querySelector('input');

    // Profile button
    const profileBtn = document.querySelector('[data-testid="user-widget-link"]') || document.querySelector('[data-testid="profile-button"]') || document.querySelector('button[aria-haspopup="menu"]');

    // Sidebar
    const nav = document.querySelector('nav') || document.querySelector('[data-testid="your-library"]');

    // Quick access grid
    const quickAccessCards = Array.from(document.querySelectorAll('[data-testid="card-click-handler"], [role="button"], a[href^="/playlist/"], a[href^="/collection/tracks"]')).slice(0, 15).map(el => ({
      text: el.innerText.trim(),
      href: el.getAttribute('href'),
      ariaLabel: el.getAttribute('aria-label'),
      classes: el.className
    }));

    return {
      topBar: {
        height: topBarComputed?.height,
        background: topBarComputed?.backgroundColor,
        padding: topBarComputed?.padding,
      },
      hasProfileBtn: !!profileBtn,
      quickAccessCount: quickAccessCards.length,
      sampleCards: quickAccessCards.slice(0, 8),
      title: document.title,
    };
  });

  console.log('Inspection Results:', JSON.stringify(details, null, 2));

  // 3. Test clicking profile button to see dropdown menu
  try {
    const profileBtnHandle = await spotifyPage.$('[data-testid="user-widget-link"], [data-testid="profile-button"], button[aria-haspopup="menu"]');
    if (profileBtnHandle) {
      console.log('Clicking profile button...');
      await profileBtnHandle.click();
      await new Promise((r) => setTimeout(r, 800));
      const menuShot = path.resolve(__dirname, '../spotify-live-profile-menu.png');
      await spotifyPage.screenshot({ path: menuShot });
      console.log('Saved profile menu shot:', menuShot);

      const menuItems = await spotifyPage.evaluate(() => {
        const menu = document.querySelector('[role="menu"]');
        if (!menu) return [];
        return Array.from(menu.querySelectorAll('[role="menuitem"], button, a')).map(el => el.innerText.trim());
      });
      console.log('Profile Menu Items:', menuItems);
    }
  } catch (e) {
    console.error('Error clicking profile:', e.message);
  }

  // 4. Test clicking "+ Crear" in library
  try {
    const createBtn = await spotifyPage.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(b => b.innerText.includes('Crear') || b.getAttribute('aria-label')?.includes('Crear'));
    });
    if (createBtn) {
      console.log('Found Create button in library, clicking...');
      await createBtn.click();
      await new Promise((r) => setTimeout(r, 800));
      const createMenuShot = path.resolve(__dirname, '../spotify-live-create-menu.png');
      await spotifyPage.screenshot({ path: createMenuShot });
      console.log('Saved create menu shot:', createMenuShot);

      const createMenuItems = await spotifyPage.evaluate(() => {
        const menu = document.querySelector('[role="menu"]');
        if (!menu) return [];
        return Array.from(menu.querySelectorAll('[role="menuitem"], button, a')).map(el => el.innerText.trim());
      });
      console.log('Create Menu Items:', createMenuItems);
    }
  } catch (e) {
    console.error('Error clicking create button:', e.message);
  }

  // 5. Test clicking "Recientes" sort filter
  try {
    const sortBtn = await spotifyPage.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(b => b.innerText.includes('Recientes') || b.getAttribute('aria-label')?.includes('Ordenar'));
    });
    if (sortBtn) {
      console.log('Found Sort button, clicking...');
      await sortBtn.click();
      await new Promise((r) => setTimeout(r, 800));
      const sortMenuShot = path.resolve(__dirname, '../spotify-live-sort-menu.png');
      await spotifyPage.screenshot({ path: sortMenuShot });
      console.log('Saved sort menu shot:', sortMenuShot);

      const sortMenuItems = await spotifyPage.evaluate(() => {
        const menu = document.querySelector('[role="menu"]');
        if (!menu) return [];
        return Array.from(menu.querySelectorAll('[role="menuitem"], button, a')).map(el => el.innerText.trim());
      });
      console.log('Sort Menu Items:', sortMenuItems);
    }
  } catch (e) {
    console.error('Error clicking sort button:', e.message);
  }

  browser.disconnect();
}

inspect().catch(console.error);
