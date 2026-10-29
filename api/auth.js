import fs from 'node:fs';
import path from 'node:path';

function getAccountsFile() {
  return path.resolve('src/data/spotifreeAccounts.json');
}

function loadAccounts() {
  try {
    const file = getAccountsFile();
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
  } catch {}
  return {};
}

function saveAccounts(accounts) {
  try {
    const file = getAccountsFile();
    fs.writeFileSync(file, JSON.stringify(accounts, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save spotifreeAccounts.json:', err);
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  // Read Body if POST
  let body = {};
  if (req.method === 'POST') {
    try {
      if (typeof req.body === 'object' && req.body !== null) {
        body = req.body;
      } else if (typeof req.body === 'string') {
        body = JSON.parse(req.body);
      } else {
        let raw = '';
        for await (const chunk of req) raw += chunk;
        if (raw) body = JSON.parse(raw);
      }
    } catch {}
  }

  const accounts = loadAccounts();

  // 1. REGISTER
  if (pathname.endsWith('/register') || body.action === 'register') {
    const email = (body.email || '').trim().toLowerCase();
    const password = (body.password || '').trim();
    const displayName = (body.displayName || body.name || email.split('@')[0] || 'Usuario').trim();

    if (!email || !password) {
      return res.status(400).json({ error: 'Debes proporcionar correo y contraseña.' });
    }

    if (accounts[email]) {
      return res.status(400).json({ error: 'Ya existe una cuenta registrada con este correo.' });
    }

    const newAccount = {
      email,
      password,
      displayName,
      avatarUrl: body.avatarUrl || null,
      bannerUrl: body.bannerUrl || null,
      spotifyCookie: body.spotifyCookie || '',
      playlists: Array.isArray(body.playlists) ? body.playlists : [],
      likedTracks: Array.isArray(body.likedTracks) ? body.likedTracks : [],
      history: Array.isArray(body.history) ? body.history : [],
      stats: body.stats || {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    accounts[email] = newAccount;
    saveAccounts(accounts);

    return res.status(200).json({
      success: true,
      message: 'Cuenta creada correctamente.',
      account: { ...newAccount, password: '' },
    });
  }

  // 2. LOGIN
  if (pathname.endsWith('/login') || body.action === 'login') {
    const email = (body.email || '').trim().toLowerCase();
    const password = (body.password || '').trim();

    if (!email || !password) {
      return res.status(400).json({ error: 'Por favor, introduce tu correo y contraseña.' });
    }

    const account = accounts[email];
    if (!account || account.password !== password) {
      return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
    }

    return res.status(200).json({
      success: true,
      account: { ...account, password: '' },
    });
  }

  // 3. SYNC DATA (Push local playlists, liked songs, profile, cookie to Cloud)
  if (pathname.endsWith('/sync') || body.action === 'sync') {
    const email = (body.email || '').trim().toLowerCase();
    const password = (body.password || '').trim();

    if (!email) {
      return res.status(400).json({ error: 'Falta el identificador de la cuenta.' });
    }

    let account = accounts[email];
    if (!account) {
      // Auto-create account if password provided
      account = {
        email,
        password: password || '1234',
        displayName: body.displayName || email.split('@')[0] || 'Usuario',
        avatarUrl: null,
        bannerUrl: null,
        spotifyCookie: '',
        playlists: [],
        likedTracks: [],
        history: [],
        stats: {},
        createdAt: Date.now(),
      };
    } else if (password && account.password && account.password !== password) {
      return res.status(401).json({ error: 'Contraseña no válida para sincronizar.' });
    }

    // Merge playlists (avoid duplicates by ID)
    if (Array.isArray(body.playlists)) {
      const existingIds = new Set(account.playlists.map((p) => p.id));
      for (const pl of body.playlists) {
        if (!existingIds.has(pl.id)) {
          account.playlists.unshift(pl);
          existingIds.add(pl.id);
        } else {
          // Update existing
          account.playlists = account.playlists.map((p) => (p.id === pl.id ? { ...p, ...pl } : p));
        }
      }
    }

    if (Array.isArray(body.likedTracks)) {
      account.likedTracks = Array.from(new Set([...account.likedTracks, ...body.likedTracks]));
    }

    if (body.displayName) account.displayName = body.displayName;
    if (body.avatarUrl !== undefined) account.avatarUrl = body.avatarUrl;
    if (body.bannerUrl !== undefined) account.bannerUrl = body.bannerUrl;
    if (body.spotifyCookie) account.spotifyCookie = body.spotifyCookie;
    if (body.stats) account.stats = { ...(account.stats || {}), ...body.stats };
    account.updatedAt = Date.now();

    accounts[email] = account;
    saveAccounts(accounts);

    return res.status(200).json({
      success: true,
      account: { ...account, password: '' },
    });
  }

  // 4. GET ACCOUNT
  if (req.method === 'GET') {
    const email = (url.searchParams.get('email') || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: 'Missing email' });
    }
    const account = accounts[email];
    if (!account) {
      return res.status(404).json({ error: 'Cuenta no encontrada' });
    }
    return res.status(200).json({
      success: true,
      account: { ...account, password: '' },
    });
  }

  return res.status(404).json({ error: 'Ruta no encontrada' });
}
