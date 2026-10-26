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
    const grid = document.querySelector('div[aria-label="Tu biblioteca"][role="grid"]');
    if (!grid) return { error: 'grid not found' };

    const rows = Array.from(grid.querySelectorAll('div[role="row"]')).map(row => {
      const r = row.getBoundingClientRect();
      const s = window.getComputedStyle(row);
      const img = row.querySelector('img');
      const svgs = Array.from(row.querySelectorAll('svg')).map(svg => ({
        viewBox: svg.getAttribute('viewBox'),
        paths: Array.from(svg.querySelectorAll('path')).map(p => p.getAttribute('d'))
      }));
      const title = row.querySelector('p, span')?.textContent.trim() || '';
      const subtitle = row.querySelectorAll('p, span')[1]?.textContent.trim() || '';

      return {
        title,
        subtitle,
        rect: { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) },
        css: {
          height: s.height,
          padding: s.padding,
          borderRadius: s.borderRadius,
          backgroundColor: s.backgroundColor,
          color: s.color,
          fontSize: s.fontSize,
          fontWeight: s.fontWeight
        },
        imgRect: img ? {
          width: img.clientWidth,
          height: img.clientHeight,
          borderRadius: window.getComputedStyle(img).borderRadius
        } : null,
        svgs
      };
    });

    // Also get the search and sort buttons above the grid
    const libraryHeaderControls = Array.from(document.querySelectorAll('.YourLibraryX button, [aria-label="Tu biblioteca"] ~ * button, [aria-label*="Buscar en Tu biblioteca"], [aria-label*="ordenar" i]')).map(b => {
      const s = window.getComputedStyle(b);
      const svg = b.querySelector('svg');
      return {
        ariaLabel: b.getAttribute('aria-label') || b.textContent.trim(),
        width: s.width,
        height: s.height,
        padding: s.padding,
        borderRadius: s.borderRadius,
        svg: svg ? {
          viewBox: svg.getAttribute('viewBox'),
          paths: Array.from(svg.querySelectorAll('path')).map(p => p.getAttribute('d'))
        } : null
      };
    });

    return {
      rows: rows.slice(0, 10),
      controls: libraryHeaderControls
    };
  });

  fs.writeFileSync(
    path.resolve(__dirname, '../inspected-library-rows.json'),
    JSON.stringify(data, null, 2)
  );

  console.log(`Saved inspected-library-rows.json. Rows: ${data.rows?.length || 0}, Controls: ${data.controls?.length || 0}`);
  browser.disconnect();
}

run().catch(console.error);
