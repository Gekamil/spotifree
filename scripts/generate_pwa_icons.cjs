const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function generate() {
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const sizes = [
    { name: 'apple-touch-icon.png', size: 180 },
    { name: 'icon-192.png', size: 192 },
    { name: 'icon-512.png', size: 512 },
  ];

  for (const { name, size } of sizes) {
    const page = await browser.newPage();
    await page.setViewport({ width: size, height: size });
    
    // SVG with black background and bright Spotify green logo
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            width: ${size}px;
            height: ${size}px;
            background: #121212;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          svg {
            width: ${Math.round(size * 0.82)}px;
            height: ${Math.round(size * 0.82)}px;
          }
        </style>
      </head>
      <body>
        <svg viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="12" fill="#1ED760"/>
          <path d="M17.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" fill="#121212"/>
        </svg>
      </body>
      </html>
    `;

    await page.setContent(html);
    const outPath = path.join(__dirname, '..', 'public', name);
    await page.screenshot({ path: outPath, type: 'png' });
    console.log(`Generated ${name} (${size}x${size})`);
    await page.close();
  }

  await browser.close();
}

generate().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
