import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';

// Register hook to resolve extensionless imports in src/**/*.ts
registerHooks({
  resolve(specifier, context, nextResolve) {
    if ((specifier.startsWith('./') || specifier.startsWith('../')) && !/\.[a-z0-9]+$/i.test(specifier) && context.parentURL) {
      const candidate = new URL(`${specifier}.ts`, context.parentURL);
      if (fs.existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context);
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    const result = nextLoad(url, context);
    if (url.includes('/src/') && /\.ts$/.test(url) && result.source) {
      const src = String(result.source);
      if (src.includes('import.meta.env')) return { ...result, source: src.replaceAll('import.meta.env', '({} as any)') };
    }
    return result;
  },
});

class MockStorage {
  constructor() { this.store = new Map(); }
  getItem(key) { return this.store.has(key) ? this.store.get(key) : null; }
  setItem(key, value) { this.store.set(key, String(value)); }
  removeItem(key) { this.store.delete(key); }
  clear() { this.store.clear(); }
}

globalThis.localStorage = new MockStorage();
globalThis.sessionStorage = new MockStorage();
globalThis.window = globalThis.window || {
  localStorage: globalThis.localStorage,
  sessionStorage: globalThis.sessionStorage,
  dispatchEvent() {},
  addEventListener() {},
  removeEventListener() {},
};

const projectRoot = process.cwd();

test('Adversarial Verification: Milestone 4 (F16, F17, F18) — Challenger 2', async (suite) => {

  // =========================================================================
  // TASK 1: FEATURE F16 (Similar Artist Recommendations)
  // =========================================================================
  await suite.test('F16: Similar Artist Recommendations (/api/discover & Shelves)', async (t) => {
    
    await t.test('F16.1 Backend Discover: Empty or whitespace query returns 400 error', async () => {
      const { default: metadataHandler } = await import('../api/metadata.js');
      
      const testCases = ['', '   ', '\t\n'];
      for (const emptyArtist of testCases) {
        let statusCode = 0;
        let responseJson = null;
        const res = {
          setHeader() {},
          status(code) { statusCode = code; return this; },
          json(data) { responseJson = data; return this; },
        };
        const req = {
          method: 'GET',
          url: `/api/metadata?action=discover&artist=${encodeURIComponent(emptyArtist)}`,
          query: { action: 'discover', artist: emptyArtist },
          headers: { host: 'localhost' },
        };

        await metadataHandler(req, res);
        assert.equal(statusCode, 400, `Expected 400 status for empty artist: "${emptyArtist}"`);
        assert.ok(responseJson?.error, 'Response must include error message');
      }
    });

    await t.test('F16.2 Backend Discover: Unknown artist returns 200 with empty lists and no crash', async () => {
      const { default: metadataHandler } = await import('../api/metadata.js');
      
      let statusCode = 0;
      let responseJson = null;
      let headers = {};
      const res = {
        setHeader(k, v) { headers[k] = v; },
        status(code) { statusCode = code; return this; },
        json(data) { responseJson = data; return this; },
      };
      const req = {
        method: 'GET',
        url: '/api/metadata?action=discover&artist=nonexistent_fictional_artist_xyz_99999',
        query: { action: 'discover', artist: 'nonexistent_fictional_artist_xyz_99999' },
        headers: { host: 'localhost' },
      };

      await metadataHandler(req, res);
      assert.equal(statusCode, 200, 'Expected 200 status for unknown artist');
      assert.equal(responseJson.artist, null, 'Artist should be null for nonexistent artist');
      assert.ok(Array.isArray(responseJson.top), 'top must be an array');
      assert.ok(Array.isArray(responseJson.related), 'related must be an array');
      assert.ok(Array.isArray(responseJson.recent), 'recent must be an array');
      assert.equal(responseJson.related.length, 0, 'related should be empty for nonexistent artist');
      assert.ok(headers['Cache-Control'], 'Cache-Control header must be set');
    });

    await t.test('F16.3 Backend Discover: Special characters and symbols handle cleanly', async () => {
      const { default: metadataHandler } = await import('../api/metadata.js');
      
      const specialArtists = [
        'AC/DC',
        "Guns N' Roses",
        'Tyler, The Creator',
        'P!nk',
        '$uicideboy$',
        'Ke$ha',
        'Rosalía',
        'Bad Bunny 🐰',
        '¿¡#$%',
      ];

      for (const artistName of specialArtists) {
        let statusCode = 0;
        let responseJson = null;
        const res = {
          setHeader() {},
          status(code) { statusCode = code; return this; },
          json(data) { responseJson = data; return this; },
        };
        const req = {
          method: 'GET',
          url: `/api/metadata?action=discover&artist=${encodeURIComponent(artistName)}`,
          query: { action: 'discover', artist: artistName },
          headers: { host: 'localhost' },
        };

        await metadataHandler(req, res);
        assert.equal(statusCode, 200, `Special character artist "${artistName}" must return 200`);
        assert.ok(responseJson, 'Must return a response object');
        assert.ok(Array.isArray(responseJson.related), 'Must return related array');
      }
    });

    await t.test('F16.4 Backend Discover: Related artist items contain string IDs, picture, and name', async () => {
      const metaPath = path.join(projectRoot, 'api', 'metadata.js');
      const metaContent = fs.readFileSync(metaPath, 'utf8');

      // Check string ID conversion in related artists mapping:
      assert.match(
        metaContent,
        /related:\s*rel\.map\(\(r,\s*i\)\s*=>\s*\(\{\s*id:\s*r\.id\s*\?\s*String\(r\.id\)\s*:\s*undefined/,
        'api/metadata.js must convert numeric r.id to string: id: r.id ? String(r.id) : undefined'
      );
      assert.match(
        metaContent,
        /name:\s*r\.name/,
        'api/metadata.js must preserve related artist name'
      );
      assert.match(
        metaContent,
        /picture:\s*r\.picture_xl\s*\|\|\s*r\.picture_big\s*\|\|\s*null/,
        'api/metadata.js must extract high-res picture or null'
      );
      assert.match(
        metaContent,
        /fans:\s*r\.nb_fan\s*\|\|\s*0/,
        'api/metadata.js must extract fans count'
      );
    });

    await t.test('F16.5 Server.mjs routing: /api/discover delegates to metadataHandler with polyfills', () => {
      const serverPath = path.join(projectRoot, 'server.mjs');
      const serverContent = fs.readFileSync(serverPath, 'utf8');

      assert.match(serverContent, /if\s*\(pathname\s*===\s*'\/api\/discover'\)/, 'server.mjs must intercept /api/discover');
      assert.match(serverContent, /const artist = \(reqUrl\.searchParams\.get\('artist'\) \|\| ''\)\.trim\(\);/, 'server.mjs must extract artist param');
      assert.match(serverContent, /if \(!artist\) \{\s*res\.statusCode = 400;/, 'server.mjs must return 400 for empty artist');
      assert.match(serverContent, /req\.query = \{ artist, action: 'discover' \};/, 'server.mjs must forward action: "discover"');
      assert.match(serverContent, /metadataHandler\(req,\s*res\)/, 'server.mjs must delegate to metadataHandler');
    });

    await t.test('F16.6 DesktopPlaylistView: Similar Artists shelf integration & React Rules of Hooks', () => {
      const desktopViewPath = path.join(projectRoot, 'src', 'components', 'desktop', 'DesktopPlaylistView.tsx');
      const content = fs.readFileSync(desktopViewPath, 'utf8');

      // Rules of Hooks: useState and useEffect for similarArtists MUST appear before early return `if (isDJ)`
      const similarStateIdx = content.indexOf('const [similarArtists, setSimilarArtists] = useState');
      const similarEffectIdx = content.indexOf('fetch(`/api/discover?artist=${encodeURIComponent(cleanArtistName)}`)');
      const isDJReturnIdx = content.indexOf('if (isDJ) {');

      assert.ok(similarStateIdx > 0, 'DesktopPlaylistView must declare similarArtists state');
      assert.ok(similarEffectIdx > 0, 'DesktopPlaylistView must fetch /api/discover');
      assert.ok(isDJReturnIdx > 0, 'DesktopPlaylistView must contain if (isDJ) block');

      assert.ok(
        similarStateIdx < isDJReturnIdx,
        'CRITICAL: similarArtists useState MUST be invoked BEFORE if (isDJ) early return (React Rules of Hooks invariant)'
      );
      assert.ok(
        similarEffectIdx < isDJReturnIdx,
        'CRITICAL: similarArtists useEffect MUST be invoked BEFORE if (isDJ) early return (React Rules of Hooks invariant)'
      );

      // Shelf renders only when isArtist is true
      assert.match(
        content,
        /\{isArtist\s*&&\s*\(similarArtists\.length\s*>\s*0\s*\|\|\s*isLoadingSimilar\)\s*&&/,
        'DesktopPlaylistView must guard shelf strictly with isArtist === true'
      );
      assert.match(content, /Fans también escuchan/, 'DesktopPlaylistView must display "Fans también escuchan"');

      // Click navigates via onSelectPlaylistById with art- ID
      assert.match(
        content,
        /const artId = relArtist\.id\s*\?\s*`art-\$\{relArtist\.id\}`\s*:\s*`art-\$\{relArtist\.name\.toLowerCase\(\)\.replace\(\/\[\\s&\]\+\/g,\s*'-'\)\}`;/,
        'DesktopPlaylistView must construct art- prefixed ID'
      );
      assert.match(
        content,
        /onSelectPlaylistById\?\.\(artId,\s*relArtist\.name,\s*relArtist\.picture\s*\|\|\s*undefined\)/,
        'DesktopPlaylistView must navigate via onSelectPlaylistById'
      );

      // Avatar fallback when picture is missing
      assert.match(
        content,
        /\{relArtist\.picture\s*\?[\s\S]*?<img[\s\S]*?\/>[\s\S]*?:[\s\S]*?\{relArtist\.name\.charAt\(0\)\.toUpperCase\(\)\}/,
        'DesktopPlaylistView must render fallback avatar with first initial when picture is missing'
      );

      // Formatting of fans count
      assert.match(
        content,
        /relArtist\.fans\s*>=?\s*1000000\s*\?\s*`\$\{\(relArtist\.fans\s*\/\s*1000000\)\.toFixed\(1\)\}\s*M\s*oyentes`/,
        'DesktopPlaylistView must format millions of listeners'
      );
      assert.match(
        content,
        /`\$\{Math\.round\(relArtist\.fans\s*\/\s*1000\)\}\s*mil\s*oyentes`/,
        'DesktopPlaylistView must format thousands of listeners'
      );
    });

    await t.test('F16.7 MobilePlaylistView: Similar Artists shelf integration & Fallbacks', () => {
      const mobileViewPath = path.join(projectRoot, 'src', 'components', 'mobile', 'MobilePlaylistView.tsx');
      const content = fs.readFileSync(mobileViewPath, 'utf8');

      assert.match(
        content,
        /onSelectPlaylistById\?: \(id: string, name\?: string, image\?: string\) => void;/,
        'MobilePlaylistViewProps must declare onSelectPlaylistById'
      );
      assert.match(
        content,
        /\{isArtist\s*&&\s*\(similarArtists\.length\s*>\s*0\s*\|\|\s*isLoadingSimilar\)\s*&&/,
        'MobilePlaylistView must guard shelf strictly with isArtist === true'
      );
      assert.match(content, /Fans también escuchan/, 'MobilePlaylistView must display "Fans también escuchan"');
      assert.match(
        content,
        /onSelectPlaylistById\?\.\(artId,\s*relArtist\.name,\s*relArtist\.picture\s*\|\|\s*undefined\)/,
        'MobilePlaylistView must navigate via onSelectPlaylistById'
      );

      // Avatar fallback
      assert.match(
        content,
        /\{relArtist\.picture\s*\?[\s\S]*?<img[\s\S]*?\/>[\s\S]*?:[\s\S]*?\{relArtist\.name\.charAt\(0\)\.toUpperCase\(\)\}/,
        'MobilePlaylistView must render fallback avatar with first initial when picture is missing'
      );
    });
  });

  // =========================================================================
  // TASK 2: FEATURE F17 (Daily Rotating Playlist Recommendations)
  // =========================================================================
  await suite.test('F17: Daily Rotating Playlist Recommendations (src/services/recommendations.ts)', async (t) => {
    const {
      todayRecommendationKey,
      hashSeed,
      seededShuffle,
      getDailyRotatingPlaylists,
      buildDailyRotatingShelf,
      fetchDailyRotatingShelves,
      CURATED_RECOMMENDATION_POOL,
    } = await import('../src/services/recommendations.ts');

    await t.test('F17.1 Determinism: 100 consecutive calls with identical date yield identical output', () => {
      const fixedDate = new Date(2026, 10, 13);
      const referenceCards = getDailyRotatingPlaylists(fixedDate, 8);
      assert.equal(referenceCards.length, 8, 'Must return exactly 8 cards');

      for (let i = 0; i < 100; i++) {
        const testCards = getDailyRotatingPlaylists(fixedDate, 8);
        assert.deepEqual(
          testCards,
          referenceCards,
          `Call ${i + 1} did not match reference cards! Determinism failure.`
        );
      }

      const referenceShelf = buildDailyRotatingShelf(fixedDate);
      for (let i = 0; i < 100; i++) {
        const testShelf = buildDailyRotatingShelf(fixedDate);
        assert.deepEqual(
          testShelf,
          referenceShelf,
          `Shelf call ${i + 1} did not match reference shelf! Determinism failure.`
        );
      }
    });

    await t.test('F17.2 Daily Rotation: Consecutive days produce distinct card sets/orderings', () => {
      const days = [
        new Date(2026, 10, 13), // Nov 13, 2026
        new Date(2026, 10, 14), // Nov 14, 2026
        new Date(2026, 10, 15), // Nov 15, 2026
        new Date(2026, 10, 16), // Nov 16, 2026
        new Date(2026, 10, 20), // Nov 20, 2026
        new Date(2026, 11, 13), // Dec 13, 2026
        new Date(2027, 10, 13), // Nov 13, 2027
      ];

      const serializedShelves = days.map((d) => {
        const cards = getDailyRotatingPlaylists(d, 8);
        return cards.map((c) => c.id).join('|');
      });

      // Verify that every consecutive pair of days produces a distinct rotation
      for (let i = 0; i < serializedShelves.length - 1; i++) {
        assert.notEqual(
          serializedShelves[i],
          serializedShelves[i + 1],
          `Day ${i + 1} and Day ${i + 2} produced the identical playlist ordering!`
        );
      }

      // Check unique permutations across the test days
      const uniqueRotations = new Set(serializedShelves);
      assert.equal(
        uniqueRotations.size,
        days.length,
        'All tested distinct dates must produce unique rotating playlists'
      );
    });

    await t.test('F17.3 Robustness & Edge Cases: Undefined, Invalid Dates, and Null inputs', () => {
      // 1. Undefined date (omitted parameter) defaults cleanly to today
      const defaultCall = getDailyRotatingPlaylists(undefined, 8);
      assert.equal(defaultCall.length, 8, 'Default date call must return 8 cards');
      
      const noArgCall = getDailyRotatingPlaylists();
      assert.equal(noArgCall.length, 8, 'No argument call must return 8 cards');

      // 2. Invalid Date (e.g. new Date(NaN)) must handle safely without uncaught exception
      const invalidDate = new Date(NaN);
      const invalidKey = todayRecommendationKey(invalidDate);
      assert.equal(typeof invalidKey, 'string', 'Invalid date returns string key');
      assert.ok(invalidKey.includes('NaN'), 'Invalid date key contains NaN parts');
      
      const cardsFromInvalid = getDailyRotatingPlaylists(invalidDate, 8);
      assert.equal(cardsFromInvalid.length, 8, 'getDailyRotatingPlaylists with invalid Date must not crash and return 8 cards');

      // 3. Null input verification:
      // Note: in TS signature date = new Date(), passing explicit null bypasses default parameter in JS.
      // We empirically verify whether todayRecommendationKey(null) throws or is caught.
      let nullThrew = false;
      try {
        todayRecommendationKey(null);
      } catch (err) {
        nullThrew = true;
        assert.ok(err instanceof TypeError, 'Passing null to todayRecommendationKey throws TypeError as expected in JS');
      }
      assert.ok(nullThrew, 'Empirically verified that explicit null input throws TypeError on .getFullYear()');
    });

    await t.test('F17.4 Count parameter boundaries: 0, 1, 4, 8, 20, and oversized count', () => {
      const fixedDate = new Date(2026, 10, 13);

      assert.equal(getDailyRotatingPlaylists(fixedDate, 0).length, 0, 'count=0 returns empty array');
      assert.equal(getDailyRotatingPlaylists(fixedDate, 1).length, 1, 'count=1 returns 1 card');
      assert.equal(getDailyRotatingPlaylists(fixedDate, 4).length, 4, 'count=4 returns 4 cards');
      assert.equal(getDailyRotatingPlaylists(fixedDate, 8).length, 8, 'count=8 returns 8 cards');
      assert.equal(getDailyRotatingPlaylists(fixedDate, 20).length, 20, 'count=20 returns 20 cards');

      // Oversized count should return available pool length without crashing or returning undefined
      const poolLen = CURATED_RECOMMENDATION_POOL.length;
      const oversized = getDailyRotatingPlaylists(fixedDate, 100);
      assert.equal(oversized.length, poolLen, 'Oversized count must be bounded by pool size');
      oversized.forEach((c, idx) => {
        assert.ok(c && c.id && c.title, `Item ${idx} in oversized result must be valid card`);
      });
    });

    await t.test('F17.5 Pool and Card Interface Conformance: DynamicShelfCard validation', () => {
      assert.ok(CURATED_RECOMMENDATION_POOL.length >= 20, 'Curated pool must have at least 20 playlists');

      const allowedGenres = new Set([
        'urban_latin',
        'pop_charts',
        'rock_indie',
        'discovery_new',
        'chill_electronic',
      ]);

      for (const entry of CURATED_RECOMMENDATION_POOL) {
        assert.ok(typeof entry.id === 'string' && entry.id.length > 0, `Pool entry id invalid: ${entry.id}`);
        assert.ok(typeof entry.title === 'string' && entry.title.length > 0, `Pool entry title invalid: ${entry.title}`);
        assert.ok(typeof entry.subtitle === 'string' && entry.subtitle.length > 0, `Pool entry subtitle invalid: ${entry.subtitle}`);
        assert.ok(typeof entry.image === 'string' && entry.image.startsWith('http'), `Pool entry image invalid URL: ${entry.image}`);
        assert.ok(allowedGenres.has(entry.genre), `Pool entry genre invalid: ${entry.genre}`);
      }

      // Check generated shelf cards
      const shelf = buildDailyRotatingShelf(new Date(2026, 10, 13));
      assert.equal(shelf.id, 'shelf-daily-recommendations');
      assert.equal(shelf.title, 'Recomendaciones del día');
      assert.equal(shelf.prefix, 'Para hoy');
      assert.equal(shelf.type, 'featured');
      assert.equal(shelf.hasSeeAll, true);

      for (const card of shelf.cards) {
        assert.ok(typeof card.id === 'string' && card.id.length > 0, 'Card id must be non-empty string');
        assert.ok(typeof card.title === 'string' && card.title.length > 0, 'Card title must be non-empty string');
        assert.ok(typeof card.subtitle === 'string' && card.subtitle.length > 0, 'Card subtitle must be non-empty string');
        assert.ok(typeof card.image === 'string' && card.image.startsWith('http'), 'Card image must be non-empty HTTPS URL');
      }
    });

    await t.test('F17.6 Live Enrichment & Local Storage Cache Fallback', async () => {
      const fixedDate = new Date(2026, 10, 13);
      const day = todayRecommendationKey(fixedDate);
      const cacheKey = `spotifree_daily_recs_${day}`;

      globalThis.localStorage.clear();

      // Test with corrupted JSON in cache: must not throw and fall back to base shelf
      globalThis.localStorage.setItem(cacheKey, '{ corrupted json :::: ');
      const fallbackShelves = await fetchDailyRotatingShelves(fixedDate);
      assert.ok(Array.isArray(fallbackShelves), 'Must return array of shelves despite corrupt cache');
      assert.equal(fallbackShelves[0].id, 'shelf-daily-recommendations');

      // Test with valid cached shelf in localStorage
      const cachedPayload = {
        day,
        shelves: [
          {
            id: 'shelf-daily-recommendations',
            title: 'Recomendaciones del día (Cached)',
            cards: [{ id: 'test-cached-1', title: 'Cached Playlist', subtitle: 'Sub', image: 'https://test.com/img.jpg' }],
          },
        ],
      };
      globalThis.localStorage.setItem(cacheKey, JSON.stringify(cachedPayload));

      const fromCache = await fetchDailyRotatingShelves(fixedDate);
      assert.equal(fromCache[0].title, 'Recomendaciones del día (Cached)', 'Must return cached shelf on cache hit');

      globalThis.localStorage.clear();
    });
  });

  // =========================================================================
  // TASK 3: FEATURE F18 (Ambient Cinema Backdrop Effect)
  // =========================================================================
  await suite.test('F18: Ambient Cinema Backdrop Effect (src/components/playlist/PlaylistClipsMiniPlayer.tsx)', async (t) => {
    const playerPath = path.join(projectRoot, 'src', 'components', 'playlist', 'PlaylistClipsMiniPlayer.tsx');
    assert.ok(fs.existsSync(playerPath), 'PlaylistClipsMiniPlayer.tsx must exist');
    const content = fs.readFileSync(playerPath, 'utf8');

    await t.test('F18.1 Ambient Video Glow: Rendered when canvasUrl is provided', () => {
      // Check conditional rendering
      assert.match(
        content,
        /\{canvasUrl\s*\?\s*\(\s*<video[\s\S]*?ref=\{ambientVideoRef\}[\s\S]*?\/>\s*\)\s*:\s*\(\s*<img[\s\S]*?key=\{`ambient-glow-\$\{currentTrack\.id\}`\}[\s\S]*?\/>\s*\)\}/,
        'Must conditionally render <video> glow when canvasUrl exists, and <img> glow fallback otherwise'
      );
    });

    await t.test('F18.2 Video Attributes: autoPlay, loop, muted, playsInline, and exact CSS blur/scale/opacity classes', () => {
      // Find the ambient video element block
      const ambientVideoBlockMatch = content.match(/<video[\s\S]*?ref=\{ambientVideoRef\}[\s\S]*?\/>/);
      assert.ok(ambientVideoBlockMatch, 'Ambient video element must exist in source');
      const ambientVideoBlock = ambientVideoBlockMatch[0];

      assert.match(ambientVideoBlock, /ref=\{ambientVideoRef\}/, 'Ambient video must use ref ambientVideoRef');
      assert.match(ambientVideoBlock, /key=\{`ambient-video-\$\{canvasUrl\}`\}/, 'Ambient video must use key with canvasUrl');
      assert.match(ambientVideoBlock, /src=\{canvasUrl\}/, 'Ambient video must set src={canvasUrl}');
      assert.match(ambientVideoBlock, /\bautoPlay\b/, 'Ambient video must have autoPlay attribute');
      assert.match(ambientVideoBlock, /\bloop\b/, 'Ambient video must have loop attribute');
      assert.match(ambientVideoBlock, /\bmuted\b/, 'Ambient video must have muted attribute');
      assert.match(ambientVideoBlock, /\bplaysInline\b/, 'Ambient video must have playsInline attribute');

      // Check required visual styling: blur-[100px] scale-150 opacity-60 pointer-events-none
      assert.match(ambientVideoBlock, /blur-\[100px\]/, 'Ambient video must have blur-[100px]');
      assert.match(ambientVideoBlock, /scale-150/, 'Ambient video must have scale-150');
      assert.match(ambientVideoBlock, /opacity-60/, 'Ambient video must have opacity-60');
      assert.match(ambientVideoBlock, /pointer-events-none/, 'Ambient video must have pointer-events-none');
      assert.match(ambientVideoBlock, /object-cover/, 'Ambient video must have object-cover');
    });

    await t.test('F18.3 Clean Fallback: Image glow rendered when canvasUrl is null or empty', () => {
      const imgBlockMatch = content.match(/<img[\s\S]*?key=\{`ambient-glow-\$\{currentTrack\.id\}`\}[\s\S]*?\/>/);
      assert.ok(imgBlockMatch, 'Fallback ambient img element must exist in source');
      const imgBlock = imgBlockMatch[0];

      assert.match(imgBlock, /src=\{coverUrl\}/, 'Fallback img must set src={coverUrl}');
      assert.match(imgBlock, /alt=""/, 'Fallback img must have empty alt attribute for decorative background');
      assert.match(imgBlock, /blur-\[140px\]/, 'Fallback img must have blur-[140px]');
      assert.match(imgBlock, /opacity-25/, 'Fallback img must have opacity-25');
      assert.match(imgBlock, /scale-125/, 'Fallback img must have scale-125');
      assert.match(imgBlock, /pointer-events-none/, 'Fallback img must have pointer-events-none');
    });

    await t.test('F18.4 Dual Video Synchronization & Drift Compensation', () => {
      // Play/Pause sync
      assert.match(
        content,
        /useEffect\(\(\) => \{[\s\S]*?if \(mainVideoRef\.current\) \{[\s\S]*?if \(isPaused\) \{[\s\S]*?mainVideoRef\.current\.pause\(\);[\s\S]*?\} else \{[\s\S]*?mainVideoRef\.current\.play\(\)/,
        'Must synchronize play/pause state for main video'
      );
      assert.match(
        content,
        /if \(ambientVideoRef\.current\) \{[\s\S]*?if \(isPaused\) \{[\s\S]*?ambientVideoRef\.current\.pause\(\);[\s\S]*?\} else \{[\s\S]*?ambientVideoRef\.current\.play\(\)/,
        'Must synchronize play/pause state for ambient video'
      );

      // Drift compensation
      assert.match(
        content,
        /const handleVideoTimeUpdate = \(\) => \{[\s\S]*?const delta = Math\.abs\(mainVideoRef\.current\.currentTime - ambientVideoRef\.current\.currentTime\);[\s\S]*?if \(delta > 0\.15\) \{[\s\S]*?ambientVideoRef\.current\.currentTime = mainVideoRef\.current\.currentTime;[\s\S]*?\}/,
        'handleVideoTimeUpdate must compensate for drift > 0.15s between main and ambient videos'
      );

      // Main video wire-up
      assert.match(
        content,
        /<video[\s\S]*?ref=\{mainVideoRef\}[\s\S]*?onTimeUpdate=\{handleVideoTimeUpdate\}[\s\S]*?\/>/,
        'Main video must wire onTimeUpdate to handleVideoTimeUpdate'
      );
    });
  });
});
