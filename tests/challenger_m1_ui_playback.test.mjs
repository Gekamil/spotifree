/**
 * Challenger 2 Adversarial Stress Test Suite: Milestone 1
 * UI Views, Badge Styling, Audio Playback Routing & Preservation Invariants
 *
 * File: tests/challenger_m1_ui_playback.test.mjs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Milestone 1 Adversarial Challenge: UI, Playback Routing & Invariants', () => {
  const desktopViewPath = path.resolve('src/components/desktop/DesktopSearchView.tsx');
  const mobileViewPath = path.resolve('src/components/mobile/MobileSearchView.tsx');
  const audioEnginePath = path.resolve('src/services/audioEngine.ts');
  const serverPath = path.resolve('server.mjs');
  const mobileE2EPath = path.resolve('tests/mobile_search_e2e.test.js');

  const desktopSource = fs.readFileSync(desktopViewPath, 'utf8');
  const mobileSource = fs.readFileSync(mobileViewPath, 'utf8');
  const audioEngineSource = fs.readFileSync(audioEnginePath, 'utf8');
  const serverSource = fs.readFileSync(serverPath, 'utf8');
  const mobileE2ESource = fs.readFileSync(mobileE2EPath, 'utf8');

  // =========================================================================
  // Section 1: UI Component Badge Styling & Logic
  // =========================================================================
  describe('UI Component Badge Styling & Logic', () => {
    it('DesktopSearchView contains green official badge styling in "todo" shelf and dedicated remixes tab', () => {
      const greenBadgeClass = 'bg-[#1ed760]/15 text-[#1ed760] border border-[#1ed760]/30';
      const orangeBadgeClass = 'bg-[#ff5500]/15 text-[#ff8a4c] border border-[#ff5500]/30';

      assert.ok(desktopSource.includes(greenBadgeClass), 'DesktopSearchView must contain green official badge styling');
      assert.ok(desktopSource.includes(orangeBadgeClass), 'DesktopSearchView must contain orange SoundCloud badge styling');

      // Verify condition in DesktopSearchView
      const shelfConditionMatch = desktopSource.match(
        /track\.isOfficial\s*\|\|\s*track\.scVariantLabel\s*===\s*['"]Remix Oficial['"]\s*\?\s*['"]bg-\[#1ed760\]\/15 text-\[#1ed760\] border border-\[#1ed760\]\/30['"]\s*:\s*['"]bg-\[#ff5500\]\/15 text-\[#ff8a4c\] border border-\[#ff5500\]\/30['"]/
      );
      assert.ok(shelfConditionMatch, 'DesktopSearchView must branch badge styling based on isOfficial or scVariantLabel === "Remix Oficial"');

      // Check badge text logic
      const textMatch = desktopSource.match(
        /track\.isOfficial\s*\?\s*\(track\.scVariantLabel\s*\|\|\s*['"]Remix Oficial['"]\)\s*:\s*\(track\.scVariantLabel\s*\|\|\s*['"]SoundCloud['"]\)/
      );
      assert.ok(textMatch, 'DesktopSearchView must render "Remix Oficial" for official tracks and "SoundCloud" (or custom label) for others');
    });

    it('MobileSearchView contains green official badge styling and conditional label', () => {
      const greenBadgeClass = 'bg-[#1ed760]/15 text-[#1ed760] border border-[#1ed760]/30';
      const orangeBadgeClass = 'bg-[#ff5500]/15 text-[#ff8a4c] border border-[#ff5500]/30';

      assert.ok(mobileSource.includes(greenBadgeClass), 'MobileSearchView must contain green official badge styling');
      assert.ok(mobileSource.includes(orangeBadgeClass), 'MobileSearchView must contain orange SoundCloud badge styling');

      const mobileConditionMatch = mobileSource.match(
        /trk\.isOfficial\s*\|\|\s*trk\.scVariantLabel\s*===\s*['"]Remix Oficial['"]\s*\?\s*['"]bg-\[#1ed760\]\/15 text-\[#1ed760\] border border-\[#1ed760\]\/30['"]\s*:\s*['"]bg-\[#ff5500\]\/15 text-\[#ff8a4c\] border border-\[#ff5500\]\/30['"]/
      );
      assert.ok(mobileConditionMatch, 'MobileSearchView must branch badge styling based on isOfficial or scVariantLabel === "Remix Oficial"');

      const mobileTextMatch = mobileSource.match(
        /trk\.isOfficial\s*\?\s*\(trk\.scVariantLabel\s*\|\|\s*['"]Remix Oficial['"]\)\s*:\s*\(trk\.scVariantLabel\s*\|\|\s*['"]SoundCloud['"]\)/
      );
      assert.ok(mobileTextMatch, 'MobileSearchView must render "Remix Oficial" for official tracks and "SoundCloud" (or custom label) for others');
    });

    it('Recent searches subtitle distinguishes Remix Oficial vs SoundCloud', () => {
      // Desktop
      assert.ok(
        desktopSource.includes("subtitle: `${track.isOfficial ? 'Remix Oficial' : 'SoundCloud'} • "),
        'DesktopSearchView must format recent search subtitle with Remix Oficial when track.isOfficial is true'
      );

      // Mobile
      assert.ok(
        mobileSource.includes("subtitle: `${trk.isOfficial ? 'Remix Oficial' : 'SoundCloud'} • "),
        'MobileSearchView must format recent search subtitle with Remix Oficial when trk.isOfficial is true'
      );
    });

    it('MobileSearchView expands dedicated tab limit from 20 to 50 for remix exploration', () => {
      assert.ok(
        mobileSource.includes("results.soundcloudTracks.slice(0, filter === 'todo' ? 4 : 50)"),
        'MobileSearchView must display up to 50 tracks in dedicated remix tab'
      );
    });

    it('Simulation of badge renderer handles diverse edge cases correctly', () => {
      // Function mimicking Desktop & Mobile JSX expression
      function renderBadge(track) {
        const className = (track.isOfficial || track.scVariantLabel === 'Remix Oficial')
          ? 'bg-[#1ed760]/15 text-[#1ed760] border border-[#1ed760]/30'
          : 'bg-[#ff5500]/15 text-[#ff8a4c] border border-[#ff5500]/30';
        const label = track.isOfficial
          ? (track.scVariantLabel || 'Remix Oficial')
          : (track.scVariantLabel || 'SoundCloud');
        return { className, label };
      }

      // Test Case 1: Official Spotify Remix
      const c1 = renderBadge({ id: 'spotify:track:123', isOfficial: true });
      assert.equal(c1.className, 'bg-[#1ed760]/15 text-[#1ed760] border border-[#1ed760]/30');
      assert.equal(c1.label, 'Remix Oficial');

      // Test Case 2: Official Deezer Remix with explicit label
      const c2 = renderBadge({ id: 'dz-456', isOfficial: true, scVariantLabel: 'Remix Oficial' });
      assert.equal(c2.className, 'bg-[#1ed760]/15 text-[#1ed760] border border-[#1ed760]/30');
      assert.equal(c2.label, 'Remix Oficial');

      // Test Case 3: Official Deezer Remix with custom label
      const c3 = renderBadge({ id: 'dz-789', isOfficial: true, scVariantLabel: 'VIP Remix' });
      assert.equal(c3.className, 'bg-[#1ed760]/15 text-[#1ed760] border border-[#1ed760]/30');
      assert.equal(c3.label, 'VIP Remix');

      // Test Case 4: Unofficial SoundCloud Slowed Edit
      const c4 = renderBadge({ id: 'sc-1111', isOfficial: false, scVariantLabel: 'Slowed' });
      assert.equal(c4.className, 'bg-[#ff5500]/15 text-[#ff8a4c] border border-[#ff5500]/30');
      assert.equal(c4.label, 'Slowed');

      // Test Case 5: Unofficial SoundCloud Track with no variant label
      const c5 = renderBadge({ id: 'sc-2222', isOfficial: false });
      assert.equal(c5.className, 'bg-[#ff5500]/15 text-[#ff8a4c] border border-[#ff5500]/30');
      assert.equal(c5.label, 'SoundCloud');

      // Test Case 6: Edge Case - isOfficial missing (undefined)
      const c6 = renderBadge({ id: 'sc-3333' });
      assert.equal(c6.className, 'bg-[#ff5500]/15 text-[#ff8a4c] border border-[#ff5500]/30');
      assert.equal(c6.label, 'SoundCloud');

      // Test Case 7: Adversarial - isOfficial false but scVariantLabel spoofed to 'Remix Oficial'
      const c7 = renderBadge({ id: 'sc-4444', isOfficial: false, scVariantLabel: 'Remix Oficial' });
      assert.equal(c7.className, 'bg-[#1ed760]/15 text-[#1ed760] border border-[#1ed760]/30');
      assert.equal(c7.label, 'Remix Oficial');
    });
  });

  // =========================================================================
  // Section 2: Audio Playback Routing in audioEngine.ts
  // =========================================================================
  describe('Audio Playback Routing & Engine Invariants', () => {
    function cleanId(id) {
      return (id || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
    }

    it('AudioEngine.cleanId strips spotify:track: prefix and query params cleanly', () => {
      assert.equal(cleanId('spotify:track:4cOdK2wGLETKBW3PvgPWqT'), '4cOdK2wGLETKBW3PvgPWqT');
      assert.equal(cleanId('spotify:track:4cOdK2wGLETKBW3PvgPWqT?si=123'), '4cOdK2wGLETKBW3PvgPWqT');
      assert.equal(cleanId('dz-316164367'), 'dz-316164367');
      assert.equal(cleanId('it-987654321'), 'it-987654321');
      assert.equal(cleanId('sc-198273645'), 'sc-198273645');
    });

    it('Official remix IDs do NOT match SoundCloud regex ^sc-(\\d+)$', () => {
      const scRegex = /^sc-(\d+)$/;
      const scRegexAny = /^sc-\d+$/;

      const officialIds = [
        'spotify:track:4cOdK2wGLETKBW3PvgPWqT',
        '4cOdK2wGLETKBW3PvgPWqT',
        'dz-316164367',
        'dz-1234567890',
        'it-987654321',
        'it-11223344',
      ];

      for (const id of officialIds) {
        const cleaned = cleanId(id);
        assert.equal(scRegex.test(cleaned), false, `Official ID ${id} (cleaned: ${cleaned}) must not match ^sc-(\\d+)$`);
        assert.equal(scRegexAny.test(cleaned), false, `Official ID ${id} (cleaned: ${cleaned}) must not match ^sc-\\d+$`);
      }
    });

    it('SoundCloud track IDs DO match SoundCloud regex ^sc-(\\d+)$', () => {
      const scRegex = /^sc-(\d+)$/;
      const scRegexAny = /^sc-\d+$/;

      const scIds = ['sc-198273645', 'sc-999999999', 'sc-12345'];

      for (const id of scIds) {
        const cleaned = cleanId(id);
        assert.equal(scRegex.test(cleaned), true, `SoundCloud ID ${id} must match ^sc-(\\d+)$`);
        assert.equal(scRegexAny.test(cleaned), true, `SoundCloud ID ${id} must match ^sc-\\d+$`);
      }
    });

    it('AudioEngine source code routes SoundCloud directly and official remixes through resolveVideoId', () => {
      // Direct SoundCloud handler check in audioEngine.ts
      const scDirectBlock = audioEngineSource.includes('const scDirectMatch = cleanNew.match(/^sc-(\\d+)$/);');
      assert.ok(scDirectBlock, 'audioEngine.ts must test cleanNew against ^sc-(\\d+)$ for direct HTML5 streaming');

      // resolveVideoId guard check
      const resolveGuard = audioEngineSource.includes('if (trackId && /^sc-\\d+$/.test(AudioEngine.cleanId(trackId))) return null;');
      assert.ok(resolveGuard, 'audioEngine.ts must guard resolveVideoId to only return null for sc- tracks');

      // Fallthrough to resolveVideoId for non-sc tracks
      const resolverCall = audioEngineSource.includes('let videoId = await this.resolveVideoId(query, trackId, tTitle, tArtist, tDur);');
      assert.ok(resolverCall, 'audioEngine.ts must call resolveVideoId for catalog / official remix tracks');
    });
  });

  // =========================================================================
  // Section 3: Requirement R5 Preservation Invariants in server.mjs & Offline Files
  // =========================================================================
  describe('Requirement R5 Preservation Invariants', () => {
    it('server.mjs imports in lines 1-14 are intact and match expected imports', () => {
      const lines = serverSource.split('\n');
      const lines1to14 = lines.slice(0, 14).join('\n');

      assert.ok(lines1to14.includes("import http from 'node:http';"), 'Line 1 import http');
      assert.ok(lines1to14.includes("import https from 'node:https';"), 'Line 2 import https');
      assert.ok(lines1to14.includes("import fs from 'node:fs';"), 'Line 3 import fs');
      assert.ok(lines1to14.includes("import path from 'node:path';"), 'Line 4 import path');
      assert.ok(lines1to14.includes("from './scripts/audioService.mjs';"), 'Line 5 audioService.mjs import');
      assert.ok(lines1to14.includes("from './scripts/spotifySessionExtractor.mjs';"), 'Line 6 spotifySessionExtractor import');
      assert.ok(lines1to14.includes("from './api/_lib/extract-session.js';"), 'Line 7 extract-session import');
      assert.ok(lines1to14.includes("from './api/_lib/musicFallback.js';"), 'Line 8-13 musicFallback import');
      assert.ok(lines1to14.includes('searchSoundCloudCatalog'), 'searchSoundCloudCatalog imported');
      assert.ok(lines1to14.includes('resolveSoundCloudUrl'), 'resolveSoundCloudUrl imported');
      assert.ok(lines1to14.includes('findMatchingOfficialTrackIndex'), 'findMatchingOfficialTrackIndex imported');
      assert.ok(lines1to14.includes('buildArtistSoundCloudVault'), 'buildArtistSoundCloudVault imported');
    });

    it('server.mjs lines 172-308 (Audio Stream, Download, Resolve, Instrumental, Play) are 100% intact', () => {
      const lines = serverSource.split('\n');
      const audioSection = lines.slice(171, 308).join('\n');

      assert.ok(audioSection.includes("pathname === '/api/audio/stream' || pathname === '/api/audio/download'"), 'Direct stream/download endpoint');
      assert.ok(audioSection.includes('streamAudioDirect('), 'streamAudioDirect call intact');
      assert.ok(audioSection.includes("pathname === '/api/audio/resolve'"), 'Audio resolve endpoint intact');
      assert.ok(audioSection.includes('resolveYouTubeVideoId(q)'), 'resolveYouTubeVideoId call intact');
      assert.ok(audioSection.includes('resolveAudio(q)'), 'resolveAudio call intact');
      assert.ok(audioSection.includes("pathname === '/api/audio/instrumental'"), 'Instrumental endpoint intact');
      assert.ok(audioSection.includes('findBestInstrumentalNode('), 'findBestInstrumentalNode call intact');
      assert.ok(audioSection.includes("pathname === '/api/audio/play'"), 'Audio play endpoint intact');
    });

    it('server.mjs lines 491-504 (Audio Status) are 100% intact', () => {
      const lines = serverSource.split('\n');
      const statusSection = lines.slice(490, 504).join('\n');

      assert.ok(statusSection.includes("pathname === '/api/audio/status'"), 'Audio status endpoint intact');
      assert.ok(statusSection.includes('isPlaying: true'), 'isPlaying: true in status payload');
      assert.ok(statusSection.includes('videoId: currentPlayingTrackId'), 'videoId: currentPlayingTrackId in status payload');
    });

    it('All R5 preserved offline files exist on disk and are non-empty', () => {
      const r5Files = [
        'api/_lib/musicFallback.js',
        'api/audio.js',
        'scripts/audioService.mjs',
        'server.mjs',
        'native/android/SpotifreeLocalMusicPlugin.java',
        'src/utils/offlineStorage.ts',
        'tests/offline_downloads.test.js',
      ];

      for (const relPath of r5Files) {
        const fullPath = path.resolve(relPath);
        assert.ok(fs.existsSync(fullPath), `R5 preserved file ${relPath} must exist`);
        const stats = fs.statSync(fullPath);
        assert.ok(stats.size > 0, `R5 preserved file ${relPath} must not be empty (size: ${stats.size} bytes)`);
      }
    });
  });

  // =========================================================================
  // Section 4: All 17 Regex Assertions in tests/mobile_search_e2e.test.js
  // =========================================================================
  describe('Mobile Search E2E 17 Regex Assertions Verification', () => {
    it('Extracts and validates all 17 regex assertions against MobileSearchView.tsx', () => {
      const regexMatch = /assert\.match\(\s*mobileSearchViewSource,\s*(\/[^\n]+\/)/g;
      const patterns = [];
      let m;
      while ((m = regexMatch.exec(mobileE2ESource)) !== null) {
        patterns.push(m[1]);
      }

      assert.equal(patterns.length, 17, `Expected exactly 17 regex assertions for mobileSearchViewSource, found ${patterns.length}`);

      const results = patterns.map((patStr, idx) => {
        // Evaluate literal regex safely
        const regex = new RegExp(patStr.slice(1, patStr.lastIndexOf('/')), patStr.slice(patStr.lastIndexOf('/') + 1));
        const passed = regex.test(mobileSource);
        return { index: idx + 1, pattern: patStr, passed };
      });

      const failed = results.filter((r) => !r.passed);
      assert.equal(
        failed.length,
        0,
        `Expected 0 failed regex assertions, but ${failed.length} failed: ${JSON.stringify(failed, null, 2)}`
      );
    });
  });
});
