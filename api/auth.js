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
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(file, JSON.stringify(accounts, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save spotifreeAccounts.json:', err);
  }
}

const PROFILES_CACHE = new Map();

function getProfilesStorageFile() {
  return path.resolve('src/data/userCustomProfiles.json');
}

function loadProfiles() {
  try {
    const file = getProfilesStorageFile();
    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file, 'utf8');
      const data = JSON.parse(raw);
      for (const [k, v] of Object.entries(data)) {
        PROFILES_CACHE.set(k.toLowerCase().trim(), v);
      }
    }
  } catch {}
}

loadProfiles();

function saveProfiles() {
  try {
    const file = getProfilesStorageFile();
    const obj = {};
    for (const [k, v] of PROFILES_CACHE.entries()) {
      obj[k] = v;
    }
    fs.writeFileSync(file, JSON.stringify(obj, null, 2), 'utf8');
  } catch {}
}

async function handleUserProfile(req, res, url, body) {
  if (req.method === 'GET') {
    const userId = (url.searchParams.get('userId') || url.searchParams.get('id') || url.searchParams.get('name') || req.query?.userId || req.query?.id || req.query?.name || '').toLowerCase().trim();
    const cookie = (url.searchParams.get('cookie') || req.query?.cookie || '').trim();
    let profile = null;

    if (userId) {
      profile = PROFILES_CACHE.get(userId) || null;
    }

    if (!profile && cookie) {
      const cleanCookie = cookie.replace(/^sp_dc=/i, '').slice(0, 30);
      profile = PROFILES_CACHE.get(`cookie:${cleanCookie}`) || null;
      if (!profile) {
        for (const p of PROFILES_CACHE.values()) {
          if (p?.cookie && (p.cookie.includes(cleanCookie) || cleanCookie.includes(p.cookie.slice(0, 25)))) {
            profile = p;
            break;
          }
        }
      }
    }

    return res.status(200).json({ success: true, profile });
  }

  if (req.method === 'POST') {
    try {
      const userId = (body?.userId || body?.id || body?.displayName || '').toLowerCase().trim();
      const cookie = (body?.cookie || '').trim();
      if (!userId && !cookie) {
        return res.status(400).json({ error: 'Missing userId or cookie' });
      }

      const key = userId || `user_${Date.now()}`;
      const existing = PROFILES_CACHE.get(key) || {};
      const updated = {
        ...existing,
        userId: key,
        displayName: body.displayName || existing.displayName,
        avatarUrl: body.avatarUrl !== undefined ? body.avatarUrl : existing.avatarUrl,
        bannerUrl: body.bannerUrl !== undefined ? body.bannerUrl : existing.bannerUrl,
        cookie: body.cookie || existing.cookie,
        email: body.email || existing.email,
        updatedAt: Date.now(),
      };

      PROFILES_CACHE.set(key, updated);
      if (body.displayName) {
        PROFILES_CACHE.set(body.displayName.toLowerCase().trim(), updated);
      }
      if (body.cookie) {
        const clean = body.cookie.replace(/^sp_dc=/i, '').slice(0, 30);
        PROFILES_CACHE.set(`cookie:${clean}`, updated);
      }

      saveProfiles();

      return res.status(200).json({ success: true, profile: updated });
    } catch (err) {
      return res.status(500).json({ error: err?.message || String(err) });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

export default async function handler(req, res) {
  // Polyfill Express-like helpers if running inside Connect/Vite dev middleware
  if (!res.status) {
    res.status = function(code) {
      this.statusCode = code;
      return this;
    };
  }
  if (!res.json) {
    res.json = function(data) {
      this.setHeader('Content-Type', 'application/json');
      this.end(JSON.stringify(data));
      return this;
    };
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname.toLowerCase();

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

  // Determine intent (profile, register, login, sync, or get)
  const isProfile = pathname.includes('user-profile') || pathname.includes('profile') || body.action === 'profile' || url.searchParams.get('action') === 'profile';
  if (isProfile) {
    return handleUserProfile(req, res, url, body);
  }

  const isRegister = pathname.includes('register') || body.action === 'register';
  const isLogin = pathname.includes('login') || body.action === 'login';
  const isSync = pathname.includes('sync') || body.action === 'sync';

  // 1. REGISTER
  if (isRegister) {
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
      theme: body.theme || 'standard',
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
  if (isLogin) {
    const email = (body.email || '').trim().toLowerCase();
    const password = (body.password || '').trim();

    if (!email || !password) {
      return res.status(400).json({ error: 'Por favor, introduce tu correo y contraseña.' });
    }

    const account = accounts[email];
    if (!account || account.password !== password) {
      return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
    }

    // Merge incoming cookie or playlists if user had local offline changes
    let changed = false;
    if (body.spotifyCookie && !account.spotifyCookie) {
      account.spotifyCookie = body.spotifyCookie;
      changed = true;
    }
    if (Array.isArray(body.playlists) && body.playlists.length > 0) {
      const existingIds = new Set(account.playlists.map((p) => p.id));
      for (const pl of body.playlists) {
        if (!existingIds.has(pl.id)) {
          account.playlists.unshift(pl);
          existingIds.add(pl.id);
          changed = true;
        }
      }
    }
    if (Array.isArray(body.likedTracks) && body.likedTracks.length > 0) {
      account.likedTracks = Array.from(new Set([...account.likedTracks, ...body.likedTracks]));
      changed = true;
    }

    if (changed) {
      account.updatedAt = Date.now();
      accounts[email] = account;
      saveAccounts(accounts);
    }

    return res.status(200).json({
      success: true,
      account: { ...account, password: '' },
    });
  }

  // 3. SYNC DATA (Push local playlists, liked songs, profile, cookie to Cloud)
  if (isSync) {
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
        theme: 'standard',
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
    if (body.theme) account.theme = body.theme;
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
