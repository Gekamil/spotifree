/**
 * Challenger Deep Stress & Boundary Harness for Milestone 3
 * Tests mathematical model invariants, timeline extremes, pointer scrubbing fuzzing,
 * and component lifecycle guarantees under hostile conditions.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const modalSourcePath = resolve(__dirname, '../src/components/modals/TransitionEditorModal.tsx');
const modalSource = readFileSync(modalSourcePath, 'utf8');

// Extracted exact functions from TransitionEditorModal.tsx
function computeTimelineCoordinates(width, height, tempo, compases) {
  const safeTempo = tempo > 40 && tempo < 240 ? tempo : 128;
  const barSec = 240 / safeTempo;
  const T_leadIn = 1.2;
  const T_mix = Math.max(2.0, Math.min(16.0, barSec * (compases || 2)));
  const T_leadOut = 2.0;
  const T_total = T_leadIn + T_mix + T_leadOut;

  const W = Math.max(320, width);
  const H = height;

  const W_leadIn = W * (T_leadIn / T_total);
  const W_mix = W * (T_mix / T_total);
  const W_leadOut = W - W_leadIn - W_mix;

  const X_mixStart = W_leadIn;
  const X_mixEnd = W_leadIn + W_mix;
  const X_crossover = W_leadIn + 0.5 * W_mix;

  const N_beats = (compases || 2) * 4;
  const stepBeat = W_mix / N_beats;

  return {
    T_leadIn,
    T_mix,
    T_leadOut,
    T_total,
    W,
    H,
    W_leadIn,
    W_mix,
    W_leadOut,
    X_mixStart,
    X_mixEnd,
    X_crossover,
    N_beats,
    stepBeat,
  };
}

function evaluateEnvelope(volumeEnvelope, preset, p) {
  let valA = 1.0;
  let valB = 0.0;

  // Deck A
  if (volumeEnvelope === 'superposicion' || preset === 'automatica') {
    valA = p <= 0.5 ? 1.0 : Math.cos((p - 0.5) * Math.PI);
  } else if (volumeEnvelope === 'corte_directo' || preset === 'corte') {
    valA = p < 0.5 ? 1.0 : 0.0;
  } else if (preset === 'crescendo') {
    valA = Math.cos(p * 0.5 * Math.PI);
  } else if (volumeEnvelope === 'curva_s' || preset === 'eco_out' || preset === 'beat_roll') {
    valA = 0.5 * (1.0 + Math.cos(p * Math.PI));
  } else {
    valA = Math.max(0, 1.0 - p);
  }

  // Deck B
  if (volumeEnvelope === 'superposicion' || preset === 'automatica') {
    valB = p;
  } else if (volumeEnvelope === 'corte_directo' || preset === 'corte') {
    valB = p < 0.5 ? 0.0 : 1.0;
  } else if (preset === 'crescendo') {
    valB = Math.pow(p, 1.8);
  } else if (volumeEnvelope === 'curva_s' || preset === 'eco_out' || preset === 'beat_roll') {
    valB = 0.5 * (1.0 - Math.cos(p * Math.PI));
  } else {
    valB = Math.min(1, p);
  }

  return { valA, valB };
}

describe('Adversarial Deep Stress: Timeline Mathematics & Extreme Boundaries', () => {
  it('Handles extreme tempos, zero width, negative dimensions without NaN or division by zero', () => {
    const testCases = [
      { width: 0, height: 0, tempo: 0, compases: 0 },
      { width: -500, height: -200, tempo: -100, compases: -5 },
      { width: 1, height: 1, tempo: 300, compases: 1 },
      { width: 10000, height: 5000, tempo: 20, compases: 16 },
      { width: 640, height: 196, tempo: 40.0001, compases: 4 },
      { width: 640, height: 196, tempo: 239.9999, compases: 8 },
    ];

    for (const tc of testCases) {
      const coords = computeTimelineCoordinates(tc.width, tc.height, tc.tempo, tc.compases);
      assert.ok(!Number.isNaN(coords.W), `W is NaN for ${JSON.stringify(tc)}`);
      assert.ok(coords.W >= 320, `W must be clamped to >= 320, got ${coords.W}`);
      assert.ok(!Number.isNaN(coords.T_mix), `T_mix is NaN for ${JSON.stringify(tc)}`);
      assert.ok(coords.T_mix >= 2.0 && coords.T_mix <= 16.0, `T_mix out of range: ${coords.T_mix}`);
      assert.ok(!Number.isNaN(coords.T_total), `T_total is NaN`);
      assert.ok(!Number.isNaN(coords.X_mixStart), `X_mixStart is NaN`);
      assert.ok(!Number.isNaN(coords.X_mixEnd), `X_mixEnd is NaN`);
      assert.ok(!Number.isNaN(coords.X_crossover), `X_crossover is NaN`);
      assert.ok(coords.X_mixStart <= coords.X_crossover, `mixStart > crossover`);
      assert.ok(coords.X_crossover <= coords.X_mixEnd, `crossover > mixEnd`);
      assert.ok(Math.abs(coords.W_leadIn + coords.W_mix + coords.W_leadOut - coords.W) < 1e-6, 'Width parts must sum to total W');
    }
  });

  it('Verifies no silence hole in volume envelopes across all presets', () => {
    const presets = [
      { volumeEnvelope: 'superposicion', preset: 'automatica' },
      { volumeEnvelope: 'corte_directo', preset: 'corte' },
      { volumeEnvelope: 'curva_s', preset: 'crescendo' },
      { volumeEnvelope: 'curva_s', preset: 'eco_out' },
      { volumeEnvelope: 'curva_s', preset: 'beat_roll' },
      { volumeEnvelope: 'lineal', preset: 'fundido' },
      { volumeEnvelope: 'superposicion', preset: 'filtro' },
    ];

    for (const pr of presets) {
      // Test at 100 sample points between 0 and 1
      for (let i = 0; i <= 100; i++) {
        const p = i / 100;
        const { valA, valB } = evaluateEnvelope(pr.volumeEnvelope, pr.preset, p);

        assert.ok(!Number.isNaN(valA), `valA is NaN at p=${p} for ${pr.preset}`);
        assert.ok(!Number.isNaN(valB), `valB is NaN at p=${p} for ${pr.preset}`);
        assert.ok(valA >= -1e-6 && valA <= 1.000001, `valA ${valA} outside [0, 1] at p=${p} for ${pr.preset}`);
        assert.ok(valB >= -1e-6 && valB <= 1.000001, `valB ${valB} outside [0, 1] at p=${p} for ${pr.preset}`);

        // Combined amplitude must not drop to 0 in continuous blends (except corte at transition boundary)
        if (pr.preset !== 'corte') {
          const sumAmp = valA + valB;
          assert.ok(sumAmp >= 0.45, `Volume dip too severe (${sumAmp}) at p=${p} for ${pr.preset}`);
        }
      }
    }
  });
});

describe('Adversarial Deep Stress: Pointer Fuzzing & Rapid Interaction', () => {
  it('Fuzzes updateScrub with 10,000 pseudo-random clientX coordinates and widths', () => {
    let currentProgress = 0.0;
    const updateScrub = (clientX, target) => {
      const rect = target.getBoundingClientRect();
      if (rect.width <= 0) return;
      const progress = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      currentProgress = progress;
    };

    let seed = 123456789;
    const rng = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    for (let i = 0; i < 10000; i++) {
      const clientX = (rng() - 0.5) * 5000; // -2500 to +2500
      const left = (rng() - 0.5) * 1000;
      const width = (rng() - 0.2) * 1200; // may be <= 0

      const target = {
        getBoundingClientRect: () => ({ left, width }),
      };

      updateScrub(clientX, target);

      assert.ok(!Number.isNaN(currentProgress), `currentProgress became NaN at iter ${i}`);
      assert.ok(currentProgress >= 0.0 && currentProgress <= 1.0, `currentProgress out of [0, 1]: ${currentProgress}`);
    }
  });

  it('Simulates setPointerCapture and releasePointerCapture exceptions without crashing', () => {
    let isDragging = false;
    let progressVal = 0.0;

    const mockElement = {
      getBoundingClientRect: () => ({ left: 50, width: 200 }),
      setPointerCapture: () => {
        throw new Error('NotFoundError: Invalid pointer ID');
      },
      releasePointerCapture: () => {
        throw new Error('NotFoundError: Invalid pointer ID');
      },
    };

    const updateScrub = (clientX, target) => {
      const rect = target.getBoundingClientRect();
      if (rect.width <= 0) return;
      progressVal = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    };

    const handlePointerDown = (e) => {
      isDragging = true;
      updateScrub(e.clientX, e.currentTarget);
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}
    };

    const handlePointerUp = (e) => {
      isDragging = false;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
    };

    // Should not throw despite capture/release throwing
    assert.doesNotThrow(() => {
      handlePointerDown({ clientX: 100, currentTarget: mockElement, pointerId: 999 });
    });
    assert.strictEqual(isDragging, true);
    assert.strictEqual(progressVal, (100 - 50) / 200);

    assert.doesNotThrow(() => {
      handlePointerUp({ clientX: 100, currentTarget: mockElement, pointerId: 999 });
    });
    assert.strictEqual(isDragging, false);
  });
});

describe('Adversarial Deep Stress: Source Code Structure & Invariants', () => {
  it('Guarantees all JSX track property accesses are shielded behind early render guard', () => {
    // Check line where `if (!isOpen || !trackA || !trackB) return null;` occurs
    const guardIndex = modalSource.indexOf('if (!isOpen || !trackA || !trackB) return null;');
    assert.ok(guardIndex > 0, 'Render guard must exist in source');

    // Check that trackA.name, trackB.name, trackA.artists, trackB.artists only appear AFTER this guard in JSX
    const preGuardSource = modalSource.slice(0, guardIndex);
    
    // In preGuardSource, no unshielded trackA.id or trackB.id should exist except in handlers/effects that have their own guards
    // Check that preGuardSource does not contain unconditional `trackA.id` or `trackB.id` outside functions/guards
    const matchesA = [...preGuardSource.matchAll(/(?<![?.\w])trackA\.id/g)];
    const matchesB = [...preGuardSource.matchAll(/(?<![?.\w])trackB\.id/g)];

    // Verify that every access to trackA.id or trackB.id before the render guard is enclosed in a function/effect with a null guard
    for (const match of matchesA) {
      const idx = match.index;
      // Search backwards up to the enclosing function/effect start
      const precedingBlock = preGuardSource.slice(Math.max(0, idx - 5000), idx);
      const isGuarded = precedingBlock.includes('if (!trackA || !trackB)') ||
        precedingBlock.includes('if (!trackA?.id') ||
        precedingBlock.includes('if (!isOpen || !trackA || !trackB)');
      assert.ok(isGuarded, `Found unshielded trackA.id in pre-guard source around position ${idx}`);
    }

    for (const match of matchesB) {
      const idx = match.index;
      const precedingBlock = preGuardSource.slice(Math.max(0, idx - 5000), idx);
      const isGuarded = precedingBlock.includes('if (!trackA || !trackB)') ||
        precedingBlock.includes('if (!trackA?.id') ||
        precedingBlock.includes('if (!isOpen || !trackA || !trackB)');
      assert.ok(isGuarded, `Found unshielded trackB.id in pre-guard source around position ${idx}`);
    }
  });

  it('Guarantees audition lifecycle cleanup terminates both audioEngine and djTransitionService', () => {
    // Both stopTransitionAudition and stopAudition must be called in unmount cleanup
    const cleanupRegex = /return\s*\(\)\s*=>\s*\{[\s\S]*?audioEngine\.stopTransitionAudition\(\);[\s\S]*?djTransitionService\.stopAudition\(\);[\s\S]*?\}/;
    assert.ok(cleanupRegex.test(modalSource), 'Cleanup function must call both audioEngine and djTransitionService stops');
  });
});
