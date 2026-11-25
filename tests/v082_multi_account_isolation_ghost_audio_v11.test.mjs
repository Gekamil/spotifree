import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

// Mock minimal browser storage before loading Zustand stores & services
const storageMap = new Map();
if (!globalThis.window) {
  globalThis.window = {
    location: { origin: 'http://localhost', search: '', pathname: '/', hash: '' },
    localStorage: {
      getItem: (k) => (storageMap.has(k) ? storageMap.get(k) : null),
      setItem: (k, v) => storageMap.set(k, String(v)),
      removeItem: (k) => storageMap.delete(k),
      clear: () => storageMap.clear(),
    },
    sessionStorage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  };
}
if (!globalThis.localStorage) {
  globalThis.localStorage = globalThis.window.localStorage;
}
if (!globalThis.document) {
  globalThis.document = {
    hidden: false,
    title: 'Spotifree',
    addEventListener: () => {},
    removeEventListener: () => {},
    createElement: () => ({}),
  };
}
if (!globalThis.Audio) {
  globalThis.Audio = class MockAudio {
    constructor() {
      this.volume = 1;
      this.muted = false;
      this.paused = true;
      this.currentTime = 0;
      this.duration = 0;
      this.src = '';
    }
    addEventListener() {}
    removeEventListener() {}
    pause() { this.paused = true; }
    play() { this.paused = false; return Promise.resolve(); }
    load() {}
    removeAttribute() {}
  };
}
if (!globalThis.CustomEvent) {
  globalThis.CustomEvent = class CustomEvent extends Event {
    constructor(type, params) {
      super(type, params);
      this.detail = params?.detail;
    }
  };
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    const parent = context.parentURL || '';
    const isProjectFile = !parent.includes('/node_modules/') && !parent.includes('\\node_modules\\');
    if (isProjectFile && (specifier.startsWith('./') || specifier.startsWith('../')) && !/\.[a-z0-9]+$/i.test(specifier) && parent) {
      for (const ext of ['.ts', '.tsx', '.js']) {
        const candidate = new URL(`${specifier}${ext}`, parent);
        if (fs.existsSync(fileURLToPath(candidate))) {
          return nextResolve(candidate.href, context);
        }
      }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.endsWith('.json') && !url.includes('/node_modules/')) {
      const jsonContent = fs.readFileSync(fileURLToPath(url), 'utf8');
      return {
        format: 'module',
        shortCircuit: true,
        source: `export default ${jsonContent};`,
      };
    }
    if ((url.endsWith('.tsx') || url.endsWith('.ts')) && !url.includes('/node_modules/')) {
      const source = fs
        .readFileSync(fileURLToPath(url), 'utf8')
        .replace(/\bimport\.meta\.env\b/g, '({})');
      const transpiled = ts.transpileModule(source, {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.React,
        },
        fileName: fileURLToPath(url),
      });
      return {
        format: 'module',
        shortCircuit: true,
        source: transpiled.outputText,
      };
    }
    return nextLoad(url, context);
  },
});

const { getRecentSearches, addRecentSearch, clearRecentSearches, getRecentSearchesStorageKey } = await import('../src/utils/recentSearches');
const { getActiveUserId, setActiveUserId, clearActiveUserId } = await import('../src/utils/userStorage');
const { shouldApplyRemotePlayback } = await import('../src/services/playbackSync');
const { useSpotifyDataStore, sanitizeImportedPlaylists, slimPlaylistForStorage } = await import('../src/store/useSpotifyDataStore');
const { reconcileAccountWithLocalSnapshot } = await import('../src/services/spotifreeAuth');

describe('Spotifree v1.1 Multi-Account Isolation and Ghost Audio Elimination', () => {
  beforeEach(() => {
    storageMap.clear();
  });

  it('1. Version 1.1 release metadata and changelog verification', () => {
    const pkg = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8'));
    const changelog = fs.readFileSync(path.resolve('src/data/changelog.ts'), 'utf8');

    assert.equal(pkg.version, '1.1.0');
    assert.ok(changelog.includes("export const APP_VERSION = '1.1';"));
    assert.ok(changelog.includes("version: '1.1'"));
    assert.ok(changelog.includes('Aislamiento estricto multicuenta'));
    assert.ok(changelog.includes('Eliminación de audio fantasma'));
  });

  it('2. Recent searches storage key isolation between different user IDs', () => {
    assert.equal(getRecentSearchesStorageKey('user_alpha'), 'spotifree_recent_searches_user_alpha');
    assert.equal(getRecentSearchesStorageKey('user_beta'), 'spotifree_recent_searches_user_beta');
    assert.equal(getRecentSearchesStorageKey(''), 'spotifree_recent_searches_guest');

    setActiveUserId('user_alpha');
    assert.equal(getActiveUserId(), 'user_alpha');
    assert.equal(getRecentSearchesStorageKey(), 'spotifree_recent_searches_user_alpha');

    setActiveUserId('user_beta');
    assert.equal(getActiveUserId(), 'user_beta');
    assert.equal(getRecentSearchesStorageKey(), 'spotifree_recent_searches_user_beta');

    clearActiveUserId();
    assert.equal(getActiveUserId(), 'guest');
  });

  it('3. Recent searches queries do not leak across accounts', () => {
    setActiveUserId('user_alpha');
    addRecentSearch({ id: 'q1', type: 'query', title: 'Rosalia', subtitle: '' }, 'user_alpha');
    addRecentSearch({ id: 't1', type: 'track', title: 'Despecha', subtitle: 'Cancion • Rosalia' }, 'user_alpha');

    const alphaSearches = getRecentSearches('user_alpha');
    assert.equal(alphaSearches.length, 2);
    assert.equal(alphaSearches[0].title, 'Despecha');
    assert.equal(alphaSearches[1].title, 'Rosalia');

    // Switch to user_beta: beta must have zero searches
    setActiveUserId('user_beta');
    const betaSearchesInitial = getRecentSearches('user_beta');
    assert.equal(betaSearchesInitial.length, 0);

    // Add search for beta
    addRecentSearch({ id: 'q2', type: 'query', title: 'Metallica', subtitle: '' }, 'user_beta');
    const betaSearches = getRecentSearches('user_beta');
    assert.equal(betaSearches.length, 1);
    assert.equal(betaSearches[0].title, 'Metallica');

    // Verify alpha searches remain pristine and isolated
    const alphaSearchesCheck = getRecentSearches('user_alpha');
    assert.equal(alphaSearchesCheck.length, 2);
    assert.equal(alphaSearchesCheck[0].title, 'Despecha');
    assert.equal(alphaSearchesCheck[1].title, 'Rosalia');

    // Clearing beta searches does not affect alpha
    clearRecentSearches('user_beta');
    assert.equal(getRecentSearches('user_beta').length, 0);
    assert.equal(getRecentSearches('user_alpha').length, 2);
  });

  it('4. Remote playback decision rejects foreign or stale snapshots and prevents ghost playback', () => {
    const localDeviceId = 'device-web-pc';

    // Snapshot missing currentTrack or id must be rejected
    assert.equal(
      shouldApplyRemotePlayback({
        remote: null,
        localDeviceId,
        isLocallyPlaying: false,
        hasLocalCurrentTrack: false,
        lastLocalInteractionAt: 0,
        lastAppliedRemoteAt: 0,
      }),
      false
    );

    // Snapshot from same device while already loaded is rejected
    assert.equal(
      shouldApplyRemotePlayback({
        remote: {
          version: 1,
          updatedAt: 1000,
          deviceId: localDeviceId,
          wasPlaying: false,
          progressMs: 5000,
          durationMs: 200000,
          currentContextId: null,
          currentContextName: null,
          shuffleMode: 'off',
          isShuffle: false,
          repeatMode: 'off',
          playedInShuffle: [],
          preselectedNextTrackId: null,
          currentTrack: { id: 'track_1', name: 'Song 1' },
          queue: [],
          originalQueue: [],
          djState: null,
        },
        localDeviceId,
        isLocallyPlaying: false,
        hasLocalCurrentTrack: true,
        lastLocalInteractionAt: 500,
        lastAppliedRemoteAt: 0,
      }),
      false
    );

    // If locally playing, never overwrite with remote snapshot
    assert.equal(
      shouldApplyRemotePlayback({
        remote: {
          version: 1,
          updatedAt: 2000,
          deviceId: 'device-phone',
          wasPlaying: true,
          progressMs: 5000,
          durationMs: 200000,
          currentContextId: null,
          currentContextName: null,
          shuffleMode: 'off',
          isShuffle: false,
          repeatMode: 'off',
          playedInShuffle: [],
          preselectedNextTrackId: null,
          currentTrack: { id: 'track_remote', name: 'Remote Song' },
          queue: [],
          originalQueue: [],
          djState: null,
        },
        localDeviceId,
        isLocallyPlaying: true,
        hasLocalCurrentTrack: true,
        lastLocalInteractionAt: 1000,
        lastAppliedRemoteAt: 0,
      }),
      false
    );

    // Remote snapshot strictly newer than local interaction on another device is accepted
    assert.equal(
      shouldApplyRemotePlayback({
        remote: {
          version: 1,
          updatedAt: 3000,
          deviceId: 'device-phone',
          wasPlaying: false,
          progressMs: 12000,
          durationMs: 200000,
          currentContextId: null,
          currentContextName: null,
          shuffleMode: 'all',
          isShuffle: true,
          repeatMode: 'off',
          playedInShuffle: [],
          preselectedNextTrackId: null,
          currentTrack: { id: 'track_remote', name: 'Remote Song' },
          queue: [],
          originalQueue: [],
          djState: null,
        },
        localDeviceId,
        isLocallyPlaying: false,
        hasLocalCurrentTrack: true,
        lastLocalInteractionAt: 2000,
        lastAppliedRemoteAt: 0,
      }),
      true
    );
  });

  it('5. Source code audits verify complete isolation in auth and playback sync', () => {
    const authSrc = fs.readFileSync(path.resolve('src/services/spotifreeAuth.ts'), 'utf8');
    const syncSrc = fs.readFileSync(path.resolve('src/services/playbackSync.ts'), 'utf8');
    const audioControllerSrc = fs.readFileSync(path.resolve('src/components/common/AudioController.tsx'), 'utf8');

    // Check getLocalDataToMerge targetUid guard
    assert.ok(authSrc.includes('targetUid && activeUser !== targetUid'));

    // Check logout teardown
    assert.ok(authSrc.includes('audioEngine.pause()'));
    assert.ok(authSrc.includes('audioEngine.resetForRestoredTrack()'));
    assert.ok(authSrc.includes('resetSpotifreeMixes()'));
    assert.ok(authSrc.includes('resetPlaybackSyncCoordinator()'));
    assert.ok(authSrc.includes('notifyRecentSearchesUpdated([])'));

    // Check playback sync user isolation
    assert.ok(syncSrc.includes('expectedUid && parsed.uid && parsed.uid !== expectedUid'));
    assert.ok(syncSrc.includes('remote.uid && activeUid && remote.uid !== activeUid'));
    assert.ok(syncSrc.includes('snap.uid && currentUid && snap.uid !== currentUid'));

    // Check AudioController null safety to prevent ghost audio
    assert.ok(audioControllerSrc.includes('if (!currentTrack) {'));
    assert.ok(audioControllerSrc.includes('lastTrackIdRef.current = null;'));
  });

  it('6. APK library playlist persistence survives close/reopen via synchronous storage and slimming', () => {
    window.localStorage.setItem('spotifree_active_user_id', 'apk_user_1');
    window.localStorage.setItem(
      'spotifree_current_cloud_account',
      JSON.stringify({
        uid: 'apk_user_1',
        email: 'user@example.com',
        displayName: 'User',
        playlists: [],
        likedTracks: [],
        updatedAt: 1000,
      })
    );

    const externalPlaylist = {
      id: '37i9dQZF1DXcBWIGoYBM5M',
      name: 'Exitos Espana',
      description: 'Editorial playlist',
      images: [{ url: 'https://example.com/cover.jpg' }],
      owner: { id: 'spotify', display_name: 'Spotify' },
      tracks: {
        total: 1,
        items: [
          {
            id: 'trk_1',
            name: 'Track One',
            duration_ms: 195000,
            available_markets: new Array(180).fill('ES'),
            artists: [{ id: 'art_1', name: 'Artist One', external_urls: { spotify: 'x' } }],
            album: {
              id: 'alb_1',
              name: 'Album One',
              available_markets: new Array(180).fill('ES'),
              images: [{ url: 'https://example.com/t1.jpg' }],
            },
          },
        ],
      },
    };

    useSpotifyDataStore.getState().addCustomPlaylist(externalPlaylist);

    const savedIds = JSON.parse(window.localStorage.getItem('spotifree_saved_library_playlists') || '[]');
    assert.ok(savedIds.includes('37i9dQZF1DXcBWIGoYBM5M'));

    const imported = JSON.parse(window.localStorage.getItem('user_imported_playlists') || '[]');
    assert.equal(imported.length, 1);
    assert.equal(imported[0].id, '37i9dQZF1DXcBWIGoYBM5M');
    assert.equal(imported[0].is_saved_in_library, true);
    assert.equal(imported[0].tracks.items[0].available_markets, undefined);

    const cloudAcc = JSON.parse(window.localStorage.getItem('spotifree_current_cloud_account') || '{}');
    assert.equal(cloudAcc.playlists.length, 1);
    assert.equal(cloudAcc.playlists[0].id, '37i9dQZF1DXcBWIGoYBM5M');
    assert.ok(cloudAcc.updatedAt > 1000);
  });

  it('7. sanitizeImportedPlaylists keeps saved external playlists and drops unsaved previews', () => {
    window.localStorage.setItem('spotifree_saved_library_playlists', JSON.stringify(['sf-daily-mix-1', 'ext-pl-99']));
    const raw = [
      { id: 'sf-daily-mix-1', name: 'Daily Mix 1', tracks: { total: 0, items: [] } },
      { id: 'spotify:playlist:ext-pl-99', name: 'External Saved', tracks: { total: 0, items: [] } },
      { id: 'marked-saved', name: 'Marked Saved', is_saved_in_library: true, tracks: { total: 0, items: [] } },
      { id: 'unsaved-preview-123', name: 'Just Browsed', tracks: { total: 0, items: [] } },
    ];

    const kept = sanitizeImportedPlaylists(raw).map((p) => p.id);
    assert.deepEqual(kept, ['sf-daily-mix-1', 'spotify:playlist:ext-pl-99', 'marked-saved']);

    const slimmed = slimPlaylistForStorage({
      id: 'pl-slim',
      name: 'Slim Test',
      images: [{ url: 'https://img.test/a.jpg' }, { url: 'https://img.test/b.jpg' }],
      tracks: {
        total: 1,
        items: [
          {
            id: 't1',
            name: 'Song',
            duration_ms: 120000,
            available_markets: ['US', 'ES'],
            artists: [{ id: 'a1', name: 'Artist' }],
            album: { id: 'al1', name: 'Alb', images: [{ url: 'https://img.test/c.jpg' }] },
          },
        ],
      },
    });
    assert.equal(slimmed.images.length, 1);
    assert.equal(slimmed.tracks.items[0].available_markets, undefined);
  });

  it('8. Reconcile keeps newer local playlist saves when APK reopens before cloud caught up', () => {
    const cloudOlder = {
      uid: 'apk_user_1',
      email: 'user@example.com',
      displayName: 'User',
      playlists: [],
      deletedPlaylistIds: [],
      likedTracks: [],
      updatedAt: 1000,
    };
    const localNewer = {
      uid: 'apk_user_1',
      email: 'user@example.com',
      displayName: 'User',
      playlists: [{ id: 'saved-before-exit', name: 'Saved Right Before Close', tracks: { total: 0, items: [] } }],
      deletedPlaylistIds: [],
      likedTracks: [],
      updatedAt: 5000,
    };

    const resNewerLocal = reconcileAccountWithLocalSnapshot(cloudOlder, localNewer);
    assert.equal(resNewerLocal.hasNewerLocal, true);
    assert.equal(resNewerLocal.account.playlists.length, 1);
    assert.equal(resNewerLocal.account.playlists[0].id, 'saved-before-exit');

    const cloudNewer = { ...cloudOlder, playlists: [{ id: 'cloud-pl', name: 'Cloud', tracks: { total: 0, items: [] } }], updatedAt: 9000 };
    const resNewerCloud = reconcileAccountWithLocalSnapshot(cloudNewer, localNewer);
    assert.equal(resNewerCloud.hasNewerLocal, false);
    assert.equal(resNewerCloud.account.playlists[0].id, 'cloud-pl');
  });
});
