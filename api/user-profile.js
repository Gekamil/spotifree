/**
 * Spotifree User Profile Sync API
 * Allows persistent profile customization (avatar, banner, bio) synced across devices
 * keyed by Spotify User ID or normalized username.
 */

import fs from 'node:fs';
import path from 'node:path';

const PROFILES_CACHE = new Map();

// Load persistent profiles from file if available
function getStorageFile() {
  const primary = path.resolve('src/data/userCustomProfiles.json');
  return primary;
}

function loadProfiles() {
  try {
    const file = getStorageFile();
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
    const file = getStorageFile();
    const obj = {};
    for (const [k, v] of PROFILES_CACHE.entries()) {
      obj[k] = v;
    }
    fs.writeFileSync(file, JSON.stringify(obj, null, 2), 'utf8');
  } catch {}
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // GET: Fetch profile by userId, username, or cookie
  if (req.method === 'GET') {
    const userId = (req.query?.userId || req.query?.id || req.query?.name || '').toLowerCase().trim();
    const cookie = (req.query?.cookie || '').trim();
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

  // POST: Save profile customization
  if (req.method === 'POST') {
    try {
      let body = req.body;
      if (typeof body === 'string') {
        body = JSON.parse(body || '{}');
      }

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
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
