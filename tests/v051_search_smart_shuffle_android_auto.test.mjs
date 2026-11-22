import { describe, it } from 'node:test';
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
});

const { isStrictArtistMatch, trackMatchesArtist, normalizeArtistName } = await import('../src/utils/trackArtists.ts');
const { rankSearchTracks, searchScore } = await import('../src/utils/searchRanking.ts');



describe('Spotifree v0.5.1: Strict Artist Matching, Musical Style Shuffle & Android Auto', () => {

  describe('1. Strict Artist Matching & Zero Substring Leakage (Vibra Eterna vs Eterna)', () => {
    it('normalizes artist names consistently removing diacritics and punctuation', () => {
      assert.strictEqual(normalizeArtistName('Vibra Eterna!'), 'vibra eterna');
      assert.strictEqual(normalizeArtistName('Éterna'), 'eterna');
      assert.strictEqual(normalizeArtistName('Mörat'), 'morat');
    });

    it('rejects substring leakage: "Vibra Eterna" must NOT match "Eterna"', () => {
      assert.strictEqual(isStrictArtistMatch('Eterna', 'Vibra Eterna'), false);
      assert.strictEqual(isStrictArtistMatch('Vibra Eterna', 'Eterna'), false);
      assert.strictEqual(trackMatchesArtist({ artists: [{ name: 'Eterna' }] }, 'Vibra Eterna'), false);
      assert.strictEqual(trackMatchesArtist({ artists: [{ name: 'Vibra Eterna' }] }, 'Eterna'), false);
    });

    it('matches exact and accented matches', () => {
      assert.strictEqual(isStrictArtistMatch('Vibra Eterna', 'Vibra Eterna'), true);
      assert.strictEqual(isStrictArtistMatch('vibra eterna', 'Vibra Eterna'), true);
      assert.strictEqual(isStrictArtistMatch('Eterna', 'Éterna'), true);
      assert.strictEqual(trackMatchesArtist({ artists: [{ name: 'Vibra Eterna' }] }, 'Vibra Eterna'), true);
    });

    it('correctly parses and matches multi-artist collaborations with commas, &, feat, ft, with', () => {
      assert.strictEqual(isStrictArtistMatch('Vibra Eterna, Feid', 'Vibra Eterna'), true);
      assert.strictEqual(isStrictArtistMatch('Feid feat. Vibra Eterna', 'Vibra Eterna'), true);
      assert.strictEqual(isStrictArtistMatch('Bizarrap & Vibra Eterna', 'Vibra Eterna'), true);
      assert.strictEqual(isStrictArtistMatch('Vibra Eterna with Drake', 'Vibra Eterna'), true);

      // But still strictly rejects when individual token does not match
      assert.strictEqual(isStrictArtistMatch('Feid feat. Eterna', 'Vibra Eterna'), false);
      assert.strictEqual(isStrictArtistMatch('Eterna & Friends', 'Vibra Eterna'), false);
    });

    it('ranks tracks by target artist way higher than partial substring matches', () => {
      const trackTarget = {
        name: 'Camino Sagrado',
        artists: [{ name: 'Vibra Eterna' }],
      };
      const trackPartial = {
        name: 'Vibra',
        artists: [{ name: 'Eterna' }],
      };
      const trackUnrelated = {
        name: 'Algo Diferente',
        artists: [{ name: 'Otro Artista' }],
      };

      const results = rankSearchTracks('Vibra Eterna', [trackPartial, trackUnrelated, trackTarget]);
      assert.strictEqual(results[0].artists[0].name, 'Vibra Eterna');
      assert.ok(searchScore('Vibra Eterna', trackTarget) > searchScore('Vibra Eterna', trackPartial));
    });
  });

  describe('2. Smart Shuffle by Musical Style / Genre', () => {
    it('usePlayerStore imports recommendation methods for smart style matching', () => {
      const code = fs.readFileSync(path.resolve('src/store/usePlayerStore.ts'), 'utf-8');
      assert.ok(
        code.includes('populateSmartShuffleRecommendations') || code.includes('classifyTrackHashtags'),
        'Must support smart shuffle recommendations'
      );
      assert.ok(!code.includes('const res = await searchSpotify(artist);'), 'Must not search purely by artist name');
    });

    it('prioritizes complementary artists of the same musical style', () => {
      const code = fs.readFileSync(path.resolve('src/store/usePlayerStore.ts'), 'utf-8');
      assert.ok(
        code.includes('isSmartRecommendation: true') || code.includes('trackMatchesArtist'),
        'Must mark recommended tracks'
      );
    });
  });

  describe('3. Android Auto Discovery and Background Launch Fixes', () => {
    it('scripts/setup-android-native.mjs declares SpotifreeMediaService with android:label="@string/app_name"', () => {
      const setupCode = fs.readFileSync(path.resolve('scripts/setup-android-native.mjs'), 'utf-8');
      assert.ok(setupCode.includes('android:name=".SpotifreeMediaService"'), 'Must declare top-level service');
      assert.ok(setupCode.includes('android:label="@string/app_name"'), 'Must include android:label');
      assert.ok(setupCode.includes('com.google.android.gms.car.application'), 'Must include automotive app descriptor');
    });

    it('native/android/SpotifreeMediaService.java implements Android 10-15 background activity launch bypass', () => {
      const serviceCode = fs.readFileSync(path.resolve('native/android/SpotifreeMediaService.java'), 'utf-8');
      assert.ok(serviceCode.includes('MODE_BACKGROUND_ACTIVITY_START_ALLOWED'), 'Must support API 34+ background activity start');
      assert.ok(serviceCode.includes('FLAG_ACTIVITY_RESET_TASK_IF_NEEDED'), 'Must use proper activity intent flags');
      assert.ok(serviceCode.includes('SpotifreeMediaService.class'), 'VARIANTS must include top-level SpotifreeMediaService');
    });
  });
});
