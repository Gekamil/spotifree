import puppeteer from 'puppeteer-core';

async function testPlayTrack(trackUri) {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('open.spotify.com'));
  if (!spotifyPage) {
    console.log('No spotify page found');
    browser.disconnect();
    return;
  }

  console.log(`Instructing Spotify Web to play track ${trackUri}...`);
  // Navigate directly to track page or use Spotify's internal player
  await spotifyPage.goto(`https://open.spotify.com/track/${trackUri}`);
  await new Promise(r => setTimeout(r, 2000));

  // Click play button on the track page
  const playClicked = await spotifyPage.evaluate(() => {
    const playBtn = document.querySelector('[data-testid="play-button"], button[data-testid="action-bar-row-play-button"], [aria-label*="Reproducir"]');
    if (playBtn) {
      playBtn.click();
      return true;
    }
    return false;
  });
  console.log('Clicked play button on track page:', playClicked);

  await new Promise(r => setTimeout(r, 2000));

  const state = await spotifyPage.evaluate(() => {
    const playPauseBtn = document.querySelector('[data-testid="control-button-playpause"]');
    const isPlaying = playPauseBtn?.getAttribute('aria-label')?.toLowerCase().includes('paus');
    const nowPlaying = document.querySelector('[data-testid="now-playing-widget"]')?.innerText;
    return { isPlaying, nowPlaying };
  });
  console.log('Now playing on Spotify Web:', state);

  browser.disconnect();
}

// Test with Rain by Trueno (1EljzqiV1RDtXj1QUbx3db)
testPlayTrack('1EljzqiV1RDtXj1QUbx3db').catch(console.error);
