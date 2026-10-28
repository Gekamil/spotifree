import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const page = await browser.newPage();

  // Set iPhone 14/15 Pro mobile viewport & user agent
  await page.setViewport({ width: 393, height: 852, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await page.setUserAgent(
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
  );

  const outDir = 'public/spotify-mobile-real-actual';
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const artifactDir = 'C:\\Users\\jorge\\.gemini\\antigravity\\brain\\b7d3ec29-c076-4935-90b5-23f42c286313';

  // 1. Mobile Home
  console.log('Navigating to real Spotify Mobile Home...');
  await page.goto('https://open.spotify.com/intl-es/', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));

  // Extract navigation bar HTML and styles
  const navDetails = await page.evaluate(() => {
    const bottomNav = document.querySelector('[data-testid="bottom-tab-navigation"], nav, footer, .bottom-nav');
    const header = document.querySelector('header, [data-testid="top-bar"], .main-topBar-container');
    const shortcuts = Array.from(document.querySelectorAll('[data-testid="shortcut-item"], .grid > div, [role="gridcell"]')).map(el => ({
      text: el.textContent?.trim(),
      html: el.outerHTML,
      className: el.className
    }));

    return {
      bottomNavHtml: bottomNav ? bottomNav.outerHTML : null,
      bottomNavStyles: bottomNav ? {
        height: window.getComputedStyle(bottomNav).height,
        background: window.getComputedStyle(bottomNav).background,
        backgroundImage: window.getComputedStyle(bottomNav).backgroundImage,
        backdropFilter: window.getComputedStyle(bottomNav).backdropFilter,
        position: window.getComputedStyle(bottomNav).position,
        bottom: window.getComputedStyle(bottomNav).bottom,
      } : null,
      headerHtml: header ? header.outerHTML : null,
      headerStyles: header ? {
        height: window.getComputedStyle(header).height,
        background: window.getComputedStyle(header).background,
      } : null,
      shortcutsCount: shortcuts.length,
      allNavSVGs: Array.from(document.querySelectorAll('nav svg, [data-testid="bottom-tab-navigation"] svg')).map(svg => ({
        viewBox: svg.getAttribute('viewBox'),
        paths: Array.from(svg.querySelectorAll('path')).map(p => p.getAttribute('d')),
        parentText: svg.parentElement?.textContent?.trim()
      }))
    };
  });

  fs.writeFileSync(path.join(outDir, 'real_mobile_nav_details.json'), JSON.stringify(navDetails, null, 2));
  console.log('Saved nav details:', JSON.stringify(navDetails.bottomNavStyles, null, 2));

  await page.screenshot({ path: path.join(outDir, 'real_01_mobile_home.png') });
  await page.screenshot({ path: path.join(artifactDir, 'real_01_mobile_home.png') });

  // 2. Mobile Search
  console.log('Navigating to real Spotify Mobile Search...');
  await page.goto('https://open.spotify.com/intl-es/search', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2500));
  await page.screenshot({ path: path.join(outDir, 'real_02_mobile_search.png') });
  await page.screenshot({ path: path.join(artifactDir, 'real_02_mobile_search.png') });

  // 3. User playlist
  console.log('Navigating to real Spotify Playlist...');
  // Check user playlists or popular playlist
  await page.goto('https://open.spotify.com/intl-es/playlist/43GWp9FbN9nHihudedyVQM', { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 2500));
  await page.screenshot({ path: path.join(outDir, 'real_03_mobile_playlist.png') });
  await page.screenshot({ path: path.join(artifactDir, 'real_03_mobile_playlist.png') });

  await page.close();
  browser.disconnect();
  console.log('Done capturing actual real Spotify Mobile!');
}

main().catch(console.error);
