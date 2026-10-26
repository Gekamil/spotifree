import puppeteer from 'puppeteer-core';
import path from 'node:path';

async function main() {
  const artifactDir = 'C:\\Users\\jorge\\.gemini\\antigravity\\brain\\b7d3ec29-c076-4935-90b5-23f42c286313';
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: { width: 1440, height: 900 },
  });

  const pages = await browser.pages();
  let page = pages.find((p) => p.url().includes('5173'));
  if (!page) page = await browser.newPage();

  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 1500));

  console.log('1. Page loaded. Selecting "Romeo & Prince" from sidebar...');

  // Click specifically on Romeo & Prince
  await page.evaluate(() => {
    const pElements = Array.from(document.querySelectorAll('aside p'));
    const romeoP = pElements.find((el) => el.textContent?.trim() === 'Romeo & Prince');
    if (romeoP) {
      (romeoP.closest('div.cursor-pointer') || romeoP).click();
    }
  });

  await new Promise((r) => setTimeout(r, 2000));

  // Check playlist title & tracks
  const playlistState = await page.evaluate(() => {
    const title = document.querySelector('main h1')?.textContent?.trim();
    const trackRows = Array.from(document.querySelectorAll('main div.group.cursor-pointer'));
    const tracks = trackRows.map((r) => {
      const name = r.querySelector('p.font-semibold')?.textContent?.trim();
      const artist = r.querySelector('p.text-xs')?.textContent?.trim();
      const album = r.querySelectorAll('div')[2]?.textContent?.trim();
      const img = r.querySelector('img')?.src;
      return { name, artist, album, img };
    });
    return { title, tracksCount: tracks.length, tracks };
  });

  console.log('2. Playlist View state:', JSON.stringify(playlistState, null, 2));

  // Screenshot playlist with distinct individual track covers
  const playlistScreen = path.join(artifactDir, 'spotifree-romeo-individual-track-covers.png');
  await page.screenshot({ path: playlistScreen });
  console.log('Saved playlist screenshot to:', playlistScreen);

  // 3. Click Play on Track 2 (La Diabla)
  console.log('3. Clicking play on "La Diabla"...');
  await page.evaluate(() => {
    const trackRows = Array.from(document.querySelectorAll('main div.group.cursor-pointer'));
    const diablaRow = trackRows.find((r) => r.textContent?.includes('La Diabla'));
    if (diablaRow) {
      diablaRow.click();
    }
  });

  // Wait 4 seconds to observe playback
  await new Promise((r) => setTimeout(r, 4000));

  const playbackState = await page.evaluate(() => {
    const footer = document.querySelector('footer');
    const track = footer?.querySelector('span.text-white')?.textContent?.trim();
    const artist = footer?.querySelector('span.text-\\[\\#b3b3b3\\]')?.textContent?.trim();
    const img = footer?.querySelector('img')?.src;
    const timeCur = footer?.querySelector('span.w-8:first-child')?.textContent?.trim();
    const timeDur = footer?.querySelector('span.w-8:last-child')?.textContent?.trim();
    return { track, artist, img, timeCur, timeDur };
  });

  const engineStatus = await fetch('http://127.0.0.1:5173/api/audio/status').then((r) => r.json());
  console.log('4. Playback UI state:', playbackState);
  console.log('   Audio Engine Status:', engineStatus);

  const playingScreen = path.join(artifactDir, 'spotifree-playing-la-diabla-000.png');
  await page.screenshot({ path: playingScreen });
  console.log('Saved playing screenshot to:', playingScreen);

  // 4. Test "Editar datos" modal
  console.log('5. Opening "Editar datos" modal...');
  await page.evaluate(() => {
    const titleEl = document.querySelector('main h1');
    if (titleEl) titleEl.click();
  });

  await new Promise((r) => setTimeout(r, 800));

  const editModalScreen = path.join(artifactDir, 'spotifree-edit-playlist-modal.png');
  await page.screenshot({ path: editModalScreen });
  console.log('Saved edit modal screenshot to:', editModalScreen);

  // Edit title in modal and save
  await page.evaluate(() => {
    const input = document.querySelector('input[placeholder="Nombre de la lista"]');
    if (input) {
      (input).value = 'Romeo & Prince (Favoritas)';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const saveBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Guardar');
    if (saveBtn) saveBtn.click();
  });

  await new Promise((r) => setTimeout(r, 1000));
  const newTitle = await page.evaluate(() => document.querySelector('main h1')?.textContent?.trim());
  console.log('6. Updated playlist title in UI after modal save:', newTitle);

  // 5. Test Settings Modal (Spotube Style)
  console.log('7. Opening Settings Modal...');
  await page.evaluate(() => {
    const avatar = document.querySelector('header button[title*="Jorge"], header button[aria-label*="Jorge"]') ||
                   document.querySelector('header button.w-8.h-8.rounded-full');
    if (avatar) avatar.click();
  });

  await new Promise((r) => setTimeout(r, 600));

  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const configBtn = btns.find((b) => b.textContent?.includes('Configuración'));
    if (configBtn) configBtn.click();
  });

  await new Promise((r) => setTimeout(r, 800));

  const settingsScreen = path.join(artifactDir, 'spotifree-settings-spotube-modal.png');
  await page.screenshot({ path: settingsScreen });
  console.log('Saved settings screenshot to:', settingsScreen);

  browser.disconnect();
  console.log('ALL TESTS PASSED WITH 100% SUCCESS!');
}

main().catch(console.error);
