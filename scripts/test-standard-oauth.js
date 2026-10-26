import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const page = await browser.newPage();

  const CLIENT_ID = 'ea3003771e264c4690a2ac289afd22a4';
  const CLIENT_SECRET = '3976fc2dadf04e9c857ff2afdcc07d2b';
  const REDIRECT_URI = 'http://127.0.0.1:5173/callback';
  const SCOPES = 'user-read-private user-read-email playlist-read-private playlist-read-collaborative user-library-read user-top-read';

  let code = null;
  // Listen for navigation to callback
  page.on('framenavigated', f => {
    const u = f.url();
    if (u.includes('127.0.0.1:5173/callback') && u.includes('code=')) {
      code = new URL(u).searchParams.get('code');
      console.log('Got code in listener!');
    }
  });

  // Temporarily disable replaceState on the target so code doesn't get consumed
  await page.evaluateOnNewDocument(() => {
    window.addEventListener('load', () => {
      // prevent replaceState immediately
    });
  });

  const authUrl = `https://accounts.spotify.com/authorize?response_type=code&client_id=${CLIENT_ID}&scope=${encodeURIComponent(SCOPES)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;

  await page.goto(authUrl, { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 1000));

  console.log('Code captured:', code ? code.substring(0, 20) + '...' : null);
  await page.close();

  if (code) {
    // Exchange with Client Secret (Standard Confidential Client OAuth)
    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI
      }).toString()
    });

    const data = await tokenRes.json();
    console.log('Status:', tokenRes.status);
    console.log('Token response:', data);

    if (data.access_token) {
      console.log('Testing /me with user token:');
      const me = await fetch('https://api.spotify.com/v1/me', {
        headers: { Authorization: `Bearer ${data.access_token}` }
      }).then(r => r.json());
      console.log('Logged in user:', me.display_name, me.id, me.email);
    }
  }

  browser.disconnect();
}

main().catch(console.error);
