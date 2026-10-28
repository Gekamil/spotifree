import puppeteer from 'puppeteer-core';
import path from 'node:path';

async function main() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

  console.log('Launching browser to test https://spotifreeweb.vercel.app ...');
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
  await page.setViewport({ width: 1440, height: 900 });

  console.log('Navigating to https://spotifreeweb.vercel.app ...');
  await page.goto('https://spotifreeweb.vercel.app', { waitUntil: 'networkidle2', timeout: 30000 });

  // 1. Check top nav for Guest state / Login button
  const topNavText = await page.evaluate(() => document.body.innerText);
  console.log('Page loaded. Checking guest status...');
  const hasLoginButton = topNavText.includes('Iniciar sesión con Spotify');
  console.log('Has "Iniciar sesión con Spotify" button:', hasLoginButton);

  // 2. Click on the first playlist or play a song
  console.log('Initiating track playback via window.__audioEngine and window.__usePlayerStore ...');
  const playResult = await page.evaluate(async () => {
    try {
      const playerStore = window.__usePlayerStore;
      const dataStore = window.__useSpotifyDataStore;
      const audioEngine = window.__audioEngine;

      if (!playerStore || !audioEngine) {
        return { error: 'Stores not found on window' };
      }

      // Find first track from playlists or dynamic shelves
      const state = dataStore ? dataStore.getState() : null;
      let targetTrack = null;
      if (state && state.playlists && state.playlists.length > 0) {
        for (const p of state.playlists) {
          if (p.tracks?.items && p.tracks.items.length > 0) {
            targetTrack = p.tracks.items[0];
            break;
          }
        }
      }

      if (!targetTrack) {
        targetTrack = {
          id: 'test-yellow',
          name: 'Yellow',
          artists: [{ name: 'Coldplay' }],
          album: { name: 'Parachutes', images: [{ url: 'https://i.scdn.co/image/ab67616d0000b2739164ba7048e0fce520de9191' }] },
          duration_ms: 269000,
        };
      }

      // Trigger playback
      playerStore.getState().playTrack(targetTrack);
      await audioEngine.playTrack(targetTrack.id, `${targetTrack.name} ${targetTrack.artists[0]?.name || ''}`, 0);

      return {
        trackName: targetTrack.name,
        artist: targetTrack.artists[0]?.name,
        duration: targetTrack.duration_ms,
      };
    } catch (e) {
      return { error: e.message };
    }
  });

  console.log('Play triggered:', playResult);

  // Wait 4 seconds to observe real playback progression
  console.log('Waiting 5 seconds to observe playback time progression...');
  await new Promise((r) => setTimeout(r, 5000));

  const progressState = await page.evaluate(() => {
    const player = window.__usePlayerStore?.getState();
    const engine = window.__audioEngine;
    return {
      isPlaying: player?.isPlaying,
      progressMs: player?.progressMs,
      durationMs: player?.durationMs,
      engineTime: engine?.getCurrentTime ? engine.getCurrentTime() : -1,
      engineDuration: engine?.getDuration ? engine.getDuration() : -1,
      currentTrack: player?.currentTrack?.name,
    };
  });

  console.log('Current Playback State after 5s:', progressState);

  // Take screenshot
  const screenshotPath = path.resolve('spotifree-live-verified-playback.png');
  await page.screenshot({ path: screenshotPath });
  console.log('Saved screenshot to:', screenshotPath);

  await browser.close();

  if (progressState.progressMs > 0 || progressState.engineTime > 0) {
    console.log('SUCCESS: Audio is actively playing and progress is moving forward!');
  } else {
    console.log('NOTICE: Check if autoplay or YouTube IFrame required an explicit user click.');
  }
}

main().catch(console.error);
