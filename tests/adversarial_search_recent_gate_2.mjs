/**
 * Adversarial Stress & Verification Test Suite for Gate 2
 * Requirement R2: Dynamic Search & High-Resolution Studio Artwork (without hardcoding)
 * Requirement R3: Spotify Recent Searches UX & LocalStorage Robustness
 *
 * Uses native Node test runner (node:test & node:assert/strict).
 */

import { describe, it, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// ============================================================================
// Setup Mock Browser Environment for recentSearches.ts
// ============================================================================

class MockLocalStorage {
  constructor() {
    this.store = new Map();
    this.failOnSet = false;
  }

  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }

  setItem(key, value) {
    if (this.failOnSet) {
      const err = new Error('QuotaExceededError');
      err.name = 'QuotaExceededError';
      throw err;
    }
    this.store.set(key, String(value));
  }

  removeItem(key) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }

  get length() {
    return this.store.size;
  }
}

class MockCustomEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.detail = init.detail;
  }
}

const mockStorage = new MockLocalStorage();
const eventListeners = new Map();

globalThis.window = {
  localStorage: mockStorage,
  addEventListener(type, listener) {
    if (!eventListeners.has(type)) eventListeners.set(type, []);
    eventListeners.get(type).push(listener);
  },
  removeEventListener(type, listener) {
    if (eventListeners.has(type)) {
      eventListeners.set(
        type,
        eventListeners.get(type).filter((l) => l !== listener)
      );
    }
  },
  dispatchEvent(event) {
    const list = eventListeners.get(event.type) || [];
    for (const cb of list) {
      cb(event);
    }
    return true;
  },
};

globalThis.CustomEvent = MockCustomEvent;

// Module handles
let recentSearches;
let audioService;

before(async () => {
  recentSearches = await import('../src/utils/recentSearches.ts');
  audioService = await import('../scripts/audioService.mjs');
});

beforeEach(() => {
  mockStorage.clear();
  mockStorage.failOnSet = false;
  eventListeners.clear();
});

// ============================================================================
// SUITE 1: Requirement R2 — Dynamic Search without Hardcoding
// ============================================================================

describe('Suite 1: Requirement R2 — Dynamic Search & Studio Artwork (Adversarial Verification)', () => {
  const SEARCH_ENDPOINT = 'http://127.0.0.1:5173/api/spotify/search';

  // 1. Exact Query Variations
  describe('1.1 Exact Query Variations', () => {
    it('Query "doggy" dynamically resolves track "DOGGY" with studio master artwork', async () => {
      const res = await fetch(`${SEARCH_ENDPOINT}?q=doggy`);
      assert.strictEqual(res.status, 200, 'Search endpoint must return 200 OK');
      const data = await res.json();
      assert.ok(data.tracks?.items?.length > 0, 'Must return tracks');

      const doggy = data.tracks.items.find(
        (t) => t.name.toUpperCase() === 'DOGGY' || t.name.toLowerCase().includes('doggy')
      );
      assert.ok(doggy, 'Must find a track named DOGGY');
      const coverUrl = doggy.album?.images?.[0]?.url || '';
      assert.ok(coverUrl, 'Cover image URL must be present');
      assert.match(
        coverUrl,
        /(1000x1000|600x600|640x640|hqdefault|hq720)/,
        'Artwork must be authentic high-resolution (>=500px or 1000x1000)'
      );
    });

    it('Query "doggy quevedo" returns DOGGY with La Pantera / Quevedo credits and studio cover', async () => {
      const res = await fetch(`${SEARCH_ENDPOINT}?q=${encodeURIComponent('doggy quevedo')}`);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.ok(data.tracks?.items?.length > 0, 'Must return tracks for "doggy quevedo"');

      const topTrack = data.tracks.items[0];
      assert.strictEqual(topTrack.name.toUpperCase(), 'DOGGY', 'Top track must be DOGGY');
      assert.strictEqual(topTrack.artists[0].name, 'La Pantera', 'Artist must be La Pantera');

      const coverUrl = topTrack.album?.images?.[0]?.url || '';
      assert.match(coverUrl, /(1000x1000|600x600)/, 'Cover URL must be high-resolution studio artwork');
    });

    it('Query "doggy la pantera" returns DOGGY with La Pantera / Quevedo credits and studio cover', async () => {
      const res = await fetch(`${SEARCH_ENDPOINT}?q=${encodeURIComponent('doggy la pantera')}`);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.ok(data.tracks?.items?.length > 0, 'Must return tracks for "doggy la pantera"');

      const topTrack = data.tracks.items[0];
      assert.strictEqual(topTrack.name.toUpperCase(), 'DOGGY', 'Top track must be DOGGY');
      assert.strictEqual(topTrack.artists[0].name, 'La Pantera', 'Artist must be La Pantera');

      const coverUrl = topTrack.album?.images?.[0]?.url || '';
      assert.match(coverUrl, /(1000x1000|600x600)/, 'Cover URL must be high-resolution studio artwork');
    });

    it('Query "DOGGY" (uppercase) resolves dynamically without case sensitivity issues', async () => {
      const res = await fetch(`${SEARCH_ENDPOINT}?q=DOGGY`);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.ok(data.tracks?.items?.length > 0, 'Must return tracks for uppercase DOGGY');

      const hasDoggy = data.tracks.items.some((t) => t.name.toUpperCase() === 'DOGGY');
      assert.strictEqual(hasDoggy, true, 'Must find track DOGGY');
    });
  });

  // 1.2 Obscure and Adversarial Query Variations
  describe('1.2 Obscure and Adversarial Query Variations', () => {
    it('Query with leading and trailing whitespace "  doggy  " trims and resolves DOGGY', async () => {
      const res = await fetch(`${SEARCH_ENDPOINT}?q=${encodeURIComponent('  doggy  ')}`);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.ok(data.tracks?.items?.length > 0, 'Must handle whitespace padding');

      const hasDoggy = data.tracks.items.some((t) => t.name.toUpperCase() === 'DOGGY');
      assert.strictEqual(hasDoggy, true, 'Must find DOGGY with whitespace padded query');
    });

    it('Query uppercase multi-word "DOGGY QUEVEDO" resolves top track DOGGY', async () => {
      const res = await fetch(`${SEARCH_ENDPOINT}?q=${encodeURIComponent('DOGGY QUEVEDO')}`);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.ok(data.tracks?.items?.length > 0);

      const topTrack = data.tracks.items[0];
      assert.strictEqual(topTrack.name.toUpperCase(), 'DOGGY');
      assert.strictEqual(topTrack.artists[0].name, 'La Pantera');
    });

    it('Query with reversed terms "la pantera doggy" resolves top track DOGGY', async () => {
      const res = await fetch(`${SEARCH_ENDPOINT}?q=${encodeURIComponent('la pantera doggy')}`);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.ok(data.tracks?.items?.length > 0);

      const hasDoggy = data.tracks.items.some(
        (t) => t.name.toUpperCase() === 'DOGGY' && t.artists?.[0]?.name === 'La Pantera'
      );
      assert.strictEqual(hasDoggy, true, 'Must find DOGGY by La Pantera when artist comes first');
    });

    it('Query with collaboration keyword "doggy ft quevedo" is resolvable via Innertube audio resolver', async () => {
      // Innertube / YouTube Music resolver handles natural language collaboration terms
      const ytTracks = await audioService.searchYouTubeTracks('doggy ft quevedo', 5);
      assert.ok(ytTracks.length > 0, 'YouTube resolver must find candidate tracks for "doggy ft quevedo"');

      const doggyYt = ytTracks.find(
        (t) => t.name.toLowerCase().includes('doggy') && (t.name.toLowerCase().includes('quevedo') || t.artists?.[0]?.name.toLowerCase().includes('pantera'))
      );
      assert.ok(doggyYt, 'Innertube/YouTube resolver must locate DOGGY by La Pantera, Quevedo');
    });

    it('Query with excessive internal whitespace "  DOGGY    QUEVEDO  " resolves correctly', async () => {
      const res = await fetch(`${SEARCH_ENDPOINT}?q=${encodeURIComponent('  DOGGY    QUEVEDO  ')}`);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.ok(data.tracks?.items?.length > 0);
      assert.strictEqual(data.tracks.items[0].name.toUpperCase(), 'DOGGY');
    });

    it('Query with triple terms "la pantera quevedo doggy" resolves DOGGY', async () => {
      const res = await fetch(`${SEARCH_ENDPOINT}?q=${encodeURIComponent('la pantera quevedo doggy')}`);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.ok(data.tracks?.items?.length > 0);
      const hasDoggy = data.tracks.items.some((t) => t.name.toUpperCase() === 'DOGGY');
      assert.strictEqual(hasDoggy, true);
    });
  });

  // 1.3 High-Resolution Studio Artwork Empirical Validation
  describe('1.3 High-Resolution Studio Artwork Empirical Validation', () => {
    it('Empirically fetches Deezer studio master 1000x1000 cover and verifies 200 OK, image type, and byte size', async () => {
      const res = await fetch(`${SEARCH_ENDPOINT}?q=${encodeURIComponent('doggy quevedo')}`);
      const data = await res.json();
      const coverUrl = data.tracks?.items?.[0]?.album?.images?.[0]?.url;
      assert.ok(coverUrl, 'Cover URL must exist');
      assert.match(coverUrl, /1000x1000/, 'URL must point to 1000x1000 studio image');

      // Actually fetch the image over the network
      const imgRes = await fetch(coverUrl);
      assert.strictEqual(imgRes.status, 200, 'Image URL must be reachable with HTTP 200');
      const contentType = imgRes.headers.get('content-type') || '';
      assert.match(contentType, /^image\//, 'Content-Type must be an image');
      const arrayBuffer = await imgRes.arrayBuffer();
      assert.ok(arrayBuffer.byteLength > 20000, `Image size (${arrayBuffer.byteLength} bytes) must exceed 20KB for high-res studio asset`);
    });
  });

  // 1.4 Hardcoding & Static Fallback Audit
  describe('1.4 Zero Hardcoding Static Audit', () => {
    it('Verifies NO hardcoded lookup map for DOGGY in src/services/spotifyApi.ts', () => {
      const src = fs.readFileSync(path.resolve('src/services/spotifyApi.ts'), 'utf8');
      assert.doesNotMatch(src, /['"]DOGGY['"]/i, 'No hardcoded "DOGGY" in spotifyApi.ts');
      assert.doesNotMatch(src, /4366542101/, 'No hardcoded Deezer track ID in spotifyApi.ts');
    });

    it('Verifies NO hardcoded fallback arrays in vite.config.ts', () => {
      const src = fs.readFileSync(path.resolve('vite.config.ts'), 'utf8');
      assert.doesNotMatch(src, /['"]DOGGY['"]/i, 'No hardcoded "DOGGY" in vite.config.ts');
      assert.doesNotMatch(src, /4366542101/, 'No hardcoded Deezer track ID in vite.config.ts');
    });

    it('Verifies NO hardcoded fallback arrays in server.mjs', () => {
      const src = fs.readFileSync(path.resolve('server.mjs'), 'utf8');
      assert.doesNotMatch(src, /['"]DOGGY['"]/i, 'No hardcoded "DOGGY" in server.mjs');
      assert.doesNotMatch(src, /4366542101/, 'No hardcoded Deezer track ID in server.mjs');
    });

    it('Verifies NO pre-populated items in src/utils/recentSearches.ts', () => {
      const src = fs.readFileSync(path.resolve('src/utils/recentSearches.ts'), 'utf8');
      assert.doesNotMatch(src, /['"]DOGGY['"]/i, 'No hardcoded items in recentSearches.ts');
    });
  });
});

// ============================================================================
// SUITE 2: Requirement R3 — Spotify Recent Searches UX & LocalStorage Robustness
// ============================================================================

describe('Suite 2: Requirement R3 — Spotify Recent Searches LocalStorage Robustness', () => {
  // 2.1 Rapid adding of 50 items (Stress, FIFO Truncation, Monotonicity)
  describe('2.1 Rapid Adding of 50 Items (FIFO Truncation & Timestamp Ordering)', () => {
    it('Adding 50 unique items rapidly caps list at exactly 20 items (FIFO eviction)', () => {
      for (let i = 1; i <= 50; i++) {
        recentSearches.addRecentSearch({
          id: `item-${i}`,
          type: 'query',
          title: `Query ${i}`,
          subtitle: 'Búsqueda reciente',
        });
      }

      const list = recentSearches.getRecentSearches();
      assert.strictEqual(list.length, 20, 'List must strictly contain at most 20 items');

      // The latest added item (item-50) must be at index 0
      assert.strictEqual(list[0].id, 'item-50', 'Newest item must be at index 0');
      assert.strictEqual(list[0].title, 'Query 50');

      // The 20th item must be item-31
      assert.strictEqual(list[19].id, 'item-31', '20th item must be item-31');

      // Items 1 through 30 must have been evicted
      for (let i = 1; i <= 30; i++) {
        const found = list.some((item) => item.id === `item-${i}`);
        assert.strictEqual(found, false, `Item ${i} should have been evicted by FIFO`);
      }
    });

    it('All 20 retained items have valid, non-duplicate IDs and monotonically decreasing/equal timestamps', () => {
      for (let i = 1; i <= 50; i++) {
        recentSearches.addRecentSearch({
          id: `unique-id-${i}`,
          type: 'track',
          title: `Song ${i}`,
          subtitle: 'Canción • Artista',
        });
      }

      const list = recentSearches.getRecentSearches();
      const idSet = new Set(list.map((item) => item.id));
      assert.strictEqual(idSet.size, 20, 'All 20 items must have unique IDs');

      for (let i = 0; i < list.length - 1; i++) {
        assert.ok(typeof list[i].timestamp === 'number', 'Timestamp must be a number');
        assert.ok(
          list[i].timestamp >= list[i + 1].timestamp,
          `Timestamp at index ${i} (${list[i].timestamp}) must be >= index ${i + 1} (${list[i + 1].timestamp})`
        );
      }
    });
  });

  // 2.2 Corrupted LocalStorage Payloads Resilience
  describe('2.2 Corrupted LocalStorage Payloads Defensive Resilience', () => {
    it('Handles null / empty localStorage gracefully without throwing', () => {
      mockStorage.removeItem('spotifree_recent_searches');
      assert.doesNotThrow(() => {
        const list = recentSearches.getRecentSearches();
        assert.deepStrictEqual(list, []);
      });
    });

    it('Handles malformed JSON string gracefully without throwing', () => {
      mockStorage.setItem('spotifree_recent_searches', '{{malformed: json, [unclosed');
      assert.doesNotThrow(() => {
        const list = recentSearches.getRecentSearches();
        assert.deepStrictEqual(list, []);
      });
    });

    it('Handles non-array JSON values (object, number, string, boolean) gracefully', () => {
      const invalidPayloads = [
        JSON.stringify({ someKey: 'someValue' }),
        JSON.stringify(12345),
        JSON.stringify('a raw string'),
        JSON.stringify(true),
        JSON.stringify(null),
      ];

      for (const payload of invalidPayloads) {
        mockStorage.setItem('spotifree_recent_searches', payload);
        const list = recentSearches.getRecentSearches();
        assert.deepStrictEqual(list, [], `Payload "${payload}" must return empty array`);
      }
    });

    it('Adding an item on a corrupted localStorage state cleanly recovers and persists valid array', () => {
      mockStorage.setItem('spotifree_recent_searches', 'CORRUPTED_GARBAGE_DATA');
      assert.doesNotThrow(() => {
        recentSearches.addRecentSearch({
          id: 'recovery-item',
          type: 'query',
          title: 'Recovery',
          subtitle: '',
        });
      });

      const list = recentSearches.getRecentSearches();
      assert.strictEqual(list.length, 1);
      assert.strictEqual(list[0].id, 'recovery-item');
      assert.strictEqual(list[0].title, 'Recovery');

      // Verify raw storage is valid JSON array now
      const raw = mockStorage.getItem('spotifree_recent_searches');
      assert.doesNotThrow(() => JSON.parse(raw));
      assert.ok(Array.isArray(JSON.parse(raw)));
    });

    it('Removing an item on a corrupted localStorage state recovers gracefully', () => {
      mockStorage.setItem('spotifree_recent_searches', '{{corrupt');
      assert.doesNotThrow(() => {
        const result = recentSearches.removeRecentSearch('any-id');
        assert.deepStrictEqual(result, []);
      });
    });

    it('Clearing recent searches on a corrupted localStorage state cleans up storage', () => {
      mockStorage.setItem('spotifree_recent_searches', '{{corrupt');
      assert.doesNotThrow(() => {
        recentSearches.clearRecentSearches();
      });
      assert.strictEqual(mockStorage.getItem('spotifree_recent_searches'), null);
    });

    it('Handles localStorage QuotaExceededError without crashing the application', () => {
      mockStorage.failOnSet = true;
      assert.doesNotThrow(() => {
        recentSearches.addRecentSearch({
          id: 'quota-test',
          type: 'query',
          title: 'Quota Test',
          subtitle: '',
        });
      });
    });
  });

  // 2.3 Concurrent and Interleaved Operations
  describe('2.3 Concurrent & Interleaved Operations (State Integrity)', () => {
    it('Interleaved additions and removals maintain consistent array state', () => {
      // Add 10 items
      for (let i = 1; i <= 10; i++) {
        recentSearches.addRecentSearch({
          id: `interleaved-${i}`,
          type: 'track',
          title: `Track ${i}`,
          subtitle: '',
        });
      }

      // Remove odd items
      for (let i = 1; i <= 9; i += 2) {
        recentSearches.removeRecentSearch(`interleaved-${i}`);
      }

      const list = recentSearches.getRecentSearches();
      assert.strictEqual(list.length, 5, 'Exactly 5 even items must remain');
      const remainingIds = list.map((item) => item.id);
      assert.deepStrictEqual(remainingIds, [
        'interleaved-10',
        'interleaved-8',
        'interleaved-6',
        'interleaved-4',
        'interleaved-2',
      ]);
    });

    it('Calling clearRecentSearches immediately after addition empties list', () => {
      recentSearches.addRecentSearch({ id: 'temp-1', type: 'query', title: 'temp', subtitle: '' });
      recentSearches.addRecentSearch({ id: 'temp-2', type: 'query', title: 'temp2', subtitle: '' });
      assert.strictEqual(recentSearches.getRecentSearches().length, 2);

      recentSearches.clearRecentSearches();
      assert.strictEqual(recentSearches.getRecentSearches().length, 0);
      assert.strictEqual(mockStorage.getItem('spotifree_recent_searches'), null);
    });

    it('Calling clearRecentSearches repeatedly is idempotent and does not error', () => {
      for (let i = 0; i < 10; i++) {
        recentSearches.clearRecentSearches();
      }
      assert.strictEqual(recentSearches.getRecentSearches().length, 0);
    });

    it('Removing non-existent ID does not mutate existing items', () => {
      recentSearches.addRecentSearch({ id: 'stable-1', type: 'query', title: 'Stable 1', subtitle: '' });
      recentSearches.addRecentSearch({ id: 'stable-2', type: 'query', title: 'Stable 2', subtitle: '' });

      const before = recentSearches.getRecentSearches();
      recentSearches.removeRecentSearch('non-existent-id');
      const after = recentSearches.getRecentSearches();

      assert.deepStrictEqual(before, after);
    });

    it('Removing all items one by one reaches length 0 cleanly', () => {
      recentSearches.addRecentSearch({ id: 'r1', type: 'query', title: 'R1', subtitle: '' });
      recentSearches.addRecentSearch({ id: 'r2', type: 'query', title: 'R2', subtitle: '' });

      recentSearches.removeRecentSearch('r1');
      assert.strictEqual(recentSearches.getRecentSearches().length, 1);

      recentSearches.removeRecentSearch('r2');
      assert.strictEqual(recentSearches.getRecentSearches().length, 0);
    });
  });

  // 2.4 Case-Insensitivity & Deduplication
  describe('2.4 Case-Insensitive Deduplication & Type Segregation', () => {
    it('Deduplicates query items by case-insensitive title ("DOGGY", "doggy", "Doggy")', () => {
      recentSearches.addRecentSearch({ id: 'q-1', type: 'query', title: 'doggy', subtitle: '' });
      recentSearches.addRecentSearch({ id: 'q-2', type: 'query', title: 'DOGGY', subtitle: '' });
      recentSearches.addRecentSearch({ id: 'q-3', type: 'query', title: 'Doggy', subtitle: '' });

      const list = recentSearches.getRecentSearches();
      assert.strictEqual(list.length, 1, 'Case variations of same query title must deduplicate to 1 item');
      assert.strictEqual(list[0].id, 'q-3', 'Most recent addition must overwrite earlier variant');
      assert.strictEqual(list[0].title, 'Doggy');
    });

    it('Deduplicates query items with surrounding whitespace ("  quevedo  " vs "quevedo")', () => {
      recentSearches.addRecentSearch({ id: 'q-a', type: 'query', title: 'quevedo', subtitle: '' });
      recentSearches.addRecentSearch({ id: 'q-b', type: 'query', title: '  quevedo  ', subtitle: '' });

      const list = recentSearches.getRecentSearches();
      assert.strictEqual(list.length, 1, 'Whitespace-padded duplicates must be deduplicated');
      assert.strictEqual(list[0].id, 'q-b');
    });

    it('Deduplicates track items strictly by ID', () => {
      recentSearches.addRecentSearch({ id: 'track-42', type: 'track', title: 'Title A', subtitle: '' });
      recentSearches.addRecentSearch({ id: 'track-42', type: 'track', title: 'Title B', subtitle: '' });

      const list = recentSearches.getRecentSearches();
      assert.strictEqual(list.length, 1, 'Same track ID must deduplicate to 1 item');
      assert.strictEqual(list[0].title, 'Title B');
    });

    it('Preserves same title when entity TYPES differ (e.g. track "Quevedo" vs query "quevedo")', () => {
      recentSearches.addRecentSearch({ id: 'query-q', type: 'query', title: 'Quevedo', subtitle: 'Búsqueda' });
      recentSearches.addRecentSearch({ id: 'artist-q', type: 'artist', title: 'Quevedo', subtitle: 'Artista' });
      recentSearches.addRecentSearch({ id: 'track-q', type: 'track', title: 'Quevedo', subtitle: 'Canción' });

      const list = recentSearches.getRecentSearches();
      assert.strictEqual(list.length, 3, 'Different entity types with same title must be preserved as distinct');
      const types = list.map((item) => item.type);
      assert.ok(types.includes('query'));
      assert.ok(types.includes('artist'));
      assert.ok(types.includes('track'));
    });

    it('Re-adding an existing item promotes it to index 0 with refreshed timestamp', async () => {
      recentSearches.addRecentSearch({ id: 'old-item', type: 'query', title: 'old query', subtitle: '' });
      const firstTimestamp = recentSearches.getRecentSearches()[0].timestamp;

      // Small delay to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 15));

      recentSearches.addRecentSearch({ id: 'another-item', type: 'query', title: 'another query', subtitle: '' });
      assert.strictEqual(recentSearches.getRecentSearches()[0].id, 'another-item');

      // Re-add old-item
      recentSearches.addRecentSearch({ id: 'old-item', type: 'query', title: 'old query', subtitle: '' });
      const list = recentSearches.getRecentSearches();

      assert.strictEqual(list.length, 2, 'Must not duplicate');
      assert.strictEqual(list[0].id, 'old-item', 'Re-added item must be promoted to index 0');
      assert.ok(list[0].timestamp > firstTimestamp, 'Timestamp must be refreshed');
    });
  });

  // 2.5 Reactive Window CustomEvent Notification
  describe('2.5 Reactive Window CustomEvent Notification', () => {
    it('Dispatches "spotifree_recent_searches_updated" on addRecentSearch with updated list', () => {
      let eventPayload = null;
      window.addEventListener('spotifree_recent_searches_updated', (e) => {
        eventPayload = e.detail;
      });

      recentSearches.addRecentSearch({ id: 'evt-1', type: 'query', title: 'Event Test', subtitle: '' });
      assert.ok(eventPayload, 'Event must have fired');
      assert.strictEqual(eventPayload.length, 1);
      assert.strictEqual(eventPayload[0].id, 'evt-1');
    });

    it('Dispatches "spotifree_recent_searches_updated" on removeRecentSearch with remaining list', () => {
      recentSearches.addRecentSearch({ id: 'evt-del-1', type: 'query', title: 'Stay', subtitle: '' });
      recentSearches.addRecentSearch({ id: 'evt-del-2', type: 'query', title: 'Leave', subtitle: '' });

      let eventPayload = null;
      window.addEventListener('spotifree_recent_searches_updated', (e) => {
        eventPayload = e.detail;
      });

      recentSearches.removeRecentSearch('evt-del-2');
      assert.ok(eventPayload);
      assert.strictEqual(eventPayload.length, 1);
      assert.strictEqual(eventPayload[0].id, 'evt-del-1');
    });

    it('Dispatches "spotifree_recent_searches_updated" on clearRecentSearches with empty array []', () => {
      recentSearches.addRecentSearch({ id: 'evt-clr', type: 'query', title: 'Clear Me', subtitle: '' });

      let eventPayload = null;
      window.addEventListener('spotifree_recent_searches_updated', (e) => {
        eventPayload = e.detail;
      });

      recentSearches.clearRecentSearches();
      assert.ok(eventPayload);
      assert.deepStrictEqual(eventPayload, []);
    });
  });
});
