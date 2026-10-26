import puppeteer from 'puppeteer-core';

async function testRemotePlay() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('open.spotify.com'));
  if (!spotifyPage) {
    console.log('No spotify page found');
    browser.disconnect();
    return;
  }

  // Check current playback state on Spotify Web
  const playbackInfo = await spotifyPage.evaluate(() => {
    const playPauseBtn = document.querySelector('[data-testid="control-button-playpause"]');
    const isPlaying = playPauseBtn?.getAttribute('aria-label')?.toLowerCase().includes('paus');
    const trackName = document.querySelector('[data-testid="now-playing-widget"] a')?.textContent?.trim();
    return { isPlaying, trackName };
  });
  console.log('Spotify Web player current state:', playbackInfo);

  // Trigger play/pause
  await spotifyPage.evaluate(() => {
    const playPauseBtn = document.querySelector('[data-testid="control-button-playpause"]');
    if (playPauseBtn) playPauseBtn.click();
  });

  await new Promise(r => setTimeout(r, 1500));

  const afterState = await spotifyPage.evaluate(() => {
    const playPauseBtn = document.querySelector('[data-testid="control-button-playpause"]');
    const isPlaying = playPauseBtn?.getAttribute('aria-label')?.toLowerCase().includes('paus');
    const trackName = document.querySelector('[data-testid="now-playing-widget"] a')?.textContent?.trim();
    return { isPlaying, trackName };
  });
  console.log('Spotify Web player after toggle:', afterState);

  browser.disconnect();
}

testRemotePlay().catch(console.error);
