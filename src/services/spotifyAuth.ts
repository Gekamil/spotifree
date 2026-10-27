// Spotify Authentication Service (PKCE + Client Credentials)
export const CLIENT_ID = 'ea3003771e264c4690a2ac289afd22a4';
export const CLIENT_SECRET = '3976fc2dadf04e9c857ff2afdcc07d2b';

export function getClientId(): string {
  if (typeof window !== 'undefined') {
    const custom = window.localStorage.getItem('custom_spotify_client_id');
    if (custom && custom.trim()) return custom.trim();
  }
  return CLIENT_ID;
}

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

  const redirectUri = getRedirectUri();

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: getClientId(),
    scope: SCOPES,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
    redirect_uri: redirectUri,
    show_dialog: 'true',
  });

  window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
}

export async function handleSpotifyCallback(code: string): Promise<boolean> {
  const codeVerifier = window.localStorage.getItem('spotify_code_verifier') || '';
  const redirectUri = getRedirectUri();

  const activeClientId = getClientId();

  try {
    let tokenData: any = null;

    // 1. Direct PKCE exchange (RFC 7636 / Spotify Web API standard for client-side SPAs)
    const body = new URLSearchParams({
      client_id: activeClientId,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    });

    if (codeVerifier) {
      body.append('code_verifier', codeVerifier);
    }

    try {
      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      if (response.ok) {
        tokenData = await response.json();
      } else {
        const errJson = await response.json().catch(() => null);
        console.warn('Direct PKCE exchange returned error:', response.status, errJson);
      }
    } catch (directErr) {
      console.warn('Direct Spotify PKCE call failed (network or extension), trying /api/token proxy:', directErr);
    }

    // 2. Fallback to /api/token proxy if direct fetch failed
    if (!tokenData || !tokenData.access_token) {
      try {
        let proxyRes = await fetch('/api/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code,
            code_verifier: codeVerifier,
            redirect_uri: redirectUri,
            client_id: activeClientId,
          }),
        });

        if (!proxyRes.ok) {
          proxyRes = await fetch('/api/spotify/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              code,
              code_verifier: codeVerifier,
              redirect_uri: redirectUri,
              client_id: activeClientId,
            }),
          });
        }

        if (proxyRes.ok) {
          tokenData = await proxyRes.json();
        } else {
          const proxyErr = await proxyRes.json().catch(() => null);
          console.error('/api/token proxy failed:', proxyRes.status, proxyErr);
        }
      } catch (proxyErr) {
        console.error('Token proxy network failure:', proxyErr);
      }
    }

    if (!tokenData || !tokenData.access_token) {
      console.error('All Spotify token exchange attempts failed for authorization code');
      return false;
    }

    const expiresAt = Date.now() + (tokenData.expires_in || 3600) * 1000;
    window.localStorage.setItem('spotify_access_token', tokenData.access_token);
    if (tokenData.refresh_token) {
      window.localStorage.setItem('spotify_refresh_token', tokenData.refresh_token);
    }
    window.localStorage.setItem('spotify_expires_at', expiresAt.toString());
    window.localStorage.removeItem('spotify_code_verifier');
    window.localStorage.removeItem('spotify_logged_out');

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

  const activeClientId = getClientId();

  try {
    let tokenData: any = null;

    // 1. Direct PKCE refresh (RFC 7636 standard for SPAs)
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: activeClientId,
    });

    try {
      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      if (response.ok) {
        tokenData = await response.json();
      }
    } catch (directErr) {
      console.warn('Direct Spotify token refresh failed, trying proxy:', directErr);
    }

    // 2. Fallback to /api/token proxy
    if (!tokenData || !tokenData.access_token) {
      try {
        let proxyRes = await fetch('/api/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: activeClientId,
          }),
        });

        if (!proxyRes.ok) {
          proxyRes = await fetch('/api/spotify/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              grant_type: 'refresh_token',
              refresh_token: refreshToken,
              client_id: activeClientId,
            }),
          });
        }

        if (proxyRes.ok) {
          tokenData = await proxyRes.json();
        }
      } catch (proxyErr) {
        console.error('Token refresh proxy failed:', proxyErr);
      }
    }

    if (!tokenData || !tokenData.access_token) {
      console.error('Failed to refresh Spotify access token through direct or proxy');
      return null;
    }

    const expiresAt = Date.now() + (tokenData.expires_in || 3600) * 1000;
    window.localStorage.setItem('spotify_access_token', tokenData.access_token);
    if (tokenData.refresh_token) {
      window.localStorage.setItem('spotify_refresh_token', tokenData.refresh_token);
    }
    window.localStorage.setItem('spotify_expires_at', expiresAt.toString());

    return tokenData.access_token;
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

