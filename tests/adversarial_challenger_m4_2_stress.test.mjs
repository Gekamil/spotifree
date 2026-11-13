import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if ((specifier.startsWith('./') || specifier.startsWith('../')) && !/\.[a-z0-9]+$/i.test(specifier) && context.parentURL) {
      const candidate = new URL(`${specifier}.ts`, context.parentURL);
      if (fs.existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context);
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    const result = nextLoad(url, context);
    if (url.includes('/src/') && /\.ts$/.test(url) && result.source) {
      const src = String(result.source);
      if (src.includes('import.meta.env')) return { ...result, source: src.replaceAll('import.meta.env', '({} as any)') };
    }
    return result;
  },
});

const projectRoot = process.cwd();

test('Milestone 4 (F16, F17, F18) — Adversarial Stress & Chaos Harness', async (suite) => {
  const {
    todayRecommendationKey,
    hashSeed,
    seededShuffle,
    getDailyRotatingPlaylists,
    buildDailyRotatingShelf,
    CURATED_RECOMMENDATION_POOL,
  } = await import('../src/services/recommendations.ts');

  const { resolveArtistName } = await import('../src/services/artistService.ts');

  // =========================================================================
  // STRESS 1: F17 365-Day Full Year Simulation (No collisions, genre balance, no duplicate cards)
  // =========================================================================
  await suite.test('Stress 1: 365-Day Daily Recommendations Simulation', () => {
    const poolById = new Map(CURATED_RECOMMENDATION_POOL.map((p) => [p.id, p]));
    const hashes = new Set();
    const permutations = new Set();

    const startDate = new Date(2026, 0, 1); // 2026-01-01
    for (let dayOffset = 0; dayOffset < 365; dayOffset++) {
      const currentDate = new Date(2026, 0, 1 + dayOffset);
      const key = todayRecommendationKey(currentDate);

      // Verify key format: YYYY-MM-DD
      assert.match(key, /^2026-\d{2}-\d{2}$/, `Key format must be valid for day ${dayOffset}`);

      // Verify hash seed uniqueness
      const h = hashSeed(key);
      assert.ok(!hashes.has(h), `Hash collision detected on day ${key} with hash ${h}`);
      hashes.add(h);

      // Generate 8 cards
      const cards = getDailyRotatingPlaylists(currentDate, 8);
      assert.equal(cards.length, 8, `Day ${key} did not return 8 cards`);

      // Verify NO DUPLICATES in the 8 cards
      const cardIds = new Set();
      const representedGenres = new Set();

      for (const card of cards) {
        assert.ok(!cardIds.has(card.id), `Duplicate card ${card.id} returned on day ${key}`);
        cardIds.add(card.id);

        const poolEntry = poolById.get(card.id);
        assert.ok(poolEntry, `Card ${card.id} not found in curated pool`);
        representedGenres.add(poolEntry.genre);
      }

      // Check genre diversity: must represent at least 3-5 distinct genres every day
      assert.ok(
        representedGenres.size >= 4,
        `Day ${key} had poor genre diversity: only ${representedGenres.size} genres (${[...representedGenres].join(', ')})`
      );

      // Save permutation signature
      permutations.add(cards.map((c) => c.id).join(','));
    }

    // Over 365 days, how many unique permutations of 8 playlists were produced?
    // It should be extremely diverse (nearly all 365 unique)
    assert.ok(
      permutations.size >= 350,
      `Expected >= 350 unique daily permutations over 365 days, got ${permutations.size}`
    );
  });

  // =========================================================================
  // STRESS 2: F17 High-concurrency rapid calls (10,000 iterations)
  // =========================================================================
  await suite.test('Stress 2: 10,000 Rapid Concurrency Iterations', () => {
    const fixedDate = new Date(2026, 6, 15);
    const expected = getDailyRotatingPlaylists(fixedDate, 8).map((c) => c.id).join('|');

    for (let i = 0; i < 10000; i++) {
      const result = getDailyRotatingPlaylists(fixedDate, 8).map((c) => c.id).join('|');
      if (result !== expected) {
        assert.fail(`Concurrency drift on iteration ${i}! Expected ${expected}, got ${result}`);
      }
    }
  });

  // =========================================================================
  // STRESS 3: F16 resolveArtistName Adversarial Inputs
  // =========================================================================
  await suite.test('Stress 3: resolveArtistName Adversarial Inputs', () => {
    // Normal cases
    assert.equal(resolveArtistName('art-bad-bunny', 'Bad Bunny'), 'Bad Bunny');
    assert.equal(resolveArtistName('art-293582', 'Rosalía'), 'Rosalía');

    // Generic 'playlist' fallbackName must be rejected and slug used
    assert.equal(resolveArtistName('art-duki', 'playlist'), 'Duki');
    assert.equal(resolveArtistName('art-taylor-swift', 'Playlist'), 'Taylor Swift');
    assert.equal(resolveArtistName('sf-artist-billie-eilish', '  PLAYLIST  '), 'Billie Eilish');

    // Missing fallbackName
    assert.equal(resolveArtistName('art-kendrick-lamar', ''), 'Kendrick Lamar');
    assert.equal(resolveArtistName('artist-feid', undefined), 'Feid');

    // Messy slug
    assert.equal(resolveArtistName('spotify:artist:the-weeknd', undefined), 'The Weeknd');
    assert.equal(resolveArtistName('art-ac-dc', undefined), 'Ac Dc');

    // Empty everything fallback
    assert.equal(resolveArtistName('art-', ''), 'Artista');
    assert.equal(resolveArtistName('', ''), 'Artista');
  });

  // =========================================================================
  // STRESS 4: F18 Ambient Cinema Edge Cases in PlaylistClipsMiniPlayer
  // =========================================================================
  await suite.test('Stress 4: Ambient Cinema Edge Cases in PlaylistClipsMiniPlayer', () => {
    const playerPath = path.join(projectRoot, 'src', 'components', 'playlist', 'PlaylistClipsMiniPlayer.tsx');
    const content = fs.readFileSync(playerPath, 'utf8');

    // Verify key switching on canvasUrl change prevents stale buffer reuse
    assert.match(
      content,
      /key=\{`ambient-video-\$\{canvasUrl\}`\}/,
      'Ambient video element MUST use canvasUrl in its React key to avoid stale canvas video playback'
    );
    assert.match(
      content,
      /key=\{canvasUrl\}/,
      'Main video element MUST use canvasUrl in its React key to cleanly reset video buffer on track transition'
    );

    // Verify pointer-events-none is strictly applied to both ambient glow layers
    // so user touches/clicks pass through directly to the player card and modal controls
    const ambientContainerMatch = content.match(/<div className="absolute inset-0 pointer-events-none[\s\S]*?z-0">/);
    assert.ok(ambientContainerMatch, 'Ambient container must have pointer-events-none and z-0');

    // Verify opacity transitions for smooth visual fading
    assert.match(
      content,
      /transition-opacity duration-700 ease-in-out/,
      'Ambient video must transition opacity smoothly over 700ms'
    );
  });
});
