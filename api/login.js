import { extractSpotifySession } from './extract-session.js';

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

    const { email, password, cookie, twoFactorCode } = body;

    if (cookie) {
      const session = await extractSpotifySession(cookie);
      return res.status(200).json({ success: true, ...session, cookie });
    }

    if (email && password) {
      try {
        const params = new URLSearchParams({
          username: email,
          password: password,
          remember: 'true',
        });
        if (twoFactorCode) {
          params.append('two_factor_code', twoFactorCode);
          params.append('challenge_type', '2fa');
        }

        const loginRes = await fetch('https://accounts.spotify.com/api/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          },
          body: params,
        });

        const rawCookies = loginRes.headers.get('set-cookie') || '';
        const spDcMatch = rawCookies.match(/sp_dc=([^;]+)/);
        if (spDcMatch && spDcMatch[1]) {
          const extractedCookie = spDcMatch[1];
          const session = await extractSpotifySession(extractedCookie);
          return res.status(200).json({ success: true, ...session, cookie: extractedCookie });
        }

        const data = await loginRes.json().catch(() => ({}));
        if (data.error === 'errorInvalidCredentials') {
          return res.status(400).json({
            error: 'Usuario o contraseña incorrectos en Spotify.',
            needsCookie: false,
          });
        }
      } catch (err) {
        console.warn('Direct login attempt exception:', err.message);
      }

      return res.status(200).json({
        success: false,
        error: 'Spotify requiere verificación de seguridad (código por correo) o tu cookie de sesión sp_dc.',
        needs2FA: true,
        needsCookie: true,
      });
    }

    return res.status(400).json({ error: 'Faltan credenciales.' });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Error en el servidor.' });
  }
}
