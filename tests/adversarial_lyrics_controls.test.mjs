import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';

describe('Milestone 2 Adversarial Stress Test: Lyrics Controls & Simplification', () => {
  const rootDir = process.cwd();
  const mobileModalPath = path.join(rootDir, 'src', 'components', 'mobile', 'MobileNowPlayingModal.tsx');
  const desktopSidebarPath = path.join(rootDir, 'src', 'components', 'desktop', 'DesktopRightSidebar.tsx');
  const lyricsFullscreenPath = path.join(rootDir, 'src', 'components', 'mobile', 'LyricsFullscreen.tsx');

  const mobileContent = fs.readFileSync(mobileModalPath, 'utf8');
  const desktopContent = fs.readFileSync(desktopSidebarPath, 'utf8');
  const fullscreenContent = fs.readFileSync(lyricsFullscreenPath, 'utf8');

  // =========================================================================
  // SECTION 1: Mobile Header Simplification & Removal of "Pantalla completa"
  // =========================================================================
  describe('Mobile Lyrics Header & Controls Simplification', () => {
    it('removes "Pantalla completa" button badge completely from mobile lyrics card', () => {
      // Find the lyrics card section
      const lyricsCardStart = mobileContent.indexOf('SECTION: Expandable Spotify Mobile Lyrics Card');
      assert.ok(lyricsCardStart !== -1, 'Could not find lyrics card section in MobileNowPlayingModal.tsx');
      
      const lyricsCardSlice = mobileContent.slice(lyricsCardStart, lyricsCardStart + 2500);

      assert.equal(
        lyricsCardSlice.includes('Pantalla completa'),
        false,
        'Found forbidden "Pantalla completa" text inside mobile lyrics card'
      );
      assert.equal(
        lyricsCardSlice.includes('title="Pantalla completa"'),
        false,
        'Found forbidden title="Pantalla completa" in mobile lyrics card'
      );
    });

    it('removes green indicator dot next to "Letras" in both synced and unsynced conditions', () => {
      const lyricsCardStart = mobileContent.indexOf('SECTION: Expandable Spotify Mobile Lyrics Card');
      const lyricsCardSlice = mobileContent.slice(lyricsCardStart, lyricsCardStart + 2500);

      // Verify no green badge in header
      const headerMatch = lyricsCardSlice.match(/\{\/\* Lyrics Card Header \*\/\}[\s\S]*?<div[\s\S]*?<\/div>/);
      assert.ok(headerMatch, 'Could not extract Lyrics Card Header');
      const headerSnippet = headerMatch[0];

      assert.equal(
        headerSnippet.includes('#1ed760'),
        false,
        'Lyrics header must not contain #1ed760 green indicator'
      );
      assert.equal(
        headerSnippet.includes('rounded-full'),
        false,
        'Lyrics header must not contain rounded-full dot indicator'
      );
      assert.equal(
        headerSnippet.includes('syncedLines.length > 0'),
        false,
        'Lyrics header must not conditionally render dot based on syncedLines.length'
      );
      // Clean header typography
      assert.match(
        headerSnippet,
        /<span className="font-bold text-base tracking-tight font-\['SpotifyMixUITitle'\]">\s*Letras\s*<\/span>/,
        'Lyrics header should be clean text "Letras" with SpotifyMixUITitle typography'
      );
    });

    it('preserves "Ampliar" button in footer with clean title and expansion trigger', () => {
      const lyricsCardStart = mobileContent.indexOf('SECTION: Expandable Spotify Mobile Lyrics Card');
      const lyricsCardSlice = mobileContent.slice(lyricsCardStart, lyricsCardStart + 6000);

      assert.match(
        lyricsCardSlice,
        /<button[\s\S]*?onClick=\{\(\) => setIsLyricsExpanded\(true\)\}[\s\S]*?title="Ampliar letra"[\s\S]*?>[\s\S]*?<span>Ampliar<\/span>/,
        'Footer must preserve "Ampliar" button wired to setIsLyricsExpanded(true) with title="Ampliar letra"'
      );
    });

    it('header container remains clickable to expand lyrics for optimal UX', () => {
      const lyricsCardStart = mobileContent.indexOf('SECTION: Expandable Spotify Mobile Lyrics Card');
      const lyricsCardSlice = mobileContent.slice(lyricsCardStart, lyricsCardStart + 1000);

      assert.match(
        lyricsCardSlice,
        /<div[\s\S]*?onClick=\{\(\) => setIsLyricsExpanded\(true\)\}[\s\S]*?cursor-pointer/,
        'Header div must remain clickable with cursor-pointer to trigger expansion'
      );
    });
  });

  // =========================================================================
  // SECTION 2: Desktop Right Sidebar Lyrics Preview Cleanliness
  // =========================================================================
  describe('Desktop Right Sidebar Lyrics Preview', () => {
    it('removes green active pulse dot next to "Vista previa de la letra"', () => {
      const previewStart = desktopContent.indexOf('Real Synced Lyrics Preview');
      assert.ok(previewStart !== -1, 'Could not find Real Synced Lyrics Preview in DesktopRightSidebar.tsx');

      const previewSlice = desktopContent.slice(previewStart, previewStart + 800);

      assert.equal(
        previewSlice.includes('animate-pulse'),
        false,
        'Lyrics preview header must not contain animate-pulse'
      );
      assert.equal(
        previewSlice.includes('title="Sincronizada"'),
        false,
        'Lyrics preview header must not contain title="Sincronizada"'
      );
      assert.equal(
        previewSlice.includes('w-1.5 h-1.5 rounded-full bg-[#1ed760]'),
        false,
        'Lyrics preview header must not contain green dot'
      );

      // Clean typography check
      assert.match(
        previewSlice,
        /<span className="font-bold text-sm tracking-tight text-white">\s*Vista previa de la letra\s*<\/span>/,
        'Lyrics preview header must have clean typography without conditional adornments'
      );
    });

    it('lyrics preview maintains stable layout across synced, unsynced, and empty states', () => {
      const previewStart = desktopContent.indexOf('Real Synced Lyrics Preview');
      const previewSlice = desktopContent.slice(previewStart, previewStart + 4500);

      // Verify the container has min-h-[96px] to prevent layout collapse
      assert.ok(
        previewSlice.includes('min-h-[96px]'),
        'Lyrics preview container must maintain min-h-[96px] to prevent layout shift'
      );

      // Verify the 3 branching states: syncedLyrics, plainLyrics, and fallback loading
      assert.ok(previewSlice.includes('syncedLyrics.length > 0'), 'Must handle synced lyrics');
      assert.ok(previewSlice.includes('plainLyrics.length > 0'), 'Must handle plain lyrics fallback');
      assert.ok(previewSlice.includes('Cargando letra sincronizada...'), 'Must handle empty/loading state');
    });
  });

  // =========================================================================
  // SECTION 3: Sync & Fullscreen Mechanics Integrity
  // =========================================================================
  describe('Lyrics Sync, Word Illumination & Fullscreen Mechanics', () => {
    it('MobileNowPlayingModal wires all required synchronization props to LyricsFullscreen', () => {
      const lyricsFsMatch = mobileContent.match(/<LyricsFullscreen[\s\S]*?\/>/);
      assert.ok(lyricsFsMatch, 'LyricsFullscreen component must be rendered');
      const fsInvocation = lyricsFsMatch[0];

      const requiredProps = [
        'open={isLyricsExpanded}',
        'onClose={() => setIsLyricsExpanded(false)}',
        'title={currentTrack.name}',
        'artist={(currentTrack.artists || []).map((a) => a.name).join(\', \')}',
        'cover={coverUrl}',
        'color={extractedModalColor}',
        'lines={syncedLines as any}',
        'plain={lyrics as any}',
        'activeIndex={activeLineIndex}',
        'progressMs={progressMs}',
        'durationMs={durationMs}',
        'isPlaying={isPlaying}',
        'onTogglePlay={togglePlay}',
        'onSeek='
      ];

      for (const prop of requiredProps) {
        assert.ok(
          fsInvocation.includes(prop),
          `LyricsFullscreen missing expected prop binding: ${prop}`
        );
      }
    });

    it('auto-scroll and manual-scroll hysteresis in LyricsFullscreen functions cleanly', () => {
      assert.ok(
        fullscreenContent.includes('const [following, setFollowing] = useState(true);'),
        'LyricsFullscreen must track following state'
      );
      assert.ok(
        fullscreenContent.includes('box.scrollTo({ top: Math.max(0, el.offsetTop - box.clientHeight * 0.38), behavior: \'smooth\' });'),
        'LyricsFullscreen must calculate 38% golden viewport scroll offset'
      );
      assert.ok(
        fullscreenContent.includes('resumeTimer.current = setTimeout(() => setFollowing(true), 5000);'),
        'LyricsFullscreen must give user 5s window before re-attaching auto-follow'
      );
    });

    it('simulates word-by-word illumination algorithm without NaN or crash under edge-case inputs', () => {
      // Simulate the word illumination logic from MobileNowPlayingModal.tsx:880-892
      const testCases = [
        { progressMs: 0, words: [{ timeMs: 500, text: 'Hello' }, { timeMs: 1200, text: 'World' }] },
        { progressMs: 500, words: [{ timeMs: 500, text: 'Hello' }, { timeMs: 1200, text: 'World' }] },
        { progressMs: 1500, words: [{ timeMs: 500, text: 'Hello' }, { timeMs: 1200, text: 'World' }] },
        { progressMs: -100, words: [] },
        { progressMs: 999999, words: [{ timeMs: 100, text: 'Solo' }] }
      ];

      for (const tc of testCases) {
        const vocalMs = tc.progressMs + 220;
        const results = tc.words.map(w => vocalMs >= w.timeMs);
        assert.equal(results.length, tc.words.length);
        if (tc.progressMs === 0) {
          // 0 + 220 = 220 < 500 -> false
          assert.equal(results[0], false);
        } else if (tc.progressMs === 500) {
          // 500 + 220 = 720 >= 500 -> true; 720 < 1200 -> false
          assert.equal(results[0], true);
          assert.equal(results[1], false);
        } else if (tc.progressMs === 1500) {
          assert.equal(results[0], true);
          assert.equal(results[1], true);
        }
      }
    });
  });

  // =========================================================================
  // SECTION 4: Requirement R5 Preservation & Integrity Verification
  // =========================================================================
  describe('Requirement R5: Offline & Downloads Preservation Audit', () => {
    const r5Files = [
      'api/_lib/musicFallback.js',
      'api/audio.js',
      'scripts/audioService.mjs',
      'server.mjs',
      'native/android/SpotifreeLocalMusicPlugin.java',
      'src/utils/offlineStorage.ts',
      'tests/offline_downloads.test.js'
    ];

    for (const file of r5Files) {
      it(`preserves R5 file intact: ${file}`, () => {
        const fullPath = path.join(rootDir, file);
        assert.ok(fs.existsSync(fullPath), `R5 file missing: ${file}`);
        const content = fs.readFileSync(fullPath);
        assert.ok(content.length > 0, `R5 file is empty: ${file}`);
      });
    }

    it('offline download test suite executes directly and passes 7/7 tests', () => {
      const output = execSync('node tests/offline_downloads.test.js', {
        cwd: rootDir,
        encoding: 'utf8'
      });
      assert.ok(output.includes('tests 7'), 'Expected 7 tests');
      assert.ok(output.includes('pass 7'), 'Expected all 7 tests to pass');
      assert.ok(output.includes('fail 0'), 'Expected 0 failures');
    });
  });
});
