const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const spotifySvgPathOnly = `
  <circle cx="12" cy="12" r="12" fill="#1ED760"/>
  <path d="M17.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" fill="#000000"/>
`;

async function generate() {
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  // 1. Mobile icons: with sleek black background margin (~60% scale)
  const mobileConfigs = [
    { name: 'icon-mobile.png', size: 512, scale: 0.60 },
    { name: 'icon-mobile-512.png', size: 512, scale: 0.60 },
    { name: 'icon-mobile-192.png', size: 192, scale: 0.60 },
    { name: 'icon-512.png', size: 512, scale: 0.60 },
    { name: 'icon-192.png', size: 192, scale: 0.60 },
    { name: 'apple-touch-icon.png', size: 180, scale: 0.60 },
  ];

  for (const { name, size, scale } of mobileConfigs) {
    const page = await browser.newPage();
    await page.setViewport({ width: size, height: size });
    const logoPx = Math.round(size * scale);
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            width: ${size}px;
            height: ${size}px;
            background: #000000;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          svg {
            width: ${logoPx}px;
            height: ${logoPx}px;
          }
        </style>
      </head>
      <body>
        <svg viewBox="0 0 24 24" fill="none">
          ${spotifySvgPathOnly}
        </svg>
      </body>
      </html>
    `;
    await page.setContent(html);
    const outPath = path.join(__dirname, '..', 'public', name);
    await page.screenshot({ path: outPath, type: 'png', omitBackground: false });
    console.log(`[Mobile] Generated ${name} (${size}x${size}, scale ${scale * 100}%)`);
    await page.close();
  }

  // 2. Desktop icons: ONLY THE LOGO (100% scale, transparent background, zero black margins)
  const desktopConfigs = [
    { name: 'icon-desktop.png', size: 512 },
    { name: 'icon-desktop-512.png', size: 512 },
    { name: 'icon-desktop-192.png', size: 192 },
  ];

  for (const { name, size } of desktopConfigs) {
    const page = await browser.newPage();
    await page.setViewport({ width: size, height: size });
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            width: ${size}px;
            height: ${size}px;
            background: transparent;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          svg {
            width: ${size}px;
            height: ${size}px;
          }
        </style>
      </head>
      <body>
        <svg viewBox="0 0 24 24" fill="none">
          ${spotifySvgPathOnly}
        </svg>
      </body>
      </html>
    `;
    await page.setContent(html);
    const outPath = path.join(__dirname, '..', 'public', name);
    await page.screenshot({ path: outPath, type: 'png', omitBackground: true });
    console.log(`[Desktop] Generated ${name} (${size}x${size}, 100% transparent background)`);
    await page.close();
  }

  await browser.close();

  // 3. Write pure vector SVGs for both desktop and mobile
  const desktopSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
  ${spotifySvgPathOnly}
</svg>`;

  const mobileSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
  <rect width="100" height="100" rx="20" fill="#000000"/>
  <g transform="translate(20, 20) scale(2.5)">
    <circle cx="12" cy="12" r="12" fill="#1ED760"/>
    <path d="M17.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" fill="#000000"/>
  </g>
</svg>`;

  fs.writeFileSync(path.join(__dirname, '..', 'public', 'favicon.svg'), desktopSvg);
  fs.writeFileSync(path.join(__dirname, '..', 'public', 'icon-desktop.svg'), desktopSvg);
  fs.writeFileSync(path.join(__dirname, '..', 'public', 'icon-mobile.svg'), mobileSvg);
  console.log('[SVGs] Generated favicon.svg, icon-desktop.svg, and icon-mobile.svg');
}

generate().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
