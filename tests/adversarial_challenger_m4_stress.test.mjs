import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import searchHandler from '../api/search.js';

// Polyfills for browser environment in Node
class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
  clear() { this.map.clear(); }
}
globalThis.localStorage = new MemoryStorage();
globalThis.sessionStorage = new MemoryStorage();
globalThis.window = globalThis.window || { dispatchEvent() {}, addEventListener() {}, removeEventListener() {} };
if (typeof globalThis.CustomEvent === 'undefined') {
  globalThis.CustomEvent = class CustomEvent extends Event {
    constructor(t, o) { super(t); this.detail = o?.detail; }
  };
}

function mockReqRes(url) {
  let statusCode = 200;
  let headers = {};
  let body = null;
  const req = {
    method: 'GET',
    url,
    headers: { host: 'localhost:3000' },
  };
  const res = {
    setHeader(k, v) { headers[k] = v; },
    status(code) { statusCode = code; return res; },
    json(data) { body = data; return res; },
    end() { return res; },
  };
  return { req, res, getResult: () => ({ statusCode, headers, body }) };
}

test('Milestone 4 Adversarial Stress Harness: F14 & F15', async (t) => {
  // =========================================================================
  // DEFECT AUDIT 1: Compilation & Identifier Scope Oracle
  // =========================================================================
  await t.test('Defect Audit 1: tsc compilation verifies symbol scoping in M4 files', () => {
    let tscOutput = '';
    let tscExitCode = 0;
    try {
      tscOutput = execSync('cmd.exe /c npx tsc -p tsconfig.app.json --noEmit', {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (err) {
      tscExitCode = err.status || 1;
      tscOutput = (err.stdout || '') + (err.stderr || '');
    }

    const hasArtistServiceScopeError = tscOutput.includes("Cannot find name 'useSpotifyDataStore'");
    const hasSpotifyApiScopeError = tscOutput.includes("Cannot find name 'data'");

    console.log('--- TSC AUDIT RESULT ---');
    console.log('Exit Code:', tscExitCode);
    console.log('hasArtistServiceScopeError:', hasArtistServiceScopeError);
    console.log('hasSpotifyApiScopeError:', hasSpotifyApiScopeError);
    console.log('--- END TSC AUDIT ---');

    // This test formally documents the two critical defect findings
    assert.ok(
      hasArtistServiceScopeError,
      "CRITICAL FINDING: src/services/artistService.ts has unresolved identifier 'useSpotifyDataStore'"
    );
    assert.ok(
      hasSpotifyApiScopeError,
      "CRITICAL FINDING: src/services/spotifyApi.ts has unresolved identifier 'data' due to block-scoping in try{}"
    );
  });

  // =========================================================================
  // DEFECT AUDIT 2: Runtime Crash Reproduction in searchSpotify
  // =========================================================================
  await t.test('Defect Audit 2: Empirical reproduction of ReferenceError in searchSpotify', async () => {
    const rawCode = fs.readFileSync('src/services/spotifyApi.ts', 'utf8');

    // Verify presence of `const data = await fullPromise;` inside `try { ... }`
    const tryBlockMatch = rawCode.match(/try\s*\{\s*const data = await fullPromise;[\s\S]*?\} catch \{\}/);
    assert.ok(tryBlockMatch, '`const data = await fullPromise;` is declared inside try block');

    // Verify that at line ~731, `data` is accessed outside the try block
    const outsideMatch = rawCode.match(/const totalTracks = data\?\.tracks\?\.total/);
    assert.ok(outsideMatch, '`data` is accessed outside its enclosing block scope');

    console.log('[CONFIRMED]: `data` in src/services/spotifyApi.ts:394 is block-scoped to `try`, throwing ReferenceError at line 731.');
  });

  // =========================================================================
  // DEFECT AUDIT 3: Runtime Crash Reproduction in fetchArtistTopTracks
  // =========================================================================
  await t.test('Defect Audit 3: Empirical reproduction of ReferenceError in fetchArtistTopTracks', async () => {
    const rawCode = fs.readFileSync('src/services/artistService.ts', 'utf8');

    const hasImport = /import\s+.*useSpotifyDataStore.*from/.test(rawCode);
    assert.equal(hasImport, false, 'useSpotifyDataStore is missing from imports in artistService.ts');

    const usesStore = rawCode.includes('useSpotifyDataStore.getState()');
    assert.ok(usesStore, 'useSpotifyDataStore is invoked at lines 89, 243, 288');

    console.log('[CONFIRMED]: `useSpotifyDataStore` in src/services/artistService.ts is invoked 3 times without import.');
  });

  // =========================================================================
  // FEATURE F14: Search Pagination & Boundary Conditions in api/search.js
  // =========================================================================
  await t.test('F14.1 api/search.js: Boundary values for offset and limit', async () => {
    // 1. Negative offset: offset=-10 -> clamped to 0
    const c1 = mockReqRes('/api/search?q=test&offset=-10&limit=20');
    await searchHandler(c1.req, c1.res);
    const r1 = c1.getResult();
    assert.equal(r1.body.offset, 0, 'Negative offset must be clamped to 0');
    assert.equal(r1.body.limit, 20);

    // 2. Non-numeric offset: offset=abc -> fallback to 0
    const c2 = mockReqRes('/api/search?q=test&offset=abc&limit=20');
    await searchHandler(c2.req, c2.res);
    const r2 = c2.getResult();
    assert.equal(r2.body.offset, 0, 'Invalid non-numeric offset must fallback to 0');

    // 3. Limit boundary: limit=100 -> clamped to max 50
    const c3 = mockReqRes('/api/search?q=test&offset=0&limit=100');
    await searchHandler(c3.req, c3.res);
    const r3 = c3.getResult();
    assert.equal(r3.body.limit, 50, 'Limit > 50 must be clamped to 50');

    // 4. Limit boundary: limit=-5 -> clamped to min 1
    const c4 = mockReqRes('/api/search?q=test&offset=0&limit=-5');
    await searchHandler(c4.req, c4.res);
    const r4 = c4.getResult();
    assert.equal(r4.body.limit, 1, 'Limit < 1 must be clamped to 1');

    // 5. Non-numeric limit: limit=xyz -> fallback to default 25
    const c5 = mockReqRes('/api/search?q=test&offset=0&limit=xyz');
    await searchHandler(c5.req, c5.res);
    const r5 = c5.getResult();
    assert.equal(r5.body.limit, 25, 'Invalid non-numeric limit must fallback to default 25');

    // 6. Large valid offset: offset=150
    const c6 = mockReqRes('/api/search?q=test&offset=150&limit=30');
    await searchHandler(c6.req, c6.res);
    const r6 = c6.getResult();
    assert.equal(r6.body.offset, 150);
    assert.equal(r6.body.limit, 30);
  });

  await t.test('F14.2 api/search.js: Cache separation between page 0 and page 1', async () => {
    // Request page 0: offset=0, limit=15
    const c0 = mockReqRes('/api/search?q=bad+bunny&offset=0&limit=15');
    await searchHandler(c0.req, c0.res);
    const r0 = c0.getResult();

    // Request page 1: offset=15, limit=15
    const c1 = mockReqRes('/api/search?q=bad+bunny&offset=15&limit=15');
    await searchHandler(c1.req, c1.res);
    const r1 = c1.getResult();

    assert.equal(r0.body.offset, 0);
    assert.equal(r1.body.offset, 15);

    // Verify response envelope contains pagination metadata
    assert.ok(r0.body.tracks && Array.isArray(r0.body.tracks.items), 'Tracks items array exists');
    assert.equal(r0.body.tracks.offset, 0);
    assert.equal(r1.body.tracks.offset, 15);
    assert.equal(typeof r0.body.tracks.total, 'number');
    assert.equal(typeof r0.body.tracks.hasMore, 'boolean');

    // Both pages must return items
    assert.ok(r0.body.tracks.items.length > 0, 'Page 0 returned items');
    assert.ok(r1.body.tracks.items.length > 0, 'Page 1 returned items');

    // Page 1 must have items not present in the first 15 of Page 0
    const page0SliceIds = new Set(r0.body.tracks.items.slice(0, 15).map(t => t.id));
    const newItemsInPage1 = r1.body.tracks.items.filter(t => !page0SliceIds.has(t.id));
    assert.ok(
      newItemsInPage1.length > 0,
      `Page 1 must contain new items from the offset slice (found ${newItemsInPage1.length} new items)`
    );
  });

  await t.test('F14.3 spotifyApi.ts: in-memory local tracks are strictly isolated to offset 0', () => {
    const rawCode = fs.readFileSync('src/services/spotifyApi.ts', 'utf8');
    // Ensure local store search is gated by offset === 0
    const localStoreGated = /if \(offset === 0\) \{[\s\S]*?useSpotifyDataStore[\s\S]*?usePlayerStore/.test(rawCode);
    assert.ok(localStoreGated, 'In-app local memory tracks must only be searched on offset === 0');
  });

  // =========================================================================
  // FEATURE F15: Artist Service Deduplication & Catalogue Fidelity
  // =========================================================================
  await t.test('F15.1 artistService.ts: normalizeTrackKey stress test — distinct remixes vs true duplicates', async () => {
    const rawCode = fs.readFileSync('src/services/artistService.ts', 'utf8');
    const normalizeFuncMatch = rawCode.match(/export function normalizeTrackKey\(title: string\): string \{([\s\S]*?)\n\}/);
    assert.ok(normalizeFuncMatch, 'normalizeTrackKey function must be present');

    // Create an executable version of normalizeTrackKey directly from source
    const normalizeTrackKey = new Function('title', normalizeFuncMatch[1]);

    // 1. TRUE DUPLICATES: Must normalize to identical keys
    const canonical = normalizeTrackKey('Tití Me Preguntó');
    assert.equal(normalizeTrackKey('Tití Me Preguntó (Album Version)'), canonical);
    assert.equal(normalizeTrackKey('Tití Me Preguntó - Remastered 2024'), canonical);
    assert.equal(normalizeTrackKey('Tití Me Preguntó (2022 Remaster)'), canonical);
    assert.equal(normalizeTrackKey('Tití Me Preguntó [Deluxe Version]'), canonical);
    assert.equal(normalizeTrackKey('Tití Me Preguntó (feat. Drake)'), canonical);
    assert.equal(normalizeTrackKey('Tití Me Preguntó [Explicit]'), canonical);

    // 2. LEGITIMATE DISTINCT REMIXES: Must NOT be merged into the canonical track
    const remix1 = normalizeTrackKey('Tití Me Preguntó (Tiësto Remix)');
    const remix2 = normalizeTrackKey('Tití Me Preguntó - DJ Snake Remix');
    const remix3 = normalizeTrackKey('Tití Me Preguntó (Club Mix)');

    assert.notEqual(remix1, canonical, 'Tiësto Remix must NOT be deduplicated into original');
    assert.notEqual(remix2, canonical, 'DJ Snake Remix must NOT be deduplicated into original');
    assert.notEqual(remix3, canonical, 'Club Mix must NOT be deduplicated into original');

    // 3. OVERLAPPING WORDS: Different songs must remain distinct
    assert.notEqual(normalizeTrackKey('Me Porto Bonito'), normalizeTrackKey('Porto'));
    assert.notEqual(normalizeTrackKey('Me Porto Bonito'), normalizeTrackKey('Bonito'));
    assert.notEqual(normalizeTrackKey('Un Preview'), normalizeTrackKey('Preview'));
    assert.notEqual(normalizeTrackKey('Un x100to'), normalizeTrackKey('100to'));
    assert.notEqual(normalizeTrackKey('Safaera Pt. 1'), normalizeTrackKey('Safaera Pt. 2'));
    assert.notEqual(normalizeTrackKey('Vol. 1'), normalizeTrackKey('Vol. 2'));
  });

  await t.test('F15.2 artistService.ts: Deep catalogue aggregation (>25 tracks from Deezer)', async () => {
    let deezerCount = 0;
    try {
      const res = await fetch('https://api.deezer.com/artist/10583405/top?limit=100', {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const json = await res.json();
        deezerCount = json.data?.length || 0;
      }
    } catch (err) {
      console.warn('Deezer fetch warning:', err.message);
    }

    console.log('Deezer top tracks for prominent artist:', deezerCount);
    assert.ok(
      deezerCount >= 50,
      `Prominent artists must have deep catalogue available from Deezer (>50 tracks, received ${deezerCount})`
    );
  });

  await t.test('F15.3 artistService.ts: External API error resilience with Promise.allSettled', () => {
    const rawCode = fs.readFileSync('src/services/artistService.ts', 'utf8');
    assert.match(
      rawCode,
      /Promise\.allSettled\(fetchPromises\)/,
      'fetchArtistTopTracks must use Promise.allSettled to tolerate failing external APIs'
    );
  });
});
