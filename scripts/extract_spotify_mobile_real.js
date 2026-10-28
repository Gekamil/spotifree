import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

async function main() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 393, height: 852, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1');

  await page.goto('https://open.spotify.com/', { waitUntil: 'networkidle2', timeout: 35000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 3000));

  try {
    await page.evaluate(() => {
      document.querySelectorAll('#onetrust-banner-sdk, #onetrust-consent-sdk, [data-testid=\"cookie-banner\"]').forEach(el => el.remove());
    });
  } catch {}

  const extracted = await page.evaluate(() => {
    // 1. Bottom navigation
    const nav = document.querySelector('nav') || document.querySelector('[role=\"navigation\"]') || document.querySelector('footer');
    let navInfo = null;
    if (nav) {
      const navStyle = window.getComputedStyle(nav);
      const buttons = Array.from(nav.querySelectorAll('a, button')).map(btn => {
        const svg = btn.querySelector('svg');
        const text = btn.innerText.trim();
        return {
          text,
          svgHtml: svg ? svg.outerHTML : null,
          svgViewBox: svg ? svg.getAttribute('viewBox') : null,
          svgPaths: svg ? Array.from(svg.querySelectorAll('path')).map(p => p.getAttribute('d')) : [],
        };
      });
      navInfo = {
        outerHTML: nav.outerHTML.slice(0, 500),
        className: nav.className,
        bg: navStyle.backgroundColor,
        bgImage: navStyle.backgroundImage,
        backdropFilter: navStyle.backdropFilter || navStyle.webkitBackdropFilter,
        height: navStyle.height,
        borderTop: navStyle.borderTop,
        buttons,
      };
    }

    // 2. Home Header & Filters
    const header = document.querySelector('header');
    let headerInfo = null;
    if (header) {
      const hStyle = window.getComputedStyle(header);
      headerInfo = {
        className: header.className,
        bg: hStyle.backgroundColor,
        backdropFilter: hStyle.backdropFilter || hStyle.webkitBackdropFilter,
        height: hStyle.height,
        buttons: Array.from(header.querySelectorAll('button, a')).map(b => b.innerText.trim() || b.getAttribute('aria-label') || 'icon'),
      };
    }

    // 3. Quick access shortcuts (2-column grid)
    const shortcutsContainer = document.querySelector('[data-testid=\"grid-container\"], [data-testid=\"shortcut-item\"], [role=\"grid\"]')?.parentElement;
    let shortcutsInfo = null;
    const shortcutItems = Array.from(document.querySelectorAll('a[href*=\"/playlist/\"], a[href*=\"/album/\"]')).slice(0, 8).map(el => {
      const text = el.innerText.trim();
      const style = window.getComputedStyle(el);
      return {
        text,
        bg: style.backgroundColor,
        height: style.height,
        borderRadius: style.borderRadius,
      };
    });

    // 4. Shelves / Carousels
    const sectionHeaders = Array.from(document.querySelectorAll('h2, h3')).map(h => ({
      text: h.innerText.trim(),
      fontSize: window.getComputedStyle(h).fontSize,
      fontWeight: window.getComputedStyle(h).fontWeight,
    }));

    return {
      navInfo,
      headerInfo,
      shortcutItems,
      sectionHeaders,
    };
  });

  console.log('Extracted Spotify Mobile Info:');
  console.log(JSON.stringify(extracted, null, 2));

  fs.writeFileSync('public/spotify_mobile_extracted.json', JSON.stringify(extracted, null, 2));
  await browser.close();
}

main().catch(console.error);
