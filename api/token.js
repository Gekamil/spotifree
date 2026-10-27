export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    let body = req.body;
    if (!body || typeof body !== 'object') {
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch {}
      } else {
        try {
          let raw = '';
          for await (const chunk of req) raw += chunk;
          if (raw) body = JSON.parse(raw);
        } catch {}
      }
    }
    body = body || {};

    const { code, code_verifier, redirect_uri, refresh_token, grant_type } = body;
    const CLIENT_ID = 'ea3003771e264c4690a2ac289afd22a4';
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

    // Spotify PKCE RFC strictly requires NO Basic Auth header when code_verifier is present.
    // Only send Basic Auth if pure client credentials or legacy non-PKCE authorization_code.
    if (!code_verifier && grant_type !== 'refresh_token' && CLIENT_SECRET) {
      headers['Authorization'] = 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
    }

    const spotifyRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers,
      body: params.toString(),
    });

    const data = await spotifyRes.json();
    return res.status(spotifyRes.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
