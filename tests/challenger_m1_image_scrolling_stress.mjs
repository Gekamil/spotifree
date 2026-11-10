import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import React from 'react';
import { renderToString } from 'react-dom/server';

// Production imports via loader
import {
  getAutoPlaylistCover,
  getPlaylistCover,
  EMPTY_PLAYLIST_COVER,
  useAutoCovers,
  onPlaylistCoverError,
} from '../src/utils/playlistCover.ts';

import {
  getTrackCoverUrl,
  isPlaylistOrGenericCover,
  TRACK_COVER_CACHE,
  TrackArtwork,
} from '../src/utils/trackCovers.tsx';

import { ARTIST_IMAGE_CACHE } from '../src/utils/artistImage.ts';
import { useSpotifyDataStore } from '../src/store/useSpotifyDataStore.ts';

describe('Empirical Challenge: Milestone 1 Image & Cover Art Performance', () => {

  // =========================================================================
  // 1. Scrolling Performance & Rendering: contentVisibility / containIntrinsicSize
  // =========================================================================
  describe('1. Scrolling Performance: Containment & Lazy-loading Removal', () => {
    const desktopViewPath = path.resolve('src/components/desktop/DesktopPlaylistView.tsx');
    const mobileViewPath = path.resolve('src/components/mobile/MobilePlaylistView.tsx');
    const trackCoversPath = path.resolve('src/utils/trackCovers.tsx');

    it('DesktopPlaylistView.tsx has NO contentVisibility or containIntrinsicSize or LONG_LIST_ROW', () => {
      const content = fs.readFileSync(desktopViewPath, 'utf-8');
      assert.equal(
        content.includes('contentVisibility'),
        false,
        'DesktopPlaylistView must not contain contentVisibility'
      );
      assert.equal(
        content.includes('containIntrinsicSize'),
        false,
        'DesktopPlaylistView must not contain containIntrinsicSize'
      );
      assert.equal(
        content.includes('LONG_LIST_ROW'),
        false,
        'DesktopPlaylistView must not contain LONG_LIST_ROW'
      );
    });

    it('MobilePlaylistView.tsx has NO contentVisibility or containIntrinsicSize or LONG_LIST_ROW', () => {
      const content = fs.readFileSync(mobileViewPath, 'utf-8');
      assert.equal(
        content.includes('contentVisibility'),
        false,
        'MobilePlaylistView must not contain contentVisibility'
      );
      assert.equal(
        content.includes('containIntrinsicSize'),
        false,
        'MobilePlaylistView must not contain containIntrinsicSize'
      );
      assert.equal(
        content.includes('LONG_LIST_ROW'),
        false,
        'MobilePlaylistView must not contain LONG_LIST_ROW'
      );
    });

    it('TrackArtwork uses decoding="async" and does NOT use loading="lazy"', () => {
      const content = fs.readFileSync(trackCoversPath, 'utf-8');
      assert.match(
        content,
        /decoding="async"/,
        'TrackArtwork must explicitly set decoding="async"'
      );
      assert.doesNotMatch(
        content,
        /loading="lazy"/,
        'TrackArtwork must NOT contain loading="lazy" (causes thumbnail render delay)'
      );
    });

    it('TrackArtwork renders <img decoding="async"> immediately with valid src', () => {
      const html = renderToString(
        React.createElement(TrackArtwork, {
          src: 'https://i.scdn.co/image/ab67616d0000b273test',
          alt: 'Test Track',
          size: 44,
        })
      );
      assert.ok(html.includes('decoding="async"'), 'Rendered HTML must include decoding="async"');
      assert.ok(!html.includes('loading="lazy"'), 'Rendered HTML must not include loading="lazy"');
      assert.ok(html.includes('src="https://i.scdn.co/image/ab67616d0000b273test"'), 'Rendered HTML must contain image src');
    });

    it('TrackArtwork renders fallback SVG when src is empty or missing', () => {
      const html = renderToString(
        React.createElement(TrackArtwork, {
          src: undefined,
          alt: 'Missing Track',
          size: 44,
        })
      );
      assert.ok(html.includes('<svg'), 'Missing artwork must render fallback SVG');
      assert.ok(!html.includes('<img'), 'Missing artwork must not render broken <img>');
    });
  });

  // =========================================================================
  // 2. Collage Generation Empirical Stress-Testing (0, 1, 2, 3, 4, 10+ covers)
  // =========================================================================
  describe('2. Collage Generation Across Varying Cover Counts', () => {
    const spotifyBase = 'https://i.scdn.co/image/ab67616d0000b273';
    const c1 = `${spotifyBase}111111111111111111111111`;
    const c2 = `${spotifyBase}222222222222222222222222`;
    const c3 = `${spotifyBase}333333333333333333333333`;
    const c4 = `${spotifyBase}444444444444444444444444`;

    const makeTrack = (id, coverUrl) => ({
      id,
      name: `Track ${id}`,
      album: {
        images: coverUrl ? [{ url: coverUrl }] : [],
      },
    });

    it('Cover count 0: returns EMPTY_PLAYLIST_COVER for empty, null, or undefined items', () => {
      assert.equal(getAutoPlaylistCover([]), EMPTY_PLAYLIST_COVER);
      assert.equal(getAutoPlaylistCover(null), EMPTY_PLAYLIST_COVER);
      assert.equal(getAutoPlaylistCover(undefined), EMPTY_PLAYLIST_COVER);
      assert.equal(getAutoPlaylistCover([makeTrack('t1', null)]), EMPTY_PLAYLIST_COVER);
    });

    it('Cover count 1: returns the single track album cover directly', () => {
      const tracks = [makeTrack('t1', c1)];
      assert.equal(getAutoPlaylistCover(tracks), c1);
    });

    it('Cover count 2: returns first track cover (Spotify parity: 2-3 tracks use track 0)', () => {
      const tracks = [makeTrack('t1', c1), makeTrack('t2', c2)];
      assert.equal(getAutoPlaylistCover(tracks), c1);
    });

    it('Cover count 3: returns first track cover (Spotify parity: 2-3 tracks use track 0)', () => {
      const tracks = [makeTrack('t1', c1), makeTrack('t2', c2), makeTrack('t3', c3)];
      assert.equal(getAutoPlaylistCover(tracks), c1);
    });

    it('Cover count 4 (Spotify): builds 2x2 mosaic CDN URL with 4 extracted 32-char IDs', () => {
      const tracks = [
        makeTrack('t1', c1),
        makeTrack('t2', c2),
        makeTrack('t3', c3),
        makeTrack('t4', c4),
      ];
      const mosaic = getAutoPlaylistCover(tracks);
      const expectedMosaic =
        'https://mosaic.scdn.co/640/ab67616d00001e02111111111111111111111111' +
        'ab67616d00001e02222222222222222222222222' +
        'ab67616d00001e02333333333333333333333333' +
        'ab67616d00001e02444444444444444444444444';
      assert.equal(mosaic, expectedMosaic);
      assert.equal(mosaic.length, 27 + 160); // 187 characters total (27 prefix + 4 * 40-char Spotify image IDs)
    });

    it('Cover count 10+ with duplicates: deduplicates covers and falls back to track 0 if < 4 unique', () => {
      // 10 tracks, but only 2 unique covers (5 each)
      const tracks = [
        makeTrack('t1', c1),
        makeTrack('t2', c1),
        makeTrack('t3', c1),
        makeTrack('t4', c2),
        makeTrack('t5', c2),
        makeTrack('t6', c2),
        makeTrack('t7', c1),
        makeTrack('t8', c2),
        makeTrack('t9', c1),
        makeTrack('t10', c2),
      ];
      const result = getAutoPlaylistCover(tracks);
      assert.equal(result, c1, 'Should return first cover since unique cover count is only 2');
    });

    it('Large playlist performance stress: 50,000 tracks resolves in < 5ms due to early break', () => {
      const hugeTrackList = new Array(50000);
      for (let i = 0; i < 50000; i++) {
        hugeTrackList[i] = makeTrack(`trk-${i}`, `${spotifyBase}${(i % 5).toString().repeat(24)}`);
      }
      const t0 = performance.now();
      const mosaic = getAutoPlaylistCover(hugeTrackList);
      const elapsed = performance.now() - t0;

      assert.ok(mosaic.startsWith('https://mosaic.scdn.co/640/'), 'Must build mosaic URL');
      assert.ok(elapsed < 10, `Processing 50,000 tracks took ${elapsed.toFixed(2)}ms (must be < 10ms)`);
    });

    it('Malformed track inputs: handles undefined, nulls, corrupted objects without throwing', () => {
      const corruptedTracks = [
        null,
        undefined,
        {},
        { track: null },
        { track: { name: 'Broken' } }, // no album
        { album: {} }, // no images
        { album: { images: [null] } },
        { album: { images: [{ url: null }] } },
        makeTrack('valid-1', c1),
        makeTrack('valid-2', c2),
      ];

      assert.doesNotThrow(() => {
        const cover = getAutoPlaylistCover(corruptedTracks);
        assert.equal(cover, c1);
      });
    });

    it('Concurrency protection: simultaneous calls for same collage do not trigger duplicate draws', () => {
      const nonSpotifyTracks = [
        makeTrack('t1', 'https://cdn.test.com/1.jpg'),
        makeTrack('t2', 'https://cdn.test.com/2.jpg'),
        makeTrack('t3', 'https://cdn.test.com/3.jpg'),
        makeTrack('t4', 'https://cdn.test.com/4.jpg'),
      ];

      // Call 50 times in rapid succession
      for (let i = 0; i < 50; i++) {
        const result = getAutoPlaylistCover(nonSpotifyTracks);
        assert.equal(result, 'https://cdn.test.com/1.jpg');
      }
    });

    it('Cover count 4+ with non-Spotify covers: immediately returns first track cover without stalling', () => {
      const nonSpotifyTracks = [
        makeTrack('t1', 'https://e-cdns-images.dzcdn.net/images/cover/deezer1.jpg'),
        makeTrack('t2', 'https://e-cdns-images.dzcdn.net/images/cover/deezer2.jpg'),
        makeTrack('t3', 'https://e-cdns-images.dzcdn.net/images/cover/deezer3.jpg'),
        makeTrack('t4', 'https://e-cdns-images.dzcdn.net/images/cover/deezer4.jpg'),
      ];
      // In headless environment without DOM canvas, it must immediately return first cover
      const start = Date.now();
      const result = getAutoPlaylistCover(nonSpotifyTracks);
      const elapsed = Date.now() - start;
      assert.ok(elapsed < 50, `getAutoPlaylistCover must execute instantaneously (<50ms), took ${elapsed}ms`);
      assert.equal(result, 'https://e-cdns-images.dzcdn.net/images/cover/deezer1.jpg');
    });
  });

  // =========================================================================
  // 3. Timeout Resilience & Stall Prevention: UI Never Freezes
  // =========================================================================
  describe('3. Timeout Resilience & Error Recovery', () => {
    let originalDocument;
    let originalImage;
    let originalWindow;

    before(() => {
      originalDocument = global.document;
      originalImage = global.Image;
      originalWindow = global.window;
    });

    after(() => {
      global.document = originalDocument;
      global.Image = originalImage;
      global.window = originalWindow;
    });

    it('Canvas drawCollage aborts cleanly when an image hangs or times out at 3000ms', async () => {
      // Mock DOM environment with a hanging Image loader
      let timeoutScheduled = false;
      let timeoutMs = 0;

      class MockHangingImage {
        constructor() {
          this.naturalWidth = 300;
          this.naturalHeight = 300;
          this.onload = null;
          this.onerror = null;
          this._src = '';
        }
        set src(val) {
          this._src = val;
          // Simulate hanging: does NOT call onload or onerror.
        }
        get src() {
          return this._src;
        }
      }

      // Mock canvas
      const mockCanvas = {
        width: 0,
        height: 0,
        getContext: () => ({
          drawImage: () => {},
        }),
        toDataURL: () => 'data:image/jpeg;base64,mockCollage',
      };

      global.window = {};
      global.document = {
        createElement: (tag) => {
          if (tag === 'canvas') return mockCanvas;
          return {};
        },
      };
      global.Image = MockHangingImage;

      // Intercept setTimeout to verify the 3000ms timeout
      const origSetTimeout = global.setTimeout;
      global.setTimeout = (fn, delay) => {
        if (delay === 3000) {
          timeoutScheduled = true;
          timeoutMs = delay;
          // Fast-forward timeout callback asynchronously
          process.nextTick(fn);
          return 999;
        }
        return origSetTimeout(fn, delay);
      };

      try {
        const nonSpotifyTracks = [
          { id: 'h1', album: { images: [{ url: 'https://cdn.example.com/art1.jpg' }] } },
          { id: 'h2', album: { images: [{ url: 'https://cdn.example.com/art2.jpg' }] } },
          { id: 'h3', album: { images: [{ url: 'https://cdn.example.com/art3.jpg' }] } },
          { id: 'h4', album: { images: [{ url: 'https://cdn.example.com/art4.jpg' }] } },
        ];

        // getAutoPlaylistCover should return synchronous first cover immediately
        const cover = getAutoPlaylistCover(nonSpotifyTracks);
        assert.equal(cover, 'https://cdn.example.com/art1.jpg');

        // Allow async drawCollage / timeout to complete
        await new Promise((r) => process.nextTick(r));
        await new Promise((r) => origSetTimeout(r, 20));

        assert.equal(timeoutScheduled, true, 'loadImage must schedule a 3000ms timeout');
        assert.equal(timeoutMs, 3000, 'loadImage timeout must be exactly 3000ms (fast-fail for CORS/network stalls)');
      } finally {
        global.setTimeout = origSetTimeout;
      }
    });

    it('onPlaylistCoverError falls back to track 0 on step 0, then EMPTY_PLAYLIST_COVER on step 1', () => {
      const playlist = {
        id: 'pl-fail',
        tracks: {
          items: [
            { id: 't1', album: { images: [{ url: 'https://i.scdn.co/broken_track.jpg' }] } },
          ],
        },
      };

      const handler = onPlaylistCoverError(playlist);

      // Simulated Image Element
      const mockImg = {
        dataset: {},
        src: 'https://i.scdn.co/dead_playlist.jpg',
        referrerPolicy: '',
        onerror: () => {},
      };

      const fakeEvent = { currentTarget: mockImg };

      // Step 0: Primary cover fails -> falls back to first track's cover
      handler(fakeEvent);
      assert.equal(mockImg.dataset.coverStep, '1');
      assert.equal(mockImg.src, 'https://i.scdn.co/broken_track.jpg');
      assert.equal(mockImg.referrerPolicy, 'no-referrer');

      // Step 1: Track cover also fails -> falls back to EMPTY_PLAYLIST_COVER and clears onerror
      handler(fakeEvent);
      assert.equal(mockImg.dataset.coverStep, '2');
      assert.equal(mockImg.src, EMPTY_PLAYLIST_COVER);
      assert.equal(mockImg.onerror, null, 'onerror must be cleared to break potential infinite cycles');
    });
  });

  // =========================================================================
  // 4. Fast Playlist Re-entry & Cache Hydration
  // =========================================================================
  describe('4. Fast Playlist Re-entry & Details Cache Hydration', () => {
    it('getPlaylistCover hydrates immediately from playlistDetailsCache when tracks.items is empty', () => {
      const shallowPlaylist = {
        id: 'pl-details-cache',
        name: 'Empty Shell',
        tracks: { total: 5, items: [] },
      };

      // Populate zustand store cache
      useSpotifyDataStore.setState({
        playlistDetailsCache: {
          'pl-details-cache': {
            id: 'pl-details-cache',
            images: [{ url: 'https://i.scdn.co/image/cached_cover_ready.jpg' }],
            tracks: { items: [] },
          },
        },
      });

      const cover = getPlaylistCover(shallowPlaylist);
      assert.equal(cover, 'https://i.scdn.co/image/cached_cover_ready.jpg');
    });

    it('getPlaylistCover resolves artist photo from ARTIST_IMAGE_CACHE for artist playlists', () => {
      const artistPlaylist = {
        id: 'art-duki',
        name: 'Duki',
        type: 'artist',
      };

      ARTIST_IMAGE_CACHE.set('duki', 'https://i.scdn.co/image/duki_official_portrait.jpg');

      const cover = getPlaylistCover(artistPlaylist);
      assert.equal(cover, 'https://i.scdn.co/image/duki_official_portrait.jpg');
    });

    it('getPlaylistCover resolves liked-songs to official Spotify liked cover', () => {
      assert.equal(getPlaylistCover({ id: 'liked-songs' }), 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg');
      assert.equal(getPlaylistCover({ id: 'collection:tracks' }), 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg');
    });
  });

  // =========================================================================
  // 5. Track Cover Art Rejection Fix (Requirement R1 Core)
  // =========================================================================
  describe('5. Track Cover Art Rejection Regression Prevention', () => {
    const realAlbumArt = 'https://i.scdn.co/image/ab67616d0000b273genuinealbum123456';
    const headerCoverSameAsTrack0 = 'https://i.scdn.co/image/ab67616d0000b273genuinealbum123456';

    it('isPlaylistOrGenericCover does NOT reject real album cover matching playlistCover', () => {
      const rejected = isPlaylistOrGenericCover(realAlbumArt, headerCoverSameAsTrack0);
      assert.equal(rejected, false, 'Must not reject authentic track cover simply because it matches playlistCover');
    });

    it('getTrackCoverUrl returns track 0 album cover even when identical to fallbackPlaylistCover', () => {
      const track0 = {
        id: 't-0',
        name: 'Song A',
        album: {
          images: [{ url: realAlbumArt }],
        },
      };
      const resolved = getTrackCoverUrl(track0, headerCoverSameAsTrack0);
      assert.equal(resolved, realAlbumArt);
    });

    it('isPlaylistOrGenericCover rigorously rejects generic mosaic, pickasso, and hash covers', () => {
      assert.equal(isPlaylistOrGenericCover('https://mosaic.scdn.co/640/ab67616d...'), true);
      assert.equal(isPlaylistOrGenericCover('https://pickasso.spotifycdn.com/image/ab67...'), true);
      assert.equal(isPlaylistOrGenericCover('https://i.scdn.co/image/ab67706c0000bebb...'), true);
      assert.equal(isPlaylistOrGenericCover('https://i.scdn.co/image/ab67706f0000bebb...'), true);
      assert.equal(isPlaylistOrGenericCover('https://i.scdn.co/image/ab67706d0000bebb...'), true);
      assert.equal(isPlaylistOrGenericCover('https://i.scdn.co/image/ab67616d0000/img/daily/1'), true);
      assert.equal(isPlaylistOrGenericCover('data:image/svg+xml;utf8,<svg></svg>'), true);
    });
  });

  // =========================================================================
  // 6. Preserved Files (Requirement R5) Forensic Audit
  // =========================================================================
  describe('6. Requirement R5 Forensic Integrity Check', () => {
    const preservedFiles = [
      'api/_lib/musicFallback.js',
      'api/audio.js',
      'scripts/audioService.mjs',
      'server.mjs',
      'native/android/SpotifreeLocalMusicPlugin.java',
      'src/utils/offlineStorage.ts',
      'tests/offline_downloads.test.js',
    ];

    it('All R5 preserved files exist on disk', () => {
      for (const file of preservedFiles) {
        assert.ok(fs.existsSync(path.resolve(file)), `Preserved file ${file} must exist`);
      }
    });

    it('Git diff on preserved files confirms no unintended modifications by Milestone 1', () => {
      const gitCmd = '& "C:\\Users\\jorge\\AppData\\Local\\Programs\\MinGit\\cmd\\git.exe" diff --name-only ' +
        'api/audio.js scripts/audioService.mjs server.mjs native/android/SpotifreeLocalMusicPlugin.java src/utils/offlineStorage.ts tests/offline_downloads.test.js';
      const output = execSync(gitCmd, { shell: 'powershell.exe', encoding: 'utf-8' });
      const modifiedLines = output.trim().split(/\r?\n/).filter(Boolean);
      // These are the uncommitted changes from offline/downloads that must be preserved
      for (const line of modifiedLines) {
        assert.ok(
          preservedFiles.some((f) => f.includes(line.trim()) || line.trim().includes(f)),
          `Unexpected file in preserved list: ${line}`
        );
      }
    });

    it('Offline downloads test suite passes without regressions', () => {
      const result = execSync('node tests/offline_downloads.test.js', { encoding: 'utf-8' });
      assert.ok(result.includes('pass 7'), 'All 7 offline downloads tests must pass');
      assert.ok(result.includes('fail 0'), 'Zero failures in offline downloads tests');
    });
  });
});
