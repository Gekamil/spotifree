import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';

// Allow Node to load the app's .ts files by their extension-less imports
registerHooks({
  resolve(specifier, context, nextResolve) {
    if ((specifier.startsWith('./') || specifier.startsWith('../')) && !/\.[a-z0-9]+$/i.test(specifier) && context.parentURL) {
      for (const ext of ['.ts', '.tsx', '.js', '.mjs']) {
        const candidate = new URL(`${specifier}${ext}`, context.parentURL);
        if (fs.existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context);
      }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.endsWith('.tsx') || (url.includes('/src/') && url.endsWith('.ts'))) {
      const code = fs.readFileSync(fileURLToPath(url), 'utf8');
      const transpiled = ts.transpileModule(code, {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.ReactJSX,
        },
      });
      return { format: 'module', source: transpiled.outputText.replaceAll('import.meta.env', '({} as any)'), shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});

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
globalThis.window.localStorage = globalThis.localStorage;
globalThis.window.sessionStorage = globalThis.sessionStorage;
if (typeof globalThis.CustomEvent === 'undefined') {
  globalThis.CustomEvent = class CustomEvent extends Event {
    constructor(t, o) { super(t); this.detail = o?.detail; }
  };
}

const projectRoot = process.cwd();

test('Milestone 4 — Features F14-F18: Search Pagination, Artist Profiles & Recommendations', async (t) => {
  // =========================================================================
  // FEATURE F14: Search Pagination & Infinite Scroll
  // =========================================================================
  await t.test('F14.1 Backend Search API: api/search.js parses offset & limit and uses paginated cache key', () => {
    const apiSearchPath = path.join(projectRoot, 'api', 'search.js');
    assert.ok(fs.existsSync(apiSearchPath), 'api/search.js must exist');
    const content = fs.readFileSync(apiSearchPath, 'utf8');

    assert.match(content, /const offset = Math\.max\(0,\s*parseInt\(url\.searchParams\.get\('offset'\)/, 'api/search.js must parse offset parameter');
    assert.match(content, /const limit = Math\.min\(50,\s*Math\.max\(1,\s*parseInt\(url\.searchParams\.get\('limit'\)/, 'api/search.js must parse and clamp limit parameter');
    assert.match(content, /const baseCacheKey = `\$\{q\.toLowerCase\(\)\}:\$\{offset\}:\$\{limit\}`;/, 'api/search.js must incorporate offset and limit into baseCacheKey');
    assert.match(content, /index=\$\{offset\}/, 'api/search.js must pass index=${offset} to Deezer');
    assert.match(content, /soundcloudTracks:\s*\{\s*items:\s*orderedRemixItems\s*\}/, 'api/search.js must preserve official remixes invariant');
  });

  await t.test('F14.2 Server Backend: server.mjs parses offset & limit and routes paginated upstream requests', () => {
    const serverPath = path.join(projectRoot, 'server.mjs');
    assert.ok(fs.existsSync(serverPath), 'server.mjs must exist');
    const content = fs.readFileSync(serverPath, 'utf8');

    assert.match(content, /const offset = Math\.max\(0,\s*parseInt\(reqUrl\.searchParams\.get\('offset'\)/, 'server.mjs must parse offset parameter');
    assert.match(content, /const limit = Math\.min\(50,\s*Math\.max\(1,\s*parseInt\(reqUrl\.searchParams\.get\('limit'\)/, 'server.mjs must parse limit parameter');
    assert.match(content, /limit=\$\{limit\}&offset=\$\{offset\}/, 'server.mjs must pass limit and offset to Spotify Web API');
    assert.match(content, /limit=\$\{limit\}&index=\$\{offset\}/, 'server.mjs must pass limit and index to Deezer');
  });

  await t.test('F14.3 Client Search Service: src/services/spotifyApi.ts supports offset & limit options and paginated cache', () => {
    const servicePath = path.join(projectRoot, 'src', 'services', 'spotifyApi.ts');
    assert.ok(fs.existsSync(servicePath), 'src/services/spotifyApi.ts must exist');
    const content = fs.readFileSync(servicePath, 'utf8');

    assert.match(content, /offset\?: number;/, 'SearchSpotifyOptions must include optional offset');
    assert.match(content, /limit\?: number;/, 'SearchSpotifyOptions must include optional limit');
    assert.match(content, /const cacheKey = `\$\{\(normalizedQ \|\| cleanQ\)\.toLowerCase\(\)\}:\$\{offset\}:\$\{limit\}`;/, 'spotifyApi.ts must key client cache by query, offset, and limit');
    assert.match(content, /offset=\$\{offset\}&limit=\$\{limit\}/, 'spotifyApi.ts must forward offset and limit to backend search');
    assert.match(content, /if \(offset === 0\) \{[\s\S]*?\/\/ 1\. Search in-app loaded playlists/, 'spotifyApi.ts must skip local in-memory tracks on offset > 0');
  });

  await t.test('F14.4 Desktop View Infinite Scroll: src/components/desktop/DesktopSearchView.tsx', () => {
    const desktopPath = path.join(projectRoot, 'src', 'components', 'desktop', 'DesktopSearchView.tsx');
    assert.ok(fs.existsSync(desktopPath), 'DesktopSearchView.tsx must exist');
    const content = fs.readFileSync(desktopPath, 'utf8');

    assert.match(content, /const \[hasMore, setHasMore\] = useState\(true\);/, 'DesktopSearchView must track hasMore state');
    assert.match(content, /const \[isLoadingMore, setIsLoadingMore\] = useState\(false\);/, 'DesktopSearchView must track isLoadingMore state');
    assert.match(content, /const sentinelRef = useRef<HTMLDivElement \| null>\(null\);/, 'DesktopSearchView must track sentinelRef');
    assert.match(content, /const loadMore = useCallback\(async \(\) =>/, 'DesktopSearchView must implement loadMore callback');
    assert.match(content, /new IntersectionObserver/, 'DesktopSearchView must observe sentinel with IntersectionObserver');
    assert.match(content, /ref=\{sentinelRef\}/, 'DesktopSearchView must render sentinel element');
  });

  await t.test('F14.5 Mobile View Infinite Scroll: src/components/mobile/MobileSearchView.tsx', () => {
    const mobilePath = path.join(projectRoot, 'src', 'components', 'mobile', 'MobileSearchView.tsx');
    assert.ok(fs.existsSync(mobilePath), 'MobileSearchView.tsx must exist');
    const content = fs.readFileSync(mobilePath, 'utf8');

    assert.match(content, /const \[hasMore, setHasMore\] = useState\(true\);/, 'MobileSearchView must track hasMore state');
    assert.match(content, /const \[isLoadingMore, setIsLoadingMore\] = useState\(false\);/, 'MobileSearchView must track isLoadingMore state');
    assert.match(content, /const sentinelRef = useRef<HTMLDivElement \| null>\(null\);/, 'MobileSearchView must track sentinelRef');
    assert.match(content, /const loadMore = useCallback\(async \(\) =>/, 'MobileSearchView must implement loadMore callback');
    assert.match(content, /new IntersectionObserver/, 'MobileSearchView must observe sentinel with IntersectionObserver');
    assert.match(content, /ref=\{sentinelRef\}/, 'MobileSearchView must render sentinel element');

    // Preserved invariants:
    assert.match(content, /results\.soundcloudTracks\.slice\(0,\s*filter\s*===\s*'todo'\s*\?\s*4\s*:\s*50\)/, 'MobileSearchView must strictly preserve remix tab invariant');
    assert.match(content, /\(filter === 'todo' \? results\.tracks\.slice\(0, 5\) : results\.tracks\)\.map/, 'MobileSearchView must remove 20-track cap in dedicated canciones filter');
  });

  // =========================================================================
  // FEATURE F15: Complete Artist Profile Track Catalogue
  // =========================================================================
  await t.test('F15.1 Artist Service: normalizeTrackKey canonical deduplication', async () => {
    const { normalizeTrackKey } = await import('../src/services/artistService.ts');
    assert.equal(typeof normalizeTrackKey, 'function', 'normalizeTrackKey must be exported');

    // Strips remaster parentheticals and years
    assert.equal(normalizeTrackKey('Bohemian Rhapsody - Remastered 2011'), 'bohemian rhapsody');
    assert.equal(normalizeTrackKey('Tití Me Preguntó (Album Version)'), 'titi me pregunto');
    assert.equal(normalizeTrackKey('Starman (2012 Remaster)'), 'starman');
    assert.equal(normalizeTrackKey('Despacito (feat. Daddy Yankee)'), 'despacito');
    assert.equal(normalizeTrackKey('Quédate [Radio Edit]'), 'quedate');
  });

  await t.test('F15.2 Artist Service: fetchArtistTopTracks uses Promise.allSettled and multi-source parallel aggregation', () => {
    const servicePath = path.join(projectRoot, 'src', 'services', 'artistService.ts');
    const content = fs.readFileSync(servicePath, 'utf8');

    assert.match(content, /Promise\.allSettled\(fetchPromises\)/, 'fetchArtistTopTracks must aggregate all sources with Promise.allSettled');
    assert.match(content, /\/artist\/\$\{resolvedId\}\/top\?limit=100/, 'fetchArtistTopTracks must request Deezer top 100');
    assert.match(content, /search\?q=artist:"\$\{encodeURIComponent\(cleanName\)\}"&limit=100/, 'fetchArtistTopTracks must query Deezer artist search with limit 100');
    assert.match(content, /\/api\/discover\?artist=/, 'fetchArtistTopTracks must query Backend Discovery API');
    assert.match(content, /normalizeTrackKey\(track\.name\)/, 'fetchArtistTopTracks must deduplicate tracks with normalizeTrackKey');
  });

  // =========================================================================
  // FEATURE F16: Similar Artist Recommendations
  // =========================================================================
  await t.test('F16.1 Backend Discover Routing: server.mjs & api/metadata.js', () => {
    const serverPath = path.join(projectRoot, 'server.mjs');
    const serverContent = fs.readFileSync(serverPath, 'utf8');
    assert.match(serverContent, /if \(pathname === '\/api\/discover'\)/, 'server.mjs must route /api/discover');

    const metaPath = path.join(projectRoot, 'api', 'metadata.js');
    const metaContent = fs.readFileSync(metaPath, 'utf8');
    assert.match(metaContent, /id:\s*r\.id\s*\?\s*String\(r\.id\)\s*:\s*undefined/, 'api/metadata.js must return id in related artists');
  });

  await t.test('F16.2 Desktop & Mobile Playlist Views render Similar Artists shelf when isArtist is true', () => {
    const desktopPath = path.join(projectRoot, 'src', 'components', 'desktop', 'DesktopPlaylistView.tsx');
    const desktopContent = fs.readFileSync(desktopPath, 'utf8');
    assert.match(desktopContent, /Fans también escuchan/, 'DesktopPlaylistView must render "Fans también escuchan" header');
    assert.match(desktopContent, /fetch\(`\/api\/discover\?artist=\$\{encodeURIComponent\(cleanArtistName\)\}`\)/, 'DesktopPlaylistView must fetch /api/discover for similar artists');

    const mobilePath = path.join(projectRoot, 'src', 'components', 'mobile', 'MobilePlaylistView.tsx');
    const mobileContent = fs.readFileSync(mobilePath, 'utf8');
    assert.match(mobileContent, /Fans también escuchan/, 'MobilePlaylistView must render "Fans también escuchan" header');
    assert.match(mobileContent, /fetch\(`\/api\/discover\?artist=\$\{encodeURIComponent\(cleanArtistName\)\}`\)/, 'MobilePlaylistView must fetch /api/discover for similar artists');
    assert.match(mobileContent, /onSelectPlaylistById\?: \(id: string, name\?: string, image\?: string\) => void;/, 'MobilePlaylistViewProps must support onSelectPlaylistById');
  });

  // =========================================================================
  // FEATURE F17: Daily Rotating Playlist Recommendations
  // =========================================================================
  await t.test('F17.1 Recommendations Service: Deterministic daily rotation and genre balancing', async () => {
    const {
      todayRecommendationKey,
      hashSeed,
      seededShuffle,
      getDailyRotatingPlaylists,
      buildDailyRotatingShelf,
      CURATED_RECOMMENDATION_POOL,
    } = await import('../src/services/recommendations.ts');

    assert.ok(CURATED_RECOMMENDATION_POOL.length >= 15, 'Curated pool must have >= 15 diverse playlists');

    // Date formatting
    const d1 = new Date(2026, 10, 13); // Nov 13, 2026
    const d2 = new Date(2026, 10, 14); // Nov 14, 2026
    assert.equal(todayRecommendationKey(d1), '2026-11-13');
    assert.equal(todayRecommendationKey(d2), '2026-11-14');

    // Deterministic hash
    assert.equal(hashSeed('2026-11-13'), hashSeed('2026-11-13'));
    assert.notEqual(hashSeed('2026-11-13'), hashSeed('2026-11-14'));

    // Shuffling
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const s1 = seededShuffle(items, 12345);
    const s2 = seededShuffle(items, 12345);
    assert.deepEqual(s1, s2, 'Seeded shuffle must be deterministic');

    // Daily rotating shelf
    const shelf1 = buildDailyRotatingShelf(d1);
    const shelf2 = buildDailyRotatingShelf(d2);
    assert.equal(shelf1.id, 'shelf-daily-recommendations');
    assert.equal(shelf1.cards.length, 8);
    assert.equal(shelf2.cards.length, 8);

    // Cards should rotate deterministically across different days
    const ids1 = shelf1.cards.map((c) => c.id).join(',');
    const ids2 = shelf2.cards.map((c) => c.id).join(',');
    assert.notEqual(ids1, ids2, 'Playlists must rotate across different calendar days');
  });

  await t.test('F17.2 Integration in Spotify Data Store: buildExtractedShelves includes daily shelf', async () => {
    const storePath = path.join(projectRoot, 'src', 'store', 'useSpotifyDataStore.ts');
    assert.ok(fs.existsSync(storePath), 'useSpotifyDataStore.ts must exist');
    const content = fs.readFileSync(storePath, 'utf8');

    assert.match(
      content,
      /import \{ buildDailyRotatingShelf \} from '\.\.\/services\/recommendations';/,
      'useSpotifyDataStore must import buildDailyRotatingShelf'
    );
    assert.match(
      content,
      /export function buildExtractedShelves\(/,
      'useSpotifyDataStore must export buildExtractedShelves'
    );
    assert.match(
      content,
      /const dailyShelf = buildDailyRotatingShelf\(\);/,
      'buildExtractedShelves must call buildDailyRotatingShelf'
    );
    assert.match(
      content,
      /return\s*\[\s*dailyShelf,\s*\.\.\.DEFAULT_PUBLIC_SHELVES\s*\];/,
      'buildExtractedShelves must prepend dailyShelf before default shelves'
    );

    // Verify buildDailyRotatingShelf output structure
    const { buildDailyRotatingShelf } = await import('../src/services/recommendations.ts');
    const shelf = buildDailyRotatingShelf();
    assert.equal(shelf.id, 'shelf-daily-recommendations');
    assert.ok(shelf.cards.length > 0, 'Daily shelf must contain playlist cards');
  });

  // =========================================================================
  // FEATURE F18: Ambient Cinema Backdrop Effect
  // =========================================================================
  await t.test('F18.1 Ambient Cinema Backdrop in PlaylistClipsMiniPlayer.tsx', () => {
    const playerPath = path.join(projectRoot, 'src', 'components', 'playlist', 'PlaylistClipsMiniPlayer.tsx');
    assert.ok(fs.existsSync(playerPath), 'PlaylistClipsMiniPlayer.tsx must exist');
    const content = fs.readFileSync(playerPath, 'utf8');

    assert.match(content, /ambientVideoRef/, 'PlaylistClipsMiniPlayer must define ambientVideoRef');
    assert.match(content, /mainVideoRef/, 'PlaylistClipsMiniPlayer must define mainVideoRef');
    assert.match(
      content,
      /filter blur-\[100px\] scale-150 opacity-60 pointer-events-none/,
      'PlaylistClipsMiniPlayer must apply ambient cinema video styling'
    );
    assert.match(
      content,
      /onTimeUpdate=\{handleVideoTimeUpdate\}/,
      'PlaylistClipsMiniPlayer must synchronize time updates to prevent drift'
    );
  });
});
