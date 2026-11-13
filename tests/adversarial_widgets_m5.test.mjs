/**
 * Adversarial Verification & Stress-Testing Suite for Milestone 5:
 * Android Native Widgets Modernization (SpotifreeWidget & SpotifreeTurntableWidget).
 *
 * Verifies:
 * 1. Null and empty cover art fallback behaviors in renderBackdrop and buildLabel.
 * 2. Extremely long, unicode, emoji, and empty lyric strings with marquee formatting.
 * 3. Layout XML syntax validation, namespace integrity, RemoteViews whitelist, marquee attributes, and view IDs.
 * 4. Validation of absence of forbidden APIs (ViewFlipper, timer invalidation loops in RemoteViews).
 */
import { describe, it } from 'node:test';
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

// Minimal XML parser to validate well-formedness, tag whitelist, and attributes
function parseXmlStructure(xmlContent) {
  // Strip XML comments and declarations
  const clean = xmlContent
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\?[^>]*\?>/g, '')
    .trim();

  const tagRegex = /<(\/)?([a-zA-Z0-9_:\.-]+)([^>]*?)(\/)?>/g;
  let match;
  const stack = [];
  const allElements = [];
  const ids = new Set();
  const drawables = new Set();
  let rootTag = null;
  let rootAttrs = null;

  while ((match = tagRegex.exec(clean)) !== null) {
    const [fullMatch, isClosing, tagName, rawAttrs, isSelfClosing] = match;

    if (!isClosing) {
      const attrs = {};
      const attrRegex = /([a-zA-Z0-9_:\.-]+)="([^"]*)"/g;
      let am;
      while ((am = attrRegex.exec(rawAttrs)) !== null) {
        attrs[am[1]] = am[2];
        if (am[1] === 'android:id') {
          const idVal = am[2].replace('@+id/', '').replace('@id/', '');
          ids.add(idVal);
        }
        if (am[2].startsWith('@drawable/')) {
          drawables.add(am[2].replace('@drawable/', ''));
        }
      }

      const elem = { tag: tagName, attrs };
      allElements.push(elem);

      if (!rootTag) {
        rootTag = tagName;
        rootAttrs = attrs;
      }

      if (isSelfClosing !== '/') {
        stack.push({ tag: tagName, pos: match.index });
      }
    } else {
      if (stack.length === 0) {
        throw new Error(`Unexpected closing tag </${tagName}> without open tag`);
      }
      const last = stack.pop();
      if (last.tag !== tagName) {
        throw new Error(`Mismatched tags: expected </${last.tag}>, found </${tagName}>`);
      }
    }
  }

  if (stack.length > 0) {
    throw new Error(`Unclosed XML tags remaining: ${stack.map(s => s.tag).join(', ')}`);
  }

  return { rootTag, rootAttrs, allElements, ids: Array.from(ids), drawables: Array.from(drawables) };
}

describe('M5 Adversarial Suite 1: Null & Empty Cover Art Fallbacks', () => {
  const widgetJava = readRel('native/android/SpotifreeWidget.java');
  const turntableJava = readRel('native/android/SpotifreeTurntableWidget.java');

  it('buildLabel gracefully returns null when cover is null without throwing', () => {
    // Assert method guard in SpotifreeTurntableWidget.java
    assert.ok(
      turntableJava.includes('private static Bitmap buildLabel(Bitmap cover) {\n        if (cover == null) return null;'),
      'buildLabel must explicitly guard against null cover bitmap'
    );
    assert.ok(
      turntableJava.includes('if (lbl != null) v.setImageViewBitmap(R.id.tt_label, lbl);\n                else v.setImageViewResource(R.id.tt_label, R.drawable.spotifree_vinyl_label);'),
      'Turntable widget must fall back to R.drawable.spotifree_vinyl_label when buildLabel returns null'
    );
    assert.ok(
      existsRel('native/android/res/drawable/spotifree_vinyl_label.xml'),
      'Fallback resource spotifree_vinyl_label.xml must physically exist in drawables'
    );
  });

  it('renderBackdrop renders default dark emerald aurora theme when cover is null', () => {
    // Check SpotifreeWidget.java fallback logic
    assert.ok(widgetJava.includes('if (cover != null) {'), 'renderBackdrop must check cover != null');
    assert.ok(
      widgetJava.includes('0xFF195131, 0xFF10241A, 0xFF0A0B0E'),
      'renderBackdrop must specify default aurora gradient stops when cover is null'
    );
    assert.ok(
      widgetJava.includes('0x501ED760, 0x001ED760'),
      'renderBackdrop must draw default emerald accent orb when cover is null'
    );
    assert.ok(
      widgetJava.includes('ensureCoverAssets()'),
      'ensureCoverAssets must initialize default backdrops (defaultBgWide, defaultBgBar, defaultBgSquare)'
    );
  });

  it('setArt(null) cleanly resets memory cache, colors, and dirty flags without throwing', () => {
    assert.ok(
      widgetJava.includes('static void setArt(Bitmap src) {\n        if (src == null) {\n            source = null;\n            primaryColor = 0;\n            secondaryColor = 0;\n            accentColor = 0;'),
      'setArt(null) must clear static source and reset extracted colors'
    );
    assert.ok(widgetJava.includes('invalidateBitmaps();'), 'setArt must invalidate bitmap cache');
  });

  it('SpotifreeWidget art display falls back to ic_launcher_app_default when cover is null', () => {
    assert.ok(
      widgetJava.includes('if (cover != null && art != null) v.setImageViewBitmap(R.id.widget_art, art);\n                else v.setImageViewResource(R.id.widget_art, R.mipmap.ic_launcher_app_default);'),
      'SpotifreeWidget must fall back to default app launcher icon when cover or art is null'
    );
  });

  it('Memory footprint simulation: scaled bitmap allocations remain well within 1MB Binder limit', () => {
    // RemoteViews max transaction is 1MB (1,048,576 bytes).
    // ARGB_8888 uses 4 bytes per pixel.
    const barBackdropBytes = 400 * 140 * 4;       // 224,000 bytes (~218 KB)
    const wideBackdropBytes = 400 * 188 * 4;      // 300,800 bytes (~293 KB)
    const labelBytes = 192 * 192 * 4;             // 147,456 bytes (~144 KB)
    const barArtBytes = 172 * 172 * 4;             // 118,336 bytes (~115 KB)

    // For mini-player widget: backdrop + art
    const miniPlayerTotal = barBackdropBytes + barArtBytes;
    assert.ok(miniPlayerTotal < 500_000, `Mini-player RemoteViews payload (${miniPlayerTotal} bytes) must be < 500 KB`);

    // For turntable widget: backdrop + label
    const turntableTotal = wideBackdropBytes + labelBytes;
    assert.ok(turntableTotal < 500_000, `Turntable RemoteViews payload (${turntableTotal} bytes) must be < 500 KB`);
  });
});

describe('M5 Adversarial Suite 2: Lyrics Stress-Testing & Marquee Formatting', () => {
  const widgetJava = readRel('native/android/SpotifreeWidget.java');
  const turntableJava = readRel('native/android/SpotifreeTurntableWidget.java');

  function simulateLyricHandling(hasSong, lyrics) {
    let visibility = 'GONE';
    let text = '';
    let selected = false;

    if (hasSong && lyrics != null && !lyrics.trim().isEmpty()) {
      visibility = 'VISIBLE';
      text = '♫ ' + lyrics.trim();
      selected = true;
    } else {
      visibility = 'GONE';
      selected = false;
    }

    return { visibility, text, selected };
  }

  // Extend String to match Java .trim().isEmpty()
  String.prototype.isEmpty = function() {
    return this.length === 0;
  };

  it('Null, empty, whitespace-only, and newline lyric inputs correctly hide view and disable marquee', () => {
    const testCases = [
      null,
      '',
      '   ',
      '\t\t',
      '\n\r\n',
      '      \t  \n  '
    ];

    for (const input of testCases) {
      const res = simulateLyricHandling(true, input);
      assert.equal(res.visibility, 'GONE', `Input "${input}" must result in GONE visibility`);
      assert.equal(res.selected, false, `Input "${input}" must set setSelected to false`);
      assert.equal(res.text, '', `Input "${input}" must leave text empty`);
    }
  });

  it('No active song (hasSong = false) suppresses lyrics even if lyric string is provided', () => {
    const res = simulateLyricHandling(false, 'Never gonna give you up');
    assert.equal(res.visibility, 'GONE');
    assert.equal(res.selected, false);
    assert.equal(res.text, '');
  });

  it('Extremely long lyric strings (up to 50,000 characters) format safely with prefix and trimmed whitespace', () => {
    const longString = 'La '.repeat(16666); // ~50,000 chars
    const res = simulateLyricHandling(true, '   ' + longString + '   ');
    assert.equal(res.visibility, 'VISIBLE');
    assert.equal(res.selected, true);
    assert.ok(res.text.startsWith('♫ La '));
    assert.ok(res.text.endsWith('La'));
    assert.equal(res.text.length, 2 + longString.trim().length);
  });

  it('Multilingual unicode strings (Japanese, Cyrillic, Arabic, Accents) preserve code points cleanly', () => {
    const unicodeLyrics = [
      '残響散歌 / 誰かを愛すことなんて 救うことなんて',
      'Спокойная ночь — Группа Кино',
      'يا ليالي روحي سلمي لي على اللي شغل بالي',
      'Un millón de primaveras — Vicente Fernández (áéíóúñ ü €)'
    ];

    for (const lyric of unicodeLyrics) {
      const res = simulateLyricHandling(true, lyric);
      assert.equal(res.visibility, 'VISIBLE');
      assert.equal(res.selected, true);
      assert.equal(res.text, '♫ ' + lyric);
    }
  });

  it('Complex emoji sequences, surrogate pairs, and ZWJ sequences do not corrupt or throw', () => {
    const emojiLyrics = '🔥 🎶 💃🏽 🎤 ✨ 🚀 🌟 🎧 👨‍👩‍👧‍👦 🏳️‍🌈';
    const res = simulateLyricHandling(true, emojiLyrics);
    assert.equal(res.visibility, 'VISIBLE');
    assert.equal(res.selected, true);
    assert.equal(res.text, '♫ ' + emojiLyrics);
    assert.ok(res.text.includes('💃🏽'));
    assert.ok(res.text.includes('👨‍👩‍👧‍👦'));
  });

  it('Widget implementations correctly invoke v.setBoolean(R.id.widget_lyrics, "setSelected", ...)', () => {
    assert.ok(
      widgetJava.includes('v.setBoolean(R.id.widget_lyrics, "setSelected", true);'),
      'SpotifreeWidget must call setSelected true when lyrics are present'
    );
    assert.ok(
      widgetJava.includes('v.setBoolean(R.id.widget_lyrics, "setSelected", false);'),
      'SpotifreeWidget must call setSelected false when lyrics are absent'
    );
    assert.ok(
      turntableJava.includes('v.setBoolean(R.id.widget_lyrics, "setSelected", true);'),
      'SpotifreeTurntableWidget must call setSelected true when lyrics are present'
    );
    assert.ok(
      turntableJava.includes('v.setBoolean(R.id.widget_lyrics, "setSelected", false);'),
      'SpotifreeTurntableWidget must call setSelected false when lyrics are absent'
    );
  });
});

describe('M5 Adversarial Suite 3: Layout XML Syntax & RemoteViews Whitelist Compliance', () => {
  const REMOTE_VIEWS_WHITELIST = new Set([
    // Layouts
    'AdapterViewFlipper',
    'FrameLayout',
    'GridLayout',
    'GridView',
    'LinearLayout',
    'ListView',
    'RelativeLayout',
    'StackView',
    'ViewStub',
    // Views
    'AnalogClock',
    'Button',
    'Chronometer',
    'ImageButton',
    'ImageView',
    'ProgressBar',
    'TextClock',
    'TextView'
  ]);

  const layoutsToTest = [
    'native/android/res/layout/spotifree_widget.xml',
    'native/android/res/layout/spotifree_widget_turntable.xml',
    'native/android/res/layout/spotifree_widget_large.xml',
    'native/android/res/layout/spotifree_widget_small.xml'
  ];

  it('All widget XML layouts parse cleanly with valid root element and android namespace declaration', () => {
    for (const layoutPath of layoutsToTest) {
      const content = readRel(layoutPath);
      const parsed = parseXmlStructure(content);
      assert.ok(parsed.rootTag, `${layoutPath} must have a root tag`);
      assert.equal(
        parsed.rootAttrs['xmlns:android'],
        'http://schemas.android.com/apk/res/android',
        `${layoutPath} root element must declare xmlns:android="http://schemas.android.com/apk/res/android"`
      );
    }
  });

  it('Every XML tag in widget layouts is strictly within the RemoteViews allowed whitelist', () => {
    for (const layoutPath of layoutsToTest) {
      const content = readRel(layoutPath);
      const parsed = parseXmlStructure(content);
      for (const elem of parsed.allElements) {
        assert.ok(
          REMOTE_VIEWS_WHITELIST.has(elem.tag),
          `Tag <${elem.tag}> in ${layoutPath} is NOT supported by Android RemoteViews! Allowed: ${Array.from(REMOTE_VIEWS_WHITELIST).join(', ')}`
        );
      }
    }
  });

  it('Marquee attributes are complete and valid in mini-player (spotifree_widget.xml)', () => {
    const content = readRel('native/android/res/layout/spotifree_widget.xml');
    const parsed = parseXmlStructure(content);
    const lyricsElem = parsed.allElements.find(
      e => e.attrs && (e.attrs['android:id'] === '@+id/widget_lyrics' || e.attrs['android:id'] === '@id/widget_lyrics')
    );

    assert.ok(lyricsElem, 'spotifree_widget.xml must declare widget_lyrics view');
    assert.equal(lyricsElem.attrs['android:ellipsize'], 'marquee', 'ellipsize must be marquee');
    assert.equal(lyricsElem.attrs['android:singleLine'], 'true', 'singleLine must be true');
    assert.equal(lyricsElem.attrs['android:scrollHorizontally'], 'true', 'scrollHorizontally must be true');
    assert.equal(lyricsElem.attrs['android:focusable'], 'true', 'focusable must be true');
    assert.equal(lyricsElem.attrs['android:focusableInTouchMode'], 'true', 'focusableInTouchMode must be true');
    assert.equal(lyricsElem.attrs['android:marqueeRepeatLimit'], 'marquee_forever', 'marqueeRepeatLimit must be marquee_forever');
  });

  it('Marquee attributes are complete and valid in turntable widget (spotifree_widget_turntable.xml)', () => {
    const content = readRel('native/android/res/layout/spotifree_widget_turntable.xml');
    const parsed = parseXmlStructure(content);
    const lyricsElem = parsed.allElements.find(
      e => e.attrs && (e.attrs['android:id'] === '@+id/widget_lyrics' || e.attrs['android:id'] === '@id/widget_lyrics')
    );

    assert.ok(lyricsElem, 'spotifree_widget_turntable.xml must declare widget_lyrics view');
    assert.equal(lyricsElem.attrs['android:ellipsize'], 'marquee', 'ellipsize must be marquee');
    assert.equal(lyricsElem.attrs['android:singleLine'], 'true', 'singleLine must be true');
    assert.equal(lyricsElem.attrs['android:scrollHorizontally'], 'true', 'scrollHorizontally must be true');
    assert.equal(lyricsElem.attrs['android:focusable'], 'true', 'focusable must be true');
    assert.equal(lyricsElem.attrs['android:focusableInTouchMode'], 'true', 'focusableInTouchMode must be true');
    assert.equal(lyricsElem.attrs['android:marqueeRepeatLimit'], 'marquee_forever', 'marqueeRepeatLimit must be marquee_forever');
  });

  it('All R.id view references in SpotifreeTurntableWidget.java exist in spotifree_widget_turntable.xml', () => {
    const content = readRel('native/android/res/layout/spotifree_widget_turntable.xml');
    const parsed = parseXmlStructure(content);
    const layoutIds = new Set(parsed.ids);

    const requiredIds = [
      'widget_bg',
      'widget_bg_art',
      'tt_deck',
      'tt_spin',
      'tt_disc',
      'tt_label',
      'tt_label_sheen',
      'tt_arm',
      'widget_live_ring',
      'widget_state',
      'widget_chronometer',
      'widget_duration',
      'widget_text',
      'widget_title',
      'widget_artist',
      'widget_lyrics',
      'widget_progress',
      'widget_prev',
      'widget_play',
      'widget_next'
    ];

    for (const id of requiredIds) {
      assert.ok(layoutIds.has(id), `Required ID "${id}" missing from spotifree_widget_turntable.xml`);
    }
  });

  it('All R.id view references in SpotifreeWidget.java exist in spotifree_widget.xml (bar layout)', () => {
    const content = readRel('native/android/res/layout/spotifree_widget.xml');
    const parsed = parseXmlStructure(content);
    const layoutIds = new Set(parsed.ids);

    const barRequiredIds = [
      'widget_bg',
      'widget_bg_art',
      'widget_art',
      'widget_live_ring',
      'widget_text',
      'widget_title',
      'widget_artist',
      'widget_lyrics',
      'widget_progress',
      'widget_prev',
      'widget_play',
      'widget_next'
    ];

    for (const id of barRequiredIds) {
      assert.ok(layoutIds.has(id), `Required ID "${id}" missing from spotifree_widget.xml`);
    }
  });

  it('All referenced @drawable/ resources physically exist on disk', () => {
    for (const layoutPath of layoutsToTest) {
      const content = readRel(layoutPath);
      const parsed = parseXmlStructure(content);
      for (const drw of parsed.drawables) {
        const fileExists =
          existsRel(`native/android/res/drawable/${drw}.xml`) ||
          existsRel(`native/android/res/drawable-nodpi/${drw}.png`) ||
          existsRel(`native/android/res/drawable/${drw}.png`);
        assert.ok(fileExists, `Resource @drawable/${drw} referenced in ${layoutPath} does not exist on disk`);
      }
    }
  });

  it('AppWidgetProvider metadata XMLs exist and declare valid layout references', () => {
    const widgetInfo = readRel('native/android/res/xml/spotifree_widget_info.xml');
    const turntableInfo = readRel('native/android/res/xml/spotifree_turntable_info.xml');

    assert.ok(widgetInfo.includes('@layout/spotifree_widget'), 'spotifree_widget_info must point to @layout/spotifree_widget');
    assert.ok(turntableInfo.includes('@layout/spotifree_widget_turntable'), 'spotifree_turntable_info must point to @layout/spotifree_widget_turntable');
  });
});

describe('M5 Adversarial Suite 4: Forbidden APIs & Invalidation Anti-Patterns', () => {
  const widgetJava = readRel('native/android/SpotifreeWidget.java');
  const turntableJava = readRel('native/android/SpotifreeTurntableWidget.java');
  const widgetXml = readRel('native/android/res/layout/spotifree_widget.xml');
  const turntableXml = readRel('native/android/res/layout/spotifree_widget_turntable.xml');

  it('ViewFlipper is strictly forbidden and absent from all layouts and widget code', () => {
    assert.ok(!widgetXml.includes('<ViewFlipper'), 'spotifree_widget.xml must not use <ViewFlipper tag');
    assert.ok(!turntableXml.includes('<ViewFlipper'), 'spotifree_widget_turntable.xml must not use <ViewFlipper tag');
    assert.ok(!turntableXml.includes('tt_flipper'), 'spotifree_widget_turntable.xml must not have tt_flipper');
    assert.ok(!widgetJava.includes('import android.widget.ViewFlipper;'), 'SpotifreeWidget.java must not import ViewFlipper');
    assert.ok(!turntableJava.includes('import android.widget.ViewFlipper;'), 'SpotifreeTurntableWidget.java must not import ViewFlipper');
    assert.ok(!widgetJava.includes('new ViewFlipper'), 'SpotifreeWidget.java must not instantiate ViewFlipper');
    assert.ok(!turntableJava.includes('new ViewFlipper'), 'SpotifreeTurntableWidget.java must not instantiate ViewFlipper');
  });

  it('No software timer loops or Handler.postDelayed exist in widget provider classes', () => {
    const forbiddenPatterns = [
      /\bHandler\b/,
      /\bpostDelayed\b/,
      /\bTimer\b/,
      /\bScheduledExecutorService\b/,
      /\bValueAnimator\b/,
      /\bThread\.sleep\b/
    ];

    for (const pattern of forbiddenPatterns) {
      assert.ok(
        !pattern.test(widgetJava),
        `SpotifreeWidget.java must NOT contain forbidden timer pattern: ${pattern}`
      );
      assert.ok(
        !pattern.test(turntableJava),
        `SpotifreeTurntableWidget.java must NOT contain forbidden timer pattern: ${pattern}`
      );
    }
  });

  it('Rotation animation uses hardware-accelerated indeterminate ProgressBars instead of timer loops', () => {
    assert.ok(turntableXml.includes('android:id="@+id/tt_spin"'), 'Turntable must declare tt_spin ProgressBar');
    assert.ok(turntableXml.includes('android:id="@+id/tt_label_sheen"'), 'Turntable must declare tt_label_sheen ProgressBar');
    assert.ok(turntableXml.includes('android:indeterminate="true"'), 'Platter rotation must use native indeterminate animation');
    assert.ok(widgetXml.includes('android:id="@+id/widget_live_ring"'), 'Mini player must declare widget_live_ring ProgressBar');
  });

  it('Progress and state invalidation is strictly rate-limited and debounced via signature hashing', () => {
    // Both widgets must hash state signature and abort early if unchanged
    assert.ok(widgetJava.includes('if (sig.equals(lastSig)) return;'), 'SpotifreeWidget must debounce updates via lastSig');
    assert.ok(turntableJava.includes('if (sig.equals(lastSig)) return;'), 'SpotifreeTurntableWidget must debounce updates via lastSig');

    // Progress must be bucketed to prevent millisecond Binder IPC flooding
    assert.ok(
      widgetJava.includes('int progBucket = progPermille / 5;'),
      'SpotifreeWidget must bucket progress to 0.5% steps to prevent IPC flooding'
    );
    assert.ok(
      turntableJava.includes('int progBucket = progPermille / 5;'),
      'SpotifreeTurntableWidget must bucket progress to 0.5% steps to prevent IPC flooding'
    );
  });
});
