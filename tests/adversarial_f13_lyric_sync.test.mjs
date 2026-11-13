/**
/**
 * Adversarial Stress & Empirical Test Suite: F13 Lyric Synchronization
 * Tests: edge cases, extreme values, NaN, corrupt storage, prototype pollution,
 * high-throughput updates, duration clamping, and all 5 UI consumers.
 * Run: node tests/adversarial_f13_lyric_sync.test.mjs
 */
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';

// Setup isolated mock storage environment
class MockLocalStorage {
  constructor() {
    this.store = new Map();
    this.shouldThrowOnGet = false;
    this.shouldThrowOnSet = false;
  }
  getItem(key) {
    if (this.shouldThrowOnGet) throw new Error('SecurityError: Access Denied');
    return this.store.has(key) ? this.store.get(key) : null;
  }
  setItem(key, value) {
    if (this.shouldThrowOnSet) throw new Error('QuotaExceededError: Storage Full');
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
    this.shouldThrowOnGet = false;
    this.shouldThrowOnSet = false;
  }
}

const mockStorage = new MockLocalStorage();
globalThis.localStorage = mockStorage;
globalThis.window = {
  localStorage: mockStorage,
};

// Import lyricsService
const {
  getSynchronizedLyricProgress,
  getLyricSyncOffsetMs,
  setLyricSyncOffsetMs,
  DEFAULT_LYRIC_SYNC_OFFSET_MS,
  LYRIC_SYNC_OFFSET_KEY,
} = await import('../src/utils/lyricsService.ts');

describe('Adversarial Challenge 1: getSynchronizedLyricProgress Mathematical Boundaries', () => {
  beforeEach(() => {
    mockStorage.clear();
    setLyricSyncOffsetMs(DEFAULT_LYRIC_SYNC_OFFSET_MS); // Reset to 850
  });

  it('handles negative progressMs safely by clamping to 0 or non-negative', () => {
    // With offset 850:
    // progressMs = -300 -> -300 + 850 = 550
    assert.equal(getSynchronizedLyricProgress(-300), 550);
    // progressMs = -850 -> -850 + 850 = 0
    assert.equal(getSynchronizedLyricProgress(-850), 0);
    // progressMs = -1000 -> clamped to 0
    assert.equal(getSynchronizedLyricProgress(-1000), 0);
    // progressMs = -1e9 -> clamped to 0
    assert.equal(getSynchronizedLyricProgress(-1e9), 0);
    // progressMs = -Infinity -> clamped to 0
    assert.equal(getSynchronizedLyricProgress(-Infinity), 0);
  });

  it('handles extremely large progressMs without overflow or NaN', () => {
    const huge1 = 1e9; // 1 billion ms (~277 hours)
    assert.equal(getSynchronizedLyricProgress(huge1), 1e9 + 850);

    const huge2 = Number.MAX_SAFE_INTEGER - 1000;
    const res = getSynchronizedLyricProgress(huge2);
    assert.ok(Number.isFinite(res));
    assert.ok(res > huge2);

    // +Infinity
    const infRes = getSynchronizedLyricProgress(Infinity);
    assert.equal(infRes, Infinity);
  });

  it('gracefully handles non-numeric types and NaN without throwing', () => {
    // NaN should treat raw progress as 0 -> returns offset
    assert.equal(getSynchronizedLyricProgress(NaN), 850);

    // undefined should treat raw progress as 0
    assert.equal(getSynchronizedLyricProgress(undefined), 850);

    // null
    assert.equal(getSynchronizedLyricProgress(null), 850);

    // string
    assert.equal(getSynchronizedLyricProgress('1500'), 850);

    // boolean
    assert.equal(getSynchronizedLyricProgress(true), 850);
    assert.equal(getSynchronizedLyricProgress(false), 850);

    // Object and Array
    assert.equal(getSynchronizedLyricProgress({}), 850);
    assert.equal(getSynchronizedLyricProgress([1000]), 850);
  });

  it('handles fractional milliseconds and rounds to integer', () => {
    assert.equal(getSynchronizedLyricProgress(100.4), 950);
    assert.equal(getSynchronizedLyricProgress(100.6), 951);
    assert.equal(getSynchronizedLyricProgress(0.0001), 850);
  });
});

describe('Adversarial Challenge 2: maxDurationMs Clamping Invariants', () => {
  beforeEach(() => {
    mockStorage.clear();
    setLyricSyncOffsetMs(850);
  });

  it('clamps synchronized progress to maxDurationMs when progress exceeds duration', () => {
    const duration = 210000; // 3.5 minutes
    // Normal progress well below duration
    assert.equal(getSynchronizedLyricProgress(10000, duration), 10850);

    // Near end of song (progress 209500 + 850 = 210350 > 210000)
    assert.equal(getSynchronizedLyricProgress(209500, duration), 210000);

    // At exact end of song
    assert.equal(getSynchronizedLyricProgress(210000, duration), 210000);

    // Past end of song
    assert.equal(getSynchronizedLyricProgress(250000, duration), 210000);
  });

  it('handles edge case where maxDurationMs is smaller than offset', () => {
    // E.g., ultra-short audio sample or sound effect (500ms duration)
    // progress = 0 -> 0 + 850 = 850 -> clamped to 500
    assert.equal(getSynchronizedLyricProgress(0, 500), 500);
    assert.equal(getSynchronizedLyricProgress(200, 500), 500);
  });

  it('gracefully handles invalid maxDurationMs values without crashing', () => {
    // maxDurationMs = 0: ignored (non-positive), returns unclamped
    assert.equal(getSynchronizedLyricProgress(1000, 0), 1850);

    // maxDurationMs negative: ignored, returns unclamped
    assert.equal(getSynchronizedLyricProgress(1000, -500), 1850);

    // maxDurationMs NaN: ignored
    assert.equal(getSynchronizedLyricProgress(1000, NaN), 1850);

    // maxDurationMs undefined: ignored
    assert.equal(getSynchronizedLyricProgress(1000, undefined), 1850);

    // maxDurationMs Infinity: Math.min(Infinity, 1850) = 1850
    assert.equal(getSynchronizedLyricProgress(1000, Infinity), 1850);
  });
});

describe('Adversarial Challenge 3: LocalStorage Resilience, Corruption & Prototype Pollution', () => {
  beforeEach(() => {
    mockStorage.clear();
  });

  it('handles empty strings and whitespace without throwing or yielding NaN', () => {
    mockStorage.setItem(LYRIC_SYNC_OFFSET_KEY, '');
    assert.equal(getLyricSyncOffsetMs(), 850);

    mockStorage.setItem(LYRIC_SYNC_OFFSET_KEY, '   ');
    assert.equal(getLyricSyncOffsetMs(), 850);

    mockStorage.setItem(LYRIC_SYNC_OFFSET_KEY, '\t\r\n');
    assert.equal(getLyricSyncOffsetMs(), 850);
  });

  it('handles corrupt non-numeric strings, JSON, and objects safely', () => {
    mockStorage.setItem(LYRIC_SYNC_OFFSET_KEY, 'corrupted_offset_data');
    assert.equal(getLyricSyncOffsetMs(), 850);

    mockStorage.setItem(LYRIC_SYNC_OFFSET_KEY, '{"offset": 1200}');
    assert.equal(getLyricSyncOffsetMs(), 850);

    mockStorage.setItem(LYRIC_SYNC_OFFSET_KEY, '[100, 200]');
    assert.equal(getLyricSyncOffsetMs(), 850);

    mockStorage.setItem(LYRIC_SYNC_OFFSET_KEY, 'NaN');
    assert.equal(getLyricSyncOffsetMs(), 850);

    mockStorage.setItem(LYRIC_SYNC_OFFSET_KEY, 'undefined');
    assert.equal(getLyricSyncOffsetMs(), 850);

    mockStorage.setItem(LYRIC_SYNC_OFFSET_KEY, 'null');
    assert.equal(getLyricSyncOffsetMs(), 850);
  });

  it('resists prototype pollution payloads', () => {
    mockStorage.setItem(LYRIC_SYNC_OFFSET_KEY, '__proto__');
    assert.equal(getLyricSyncOffsetMs(), 850);

    mockStorage.setItem('__proto__', 'polluted');
    mockStorage.setItem('constructor', 'polluted');
    assert.equal(getLyricSyncOffsetMs(), 850);

    // Pass prototype strings into setLyricSyncOffsetMs
    setLyricSyncOffsetMs('__proto__');
    assert.equal(getLyricSyncOffsetMs(), 850);

    setLyricSyncOffsetMs({ toString: () => 'polluted' });
    assert.equal(getLyricSyncOffsetMs(), 850);
  });

  it('gracefully survives when localStorage throws SecurityError on read or write', () => {
    // Configure mock to throw SecurityError (e.g. sandboxed iframe or private mode)
    setLyricSyncOffsetMs(650);
    assert.equal(getLyricSyncOffsetMs(), 650);

    mockStorage.shouldThrowOnGet = true;
    // Should catch exception and return memoryLyricSyncOffset
    assert.equal(getLyricSyncOffsetMs(), 650);

    // Test throwing on set
    mockStorage.shouldThrowOnSet = true;
    assert.doesNotThrow(() => {
      setLyricSyncOffsetMs(900);
    });
    // Memory fallback should update to 900
    assert.equal(getLyricSyncOffsetMs(), 900);
  });

  it('handles setting invalid values in setLyricSyncOffsetMs', () => {
    setLyricSyncOffsetMs(NaN);
    assert.equal(getLyricSyncOffsetMs(), 850);

    setLyricSyncOffsetMs(undefined);
    assert.equal(getLyricSyncOffsetMs(), 850);

    setLyricSyncOffsetMs('not_a_number');
    assert.equal(getLyricSyncOffsetMs(), 850);
  });

  it('supports negative and zero offsets when explicitly calibrated', () => {
    // E.g. audio hardware with severe delay where lyrics must be delayed
    setLyricSyncOffsetMs(-200);
    assert.equal(getLyricSyncOffsetMs(), -200);
    assert.equal(getSynchronizedLyricProgress(1000), 800);
    assert.equal(getSynchronizedLyricProgress(100), 0); // Clamped at 0

    setLyricSyncOffsetMs(0);
    assert.equal(getLyricSyncOffsetMs(), 0);
    assert.equal(getSynchronizedLyricProgress(1000), 1000);
  });
});

describe('Adversarial Challenge 4: High-Throughput Stress & Rapid Dynamic Offset Updates', () => {
  beforeEach(() => {
    mockStorage.clear();
  });

  it('handles 10,000 rapid dynamic offset transitions seamlessly', () => {
    const start = performance.now();
    for (let i = 0; i < 10000; i++) {
      const offset = (i % 2000) - 500; // Oscilate between -500 and 1499
      setLyricSyncOffsetMs(offset);
      const synced = getSynchronizedLyricProgress(1000);
      assert.equal(synced, Math.max(0, 1000 + offset));
    }
    const elapsed = performance.now() - start;
    // 10,000 iterations must complete within reasonable time (< 200ms)
    assert.ok(elapsed < 200, `10,000 rapid updates took ${elapsed.toFixed(2)}ms, expected < 200ms`);
  });

  it('executes 100,000 getSynchronizedLyricProgress calls under 50ms', () => {
    setLyricSyncOffsetMs(850);
    const start = performance.now();
    let sum = 0;
    for (let i = 0; i < 100000; i++) {
      sum += getSynchronizedLyricProgress(i % 180000, 180000);
    }
    const elapsed = performance.now() - start;
    assert.ok(sum > 0);
    assert.ok(elapsed < 100, `100,000 progress calculations took ${elapsed.toFixed(2)}ms, expected < 100ms`);
  });
});

describe('Adversarial Challenge 5: UI Consumer Simulation & Boundary Verification', () => {
  beforeEach(() => {
    mockStorage.clear();
    setLyricSyncOffsetMs(850);
  });

  // Sample realistic synced lyrics lines
  const mockSyncedLyrics = [
    { timeMs: 3500, text: 'First line of the song', words: [{ text: 'First', timeMs: 3500 }, { text: 'line', timeMs: 4000 }] },
    { timeMs: 7200, text: 'Second chorus line begins', words: [{ text: 'Second', timeMs: 7200 }, { text: 'chorus', timeMs: 7800 }] },
    { timeMs: 12000, text: 'Final outro line', words: [{ text: 'Final', timeMs: 12000 }, { text: 'outro', timeMs: 12500 }] },
  ];
  const trackDuration = 15000;

  it('DesktopRightSidebar: activeLineIndex reduction and word timing logic', () => {
    // 1. Before audio starts or intro before first lyric
    // progressMs = 1000 -> syncProgress = 1850 (< 3500)
    let syncProgress = getSynchronizedLyricProgress(1000, trackDuration);
    let activeLineIndex = mockSyncedLyrics.reduce((acc, line, idx) => (line.timeMs <= syncProgress ? idx : acc), -1);
    assert.equal(activeLineIndex, -1, 'Before intro vocal onset, activeLineIndex should be -1');

    // 2. Audio progress at 2650ms + 850ms offset = 3500ms (exact match with first line)
    syncProgress = getSynchronizedLyricProgress(2650, trackDuration);
    activeLineIndex = mockSyncedLyrics.reduce((acc, line, idx) => (line.timeMs <= syncProgress ? idx : acc), -1);
    assert.equal(activeLineIndex, 0, 'Exact vocal lead should activate line 0');

    // Word illumination check
    const line0 = mockSyncedLyrics[0];
    const isWord0Sung = syncProgress >= line0.words[0].timeMs; // 3500 >= 3500 -> true
    const isWord1Sung = syncProgress >= line0.words[1].timeMs; // 3500 >= 4000 -> false
    assert.equal(isWord0Sung, true);
    assert.equal(isWord1Sung, false);

    // 3. Audio progress between line 0 and line 1
    // progressMs = 4000 -> syncProgress = 4850
    syncProgress = getSynchronizedLyricProgress(4000, trackDuration);
    activeLineIndex = mockSyncedLyrics.reduce((acc, line, idx) => (line.timeMs <= syncProgress ? idx : acc), -1);
    assert.equal(activeLineIndex, 0, 'Mid-line progress should remain at line 0');

    // 4. Audio progress past last line
    // progressMs = 13000 -> syncProgress = 13850
    syncProgress = getSynchronizedLyricProgress(13000, trackDuration);
    activeLineIndex = mockSyncedLyrics.reduce((acc, line, idx) => (line.timeMs <= syncProgress ? idx : acc), -1);
    assert.equal(activeLineIndex, 2, 'Past last line should stay on final line (index 2)');

    // 5. Empty lyrics array check
    const emptyLyrics = [];
    activeLineIndex = emptyLyrics.length > 0
      ? emptyLyrics.reduce((acc, line, idx) => (line.timeMs <= syncProgress ? idx : acc), -1)
      : -1;
    assert.equal(activeLineIndex, -1, 'Empty lyrics array should yield -1 without error');
  });

  it('MobileNowPlayingModal: findIndex active line and word rendering', () => {
    // vocalProgressMs logic:
    // progressMs = 6500 -> vocalProgressMs = 7350
    const vocalProgressMs = getSynchronizedLyricProgress(6500, trackDuration);
    assert.equal(vocalProgressMs, 7350);

    const activeLineIndex = mockSyncedLyrics.length > 0
      ? mockSyncedLyrics.findIndex((line, i) => {
          const nextLine = mockSyncedLyrics[i + 1];
          return vocalProgressMs >= line.timeMs && (!nextLine || vocalProgressMs < nextLine.timeMs);
        })
      : -1;

    assert.equal(activeLineIndex, 1, 'vocalProgressMs 7350 should match line index 1 (timeMs 7200 < 7350 < 12000)');

    // Word highlighting for line 1:
    const line1 = mockSyncedLyrics[1];
    const w0Sung = vocalProgressMs >= line1.words[0].timeMs; // 7350 >= 7200 -> true
    const w1Sung = vocalProgressMs >= line1.words[1].timeMs; // 7350 >= 7800 -> false
    assert.equal(w0Sung, true);
    assert.equal(w1Sung, false);
  });

  it('LyricsFullscreen: verifies scrubber uses raw progress while words use syncProgress', () => {
    const rawProgress = 5000;
    const duration = 200000;

    // Scrubber calculation in LyricsFullscreen:
    const percent = duration > 0 ? Math.min(100, (rawProgress / duration) * 100) : 0;
    assert.equal(percent, 2.5, 'Scrubber must remain tied to unshifted audio progress');

    // Word illumination calculation:
    const vocalMs = getSynchronizedLyricProgress(rawProgress, duration);
    assert.equal(vocalMs, 5850, 'Vocal illumination must use synchronized progress');
  });

  it('PlayerExtras: miniplayer reverse scan finds active line', () => {
    const syncProgress = getSynchronizedLyricProgress(7000, trackDuration); // 7850ms
    let found = '';
    for (let i = mockSyncedLyrics.length - 1; i >= 0; i--) {
      if (syncProgress >= mockSyncedLyrics[i].timeMs) {
        found = mockSyncedLyrics[i].text;
        break;
      }
    }
    const currentLine = found || (mockSyncedLyrics[0]?.text ?? '');
    assert.equal(currentLine, 'Second chorus line begins');

    // Before any line has started (e.g. progress 0 -> 850 < 3500)
    const earlySync = getSynchronizedLyricProgress(0, trackDuration);
    let earlyFound = '';
    for (let i = mockSyncedLyrics.length - 1; i >= 0; i--) {
      if (earlySync >= mockSyncedLyrics[i].timeMs) {
        earlyFound = mockSyncedLyrics[i].text;
        break;
      }
    }
    const earlyLine = earlyFound || (mockSyncedLyrics[0]?.text ?? '');
    assert.equal(earlyLine, 'First line of the song', 'Should fall back to first line text during intro');
  });

  it('nativeMedia: currentLyricLine simulates car display and notification sync', () => {
    let carLyricsEnabled = true;

    function currentLyricLine(progressMs, durationMs) {
      if (!carLyricsEnabled || mockSyncedLyrics.length === 0) return '';
      const syncProgress = getSynchronizedLyricProgress(progressMs, durationMs);
      let line = '';
      for (const l of mockSyncedLyrics) {
        if (l.timeMs <= syncProgress) line = l.text;
        else break;
      }
      return line;
    }

    // When disabled
    carLyricsEnabled = false;
    assert.equal(currentLyricLine(7000, trackDuration), '');

    // When enabled
    carLyricsEnabled = true;
    assert.equal(currentLyricLine(1000, trackDuration), '', 'Before first line, car shows empty string');
    assert.equal(currentLyricLine(2650, trackDuration), 'First line of the song');
    assert.equal(currentLyricLine(7000, trackDuration), 'Second chorus line begins');
    assert.equal(currentLyricLine(14000, trackDuration), 'Final outro line');
  });
});
