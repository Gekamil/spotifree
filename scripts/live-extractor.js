import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  console.log('Connecting to user live Chrome session on port 9222...');
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const page = pages.find((p) => p.url().includes('spotify.com')) || pages[0];

  await page.bringToFront();

  // Helper to update banner on user's screen
  const setBanner = async (text, color = '#1ed760') => {
    await page.evaluate((t, c) => {
      let el = document.getElementById('antigravity-indicator');
      if (!el) {
        el = document.createElement('div');
        el.id = 'antigravity-indicator';
        el.style.position = 'fixed';
        el.style.bottom = '16px';
        el.style.right = '16px';
        el.style.borderRadius = '500px';
        el.style.fontWeight = 'bold';
        el.style.fontSize = '14px';
        el.style.zIndex = '2147483647';
        el.style.boxShadow = '0 8px 24px rgba(0,0,0,0.6)';
        el.style.transition = 'all 0.3s ease';
        document.body.appendChild(el);
      }
      el.style.backgroundColor = c;
      el.style.color = '#000000';
      el.style.padding = '10px 20px';
      el.innerText = t;
    }, text, color);
  };

  // Step 1: Banner update
  await setBanner('⚡ [Paso 1/4] Extrayendo todos los iconos SVG nativos...');
  await new Promise((r) => setTimeout(r, 1500));

  // Extract all SVGs from the live page
  const svgs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('svg')).map((svg) => {
      const parentBtn = svg.closest('button') || svg.closest('a') || svg.parentElement;
      return {
        viewBox: svg.getAttribute('viewBox'),
        width: svg.getAttribute('width') || svg.clientWidth,
        height: svg.getAttribute('height') || svg.clientHeight,
        path: svg.querySelector('path')?.getAttribute('d') || '',
        allPaths: Array.from(svg.querySelectorAll('path')).map(p => p.getAttribute('d')),
        fill: svg.getAttribute('fill') || window.getComputedStyle(svg).fill,
        ariaLabel: svg.getAttribute('aria-label') || parentBtn?.getAttribute('aria-label') || parentBtn?.getAttribute('title') || '',
        parentClasses: parentBtn?.className || '',
        parentRole: parentBtn?.getAttribute('role') || parentBtn?.tagName,
      };
    });
  });

  fs.writeFileSync(
    path.resolve(__dirname, '../extracted-svgs.json'),
    JSON.stringify(svgs, null, 2)
  );
  console.log(`Extracted ${svgs.length} SVGs.`);

  // Step 2: Banner update
  await setBanner('⚡ [Paso 2/4] Extrayendo medidas y estilos computados...');
  await new Promise((r) => setTimeout(r, 1500));

  // Extract precise measurements from player, cards, library, header
  const layout = await page.evaluate(() => {
    const getStyles = (el) => {
      if (!el) return null;
      const s = window.getComputedStyle(el);
      return {
        width: s.width,
        height: s.height,
        padding: s.padding,
        margin: s.margin,
        gap: s.gap,
        borderRadius: s.borderRadius,
        backgroundColor: s.backgroundColor,
        fontSize: s.fontSize,
        fontWeight: s.fontWeight,
        color: s.color,
        fontFamily: s.fontFamily,
      };
    };

    const header = document.querySelector('header');
    const player = document.querySelector('footer') || document.querySelector('[data-testid="now-playing-bar"]');
    const playBtn = player ? player.querySelector('button[data-testid="control-button-playpause"]') : null;
    const addBtn = player ? player.querySelector('button[data-testid="add-button"]') || player.querySelector('button[aria-label*="Guardar"], button[aria-label*="Añadir"]') : null;
    const library = document.querySelector('nav') || document.querySelector('[data-testid="your-library"]');
    const cards = Array.from(document.querySelectorAll('[data-testid="card-click-handler"], [role="button"]')).slice(0, 10);

    return {
      header: getStyles(header),
      player: getStyles(player),
      playBtn: getStyles(playBtn),
      addBtn: getStyles(addBtn),
      library: getStyles(library),
      firstCard: cards[0] ? getStyles(cards[0]) : null,
    };
  });

  fs.writeFileSync(
    path.resolve(__dirname, '../extracted-layout.json'),
    JSON.stringify(layout, null, 2)
  );

  // Step 3: Real live interaction (Hover, Click, Scroll)
  await setBanner('⚡ [Paso 3/4] Probando interacciones y hover en vivo...');
  await new Promise((r) => setTimeout(r, 1000));

  // Hover over the first quick access card
  try {
    const quickCard = await page.$('[data-testid="card-click-handler"], a[href^="/playlist/"], a[href^="/collection/tracks"]');
    if (quickCard) {
      console.log('Hovering over card...');
      await quickCard.hover();
      await new Promise((r) => setTimeout(r, 1200));
    }
  } catch (err) {
    console.error('Hover card error:', err);
  }

  // Smooth scroll down to show live action to user
  await page.evaluate(() => {
    window.scrollBy({ top: 350, behavior: 'smooth' });
  });
  await new Promise((r) => setTimeout(r, 1500));

  await page.evaluate(() => {
    window.scrollBy({ top: -350, behavior: 'smooth' });
  });
  await new Promise((r) => setTimeout(r, 1000));

  // Step 4: Final banner update
  await setBanner('⚡ [Paso 4/4] Extracción completada. Actualizando Spotifree...', '#1ed760');
  await new Promise((r) => setTimeout(r, 2000));

  browser.disconnect();
  console.log('Extraction script finished.');
}

run().catch(console.error);
