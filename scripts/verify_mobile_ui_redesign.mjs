import puppeteer from 'puppeteer-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\jorge\\.gemini\\antigravity\\brain\\b7d3ec29-c076-4935-90b5-23f42c286313';
const DIST_DIR = path.resolve('dist');

function startStaticServer(port = 5173) {
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
  };

  const server = http.createServer((req, res) => {
    let filePath = path.join(DIST_DIR, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
    if (!fs.existsSync(filePath)) {
      filePath = path.join(DIST_DIR, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(500);
        res.end('Error loading ' + filePath);
      } else {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content, 'utf-8');
      }
    });
  });

  return new Promise((resolve) => {
    server.listen(port, () => {
      console.log(`Static server running at http://localhost:${port}`);
      resolve(server);
    });
  });
}

async function run() {
  const server = await startStaticServer(5173);

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: 'new',
    args: [
      '--autoplay-policy=no-user-gesture-required',
      '--disable-web-security',
      '--no-sandbox',
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.setUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
    );

    console.log('Navigating to http://localhost:5173 ...');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle0', timeout: 15000 });
    await new Promise((r) => setTimeout(r, 600));

    // Authenticate and set up test session
    await page.evaluate(() => {
      const dataStore = window.__useSpotifyDataStore;
      const player = window.__usePlayerStore;
      const uiStore = window.__useUIStore;

      // Close login modal if open
      if (uiStore) {
        uiStore.getState().closeLoginModal();
      }

      if (dataStore) {
        dataStore.setState({
          isAuthenticated: true,
          user: {
            id: 'e6yr34zzwnf1yybcw49po6nrw',
            display_name: 'Jorge Perez',
            images: [{ url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300' }],
            email: 'jorgeperezvk@spotify.com',
            followers: { total: 42 },
          },
          playlists: [
            {
              id: 'pl-latin-hits',
              name: 'Éxitos España 2026',
              description: 'De Jorge Perez',
              images: [{ url: 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg' }],
              tracks: { total: 48, items: [] },
              owner: { display_name: 'Jorge Perez', id: 'e6yr34zzwnf1yybcw49po6nrw' },
            },
            {
              id: 'pl-favorites',
              name: 'Mis Favoritas de Siempre',
              description: 'Tus imprescindibles',
              images: [{ url: 'https://image-cdn-fa.spotifycdn.com/image/ab67706c0000d72c804d43e5cc7f6a6d0ac65ffc' }],
              tracks: { total: 32, items: [] },
              owner: { display_name: 'Jorge Perez', id: 'e6yr34zzwnf1yybcw49po6nrw' },
            },
          ],
        });
      }

      if (player) {
        player.getState().playTrack({
          id: 'test-song-mobile',
          name: 'Housewife',
          duration_ms: 208810,
          artists: [{ id: 'tate-mcrae', name: 'Tate McRae' }],
          album: {
            id: 'alb-1',
            name: 'Housewife',
            images: [{ url: 'https://i.scdn.co/image/ab67616d0000b2737c6236a76fbcee4f1b8ace08' }],
          },
        });
      }
    });

    await new Promise((r) => setTimeout(r, 1200));

    // 1. Mobile Home with new MiniPlayer and docked Bottom Nav
    const homeScreenshotPath = path.join(ARTIFACT_DIR, 'mobile_home_with_new_miniplayer.png');
    await page.screenshot({ path: homeScreenshotPath });
    console.log(`Saved: ${homeScreenshotPath}`);

    // 2. Open Now Playing full modal
    console.log('Opening Now Playing full modal...');
    await page.evaluate(() => {
      const el = document.querySelector('[data-testid="mobile-mini-player"]');
      if (el) el.click();
    });

    await new Promise((r) => setTimeout(r, 1000));
    const nowPlayingScreenshotPath = path.join(ARTIFACT_DIR, 'mobile_now_playing_modal_with_bottom_bar.png');
    await page.screenshot({ path: nowPlayingScreenshotPath });
    console.log(`Saved: ${nowPlayingScreenshotPath}`);

    // Close modal
    await page.evaluate(() => {
      const btn = document.querySelector('button[title="Minimizar"]');
      if (btn) btn.click();
    });
    await new Promise((r) => setTimeout(r, 600));

    // 3. Open Mobile Profile View
    console.log('Opening Mobile Profile View...');
    await page.evaluate(() => {
      // Find the avatar button or profile button in header
      const headerBtns = Array.from(document.querySelectorAll('header button'));
      if (headerBtns[0]) headerBtns[0].click();
    });
    await new Promise((r) => setTimeout(r, 1000));

    const profileScreenshotPath = path.join(ARTIFACT_DIR, 'mobile_profile_view_authentic.png');
    await page.screenshot({ path: profileScreenshotPath });
    console.log(`Saved: ${profileScreenshotPath}`);

    // 4. Open Mobile Settings View from Profile
    console.log('Opening Mobile Settings View from Profile...');
    await page.evaluate(() => {
      const settingsBtn = document.querySelector('button[title="Configuración"]');
      if (settingsBtn) settingsBtn.click();
    });
    await new Promise((r) => setTimeout(r, 1000));

    const settingsScreenshotPath = path.join(ARTIFACT_DIR, 'mobile_settings_view_authentic.png');
    await page.screenshot({ path: settingsScreenshotPath });
    console.log(`Saved: ${settingsScreenshotPath}`);

    console.log('All screenshots captured successfully!');
  } finally {
    await browser.close();
    server.close();
  }
}

run().catch((err) => {
  console.error('Error in verification script:', err);
  process.exit(1);
});
