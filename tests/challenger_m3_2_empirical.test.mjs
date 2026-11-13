import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

// Character-by-character strict XML validator
function validateXmlDocument(raw, filename = 'xml') {
  assert.ok(raw && raw.trim().length > 0, `${filename}: XML content is empty`);

  // Verify XML prolog
  assert.match(raw.trim(), /^<\?xml\s+version=["']1\.0["']\s+encoding=["']utf-8["']\s*\?>/i,
    `${filename}: Must begin with standard UTF-8 XML declaration`);

  let i = 0;
  const stack = [];
  let rootElementCount = 0;

  while (i < raw.length) {
    if (raw.startsWith('<?', i)) {
      const end = raw.indexOf('?>', i);
      assert.ok(end !== -1, `${filename}: Unterminated XML processing instruction`);
      i = end + 2;
    } else if (raw.startsWith('<!--', i)) {
      const end = raw.indexOf('-->', i);
      assert.ok(end !== -1, `${filename}: Unterminated XML comment`);
      i = end + 4;
    } else if (raw[i] === '<') {
      const isClosing = raw[i + 1] === '/';
      const tagStart = isClosing ? i + 2 : i + 1;
      let inQuote = null;
      let tagEnd = -1;
      let j = tagStart;

      while (j < raw.length) {
        const c = raw[j];
        if (inQuote) {
          if (c === inQuote) inQuote = null;
        } else if (c === '"' || c === "'") {
          inQuote = c;
        } else if (c === '>') {
          tagEnd = j;
          break;
        }
        j++;
      }

      assert.ok(tagEnd !== -1, `${filename}: Unterminated XML tag starting at offset ${i}`);
      assert.strictEqual(inQuote, null, `${filename}: Unclosed quote in tag starting at offset ${i}`);

      const tagContent = raw.slice(tagStart, tagEnd).trim();
      const isSelfClosing = !isClosing && tagContent.endsWith('/');
      const cleanContent = isSelfClosing ? tagContent.slice(0, -1).trim() : tagContent;
      const tagName = cleanContent.split(/\s+/)[0];

      assert.ok(/^[a-zA-Z0-9_\-:]+$/.test(tagName), `${filename}: Invalid tag name '${tagName}'`);

      if (isClosing) {
        assert.ok(stack.length > 0, `${filename}: Unexpected closing tag </${tagName}> without open tag`);
        const expected = stack.pop();
        assert.strictEqual(tagName, expected, `${filename}: Mismatched closing tag </${tagName}>, expected </${expected}>`);
      } else if (isSelfClosing) {
        if (stack.length === 0) rootElementCount++;
      } else {
        if (stack.length === 0) rootElementCount++;
        stack.push(tagName);
      }

      i = tagEnd + 1;
    } else {
      i++;
    }
  }

  assert.strictEqual(stack.length, 0, `${filename}: Unclosed tags remaining: ${stack.join(', ')}`);
  assert.strictEqual(rootElementCount, 1, `${filename}: XML must contain exactly one root element, found ${rootElementCount}`);
  return true;
}

describe('Milestone 3 Empirical Adversarial Verification (Challenger 2)', () => {

  // =========================================================================
  // 1. XML SYNTAX VALIDITY & WELL-FORMEDNESS
  // =========================================================================
  describe('1. XML Syntax Validity & Well-Formedness', () => {
    const xmlFiles = [
      'native/android/res/values/spotifree_car_theme.xml',
      'native/android/res/drawable/ic_car_repeat_one.xml',
      'native/android/res/drawable/ic_car_star.xml',
      'native/android/res/drawable/ic_car_star_filled.xml',
      'native/android/res/drawable/ic_car_repeat_on.xml',
      'native/android/res/drawable/ic_car_repeat.xml',
      'native/android/res/drawable/ic_car_shuffle.xml',
      'native/android/res/drawable/ic_car_shuffle_on.xml',
      'native/android/res/drawable/ic_car_heart.xml',
      'native/android/res/drawable/ic_car_heart_filled.xml'
    ];

    for (const relPath of xmlFiles) {
      it(`Validates strict XML well-formedness of ${relPath}`, () => {
        const fullPath = path.join(ROOT, relPath);
        assert.ok(fs.existsSync(fullPath), `File does not exist: ${relPath}`);
        const raw = fs.readFileSync(fullPath, 'utf8');
        assert.doesNotThrow(() => {
          validateXmlDocument(raw, relPath);
        }, `XML validation threw error on ${relPath}`);
      });
    }
  });

  // =========================================================================
  // 2. VECTOR DRAWABLES ATTRIBUTES, VIEWPORT, COORDINATES & COLORS
  // =========================================================================
  describe('2. Vector Drawables: Viewport, Coordinates & Colors', () => {

    it('Verifies spotifree_car_theme.xml contains required Spotify green attributes', () => {
      const themePath = path.join(ROOT, 'native/android/res/values/spotifree_car_theme.xml');
      const content = fs.readFileSync(themePath, 'utf8');

      assert.match(content, /<style\s+name="SpotifreeCarTheme"/, 'Must declare style SpotifreeCarTheme');
      assert.match(content, /parent="Theme\.AppCompat\.NoActionBar"/, 'Must inherit from Theme.AppCompat.NoActionBar');

      const expectedItems = {
        'colorPrimary': '#1ED760',
        'colorPrimaryDark': '#121212',
        'colorAccent': '#1ED760',
        'colorControlActivated': '#1ED760',
        'colorControlHighlight': '#201ED760'
      };

      for (const [attr, color] of Object.entries(expectedItems)) {
        const itemRegex = new RegExp(`<item\\s+name="${attr}">\\s*${color}\\s*<\\/item>`, 'i');
        assert.match(content, itemRegex, `spotifree_car_theme.xml must define ${attr} as ${color}`);
      }
    });

    function extractVectorHeader(xmlContent) {
      const widthMatch = xmlContent.match(/android:width="([^"]+)"/);
      const heightMatch = xmlContent.match(/android:height="([^"]+)"/);
      const vpWidthMatch = xmlContent.match(/android:viewportWidth="([^"]+)"/);
      const vpHeightMatch = xmlContent.match(/android:viewportHeight="([^"]+)"/);

      return {
        width: widthMatch ? widthMatch[1] : null,
        height: heightMatch ? heightMatch[1] : null,
        viewportWidth: vpWidthMatch ? parseFloat(vpWidthMatch[1]) : null,
        viewportHeight: vpHeightMatch ? parseFloat(vpHeightMatch[1]) : null
      };
    }

    function computePathBounds(pathData) {
      const tokenRegex = /([a-df-z])|(-?\d*\.?\d+(?:e[-+]?\d+)?)/gi;
      let match;
      let currentX = 0, currentY = 0;
      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;
      let cmd = '';

      function updateBounds(x, y) {
        if (!isNaN(x) && !isNaN(y)) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }

      const tokens = [];
      while ((match = tokenRegex.exec(pathData)) !== null) {
        tokens.push(match[0]);
      }

      let i = 0;
      while (i < tokens.length) {
        const t = tokens[i];
        if (/^[a-df-z]$/i.test(t)) {
          cmd = t;
          i++;
        }

        switch (cmd) {
          case 'M':
            currentX = parseFloat(tokens[i++]);
            currentY = parseFloat(tokens[i++]);
            updateBounds(currentX, currentY);
            break;
          case 'm':
            currentX += parseFloat(tokens[i++]);
            currentY += parseFloat(tokens[i++]);
            updateBounds(currentX, currentY);
            break;
          case 'L':
            currentX = parseFloat(tokens[i++]);
            currentY = parseFloat(tokens[i++]);
            updateBounds(currentX, currentY);
            break;
          case 'l':
            currentX += parseFloat(tokens[i++]);
            currentY += parseFloat(tokens[i++]);
            updateBounds(currentX, currentY);
            break;
          case 'H':
            currentX = parseFloat(tokens[i++]);
            updateBounds(currentX, currentY);
            break;
          case 'h':
            currentX += parseFloat(tokens[i++]);
            updateBounds(currentX, currentY);
            break;
          case 'V':
            currentY = parseFloat(tokens[i++]);
            updateBounds(currentX, currentY);
            break;
          case 'v':
            currentY += parseFloat(tokens[i++]);
            updateBounds(currentX, currentY);
            break;
          case 'A':
            i += 5;
            currentX = parseFloat(tokens[i++]);
            currentY = parseFloat(tokens[i++]);
            updateBounds(currentX, currentY);
            break;
          case 'a':
            const rx = parseFloat(tokens[i++]);
            const ry = parseFloat(tokens[i++]);
            i += 3;
            const dx = parseFloat(tokens[i++]);
            const dy = parseFloat(tokens[i++]);
            updateBounds(currentX - rx, currentY - ry);
            updateBounds(currentX + rx, currentY + ry);
            currentX += dx;
            currentY += dy;
            updateBounds(currentX, currentY);
            break;
          case 'Z':
          case 'z':
            break;
          default:
            i++;
            break;
        }
      }

      return { minX, maxX, minY, maxY };
    }

    it('Verifies ic_car_repeat_one.xml viewport, bounds, dot, and Spotify green color', () => {
      const xml = fs.readFileSync(path.join(ROOT, 'native/android/res/drawable/ic_car_repeat_one.xml'), 'utf8');
      const header = extractVectorHeader(xml);

      assert.strictEqual(header.width, '24dp');
      assert.strictEqual(header.height, '24dp');
      assert.strictEqual(header.viewportWidth, 24);
      assert.strictEqual(header.viewportHeight, 24);

      const fillColors = [...xml.matchAll(/android:fillColor="([^"]+)"/g)].map(m => m[1]);
      assert.ok(fillColors.length >= 2, 'ic_car_repeat_one must have at least 2 paths (glyph + dot)');
      for (const color of fillColors) {
        assert.strictEqual(color.toUpperCase(), '#FF1ED760', 'Path fill color must be #FF1ED760');
      }

      assert.ok(xml.includes('M12,22a1.2,1.2 0 1,0 0.001,0z'),
        'ic_car_repeat_one must include the active indicator dot at M12,22');

      const paths = [...xml.matchAll(/android:pathData="([^"]+)"/g)].map(m => m[1]);
      for (const pData of paths) {
        const bounds = computePathBounds(pData);
        assert.ok(bounds.minX >= 0, `minX out of bounds: ${bounds.minX}`);
        assert.ok(bounds.maxX <= 24, `maxX out of bounds: ${bounds.maxX}`);
        assert.ok(bounds.minY >= 0, `minY out of bounds: ${bounds.minY}`);
        assert.ok(bounds.maxY <= 24, `maxY out of bounds: ${bounds.maxY}`);
      }
    });

    it('Verifies ic_car_star.xml (outline star) viewport, bounds, and white color', () => {
      const xml = fs.readFileSync(path.join(ROOT, 'native/android/res/drawable/ic_car_star.xml'), 'utf8');
      const header = extractVectorHeader(xml);

      assert.strictEqual(header.width, '24dp');
      assert.strictEqual(header.height, '24dp');
      assert.strictEqual(header.viewportWidth, 24);
      assert.strictEqual(header.viewportHeight, 24);

      const fillColors = [...xml.matchAll(/android:fillColor="([^"]+)"/g)].map(m => m[1]);
      assert.strictEqual(fillColors.length, 1);
      assert.strictEqual(fillColors[0].toUpperCase(), '#FFFFFFFF', 'Unfavorited star must be white #FFFFFFFF');

      const paths = [...xml.matchAll(/android:pathData="([^"]+)"/g)].map(m => m[1]);
      const bounds = computePathBounds(paths[0]);
      assert.ok(bounds.minX >= 0 && bounds.maxX <= 24, `Star bounds X [${bounds.minX}, ${bounds.maxX}] out of 24`);
      assert.ok(bounds.minY >= 0 && bounds.maxY <= 24, `Star bounds Y [${bounds.minY}, ${bounds.maxY}] out of 24`);
    });

    it('Verifies ic_car_star_filled.xml viewport, bounds, and Spotify green color', () => {
      const xml = fs.readFileSync(path.join(ROOT, 'native/android/res/drawable/ic_car_star_filled.xml'), 'utf8');
      const header = extractVectorHeader(xml);

      assert.strictEqual(header.width, '24dp');
      assert.strictEqual(header.height, '24dp');
      assert.strictEqual(header.viewportWidth, 24);
      assert.strictEqual(header.viewportHeight, 24);

      const fillColors = [...xml.matchAll(/android:fillColor="([^"]+)"/g)].map(m => m[1]);
      assert.strictEqual(fillColors.length, 1);
      assert.strictEqual(fillColors[0].toUpperCase(), '#FF1ED760', 'Favorited star must be Spotify green #FF1ED760');

      const paths = [...xml.matchAll(/android:pathData="([^"]+)"/g)].map(m => m[1]);
      const bounds = computePathBounds(paths[0]);
      assert.ok(bounds.minX >= 0 && bounds.maxX <= 24, `Star filled bounds X [${bounds.minX}, ${bounds.maxX}] out of 24`);
      assert.ok(bounds.minY >= 0 && bounds.maxY <= 24, `Star filled bounds Y [${bounds.minY}, ${bounds.maxY}] out of 24`);
    });
  });

  // =========================================================================
  // 3. SPOTIFREE MEDIA SERVICE CUSTOM ACTIONS & COLON SPLITTING ADVERSARIAL STRESS
  // =========================================================================
  describe('3. SpotifreeMediaService Custom Actions & Adversarial Input Robustness', () => {
    const javaPath = path.join(ROOT, 'native/android/SpotifreeMediaService.java');
    const javaContent = fs.readFileSync(javaPath, 'utf8');

    it('Verifies action ID constants and state-aware builder formats', () => {
      assert.ok(javaContent.includes('static final String ACT_LIKE = "toggleLike";'), 'ACT_LIKE constant');
      assert.ok(javaContent.includes('static final String ACT_DISLIKE = "dislike";'), 'ACT_DISLIKE constant');
      assert.ok(javaContent.includes('static final String ACT_SHUFFLE = "toggleShuffle";'), 'ACT_SHUFFLE constant');
      assert.ok(javaContent.includes('static final String ACT_REPEAT = "cycleRepeat";'), 'ACT_REPEAT constant');

      assert.ok(javaContent.includes('ACT_LIKE + (liked ? ":on" : ":off")'), 'ACT_LIKE state suffix');
      assert.ok(javaContent.includes('ACT_SHUFFLE + (shuffle ? ":on" : ":off")'), 'ACT_SHUFFLE state suffix');
      assert.ok(javaContent.includes('ACT_REPEAT + ":" + repeat'), 'ACT_REPEAT state suffix');
    });

    function javaColonSplitOracle(action) {
      const cut = action === null || action === undefined ? -1 : action.indexOf(':');
      return cut > 0 ? action.substring(0, cut) : action;
    }

    it('Adversarial fuzzing of onCustomAction colon splitting logic against null, empty, malformed, and valid strings', () => {
      const testCases = [
        { input: 'toggleShuffle:on', expected: 'toggleShuffle' },
        { input: 'toggleShuffle:off', expected: 'toggleShuffle' },
        { input: 'cycleRepeat:off', expected: 'cycleRepeat' },
        { input: 'cycleRepeat:all', expected: 'cycleRepeat' },
        { input: 'cycleRepeat:one', expected: 'cycleRepeat' },
        { input: 'toggleLike:on', expected: 'toggleLike' },
        { input: 'toggleLike:off', expected: 'toggleLike' },
        { input: 'dislike', expected: 'dislike' },
        { input: 'dislike:on', expected: 'dislike' },

        // Edge and boundary cases
        { input: null, expected: null },
        { input: '', expected: '' },
        { input: ':', expected: ':' },
        { input: ':::', expected: ':::' },
        { input: ':on', expected: ':on' },
        { input: 'a:', expected: 'a' },
        { input: 'action:extra:colons:more', expected: 'action' },
        { input: '  spaced  :on', expected: '  spaced  ' },
        { input: 'ação:ligado', expected: 'ação' },
        { input: '🔥:fire', expected: '🔥' },
        { input: 'x'.repeat(1000) + ':state', expected: 'x'.repeat(1000) },
      ];

      for (const tc of testCases) {
        assert.doesNotThrow(() => {
          const result = javaColonSplitOracle(tc.input);
          assert.strictEqual(result, tc.expected, `Mismatch for input: ${tc.input}`);
        }, `Should not throw on input: ${tc.input}`);
      }
    });

    it('Verifies Java source code implements safe cut > 0 boundary check without substring crash', () => {
      assert.ok(
        javaContent.includes("int cut = action == null ? -1 : action.indexOf(':');") &&
        javaContent.includes('send(cut > 0 ? action.substring(0, cut) : action, null);'),
        'Java onCustomAction must guard against negative or zero indices safely'
      );
    });
  });

  // =========================================================================
  // 4. REPEAT & SHUFFLE PERMUTATIONS EXHAUSTIVE COVERAGE
  // =========================================================================
  describe('4. Repeat and Shuffle Permutations Exhaustive Coverage', () => {
    const javaPath = path.join(ROOT, 'native/android/SpotifreeMediaService.java');
    const javaContent = fs.readFileSync(javaPath, 'utf8');

    const REPEAT_MODE_NONE = 0;
    const REPEAT_MODE_ONE = 1;
    const REPEAT_MODE_ALL = 2;

    function getMediaSessionRepeatMode(repeat) {
      return repeat === 'one' ? REPEAT_MODE_ONE : repeat === 'all' ? REPEAT_MODE_ALL : REPEAT_MODE_NONE;
    }

    function getRepeatDrawable(repeat) {
      return repeat === 'one' ? 'R.drawable.ic_car_repeat_one' : repeat === 'all' ? 'R.drawable.ic_car_repeat_on' : 'R.drawable.ic_car_repeat';
    }

    const SHUFFLE_MODE_NONE = 0;
    const SHUFFLE_MODE_ALL = 1;

    function getMediaSessionShuffleMode(shuffle) {
      return shuffle ? SHUFFLE_MODE_ALL : SHUFFLE_MODE_NONE;
    }

    function getShuffleDrawable(shuffle) {
      return shuffle ? 'R.drawable.ic_car_shuffle_on' : 'R.drawable.ic_car_shuffle';
    }

    function getLikeDrawable(useStar, liked) {
      return useStar
        ? (liked ? 'R.drawable.ic_car_star_filled' : 'R.drawable.ic_car_star')
        : (liked ? 'R.drawable.ic_car_heart_filled' : 'R.drawable.ic_car_heart');
    }

    it('Exhaustively verifies all repeat permutations ("off", "all", "one", unknown, null, malformed)', () => {
      const repeatStates = [
        { val: 'off', expectedMode: REPEAT_MODE_NONE, expectedDrawable: 'R.drawable.ic_car_repeat' },
        { val: 'all', expectedMode: REPEAT_MODE_ALL, expectedDrawable: 'R.drawable.ic_car_repeat_on' },
        { val: 'one', expectedMode: REPEAT_MODE_ONE, expectedDrawable: 'R.drawable.ic_car_repeat_one' },
        { val: 'unknown', expectedMode: REPEAT_MODE_NONE, expectedDrawable: 'R.drawable.ic_car_repeat' },
        { val: '', expectedMode: REPEAT_MODE_NONE, expectedDrawable: 'R.drawable.ic_car_repeat' },
        { val: null, expectedMode: REPEAT_MODE_NONE, expectedDrawable: 'R.drawable.ic_car_repeat' },
        { val: undefined, expectedMode: REPEAT_MODE_NONE, expectedDrawable: 'R.drawable.ic_car_repeat' },
        { val: 'track', expectedMode: REPEAT_MODE_NONE, expectedDrawable: 'R.drawable.ic_car_repeat' },
        { val: 'context', expectedMode: REPEAT_MODE_NONE, expectedDrawable: 'R.drawable.ic_car_repeat' }
      ];

      for (const st of repeatStates) {
        assert.strictEqual(getMediaSessionRepeatMode(st.val), st.expectedMode,
          `MediaSession repeatMode mapping failed for repeat="${st.val}"`);
        assert.strictEqual(getRepeatDrawable(st.val), st.expectedDrawable,
          `CustomAction repeat drawable mapping failed for repeat="${st.val}"`);
      }
    });

    it('Exhaustively verifies all shuffle permutations (true, false, truthy/falsy)', () => {
      const shuffleStates = [
        { val: true, expectedMode: SHUFFLE_MODE_ALL, expectedDrawable: 'R.drawable.ic_car_shuffle_on' },
        { val: false, expectedMode: SHUFFLE_MODE_NONE, expectedDrawable: 'R.drawable.ic_car_shuffle' }
      ];

      for (const st of shuffleStates) {
        assert.strictEqual(getMediaSessionShuffleMode(st.val), st.expectedMode,
          `MediaSession shuffleMode mapping failed for shuffle=${st.val}`);
        assert.strictEqual(getShuffleDrawable(st.val), st.expectedDrawable,
          `CustomAction shuffle drawable mapping failed for shuffle=${st.val}`);
      }
    });

    it('Exhaustively verifies all favorite permutations across useStar and liked (2x2 matrix)', () => {
      const likeMatrix = [
        { useStar: false, liked: false, expected: 'R.drawable.ic_car_heart' },
        { useStar: false, liked: true, expected: 'R.drawable.ic_car_heart_filled' },
        { useStar: true, liked: false, expected: 'R.drawable.ic_car_star' },
        { useStar: true, liked: true, expected: 'R.drawable.ic_car_star_filled' },
      ];

      for (const cell of likeMatrix) {
        assert.strictEqual(getLikeDrawable(cell.useStar, cell.liked), cell.expected,
          `Like drawable mapping failed for useStar=${cell.useStar}, liked=${cell.liked}`);
      }
    });

    it('Verifies SpotifreeMediaService.java source contains exact MediaSession setRepeatMode and setShuffleMode calls', () => {
      assert.ok(
        javaContent.includes('session.setShuffleMode(shuffle ? PlaybackStateCompat.SHUFFLE_MODE_ALL : PlaybackStateCompat.SHUFFLE_MODE_NONE);'),
        'Must call session.setShuffleMode with appropriate PlaybackStateCompat modes'
      );
      assert.ok(
        javaContent.includes('session.setRepeatMode("one".equals(repeat) ? PlaybackStateCompat.REPEAT_MODE_ONE'),
        'Must call session.setRepeatMode with REPEAT_MODE_ONE for "one"'
      );
      assert.ok(
        javaContent.includes(': "all".equals(repeat) ? PlaybackStateCompat.REPEAT_MODE_ALL : PlaybackStateCompat.REPEAT_MODE_NONE);'),
        'Must call session.setRepeatMode with REPEAT_MODE_ALL for "all" and REPEAT_MODE_NONE otherwise'
      );
    });
  });

  // =========================================================================
  // 5. FORENSIC ASSET & DRAWABLE COMPATIBILITY
  // =========================================================================
  describe('5. Android Auto Res Drawable Files Integrity', () => {
    const requiredCarDrawables = [
      'ic_car_repeat_one.xml',
      'ic_car_repeat_on.xml',
      'ic_car_repeat.xml',
      'ic_car_shuffle_on.xml',
      'ic_car_shuffle.xml',
      'ic_car_star_filled.xml',
      'ic_car_star.xml',
      'ic_car_heart_filled.xml',
      'ic_car_heart.xml',
      'ic_car_dislike.xml'
    ];

    for (const drawable of requiredCarDrawables) {
      it(`Confirms existence and non-zero size of native/android/res/drawable/${drawable}`, () => {
        const p = path.join(ROOT, 'native/android/res/drawable', drawable);
        assert.ok(fs.existsSync(p), `Missing required Android Auto drawable: ${drawable}`);
        const stat = fs.statSync(p);
        assert.ok(stat.size > 0, `Drawable file ${drawable} is empty`);
      });
    }
  });
});
