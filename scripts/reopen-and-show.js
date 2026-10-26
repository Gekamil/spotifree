import puppeteer from 'puppeteer-core';

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  console.log('Connecting to Chrome on port 9222...');
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  let spotifreePage = pages.find((p) => p.url().includes('5173'));

  if (!spotifreePage) {
    spotifreePage = await browser.newPage();
  }

  await spotifreePage.bringToFront();
  await spotifreePage.setViewport({ width: 1440, height: 900 });
  await spotifreePage.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded' });
  await sleep(1000);

  console.log('Spotifree is now loaded and brought to front at:', spotifreePage.url());

  // Show a welcome indicator
  await spotifreePage.evaluate(() => {
    let b = document.getElementById('antigravity-indicator');
    if (!b) {
      b = document.createElement('div');
      b.id = 'antigravity-indicator';
      b.style.position = 'fixed';
      b.style.bottom = '24px';
      b.style.right = '24px';
      b.style.padding = '10px 20px';
      b.style.borderRadius = '30px';
      b.style.fontWeight = '700';
      b.style.fontSize = '13px';
      b.style.fontFamily = 'SpotifyMixUI, system-ui, sans-serif';
      b.style.zIndex = '99999999';
      b.style.boxShadow = '0 8px 24px rgba(0,0,0,0.8)';
      b.style.border = '2px solid #1ed760';
      b.style.backgroundColor = '#121212';
      b.style.color = '#ffffff';
      b.style.display = 'flex';
      b.style.alignItems = 'center';
      b.style.gap = '8px';
      b.innerHTML = '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background-color:#1ed760;box-shadow:0 0 8px #1ed760;"></span> <span>🟢 Spotifree Activo & Conectado a Spotify</span>';
      document.body.appendChild(b);

      setTimeout(() => {
        b.style.opacity = '0';
        b.style.transition = 'opacity 1s ease';
        setTimeout(() => b.remove(), 1000);
      }, 5000);
    }
  });

  browser.disconnect();
}

run().catch(console.error);
