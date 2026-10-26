import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

async function verify() {
  const artifactDir = 'C:\\Users\\jorge\\.gemini\\antigravity\\brain\\b7d3ec29-c076-4935-90b5-23f42c286313';
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: { width: 1440, height: 900 },
  });

  const pages = await browser.pages();
  let spotifreePage = pages.find((p) => p.url().includes('5173'));
  if (!spotifreePage) {
    spotifreePage = await browser.newPage();
  }

  await spotifreePage.setViewport({ width: 1440, height: 900 });
  await spotifreePage.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 2000));

  console.log('1. Page loaded. Checking sidebar playlists...');

  // Click on Romeo & Prince playlist row in sidebar
  const clickedPlaylist = await spotifreePage.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('aside [role="row"], aside div'));
    const target = rows.find((r) => r.innerText?.includes('Romeo') || r.innerText?.includes('Prince'));
    if (target) {
      target.click();
      return true;
    }
    return false;
  });
  console.log('Clicked Romeo & Prince playlist in sidebar:', clickedPlaylist);

  await new Promise((r) => setTimeout(r, 3000));

  // Inspect track covers in playlist view
  const trackCoversInfo = await spotifreePage.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('main div.group.cursor-pointer, main [data-testid="tracklist-row"]'));
    return rows.map((r) => {
      const title = r.querySelector('p.font-semibold, [data-encore-id="textLarge"]')?.textContent?.trim();
      const album = r.querySelector('div:nth-child(3)')?.textContent?.trim();
      const img = r.querySelector('img')?.src;
      return { title, album, img };
    });
  });

  console.log('2. Track rows in playlist view:', trackCoversInfo);

  // Take screenshot of Playlist View with distinct track covers
  const playlistScreenPath = path.join(artifactDir, 'spotifree-playlist-individual-covers.png');
  await spotifreePage.screenshot({ path: playlistScreenPath });
  console.log('Saved playlist screenshot to:', playlistScreenPath);

  // 3. Play a track (e.g. La Diabla or first track)
  console.log('3. Triggering play on track...');
  await spotifreePage.evaluate(() => {
    const playButtons = Array.from(document.querySelectorAll('main button[title*="Reproducir"], main button.w-14'));
    if (playButtons.length > 0) {
      playButtons[0].click();
    }
  });

  // Wait 3.5 seconds and inspect scrubber & audio status
  await new Promise((r) => setTimeout(r, 3500));

  const audioStatusRes = await fetch('http://127.0.0.1:5173/api/audio/status');
  const audioStatus = await audioStatusRes.json();
  console.log('Live Audio Engine Status from 0:00:', audioStatus);

  const playerState = await spotifreePage.evaluate(() => {
    const footer = document.querySelector('footer');
    const trackName = footer?.querySelector('span.text-white')?.textContent?.trim();
    const artist = footer?.querySelector('span.text-\\[\\#b3b3b3\\]')?.textContent?.trim();
    const cover = footer?.querySelector('img')?.src;
    const timeCurrent = footer?.querySelector('span.w-8:first-child')?.textContent?.trim();
    const timeTotal = footer?.querySelector('span.w-8:last-child')?.textContent?.trim();
    const bar = footer?.querySelector('.bg-spotify-green, .bg-white');
    const progressWidth = bar ? bar.style.width : '0%';
    return { trackName, artist, cover, timeCurrent, timeTotal, progressWidth };
  });

  console.log('Desktop Player State in UI:', playerState);

  // Take screenshot of active playing track with moving progress bar
  const playingScreenPath = path.join(artifactDir, 'spotifree-live-playback-scrubber.png');
  await spotifreePage.screenshot({ path: playingScreenPath });
  console.log('Saved playback screenshot to:', playingScreenPath);

  // 4. Test "Editar datos" modal
  console.log('4. Testing Edit Playlist Modal...');
  await spotifreePage.evaluate(() => {
    const playlistTitle = document.querySelector('main h1');
    if (playlistTitle) {
      playlistTitle.click();
    }
  });

  await new Promise((r) => setTimeout(r, 1000));

  const editModalVisible = await spotifreePage.evaluate(() => {
    const modalH2 = document.querySelector('h2');
    return modalH2?.textContent?.includes('Editar información');
  });
  console.log('Edit Playlist Modal is open:', editModalVisible);

  const editModalScreenPath = path.join(artifactDir, 'spotifree-edit-playlist-modal.png');
  await spotifreePage.screenshot({ path: editModalScreenPath });
  console.log('Saved edit modal screenshot to:', editModalScreenPath);

  // Close modal
  await spotifreePage.evaluate(() => {
    const closeBtn = document.querySelector('button[title="Cerrar"]');
    if (closeBtn) closeBtn.click();
  });
  await new Promise((r) => setTimeout(r, 500));

  // 5. Test Settings Modal (Spotube Style)
  console.log('5. Testing Settings Modal (Spotube Style)...');
  await spotifreePage.evaluate(() => {
    const userBtn = document.querySelector('header button[title*="Jorge"], header button[aria-label*="Jorge"]') ||
                    document.querySelector('header button.w-8.h-8.rounded-full');
    if (userBtn) userBtn.click();
  });
  await new Promise((r) => setTimeout(r, 600));

  await spotifreePage.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const configBtn = btns.find((b) => b.textContent?.includes('Configuración'));
    if (configBtn) configBtn.click();
  });
  await new Promise((r) => setTimeout(r, 1000));

  const settingsModalScreenPath = path.join(artifactDir, 'spotifree-settings-spotube-modal.png');
  await spotifreePage.screenshot({ path: settingsModalScreenPath });
  console.log('Saved settings modal screenshot to:', settingsModalScreenPath);

  browser.disconnect();
  console.log('Verification completed successfully!');
}

verify().catch(console.error);
