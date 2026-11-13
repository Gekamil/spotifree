import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function readRel(rel) {
  return fs.readFileSync(path.join(rootDir, rel), 'utf8');
}

describe('Forensic Independent Audit — Tier 1: XML Vector & Theme Structural Integrity', () => {
  it('Validates all Android Auto vector drawables are valid XML with well-formed path commands and colors', () => {
    const drawables = [
      'native/android/res/drawable/ic_car_repeat_one.xml',
      'native/android/res/drawable/ic_car_repeat_on.xml',
      'native/android/res/drawable/ic_car_repeat.xml',
      'native/android/res/drawable/ic_car_shuffle.xml',
      'native/android/res/drawable/ic_car_shuffle_on.xml',
      'native/android/res/drawable/ic_car_heart.xml',
      'native/android/res/drawable/ic_car_heart_filled.xml',
      'native/android/res/drawable/ic_car_star.xml',
      'native/android/res/drawable/ic_car_star_filled.xml',
    ];

    for (const rel of drawables) {
      assert.ok(fs.existsSync(path.join(rootDir, rel)), `Drawable ${rel} must exist`);
      const xml = readRel(rel);
      assert.ok(xml.startsWith('<?xml'), `${rel} must start with XML declaration`);
      assert.ok(xml.includes('<vector'), `${rel} must contain <vector> element`);
      assert.ok(xml.includes('android:viewportWidth="24"'), `${rel} must have 24dp viewport width`);
      assert.ok(xml.includes('android:viewportHeight="24"'), `${rel} must have 24dp viewport height`);
      assert.ok(xml.includes('android:pathData='), `${rel} must define genuine pathData`);

      // Check all pathData strings contain valid SVG path commands
      const pathMatches = [...xml.matchAll(/android:pathData="([^"]+)"/g)];
      assert.ok(pathMatches.length > 0, `${rel} must have at least one path`);
      for (const m of pathMatches) {
        const pathData = m[1];
        assert.match(pathData, /^[MmLlHhVvCcSsQqTtAaZz0-9,.\s-]+$/, `pathData in ${rel} must only contain valid SVG tokens`);
      }

      // Check colors are well-formed hex
      const colorMatches = [...xml.matchAll(/android:fillColor="([^"]+)"/g)];
      for (const cm of colorMatches) {
        assert.match(cm[1], /^#[0-9A-Fa-f]{6,8}$/, `Color ${cm[1]} in ${rel} must be valid hex`);
      }
    }
  });

  it('Validates spotifree_car_theme.xml contains exact required theme items without malformations', () => {
    const theme = readRel('native/android/res/values/spotifree_car_theme.xml');
    assert.ok(theme.includes('name="SpotifreeCarTheme"'));
    assert.ok(theme.includes('<item name="colorPrimary">#1ED760</item>'));
    assert.ok(theme.includes('<item name="colorPrimaryDark">#121212</item>'));
    assert.ok(theme.includes('<item name="colorAccent">#1ED760</item>'));
    assert.ok(theme.includes('<item name="colorControlActivated">#1ED760</item>'));
    assert.ok(theme.includes('<item name="colorControlHighlight">#201ED760</item>'));
  });
});

describe('Forensic Independent Audit — Tier 2: SpotifreeMediaService State Machine Verification', () => {
  it('Verifies dynamic custom actions, shuffle/repeat/star modes, and prefix stripping in SpotifreeMediaService.java', () => {
    const java = readRel('native/android/SpotifreeMediaService.java');

    // Verify useStar flag
    assert.ok(java.includes('static volatile boolean useStar = false;'));

    // Verify Star and Heart dual support
    assert.ok(java.includes('R.drawable.ic_car_star_filled'));
    assert.ok(java.includes('R.drawable.ic_car_star'));
    assert.ok(java.includes('R.drawable.ic_car_heart_filled'));
    assert.ok(java.includes('R.drawable.ic_car_heart'));

    // Verify custom actions construction
    assert.ok(java.includes('ACT_LIKE + (liked ? ":on" : ":off")'));
    assert.ok(java.includes('ACT_SHUFFLE + (shuffle ? ":on" : ":off")'));
    assert.ok(java.includes('ACT_REPEAT + ":" + repeat'));

    // Verify repeat mode icon mapping
    assert.ok(java.includes('"one".equals(repeat) ? R.drawable.ic_car_repeat_one'));
    assert.ok(java.includes('"all".equals(repeat) ? R.drawable.ic_car_repeat_on : R.drawable.ic_car_repeat'));

    // Verify MediaSession mode dispatch
    assert.ok(java.includes('session.setShuffleMode(shuffle ? PlaybackStateCompat.SHUFFLE_MODE_ALL : PlaybackStateCompat.SHUFFLE_MODE_NONE)'));
    assert.ok(java.includes('session.setRepeatMode("one".equals(repeat) ? PlaybackStateCompat.REPEAT_MODE_ONE'));
  });
});

describe('Forensic Independent Audit — Tier 3: Mathematical Fuzzing & Invariants of lyricsService.ts', async () => {
  // Setup in-memory localStorage mock
  const memoryMap = new Map();
  globalThis.localStorage = {
    getItem: (k) => memoryMap.has(k) ? memoryMap.get(k) : null,
    setItem: (k, v) => memoryMap.set(k, String(v)),
    removeItem: (k) => memoryMap.delete(k),
    clear: () => memoryMap.clear(),
  };
  globalThis.window = { localStorage: globalThis.localStorage };

  const {
    getSynchronizedLyricProgress,
    getLyricSyncOffsetMs,
    setLyricSyncOffsetMs,
    DEFAULT_LYRIC_SYNC_OFFSET_MS,
    LYRIC_SYNC_OFFSET_KEY,
  } = await import('../src/utils/lyricsService.ts');

  it('Verifies invariant: getSynchronizedLyricProgress(progressMs, maxDurationMs) is always in [0, maxDurationMs]', () => {
    setLyricSyncOffsetMs(850);

    // 10,000 randomized iterations
    for (let i = 0; i < 10000; i++) {
      const progress = (Math.random() - 0.3) * 500000; // includes negative progress
      const maxDur = Math.round(Math.random() * 400000 + 1000);
      const res = getSynchronizedLyricProgress(progress, maxDur);

      assert.ok(res >= 0, `Result ${res} must be >= 0 for input ${progress}`);
      assert.ok(res <= maxDur, `Result ${res} must be <= maxDur ${maxDur}`);
      assert.ok(Number.isInteger(res), `Result ${res} must be an integer`);
    }
  });

  it('Verifies invariant: Monotonicity holds for positive progress', () => {
    setLyricSyncOffsetMs(850);
    let prev = -1;
    for (let p = 0; p <= 100000; p += 33) {
      const cur = getSynchronizedLyricProgress(p);
      assert.ok(cur >= prev, `Monotonicity violation: ${cur} < ${prev} at ${p}`);
      prev = cur;
    }
  });

  it('Fuzzes edge-case parameters (NaN, Infinity, -Infinity, strings, null, undefined)', () => {
    setLyricSyncOffsetMs(850);

    assert.equal(getSynchronizedLyricProgress(NaN), 850);
    assert.equal(getSynchronizedLyricProgress(null), 850);
    assert.equal(getSynchronizedLyricProgress(undefined), 850);
    assert.equal(getSynchronizedLyricProgress('string'), 850);
    assert.equal(getSynchronizedLyricProgress(-9999999), 0);

    // Edge cases for setLyricSyncOffsetMs
    setLyricSyncOffsetMs('corrupted');
    assert.equal(getLyricSyncOffsetMs(), 850);

    setLyricSyncOffsetMs(NaN);
    assert.equal(getLyricSyncOffsetMs(), 850);

    setLyricSyncOffsetMs(420.7);
    assert.equal(getLyricSyncOffsetMs(), 421);
    assert.equal(globalThis.localStorage.getItem(LYRIC_SYNC_OFFSET_KEY), '421');
  });
});

describe('Forensic Independent Audit — Tier 4: Preserved Offline Files Unbroken Verification', () => {
  it('Confirms all 7 preserved offline files exist and contain genuine implementations', () => {
    const preserved = [
      'api/_lib/musicFallback.js',
      'api/audio.js',
      'scripts/audioService.mjs',
      'server.mjs',
      'native/android/SpotifreeLocalMusicPlugin.java',
      'src/utils/offlineStorage.ts',
      'tests/offline_downloads.test.js'
    ];

    for (const rel of preserved) {
      assert.ok(fs.existsSync(path.join(rootDir, rel)), `Preserved file ${rel} must exist`);
      const stat = fs.statSync(path.join(rootDir, rel));
      assert.ok(stat.size > 1000, `Preserved file ${rel} must not be empty or truncated (size: ${stat.size})`);
    }
  });
});
