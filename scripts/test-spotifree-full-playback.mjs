import puppeteer from 'puppeteer-core';

async function run() {
  console.log('1. Connecting to browser on port 9222...');
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const page = pages.find((p) => p.url().includes('5173'));
  if (!page) throw new Error('Spotifree tab not found on port 9222');

  console.log('2. Checking audioEngine & player store on Spotifree page...');
  const engineStatus = await page.evaluate(() => {
    const ae = (window).__audioEngine;
    const store = (window).__usePlayerStore?.getState?.();
    return {
      hasEngine: !!ae,
      hasStore: !!store,
      currentTrack: store?.currentTrack?.name,
      isPlaying: store?.isPlaying,
    };
  });
  console.log('Engine status:', engineStatus);

  console.log('3. Triggering play on a song via UI click or store...');
  // Find a track row in the playlist
  const trackClicked = await page.evaluate(() => {
    // Try clicking a track row
    const row = document.querySelector('[data-testid="track-row"]') || document.querySelector('[role="row"]');
    if (row) {
      (row).click();
      return { clicked: true, text: row.textContent?.slice(0, 50) };
    }
    return { clicked: false };
  });
  console.log('Track click result:', trackClicked);

  if (!trackClicked.clicked) {
    // If not on a playlist page with track rows, play via audioEngine directly
    console.log('Playing via store/audioEngine...');
    await page.evaluate(() => {
      const ae = (window).__audioEngine;
      const store = (window).__usePlayerStore?.getState?.();
      if (store?.playTrack) {
        store.playTrack({
          id: 'test-track-1',
          name: 'Eres Mía',
          duration_ms: 250000,
          artists: [{ name: 'Romeo Santos', id: 'romeo-santos' }],
          album: { name: 'Fórmula, Vol. 2', images: [{ url: 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg' }] },
        });
      }
    });
  }

  console.log('4. Waiting 4 seconds for audio to buffer and start...');
  await new Promise((r) => setTimeout(r, 4000));

  console.log('5. Monitoring audio playback for 15 seconds...');
  for (let i = 1; i <= 5; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const audioState = await page.evaluate(() => {
      const ae = (window).__audioEngine;
      const store = (window).__usePlayerStore?.getState?.();
      const audio = (ae)?.audio;
      return {
        audioTime: audio?.currentTime,
        audioPaused: audio?.paused,
        audioDuration: audio?.duration,
        audioSrc: audio?.src?.slice(0, 60),
        storeProgressMs: store?.progressMs,
        storeIsPlaying: store?.isPlaying,
      };
    });
    console.log(`t=+${i * 3}s:`, audioState);
  }

  console.log('6. Testing SEEK to second 75 (past 60s boundary!)...');
  await page.evaluate(() => {
    const ae = (window).__audioEngine;
    ae?.seek(75);
  });

  await new Promise((r) => setTimeout(r, 2000));
  const afterSeek = await page.evaluate(() => {
    const ae = (window).__audioEngine;
    const audio = (ae)?.audio;
    return {
      audioTime: audio?.currentTime,
      audioPaused: audio?.paused,
      audioDuration: audio?.duration,
    };
  });
  console.log('After seek to 75s:', afterSeek);

  console.log('7. Monitoring past second 80 to ensure NO stall at all...');
  for (let i = 1; i <= 3; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const audioState = await page.evaluate(() => {
      const ae = (window).__audioEngine;
      const audio = (ae)?.audio;
      return {
        audioTime: audio?.currentTime,
        audioPaused: audio?.paused,
      };
    });
    console.log(`t=seek+${i * 3}s:`, audioState);
  }

  await page.screenshot({ path: 'scripts/spotifree-final-native-playback.png' });
  console.log('8. Screenshot captured: scripts/spotifree-final-native-playback.png');
}

run().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
