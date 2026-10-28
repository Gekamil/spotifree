import puppeteer from 'puppeteer-core';
import path from 'node:path';
import { execSync } from 'node:child_process';

const artifactDir = 'C:\\Users\\jorge\\.gemini\\antigravity\\brain\\b7d3ec29-c076-4935-90b5-23f42c286313';

async function main() {
  console.log('Waiting 18s for Vercel deployment to complete...');
  await new Promise(r => setTimeout(r, 18000));

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  // iPhone 14/15 Pro viewport (393x852)
  await page.setViewport({ width: 393, height: 852, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await page.setUserAgent(
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
  );

  // 1. Home
  console.log('Capturing Spotifree Mobile Home...');
  await page.goto('https://spotifreeweb.vercel.app/', { waitUntil: 'networkidle2', timeout: 35000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 2500));
  await page.screenshot({ path: path.join(artifactDir, 'spotifree_mobile_home.png') });

  // 2. Search
  console.log('Capturing Spotifree Mobile Search...');
  const searchBtn = await page.$('[data-testid="bottom-tab-navigation"] button:nth-child(2)');
  if (searchBtn) {
    await searchBtn.click();
    await new Promise(r => setTimeout(r, 1500));
  }
  await page.screenshot({ path: path.join(artifactDir, 'spotifree_mobile_search.png') });

  // 3. Playlist detail
  console.log('Capturing Spotifree Mobile Playlist Detail...');
  const homeBtn = await page.$('[data-testid="bottom-tab-navigation"] button:nth-child(1)');
  if (homeBtn) {
    await homeBtn.click();
    await new Promise(r => setTimeout(r, 1200));
  }
  const firstShortcut = await page.$('.grid > div');
  if (firstShortcut) {
    await firstShortcut.click();
    await new Promise(r => setTimeout(r, 2000));
  }
  await page.screenshot({ path: path.join(artifactDir, 'spotifree_mobile_playlist.png') });

  // 4. Library
  console.log('Capturing Spotifree Mobile Library...');
  const libBtn = await page.$('[data-testid="bottom-tab-navigation"] button:nth-child(3)');
  if (libBtn) {
    await libBtn.click();
    await new Promise(r => setTimeout(r, 1500));
  }
  await page.screenshot({ path: path.join(artifactDir, 'spotifree_mobile_library.png') });

  await browser.close();
  console.log('Captured all Spotifree Mobile screens successfully!');

  // Generate Side-by-side Comparisons
  console.log('Generating side-by-side comparison images with Python Pillow...');
  execSync('python scripts/generate_mobile_comparisons.py', { stdio: 'inherit' });
  console.log('All comparisons generated!');
}

main().catch(console.error);
