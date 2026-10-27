import puppeteer from 'puppeteer-core';
import path from 'path';

const artifactDir = 'C:\\Users\\jorge\\.gemini\\antigravity\\brain\\b7d3ec29-c076-4935-90b5-23f42c286313';

async function capture() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 393, height: 852, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1');

  // 1. Mobile Home
  console.log('Navigating to Home...');
  await page.goto('https://open.spotify.com/', { waitUntil: 'networkidle2', timeout: 25000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));
  try {
    await page.evaluate(() => {
      const banner = document.getElementById('onetrust-banner-sdk');
      if (banner) banner.remove();
    });
  } catch {}
  await new Promise(r => setTimeout(r, 1000));
  const homePath = path.join(artifactDir, 'spotify_mobile_home.png');
  await page.screenshot({ path: homePath });
  console.log('Captured Home to:', homePath);

  // 2. Mobile Search / Explore
  console.log('Navigating to Search...');
  await page.goto('https://open.spotify.com/search', { waitUntil: 'networkidle2', timeout: 25000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));
  try {
    await page.evaluate(() => {
      const banner = document.getElementById('onetrust-banner-sdk');
      if (banner) banner.remove();
    });
  } catch {}
  const searchPath = path.join(artifactDir, 'spotify_mobile_search.png');
  await page.screenshot({ path: searchPath });
  console.log('Captured Search to:', searchPath);

  // 3. Mobile Album (TA FACIL)
  console.log('Navigating to TA FACIL album...');
  await page.goto('https://open.spotify.com/album/3NfLFMJll0BlczcIVzDu2m', { waitUntil: 'networkidle2', timeout: 25000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));
  try {
    await page.evaluate(() => {
      const banner = document.getElementById('onetrust-banner-sdk');
      if (banner) banner.remove();
    });
  } catch {}
  const albumPath = path.join(artifactDir, 'spotify_mobile_album.png');
  await page.screenshot({ path: albumPath });
  console.log('Captured Album to:', albumPath);

  await browser.close();
  console.log('All mobile screenshots captured successfully!');
}

capture().catch(console.error);
