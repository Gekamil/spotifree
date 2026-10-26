import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function extract() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const page = pages.find((p) => p.url().includes('spotify.com')) || pages[0];

  console.log('Extracting from live authenticated session:', page.url());

  const data = await page.evaluate(() => {
    // 1. Top bar inspection
    const header = document.querySelector('header') || document.querySelector('[data-testid="top-bar"]') || document.querySelector('.Root__top-bar');
    const headerStyle = header ? window.getComputedStyle(header) : null;

    // 2. Extract all SVGs in top bar
    const topBarSvgs = header ? Array.from(header.querySelectorAll('svg')).map(svg => ({
      viewBox: svg.getAttribute('viewBox'),
      path: svg.querySelector('path')?.getAttribute('d') || '',
      width: svg.getAttribute('width') || svg.clientWidth,
      height: svg.getAttribute('height') || svg.clientHeight,
    })) : [];

    // 3. User Avatar / Profile
    const profileBtn = document.querySelector('[data-testid="user-widget-link"]') ||
                       document.querySelector('[data-testid="profile-button"]') ||
                       document.querySelector('button[aria-haspopup="menu"]');

    // 4. Quick access cards in main content
    const quickAccess = Array.from(document.querySelectorAll('[data-testid="card-click-handler"], [role="button"]'))
      .filter(el => el.clientHeight > 40 && el.clientHeight < 70)
      .slice(0, 10)
      .map(el => {
        const style = window.getComputedStyle(el);
        return {
          text: el.innerText.trim(),
          height: style.height,
          backgroundColor: style.backgroundColor,
          borderRadius: style.borderRadius,
        };
      });

    // 5. Bottom player bar
    const nowPlaying = document.querySelector('[data-testid="now-playing-bar"]') || document.querySelector('footer');
    const playerStyle = nowPlaying ? window.getComputedStyle(nowPlaying) : null;

    return {
      topBar: {
        height: headerStyle?.height,
        backgroundColor: headerStyle?.backgroundColor,
        padding: headerStyle?.padding,
        svgCount: topBarSvgs.length,
        svgs: topBarSvgs.slice(0, 8),
      },
      quickAccess,
      bottomPlayer: {
        height: playerStyle?.height,
        backgroundColor: playerStyle?.backgroundColor,
      },
    };
  });

  const outPath = path.resolve(__dirname, '../live-spotify-tokens.json');
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2));
  console.log('Saved tokens to:', outPath);
  console.log('Preview:', JSON.stringify({
    topBarHeight: data.topBar.height,
    playerHeight: data.bottomPlayer.height,
    quickAccessSample: data.quickAccess[0],
    svgCount: data.topBar.svgCount,
  }, null, 2));

  browser.disconnect();
}

extract().catch(console.error);
