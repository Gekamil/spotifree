import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

async function main() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  // Standard iPhone 14/15 viewport (393x852)
  await page.setViewport({ width: 393, height: 852, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1');

  const outDir = 'public/mobile-spotify-real';
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const dismissBanners = async () => {
    try {
      await page.evaluate(() => {
        document.querySelectorAll('#onetrust-banner-sdk, [data-testid=\"cookie-banner\"], #onetrust-consent-sdk').forEach(el => el.remove());
      });
    } catch {}
  };

  // 1. Mobile Home
  console.log('Capturing Mobile Home...');
  await page.goto('https://open.spotify.com/', { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));
  await dismissBanners();
  await page.screenshot({ path: path.join(outDir, '01_mobile_home.png') });

  // 2. Mobile Search / Browse
  console.log('Capturing Mobile Search...');
  await page.goto('https://open.spotify.com/search', { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));
  await dismissBanners();
  await page.screenshot({ path: path.join(outDir, '02_mobile_search.png') });

  // 3. Mobile Playlist (Éxitos España)
  console.log('Capturing Mobile Playlist...');
  await page.goto('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M', { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));
  await dismissBanners();
  await page.screenshot({ path: path.join(outDir, '03_mobile_playlist.png') });

  // 4. Mobile Album
  console.log('Capturing Mobile Album...');
  await page.goto('https://open.spotify.com/album/3NfLFMJll0BlczcIVzDu2m', { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));
  await dismissBanners();
  await page.screenshot({ path: path.join(outDir, '04_mobile_album.png') });

  await browser.close();
  console.log('All real Spotify mobile captures saved in', outDir);
}

main().catch(console.error);
