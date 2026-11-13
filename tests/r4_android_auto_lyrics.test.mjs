/**
 * Milestone 3 Test Suite: Android Auto Integration & Lyric Synchronization (F12 & F13 / Requirement R4)
 * Run: node tests/r4_android_auto_lyrics.test.mjs
 */
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function readRel(relPath) {
  return fs.readFileSync(path.join(rootDir, relPath), 'utf8');
}

function existsRel(relPath) {
  return fs.existsSync(path.join(rootDir, relPath));
}

// Global localStorage mock for isolated unit testing
class MemoryStorage {
  constructor() { this.store = new Map(); }
  getItem(key) { return this.store.has(key) ? this.store.get(key) : null; }
  setItem(key, value) { this.store.set(key, String(value)); }
  removeItem(key) { this.store.delete(key); }
  clear() { this.store.clear(); }
}

globalThis.localStorage = new MemoryStorage();
globalThis.window = globalThis.window || {
  localStorage: globalThis.localStorage,
  dispatchEvent() {},
  addEventListener() {},
  removeEventListener() {},
};

describe('Milestone 3 — F12: Android Auto Theme & Visual Attributes', () => {
  it('spotifree_car_theme.xml defines Spotify Green accent and control activation colors', () => {
    const xml = readRel('native/android/res/values/spotifree_car_theme.xml');
    assert.match(xml, /<style\s+name=["']SpotifreeCarTheme["']/i, 'Must define SpotifreeCarTheme');
    assert.match(xml, /<item\s+name=["']colorPrimary["']\s*>#1ED760<\/item>/i, 'colorPrimary must be #1ED760');
    assert.match(xml, /<item\s+name=["']colorPrimaryDark["']\s*>#121212<\/item>/i, 'colorPrimaryDark must be #121212');
    assert.match(xml, /<item\s+name=["']colorAccent["']\s*>#1ED760<\/item>/i, 'colorAccent must be #1ED760');
    assert.match(xml, /<item\s+name=["']colorControlActivated["']\s*>#1ED760<\/item>/i, 'colorControlActivated must be #1ED760');
    assert.match(xml, /<item\s+name=["']colorControlHighlight["']\s*>#201ED760<\/item>/i, 'colorControlHighlight must be #201ED760');
  });
});

describe('Milestone 3 — F12: Android Auto Vector Drawables', () => {
  it('ic_car_repeat_one.xml contains Spotify green fill and active indicator dot at M12,22', () => {
    assert.ok(existsRel('native/android/res/drawable/ic_car_repeat_one.xml'), 'ic_car_repeat_one.xml must exist');
    const xml = readRel('native/android/res/drawable/ic_car_repeat_one.xml');
    assert.ok(xml.includes('#FF1ED760') || xml.includes('#1ED760'), 'Repeat one must use Spotify green');
    assert.match(xml, /pathData=["'][^"']*M12,22[^"']*["']/, 'Repeat one must contain active indicator dot at M12,22');
    assert.ok(xml.includes('M13,15') || xml.includes('13,9'), 'Repeat one must contain numeral 1 glyph');
  });

  it('ic_car_repeat_on.xml contains active indicator dot and green fill', () => {
    assert.ok(existsRel('native/android/res/drawable/ic_car_repeat_on.xml'), 'ic_car_repeat_on.xml must exist');
    const xml = readRel('native/android/res/drawable/ic_car_repeat_on.xml');
    assert.ok(xml.includes('#FF1ED760') || xml.includes('#1ED760'), 'Repeat all must use Spotify green');
    assert.match(xml, /pathData=["'][^"']*M12,22[^"']*["']/, 'Repeat all must contain active indicator dot at M12,22');
  });

  it('ic_car_shuffle_on.xml contains active Spotify green fill', () => {
    assert.ok(existsRel('native/android/res/drawable/ic_car_shuffle_on.xml'), 'ic_car_shuffle_on.xml must exist');
    const xml = readRel('native/android/res/drawable/ic_car_shuffle_on.xml');
    assert.ok(xml.includes('#FF1ED760') || xml.includes('#1ED760'), 'Shuffle active must use Spotify green');
  });

  it('ic_car_star.xml and ic_car_star_filled.xml exist with correct vector paths and colors', () => {
    assert.ok(existsRel('native/android/res/drawable/ic_car_star.xml'), 'ic_car_star.xml must exist');
    assert.ok(existsRel('native/android/res/drawable/ic_car_star_filled.xml'), 'ic_car_star_filled.xml must exist');

    const emptyXml = readRel('native/android/res/drawable/ic_car_star.xml');
    const filledXml = readRel('native/android/res/drawable/ic_car_star_filled.xml');

    assert.ok(emptyXml.includes('#FFFFFFFF') || emptyXml.includes('#FFFFFF'), 'Star outline must use white');
    assert.ok(filledXml.includes('#FF1ED760') || filledXml.includes('#1ED760'), 'Star filled must use Spotify green');
    assert.match(filledXml, /12,17\.27|12,2|18\.18,21/, 'Star filled must contain valid 5-point star geometry');
  });
});

describe('Milestone 3 — F12: SpotifreeMediaService Custom Actions & State Mode Sync', () => {
  it('SpotifreeMediaService.java manages state-aware custom action IDs, icons, and modes', () => {
    const svc = readRel('native/android/SpotifreeMediaService.java');

    // Custom action constants
    assert.ok(svc.includes('ACT_LIKE = "toggleLike"'));
    assert.ok(svc.includes('ACT_SHUFFLE = "toggleShuffle"'));
    assert.ok(svc.includes('ACT_REPEAT = "cycleRepeat"'));
    assert.ok(svc.includes('ACT_DISLIKE = "dislike"'));

    // State-aware action tags
    assert.ok(svc.includes('ACT_LIKE + (liked ? ":on" : ":off")'));
    assert.ok(svc.includes('ACT_SHUFFLE + (shuffle ? ":on" : ":off")'));
    assert.ok(svc.includes('ACT_REPEAT + ":" + repeat'));

    // Action drawables mapping
    assert.ok(svc.includes('shuffle ? R.drawable.ic_car_shuffle_on : R.drawable.ic_car_shuffle'));
    assert.ok(svc.includes('"one".equals(repeat) ? R.drawable.ic_car_repeat_one : "all".equals(repeat) ? R.drawable.ic_car_repeat_on : R.drawable.ic_car_repeat'));

    // MediaSession mode syncing
    assert.ok(svc.includes('session.setShuffleMode(shuffle ? PlaybackStateCompat.SHUFFLE_MODE_ALL : PlaybackStateCompat.SHUFFLE_MODE_NONE)'));
    assert.ok(svc.includes('session.setRepeatMode("one".equals(repeat) ? PlaybackStateCompat.REPEAT_MODE_ONE'));

    // onCustomAction handles prefix stripping
    assert.ok(svc.includes('action.substring(0, cut)'));
  });
});

describe('Milestone 3 — F13: Lyric Synchronization Service Unit Tests', async () => {
  const {
    getSynchronizedLyricProgress,
    getLyricSyncOffsetMs,
    setLyricSyncOffsetMs,
    DEFAULT_LYRIC_SYNC_OFFSET_MS,
    LYRIC_SYNC_OFFSET_KEY,
  } = await import('../src/utils/lyricsService.ts');

  beforeEach(() => {
    globalThis.localStorage.clear();
  });

  it('exports contract constants correctly', () => {
    assert.equal(DEFAULT_LYRIC_SYNC_OFFSET_MS, 850);
    assert.equal(LYRIC_SYNC_OFFSET_KEY, 'spotifree_lyric_sync_offset');
  });

  it('returns default 850ms offset when storage is unpopulated', () => {
    assert.equal(getLyricSyncOffsetMs(), 850);
    assert.equal(getSynchronizedLyricProgress(0), 850);
    assert.equal(getSynchronizedLyricProgress(10000), 10850);
  });

  it('clamps non-negative progress correctly for 0 and negative inputs', () => {
    assert.equal(getSynchronizedLyricProgress(0), 850);
    assert.equal(getSynchronizedLyricProgress(-350), 500);
    assert.equal(getSynchronizedLyricProgress(-850), 0);
    assert.equal(getSynchronizedLyricProgress(-1500), 0);
  });

  it('supports custom offset get and set via localStorage', () => {
    setLyricSyncOffsetMs(1200);
    assert.equal(globalThis.localStorage.getItem(LYRIC_SYNC_OFFSET_KEY), '1200');
    assert.equal(getLyricSyncOffsetMs(), 1200);
    assert.equal(getSynchronizedLyricProgress(1000), 2200);

    setLyricSyncOffsetMs(0);
    assert.equal(getLyricSyncOffsetMs(), 0);
    assert.equal(getSynchronizedLyricProgress(1000), 1000);
  });

  it('falls back safely to default 850ms on corrupted or NaN storage values', () => {
    globalThis.localStorage.setItem(LYRIC_SYNC_OFFSET_KEY, 'invalid_number');
    assert.equal(getLyricSyncOffsetMs(), 850);
    globalThis.localStorage.setItem(LYRIC_SYNC_OFFSET_KEY, '');
    assert.equal(getLyricSyncOffsetMs(), 850);
  });
});

describe('Milestone 3 — F13: Cross-Platform Lyric Synchronization Integration', () => {
  it('nativeMedia.ts uses getSynchronizedLyricProgress in currentLyricLine', () => {
    const src = readRel('src/services/nativeMedia.ts');
    assert.ok(src.includes('getSynchronizedLyricProgress'), 'nativeMedia.ts must import and call getSynchronizedLyricProgress');
    assert.ok(!src.includes('progressMs + 250'), 'nativeMedia.ts must eliminate hardcoded + 250 offset');
  });

  it('DesktopRightSidebar.tsx uses getSynchronizedLyricProgress', () => {
    const src = readRel('src/components/desktop/DesktopRightSidebar.tsx');
    assert.ok(src.includes('getSynchronizedLyricProgress'), 'DesktopRightSidebar.tsx must use getSynchronizedLyricProgress');
    assert.ok(!src.includes('progressMs + 150'), 'Must eliminate + 150');
    assert.ok(!src.includes('progressMs + 220'), 'Must eliminate + 220');
  });

  it('MobileNowPlayingModal.tsx and LyricsFullscreen.tsx use getSynchronizedLyricProgress', () => {
    const mobileSrc = readRel('src/components/mobile/MobileNowPlayingModal.tsx');
    const fullscreenSrc = readRel('src/components/mobile/LyricsFullscreen.tsx');

    assert.ok(mobileSrc.includes('getSynchronizedLyricProgress'), 'MobileNowPlayingModal.tsx must use getSynchronizedLyricProgress');
    assert.ok(!mobileSrc.includes('progressMs + 220'), 'MobileNowPlayingModal.tsx must eliminate + 220');

    assert.ok(fullscreenSrc.includes('getSynchronizedLyricProgress'), 'LyricsFullscreen.tsx must use getSynchronizedLyricProgress');
    assert.ok(!fullscreenSrc.includes('p.progressMs + 220'), 'LyricsFullscreen.tsx must eliminate + 220');
  });
});
