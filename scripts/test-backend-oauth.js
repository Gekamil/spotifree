import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const page = await browser.newPage();

  const CLIENT_ID = 'ea3003771e264c4690a2ac289afd22a4';
  const CLIENT_SECRET = '3976fc2dadf04e9c857ff2afdcc07d2b';
  // Use a special dummy callback path that Vite won't handle with React
  const REDIRECT_URI = 'http://127.0.0.1:5173/oauth-receiver';
  const SCOPES = 'user-read-private user-read-email playlist-read-private user-library-read user-top-read';

  let code = null;
  page.on('framenavigated', f => {
    const u = f.url();
    if (u.includes('oauth-receiver') && u.includes('code=')) {
      code = new URL(u).searchParams.get('code');
      console.log('Intercepted code from oauth-receiver!');
    }
  });

  const authUrl = `https://accounts.spotify.com/authorize?response_type=code&client_id=${CLIENT_ID}&scope=${encodeURIComponent(SCOPES)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;

  await page.goto(authUrl, { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 2000));
  await page.close();

  console.log('Intercepted Code:', code ? code.substring(0, 25) + '...' : null);

  if (code) {
    console.log('Performing server-side exchange with client credentials...');
    const res = await fetch('https://accounts.spotify.com/api/token', {
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

    const data = await res.json();
    console.log('Server-side token exchange status:', res.status);
    console.log('Token response:', data);

    if (data.access_token) {
      console.log('\n=== REAL USER SPOTIFY API ACCESS VERIFIED ===');
      const me = await fetch('https://api.spotify.com/v1/me', {
        headers: { Authorization: `Bearer ${data.access_token}` }
      }).then(r => r.json());
      console.log('Logged in User Profile:');
      console.log(' Name:', me.display_name);
      console.log(' ID:', me.id);
      console.log(' Email:', me.email);
      console.log(' Product:', me.product);

      const playlists = await fetch('https://api.spotify.com/v1/me/playlists?limit=5', {
        headers: { Authorization: `Bearer ${data.access_token}` }
      }).then(r => r.json());
      console.log('Dynamic Playlists from API:');
      for (const p of playlists.items || []) {
        console.log(` - ${p.name} (Tracks: ${p.tracks.total}, ID: ${p.id})`);
      }
    }
  }

  browser.disconnect();
}

main().catch(console.error);
