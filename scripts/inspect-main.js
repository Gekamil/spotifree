import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const page = (await browser.pages()).find(p => p.url().includes('spotify.com'));

  const data = await page.evaluate(() => {
    const toRect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
    };

    const getCSS = (el) => {
      if (!el) return null;
      const s = window.getComputedStyle(el);
      return {
        display: s.display,
        width: s.width,
        height: s.height,
        padding: s.padding,
        margin: s.margin,
        gap: s.gap,
        borderRadius: s.borderRadius,
        backgroundColor: s.backgroundColor,
        color: s.color,
        fontSize: s.fontSize,
        fontWeight: s.fontWeight,
        fontFamily: s.fontFamily,
        boxShadow: s.boxShadow,
        border: s.border
      };
    };

    const main = document.querySelector('#main');
    
    // Top bar: find the parent container holding homeBtn and searchInput
    const homeBtn = document.querySelector('button[aria-label="Inicio"]');
    // Traverse upwards from homeBtn until we find the full-width header
    let topBar = homeBtn;
    while (topBar && topBar.parentElement && topBar.parentElement.id !== 'main') {
      if (topBar.parentElement.clientWidth > window.innerWidth * 0.8) {
        topBar = topBar.parentElement;
        break;
      }
      topBar = topBar.parentElement;
    }

    // Now playing bar: find the container holding play button or track title
    const playBtn = document.querySelector('button[data-testid="control-button-playpause"]') ||
                    document.querySelector('button[aria-label="Reproducir"]') ||
                    document.querySelector('button[aria-label="Pausar"]');
    let nowPlayingBar = playBtn;
    while (nowPlayingBar && nowPlayingBar.parentElement && nowPlayingBar.parentElement.id !== 'main') {
      if (nowPlayingBar.parentElement.clientWidth > window.innerWidth * 0.8) {
        nowPlayingBar = nowPlayingBar.parentElement;
        break;
      }
      nowPlayingBar = nowPlayingBar.parentElement;
    }

    // Find all buttons in topBar
    const topBarButtons = topBar ? Array.from(topBar.querySelectorAll('button, a, input')).map(el => {
      const svg = el.querySelector('svg');
      return {
        tag: el.tagName,
        ariaLabel: el.getAttribute('aria-label') || el.title || el.placeholder || el.innerText.trim(),
        text: el.innerText.trim().replace(/\n+/g, ' '),
        placeholder: el.placeholder || '',
        rect: toRect(el),
        css: getCSS(el),
        svg: svg ? {
          viewBox: svg.getAttribute('viewBox'),
          width: svg.getAttribute('width') || svg.clientWidth,
          height: svg.getAttribute('height') || svg.clientHeight,
          fill: svg.getAttribute('fill') || window.getComputedStyle(svg).fill,
          paths: Array.from(svg.querySelectorAll('path')).map(p => p.getAttribute('d'))
        } : null
      };
    }) : [];

    // Find all controls in nowPlayingBar
    const nowPlayingControls = nowPlayingBar ? Array.from(nowPlayingBar.querySelectorAll('button, a, input, [role="slider"]')).map(el => {
      const svg = el.querySelector('svg');
      return {
        tag: el.tagName,
        ariaLabel: el.getAttribute('aria-label') || el.title || el.innerText.trim(),
        testId: el.getAttribute('data-testid') || '',
        rect: toRect(el),
        css: getCSS(el),
        svg: svg ? {
          viewBox: svg.getAttribute('viewBox'),
          width: svg.getAttribute('width') || svg.clientWidth,
          height: svg.getAttribute('height') || svg.clientHeight,
          fill: svg.getAttribute('fill') || window.getComputedStyle(svg).fill,
          paths: Array.from(svg.querySelectorAll('path')).map(p => p.getAttribute('d'))
        } : null
      };
    }) : [];

    // Left Library
    const libraryNav = document.querySelector('nav') || document.querySelector('[aria-label="Tu biblioteca"]');
    const libraryRect = toRect(libraryNav);
    const libraryCSS = getCSS(libraryNav);

    return {
      windowSize: { width: window.innerWidth, height: window.innerHeight },
      topBar: {
        rect: toRect(topBar),
        css: getCSS(topBar),
        buttons: topBarButtons
      },
      nowPlayingBar: {
        rect: toRect(nowPlayingBar),
        css: getCSS(nowPlayingBar),
        controls: nowPlayingControls
      },
      library: {
        rect: libraryRect,
        css: libraryCSS
      }
    };
  });

  fs.writeFileSync(
    path.resolve(__dirname, '../inspected-main-ui.json'),
    JSON.stringify(data, null, 2)
  );

  console.log('Saved inspected-main-ui.json successfully.');
  console.log(`Top Bar: ${data.topBar.rect ? JSON.stringify(data.topBar.rect) : 'not found'}, Buttons count: ${data.topBar.buttons.length}`);
  console.log(`Now Playing Bar: ${data.nowPlayingBar.rect ? JSON.stringify(data.nowPlayingBar.rect) : 'not found'}, Controls count: ${data.nowPlayingBar.controls.length}`);
  console.log(`Library: ${data.library.rect ? JSON.stringify(data.library.rect) : 'not found'}`);

  browser.disconnect();
}

run().catch(console.error);
