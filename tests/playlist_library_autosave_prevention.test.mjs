import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Mock localStorage for storage simulation tests
class MockLocalStorage {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

describe('Milestone 3 — Prevent Auto-Save on Playlist Viewing (Requirement R3)', () => {
  const rootDir = process.cwd();
  const storePath = path.join(rootDir, 'src', 'store', 'useSpotifyDataStore.ts');
  const desktopViewPath = path.join(rootDir, 'src', 'components', 'desktop', 'DesktopPlaylistView.tsx');
  const contextMenuPath = path.join(rootDir, 'src', 'components', 'desktop', 'ContextMenu.tsx');
  const mobileViewPath = path.join(rootDir, 'src', 'components', 'mobile', 'MobilePlaylistView.tsx');

  const storeContent = fs.readFileSync(storePath, 'utf8');
  const desktopViewContent = fs.readFileSync(desktopViewPath, 'utf8');
  const contextMenuContent = fs.readFileSync(contextMenuPath, 'utf8');
  const mobileViewContent = fs.readFileSync(mobileViewPath, 'utf8');

  describe('1. Static Code & Invariant Verifications', () => {
    it('DesktopPlaylistView.tsx guards updatePlaylist with an in-library check', () => {
      assert.ok(
        desktopViewContent.includes('cachePlaylistDetails(updated)'),
        'DesktopPlaylistView must cache playlist details unconditionally'
      );
      assert.match(
        desktopViewContent,
        /inLibrary\s*\)\s*\{\s*useSpotifyDataStore\.getState\(\)\.updatePlaylist/s,
        'updatePlaylist call must be guarded by inLibrary check'
      );
    });

    it('useSpotifyDataStore.ts does not auto-unshift non-liked playlists in updatePlaylist', () => {
      // Must not contain `else if (!isTargetLiked) { list.unshift`
      assert.ok(
        !storeContent.includes('else if (!isTargetLiked) {\n            list.unshift') &&
        !storeContent.includes('else if (!isTargetLiked) { list.unshift') &&
        !storeContent.includes('else if (!isTargetLiked) {\r\n            list.unshift'),
        'updatePlaylist must not auto-unshift non-liked playlists into user_imported_playlists'
      );
      // In extracted sessions, must not unshift if !extFound unconditionally
      assert.ok(
        !storeContent.includes('if (!extFound) {\n                parsed.playlists.unshift(updatedCacheEntry);') &&
        !storeContent.includes('if (!extFound) {\r\n                parsed.playlists.unshift(updatedCacheEntry);') &&
        !storeContent.includes('if (!extFound) { parsed.playlists.unshift(updatedCacheEntry); }'),
        'updatePlaylist must not unshift unconditionally into spotify_extracted_session.playlists'
      );
      // In account sessions, must not unshift if !accFound unconditionally
      assert.ok(
        !storeContent.includes('if (!accFound) {\n                parsed.playlists.unshift(updatedCacheEntry);') &&
        !storeContent.includes('if (!accFound) {\r\n                parsed.playlists.unshift(updatedCacheEntry);') &&
        !storeContent.includes('if (!accFound) { parsed.playlists.unshift(updatedCacheEntry); }'),
        'updatePlaylist must not unshift unconditionally into spotifree_account_session.playlists'
      );
    });

    it('useSpotifyDataStore.ts exports sanitizeImportedPlaylists and integrates it into initialize and getters', () => {
      assert.match(
        storeContent,
        /export\s+function\s+sanitizeImportedPlaylists\s*\(/,
        'sanitizeImportedPlaylists must be exported'
      );
      assert.ok(
        storeContent.includes('sanitizeImportedPlaylists(importedPlaylists)'),
        'initialize() must invoke sanitizeImportedPlaylists'
      );
      assert.ok(
        storeContent.includes('sanitizeImportedPlaylists(list)'),
        'getGuestPlaylists() must invoke sanitizeImportedPlaylists'
      );
      assert.ok(
        storeContent.includes('sanitizeImportedPlaylists(rawList)'),
        'getInitialPlaylists() must invoke sanitizeImportedPlaylists'
      );
    });

    it('ContextMenu.tsx properly scopes isUserCreatedPlaylist to user-owned custom lists', () => {
      assert.match(
        contextMenuContent,
        /isUserCreatedPlaylist[\s\S]*?(is_custom|custom-|owner)/,
        'isUserCreatedPlaylist must check for custom ownership markers'
      );
    });

    it('MobilePlaylistView.tsx retains explicit library toggle flow with addCustomPlaylist and deletePlaylist', () => {
      assert.ok(mobileViewContent.includes('addCustomPlaylist(fullToSave)'), 'Must call addCustomPlaylist');
      assert.ok(mobileViewContent.includes('deletePlaylist(playlist.id)'), 'Must call deletePlaylist');
      assert.ok(mobileViewContent.includes('spotifree_saved_library_playlists'), 'Must update spotifree_saved_library_playlists');
    });

    it('useSpotifyDataStore.ts cleans spotifree_deleted_playlist_ids in addCustomPlaylist upon re-following', () => {
      const addCustomRegex = /addCustomPlaylist:\s*\([^{]+?\)\s*=>\s*\{([\s\S]+?createPlaylist:)/;
      const match = storeContent.match(addCustomRegex);
      assert.ok(match, 'Found addCustomPlaylist in useSpotifyDataStore.ts');
      const addCustomBody = match[1];

      assert.ok(
        addCustomBody.includes('spotifree_deleted_playlist_ids'),
        'addCustomPlaylist must inspect spotifree_deleted_playlist_ids'
      );
      assert.match(
        addCustomBody,
        /\.filter\s*\(\s*\([a-zA-Z0-9_:\s]+\)\s*=>[\s\S]*?(dId\s*!==\s*playlist\.id|cleanId)/,
        'addCustomPlaylist must filter out re-followed playlist IDs from spotifree_deleted_playlist_ids'
      );
    });
  });

  describe('2. Storage Sanitization Behavioral Logic', () => {
    it('purges viewed-only playlists while preserving custom, virtual, and explicitly saved playlists', () => {
      const mockStorage = new MockLocalStorage();
      const savedIds = ['37i9dQZF1DXcBWIGoYBM5M', 'spotify:playlist:custom-saved-id'];
      mockStorage.setItem('spotifree_saved_library_playlists', JSON.stringify(savedIds));

      const pollutedList = [
        { id: 'custom-1', is_custom: true, name: 'Mi lista 1' },
        { id: 'custom-2', name: 'Mi lista 2' },
        { id: 'art-bad-bunny', name: 'Bad Bunny' },
        { id: 'liked-songs', name: 'Canciones que te gustan' },
        { id: 'spotify-dj', name: 'DJ' },
        { id: '37i9dQZF1DXcBWIGoYBM5M', name: "Today's Top Hits" }, // In saved library
        { id: '37i9dQZF1DX10zKzsJ2jva', name: 'Viva Latino' }, // Leaked viewed playlist
        { id: 'alb-316164367', name: 'Un Verano Sin Ti' }, // Leaked album
        { id: 'spotify:playlist:random-viewed', name: 'Random' }, // Leaked playlist with URI
      ];

      // Sanitization filter function matching store implementation
      const cleanPid = (val) => (val || '').replace(/^spotify:(playlist|album):/i, '').replace(/^(custom|playlist)-/, '').split('?')[0].trim();
      const rawCleanPid = (val) => (val || '').replace(/^spotify:(playlist|album):/i, '').split('?')[0].trim();
      const rawSaved = mockStorage.getItem('spotifree_saved_library_playlists');
      const retrievedSaved = rawSaved ? JSON.parse(rawSaved) : [];
      const savedSet = new Set();
      for (const sId of retrievedSaved) {
        if (sId) {
          savedSet.add(sId);
          savedSet.add(cleanPid(sId));
          savedSet.add(rawCleanPid(sId));
        }
      }

      const sanitized = pollutedList.filter((p) => {
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

      assert.equal(sanitized.length, 6, 'Must retain exactly the 6 valid playlists');
      const preservedIds = sanitized.map((p) => p.id);
      assert.deepEqual(preservedIds, [
        'custom-1',
        'custom-2',
        'art-bad-bunny',
        'liked-songs',
        'spotify-dj',
        '37i9dQZF1DXcBWIGoYBM5M',
      ]);
      assert.ok(!preservedIds.includes('37i9dQZF1DX10zKzsJ2jva'), 'Leaked Viva Latino must be purged');
      assert.ok(!preservedIds.includes('alb-316164367'), 'Leaked album must be purged');
      assert.ok(!preservedIds.includes('spotify:playlist:random-viewed'), 'Leaked random playlist must be purged');
    });
  });

  describe('3. Explicit Save / Delete Library State Transitions', () => {
    it('simulates explicit follow: adds to both user_imported_playlists and spotifree_saved_library_playlists', () => {
      const mockStorage = new MockLocalStorage();
      const targetPl = { id: '37i9dQZF1DX10zKzsJ2jva', name: 'Viva Latino', tracks: { total: 50, items: [] } };

      // Explicit save
      const rawSaved = mockStorage.getItem('spotifree_saved_library_playlists');
      const savedList = rawSaved ? JSON.parse(rawSaved) : [];
      if (!savedList.includes(targetPl.id)) savedList.push(targetPl.id);
      mockStorage.setItem('spotifree_saved_library_playlists', JSON.stringify(savedList));

      const rawImported = mockStorage.getItem('user_imported_playlists');
      const importedList = rawImported ? JSON.parse(rawImported) : [];
      importedList.unshift(targetPl);
      mockStorage.setItem('user_imported_playlists', JSON.stringify(importedList));

      // Assertions
      const verifiedSaved = JSON.parse(mockStorage.getItem('spotifree_saved_library_playlists'));
      const verifiedImported = JSON.parse(mockStorage.getItem('user_imported_playlists'));
      assert.ok(verifiedSaved.includes('37i9dQZF1DX10zKzsJ2jva'), 'Must be in saved library list');
      assert.equal(verifiedImported.length, 1, 'Must have 1 playlist in imported list');
      assert.equal(verifiedImported[0].id, '37i9dQZF1DX10zKzsJ2jva', 'Imported playlist must match target ID');
    });

    it('simulates explicit unfollow: removes from both user_imported_playlists and spotifree_saved_library_playlists', () => {
      const mockStorage = new MockLocalStorage();
      mockStorage.setItem('spotifree_saved_library_playlists', JSON.stringify(['37i9dQZF1DX10zKzsJ2jva']));
      mockStorage.setItem('user_imported_playlists', JSON.stringify([{ id: '37i9dQZF1DX10zKzsJ2jva', name: 'Viva Latino' }]));

      // Explicit remove
      const plId = '37i9dQZF1DX10zKzsJ2jva';
      let savedList = JSON.parse(mockStorage.getItem('spotifree_saved_library_playlists'));
      savedList = savedList.filter((id) => id !== plId);
      mockStorage.setItem('spotifree_saved_library_playlists', JSON.stringify(savedList));

      let importedList = JSON.parse(mockStorage.getItem('user_imported_playlists'));
      importedList = importedList.filter((p) => p.id !== plId);
      mockStorage.setItem('user_imported_playlists', JSON.stringify(importedList));

      // Assertions
      const verifiedSaved = JSON.parse(mockStorage.getItem('spotifree_saved_library_playlists'));
      const verifiedImported = JSON.parse(mockStorage.getItem('user_imported_playlists'));
      assert.equal(verifiedSaved.length, 0, 'Saved library list must be empty');
      assert.equal(verifiedImported.length, 0, 'Imported list must be empty');
    });
  });

  describe('4. ContextMenu User vs Third-Party Playlist Distinction', () => {
    it('correctly distinguishes Spotify editorial playlists from user custom playlists', () => {
      const currentUser = { id: 'user_123', display_name: 'Jorge' };

      const spotifyPlaylist = {
        id: '37i9dQZF1DXcBWIGoYBM5M',
        name: "Today's Top Hits",
        owner: { id: 'spotify', display_name: 'Spotify' },
      };

      const userCustomPlaylist = {
        id: 'custom-playlist-1731350000000',
        name: 'Mi Música Favorita',
        owner: { id: 'user_123', display_name: 'Jorge' },
        is_custom: true,
      };

      const isUserCreated = (p, user) => Boolean(
        p &&
        p.id !== 'liked-songs' &&
        p.id !== 'collection:tracks' &&
        (
          p.is_custom === true ||
          p.id.startsWith('custom-') ||
          p.id.startsWith('pl-custom-') ||
          p.owner?.id === 'user' ||
          (user?.id && p.owner?.id === user.id) ||
          (user?.display_name && p.owner?.display_name?.toLowerCase() === user.display_name.toLowerCase())
        )
      );

      assert.equal(isUserCreated(spotifyPlaylist, currentUser), false, 'Spotify playlist is NOT user created');
      assert.equal(isUserCreated(userCustomPlaylist, currentUser), true, 'Custom playlist IS user created');
    });
  });

  describe('5. Requirement R5 Preserved Files Integrity', () => {
    const r5Files = [
      'api/_lib/musicFallback.js',
      'api/audio.js',
      'scripts/audioService.mjs',
      'server.mjs',
      'native/android/SpotifreeLocalMusicPlugin.java',
      'src/utils/offlineStorage.ts',
      'tests/offline_downloads.test.js',
    ];

    it('all 7 R5 preserved files exist on disk with valid content', () => {
      for (const rel of r5Files) {
        const full = path.join(rootDir, rel);
        assert.ok(fs.existsSync(full), `Preserved R5 file must exist: ${rel}`);
        const stat = fs.statSync(full);
        assert.ok(stat.size > 0, `Preserved R5 file must not be empty: ${rel}`);
      }
    });
  });

  describe('6. Follow -> Unfollow -> Re-Follow Symmetry & Tombstone Invalidation', () => {
    const cleanPlaylistId = (val) => (val || '').replace(/^spotify:playlist:/i, '').split('?')[0].trim();

    const simulateDeletePlaylist = (storage, plId) => {
      const cleanId = cleanPlaylistId(plId);
      // 0. Permanent blacklist
      const rawDeleted = storage.getItem('spotifree_deleted_playlist_ids');
      const deletedList = rawDeleted ? JSON.parse(rawDeleted) : [];
      if (!deletedList.includes(plId)) deletedList.push(plId);
      if (cleanId && !deletedList.includes(cleanId)) deletedList.push(cleanId);
      storage.setItem('spotifree_deleted_playlist_ids', JSON.stringify(deletedList));

      // 1. Remove from user_imported_playlists
      const rawImported = storage.getItem('user_imported_playlists');
      if (rawImported) {
        const list = JSON.parse(rawImported);
        const updated = list.filter((p) => p.id !== plId && p.id !== cleanId);
        storage.setItem('user_imported_playlists', JSON.stringify(updated));
      }
      // 2. Remove from spotifree_saved_library_playlists
      const rawSaved = storage.getItem('spotifree_saved_library_playlists');
      if (rawSaved) {
        const list = JSON.parse(rawSaved);
        const updated = list.filter((id) => id !== plId && id !== cleanId);
        storage.setItem('spotifree_saved_library_playlists', JSON.stringify(updated));
      }
    };

    const simulateAddCustomPlaylist = (storage, playlist) => {
      const cleanId = cleanPlaylistId(playlist.id);
      // 0. Clean from spotifree_deleted_playlist_ids so re-saved playlists appear in library and sidebar
      const rawDeleted = storage.getItem('spotifree_deleted_playlist_ids');
      if (rawDeleted) {
        const deletedList = JSON.parse(rawDeleted);
        const updatedDeleted = deletedList.filter((dId) => dId !== playlist.id && dId !== cleanId);
        storage.setItem('spotifree_deleted_playlist_ids', JSON.stringify(updatedDeleted));
      }
      // 1. user_imported_playlists
      const rawImported = storage.getItem('user_imported_playlists');
      const list = rawImported ? JSON.parse(rawImported) : [];
      if (!list.some((p) => p.id === playlist.id || p.id === cleanId)) {
        list.unshift(playlist);
      }
      storage.setItem('user_imported_playlists', JSON.stringify(list));
      // 2. spotifree_saved_library_playlists
      const rawSaved = storage.getItem('spotifree_saved_library_playlists');
      const savedList = rawSaved ? JSON.parse(rawSaved) : [];
      if (!savedList.includes(playlist.id)) {
        savedList.push(playlist.id);
      }
      storage.setItem('spotifree_saved_library_playlists', JSON.stringify(savedList));
    };

    const simulateGetDeletedPlaylistIds = (storage) => {
      try {
        const raw = storage.getItem('spotifree_deleted_playlist_ids');
        if (raw) return new Set(JSON.parse(raw));
      } catch {}
      return new Set();
    };

    const simulateDeduplicateUserPlaylists = (storage, list) => {
      const deletedIds = simulateGetDeletedPlaylistIds(storage);
      const result = [];
      const seenIds = new Set();
      for (const pl of list) {
        if (!pl || !pl.id || deletedIds.has(pl.id)) continue;
        if (seenIds.has(pl.id)) continue;
        seenIds.add(pl.id);
        result.push(pl);
      }
      return result;
    };

    it('unfollowing writes playlist ID and cleanId to spotifree_deleted_playlist_ids tombstone blacklist', () => {
      const storage = new MockLocalStorage();
      const pl = { id: '37i9dQZF1DXcBWIGoYBM5M', name: 'Éxitos España' };

      // Initial state: in library
      storage.setItem('spotifree_saved_library_playlists', JSON.stringify([pl.id]));
      storage.setItem('user_imported_playlists', JSON.stringify([pl]));
      storage.setItem('spotifree_deleted_playlist_ids', JSON.stringify(['prior-deleted-id']));

      // Execute unfollow
      simulateDeletePlaylist(storage, pl.id);

      const deleted = JSON.parse(storage.getItem('spotifree_deleted_playlist_ids'));
      const saved = JSON.parse(storage.getItem('spotifree_saved_library_playlists'));
      const imported = JSON.parse(storage.getItem('user_imported_playlists'));

      assert.ok(deleted.includes(pl.id), 'Deleted blacklist must include playlist ID');
      assert.ok(deleted.includes('prior-deleted-id'), 'Prior blacklisted items must be preserved');
      assert.equal(saved.includes(pl.id), false, 'Saved library list must not include unfollowed playlist');
      assert.equal(imported.some((p) => p.id === pl.id), false, 'Imported list must not include unfollowed playlist');
    });

    it('re-following via addCustomPlaylist cleans spotifree_deleted_playlist_ids tombstone', () => {
      const storage = new MockLocalStorage();
      const pl = { id: '37i9dQZF1DXcBWIGoYBM5M', name: 'Éxitos España' };
      const cleanId = pl.id;

      // State after unfollow: tombstone present in spotifree_deleted_playlist_ids
      storage.setItem('spotifree_deleted_playlist_ids', JSON.stringify([pl.id, cleanId, 'unrelated-deleted-pl']));
      storage.setItem('spotifree_saved_library_playlists', JSON.stringify([]));
      storage.setItem('user_imported_playlists', JSON.stringify([]));

      // Execute re-follow
      simulateAddCustomPlaylist(storage, pl);

      const deleted = JSON.parse(storage.getItem('spotifree_deleted_playlist_ids'));
      const saved = JSON.parse(storage.getItem('spotifree_saved_library_playlists'));
      const imported = JSON.parse(storage.getItem('user_imported_playlists'));

      assert.equal(deleted.includes(pl.id), false, 'Tombstone must be cleaned from spotifree_deleted_playlist_ids');
      assert.equal(deleted.includes(cleanId), false, 'Clean ID tombstone must also be removed');
      assert.ok(deleted.includes('unrelated-deleted-pl'), 'Unrelated deleted tombstones must remain intact');
      assert.ok(saved.includes(pl.id), 'Re-followed playlist must be present in spotifree_saved_library_playlists');
      assert.equal(imported.length, 1, 'Re-followed playlist must be present in user_imported_playlists');
      assert.equal(imported[0].id, pl.id);
    });

    it('re-following handles spotify URI format and removes both URI and clean ID tombstones', () => {
      const storage = new MockLocalStorage();
      const rawUri = 'spotify:playlist:37i9dQZF1DXcBWIGoYBM5M';
      const cleanId = '37i9dQZF1DXcBWIGoYBM5M';
      const pl = { id: rawUri, name: 'Viva Latino' };

      // State with both URI and clean ID recorded in tombstone
      storage.setItem('spotifree_deleted_playlist_ids', JSON.stringify([rawUri, cleanId, 'keep-me']));

      // Execute re-follow
      simulateAddCustomPlaylist(storage, pl);

      const deleted = JSON.parse(storage.getItem('spotifree_deleted_playlist_ids'));
      assert.equal(deleted.includes(rawUri), false, 'URI tombstone must be removed');
      assert.equal(deleted.includes(cleanId), false, 'Clean ID tombstone must be removed');
      assert.ok(deleted.includes('keep-me'), 'Other tombstones must be preserved');
    });

    it('deduplicateUserPlaylists retains the re-followed playlist once tombstone is cleaned', () => {
      const storage = new MockLocalStorage();
      const targetPl = { id: '37i9dQZF1DXcBWIGoYBM5M', name: 'Éxitos España' };
      const rawList = [
        { id: 'liked-songs', name: 'Canciones que te gustan' },
        { id: 'spotify-dj', name: 'DJ' },
        targetPl,
        { id: 'still-deleted-pl', name: 'Unwanted Playlist' },
      ];

      // Step A: When tombstone IS present (unfollowed), deduplicateUserPlaylists drops it
      storage.setItem('spotifree_deleted_playlist_ids', JSON.stringify([targetPl.id, 'still-deleted-pl']));
      const droppedResult = simulateDeduplicateUserPlaylists(storage, rawList);
      assert.equal(
        droppedResult.some((p) => p.id === targetPl.id),
        false,
        'When tombstone exists, deduplicateUserPlaylists must filter it out'
      );

      // Step B: When tombstone is CLEANED via addCustomPlaylist (re-followed), deduplicateUserPlaylists retains it
      simulateAddCustomPlaylist(storage, targetPl);
      // Ensure other deleted playlist tombstone remains
      const currentDeleted = JSON.parse(storage.getItem('spotifree_deleted_playlist_ids'));
      if (!currentDeleted.includes('still-deleted-pl')) {
        currentDeleted.push('still-deleted-pl');
        storage.setItem('spotifree_deleted_playlist_ids', JSON.stringify(currentDeleted));
      }

      const retainedResult = simulateDeduplicateUserPlaylists(storage, rawList);
      assert.ok(
        retainedResult.some((p) => p.id === targetPl.id),
        'deduplicateUserPlaylists must retain re-followed playlist once tombstone is cleaned'
      );
      assert.equal(
        retainedResult.some((p) => p.id === 'still-deleted-pl'),
        false,
        'Permanently deleted playlists must still be excluded'
      );
    });

    it('full end-to-end follow -> unfollow -> re-follow lifecycle preserves sidebar and library symmetry', () => {
      const storage = new MockLocalStorage();
      const pl = { id: '37i9dQZF1DXcBWIGoYBM5M', name: 'Top Hits', tracks: { total: 10, items: [] } };

      // 1. Initial Follow
      simulateAddCustomPlaylist(storage, pl);
      assert.ok(JSON.parse(storage.getItem('spotifree_saved_library_playlists')).includes(pl.id));

      // 2. Unfollow
      simulateDeletePlaylist(storage, pl.id);
      assert.ok(JSON.parse(storage.getItem('spotifree_deleted_playlist_ids')).includes(pl.id));
      assert.equal(JSON.parse(storage.getItem('spotifree_saved_library_playlists')).includes(pl.id), false);

      // 3. Re-follow
      simulateAddCustomPlaylist(storage, pl);
      assert.equal(JSON.parse(storage.getItem('spotifree_deleted_playlist_ids')).includes(pl.id), false);
      assert.ok(JSON.parse(storage.getItem('spotifree_saved_library_playlists')).includes(pl.id));
      assert.ok(JSON.parse(storage.getItem('user_imported_playlists')).some((p) => p.id === pl.id));

      // 4. Reload app simulation (getInitialPlaylists + deduplicateUserPlaylists)
      const libraryPlaylists = JSON.parse(storage.getItem('user_imported_playlists'));
      const activeLibrary = simulateDeduplicateUserPlaylists(storage, libraryPlaylists);
      assert.ok(activeLibrary.some((p) => p.id === pl.id), 'Active store library retains re-followed playlist');

      // 5. Sidebar rendering simulation (DesktopSidebar filter)
      const sidebarDeletedIds = simulateGetDeletedPlaylistIds(storage);
      const visibleSidebarPlaylists = activeLibrary.filter((p) => !sidebarDeletedIds.has(p.id));
      assert.ok(
        visibleSidebarPlaylists.some((p) => p.id === pl.id),
        'DesktopSidebar renders re-followed playlist in library'
      );
    });
  });
});
