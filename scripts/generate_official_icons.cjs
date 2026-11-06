const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function generate() {
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // 1. Standalone circular Spotify green logo (for any / favicon / general)
  // Transparent outside the circle, pure #1ED760 circle, #000000 waves
  const circularSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
    <circle cx="256" cy="256" r="256" fill="#1ED760"/>
    <path d="M373.78 370.02c-5.12 7.66-14.1 10.24-21.78 5.12-60.16-37.12-135.68-44.82-225.3-24.34-8.92 2.6-16.62-3.82-19.18-11.5-2.56-8.98 3.84-16.64 11.52-19.2 97.28-21.78 181.76-12.8 248.32 28.16 8.96 3.84 10.22 14.06 6.42 21.76zm30.72-70.4c-6.4 8.96-17.92 12.8-26.88 6.4-69.12-42.24-174.08-55.04-254.72-29.44-10.24 2.56-21.76-2.56-24.32-12.8-2.56-10.24 2.56-21.78 12.8-24.34 92.16-28.16 207.36-14.08 286.72 34.56 7.7 3.86 11.52 16.64 6.4 25.62zm2.56-71.68c-82.56-49.28-219.52-53.76-298.24-29.44-12.8 3.82-25.6-3.86-29.44-15.38-3.84-12.8 3.84-25.6 15.36-29.44 90.88-26.88 240.64-21.76 335.36 34.56 11.52 6.4 15.36 21.76 8.96 33.28-6.4 8.98-21.76 12.8-32 6.42z" fill="#000000"/>
  </svg>
  `;

  // 2. Full-bleed Maskable / Adaptive icon (safe zone centered, solid #1ED760 full bleed)
  // Suitable for Android adaptive icon launchers (circle, squircle, pebble)
  const maskableSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
    <rect width="512" height="512" fill="#1ED760"/>
    <g transform="translate(64, 64) scale(0.75)">
      <path d="M373.78 370.02c-5.12 7.66-14.1 10.24-21.78 5.12-60.16-37.12-135.68-44.82-225.3-24.34-8.92 2.6-16.62-3.82-19.18-11.5-2.56-8.98 3.84-16.64 11.52-19.2 97.28-21.78 181.76-12.8 248.32 28.16 8.96 3.84 10.22 14.06 6.42 21.76zm30.72-70.4c-6.4 8.96-17.92 12.8-26.88 6.4-69.12-42.24-174.08-55.04-254.72-29.44-10.24 2.56-21.76-2.56-24.32-12.8-2.56-10.24 2.56-21.78 12.8-24.34 92.16-28.16 207.36-14.08 286.72 34.56 7.7 3.86 11.52 16.64 6.4 25.62zm2.56-71.68c-82.56-49.28-219.52-53.76-298.24-29.44-12.8 3.82-25.6-3.86-29.44-15.38-3.84-12.8 3.84-25.6 15.36-29.44 90.88-26.88 240.64-21.76 335.36 34.56 11.52 6.4 15.36 21.76 8.96 33.28-6.4 8.98-21.76 12.8-32 6.42z" fill="#000000"/>
    </g>
  </svg>
  `;

  // 3. Apple Touch Icon (180x180):
  // Full-bleed #1ED760 green with waves comfortably centered with ~16% margin,
  // so when iOS clips the 180x180 square into an iOS squircle, it looks identical to an iOS App Store app!
  const appleSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="100%" height="100%">
    <rect width="180" height="180" fill="#1ED760"/>
    <g transform="translate(18, 18) scale(0.28125)">
      <path d="M373.78 370.02c-5.12 7.66-14.1 10.24-21.78 5.12-60.16-37.12-135.68-44.82-225.3-24.34-8.92 2.6-16.62-3.82-19.18-11.5-2.56-8.98 3.84-16.64 11.52-19.2 97.28-21.78 181.76-12.8 248.32 28.16 8.96 3.84 10.22 14.06 6.42 21.76zm30.72-70.4c-6.4 8.96-17.92 12.8-26.88 6.4-69.12-42.24-174.08-55.04-254.72-29.44-10.24 2.56-21.76-2.56-24.32-12.8-2.56-10.24 2.56-21.78 12.8-24.34 92.16-28.16 207.36-14.08 286.72 34.56 7.7 3.86 11.52 16.64 6.4 25.62zm2.56-71.68c-82.56-49.28-219.52-53.76-298.24-29.44-12.8 3.82-25.6-3.86-29.44-15.38-3.84-12.8 3.84-25.6 15.36-29.44 90.88-26.88 240.64-21.76 335.36 34.56 11.52 6.4 15.36 21.76 8.96 33.28-6.4 8.98-21.76 12.8-32 6.42z" fill="#000000"/>
    </g>
  </svg>
  `;

  async function renderToPng(svg, width, height, destPath, transparent = false) {
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    const html = `<!DOCTYPE html><html><head><style>body { margin: 0; padding: 0; overflow: hidden; background: ${transparent ? 'transparent' : 'none'}; display: flex; align-items: center; justify-content: center; width: ${width}px; height: ${height}px; }</style></head><body>${svg}</body></html>`;
    await page.setContent(html, { waitUntil: 'load', timeout: 5000 });
    await page.screenshot({ path: destPath, omitBackground: transparent });
    console.log(`Rendered ${destPath} (${width}x${height})`);
  }

  // Render icons:
  await renderToPng(circularSvg, 192, 192, path.join(__dirname, '../public/icon-192.png'), true);
  await renderToPng(circularSvg, 512, 512, path.join(__dirname, '../public/icon-512.png'), true);
  await renderToPng(maskableSvg, 192, 192, path.join(__dirname, '../public/icon-mobile-192.png'), false);
  await renderToPng(maskableSvg, 512, 512, path.join(__dirname, '../public/icon-mobile-512.png'), false);
  await renderToPng(circularSvg, 192, 192, path.join(__dirname, '../public/icon-mobile.png'), true);
  await renderToPng(appleSvg, 180, 180, path.join(__dirname, '../public/apple-touch-icon.png'), false);

  // Write SVGs
  fs.writeFileSync(path.join(__dirname, '../public/icon-mobile.svg'), circularSvg.trim());
  fs.writeFileSync(path.join(__dirname, '../public/favicon.svg'), circularSvg.trim());

  await browser.close();
  console.log('All icons generated successfully!');
}

generate().catch(err => {
  console.error(err);
  process.exit(1);
});
