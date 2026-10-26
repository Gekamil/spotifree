import puppeteer from 'puppeteer-core';
import path from 'node:path';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  let appPage = pages.find(p => p.url().includes('127.0.0.1:5173') || p.url().includes('localhost:5173'));

  if (!appPage) {
    appPage = await browser.newPage();
  }

  await appPage.setViewport({ width: 1400, height: 900 });
  await appPage.goto('http://127.0.0.1:5173/');

  // Wait for session and playlists to load
  await new Promise(r => setTimeout(r, 2000));

  // 1. Screenshot Home View
  const homePath = path.resolve('C:/Users/jorge/.gemini/antigravity/brain/b7d3ec29-c076-4935-90b5-23f42c286313/spotifree-real-dynamic-home.png');
  await appPage.screenshot({ path: homePath });
  console.log('✓ Captured home view:', homePath);

  // 2. Click on "Romeo & Prince" in sidebar or quick access
  const clicked = await appPage.evaluate(() => {
    const all = Array.from(document.querySelectorAll('aside p, aside span, main button, main div'));
    const romeo = all.find(el => el.textContent?.trim() === 'Romeo & Prince');
    if (romeo) {
      romeo.click();
      return true;
    }
    return false;
  });
  console.log('Clicked Romeo & Prince:', clicked);

  // Wait for dynamic tracks to fetch
  await new Promise(r => setTimeout(r, 2500));

  // Screenshot Romeo & Prince playlist view with dynamic tracks
  const romeoPath = path.resolve('C:/Users/jorge/.gemini/antigravity/brain/b7d3ec29-c076-4935-90b5-23f42c286313/spotifree-romeo-real-33-tracks.png');
  await appPage.screenshot({ path: romeoPath });
  console.log('✓ Captured Romeo & Prince view with real tracks:', romeoPath);

  // 3. Click first track to play audio
  const played = await appPage.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('.space-y-0\\.5 > div'));
    if (rows.length > 0) {
      rows[0].click();
      return { clicked: true, track: rows[0].innerText.split('\n')[0] };
    }
    return { clicked: false };
  });
  console.log('Clicked first track to play:', played);

  await new Promise(r => setTimeout(r, 2500));

  // Check audio element status
  const audioStatus = await appPage.evaluate(() => {
    const playerStore = window.__usePlayerStore ? window.__usePlayerStore.getState() : null;
    return {
      isPlaying: playerStore?.isPlaying,
      currentTrack: playerStore?.currentTrack?.name,
      artist: playerStore?.currentTrack?.artists?.[0]?.name,
      previewUrl: !!playerStore?.currentTrack?.preview_url,
      progressMs: playerStore?.progressMs
    };
  });
  console.log('Audio Player State:', audioStatus);

  // Screenshot with active playback
  const playingPath = path.resolve('C:/Users/jorge/.gemini/antigravity/brain/b7d3ec29-c076-4935-90b5-23f42c286313/spotifree-real-audio-playing.png');
  await appPage.screenshot({ path: playingPath });
  console.log('✓ Captured active playback:', playingPath);

  // 4. Click "Canciones que te gustan"
  const clickedLiked = await appPage.evaluate(() => {
    const all = Array.from(document.querySelectorAll('aside p, aside span, main button, main div'));
    const liked = all.find(el => el.textContent?.trim().includes('Canciones que te gustan'));
    if (liked) {
      liked.click();
      return true;
    }
    return false;
  });
  console.log('Clicked Liked Songs:', clickedLiked);

  await new Promise(r => setTimeout(r, 2000));

  const likedTracksCount = await appPage.evaluate(() => {
    const rows = document.querySelectorAll('.space-y-0\\.5 > div');
    return rows.length;
  });
  console.log('Liked songs rows rendered:', likedTracksCount);

  const likedPath = path.resolve('C:/Users/jorge/.gemini/antigravity/brain/b7d3ec29-c076-4935-90b5-23f42c286313/spotifree-liked-songs-23-real.png');
  await appPage.screenshot({ path: likedPath });
  console.log('✓ Captured liked songs view with 23 real songs:', likedPath);

  // 5. Click "el nuevo urbano"
  const clickedUrbano = await appPage.evaluate(() => {
    const all = Array.from(document.querySelectorAll('aside p, aside span'));
    const urb = all.find(el => el.textContent?.trim() === 'el nuevo urbano');
    if (urb) {
      urb.click();
      return true;
    }
    return false;
  });
  console.log('Clicked el nuevo urbano:', clickedUrbano);

  await new Promise(r => setTimeout(r, 2500));

  const urbanoTracksCount = await appPage.evaluate(() => {
    const rows = document.querySelectorAll('.space-y-0\\.5 > div');
    return rows.length;
  });
  console.log('el nuevo urbano rows rendered:', urbanoTracksCount);

  const urbanoPath = path.resolve('C:/Users/jorge/.gemini/antigravity/brain/b7d3ec29-c076-4935-90b5-23f42c286313/spotifree-urbano-100-real-tracks.png');
  await appPage.screenshot({ path: urbanoPath });
  console.log('✓ Captured el nuevo urbano view with 100 real tracks:', urbanoPath);

  browser.disconnect();
}

main().catch(console.error);
