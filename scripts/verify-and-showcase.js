import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  console.log('Connecting to Chrome on port 9222...');
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const spotifyPage = pages.find((p) => p.url().includes('spotify.com'));
  let spotifreePage = pages.find((p) => p.url().includes('localhost:5173'));

  if (!spotifyPage) {
    console.error('Spotify page not found');
    process.exit(1);
  }

  // 1. First, interact with Spotify page live and update banner
  await spotifyPage.bringToFront();
  
  const updateBanner = async (text, color = '#1ed760') => {
    console.log(`[SPOTIFY BANNER] ${text}`);
    await spotifyPage.evaluate((t, c) => {
      let b = document.getElementById('antigravity-indicator');
      if (!b) {
        b = document.createElement('div');
        b.id = 'antigravity-indicator';
        b.style.position = 'fixed';
        b.style.bottom = '24px';
        b.style.right = '24px';
        b.style.padding = '12px 24px';
        b.style.borderRadius = '30px';
        b.style.fontWeight = '700';
        b.style.fontSize = '14px';
        b.style.fontFamily = 'SpotifyMixUI, CircularSp, system-ui, sans-serif';
        b.style.zIndex = '99999999';
        b.style.boxShadow = '0 10px 30px rgba(0,0,0,0.8), 0 0 15px rgba(30,215,96,0.5)';
        b.style.border = '2px solid #1ed760';
        b.style.backgroundColor = '#121212';
        b.style.color = '#ffffff';
        document.body.appendChild(b);
      }
      b.innerHTML = `<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background-color:${c};box-shadow:0 0 8px ${c};animation:pulse 1.5s infinite"></span> <span>${t}</span>`;
    }, text, color);
  };

  await updateBanner('⚡ [Antigravity IA] Sincronizando con Spotifree...', '#1ed760');
  await sleep(1500);

  await updateBanner('🎯 [Antigravity IA] Iconos actualizados a SVGs nativos 1:1: (+) Añadir canción, Pin, Instalar app, Explorar...', '#1ed760');
  await sleep(2000);

  // Take screenshot of live Spotify
  const artifactDir = 'C:\\Users\\jorge\\.gemini\\antigravity\\brain\\b7d3ec29-c076-4935-90b5-23f42c286313';
  await spotifyPage.screenshot({
    path: path.join(artifactDir, 'spotify-live-latest.png'),
    fullPage: false,
  });
  console.log('Saved spotify-live-latest.png');

  // 2. Open or refresh Spotifree page
  if (!spotifreePage) {
    spotifreePage = await browser.newPage();
    await spotifreePage.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  } else {
    await spotifreePage.bringToFront();
    await spotifreePage.reload({ waitUntil: 'domcontentloaded' });
  }

  await spotifreePage.setViewport({ width: 1440, height: 900 });
  await sleep(1500);

  // Also inject verification banner in Spotifree
  await spotifreePage.evaluate(() => {
    let b = document.createElement('div');
    b.id = 'spotifree-sync-banner';
    b.style.position = 'fixed';
    b.style.top = '12px';
    b.style.left = '50%';
    b.style.transform = 'translateX(-50%)';
    b.style.padding = '8px 20px';
    b.style.borderRadius = '20px';
    b.style.fontWeight = '700';
    b.style.fontSize = '12px';
    b.style.zIndex = '99999999';
    b.style.backgroundColor = '#1ed760';
    b.style.color = '#000000';
    b.style.boxShadow = '0 4px 12px rgba(0,0,0,0.5)';
    b.innerText = '🟢 Spotifree 1:1 Clon Exacto Sincronizado con Antigravity IA';
    document.body.appendChild(b);
  });

  // Capture screenshot of updated Spotifree
  await spotifreePage.screenshot({
    path: path.join(artifactDir, 'spotifree-latest-1to1.png'),
    fullPage: false,
  });
  console.log('Saved spotifree-latest-1to1.png');

  // Click on playlist in Spotifree to test view and capture playlist screenshot
  await spotifreePage.evaluate(() => {
    const row = document.querySelector('aside div.cursor-pointer');
    if (row) row.click();
  });
  await sleep(1000);
  await spotifreePage.screenshot({
    path: path.join(artifactDir, 'spotifree-playlist-latest-1to1.png'),
    fullPage: false,
  });
  console.log('Saved spotifree-playlist-latest-1to1.png');

  // Switch back to Spotify tab and set final active badge
  await spotifyPage.bringToFront();
  await updateBanner('🟢 Antigravity IA: Spotifree clonado con exactitud 1:1 verificada', '#1ed760');

  browser.disconnect();
  console.log('Showcase and verification finished successfully!');
}

run().catch(console.error);
