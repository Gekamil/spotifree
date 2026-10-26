/**
 * Test Infrastructure Helpers & Shared Utilities for Spotifree E2E Test Suite
 * Opaque-box testing primitives, assertions, fixtures, and browser bridges.
 */

import crypto from 'node:crypto';
import http from 'node:http';
import assert from 'node:assert/strict';

export const CONFIG = {
  CLIENT_ID: 'ea3003771e264c4690a2ac289afd22a4',
  REDIRECT_URI: 'http://127.0.0.1:5173/callback',
  APP_URL: 'http://127.0.0.1:5173',
  CHROME_DEBUG_PORT: 9222,
  REQUIRED_SCOPES: [
    'user-read-private',
    'user-read-email',
    'playlist-read-private',
    'playlist-read-collaborative',
    'user-library-read',
    'user-top-read',
    'user-read-recently-played',
    'user-read-playback-state',
    'user-modify-playback-state',
  ],
};

// --- Test Framework Primitives ---
export class TestSuite {
  constructor(name, options = {}) {
    this.name = name;
    this.options = options;
    this.tests = [];
    this.beforeHooks = [];
    this.afterHooks = [];
  }

  before(fn) {
    this.beforeHooks.push(fn);
  }

  after(fn) {
    this.afterHooks.push(fn);
  }

  test(title, fn, meta = {}) {
    this.tests.push({ title, fn, meta, status: 'pending', durationMs: 0 });
  }

  async run(filter = {}) {
    const results = {
      name: this.name,
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      tests: [],
    };

    for (const hook of this.beforeHooks) {
      await hook();
    }

    for (const t of this.tests) {
      if (filter.tier && t.meta.tier && t.meta.tier !== filter.tier) {
        continue;
      }
      if (filter.feature && t.meta.feature && t.meta.feature !== filter.feature) {
        continue;
      }

      results.total++;
      const start = Date.now();
      try {
        await t.fn();
        t.status = 'passed';
        t.durationMs = Date.now() - start;
        results.passed++;
        results.tests.push({ title: t.title, meta: t.meta, status: 'passed', durationMs: t.durationMs });
      } catch (err) {
        t.status = 'failed';
        t.durationMs = Date.now() - start;
        t.error = err;
        results.failed++;
        results.tests.push({
          title: t.title,
          meta: t.meta,
          status: 'failed',
          durationMs: t.durationMs,
          error: err.message,
          stack: err.stack,
        });
      }
    }

    for (const hook of this.afterHooks) {
      await hook();
    }

    return results;
  }
}

// --- Custom Assertion Utilities ---
export function assertEqual(actual, expected, message) {
  assert.strictEqual(actual, expected, message);
}

export function assertNotEqual(actual, expected, message) {
  assert.notStrictEqual(actual, expected, message);
}

export function assertDeepEqual(actual, expected, message) {
  assert.deepStrictEqual(actual, expected, message);
}

export function assertTrue(value, message) {
  assert.strictEqual(Boolean(value), true, message || `Expected truthy, got ${value}`);
}

export function assertFalse(value, message) {
  assert.strictEqual(Boolean(value), false, message || `Expected falsy, got ${value}`);
}

export function assertMatch(str, regex, message) {
  assert.match(String(str), regex, message);
}

export function assertThrows(fn, message) {
  assert.throws(fn, message);
}

export function assertDoesNotThrow(fn, message) {
  assert.doesNotThrow(fn, message);
}

// --- PKCE & Cryptographic Validators ---
export function generateCodeVerifier(length = 64) {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const bytes = crypto.randomBytes(length);
  let res = '';
  for (let i = 0; i < length; i++) {
    res += possible[bytes[i] % possible.length];
  }
  return res;
}

export function computeCodeChallenge(verifier) {
  const hash = crypto.createHash('sha256').update(verifier).digest();
  return hash
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

export function isValidPKCEVerifier(verifier) {
  if (typeof verifier !== 'string') return false;
  if (verifier.length < 43 || verifier.length > 128) return false;
  return /^[A-Za-z0-9\-._~]+$/.test(verifier);
}

// --- Spotify Auth URL Builder & Parser ---
export function buildSpotifyAuthUrl({
  clientId = CONFIG.CLIENT_ID,
  redirectUri = CONFIG.REDIRECT_URI,
  scopes = CONFIG.REQUIRED_SCOPES,
  codeChallenge,
  codeChallengeMethod = 'S256',
  responseType = 'code',
}) {
  const params = new URLSearchParams({
    response_type: responseType,
    client_id: clientId,
    scope: Array.isArray(scopes) ? scopes.join(' ') : scopes,
    code_challenge_method: codeChallengeMethod,
    code_challenge: codeChallenge,
    redirect_uri: redirectUri,
  });
  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

export function parseSpotifyAuthUrl(urlStr) {
  const parsed = new URL(urlStr);
  const params = parsed.searchParams;
  return {
    origin: parsed.origin,
    pathname: parsed.pathname,
    response_type: params.get('response_type'),
    client_id: params.get('client_id'),
    scope: params.get('scope'),
    scopes: params.get('scope') ? params.get('scope').split(' ') : [],
    code_challenge_method: params.get('code_challenge_method'),
    code_challenge: params.get('code_challenge'),
    redirect_uri: params.get('redirect_uri'),
  };
}

// --- Token Persistence & Expiry Utilities ---
export function calculateTokenExpiry(expiresInSeconds) {
  return Date.now() + expiresInSeconds * 1000;
}

export function isTokenValid(expiresAtMs, bufferMs = 60000) {
  if (!expiresAtMs || isNaN(Number(expiresAtMs))) return false;
  return Date.now() < Number(expiresAtMs) - bufferMs;
}

// --- Greeting Elimination Validator ---
export const FORBIDDEN_GREETINGS = [
  'buenos días',
  'buenos dias',
  'buenas tardes',
  'buenas noches',
  'good morning',
  'good afternoon',
  'good evening',
  'bonjour',
];

export function containsArbitraryGreeting(text) {
  if (!text || typeof text !== 'string') return false;
  const lower = text.toLowerCase();
  return FORBIDDEN_GREETINGS.some((g) => lower.includes(g));
}

// --- Typography & Playing State Contract Checker ---
export function checkSidebarTypography(elementStyle) {
  return {
    isTitle16px: elementStyle.fontSize === '16px' || elementStyle.classIncludesText16,
    isSubtitle14px: elementStyle.fontSize === '14px' || elementStyle.classIncludesText14,
    hasSpotifyFont:
      elementStyle.fontFamily?.includes('SpotifyMixUI') ||
      elementStyle.fontFamily?.includes('Circular') ||
      elementStyle.classIncludesFontSpotify,
    isSubtitleMuted:
      elementStyle.color === '#b3b3b3' || elementStyle.classIncludesMutedColor,
  };
}

export function getExpectedPlaylistTextColor({ _isSelected, isPlayingTrackFromPlaylist }) {
  if (isPlayingTrackFromPlaylist) {
    return '#1ed760'; // Spotify green
  }
  return '#ffffff'; // White in both normal and selected states
}

// --- Dynamic Shelf Priority Order Checker ---
export const EXPECTED_SHELF_TYPES_IN_ORDER = [
  'featured',
  'made_for',
  'recent',
  'artist',
  'mixes',
];

// --- Fixtures for Opaque-Box Test Assertions ---
export const FIXTURES = {
  authenticatedUser: {
    id: 'e6yr34zzwnf1yybcw49po6nrw',
    display_name: 'Jorgeperezvk',
    images: [{ url: 'https://i.scdn.co/image/ab6775700000ee85JorgeAvatar' }],
    avatarLetter: 'J',
    avatarColor: '#ff6437',
    product: 'premium',
  },
  livePlaylists: [
    {
      id: 'liked-songs',
      name: 'Canciones que te gustan',
      description: 'Lista • 23 canciones',
      images: [{ url: 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg' }],
      owner: { display_name: 'Jorgeperezvk' },
      is_pinned: true,
      tracks: { total: 23 },
    },
    {
      id: 'jl-2026',
      name: 'J+L(2026)',
      description: 'Jorge • 12 canciones',
      images: [{ url: 'https://image-cdn-fa.spotifycdn.com/image/ab67706c0000d72c804d43e5cc7f6a6d0ac65ffc' }],
      owner: { display_name: 'Jorgeperezvk' },
      is_pinned: false,
      tracks: { total: 12 },
    },
    {
      id: 'romeo-prince',
      name: 'Romeo & Prince',
      description: 'Jorge • 45 canciones',
      images: [{ url: 'https://image-cdn-fa.spotifycdn.com/image/ab67706c0000d72cfd28fd6f3ec5b7002c5649d7' }],
      owner: { display_name: 'Jorgeperezvk' },
      is_pinned: false,
      tracks: { total: 45 },
    },
    {
      id: 'nuestro-amor',
      name: '♡ nuestro amor ♡ (2024-25)',
      description: 'Jorge • 31 canciones',
      images: [{ url: 'https://image-cdn-fa.spotifycdn.com/image/ab67706c0000d72c94fb1489122f222f1a57c7c8' }],
      owner: { display_name: 'Jorgeperezvk' },
      is_pinned: false,
      tracks: { total: 31 },
    },
  ],
  editorialFeatured: {
    message: '¡Hoy es viernes de novedades!',
    playlists: [
      { id: 'f-1', name: 'Novedades Viernes España' },
      { id: 'f-2', name: 'Radar de Novedades' },
    ],
  },
  livePlayback: {
    isPlaying: true,
    progressMs: 45000,
    durationMs: 210000,
    item: {
      id: 'track-123',
      name: 'Propuesta Indecente',
      artists: [{ name: 'Romeo Santos' }],
      playlistId: 'romeo-prince',
    },
  },
};

// --- Chrome DevTools / Browser Bridge Helper ---
export async function isChromePortOpen(port = CONFIG.CHROME_DEBUG_PORT) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/json/version`, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

export async function withBrowserPage(callback) {
  let puppeteer;
  try {
    const imported = await import('puppeteer-core');
    puppeteer = imported.default || imported;
  } catch (err) {
    throw new Error(`puppeteer-core not available: ${err.message}`);
  }

  const browser = await puppeteer.connect({
    browserURL: `http://127.0.0.1:${CONFIG.CHROME_DEBUG_PORT}`,
  });

  const page = await browser.newPage();
  try {
    return await callback(page);
  } finally {
    try {
      await page.close();
    } catch {}
    browser.disconnect();
  }
}
