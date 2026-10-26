import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

async function verify() {
  console.log('Connecting to Chrome on port 9222...');
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  let appPage = pages.find(p => p.url().includes('5173'));

  if (!appPage) {
    console.log('Opening Spotifree tab...');
    appPage = await browser.newPage();
    await appPage.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle2' });
  } else {
    await appPage.bringToFront();
    await appPage.reload({ waitUntil: 'networkidle2' });
  }

  await new Promise(r => setTimeout(r, 2000));

  console.log('\n--- 1. Testing Configuración View Navigation ---');
  // Click user profile button in top right
  const userBtn = await appPage.$('[data-testid="user-widget-link"], [data-testid="username-first-letter"], header button:last-child');
  if (userBtn) {
    await userBtn.click();
    await new Promise(r => setTimeout(r, 500));
    // Click Configuración
    const clickedConfig = await appPage.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const configBtn = buttons.find(b => b.innerText.includes('Configuración'));
      if (configBtn) {
        configBtn.click();
        return true;
      }
      return false;
    });
    console.log('Clicked Configuración button:', clickedConfig);
    await new Promise(r => setTimeout(r, 1000));

    // Verify Settings page elements
    const settingsCheck = await appPage.evaluate(() => {
      const h1 = document.querySelector('h1')?.innerText;
      const h2s = Array.from(document.querySelectorAll('h2')).map(h => h.innerText);
      const eqSvg = !!document.querySelector('svg circle');
      const sliders = document.querySelectorAll('input[type="range"]').length;
      const toggles = document.querySelectorAll('button[role="switch"]').length;
      return { h1, h2s, eqSvg, sliders, toggles };
    });
    console.log('Settings Check Result:', settingsCheck);

    // Take screenshot of Settings page
    await appPage.screenshot({ path: 'scripts/spotifree-settings-verified.png', fullPage: false });
    console.log('Saved screenshot to scripts/spotifree-settings-verified.png');
  }

  console.log('\n--- 2. Testing Song Playback & Controls ---');
  // Navigate back to home or click a playlist
  const navHome = await appPage.evaluate(() => {
    const homeBtn = document.querySelector('button[title="Inicio"]');
    if (homeBtn) {
      homeBtn.click();
      return true;
    }
    return false;
  });
  console.log('Navigated Home:', navHome);
  await new Promise(r => setTimeout(r, 1500));

  // Select first playlist or liked songs
  const clickedPlaylist = await appPage.evaluate(() => {
    const card = document.querySelector('[data-testid="shortcut-card"], .group.cursor-pointer');
    if (card) {
      card.click();
      return true;
    }
    return false;
  });
  console.log('Clicked Playlist:', clickedPlaylist);
  await new Promise(r => setTimeout(r, 1500));

  // Click first track row
  const playTrackRes = await appPage.evaluate(() => {
    const trackRow = document.querySelector('[role="row"]:not([aria-rowindex="1"])') || document.querySelector('.group\\/row');
    if (trackRow) {
      trackRow.click();
      return { clicked: true, text: trackRow.innerText.slice(0, 50) };
    }
    return { clicked: false };
  });
  console.log('Clicked track row:', playTrackRes);
  await new Promise(r => setTimeout(r, 2000));

  // Check /api/audio/status
  const statusRes = await appPage.evaluate(async () => {
    const res = await fetch('/api/audio/status');
    return await res.json();
  });
  console.log('Audio Engine Status:', statusRes);

  console.log('\n--- 3. Testing Play / Pause Button Responsiveness ---');
  // Click pause on the bottom player
  const pauseClick = await appPage.evaluate(() => {
    const pauseBtn = document.querySelector('button[title="Pausar"], button[aria-label="Pausar"]');
    if (pauseBtn) {
      pauseBtn.click();
      return true;
    }
    return false;
  });
  console.log('Clicked Pause button:', pauseClick);
  await new Promise(r => setTimeout(r, 800));

  const afterPauseStatus = await appPage.evaluate(async () => {
    const res = await fetch('/api/audio/status');
    return await res.json();
  });
  console.log('Status after pause (should be isPlaying: false):', afterPauseStatus);

  // Click resume
  const playClick = await appPage.evaluate(() => {
    const playBtn = document.querySelector('button[title="Reproducir"], button[aria-label="Reproducir"]');
    if (playBtn) {
      playBtn.click();
      return true;
    }
    return false;
  });
  console.log('Clicked Resume button:', playClick);
  await new Promise(r => setTimeout(r, 800));

  const afterResumeStatus = await appPage.evaluate(async () => {
    const res = await fetch('/api/audio/status');
    return await res.json();
  });
  console.log('Status after resume (should be isPlaying: true):', afterResumeStatus);

  // Take screenshot of live player with playback
  await appPage.screenshot({ path: 'scripts/spotifree-player-verified.png', fullPage: false });
  console.log('Saved screenshot to scripts/spotifree-player-verified.png');

  browser.disconnect();
}

verify().catch(console.error);
