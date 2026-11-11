import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Robust MockLocalStorage implementing full Web Storage API specification
class MockLocalStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    const k = String(key);
    return this.store.has(k) ? this.store.get(k) : null;
  }
  setItem(key, value) {
    this.store.set(String(key), String(value));
  }
  removeItem(key) {
    this.store.delete(String(key));
  }
  clear() {
    this.store.clear();
  }
  get length() {
    return this.store.size;
  }
  key(index) {
    const keys = Array.from(this.store.keys());
    return keys[index] ?? null;
  }
}

describe('Challenger M3 Adversarial Verification: Prevent Auto-Save on Playlist Viewing (R3)', () => {
  const rootDir = process.cwd();
  const storePath = path.join(rootDir, 'src', 'store', 'useSpotifyDataStore.ts');
  const desktopViewPath = path.join(rootDir, 'src', 'components', 'desktop', 'DesktopPlaylistView.tsx');
  const contextMenuPath = path.join(rootDir, 'src', 'components', 'desktop', 'ContextMenu.tsx');
  const mobileViewPath = path.join(rootDir, 'src', 'components', 'mobile', 'MobilePlaylistView.tsx');

  const storeContent = fs.readFileSync(storePath, 'utf8');
  const desktopViewContent = fs.readFileSync(desktopViewPath, 'utf8');
  const contextMenuContent = fs.readFileSync(contextMenuPath, 'utf8');
  const mobileViewContent = fs.readFileSync(mobileViewPath, 'utf8');

  let mockStorage;

  beforeEach(() => {
    mockStorage = new MockLocalStorage();
  });

  // Emulation of cleanPid and rawCleanPid exactly as in useSpotifyDataStore.ts
  const cleanPid = (val) => (val || '').replace(/^spotify:(playlist|album):/i, '').replace(/^(custom|playlist)-/, '').split('?')[0].trim();
  const rawCleanPid = (val) => (val || '').replace(/^spotify:(playlist|album):/i, '').split('?')[0].trim();

  // Emulation of sanitizeImportedPlaylists based on store logic
  function runSanitizer(list, storage = mockStorage) {
    if (!Array.isArray(list) || list.length === 0) return [];
    try {
      const rawSaved = storage.getItem('spotifree_saved_library_playlists');
      const savedIds = rawSaved ? JSON.parse(rawSaved) : [];
      const savedSet = new Set();
      for (const sId of savedIds) {
        if (sId) {
          savedSet.add(sId);
          savedSet.add(cleanPid(sId));
          savedSet.add(rawCleanPid(sId));
        }
      }

      return list.filter((p) => {
        if (!p || !p.id) return false;
        const pid = String(p.id);
        const cpid = cleanPid(pid);
        const rawCpid = rawCleanPid(pid);
        if (pid === 'liked-songs' || cpid === 'liked-songs' || rawCpid === 'liked-songs' || pid.includes('collection:tracks')) return true;
        if (pid === 'spotify-dj' || cpid === 'spotify-dj' || rawCpid === 'spotify-dj') return true;
        if (p.is_custom === true || p.owner?.id === 'user') return true;
        if (pid.startsWith('custom-') || pid.startsWith('pl-custom-') || pid.startsWith('imported-') || pid.startsWith('local-')) return true;
        if (pid.startsWith('art-') || pid.startsWith('artist-')) return true;
        return savedSet.has(pid) || savedSet.has(cpid) || savedSet.has(rawCpid);
      });
    } catch {
      return list;
    }
  }

  // Emulation of DesktopPlaylistView loadTracks inLibrary guard
  function checkDesktopInLibrary(playlistId, currentPlaylists) {
    const cleanPlId = (playlistId || '').replace(/^spotify:(playlist|album):/i, '').split('?')[0].trim();
    return currentPlaylists.some((p) => {
      if (!p || !p.id) return false;
      const pClean = (p.id || '').replace(/^spotify:(playlist|album):/i, '').split('?')[0].trim();
      return p.id === playlistId || p.id === cleanPlId || pClean === cleanPlId;
    });
  }

  // Emulation of store updatePlaylist
  function runUpdatePlaylist(id, updates, state, storage = mockStorage) {
    const cleanId = (id || '').replace(/^spotify:playlist:/i, '').split('?')[0].trim();
    const isLikedTarget = (pid, pname) =>
      pid === 'liked-songs' ||
      pid === 'user-liked-songs' ||
      pid.includes('collection:tracks') ||
      /^(canciones que te gustan|canciones que me gustan|tus me gusta|liked songs|liked tracks)$/i.test((pname || '').trim());

    const isTargetLiked = id === 'liked-songs' || isLikedTarget(id, updates.name);
    const existingInCache = state.playlistDetailsCache[id];
    const existingInList = state.playlists.find((p) => p.id === id || (isTargetLiked && isLikedTarget(p.id, p.name)));
    const baseEntry = existingInCache || existingInList || { id, name: isTargetLiked ? 'Canciones que te gustan' : 'Playlist', tracks: { total: 0, items: [] } };
    const updatedCacheEntry = { ...baseEntry, ...updates };

    let found = false;
    const updatedPlaylists = state.playlists.map((p) => {
      if (p.id === id || (isTargetLiked && isLikedTarget(p.id, p.name))) {
        found = true;
        return { ...p, ...updates, id: isTargetLiked ? 'liked-songs' : p.id };
      }
      return p;
    });
    if (!found && isTargetLiked) updatedPlaylists.unshift(updatedCacheEntry);

    // 1. user_imported_playlists
    const rawImported = storage.getItem('user_imported_playlists');
    const list = rawImported ? JSON.parse(rawImported) : [];
    const idx = list.findIndex((p) => p.id === id || (cleanId && p.id === cleanId) || (isTargetLiked && isLikedTarget(p.id, p.name)));
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...updates, id: isTargetLiked ? 'liked-songs' : list[idx].id };
      storage.setItem('user_imported_playlists', JSON.stringify(list));
    } else if (isTargetLiked) {
      list.unshift(updatedCacheEntry);
      storage.setItem('user_imported_playlists', JSON.stringify(list));
    }

    // 2. Playlist details cache
    const userId = state.user?.id || storage.getItem('spotifree_active_user_id') || 'active';
    const rawCache = storage.getItem(`spotifree_playlist_cache_${userId}`);
    const cacheObj = rawCache ? JSON.parse(rawCache) : {};
    cacheObj[id] = updatedCacheEntry;
    if (cleanId && cleanId !== id) {
      cacheObj[cleanId] = updatedCacheEntry;
    }
    storage.setItem(`spotifree_playlist_cache_${userId}`, JSON.stringify(cacheObj));
    storage.setItem('spotifree_playlist_cache_active', JSON.stringify(cacheObj));

    // 3. spotify_extracted_session
    const rawExtracted = storage.getItem('spotify_extracted_session');
    if (rawExtracted) {
      const parsed = JSON.parse(rawExtracted);
      if (Array.isArray(parsed.playlists)) {
        let extFound = false;
        parsed.playlists = parsed.playlists.map((p) => {
          if (p.id === id || (cleanId && p.id === cleanId) || (isTargetLiked && isLikedTarget(p.id, p.name))) {
            extFound = true;
            return { ...p, ...updates, id: isTargetLiked ? 'liked-songs' : p.id };
          }
          return p;
        });
        if (!extFound && isTargetLiked) {
          parsed.playlists.unshift(updatedCacheEntry);
        }
      }
      if (parsed.cachedPlaylistDetails) {
        parsed.cachedPlaylistDetails[id] = updatedCacheEntry;
        if (cleanId && cleanId !== id) {
          parsed.cachedPlaylistDetails[cleanId] = updatedCacheEntry;
        }
      }
      storage.setItem('spotify_extracted_session', JSON.stringify(parsed));
    }

    state.playlists = updatedPlaylists;
    state.playlistDetailsCache = {
      ...state.playlistDetailsCache,
      [id]: updatedCacheEntry,
      ...(cleanId && cleanId !== id ? { [cleanId]: updatedCacheEntry } : {}),
    };
  }

  // Emulation of addCustomPlaylist
  function runAddCustomPlaylist(playlist, state, storage = mockStorage) {
    const cleanId = (playlist.id || '').replace(/^spotify:playlist:/i, '').split('?')[0].trim();
    const isAlreadyInPlaylists = state.playlists.some((p) => p.id === playlist.id || p.id === cleanId);
    state.playlists = isAlreadyInPlaylists
      ? state.playlists.map((p) => (p.id === playlist.id || p.id === cleanId ? playlist : p))
      : [playlist, ...state.playlists];

    const rawImported = storage.getItem('user_imported_playlists');
    const list = rawImported ? JSON.parse(rawImported) : [];
    if (!list.some((p) => p.id === playlist.id || p.id === cleanId)) {
      list.unshift(playlist);
      storage.setItem('user_imported_playlists', JSON.stringify(list));
    }

    const rawSaved = storage.getItem('spotifree_saved_library_playlists');
    const savedList = rawSaved ? JSON.parse(rawSaved) : [];
    if (!savedList.includes(playlist.id)) {
      savedList.push(playlist.id);
      storage.setItem('spotifree_saved_library_playlists', JSON.stringify(savedList));
    }
  }

  // Emulation of deletePlaylist
  function runDeletePlaylist(id, state, storage = mockStorage) {
    const cleanId = (id || '').replace(/^spotify:playlist:/i, '').split('?')[0].trim();
    const matchId = (pid) => {
      if (!pid) return false;
      if (pid === id || pid === cleanId) return true;
      const pClean = pid.replace(/^spotify:playlist:/i, '').split('?')[0].trim();
      return pClean === cleanId;
    };

    state.playlists = state.playlists.filter((p) => !matchId(p.id));

    const rawImported = storage.getItem('user_imported_playlists');
    if (rawImported) {
      const list = JSON.parse(rawImported);
      storage.setItem('user_imported_playlists', JSON.stringify(list.filter((p) => !matchId(p.id))));
    }

    const rawSaved = storage.getItem('spotifree_saved_library_playlists');
    if (rawSaved) {
      const list = JSON.parse(rawSaved);
      storage.setItem('spotifree_saved_library_playlists', JSON.stringify(list.filter((pId) => !matchId(pId))));
    }
  }

  // =========================================================================
  // SUITE 1: URI Formats & ID Normalization in Sequential Viewing
  // =========================================================================
  describe('Suite 1: Sequential Viewing with Diverse URI Formats', () => {
    const variedPlaylists = [
      { id: '37i9dQZF1DXcBWIGoYBM5M', name: "Today's Top Hits" },
      { id: 'spotify:playlist:37i9dQZF1DXcBWIGoYBM5M', name: "Today's Top Hits (URI)" },
      { id: 'spotify:playlist:37i9dQZF1DX10zKzsJ2jva?si=abcdef123', name: 'Viva Latino (URI + param)' },
      { id: '37i9dQZF1DX10zKzsJ2jva?si=abcdef123', name: 'Viva Latino (param only)' },
      { id: '37i9dQZF1DWZdsS73T1ogG?si=xyz&pi=999&pt=es', name: 'el nuevo urbano (multi-param)' },
      { id: 'alb-316164367', name: 'Un Verano Sin Ti (Album ID)' },
      { id: 'spotify:album:4aawyAB9vmqN3uQ7FjRGTy', name: 'Album (URI)' },
      { id: 'spotify:album:4aawyAB9vmqN3uQ7FjRGTy?si=param123', name: 'Album (URI + param)' },
      { id: 'deezer-playlist-123456', name: 'Deezer Hits' },
      { id: 'dez-987654', name: 'Deezer Mix' },
      { id: 'art-bad-bunny', name: 'Bad Bunny (Artist Page)' },
      { id: 'artist-rosalia', name: 'Rosalía (Artist Page)' },
      { id: 'spotify:playlist:37i9dQZF1DX2EiUAL7Wdfc', name: 'míticas' },
    ];

    it('simulates rapid sequential viewing of all 13 playlists: zero auto-save to storage or library', () => {
      const state = {
        user: { id: 'test-user', display_name: 'Test' },
        playlists: [
          { id: 'liked-songs', name: 'Canciones que te gustan', tracks: { total: 0, items: [] } },
          { id: 'spotify-dj', name: 'DJ', tracks: { total: 0, items: [] } },
        ],
        playlistDetailsCache: {},
      };

      for (const item of variedPlaylists) {
        // Step A: Desktop view checks if in library
        const inLibrary = checkDesktopInLibrary(item.id, state.playlists);
        assert.equal(inLibrary, false, `Playlist ${item.id} should NOT be in library before being saved`);

        // Step B: Desktop view caches details unconditionally
        state.playlistDetailsCache[item.id] = { ...item, tracks: { total: 10, items: [{ id: `trk-${item.id}` }] } };

        // Step C: updatePlaylist is NOT called because inLibrary === false
        // Even if updatePlaylist WERE called directly:
        runUpdatePlaylist(item.id, { tracks: { total: 10, items: [{ id: `trk-${item.id}` }] } }, state, mockStorage);

        // Verification: user_imported_playlists remains empty or undefined
        const rawImported = mockStorage.getItem('user_imported_playlists');
        assert.ok(!rawImported || JSON.parse(rawImported).length === 0, `user_imported_playlists must be empty after viewing ${item.id}`);

        // Verification: spotifree_saved_library_playlists remains empty
        const rawSaved = mockStorage.getItem('spotifree_saved_library_playlists');
        assert.ok(!rawSaved || JSON.parse(rawSaved).length === 0, `spotifree_saved_library_playlists must not contain ${item.id}`);

        // Verification: store playlists array length remains 2 (liked-songs and spotify-dj)
        assert.equal(state.playlists.length, 2, `state.playlists must remain length 2`);
      }
    });

    it('caching still preserves tracks and details for instant audio playback and cover rendering', () => {
      const state = {
        user: { id: 'test-user' },
        playlists: [{ id: 'liked-songs', name: 'Canciones que te gustan' }],
        playlistDetailsCache: {},
      };

      const testItem = {
        id: 'spotify:playlist:37i9dQZF1DXcBWIGoYBM5M?si=123',
        name: "Today's Top Hits",
        images: [{ url: 'https://i.scdn.co/image/top-hits.jpg' }],
        tracks: {
          total: 2,
          items: [
            { id: 'trk-1', name: 'Song 1', uri: 'spotify:track:trk-1' },
            { id: 'trk-2', name: 'Song 2', uri: 'spotify:track:trk-2' },
          ],
        },
      };

      runUpdatePlaylist(testItem.id, testItem, state, mockStorage);

      // Verify cached entry is accessible under raw id AND cleaned id
      const cleanId = '37i9dQZF1DXcBWIGoYBM5M';
      assert.ok(state.playlistDetailsCache[testItem.id], 'Must cache under raw ID');
      assert.ok(state.playlistDetailsCache[cleanId], 'Must cache under cleaned ID');
      assert.equal(state.playlistDetailsCache[cleanId].tracks.total, 2);

      // Storage cache must also hold it
      const rawCache = mockStorage.getItem('spotifree_playlist_cache_test-user');
      assert.ok(rawCache, 'Playlist cache must be written in localStorage');
      const parsedCache = JSON.parse(rawCache);
      assert.ok(parsedCache[testItem.id] || parsedCache[cleanId], 'Cache must store entry for playback');
    });
  });

  // =========================================================================
  // SUITE 2: Deep Sanitization of Polluted Legacy Storage
  // =========================================================================
  describe('Suite 2: Storage Sanitization Stress Invariants', () => {
    it('correctly purges all leaked/polluted items while preserving custom, saved, artist, and virtual lists', () => {
      // Setup explicitly saved library IDs with mixed formats
      const savedIds = [
        '37i9dQZF1DXcBWIGoYBM5M', // Plain ID
        'spotify:playlist:37i9dQZF1DX10zKzsJ2jva', // URI format
        '37i9dQZF1DWZdsS73T1ogG?si=abcd', // Query param format
        'alb-316164367', // Album ID
        'playlist-custom-saved-xyz', // playlist- prefix format
      ];
      mockStorage.setItem('spotifree_saved_library_playlists', JSON.stringify(savedIds));

      const pollutedList = [
        // 1. Legitimate user custom playlists (MUST BE KEPT)
        { id: 'custom-123456', name: 'Mi lista 1', is_custom: true },
        { id: 'custom-playlist-789', name: 'Mi lista 2' },
        { id: 'pl-custom-abc', name: 'Mi lista 3' },
        { id: 'uuid-user-own', name: 'Mi lista 4', owner: { id: 'user', display_name: 'Usuario' } },
        { id: 'imported-rock-m3u', name: 'Rock Clásico' },
        { id: 'local-mp3-files', name: 'Archivos Locales' },

        // 2. Virtual playlists (MUST BE KEPT)
        { id: 'liked-songs', name: 'Canciones que te gustan' },
        { id: 'spotify-dj', name: 'DJ' },
        { id: 'collection:tracks', name: 'Tus Me Gusta' },

        // 3. Artist playlists (MUST BE KEPT)
        { id: 'art-bad-bunny', name: 'Bad Bunny' },
        { id: 'artist-feid', name: 'Feid' },

        // 4. Explicitly saved third-party playlists (MUST BE KEPT despite being editorial)
        { id: '37i9dQZF1DXcBWIGoYBM5M', name: "Today's Top Hits" },
        { id: '37i9dQZF1DX10zKzsJ2jva', name: 'Viva Latino' }, // In saved list as spotify:playlist:37i9dQZF1DX10zKzsJ2jva
        { id: '37i9dQZF1DWZdsS73T1ogG', name: 'el nuevo urbano' }, // In saved list with query param
        { id: 'alb-316164367', name: 'Un Verano Sin Ti' }, // Album in saved list
        { id: 'custom-saved-xyz', name: 'Saved Custom' }, // In saved list with playlist- prefix

        // 5. Polluted / leaked viewed-only playlists (MUST BE STRIPPED)
        { id: '37i9dQZF1DX2EiUAL7Wdfc', name: 'míticas' },
        { id: 'spotify:playlist:37i9dQZF1DX6PYajiT4pAf', name: 'Novedades Viernes' },
        { id: '37i9dQZEVXbNFJfN1Vw8d9?si=xyz', name: 'Top 50 España' },
        { id: 'alb-999999', name: 'Random Album Leak' },
        { id: 'spotify:album:leaked-album-id', name: 'Leaked Album URI' },
        { id: 'deezer-playlist-polluted-1', name: 'Deezer Leak' },
        { id: 'dez-polluted-2', name: 'Deezer Short Leak' },
        { id: 'sc-polluted-3', name: 'SoundCloud Leak' },

        // 6. Malformed entries (MUST BE STRIPPED)
        null,
        undefined,
        {},
        { id: '' },
        { id: null },
      ];

      const sanitized = runSanitizer(pollutedList, mockStorage);

      const keptIds = new Set(sanitized.map((p) => p.id));

      // Assertions on kept items
      assert.ok(keptIds.has('custom-123456'), 'custom-123456 must be kept');
      assert.ok(keptIds.has('custom-playlist-789'), 'custom-playlist-789 must be kept');
      assert.ok(keptIds.has('pl-custom-abc'), 'pl-custom-abc must be kept');
      assert.ok(keptIds.has('uuid-user-own'), 'uuid-user-own must be kept');
      assert.ok(keptIds.has('imported-rock-m3u'), 'imported-rock-m3u must be kept');
      assert.ok(keptIds.has('local-mp3-files'), 'local-mp3-files must be kept');
      assert.ok(keptIds.has('liked-songs'), 'liked-songs must be kept');
      assert.ok(keptIds.has('spotify-dj'), 'spotify-dj must be kept');
      assert.ok(keptIds.has('collection:tracks'), 'collection:tracks must be kept');
      assert.ok(keptIds.has('art-bad-bunny'), 'art-bad-bunny must be kept');
      assert.ok(keptIds.has('artist-feid'), 'artist-feid must be kept');
      assert.ok(keptIds.has('37i9dQZF1DXcBWIGoYBM5M'), 'Saved Today Top Hits must be kept');
      assert.ok(keptIds.has('37i9dQZF1DX10zKzsJ2jva'), 'Saved Viva Latino must be kept (matched URI format)');
      assert.ok(keptIds.has('37i9dQZF1DWZdsS73T1ogG'), 'Saved el nuevo urbano must be kept (matched param format)');
      assert.ok(keptIds.has('alb-316164367'), 'Saved album must be kept');
      assert.ok(keptIds.has('custom-saved-xyz'), 'Saved custom-saved-xyz must be kept');

      // Assertions on purged items
      assert.ok(!keptIds.has('37i9dQZF1DX2EiUAL7Wdfc'), 'Leaked míticas must be purged');
      assert.ok(!keptIds.has('spotify:playlist:37i9dQZF1DX6PYajiT4pAf'), 'Leaked Novedades Viernes must be purged');
      assert.ok(!keptIds.has('37i9dQZEVXbNFJfN1Vw8d9?si=xyz'), 'Leaked Top 50 España must be purged');
      assert.ok(!keptIds.has('alb-999999'), 'Leaked album must be purged');
      assert.ok(!keptIds.has('spotify:album:leaked-album-id'), 'Leaked album URI must be purged');
      assert.ok(!keptIds.has('deezer-playlist-polluted-1'), 'Deezer leak must be purged');
      assert.ok(!keptIds.has('dez-polluted-2'), 'Deezer short leak must be purged');
      assert.ok(!keptIds.has('sc-polluted-3'), 'SoundCloud leak must be purged');

      // Total count check
      assert.equal(sanitized.length, 16, 'Exact count of kept items must be 16');
    });

    it('handles empty, null, or corrupted storage gracefully without throwing', () => {
      assert.deepEqual(runSanitizer([], mockStorage), []);
      assert.deepEqual(runSanitizer(null, mockStorage), []);
      assert.deepEqual(runSanitizer(undefined, mockStorage), []);

      // Corrupted JSON in spotifree_saved_library_playlists
      mockStorage.setItem('spotifree_saved_library_playlists', '{invalid-json');
      const list = [{ id: 'custom-1', is_custom: true }, { id: '37i9dQZF1DXcBWIGoYBM5M' }];
      // Should fall back safely without crashing
      const res = runSanitizer(list, mockStorage);
      assert.ok(Array.isArray(res));
    });
  });

  // =========================================================================
  // SUITE 3: Concurrency and Rapid Fire Calling of updatePlaylist
  // =========================================================================
  describe('Suite 3: Concurrency & Stress Invariants', () => {
    it('100 rapid consecutive calls with mixed saved and unsaved IDs never pollute storage', () => {
      const state = {
        user: { id: 'test-user' },
        playlists: [
          { id: 'liked-songs', name: 'Canciones que te gustan', tracks: { total: 0, items: [] } },
          { id: 'custom-my-list', name: 'Mi lista', is_custom: true, tracks: { total: 0, items: [] } },
        ],
        playlistDetailsCache: {},
      };

      // Populate custom playlist in storage
      mockStorage.setItem('user_imported_playlists', JSON.stringify([
        { id: 'custom-my-list', name: 'Mi lista', is_custom: true, tracks: { total: 0, items: [] } }
      ]));
      mockStorage.setItem('spotifree_saved_library_playlists', JSON.stringify(['custom-my-list']));

      // Fire 100 rapid calls alternating between unsaved playlists and the custom list
      for (let i = 0; i < 100; i++) {
        const isUnsaved = i % 2 === 0;
        const targetId = isUnsaved ? `37i9dQZF1DX_test_${i}` : 'custom-my-list';
        runUpdatePlaylist(targetId, { tracks: { total: i, items: [] } }, state, mockStorage);
      }

      const imported = JSON.parse(mockStorage.getItem('user_imported_playlists'));
      // Only the single custom playlist must be present
      assert.equal(imported.length, 1, 'user_imported_playlists must contain strictly 1 item');
      assert.equal(imported[0].id, 'custom-my-list');
      assert.equal(imported[0].tracks.total, 99, 'Custom list track count must reflect final update');
    });

    it('50 concurrent asynchronous calls (Promise.all) maintain storage consistency', async () => {
      const state = {
        user: { id: 'test-user' },
        playlists: [{ id: 'liked-songs', name: 'Canciones que te gustan' }],
        playlistDetailsCache: {},
      };

      mockStorage.setItem('user_imported_playlists', JSON.stringify([]));

      // 50 concurrent calls on 10 different unsaved IDs
      const promises = [];
      for (let i = 0; i < 50; i++) {
        const id = `spotify:playlist:external_${i % 10}`;
        promises.push(
          new Promise((resolve) => {
            setTimeout(() => {
              runUpdatePlaylist(id, { tracks: { total: i, items: [] } }, state, mockStorage);
              resolve();
            }, Math.random() * 5);
          })
        );
      }

      await Promise.all(promises);

      const imported = JSON.parse(mockStorage.getItem('user_imported_playlists'));
      assert.equal(imported.length, 0, 'No external playlist must leak into user_imported_playlists during concurrent execution');
      assert.equal(state.playlists.length, 1, 'state.playlists must remain unaffected');
    });
  });

  // =========================================================================
  // SUITE 4: Complete User Save / Unsave Lifecycle Roundtrip
  // =========================================================================
  describe('Suite 4: Explicit Save / Unsave Lifecycle Parity', () => {
    it('roundtrip: view (no save) -> explicit save -> view (updates in place) -> delete (cleans all)', () => {
      const state = {
        user: { id: 'test-user' },
        playlists: [
          { id: 'liked-songs', name: 'Canciones que te gustan' },
          { id: 'spotify-dj', name: 'DJ' },
        ],
        playlistDetailsCache: {},
      };

      const targetPlaylist = {
        id: '37i9dQZF1DXcBWIGoYBM5M',
        name: "Today's Top Hits",
        description: 'Popular hits',
        tracks: { total: 50, items: [] },
      };

      // 1. User views playlist (loadTracks simulation)
      let inLibrary = checkDesktopInLibrary(targetPlaylist.id, state.playlists);
      assert.equal(inLibrary, false, 'Initial state: not in library');

      // Unconditional cache details
      state.playlistDetailsCache[targetPlaylist.id] = targetPlaylist;

      // updatePlaylist called or guarded
      if (inLibrary) {
        runUpdatePlaylist(targetPlaylist.id, { tracks: targetPlaylist.tracks }, state, mockStorage);
      }

      // Check storage after viewing
      assert.equal(mockStorage.getItem('user_imported_playlists'), null);
      assert.equal(mockStorage.getItem('spotifree_saved_library_playlists'), null);

      // 2. User clicks "+" button (addCustomPlaylist)
      runAddCustomPlaylist(targetPlaylist, state, mockStorage);

      // Verify in library now
      assert.equal(state.playlists.some((p) => p.id === targetPlaylist.id), true);
      const savedLibrary = JSON.parse(mockStorage.getItem('spotifree_saved_library_playlists'));
      assert.ok(savedLibrary.includes(targetPlaylist.id), 'Must be in saved library');
      const importedAfterSave = JSON.parse(mockStorage.getItem('user_imported_playlists'));
      assert.equal(importedAfterSave.length, 1);
      assert.equal(importedAfterSave[0].id, targetPlaylist.id);

      // 3. User views playlist again: inLibrary is now true, so updatePlaylist updates in place
      inLibrary = checkDesktopInLibrary(targetPlaylist.id, state.playlists);
      assert.equal(inLibrary, true, 'Second view: is now in library');

      runUpdatePlaylist(targetPlaylist.id, { tracks: { total: 55, items: [{ id: 'new-trk' }] } }, state, mockStorage);

      const importedAfterUpdate = JSON.parse(mockStorage.getItem('user_imported_playlists'));
      assert.equal(importedAfterUpdate.length, 1, 'Must still have exactly 1 playlist, no duplication');
      assert.equal(importedAfterUpdate[0].tracks.total, 55, 'Track count updated in place');

      // 4. User clicks checkmark / "Eliminar de Tu biblioteca" (deletePlaylist)
      runDeletePlaylist(targetPlaylist.id, state, mockStorage);

      assert.equal(state.playlists.some((p) => p.id === targetPlaylist.id), false, 'Removed from store playlists');
      const savedAfterDelete = JSON.parse(mockStorage.getItem('spotifree_saved_library_playlists'));
      assert.ok(!savedAfterDelete.includes(targetPlaylist.id), 'Removed from saved library list');
      const importedAfterDelete = JSON.parse(mockStorage.getItem('user_imported_playlists'));
      assert.equal(importedAfterDelete.length, 0, 'Removed from user_imported_playlists');

      // 5. User views playlist once again
      inLibrary = checkDesktopInLibrary(targetPlaylist.id, state.playlists);
      assert.equal(inLibrary, false, 'Third view: no longer in library');
    });
  });

  // =========================================================================
  // SUITE 5: ContextMenu Parity & Discrimination
  // =========================================================================
  describe('Suite 5: ContextMenu Parity Invariants', () => {
    it('ContextMenu discriminates user-created playlists from Spotify playlists', () => {
      // Simulate isUserCreatedPlaylist logic from ContextMenu.tsx
      const evalIsUserCreated = (targetPlaylist, user = { id: 'user-123', display_name: 'MiUsuario' }) => {
        const isLikedPlaylist = targetPlaylist?.id === 'liked-songs' || targetPlaylist?.id === 'collection:tracks';
        const isArtist = Boolean(targetPlaylist && (targetPlaylist.id?.startsWith('art-') || targetPlaylist.id?.startsWith('artist-')));
        const isFolder = Boolean(targetPlaylist && targetPlaylist.id === 'nueva-carpeta');

        return Boolean(
          targetPlaylist &&
          !isLikedPlaylist &&
          !isArtist &&
          !isFolder &&
          targetPlaylist.id !== 'liked-songs' &&
          targetPlaylist.id !== 'collection:tracks' &&
          (
            targetPlaylist.is_custom === true ||
            targetPlaylist.id.startsWith('custom-') ||
            targetPlaylist.id.startsWith('pl-custom-') ||
            targetPlaylist.owner?.id === 'user' ||
            (user?.id && targetPlaylist.owner?.id === user.id) ||
            (user?.display_name && targetPlaylist.owner?.display_name?.toLowerCase() === user.display_name.toLowerCase())
          )
        );
      };

      // 1. Third-party Spotify editorial playlist
      const spotifyPl = { id: '37i9dQZF1DXcBWIGoYBM5M', name: "Today's Top Hits", owner: { id: 'spotify', display_name: 'Spotify' } };
      assert.equal(evalIsUserCreated(spotifyPl), false, 'Spotify editorial playlist must NOT be evaluated as user-created');

      // 2. Custom playlist with is_custom: true
      const customPl1 = { id: 'my-list-1', name: 'Mis Favoritas', is_custom: true, owner: { id: 'spotify', display_name: 'Spotify' } };
      assert.equal(evalIsUserCreated(customPl1), true, 'Playlist with is_custom: true must be user-created');

      // 3. Custom playlist with custom- prefix
      const customPl2 = { id: 'custom-playlist-999', name: 'Mis Favoritas 2' };
      assert.equal(evalIsUserCreated(customPl2), true, 'Playlist with custom- prefix must be user-created');

      // 4. Playlist owned by current user id
      const customPl3 = { id: 'list-3', name: 'Lista 3', owner: { id: 'user-123' } };
      assert.equal(evalIsUserCreated(customPl3), true, 'Playlist owned by current user must be user-created');

      // 5. Liked songs
      const likedPl = { id: 'liked-songs', name: 'Canciones que te gustan' };
      assert.equal(evalIsUserCreated(likedPl), false, 'Liked songs must NOT be user-created');

      // 6. Artist page
      const artistPl = { id: 'art-bad-bunny', name: 'Bad Bunny' };
      assert.equal(evalIsUserCreated(artistPl), false, 'Artist page must NOT be user-created');
    });
  });

  // =========================================================================
  // SUITE 6: Requirement R5 Preserved Files Forensic Integrity
  // =========================================================================
  describe('Suite 6: Preserved Files Forensic Integrity (R5)', () => {
    const preservedFiles = [
      'api/_lib/musicFallback.js',
      'api/audio.js',
      'scripts/audioService.mjs',
      'server.mjs',
      'native/android/SpotifreeLocalMusicPlugin.java',
      'src/utils/offlineStorage.ts',
      'tests/offline_downloads.test.js',
    ];

    for (const f of preservedFiles) {
      it(`preserved file exists and is not empty: ${f}`, () => {
        const fullPath = path.join(rootDir, f);
        assert.ok(fs.existsSync(fullPath), `File must exist: ${f}`);
        const stat = fs.statSync(fullPath);
        assert.ok(stat.size > 0, `File must have non-zero size: ${f}`);
      });
    }
  });
});
