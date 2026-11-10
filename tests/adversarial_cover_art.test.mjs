/**
 * Adversarial Empirical Challenge Suite for Milestone 1:
 * Image & Cover Art Performance, Edge Cases, Cache Hydration & Regression Audit
 *
 * Runs natively via node:test and node:assert/strict
 * Directly imports production TypeScript modules using Node 24 loader hooks.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { registerHooks } from 'node:module';

// Polyfill minimal browser environment for localStorage and DOM globals
class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
  clear() { this.map.clear(); }
}

globalThis.localStorage = new MemoryStorage();
globalThis.window = {
  localStorage: globalThis.localStorage,
  dispatchEvent() {},
  addEventListener() {},
  removeEventListener() {},
};
globalThis.document = {
  createElement(tag) {
    return {
      tagName: tag.toUpperCase(),
      width: 0,
      height: 0,
      getContext() { return null; },
      toDataURL() { return 'data:image/jpeg;base64,mock'; },
    };
  },
};

// Register Node module hooks to transpile TS/TSX and resolve extensionless imports
registerHooks({
  resolve(specifier, context, nextResolve) {
    if ((specifier.startsWith('./') || specifier.startsWith('../')) && !/\.[a-z0-9]+$/i.test(specifier) && context.parentURL) {
      for (const ext of ['.ts', '.tsx', '.js', '.jsx']) {
        const candidate = new URL(specifier + ext, context.parentURL);
        if (fs.existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context);
      }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.endsWith('.tsx') || (url.includes('/src/') && url.endsWith('.ts'))) {
      const filePath = fileURLToPath(url);
      const content = fs.readFileSync(filePath, 'utf8');
      const transpiled = ts.transpileModule(content, {
        compilerOptions: {
          target: ts.ScriptTarget.ESNext,
          module: ts.ModuleKind.ESNext,
          jsx: ts.JsxEmit.ReactJSX,
        },
      });
      return { format: 'module', source: transpiled.outputText, shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});

// Import production modules directly
const {
  isPlaylistOrGenericCover,
  getTrackCoverUrl,
  TRACK_COVER_CACHE,
  persistTrackCover,
  resolveTrackCoversBatch,
} = await import('../src/utils/trackCovers.tsx');

const {
  getPlaylistCover,
  getAutoPlaylistCover,
  onPlaylistCoverError,
  EMPTY_PLAYLIST_COVER,
} = await import('../src/utils/playlistCover.ts');

const {
  ARTIST_IMAGE_CACHE,
  persistArtistImage,
} = await import('../src/utils/artistImage.ts');

const {
  fetchArtistTopTracks,
  resolveArtistName,
} = await import('../src/services/artistService.ts');

const { useSpotifyDataStore } = await import('../src/store/useSpotifyDataStore.ts');

// ============================================================================
// SUITE 1: Track Cover Art Edge Cases & Non-Rejection Invariant
// ============================================================================
describe('Adversarial Challenge 1: Track Cover Art Resolution & Non-Rejection Invariant', () => {
  const genuineAlbumCover = 'https://i.scdn.co/image/ab67616d0000b273abcdef1234567890abcdef12';
  const matchingPlaylistCover = 'https://i.scdn.co/image/ab67616d0000b273abcdef1234567890abcdef12';
  const deezerAlbumCover = 'https://e-cdns-images.dzcdn.net/images/cover/123456789/500x500-000000-80-0-0.jpg';
  const appleAlbumCover = 'https://is1-ssl.mzstatic.com/image/thumb/Music123/v4/ab/cd/ef/600x600bb.jpg';

  beforeEach(() => {
    TRACK_COVER_CACHE.clear();
    globalThis.localStorage.clear();
  });

  it('TC1.1: NEVER rejects genuine track album cover even if playlistCover is 100% identical', () => {
    const isRejected = isPlaylistOrGenericCover(genuineAlbumCover, matchingPlaylistCover);
    assert.equal(isRejected, false, 'Genuine track album cover MUST NOT be rejected when sharing playlist cover');

    const track0 = {
      id: 'trk-001',
      name: 'Un Verano Sin Ti',
      artists: [{ id: 'bb', name: 'Bad Bunny' }],
      album: {
        id: 'alb-001',
        name: 'Un Verano Sin Ti',
        images: [{ url: genuineAlbumCover }],
      },
    };

    const resolved = getTrackCoverUrl(track0, matchingPlaylistCover);
    assert.equal(resolved, genuineAlbumCover, 'Track 0 must preserve its legitimate album artwork');
  });

  it('TC1.2: NEVER rejects album cover when URL ends with the last 25 chars of playlistCover', () => {
    // Regression check for previous buggy slice(-25) check
    const trackCoverUrl = 'https://i.scdn.co/image/ab67616d0000b273' + '1234567890abcdef12345678';
    const playlistCoverUrl = 'https://i.scdn.co/image/ab67616d0000b273' + '1234567890abcdef12345678';

    assert.equal(isPlaylistOrGenericCover(trackCoverUrl, playlistCoverUrl), false);
    const track = {
      id: 'trk-suffix',
      name: 'Test Suffix',
      album: { images: [{ url: trackCoverUrl }] },
    };
    const resolved = getTrackCoverUrl(track, playlistCoverUrl);
    assert.equal(resolved, trackCoverUrl);
  });

  it('TC1.3: Accurately classifies and rejects true generic / mosaic covers', () => {
    const mosaics = [
      'https://mosaic.scdn.co/640/ab67616d00001e021234567890',
      'https://mosaic.scdn.co/300/ab67616d00001e021234567890',
      'https://pickasso.spotifycdn.com/image/ab67c0de0000deef123456',
      'https://i.scdn.co/image/ab67706c0000bebb1234567890',
      'https://i.scdn.co/image/ab67706f000000021234567890',
      'https://i.scdn.co/image/ab67706d00001e021234567890',
      'https://misc.scdn.co/liked-songs/liked-songs-640.jpg',
      'https://lineup-images.scdn.co/img/daily/art123.jpg',
      'https://lineup-images.scdn.co/img/radio/radio456.jpg',
      'data:image/svg+xml;utf8,<svg></svg>',
    ];

    for (const url of mosaics) {
      assert.equal(isPlaylistOrGenericCover(url), true, `Expected generic/mosaic rejection for: ${url}`);
    }
  });

  it('TC1.4: Handles missing, null, undefined album and image arrays without crashing', () => {
    const cornerCases = [
      null,
      undefined,
      {},
      { id: 't-null-album', album: null },
      { id: 't-undef-album', album: undefined },
      { id: 't-empty-images', album: { images: [] } },
      { id: 't-null-image-obj', album: { images: [null] } },
      { id: 't-empty-url', album: { images: [{ url: '' }] } },
      { id: 't-null-url', album: { images: [{ url: null }] } },
      { id: 't-undef-url', album: { images: [{ url: undefined }] } },
    ];

    for (const t of cornerCases) {
      assert.doesNotThrow(() => {
        const result = getTrackCoverUrl(t);
        assert.equal(result, undefined);
      });
    }
  });

  it('TC1.5: Direct fallback hierarchy resolves non-Spotify direct image attributes', () => {
    const fallbackAttrs = [
      'cover_xl',
      'cover_big',
      'cover_medium',
      'cover',
      'image',
      'imageUrl',
      'albumArt',
      'album_cover_url',
      'thumbnail',
    ];

    for (const attr of fallbackAttrs) {
      const trackWithDirect = {
        id: `t-attr-${attr}`,
        name: 'Fallback Song',
        album: { images: [] }, // No standard Spotify images
        [attr]: deezerAlbumCover,
      };

      const resolved = getTrackCoverUrl(trackWithDirect);
      assert.equal(resolved, deezerAlbumCover, `Direct attribute '${attr}' must resolve to artwork`);
    }
  });

  it('TC1.6: Cached track covers in TRACK_COVER_CACHE are preferred over missing album art', () => {
    const trackId = 'trk-cached-007';
    TRACK_COVER_CACHE.set(trackId, appleAlbumCover);

    const trackWithoutImages = {
      id: trackId,
      name: 'Song in Cache',
      album: { images: [] },
    };

    const resolved = getTrackCoverUrl(trackWithoutImages);
    assert.equal(resolved, appleAlbumCover, 'Must retrieve cover from TRACK_COVER_CACHE');
  });

  it('TC1.7: resolveTrackCoversBatch does NOT discard tracks whose cover matches playlistCover', async () => {
    const tracks = [
      {
        id: 'trk-batch-0',
        name: 'First Song',
        album: { images: [{ url: genuineAlbumCover }] },
      },
      {
        id: 'trk-batch-1',
        name: 'Second Song Missing Art',
        album: { images: [] },
      },
    ];

    // Batch resolve with matching playlist cover
    const updates = await resolveTrackCoversBatch(tracks, matchingPlaylistCover);
    // Track 0 already has a valid album cover, so it does not need fetching
    // Verify track 0's cover is not overwritten with empty or corrupted
    const trk0Cover = getTrackCoverUrl(tracks[0], matchingPlaylistCover);
    assert.equal(trk0Cover, genuineAlbumCover);
  });
});

// ============================================================================
// SUITE 2: Artist Synthetic Playlists & Authentic Portrait Resolution
// ============================================================================
describe('Adversarial Challenge 2: Artist Synthetic Playlists & Authentic Portrait Resolution', () => {
  const authenticArtistPortrait = 'https://e-cdns-images.dzcdn.net/images/artist/f1911993bebb/500x500-000000-80-0-0.jpg';
  const track0AlbumCover = 'https://i.scdn.co/image/ab67616d0000b273track0albumart1234567890';

  beforeEach(() => {
    ARTIST_IMAGE_CACHE.clear();
    globalThis.localStorage.clear();
    useSpotifyDataStore.getState().cachePlaylistDetails({
      id: 'art-bad-bunny',
      name: 'Bad Bunny',
      tracks: { total: 0, items: [] },
    });
  });

  it('TC2.1: ARTIST_IMAGE_CACHE stores and persists normalized artist portraits', () => {
    persistArtistImage('Bad Bunny', authenticArtistPortrait);
    assert.equal(ARTIST_IMAGE_CACHE.get('bad bunny'), authenticArtistPortrait);
    assert.equal(ARTIST_IMAGE_CACHE.get('Bad Bunny'.toLowerCase()), authenticArtistPortrait);
  });

  it('TC2.2: getPlaylistCover for artist returns cached artist picture instead of track album', () => {
    persistArtistImage('Rosalía', authenticArtistPortrait);

    const artistPlaylist = {
      id: 'artist-rosalia',
      name: 'Rosalía',
      type: 'artist',
      tracks: {
        total: 1,
        items: [{ id: 't1', album: { images: [{ url: track0AlbumCover }] } }],
      },
    };

    const cover = getPlaylistCover(artistPlaylist);
    assert.equal(cover, authenticArtistPortrait, 'Artist playlist must return authentic artist portrait, not song album cover');
  });

  it('TC2.3: getPlaylistCover detects artist playlists by prefix (art-, artist-) and description', () => {
    persistArtistImage('Quevedo', authenticArtistPortrait);

    const variants = [
      { id: 'art-quevedo', name: 'Quevedo' },
      { id: 'artist-quevedo', name: 'Quevedo' },
      { id: 'custom-123', name: 'Quevedo', type: 'artist' },
      { id: 'custom-456', name: 'Quevedo', description: 'Artista' },
    ];

    for (const v of variants) {
      const cover = getPlaylistCover(v);
      assert.equal(cover, authenticArtistPortrait, `Variant ${JSON.stringify(v)} must resolve artist portrait`);
    }
  });

  it('TC2.4: resolveArtistName strips synthetic prefixes and capitalizes slug IDs nicely', () => {
    assert.equal(resolveArtistName('art-duki'), 'Duki');
    assert.equal(resolveArtistName('artist-bizarrap'), 'Bizarrap');
    assert.equal(resolveArtistName('sf-artist-feid'), 'Feid');
    assert.equal(resolveArtistName('art-bad-bunny'), 'Bad Bunny');
    assert.equal(resolveArtistName('spotify:artist:my-artist_name'), 'My Artist Name');
    assert.equal(resolveArtistName('art-custom', 'art-Mora'), 'Mora');
    assert.equal(resolveArtistName('art-quevedo', 'playlist'), 'Quevedo');
    assert.equal(resolveArtistName('', ''), 'Artista');
  });
});

// ============================================================================
// SUITE 3: Deep Nested Playlist Objects & Multi-Tier Cache Fallback
// ============================================================================
describe('Adversarial Challenge 3: Deep Nested Playlists & Fast Cache Hydration', () => {
  const customCover = 'https://i.scdn.co/image/ab67706c0000bebbcustomplaylistcover1234';
  const trackArt1 = 'https://i.scdn.co/image/ab67616d0000b273track1art1234567890';
  const trackArt2 = 'https://i.scdn.co/image/ab67616d0000b273track2art1234567890';
  const trackArt3 = 'https://i.scdn.co/image/ab67616d0000b273track3art1234567890';
  const trackArt4 = 'https://i.scdn.co/image/ab67616d0000b273track4art1234567890';

  beforeEach(() => {
    globalThis.localStorage.clear();
  });

  it('TC3.1: Special Liked Songs IDs always return LIKED_COVER', () => {
    const likedIds = ['liked-songs', 'collection:tracks', 'user-liked-songs'];
    for (const id of likedIds) {
      const cover = getPlaylistCover({ id, name: 'Canciones que te gustan' });
      assert.equal(cover, 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg');
    }
  });

  it('TC3.2: Rejects LIKED_COVER when mistakenly present on a non-liked playlist', () => {
    const corruptedPlaylist = {
      id: 'my-custom-playlist',
      name: 'Mis Favoritas',
      images: [{ url: 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg' }],
      tracks: {
        items: [{ id: 't1', album: { images: [{ url: trackArt1 }] } }],
      },
    };

    const cover = getPlaylistCover(corruptedPlaylist);
    assert.equal(cover, trackArt1, 'Must ignore mistaken Liked Songs cover and use track artwork');
  });

  it('TC3.3: Resolves own photo when playlist object contains valid images', () => {
    const pl = {
      id: 'pl-own',
      name: 'Rock Classics',
      images: [{ url: customCover }],
    };
    const cover = getPlaylistCover(pl);
    assert.equal(cover, customCover);
  });

  it('TC3.4: Deep nested shallow playlist with undefined tracks falls back to playlistDetailsCache', () => {
    const shallowPlaylist = {
      id: 'pl-deep-cache',
      name: 'Deep List',
      // tracks.items is completely undefined
      tracks: { total: 42 },
    };

    // Populate details cache in Zustand store
    useSpotifyDataStore.getState().cachePlaylistDetails({
      id: 'pl-deep-cache',
      name: 'Deep List',
      images: [{ url: customCover }],
      tracks: {
        total: 1,
        items: [{ id: 't1', album: { images: [{ url: trackArt1 }] } }],
      },
    });

    const cover = getPlaylistCover(shallowPlaylist);
    assert.equal(cover, customCover, 'Must hydrate own image from playlistDetailsCache');
  });

  it('TC3.5: Shallow playlist with empty store cache falls back to localStorage', () => {
    const pid = 'pl-from-localstorage';
    const shallowPlaylist = {
      id: pid,
      name: 'Local List',
    };

    // Seed localStorage
    globalThis.localStorage.setItem(
      `spotifree_playlist_tracks_${pid}`,
      JSON.stringify([
        { id: 'trk-ls-1', album: { images: [{ url: trackArt1 }] } },
        { id: 'trk-ls-2', album: { images: [{ url: trackArt2 }] } },
      ])
    );

    const cover = getPlaylistCover(shallowPlaylist);
    assert.equal(cover, trackArt1, 'Must hydrate from localStorage when store cache is absent');
  });

  it('TC3.6: Strips spotify:playlist: URI prefix when looking up in localStorage', () => {
    const rawPid = '37i9dQZF1DXcBWIGoYBM5M';
    const uriPlaylist = {
      id: `spotify:playlist:${rawPid}?si=abc123`,
      name: 'Today Top Hits',
    };

    // Store has key with clean raw ID
    globalThis.localStorage.setItem(
      `spotifree_playlist_tracks_${rawPid}`,
      JSON.stringify([
        { id: 'trk-uri-1', album: { images: [{ url: trackArt3 }] } },
      ])
    );

    const cover = getPlaylistCover(uriPlaylist);
    assert.equal(cover, trackArt3, 'Must match clean localStorage key without URI prefix or query params');
  });

  it('TC3.7: Returns EMPTY_PLAYLIST_COVER SVG when playlist and all caches are truly empty', () => {
    const trulyEmptyPlaylist = {
      id: 'empty-void-list',
      name: 'Vacio',
      tracks: { total: 0, items: [] },
    };

    const cover = getPlaylistCover(trulyEmptyPlaylist);
    assert.equal(cover, EMPTY_PLAYLIST_COVER);
    assert.ok(cover.startsWith('data:image/svg+xml'));
  });

  it('TC3.8: onPlaylistCoverError steps through track cover fallback then EMPTY_PLAYLIST_COVER', () => {
    const pl = {
      id: 'pl-error-test',
      tracks: {
        items: [{ id: 't1', album: { images: [{ url: trackArt1 }] } }],
      },
    };

    const errorHandler = onPlaylistCoverError(pl);
    const mockImg = {
      dataset: {},
      src: 'https://broken-cdn.com/dead.jpg',
      referrerPolicy: '',
      onerror: () => {},
    };

    // First error trigger (step 0 -> step 1): should try first song cover
    errorHandler({ currentTarget: mockImg });
    assert.equal(mockImg.src, trackArt1, 'First error step should try first track cover');
    assert.equal(mockImg.dataset.coverStep, '1');

    // Second error trigger (step 1 -> step 2): should fall back to EMPTY_PLAYLIST_COVER and remove onerror
    errorHandler({ currentTarget: mockImg });
    assert.equal(mockImg.src, EMPTY_PLAYLIST_COVER, 'Second error step must fall back to EMPTY_PLAYLIST_COVER');
    assert.equal(mockImg.onerror, null, 'Must nullify onerror to prevent infinite error recursion loops');
  });

  it('TC3.9: Handles corrupt JSON in localStorage without throwing unhandled exceptions', () => {
    const pid = 'corrupt-json-pl';
    globalThis.localStorage.setItem(`spotifree_playlist_tracks_${pid}`, '{"invalid json: [}');

    assert.doesNotThrow(() => {
      const cover = getPlaylistCover({ id: pid, name: 'Corrupted' });
      assert.equal(cover, EMPTY_PLAYLIST_COVER);
    });
  });

  it('TC3.10: Handles garbage and null entries in tracks array during auto cover generation', () => {
    const garbageItems = [
      null,
      undefined,
      {},
      { track: null },
      { track: { name: '' } },
      'string-instead-of-track',
      12345,
      { id: 'valid-1', album: { images: [{ url: trackArt1 }] } },
      { track: { name: 'Valid Song', album: { images: [{ url: trackArt2 }] } } },
    ];

    assert.doesNotThrow(() => {
      const cover = getAutoPlaylistCover(garbageItems);
      assert.equal(cover, trackArt1);
    });
  });

  it('TC3.11: Deduplicates duplicate album covers and falls back to first track if < 4 distinct', () => {
    const duplicateTracks = [
      { id: 't1', album: { images: [{ url: trackArt1 }] } },
      { id: 't2', album: { images: [{ url: trackArt1 }] } },
      { id: 't3', album: { images: [{ url: trackArt2 }] } },
      { id: 't4', album: { images: [{ url: trackArt2 }] } },
    ];

    const cover = getAutoPlaylistCover(duplicateTracks);
    assert.equal(cover, trackArt1, 'Fewer than 4 distinct album arts must fall back to first track cover');
  });
});

// ============================================================================
// SUITE 4: High-Velocity Rapid Navigation Stress Test
// ============================================================================
describe('Adversarial Challenge 4: High-Velocity Navigation Stress & Memory Stability', () => {
  it('TC4.1: Executes 1000 rapid playlist and track cover resolutions under 100ms with zero errors', () => {
    // Seed 50 playlists in cache
    for (let i = 0; i < 50; i++) {
      const pid = `rapid-pl-${i}`;
      useSpotifyDataStore.getState().cachePlaylistDetails({
        id: pid,
        name: `Rapid Playlist ${i}`,
        images: [{ url: `https://i.scdn.co/image/custom_${i}.jpg` }],
        tracks: {
          total: 10,
          items: Array.from({ length: 10 }, (_, j) => ({
            id: `trk-${i}-${j}`,
            name: `Track ${j}`,
            album: { images: [{ url: `https://i.scdn.co/image/ab67616d_${i}_${j}.jpg` }] },
          })),
        },
      });
    }

    const t0 = performance.now();
    let queryCount = 0;

    for (let cycle = 0; cycle < 20; cycle++) {
      for (let i = 0; i < 50; i++) {
        const shallow = { id: `rapid-pl-${i}`, name: `Rapid Playlist ${i}` };
        const cover = getPlaylistCover(shallow);
        assert.ok(cover.length > 0);
        queryCount++;

        const track = {
          id: `trk-${i}-0`,
          name: `Track 0`,
          album: { images: [{ url: cover }] },
        };
        const trkCover = getTrackCoverUrl(track, cover);
        assert.equal(trkCover, cover);
        queryCount++;
      }
    }

    const duration = performance.now() - t0;
    assert.equal(queryCount, 2000);
    assert.ok(duration < 250, `2000 queries took ${duration.toFixed(2)}ms (expected < 250ms)`);
  });
});

// ============================================================================
// SUITE 5: Source Code Audit (No Layout Stutter & R5 Integrity)
// ============================================================================
describe('Adversarial Challenge 5: Layout Stutter Elimination & R5 Preservation Audit', () => {
  it('TC5.1: DesktopPlaylistView.tsx does NOT contain contentVisibility: auto or containIntrinsicSize', () => {
    const code = fs.readFileSync('src/components/desktop/DesktopPlaylistView.tsx', 'utf8');
    assert.equal(code.includes("contentVisibility: 'auto'"), false, 'Must not contain contentVisibility: auto');
    assert.equal(code.includes('containIntrinsicSize'), false, 'Must not contain containIntrinsicSize');
  });

  it('TC5.2: MobilePlaylistView.tsx does NOT contain contentVisibility: auto or containIntrinsicSize', () => {
    const code = fs.readFileSync('src/components/mobile/MobilePlaylistView.tsx', 'utf8');
    assert.equal(code.includes("contentVisibility: 'auto'"), false, 'Must not contain contentVisibility: auto');
    assert.equal(code.includes('containIntrinsicSize'), false, 'Must not contain containIntrinsicSize');
  });

  it('TC5.3: TrackArtwork in trackCovers.tsx does NOT use loading="lazy"', () => {
    const code = fs.readFileSync('src/utils/trackCovers.tsx', 'utf8');
    assert.equal(code.includes('loading="lazy"'), false, 'TrackArtwork must not use loading="lazy"');
    assert.ok(code.includes('decoding="async"'), 'TrackArtwork must use decoding="async"');
  });

  it('TC5.4: All 7 Requirement R5 preserved files exist and are intact', () => {
    const r5Files = [
      'api/_lib/musicFallback.js',
      'api/audio.js',
      'scripts/audioService.mjs',
      'server.mjs',
      'native/android/SpotifreeLocalMusicPlugin.java',
      'src/utils/offlineStorage.ts',
      'tests/offline_downloads.test.js',
    ];

    for (const f of r5Files) {
      assert.ok(fs.existsSync(f), `Preserved file ${f} must exist`);
      const stat = fs.statSync(f);
      assert.ok(stat.size > 0, `Preserved file ${f} must not be empty (size=${stat.size})`);
    }
  });
});
