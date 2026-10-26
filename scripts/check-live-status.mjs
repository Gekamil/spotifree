import puppeteer from 'puppeteer-core';

async function run() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const page = (await browser.pages()).find((p) => p.url().includes('5173'));
  if (!page) return console.log('Page not found');

  const status = await page.evaluate(() => {
    const ae = window.__audioEngine;
    const store = window.__usePlayerStore?.getState?.();
    const rightSidebar = document.querySelector('aside');
    return {
      currentTrack: store?.currentTrack?.name,
      artist: store?.currentTrack?.artists?.[0]?.name,
      isPlaying: store?.isPlaying,
      progressMs: store?.progressMs,
      audioPaused: ae?.audio?.paused,
      audioTime: ae?.audio?.currentTime,
      audioDuration: ae?.audio?.duration,
      sidebarText: rightSidebar ? rightSidebar.innerText.slice(0, 300) : null,
    };
  });

  console.log('Live playback status:', JSON.stringify(status, null, 2));
}

run().catch(console.error);
