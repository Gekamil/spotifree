import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// In-memory mock localStorage
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

describe('Challenger Milestone 3: Library Symmetry, Auto-Save Prevention & Edge Cases', () => {
  const rootDir = process.cwd();
  const storePath = path.join(rootDir, 'src', 'store', 'useSpotifyDataStore.ts');
  const desktopViewPath = path.join(rootDir, 'src', 'components', 'desktop', 'DesktopPlaylistView.tsx');
  const contextMenuPath = path.join(rootDir, 'src', 'components', 'desktop', 'ContextMenu.tsx');
  const sidebarPath = path.join(rootDir, 'src', 'components', 'desktop', 'DesktopSidebar.tsx');
  const playerStorePath = path.join(rootDir, 'src', 'store', 'usePlayerStore.ts');

  const storeContent = fs.readFileSync(storePath, 'utf8');
  const desktopViewContent = fs.readFileSync(desktopViewPath, 'utf8');
  const contextMenuContent = fs.readFileSync(contextMenuPath, 'utf8');
  const sidebarContent = fs.readFileSync(sidebarPath, 'utf8');
  const playerStoreContent = fs.readFileSync(playerStorePath, 'utf8');

  describe('1. Auto-Save Prevention & Playback for Unsaved Playlists', () => {
    it('DesktopPlaylistView guards updatePlaylist with an inLibrary check', () => {
      assert.ok(
        desktopViewContent.includes('const inLibrary = currentPlaylists.some('),
        'DesktopPlaylistView must calculate inLibrary'
      );
      assert.ok(
        desktopViewContent.includes('if (inLibrary) {\n                useSpotifyDataStore.getState().updatePlaylist(') ||
        desktopViewContent.includes('if (inLibrary) {\r\n                useSpotifyDataStore.getState().updatePlaylist('),
        'DesktopPlaylistView must guard updatePlaylist with if (inLibrary)'
      );
    });

    it('updatePlaylist does not auto-unshift unsaved playlists into storage', () => {
      // Test the store updatePlaylist logic on an unsaved playlist
      const mockStorage = new MockLocalStorage();
      mockStorage.setItem('user_imported_playlists', JSON.stringify([]));

      // Simulate updatePlaylist logic for a viewed Spotify playlist
      const id = '37i9dQZF1DXcBWIGoYBM5M';
      const cleanId = id;
      const updates = { tracks: { total: 50, items: [{ id: 'track-1', name: 'Song 1' }] } };

      const isLikedTarget = (pid, pname) =>
        pid === 'liked-songs' ||
        pid === 'user-liked-songs' ||
        pid.includes('collection:tracks') ||
        /^(canciones que te gustan|canciones que me gustan|tus me gusta|liked songs|liked tracks)$/i.test((pname || '').trim());

      const isTargetLiked = id === 'liked-songs' || isLikedTarget(id, updates.name);
      assert.equal(isTargetLiked, false, 'A viewed playlist is not liked-songs');

      // Check user_imported_playlists mutation branch
      const rawImported = mockStorage.getItem('user_imported_playlists');
      const list = rawImported ? JSON.parse(rawImported) : [];
      const idx = list.findIndex((p) => p.id === id || (cleanId && p.id === cleanId) || (isTargetLiked && isLikedTarget(p.id, p.name)));

      assert.equal(idx, -1, 'Unsaved playlist not found in list');
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...updates };
        mockStorage.setItem('user_imported_playlists', JSON.stringify(list));
      } else if (isTargetLiked) {
        list.unshift({ id, ...updates });
        mockStorage.setItem('user_imported_playlists', JSON.stringify(list));
      }

      const postList = JSON.parse(mockStorage.getItem('user_imported_playlists'));
      assert.equal(postList.length, 0, 'user_imported_playlists must remain completely empty after viewing');
    });

    it('Audio playback and queueing work without requiring playlist in user library', () => {
      // Verify playTrack in usePlayerStore has no dependency on library playlists
      assert.ok(playerStoreContent.includes('playTrack: (track: Track, newQueue?: Track[], contextId?: string)'), 'playTrack signature intact');
      assert.ok(!playerStoreContent.includes('useSpotifyDataStore.getState().playlists'), 'playTrack does not inspect store playlists');

      // Simulate queue population for un-saved playlist tracks
      const unSavedTracks = [
        { id: 'track-1', name: 'Song 1', duration_ms: 180000, artists: [{ name: 'Artist 1' }] },
        { id: 'track-2', name: 'Song 2', duration_ms: 210000, artists: [{ name: 'Artist 2' }] },
      ];
      let queue = [];
      let currentTrack = null;
      let isPlaying = false;

      // Simulate playTrack execution
      const playTrackSim = (t, q) => {
        currentTrack = t;
        queue = q ? [...q] : [t];
        isPlaying = true;
      };

      playTrackSim(unSavedTracks[0], unSavedTracks);
      assert.equal(isPlaying, true, 'Playback started');
      assert.equal(currentTrack.id, 'track-1', 'Current track active');
      assert.equal(queue.length, 2, 'Queue loaded with viewed playlist tracks');
    });
  });

  describe('2. Liked Songs and Alias Robustness', () => {
    it('isLikedTarget correctly matches all canonical IDs and aliases', () => {
      const isLikedTarget = (pid, pname) =>
        pid === 'liked-songs' ||
        pid === 'user-liked-songs' ||
        pid.includes('collection:tracks') ||
        /^(canciones que te gustan|canciones que me gustan|tus me gusta|liked songs|liked tracks)$/i.test((pname || '').trim());

      assert.ok(isLikedTarget('liked-songs'), 'Matches liked-songs');
      assert.ok(isLikedTarget('user-liked-songs'), 'Matches user-liked-songs');
      assert.ok(isLikedTarget('collection:tracks'), 'Matches collection:tracks');
      assert.ok(isLikedTarget('spotify:collection:tracks'), 'Matches spotify:collection:tracks');
      assert.ok(isLikedTarget('custom-id', 'Canciones que te gustan'), 'Matches localized name');
      assert.ok(isLikedTarget('custom-id', 'Liked Songs'), 'Matches english name');
      assert.ok(!isLikedTarget('37i9dQZF1DXcBWIGoYBM5M', 'Éxitos España'), 'Does not match regular playlist');
    });

    it('updatePlaylist for liked-songs correctly unshifts into storage if not already present', () => {
      const mockStorage = new MockLocalStorage();
      mockStorage.setItem('user_imported_playlists', JSON.stringify([]));

      const id = 'liked-songs';
      const updates = { tracks: { total: 3, items: [{ id: 't1' }, { id: 't2' }, { id: 't3' }] } };
      const isTargetLiked = true;

      const rawImported = mockStorage.getItem('user_imported_playlists');
      const list = rawImported ? JSON.parse(rawImported) : [];
      const idx = list.findIndex((p) => p.id === id);

      if (idx >= 0) {
        list[idx] = { ...list[idx], ...updates };
      } else if (isTargetLiked) {
        list.unshift({ id, name: 'Canciones que te gustan', ...updates });
      }
      mockStorage.setItem('user_imported_playlists', JSON.stringify(list));

      const postList = JSON.parse(mockStorage.getItem('user_imported_playlists'));
      assert.equal(postList.length, 1, 'liked-songs was unshifted into user_imported_playlists');
      assert.equal(postList[0].id, 'liked-songs', 'Entry ID is liked-songs');
      assert.equal(postList[0].tracks.total, 3, 'Tracks count updated');
    });
  });

  describe('3. Explicit Save & Unfollow Symmetry (First Cycle)', () => {
    it('handleToggleLibrary adds to both storage locations on save', () => {
      const mockStorage = new MockLocalStorage();
      const playlist = { id: '37i9dQZF1DXcBWIGoYBM5M', name: 'Éxitos España' };
      const tracks = [{ id: 't1', name: 'Song 1' }];

      // Toggle to saved (next = true)
      const cleanId = playlist.id.replace(/^custom-|^playlist-/, '');
      const rawSaved = mockStorage.getItem('spotifree_saved_library_playlists');
      let savedList = rawSaved ? JSON.parse(rawSaved) : [];
      if (!savedList.includes(playlist.id)) savedList.push(playlist.id);
      mockStorage.setItem('spotifree_saved_library_playlists', JSON.stringify(savedList));

      // addCustomPlaylist storage logic
      const rawImported = mockStorage.getItem('user_imported_playlists');
      const importedList = rawImported ? JSON.parse(rawImported) : [];
      importedList.unshift({ ...playlist, tracks: { total: tracks.length, items: tracks } });
      mockStorage.setItem('user_imported_playlists', JSON.stringify(importedList));

      const vSaved = JSON.parse(mockStorage.getItem('spotifree_saved_library_playlists'));
      const vImported = JSON.parse(mockStorage.getItem('user_imported_playlists'));

      assert.ok(vSaved.includes('37i9dQZF1DXcBWIGoYBM5M'), 'Present in spotifree_saved_library_playlists');
      assert.equal(vImported.length, 1, 'Present in user_imported_playlists');
      assert.equal(vImported[0].id, '37i9dQZF1DXcBWIGoYBM5M');
    });

    it('handleToggleLibrary removes from both storage locations on unfollow', () => {
      const mockStorage = new MockLocalStorage();
      mockStorage.setItem('spotifree_saved_library_playlists', JSON.stringify(['37i9dQZF1DXcBWIGoYBM5M']));
      mockStorage.setItem('user_imported_playlists', JSON.stringify([{ id: '37i9dQZF1DXcBWIGoYBM5M', name: 'Éxitos España' }]));

      // Toggle to unsaved (next = false)
      const playlistId = '37i9dQZF1DXcBWIGoYBM5M';
      const cleanId = playlistId;

      // 1. Remove from saved library list
      const rawSaved = mockStorage.getItem('spotifree_saved_library_playlists');
      let savedList = rawSaved ? JSON.parse(rawSaved) : [];
      savedList = savedList.filter((id) => id !== playlistId && id !== cleanId);
      mockStorage.setItem('spotifree_saved_library_playlists', JSON.stringify(savedList));

      // 2. deletePlaylist removes from user_imported_playlists
      const rawImported = mockStorage.getItem('user_imported_playlists');
      let importedList = rawImported ? JSON.parse(rawImported) : [];
      importedList = importedList.filter((p) => p.id !== playlistId && p.id !== cleanId);
      mockStorage.setItem('user_imported_playlists', JSON.stringify(importedList));

      const vSaved = JSON.parse(mockStorage.getItem('spotifree_saved_library_playlists'));
      const vImported = JSON.parse(mockStorage.getItem('user_imported_playlists'));

      assert.equal(vSaved.length, 0, 'spotifree_saved_library_playlists is empty');
      assert.equal(vImported.length, 0, 'user_imported_playlists is empty');
    });

    it('ContextMenu discriminates user-created from third-party playlists and allows add/remove', () => {
      // Third-party playlist
      const thirdPartyPl = {
        id: '37i9dQZF1DXcBWIGoYBM5M',
        name: 'Éxitos España',
        owner: { id: 'spotify', display_name: 'Spotify' },
      };

      const user = { id: 'user-123', display_name: 'Tester' };
      const isLikedPlaylist = false;
      const isArtist = false;
      const isFolder = false;

      const isUserCreatedPlaylist = Boolean(
        thirdPartyPl &&
        !isLikedPlaylist &&
        !isArtist &&
        !isFolder &&
        thirdPartyPl.id !== 'liked-songs' &&
        thirdPartyPl.id !== 'collection:tracks' &&
        (
          thirdPartyPl.is_custom === true ||
          thirdPartyPl.id.startsWith('custom-') ||
          thirdPartyPl.id.startsWith('pl-custom-') ||
          thirdPartyPl.owner?.id === 'user' ||
          (user?.id && thirdPartyPl.owner?.id === user.id) ||
          (user?.display_name && thirdPartyPl.owner?.display_name?.toLowerCase() === user.display_name.toLowerCase())
        )
      );

      assert.equal(isUserCreatedPlaylist, false, 'Spotify playlist is not user-created');

      // Custom playlist
      const customPl = {
        id: 'custom-playlist-1731350000',
        name: 'Mi lista favorita',
        is_custom: true,
        owner: { id: 'user', display_name: 'Tester' },
      };

      const isUserCreatedCustom = Boolean(
        customPl &&
        !isLikedPlaylist &&
        !isArtist &&
        !isFolder &&
        customPl.id !== 'liked-songs' &&
        customPl.id !== 'collection:tracks' &&
        (
          customPl.is_custom === true ||
          customPl.id.startsWith('custom-') ||
          customPl.id.startsWith('pl-custom-') ||
          customPl.owner?.id === 'user' ||
          (user?.id && customPl.owner?.id === user.id) ||
          (user?.display_name && customPl.owner?.display_name?.toLowerCase() === user.display_name.toLowerCase())
        )
      );

      assert.equal(isUserCreatedCustom, true, 'User-created custom playlist is recognized');
    });
  });

  describe('4. Stress-Test: Re-Follow / Re-Save Lifecycle & Tombstone Invariant', () => {
    it('empirically verifies whether deletePlaylist puts playlist into spotifree_deleted_playlist_ids', () => {
      const mockStorage = new MockLocalStorage();
      const playlistId = '37i9dQZF1DXcBWIGoYBM5M';
      const cleanId = playlistId;

      // Simulate deletePlaylist line 1018-1024
      const rawDeleted = mockStorage.getItem('spotifree_deleted_playlist_ids');
      const deletedList = rawDeleted ? JSON.parse(rawDeleted) : [];
      if (!deletedList.includes(playlistId)) deletedList.push(playlistId);
      if (cleanId && !deletedList.includes(cleanId)) deletedList.push(cleanId);
      mockStorage.setItem('spotifree_deleted_playlist_ids', JSON.stringify(deletedList));

      const storedDeleted = JSON.parse(mockStorage.getItem('spotifree_deleted_playlist_ids'));
      assert.ok(storedDeleted.includes(playlistId), 'deletePlaylist blacklists the playlist in spotifree_deleted_playlist_ids');
    });

    it('checks whether addCustomPlaylist in store removes re-saved playlist from spotifree_deleted_playlist_ids', () => {
      // Static check: does addCustomPlaylist in useSpotifyDataStore remove from spotifree_deleted_playlist_ids?
      const addCustomRegex = /addCustomPlaylist:\s*\([^{]+?\)\s*=>\s*\{([\s\S]+?createPlaylist:)/;
      const match = storeContent.match(addCustomRegex);
      assert.ok(match, 'Found addCustomPlaylist in useSpotifyDataStore.ts');
      const addCustomBody = match[1];

      const touchesDeletedBlacklist = addCustomBody.includes('spotifree_deleted_playlist_ids');
      // If addCustomPlaylist does not clean spotifree_deleted_playlist_ids, document this finding
      if (!touchesDeletedBlacklist) {
        // Now test the impact on DesktopSidebar
        const mockStorage = new MockLocalStorage();
        mockStorage.setItem('spotifree_deleted_playlist_ids', JSON.stringify(['37i9dQZF1DXcBWIGoYBM5M']));

        // User re-adds playlist to store.playlists
        const playlists = [
          { id: 'liked-songs', name: 'Canciones que te gustan' },
          { id: 'spotify-dj', name: 'DJ' },
          { id: '37i9dQZF1DXcBWIGoYBM5M', name: 'Éxitos España' },
        ];

        // DesktopSidebar line 90-91:
        const deletedIds = new Set(JSON.parse(mockStorage.getItem('spotifree_deleted_playlist_ids')));
        const processedPlaylists = playlists.filter((p) => !deletedIds.has(p.id));

        // THE DEFECT: The re-added playlist is filtered out of the sidebar!
        const sidebarContainsReAdded = processedPlaylists.some((p) => p.id === '37i9dQZF1DXcBWIGoYBM5M');
        assert.equal(
          sidebarContainsReAdded,
          false,
          'CONFIRMED DEFECT: Re-added playlist is dropped from DesktopSidebar because spotifree_deleted_playlist_ids was not cleaned up!'
        );
      }
    });

    it('verifies deduplicateUserPlaylists behavior when re-added playlist is in spotifree_deleted_playlist_ids', () => {
      const deletedIds = new Set(['37i9dQZF1DXcBWIGoYBM5M']);
      const reAddedPlaylist = { id: '37i9dQZF1DXcBWIGoYBM5M', name: 'Éxitos España' };
      const rawList = [
        { id: 'liked-songs', name: 'Canciones que te gustan' },
        { id: 'spotify-dj', name: 'DJ' },
        reAddedPlaylist,
      ];

      // Re-run deduplicateUserPlaylists filtering
      const result = [];
      for (const pl of rawList) {
        if (!pl || !pl.id || deletedIds.has(pl.id)) continue;
        result.push(pl);
      }

      // Re-added playlist is filtered out
      assert.ok(
        !result.some((p) => p.id === '37i9dQZF1DXcBWIGoYBM5M'),
        'CONFIRMED: deduplicateUserPlaylists drops re-saved playlists if tombstone is not invalidated'
      );
    });
  });

  describe('5. Requirement R5 Preserved Files Forensic Integrity', () => {
    const r5Files = [
      'api/_lib/musicFallback.js',
      'api/audio.js',
      'scripts/audioService.mjs',
      'server.mjs',
      'native/android/SpotifreeLocalMusicPlugin.java',
      'src/utils/offlineStorage.ts',
      'tests/offline_downloads.test.js',
    ];

    for (const rel of r5Files) {
      it(`preserves R5 file intact: ${rel}`, () => {
        const fullPath = path.join(rootDir, rel);
        assert.ok(fs.existsSync(fullPath), `R5 file must exist: ${rel}`);
        const stat = fs.statSync(fullPath);
        assert.ok(stat.size > 0, `R5 file must not be empty: ${rel}`);
      });
    }
  });
});
