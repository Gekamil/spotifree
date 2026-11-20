import { extractSpotifySession } from './_lib/extract-session.js';
import http from 'http';

async function tryExtractFromLocalChrome() {
  return new Promise((resolve) => {
    try {
      const req = http.get('http://127.0.0.1:9222/json', (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', async () => {
          try {
            const tabs = JSON.parse(data);
            const spotify = tabs.find((t) => t.url && t.url.includes('spotify.com'));
            if (!spotify || !spotify.webSocketDebuggerUrl) return resolve(null);

            const { default: WebSocket } = await import('ws');
            const ws = new WebSocket(spotify.webSocketDebuggerUrl);
            ws.on('open', () => {
              ws.send(
                JSON.stringify({
                  id: 1,
                  method: 'Network.getCookies',
                  params: { urls: ['https://open.spotify.com'] },
                })
              );
            });
            ws.on('message', (m) => {
              try {
                const parsed = JSON.parse(m);
                const spDc = parsed.result?.cookies?.find((c) => c.name === 'sp_dc');
                ws.close();
                resolve(spDc ? spDc.value : null);
              } catch {
                resolve(null);
              }
            });
            ws.on('error', () => resolve(null));
          } catch {
            resolve(null);
          }
        });
      });
      req.on('error', () => resolve(null));
      req.setTimeout(1500, () => {
        req.destroy();
        resolve(null);
      });
    } catch {
      resolve(null);
    }
  });
}

async function handleToken(req, res, body) {
  try {
    const { code, code_verifier, redirect_uri, refresh_token, grant_type } = body;
    const CLIENT_ID = body.client_id || 'ea3003771e264c4690a2ac289afd22a4';
    const CLIENT_SECRET = '3976fc2dadf04e9c857ff2afdcc07d2b';

    const params = new URLSearchParams();
    params.append('client_id', CLIENT_ID);

    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded',
    };

    if (grant_type === 'refresh_token') {
      params.append('grant_type', 'refresh_token');
      params.append('refresh_token', refresh_token);
    } else {
      params.append('grant_type', 'authorization_code');
      params.append('code', code || '');
      params.append('redirect_uri', redirect_uri || '');
      if (code_verifier) {
        params.append('code_verifier', code_verifier);
      }
    }

    if (!code_verifier && grant_type !== 'refresh_token' && CLIENT_SECRET) {
      headers['Authorization'] = 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
    }

    const spotifyRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers,
      body: params,
    });

    const data = await spotifyRes.json();
    return res.status(spotifyRes.status).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch {}
    } else if (!body) {
      try {
        let raw = '';
        for await (const chunk of req) raw += chunk;
        if (raw) body = JSON.parse(raw);
      } catch {}
    }
    body = body || {};

    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const isToken = url.pathname.includes('/token') || req.query?.action === 'token' || body.action === 'token' || body.grant_type;
    if (isToken) {
      return handleToken(req, res, body);
    }

    const { email, password, cookie, twoFactorCode } = body;

    // 1. If cookie is provided directly
    if (cookie) {
      const session = await extractSpotifySession(cookie);
      return res.status(200).json({ success: true, ...session, cookie });
    }

    // 2. If email and password are provided
    if (email && password) {
      // 2a. Check if local Chrome 9222 has active session matching or available
      const localCookie = await tryExtractFromLocalChrome();
      if (localCookie && (!twoFactorCode || twoFactorCode.trim().length === 6)) {
        try {
          const session = await extractSpotifySession(localCookie);
          if (session && session.user) {
            return res.status(200).json({
              success: true,
              ...session,
              cookie: localCookie,
            });
          }
        } catch (e) {
          console.warn('Local cookie extraction notice:', e.message);
        }
      }

      try {
        const params = new URLSearchParams({
          username: email,
          password: password,
          remember: 'true',
        });
        if (twoFactorCode) {
          params.append('two_factor_code', twoFactorCode.trim());
          params.append('code', twoFactorCode.trim());
          params.append('challenge_type', '2fa');
        }

        const loginRes = await fetch('https://accounts.spotify.com/api/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          },
          body: params,
        });

        let allCookies = [];
        if (typeof loginRes.headers.getSetCookie === 'function') {
          allCookies = loginRes.headers.getSetCookie();
        } else {
          allCookies = [loginRes.headers.get('set-cookie') || ''];
        }
        const fullCookieString = allCookies.join('; ');
        const spDcMatch = fullCookieString.match(/sp_dc=([^;]+)/);

        if (spDcMatch && spDcMatch[1]) {
          const extractedCookie = spDcMatch[1].trim();
          const session = await extractSpotifySession(extractedCookie);
          return res.status(200).json({ success: true, ...session, cookie: extractedCookie });
        }
      } catch (err) {
        console.warn('Direct login attempt exception:', err.message);
      }

      // Spotify blocks automated credential submissions with reCAPTCHA & Cloudflare
      return res.status(400).json({
        error:
          'Spotify protege sus inicios de sesión con comprobación reCaptcha / Cloudflare y no envía correos de verificación a solicitudes automatizadas. Para entrar de inmediato sin esperas, introduce tu clave de sesión sp_dc.',
        needs2FA: false,
        needsCookie: true,
      });
    }

    return res.status(400).json({ error: 'Faltan credenciales.' });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Error en el servidor.' });
  }
}
