import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const page = await browser.newPage();

  const CLIENT_ID = 'ea3003771e264c4690a2ac289afd22a4';
  const REDIRECT_URI = 'http://127.0.0.1:5173/callback';
  const SCOPES = 'user-read-private user-read-email';
  const authUrl = `https://accounts.spotify.com/authorize?response_type=code&client_id=${CLIENT_ID}&scope=${encodeURIComponent(SCOPES)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;

  page.on('framenavigated', f => {
    console.log('Frame navigated to:', f.url());
  });

  await page.goto(authUrl, { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 2000));
  await page.close();
  browser.disconnect();
}

main().catch(console.error);
