import puppeteer from 'puppeteer-core';
import crypto from 'crypto';

function generateRandomString(length) {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes).map(b => possible[b % possible.length]).join('');
}

function sha256(plain) {
  return crypto.createHash('sha256').update(plain).digest();
}

function base64encode(buffer) {
  return buffer.toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const page = await browser.newPage();

  const codeVerifier = generateRandomString(64);
  const codeChallenge = base64encode(sha256(codeVerifier));

  const CLIENT_ID = 'ea3003771e264c4690a2ac289afd22a4';
  const REDIRECT_URI = 'http://127.0.0.1:5173/callback';
  const SCOPES = 'user-read-private user-read-email playlist-read-private user-library-read user-top-read';

  let interceptedCode = null;
  // Intercept the redirect BEFORE the page consumes it
  await page.setRequestInterception(true);
  page.on('request', req => {
    const u = req.url();
    if (u.includes('127.0.0.1:5173/callback') && u.includes('code=')) {
      interceptedCode = new URL(u).searchParams.get('code');
      console.log('Intercepted fresh OAuth code!');
      req.abort(); // Don't let page load and burn the code!
    } else {
      req.continue();
    }
  });

  const authUrl = `https://accounts.spotify.com/authorize?response_type=code&client_id=${CLIENT_ID}&scope=${encodeURIComponent(SCOPES)}&code_challenge_method=S256&code_challenge=${codeChallenge}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;

  try {
    await page.goto(authUrl, { waitUntil: 'domcontentloaded' });
  } catch (e) {
    // aborted request will throw net::ERR_FAILED, which is expected
  }

  await page.close();

  console.log('Fresh code:', interceptedCode ? interceptedCode.substring(0, 30) + '...' : null);
  if (!interceptedCode) {
    browser.disconnect();
    return;
  }

  // Now test token exchange with pure PKCE (client_id, code, redirect_uri, code_verifier)
  console.log('Exchanging with PKCE...');
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'authorization_code',
      code: interceptedCode,
      redirect_uri: REDIRECT_URI,
      code_verifier: codeVerifier
    }).toString()
  });

  const tokenData = await res.json();
  console.log('Exchange Status:', res.status);
  console.log('Token Data:', tokenData);

  if (tokenData.access_token) {
    console.log('\n--- SUCCESS! REAL USER TOKEN ACQUIRED ---');
    const meRes = await fetch('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const me = await meRes.json();
    console.log('Logged-in User:', me.display_name, 'ID:', me.id, 'Email:', me.email);

    const plRes = await fetch('https://api.spotify.com/v1/me/playlists?limit=5', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const pls = await plRes.json();
    console.log('User Playlists directly from Spotify Cloud API:');
    for (const p of pls.items || []) {
      console.log(` - ${p.name} (${p.tracks.total} tracks, ID: ${p.id})`);
    }
  }

  browser.disconnect();
}

main().catch(console.error);
