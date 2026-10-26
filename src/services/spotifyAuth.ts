// Spotify Authentication Service (PKCE + Client Credentials)
export const CLIENT_ID = 'ea3003771e264c4690a2ac289afd22a4';
export const CLIENT_SECRET = '3976fc2dadf04e9c857ff2afdcc07d2b';
export function getRedirectUri(): string {
  if (typeof window !== 'undefined') {
    if (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') {
      return 'http://127.0.0.1:5173/callback';
    }
    return `${window.location.origin}/callback`;
  }
  return 'http://127.0.0.1:5173/callback';
}

export const REDIRECT_URI = 'http://127.0.0.1:5173/callback';

const SCOPES = [
  'user-read-private',
  'user-read-email',
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-library-read',
  'user-top-read',
  'user-read-recently-played',
  'user-read-playback-state',
  'user-modify-playback-state',
].join(' ');

function generateRandomString(length: number): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return values.reduce((acc, x) => acc + possible[x % possible.length], '');
}

async function sha256(plain: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return window.crypto.subtle.digest('SHA-256', data);
}

function base64encode(input: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(input)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

export async function initiateSpotifyLogin(): Promise<void> {
  // Ensure we are on 127.0.0.1 to match Spotify Dashboard Redirect URI
  if (window.location.hostname === 'localhost') {
    window.location.href = `http://127.0.0.1:5173${window.location.pathname}`;
    return;
  }

  const codeVerifier = generateRandomString(64);
  const hashed = await sha256(codeVerifier);
  const codeChallenge = base64encode(hashed);

  window.localStorage.setItem('spotify_code_verifier', codeVerifier);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    scope: SCOPES,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
    redirect_uri: REDIRECT_URI,
  });

  window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
}

export async function handleSpotifyCallback(code: string): Promise<boolean> {
  const codeVerifier = window.localStorage.getItem('spotify_code_verifier') || '';

  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
  });

  if (codeVerifier) {
    body.append('code_verifier', codeVerifier);
  }

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)}`,
    };

    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers,
      body: body.toString(),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Spotify token exchange failed:', err);
      return false;
    }

    const data = await response.json();
    const expiresAt = Date.now() + data.expires_in * 1000;

    window.localStorage.setItem('spotify_access_token', data.access_token);
    if (data.refresh_token) {
      window.localStorage.setItem('spotify_refresh_token', data.refresh_token);
    }
    window.localStorage.setItem('spotify_expires_at', expiresAt.toString());

    return true;
  } catch (error) {
    console.error('Error handling Spotify callback:', error);
    return false;
  }
}

export async function getClientCredentialsToken(): Promise<string | null> {
  const cached = window.localStorage.getItem('spotify_app_token');
  const expiresAt = parseInt(window.localStorage.getItem('spotify_app_expires_at') || '0', 10);

  if (cached && Date.now() < expiresAt - 60000) {
    return cached;
  }

  try {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ grant_type: 'client_credentials' }).toString(),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const expires = Date.now() + data.expires_in * 1000;

    window.localStorage.setItem('spotify_app_token', data.access_token);
    window.localStorage.setItem('spotify_app_expires_at', expires.toString());

    return data.access_token;
  } catch (err) {
    console.error('Error fetching client credentials token:', err);
    return null;
  }
}

export async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = window.localStorage.getItem('spotify_refresh_token');
  if (!refreshToken) {
    return null;
  }

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)}`,
    };

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
    });

    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers,
      body: body.toString(),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Failed to refresh Spotify access token:', err);
      return null;
    }

    const data = await response.json();
    const expiresAt = Date.now() + (data.expires_in || 3600) * 1000;

    window.localStorage.setItem('spotify_access_token', data.access_token);
    if (data.refresh_token) {
      window.localStorage.setItem('spotify_refresh_token', data.refresh_token);
    }
    window.localStorage.setItem('spotify_expires_at', expiresAt.toString());

    return data.access_token;
  } catch (error) {
    console.error('Error refreshing Spotify access token:', error);
    return null;
  }
}

export async function getValidAccessToken(): Promise<string | null> {
  const token = window.localStorage.getItem('spotify_access_token');
  const expiresAt = parseInt(window.localStorage.getItem('spotify_expires_at') || '0', 10);

  if (token && Date.now() < expiresAt - 60000) {
    return token;
  }

  // Attempt auto-refresh using stored refresh token
  if (window.localStorage.getItem('spotify_refresh_token')) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return refreshed;
    }
  }

  // If user token is missing or expired, fallback to app-level Client Credentials token!
  return await getClientCredentialsToken();
}

export function logoutSpotify(): void {
  window.localStorage.removeItem('spotify_access_token');
  window.localStorage.removeItem('spotify_refresh_token');
  window.localStorage.removeItem('spotify_expires_at');
  window.localStorage.removeItem('spotify_code_verifier');
  window.localStorage.removeItem('spotify_session_synced');
}

