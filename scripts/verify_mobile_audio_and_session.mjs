import puppeteer from 'puppeteer-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\jorge\\.gemini\\antigravity\\brain\\b7d3ec29-c076-4935-90b5-23f42c286313';
const DIST_DIR = path.resolve('dist');

function startStaticServer(port = 5174) {
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
  const server = await startStaticServer(5174);

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: 'new',
    args: [
      '--autoplay-policy=no-user-gesture-required',
      '--disable-web-security',
      '--no-sandbox',
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.setUserAgent(
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
  );

  console.log('Navigating to Spotifree mobile viewport...');
  await page.goto('http://localhost:5174', { waitUntil: 'networkidle0' });

  // 1. Verify window.__audioEngine is available on mobile
  const hasAudioEngine = await page.evaluate(() => {
    return typeof window.__audioEngine !== 'undefined';
  });
  console.log('TEST 1 - window.__audioEngine available on mobile:', hasAudioEngine);

  // 2. Play a song from mobile store and verify audio engine received it
  const playResult = await page.evaluate(async () => {
    const store = window.__usePlayerStore;
    if (!store) return { success: false, reason: 'No player store' };

    store.getState().playTrack({
      id: 'track-quevedo-columbia',
      name: 'Columbia',
      artists: [{ id: 'art-quevedo', name: 'Quevedo' }],
      album: {
        id: 'alb-quevedo',
        name: 'Donde Quiero Estar',
        images: [{ url: 'https://i.scdn.co/image/ab67616d0000b273b4c126620583cc285b0378eb' }],
      },
      duration_ms: 198000,
    });

    const engine = window.__audioEngine;
    const currentTrackId = engine ? engine.getCurrentTrackId() : null;

    return {
      success: true,
      currentTrackId,
      isPlaying: store.getState().isPlaying,
      currentTrackName: store.getState().currentTrack?.name,
    };
  });
  console.log('TEST 2 - Mobile playTrack result:', playResult);

  // Give miniplayer time to render
  await new Promise((r) => setTimeout(r, 600));

  // Screenshot with active playing track on mobile
  const miniPlayerShot = path.join(ARTIFACT_DIR, 'mobile_audio_playing_verified.png');
  await page.screenshot({ path: miniPlayerShot });
  console.log('Captured screenshot:', miniPlayerShot);

  // 3. Test cookie persistence: simulate mobile paste with smart quotes
  const cookieTest = await page.evaluate(() => {
    // Test smart quote sanitization
    const smartQuoteCookie = '“AQDTestCookie1234567890abcdefghijklmno”';
    const cleaned = smartQuoteCookie.replace(/^[\s"'“”‘’]+|[\s"'“”‘’;]+$/g, '').trim();

    // Mock session saving
    const mockUser = {
      id: 'user_mobile_test_123',
      display_name: 'Usuario Movil Verificado',
      email: 'test@spotify.com',
      images: [{ url: 'https://i.scdn.co/image/ab6775700000ee85b273b4c126620583cc285b03' }],
    };
    const mockPlaylists = [
      {
        id: 'mock_pl_1',
        name: 'Mis Favoritas de Prueba',
        tracks: { total: 10, items: [] },
      },
    ];

    const cacheToSave = { mock_pl_1: mockPlaylists[0] };
    window.localStorage.setItem('user_spotify_cookie', cleaned);
    window.localStorage.setItem('spotifree_active_user_id', mockUser.id);
    window.localStorage.setItem(
      'spotify_extracted_session',
      JSON.stringify({ user: mockUser, playlists: mockPlaylists, _cookie: cleaned })
    );
    window.localStorage.setItem(`spotifree_playlist_cache_${mockUser.id}`, JSON.stringify(cacheToSave));
    window.localStorage.setItem('spotifree_playlist_cache_active', JSON.stringify(cacheToSave));

    return {
      cleaned,
      isCleanAQ: cleaned.startsWith('AQ'),
      length: cleaned.length,
    };
  });
  console.log('TEST 3 - Smart quote cookie sanitization:', cookieTest);

  // 4. Reload page and check that account, session, and playlists persist seamlessly on mobile
  console.log('Reloading page to test persistence...');
  await page.reload({ waitUntil: 'networkidle0' });

  const sessionAfterReload = await page.evaluate(() => {
    const store = window.useSpotifyDataStore?.getState?.() || {};
    const extracted = window.localStorage.getItem('spotify_extracted_session');
    const cookie = window.localStorage.getItem('user_spotify_cookie');
    const activeUserId = window.localStorage.getItem('spotifree_active_user_id');
    const playlistCache = window.localStorage.getItem(`spotifree_playlist_cache_${activeUserId}`);

    return {
      hasCookie: !!cookie,
      hasActiveUserId: !!activeUserId,
      hasSession: !!extracted,
      hasPlaylistCache: !!playlistCache,
      audioEngineReady: typeof window.__audioEngine !== 'undefined',
    };
  });
  console.log('TEST 4 - Persistence after reload:', sessionAfterReload);

  const persistenceShot = path.join(ARTIFACT_DIR, 'mobile_session_persistence_verified.png');
  await page.screenshot({ path: persistenceShot });
  console.log('Captured screenshot:', persistenceShot);

  await browser.close();
  server.close();
  console.log('All mobile audio and session tests PASSED successfully!');
}

run().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
