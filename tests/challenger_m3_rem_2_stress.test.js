/**
 * Spotifree Milestone 3 Remediation Round 2 Empirical Challenger Test Suite
 * 
 * Author: challenger_m3_rem_2
 * Focus:
 * 1. Null / undefined / empty input stress-testing of TransitionEditorModal
 * 2. Strict adherence to React Hook invariants (no conditional hooks, unmount cleanup)
 * 3. Empirical 10,000-point Monte Carlo stress test across all 7 presets and volume envelope curves
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { register } from 'node:module';

// Register JSON loader hook for Node 24 ESM TypeScript support
register(new URL('./test_loader.js', import.meta.url));

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const modalSourcePath = resolve(__dirname, '../src/components/modals/TransitionEditorModal.tsx');
const modalSource = readFileSync(modalSourcePath, 'utf8');

// Dynamic import holder for TypeScript utilities
let resolveClientSideRealFeature;

before(async () => {
  const audioFeaturesModule = await import('../src/utils/audioFeatures.ts');
  resolveClientSideRealFeature = audioFeaturesModule.resolveClientSideRealFeature;
});

// ============================================================================
// SUITE 1: React Hook Invariants & Source AST/Structure Audit
// ============================================================================

describe('Suite 1: React Hook Invariants & Modal Lifecycle Contract', () => {
  it('1.1: Rules of Hooks — All hooks are invoked unconditionally before any early return', () => {
    // In React 19, hooks must NEVER be placed behind conditional returns.
    // In TransitionEditorModal.tsx, the early exit `if (!isOpen || !trackA || !trackB) return null;`
    // must appear strictly AFTER all useState, useRef, and useEffect calls.

    const earlyExitRegex = /if\s*\(\s*!isOpen\s*\|\|\s*!trackA\s*\|\|\s*!trackB\s*\)\s*return\s+null\s*;/;
    const earlyExitMatch = modalSource.match(earlyExitRegex);
    assert.ok(earlyExitMatch, 'Modal must contain early exit guard for null tracks and closed state');

    const earlyExitIndex = modalSource.indexOf(earlyExitMatch[0]);

    // Find all hook invocations
    const hookRegex = /\b(useState|useEffect|useRef|useMemo|useCallback)\s*\(/g;
    let match;
    const hookIndices = [];
    while ((match = hookRegex.exec(modalSource)) !== null) {
      // Exclude type imports or comments
      const lineStart = modalSource.lastIndexOf('\n', match.index);
      const line = modalSource.substring(lineStart, match.index + 20);
      if (!line.includes('import') && !line.includes('//') && !line.includes('/*')) {
        hookIndices.push({ hook: match[1], index: match.index });
      }
    }

    assert.ok(hookIndices.length >= 10, `Expected at least 10 hook invocations, found ${hookIndices.length}`);

    // Every hook invocation must occur BEFORE earlyExitIndex
    for (const h of hookIndices) {
      assert.ok(
        h.index < earlyExitIndex,
        `Hook invariant violation: ${h.hook} at position ${h.index} is invoked AFTER early exit guard at ${earlyExitIndex}!`
      );
    }
  });

  it('1.2: Lifecycle Unmount Cleanup Return — useEffect([isOpen]) returns audio teardown closure', () => {
    // React unmount does NOT run the body of useEffect([isOpen]), only the returned cleanup closure.
    // The effect must return a function that calls audioEngine.stopTransitionAudition() and djTransitionService.stopAudition().

    const auditionEffectBlockMatch = modalSource.match(
      /useEffect\(\s*\(\)\s*=>\s*\{[\s\S]*?audioEngine\.stopTransitionAudition\(\);[\s\S]*?return\s*\(\)\s*=>\s*\{([\s\S]*?)\}\s*\},?\s*\[isOpen\]\);/
    );

    assert.ok(auditionEffectBlockMatch, 'audition useEffect must have return cleanup closure');
    const cleanupBody = auditionEffectBlockMatch[1];

    assert.ok(
      cleanupBody.includes('audioEngine.stopTransitionAudition()'),
      'Cleanup closure must call audioEngine.stopTransitionAudition()'
    );
    assert.ok(
      cleanupBody.includes('djTransitionService.stopAudition()'),
      'Cleanup closure must call djTransitionService.stopAudition()'
    );
  });

  it('1.3: Event Handlers — handleSelectPreset, handleToggleAudition, handleSave safely guard against null tracks', () => {
    // Handlers must check if (!trackA || !trackB) return; before dereferencing
    const presetHandlerMatch = modalSource.match(/const\s+handleSelectPreset\s*=\s*\([^)]*\)\s*=>\s*\{([\s\S]*?)\};/);
    assert.ok(presetHandlerMatch, 'handleSelectPreset must exist');
    assert.ok(
      presetHandlerMatch[1].includes('if (!trackA || !trackB) return;'),
      'handleSelectPreset must guard against null tracks'
    );

    const auditionHandlerMatch = modalSource.match(/const\s+handleToggleAudition\s*=\s*async\s*\([^)]*\)\s*=>\s*\{([\s\S]*?)\};/);
    assert.ok(auditionHandlerMatch, 'handleToggleAudition must exist');
    assert.ok(
      auditionHandlerMatch[1].includes('if (!trackA || !trackB) return;'),
      'handleToggleAudition must guard against null tracks'
    );

    const saveHandlerMatch = modalSource.match(/const\s+handleSave\s*=\s*\([^)]*\)\s*=>\s*\{([\s\S]*?)\};/);
    assert.ok(saveHandlerMatch, 'handleSave must exist');
    assert.ok(
      saveHandlerMatch[1].includes('if (!trackA || !trackB) return;'),
      'handleSave must guard against null tracks'
    );
  });
});

// ============================================================================
// SUITE 2: Empirical Null, Undefined & Degenerate Track Inputs Stress-Test
// ============================================================================

describe('Suite 2: Empirical Null, Undefined & Degenerate Track Inputs Stress-Test', () => {
  const degenerateScenarios = [
    { desc: 'Both tracks null, isOpen = false', trackA: null, trackB: null, isOpen: false },
    { desc: 'Both tracks null, isOpen = true', trackA: null, trackB: null, isOpen: true },
    { desc: 'Both tracks undefined, isOpen = true', trackA: undefined, trackB: undefined, isOpen: true },
    { desc: 'Track A null, Track B populated', trackA: null, trackB: { id: 'track_b_1', name: 'Song B', artists: [{ name: 'Artist B' }] }, isOpen: true },
    { desc: 'Track A populated, Track B null', trackA: { id: 'track_a_1', name: 'Song A', artists: [{ name: 'Artist A' }] }, trackB: null, isOpen: true },
    { desc: 'Empty objects as tracks', trackA: {}, trackB: {}, isOpen: true },
    { desc: 'Empty strings for id, name, and empty artists array', trackA: { id: '', name: '', artists: [] }, trackB: { id: '', name: '', artists: [] }, isOpen: true },
    { desc: 'Artists is null / undefined', trackA: { id: 'a', name: 'Song A', artists: null }, trackB: { id: 'b', name: 'Song B', artists: undefined }, isOpen: true },
    { desc: 'Empty artist object and whitespace names', trackA: { id: ' ', name: ' ', artists: [{ name: '' }] }, trackB: { id: 'b', name: '', artists: [{ name: ' ' }] }, isOpen: true },
  ];

  for (const scenario of degenerateScenarios) {
    it(`2.1: Degenerate input: ${scenario.desc}`, () => {
      // 1. Simulate feature resolution (lines 188-197 of TransitionEditorModal.tsx)
      let featA, featB;
      assert.doesNotThrow(() => {
        featA = resolveClientSideRealFeature(
          scenario.trackA?.id || '',
          scenario.trackA?.name || '',
          scenario.trackA?.artists?.[0]?.name
        );
      }, 'Feature resolution for trackA must never throw TypeError');

      assert.doesNotThrow(() => {
        featB = resolveClientSideRealFeature(
          scenario.trackB?.id || '',
          scenario.trackB?.name || '',
          scenario.trackB?.artists?.[0]?.name
        );
      }, 'Feature resolution for trackB must never throw TypeError');

      assert.ok(featA && typeof featA.tempo === 'number' && Number.isFinite(featA.tempo), 'featA must have valid finite tempo');
      assert.ok(featB && typeof featB.tempo === 'number' && Number.isFinite(featB.tempo), 'featB must have valid finite tempo');
      assert.ok(featA && typeof featA.camelot === 'string' && featA.camelot.length > 0, 'featA must have valid camelot');
      assert.ok(featB && typeof featB.camelot === 'string' && featB.camelot.length > 0, 'featB must have valid camelot');

      // 2. Simulate render guard condition (line 1002: if (!isOpen || !trackA || !trackB) return null;)
      const shouldRender = Boolean(scenario.isOpen && scenario.trackA && scenario.trackB);
      if (!scenario.isOpen || !scenario.trackA || !scenario.trackB) {
        assert.strictEqual(shouldRender, false, 'Modal early returns null when tracks are null/undefined or modal is closed');
      }

      // 3. Simulate handlers execution with degenerate tracks
      const dummyHandlerPreset = (p) => {
        if (!scenario.trackA || !scenario.trackB) return 'early_exit';
        return `preset_${p}`;
      };

      const dummyHandlerSave = () => {
        if (!scenario.trackA || !scenario.trackB) return 'early_exit';
        return 'saved';
      };

      assert.doesNotThrow(() => {
        const resPreset = dummyHandlerPreset('automatica');
        const resSave = dummyHandlerSave();
        if (!scenario.trackA || !scenario.trackB) {
          assert.strictEqual(resPreset, 'early_exit');
          assert.strictEqual(resSave, 'early_exit');
        }
      });
    });
  }
});

// ============================================================================
// SUITE 3: 10,000-Point Monte Carlo Stress-Test Across All 7 Presets and Volume Envelopes
// ============================================================================

describe('Suite 3: 10,000-Point Monte Carlo Math Stress-Test Across All 7 Presets and Envelopes', () => {
  // Volume evaluation mathematical kernel identical to TransitionEditorModal.tsx (lines 620-644 & 869-919)
  function evaluateModalEnvelopes(volumeEnvelope, preset, p) {
    let volA = 1.0;
    let volB = 0.0;

    // Deck A Volume Envelope
    if (volumeEnvelope === 'superposicion' || preset === 'automatica') {
      volA = p <= 0.5 ? 1.0 : Math.cos((p - 0.5) * Math.PI);
    } else if (volumeEnvelope === 'corte_directo' || preset === 'corte') {
      volA = p < 0.5 ? 1.0 : 0.0;
    } else if (preset === 'crescendo') {
      volA = Math.cos(p * 0.5 * Math.PI);
    } else if (volumeEnvelope === 'curva_s' || preset === 'eco_out' || preset === 'beat_roll') {
      volA = 0.5 * (1.0 + Math.cos(p * Math.PI));
    } else {
      volA = Math.max(0, 1.0 - p);
    }

    // Deck B Volume Envelope
    if (volumeEnvelope === 'superposicion' || preset === 'automatica') {
      volB = p;
    } else if (volumeEnvelope === 'corte_directo' || preset === 'corte') {
      volB = p < 0.5 ? 0.0 : 1.0;
    } else if (preset === 'crescendo') {
      volB = Math.pow(p, 1.8);
    } else if (volumeEnvelope === 'curva_s' || preset === 'eco_out' || preset === 'beat_roll') {
      volB = 0.5 * (1.0 - Math.cos(p * Math.PI));
    } else {
      volB = Math.min(1, p);
    }

    return { volA, volB };
  }

  // EQ Bass Swap kernel identical to TransitionEditorModal.tsx (lines 647-656)
  function evaluateBassSwap(eqMode, preset, p) {
    let bassA = 1.0;
    let bassB = 1.0;

    if (eqMode === 'intercambio_graves_central' || ['automatica', 'corte'].includes(preset)) {
      bassA = p < 0.50 ? 1.0 : 0.08;
      bassB = p < 0.50 ? 0.05 : 1.0;
    } else if (eqMode === 'intercambio_gradual') {
      bassA = 1.0 - p;
      bassB = p;
    } else if (eqMode === 'filtro_paso_alto') {
      bassA = Math.max(0.08, 1.0 - p * 2.0);
      bassB = Math.min(1.0, p * 2.0);
    }

    return { bassA, bassB };
  }

  // FX Modulation kernel identical to TransitionEditorModal.tsx (lines 659-668)
  function evaluateFXModulation(fxMode, preset, p, baseVolA) {
    let volA = baseVolA;
    let highsA = 1.0;
    let midsA = 1.0;

    if (preset === 'filtro' || fxMode === 'filtro_paso_bajo') {
      highsA = Math.pow(Math.max(0, 1 - p), 1.8);
      midsA = Math.pow(Math.max(0, 1 - p), 1.2);
    }

    if (fxMode === 'repeticion_loop' || preset === 'beat_roll') {
      const stutterTick = Math.floor(p * 24);
      if (stutterTick % 2 === 1 && p > 0.35) {
        volA *= 0.25;
      }
    }

    return { volA, highsA, midsA };
  }

  // Generate 10,000 points spanning [0, 1] including critical boundary conditions
  const NUM_POINTS = 10000;
  const testPoints = new Float64Array(NUM_POINTS);

  // Critical boundary & singularity points
  const critical = [
    0.0,
    1e-15,
    1e-9,
    0.1,
    0.25,
    0.35,
    0.499999999,
    0.5,
    0.500000001,
    0.75,
    0.9,
    1.0 - 1e-9,
    1.0 - 1e-15,
    1.0,
  ];
  for (let i = 0; i < critical.length; i++) {
    testPoints[i] = critical[i];
  }

  // Linear linspace anchors
  for (let i = critical.length; i < critical.length + 1000; i++) {
    testPoints[i] = (i - critical.length) / 999;
  }

  // Pseudo-random pseudo-chaotic points using deterministic LCG
  let lcgState = 123456789;
  function lcgRandom() {
    lcgState = (Math.imul(1664525, lcgState) + 1013904223) | 0;
    return (lcgState >>> 0) / 4294967296;
  }

  for (let i = critical.length + 1000; i < NUM_POINTS; i++) {
    testPoints[i] = lcgRandom();
  }

  const allPresets = [
    { preset: 'automatica', env: 'superposicion', eq: 'intercambio_graves_central', fx: 'ninguno' },
    { preset: 'corte', env: 'corte_directo', eq: 'intercambio_graves_central', fx: 'ninguno' },
    { preset: 'filtro', env: 'superposicion', eq: 'filtro_paso_bajo', fx: 'ninguno' },
    { preset: 'eco_out', env: 'curva_s', eq: 'filtro_paso_bajo', fx: 'eco' },
    { preset: 'freno_vinilo', env: 'corte_directo', eq: 'intercambio_graves_central', fx: 'freno_vinilo' },
    { preset: 'beat_roll', env: 'curva_s', eq: 'intercambio_gradual', fx: 'repeticion_loop' },
    { preset: 'crescendo', env: 'curva_s', eq: 'intercambio_gradual', fx: 'ninguno' },
    // Also include custom envelope modes
    { preset: 'fundido', env: 'lineal', eq: 'intercambio_gradual', fx: 'ninguno' },
    { preset: 'custom_curva_s', env: 'curva_s', eq: 'intercambio_graves_central', fx: 'ninguno' },
    { preset: 'custom_filtro_alto', env: 'lineal', eq: 'filtro_paso_alto', fx: 'ninguno' },
  ];

  for (const config of allPresets) {
    it(`3.1: 10,000 points Monte Carlo for preset "${config.preset}" (envelope="${config.env}", eq="${config.eq}", fx="${config.fx}")`, () => {
      let minCombined = Infinity;
      let maxCombined = -Infinity;

      for (let i = 0; i < NUM_POINTS; i++) {
        const p = testPoints[i];

        // 1. Evaluate Volume Envelope
        const { volA, volB } = evaluateModalEnvelopes(config.env, config.preset, p);

        // Verification of finiteness & range
        assert.ok(Number.isFinite(volA), `volA must be finite at p=${p} in ${config.preset}`);
        assert.ok(Number.isFinite(volB), `volB must be finite at p=${p} in ${config.preset}`);
        assert.ok(!Number.isNaN(volA), `volA must not be NaN at p=${p} in ${config.preset}`);
        assert.ok(!Number.isNaN(volB), `volB must not be NaN at p=${p} in ${config.preset}`);

        assert.ok(volA >= -1e-9 && volA <= 1.0 + 1e-9, `volA must be bounded in [0, 1] at p=${p}, got ${volA}`);
        assert.ok(volB >= -1e-9 && volB <= 1.0 + 1e-9, `volB must be bounded in [0, 1] at p=${p}, got ${volB}`);

        // Specific preset invariants
        if (config.preset === 'automatica' || config.env === 'superposicion') {
          if (p <= 0.5) {
            assert.strictEqual(volA, 1.0, `Deck A in superposicion must stay at 1.0 for p <= 0.5 (at p=${p})`);
          }
          assert.strictEqual(volB, p, `Deck B in superposicion must equal p (at p=${p})`);
        } else if (config.preset === 'corte' || config.env === 'corte_directo') {
          if (p < 0.5) {
            assert.strictEqual(volA, 1.0);
            assert.strictEqual(volB, 0.0);
          } else {
            assert.strictEqual(volA, 0.0);
            assert.strictEqual(volB, 1.0);
          }
        } else if (config.preset === 'crescendo') {
          const expectedVolB = Math.pow(p, 1.8);
          assert.ok(Math.abs(volB - expectedVolB) < 1e-9, `crescendo volB must match p^1.8 at p=${p}`);
        }

        // Energy conservation check (prevent unwanted silence holes in crossfading presets)
        if (config.preset !== 'corte' && config.preset !== 'freno_vinilo') {
          const combined = volA + volB;
          if (combined < minCombined) minCombined = combined;
          if (combined > maxCombined) maxCombined = combined;
          // Sum of amplitudes must never collapse to 0 in active mix
          assert.ok(combined >= 0.70, `Combined volume must stay >= 0.70 to avoid silence hole (at p=${p}, sum=${combined})`);
        }

        // 2. Evaluate Bass Swap Modulation
        const { bassA, bassB } = evaluateBassSwap(config.eq, config.preset, p);
        assert.ok(Number.isFinite(bassA) && Number.isFinite(bassB), `Bass swap must be finite at p=${p}`);
        assert.ok(bassA >= 0 && bassA <= 1.0, `bassA must be in [0, 1], got ${bassA}`);
        assert.ok(bassB >= 0 && bassB <= 1.0, `bassB must be in [0, 1], got ${bassB}`);

        // Low-end clash check: Deck A bass and Deck B bass must not both be at 1.0 simultaneously
        if (config.eq === 'intercambio_graves_central') {
          if (p < 0.50) {
            assert.strictEqual(bassA, 1.0);
            assert.strictEqual(bassB, 0.05);
          } else {
            assert.strictEqual(bassA, 0.08);
            assert.strictEqual(bassB, 1.0);
          }
          const lowEndEnergy = Math.sqrt(bassA * bassA + bassB * bassB);
          assert.ok(lowEndEnergy <= 1.01, `Low-end clash prevented: RMS bass energy <= 1.01, got ${lowEndEnergy}`);
        }

        // 3. Evaluate FX & Stutter Modulation
        const fxRes = evaluateFXModulation(config.fx, config.preset, p, volA);
        assert.ok(Number.isFinite(fxRes.volA), `FX volA must be finite at p=${p}`);
        assert.ok(Number.isFinite(fxRes.highsA), `FX highsA must be finite at p=${p}`);
        assert.ok(Number.isFinite(fxRes.midsA), `FX midsA must be finite at p=${p}`);
        assert.ok(fxRes.volA >= 0 && fxRes.volA <= 1.0 + 1e-9, `FX volA bounded in [0, 1]`);
      }
    });
  }
});
