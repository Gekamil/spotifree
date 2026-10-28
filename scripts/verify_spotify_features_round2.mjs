import puppeteer from 'puppeteer-core';
import { spawn } from 'child_process';
import path from 'path';

async function main() {
  console.log('Starting preview server on port 4173...');
  const server = spawn('cmd', ['/c', 'npx', 'vite', 'preview', '--port', '4173'], {
    stdio: 'ignore',
    detached: false,
  });

  // Wait until server is responding
  let connected = false;
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch('http://localhost:4173');
      if (res.ok) {
        connected = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!connected) {
    throw new Error('Vite preview server failed to start on port 4173');
  }

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const artifactDir = 'C:\\Users\\jorge\\.gemini\\antigravity\\brain\\b7d3ec29-c076-4935-90b5-23f42c286313';

  try {
    // 1. Desktop Test (1280x800)
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto('http://localhost:4173', { waitUntil: 'networkidle2' });

    // Populate stores and accounts
    await page.evaluate(() => {
      localStorage.setItem('user_spotify_cookie', 'AQB_sample_test_cookie_for_spotify_device_qr');
      localStorage.setItem('spotifree_active_user_id', 'user_jorge_perez');
      localStorage.setItem('spotifree_saved_accounts', JSON.stringify([
        {
          id: 'user_jorge_perez',
          displayName: 'Jorge Perez',
          email: 'jorge@example.com',
          avatarUrl: '',
          cookie: 'AQB_sample_test_cookie_for_spotify_device_qr',
          lastUsed: Date.now() - 1000,
        },
        {
          id: 'user_maria_garcia',
          displayName: 'Maria Garcia',
          email: 'maria@example.com',
          avatarUrl: '',
          cookie: 'AQB_secondary_account_sample_cookie',
          lastUsed: Date.now() - 50000,
        }
      ]));

      if (window.__useSpotifyDataStore) {
        window.__useSpotifyDataStore.setState({
          isAuthenticated: true,
          user: { id: 'user_jorge_perez', display_name: 'Jorge Perez', images: [] },
          playlists: [
            { id: 'p1', name: 'Mis Favoritas 2026', type: 'playlist', images: [{ url: 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg' }], tracks: { total: 10, items: [] } },
            { id: 'p2', name: 'Urbano Latino', type: 'playlist', images: [{ url: 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg' }], tracks: { total: 5, items: [] } }
          ],
          quickAccessCards: [
            { id: 'p1', name: 'Mis Favoritas 2026', image: 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg', color: '#5018F0' },
            { id: 'p2', name: 'Urbano Latino', image: 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg', color: '#C45028' }
          ],
        });
      }
    });
    await new Promise(r => setTimeout(r, 600));

    // Open profile dropdown
    await page.evaluate(() => {
      const topBtn = document.querySelector('header button[title="Jorge Perez"]') || document.querySelector('header button:last-child');
      if (topBtn) topBtn.click();
    });
    await new Promise(r => setTimeout(r, 600));

    // Screenshot 1: Desktop Authentic Profile Dropdown with Accounts Switcher
    await page.screenshot({
      path: path.join(artifactDir, 'desktop_authentic_profile_dropdown_accounts.png'),
    });
    console.log('Saved desktop_authentic_profile_dropdown_accounts.png');

    // Close dropdown and navigate to settings
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('div button'));
      const settingsBtn = buttons.find(b => b.textContent && b.textContent.includes('Configuración'));
      if (settingsBtn) settingsBtn.click();
    });
    await new Promise(r => setTimeout(r, 800));

    // Expand QR Code
    await page.evaluate(() => {
      const qrBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Mostrar código QR'));
      if (qrBtn) qrBtn.click();
    });
    await new Promise(r => setTimeout(r, 800));

    // Screenshot 2: Desktop Settings view with QR (No Emojis) and Saved Accounts manager
    await page.screenshot({
      path: path.join(artifactDir, 'desktop_settings_no_emojis_qr_accounts.png'),
    });
    console.log('Saved desktop_settings_no_emojis_qr_accounts.png');

    // 2. Mobile Viewport (iPhone 390x844)
    const mobilePage = await browser.newPage();
    await mobilePage.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await mobilePage.goto('http://localhost:4173', { waitUntil: 'networkidle2' });

    // Seed session in mobile page & play track
    await mobilePage.evaluate(() => {
      localStorage.setItem('user_spotify_cookie', 'AQB_sample_test_cookie_for_spotify_device_qr');
      localStorage.setItem('spotifree_active_user_id', 'user_jorge_perez');

      if (window.__useSpotifyDataStore) {
        window.__useSpotifyDataStore.setState({
          isAuthenticated: true,
          user: { id: 'user_jorge_perez', display_name: 'Jorge Perez', images: [] },
          playlists: [
            { id: 'p1', name: 'Mis Favoritas 2026', type: 'playlist', images: [{ url: 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg' }], tracks: { total: 10, items: [] } }
          ],
          quickAccessCards: [
            { id: 'p1', name: 'Mis Favoritas 2026', image: 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg', color: '#5018F0' }
          ],
        });
      }

      if (window.__usePlayerStore) {
        window.__usePlayerStore.getState().playTrack({
          id: 'sample-track-1',
          name: 'Ojitos Lindos',
          duration_ms: 258000,
          artists: [{ id: 'bb', name: 'Bad Bunny, Bomba Estéreo' }],
          album: {
            id: 'un-verano-sin-ti',
            name: 'Un Verano Sin Ti',
            images: [{ url: 'https://i.scdn.co/image/ab67616d0000b27349d694203245f241a1bcaa70' }],
          },
        });
      }
    });
    await new Promise(r => setTimeout(r, 1000));

    // Screenshot 3: Mobile Home with 4 Bottom Tabs (Inicio, Buscar, Tu biblioteca, Crear) + MiniPlayer "Este teléfono"
    await mobilePage.screenshot({
      path: path.join(artifactDir, 'mobile_home_bottom_nav_and_miniplayer_este_telefono.png'),
    });
    console.log('Saved mobile_home_bottom_nav_and_miniplayer_este_telefono.png');

    // Click "Crear" tab to open MobileCreateSheet
    await mobilePage.evaluate(() => {
      const navButtons = Array.from(document.querySelectorAll('nav button'));
      const createBtn = navButtons.find(b => b.textContent && b.textContent.includes('Crear'));
      if (createBtn) createBtn.click();
    });
    await new Promise(r => setTimeout(r, 800));

    // Screenshot 4: Mobile Create Action Sheet (Playlist, Carpeta, Fusión)
    await mobilePage.screenshot({
      path: path.join(artifactDir, 'mobile_create_action_sheet.png'),
    });
    console.log('Saved mobile_create_action_sheet.png');

    // Close create sheet
    await mobilePage.evaluate(() => {
      const closeBtn = document.querySelector('div[class*="fixed inset-0"] button');
      if (closeBtn) closeBtn.click();
    });
    await new Promise(r => setTimeout(r, 600));

    // Open full player modal by clicking miniplayer
    await mobilePage.evaluate(() => {
      const miniplayer = document.querySelector('div[class*="bottom-[74px]"]');
      if (miniplayer) miniplayer.click();
    });
    await new Promise(r => setTimeout(r, 800));

    // Screenshot 5: Full Player Modal showing ESTE TELÉFONO in Spotify Green
    await mobilePage.screenshot({
      path: path.join(artifactDir, 'mobile_now_playing_modal_este_telefono.png'),
    });
    console.log('Saved mobile_now_playing_modal_este_telefono.png');

  } catch (err) {
    console.error('Error during verification:', err);
  } finally {
    await browser.close();
    server.kill();
  }
}

main();
