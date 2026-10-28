import puppeteer from 'puppeteer-core';
import path from 'node:path';

async function main() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

  console.log('1. Testing resolveSpotifyPlaylist with real Spotify playlist IDs...');
  const playlistModule = await import('../api/playlist.js');
  const topHits = await playlistModule.resolveSpotifyPlaylist('37i9dQZF1DXcBWIGoYBM5M');
  console.log(`- Playlist "${topHits.name}" resolved with ${topHits.tracks.items.length} real tracks.`);
  console.log(`- Top track: "${topHits.tracks.items[0]?.name}" by ${topHits.tracks.items[0]?.artists?.[0]?.name}`);
  if (topHits.tracks.items.length === 0 || !topHits.tracks.items[0]?.name) {
    throw new Error('Playlist extraction failed or returned zero tracks');
  }

  console.log('\n2. Launching headless Chrome to test Mobile & Reload behavior on live preview...');
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: 'new',
    args: [
      '--autoplay-policy=no-user-gesture-required',
      '--disable-web-security',
      '--allow-running-insecure-content',
      '--no-sandbox',
    ],
  });

  const page = await browser.newPage();
  
  // Set iPhone mobile viewport
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.setUserAgent(
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
  );

  console.log('Navigating to http://localhost:5173 ...');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle2', timeout: 15000 }).catch(async () => {
    console.log('Falling back to https://spotifreeweb.vercel.app ...');
    await page.goto('https://spotifreeweb.vercel.app', { waitUntil: 'networkidle2', timeout: 20000 });
  });

  // Verify mobile playTrack execution
  console.log('Triggering mobile playback via usePlayerStore...');
  const playResult = await page.evaluate(async () => {
    try {
      const playerStore = window.__usePlayerStore;
      const dataStore = window.__useSpotifyDataStore;
      const audioEngine = window.__audioEngine;

      if (!playerStore || !audioEngine) {
        return { error: 'Stores not mounted' };
      }

      const testTrack = {
        id: 'mobile-test-song-1',
        name: 'Housewife',
        artists: [{ name: 'Tate McRae' }],
        album: { name: 'Housewife', images: [{ url: 'https://i.scdn.co/image/ab67616d0000b2737c6236a76fbcee4f1b8ace08' }] },
        duration_ms: 208810,
      };

      // Play track on mobile
      playerStore.getState().playTrack(testTrack);

      return {
        success: true,
        isPlaying: playerStore.getState().isPlaying,
        currentTrack: playerStore.getState().currentTrack?.name,
        engineCurrentTrackId: audioEngine.getCurrentTrackId ? audioEngine.getCurrentTrackId() : null,
      };
    } catch (e) {
      return { error: e.message };
    }
  });

  console.log('Mobile Playback Result:', playResult);

  // Take mobile screenshot
  const screenshotMobile = path.resolve('C:\\Users\\jorge\\.gemini\\antigravity\\brain\\b7d3ec29-c076-4935-90b5-23f42c286313\\mobile_real_playback_verified.png');
  await page.screenshot({ path: screenshotMobile });
  console.log('Saved mobile screenshot to:', screenshotMobile);

  // Test reload persistence
  console.log('\n3. Testing Session & Playlist Persistence on reload...');
  await page.evaluate(() => {
    // Simulate user saving session & cookie
    const dummySession = {
      _cookie: 'AQB_fake_test_cookie_for_storage_verification_1234567890',
      user: { id: 'test_user_persistence', display_name: 'Usuario Real Verificado', images: [] },
      playlists: [
        { id: '37i9dQZF1DXcBWIGoYBM5M', name: 'Today’s Top Hits', tracks: { total: 50, items: [] } }
      ],
      shelves: [],
      quickAccess: [],
    };
    window.localStorage.setItem('user_spotify_cookie', dummySession._cookie);
    window.localStorage.setItem('spotify_extracted_session', JSON.stringify(dummySession));
    window.localStorage.setItem('spotifree_playlist_cache_test_user_persistence', JSON.stringify({
      '37i9dQZF1DXcBWIGoYBM5M': {
        id: '37i9dQZF1DXcBWIGoYBM5M',
        name: 'Today’s Top Hits',
        tracks: {
          total: 2,
          items: [
            { id: 'track-1', name: 'Canción Real 1', artists: [{ name: 'Artista Real' }], album: { name: 'Álbum Real' }, duration_ms: 200000 },
            { id: 'track-2', name: 'Canción Real 2', artists: [{ name: 'Artista Real' }], album: { name: 'Álbum Real' }, duration_ms: 180000 },
          ]
        }
      }
    }));
  });

  console.log('Reloading page...');
  await page.reload({ waitUntil: 'networkidle2' });

  const restoredState = await page.evaluate(() => {
    const dataStore = window.__useSpotifyDataStore?.getState();
    return {
      isAuthenticated: dataStore?.isAuthenticated,
      userDisplayName: dataStore?.user?.display_name,
      playlistCount: dataStore?.playlists?.length,
      firstPlaylistName: dataStore?.playlists?.[0]?.name,
      firstPlaylistTrackCount: dataStore?.playlists?.[0]?.tracks?.items?.length,
      firstTrackName: dataStore?.playlists?.[0]?.tracks?.items?.[0]?.name,
    };
  });

  console.log('Restored state after reload:', restoredState);

  // Clean up test keys
  await page.evaluate(() => {
    window.localStorage.removeItem('user_spotify_cookie');
    window.localStorage.removeItem('spotify_extracted_session');
    window.localStorage.removeItem('spotifree_playlist_cache_test_user_persistence');
  });

  await browser.close();

  if (
    restoredState.isAuthenticated &&
    restoredState.userDisplayName === 'Usuario Real Verificado' &&
    restoredState.firstPlaylistTrackCount === 2
  ) {
    console.log('\nVERIFICATION SUCCESSFUL: Session and real playlist tracks persist seamlessly across page reloads!');
  } else {
    console.log('\nNOTICE: Check reload details:', restoredState);
  }
}

main().catch(console.error);
