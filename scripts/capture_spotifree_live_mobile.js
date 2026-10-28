import puppeteer from 'puppeteer-core';
import path from 'node:path';

const artifactDir = 'C:\\Users\\jorge\\.gemini\\antigravity\\brain\\b7d3ec29-c076-4935-90b5-23f42c286313';

async function main() {
  console.log('Waiting 10s for Vercel deployment...');
  await new Promise(r => setTimeout(r, 10000));

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  // iPhone 14/15 viewport (393x852)
  await page.setViewport({ width: 393, height: 852, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1');

  // 1. Home
  console.log('Capturing Spotifree Mobile Home...');
  await page.goto('https://spotifreeweb.vercel.app/', { waitUntil: 'networkidle2', timeout: 35000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(artifactDir, 'spotifree_mobile_home.png') });

  // 2. Search
  console.log('Capturing Spotifree Mobile Search...');
  const searchBtn = await page.$('nav button:nth-child(2)');
  if (searchBtn) {
    await searchBtn.click();
    await new Promise(r => setTimeout(r, 1500));
  }
  await page.screenshot({ path: path.join(artifactDir, 'spotifree_mobile_search.png') });

  // 3. Playlist detail
  console.log('Capturing Spotifree Mobile Playlist Detail...');
  const firstCard = await page.$('.grid > div');
  if (firstCard) {
    await firstCard.click();
    await new Promise(r => setTimeout(r, 2000));
  }
  await page.screenshot({ path: path.join(artifactDir, 'spotifree_mobile_playlist.png') });

  // 4. Login Modal
  console.log('Capturing Spotifree Mobile Login Modal...');
  const libraryBtn = await page.$('nav button:nth-child(3)');
  if (libraryBtn) {
    await libraryBtn.click();
    await new Promise(r => setTimeout(r, 1000));
    const addAccountBtn = await page.$('button');
    if (addAccountBtn) await addAccountBtn.click();
    await new Promise(r => setTimeout(r, 1000));
  }
  await page.screenshot({ path: path.join(artifactDir, 'spotifree_mobile_login.png') });

  await browser.close();
  console.log('All Spotifree mobile screenshots captured successfully in artifact dir!');
}

main().catch(console.error);
