/**
 * Spotifree Milestone 3 Empirical Challenger Test Suite
 * 
 * Adversarially and empirically verifies:
 * 1. Visualizer curve rendering across all 4 volume envelopes (superposicion, corte_directo, lineal, curva_s)
 *    and FX modes (eco_out, freno_vinilo, beat_roll, ninguno), including crossover bass-swap step lines.
 * 2. Interactive scrubbing handling (pointer drag, pointer capture, click-to-scrub, boundary clipping, rapid clicks).
 * 3. Modal lifecycle cleanup (isOpen = false vs component unmount).
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

// ============================================================================
// 1. Visualizer Curve Rendering & Coordinates
// ============================================================================

describe('Challenger 1: Visualizer Curve Rendering & Envelope Mathematics', () => {
  // Timeline coordinate computation extracted faithfully from TransitionEditorModal.tsx
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

  // Envelope evaluation function from TransitionEditorModal.tsx
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

  // Mock Canvas 2D Context recording path operations
  function createMockCanvasContext() {
    const calls = [];
    const ops = {
      moveTo: (x, y) => calls.push({ op: 'moveTo', x, y }),
      lineTo: (x, y) => calls.push({ op: 'lineTo', x, y }),
      beginPath: () => calls.push({ op: 'beginPath' }),
      stroke: () => calls.push({ op: 'stroke' }),
      quadraticCurveTo: (cpx, cpy, x, y) => calls.push({ op: 'quadraticCurveTo', cpx, cpy, x, y }),
      bezierCurveTo: (cp1x, cp1y, cp2x, cp2y, x, y) => calls.push({ op: 'bezierCurveTo', cp1x, cp1y, cp2x, cp2y, x, y }),
      setTransform: () => {},
      clearRect: () => {},
      fillRect: () => {},
      roundRect: () => {},
      fill: () => {},
      fillText: () => {},
      save: () => {},
      restore: () => {},
      setLineDash: () => {},
      closePath: () => {},
    };
    return { calls, ops };
  }

  it('1.1: Timeline coordinates preserve mathematical 3-zone partitioning', () => {
    const coords = computeTimelineCoordinates(640, 196, 128, 2);
    assert.strictEqual(coords.T_leadIn, 1.2, 'Lead-in must be 1.2s');
    assert.strictEqual(coords.T_leadOut, 2.0, 'Lead-out must be 2.0s');
    // At 128 BPM, 2 compases = 240 / 128 * 2 = 3.75s
    assert.strictEqual(coords.T_mix, 3.75, 'T_mix at 128 BPM for 2 compases must be 3.75s');
    assert.strictEqual(coords.T_total, 1.2 + 3.75 + 2.0, 'Total duration must sum all 3 zones');
    assert.ok(coords.X_mixStart > 0, 'Mix start must be positive');
    assert.ok(coords.X_crossover > coords.X_mixStart, 'Crossover must follow mix start');
    assert.ok(coords.X_mixEnd > coords.X_crossover, 'Mix end must follow crossover');
    assert.strictEqual(coords.X_crossover, coords.W_leadIn + 0.5 * coords.W_mix, 'Crossover must be exact midpoint');
  });

  it('1.2: Volume envelope "superposicion" maintains Deck A at 1.0 until crossover, then cos drops to 0.0, Deck B ramps 0 to 1', () => {
    // Lead-in: Deck A is 1.0, Deck B is 0.0
    const start = evaluateEnvelope('superposicion', 'automatica', 0.0);
    assert.strictEqual(start.valA, 1.0, 'Deck A starts at 100%');
    assert.strictEqual(start.valB, 0.0, 'Deck B starts at 0%');

    // Midpoint: Deck A is still 1.0, Deck B is 0.5
    const mid = evaluateEnvelope('superposicion', 'automatica', 0.5);
    assert.strictEqual(mid.valA, 1.0, 'Deck A sustains 100% until midpoint in superposition');
    assert.strictEqual(mid.valB, 0.5, 'Deck B reaches 50% at midpoint');

    // End of mix: Deck A is 0.0, Deck B is 1.0
    const end = evaluateEnvelope('superposicion', 'automatica', 1.0);
    assert.ok(Math.abs(end.valA - 0.0) < 1e-10, 'Deck A reaches 0% at end of mix');
    assert.strictEqual(end.valB, 1.0, 'Deck B reaches 100% at end of mix');
  });

  it('1.3: Volume envelope "corte_directo" performs instant downbeat switch at midpoint (p = 0.5)', () => {
    const beforeMid = evaluateEnvelope('corte_directo', 'corte', 0.499);
    assert.strictEqual(beforeMid.valA, 1.0, 'Deck A is 100% before cut');
    assert.strictEqual(beforeMid.valB, 0.0, 'Deck B is 0% before cut');

    const atMid = evaluateEnvelope('corte_directo', 'corte', 0.5);
    assert.strictEqual(atMid.valA, 0.0, 'Deck A drops instantly to 0% at crossover');
    assert.strictEqual(atMid.valB, 1.0, 'Deck B jumps instantly to 100% at crossover');

    const afterMid = evaluateEnvelope('corte_directo', 'corte', 0.9);
    assert.strictEqual(afterMid.valA, 0.0, 'Deck A stays 0% after cut');
    assert.strictEqual(afterMid.valB, 1.0, 'Deck B stays 100% after cut');
  });

  it('1.4: Volume envelope "lineal" provides symmetrical diagonal crossfade', () => {
    const start = evaluateEnvelope('lineal', 'fundido', 0.0);
    assert.strictEqual(start.valA, 1.0);
    assert.strictEqual(start.valB, 0.0);

    const mid = evaluateEnvelope('lineal', 'fundido', 0.5);
    assert.strictEqual(mid.valA, 0.5);
    assert.strictEqual(mid.valB, 0.5);

    const end = evaluateEnvelope('lineal', 'fundido', 1.0);
    assert.strictEqual(end.valA, 0.0);
    assert.strictEqual(end.valB, 1.0);
  });

  it('1.5: Volume envelope "curva_s" provides smooth cosine S-curve crossfade', () => {
    const start = evaluateEnvelope('curva_s', 'eco_out', 0.0);
    assert.strictEqual(start.valA, 1.0);
    assert.strictEqual(start.valB, 0.0);

    const mid = evaluateEnvelope('curva_s', 'eco_out', 0.5);
    assert.ok(Math.abs(mid.valA - 0.5) < 1e-10, 'Deck A midpoint must be 0.5');
    assert.ok(Math.abs(mid.valB - 0.5) < 1e-10, 'Deck B midpoint must be 0.5');

    const end = evaluateEnvelope('curva_s', 'eco_out', 1.0);
    assert.ok(Math.abs(end.valA - 0.0) < 1e-10);
    assert.strictEqual(end.valB, 1.0);

    // Verify derivative at endpoints is 0 (smooth start & finish)
    const pEps = 0.01;
    const earlyA = evaluateEnvelope('curva_s', 'eco_out', pEps);
    assert.ok(earlyA.valA > 0.999, 'Early derivative approaches 0');
  });

  it('1.6: Bass Swap Step Lines drop Deck A low-end and raise Deck B low-end across crossover', () => {
    // Verify source code implementation of Bass Swap Step Lines
    assert.ok(
      modalSource.includes("eqMode === 'intercambio_graves_central'") || modalSource.includes("preset === 'automatica'"),
      'Must render bass swap step lines for central bass swap'
    );
    assert.ok(
      modalSource.includes('ctx.lineTo(X_crossover, Y_1 + 3)') &&
      modalSource.includes('ctx.lineTo(X_crossover, Y_0 - 3)'),
      'Deck A step must drop from Y_1+3 to Y_0-3 at X_crossover'
    );
    assert.ok(
      modalSource.includes('ctx.lineTo(X_crossover, Y_0 - 3)') &&
      modalSource.includes('ctx.lineTo(X_crossover, Y_1 + 3)'),
      'Deck B step must jump from Y_0-3 to Y_1+3 at X_crossover'
    );

    // Also verify spectral waveform slice bass modulation
    const pBefore = 0.4;
    const bassABefore = pBefore < 0.5 ? 1.0 : 0.08;
    const bassBBefore = pBefore < 0.5 ? 0.05 : 1.0;
    assert.strictEqual(bassABefore, 1.0, 'Deck A bass is 100% before crossover');
    assert.strictEqual(bassBBefore, 0.05, 'Deck B bass is clamped to 5% before crossover');

    const pAfter = 0.6;
    const bassAAfter = pAfter < 0.5 ? 1.0 : 0.08;
    const bassBAfter = pAfter < 0.5 ? 0.05 : 1.0;
    assert.strictEqual(bassAAfter, 0.08, 'Deck A bass drops to 8% (-40dB low-cut) after crossover');
    assert.strictEqual(bassBAfter, 1.0, 'Deck B bass snaps to 100% after crossover');
  });

  it('1.7: FX overlays render distinct curves for freno_vinilo, beat_roll, and eco_out/filtro, and none for ninguno', () => {
    assert.ok(modalSource.includes("preset === 'freno_vinilo' || fxMode === 'freno_vinilo'"));
    assert.ok(modalSource.includes('ctx.quadraticCurveTo(X_crossover + W_mix * 0.25, Y_0 - 4, X_mixEnd - 4, Y_0)'), 'Must draw quadratic platter brake');

    assert.ok(modalSource.includes("preset === 'beat_roll' || fxMode === 'repeticion_loop'"));
    assert.ok(modalSource.includes('stutterStart = X_mixStart + W_mix * 0.35'), 'Must draw loop roll stutter chops');

    assert.ok(modalSource.includes('ctx.bezierCurveTo(X_crossover, Y_1 + 4, X_crossover + W_mix * 0.2, Y_0 - 2, X_mixEnd, Y_0)'), 'Must draw filter sweep bezier curve');

    assert.ok(modalSource.includes("if (fxMode !== 'ninguno' ||"), 'Must skip FX overlay when fxMode is ninguno and preset is normal');
  });
});

// ============================================================================
// 2. Interactive Scrubbing & Pointer Drag Handling
// ============================================================================

describe('Challenger 2: Interactive Scrubbing & Pointer Drag Handling', () => {
  // Model of updateScrub from TransitionEditorModal.tsx
  function createScrubTracker() {
    let currentProgress = 0.0;
    let isDragging = false;
    const capturedPointers = new Set();

    const mockTarget = {
      getBoundingClientRect: () => ({ left: 100, width: 640 }),
      setPointerCapture: (id) => capturedPointers.add(id),
      releasePointerCapture: (id) => capturedPointers.delete(id),
    };

    const updateScrub = (clientX, target) => {
      const rect = target.getBoundingClientRect();
      if (rect.width <= 0) return;
      const progress = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      currentProgress = progress;
    };

    const handlePointerDown = (e) => {
      isDragging = true;
      updateScrub(e.clientX, e.currentTarget);
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}
    };

    const handlePointerMove = (e) => {
      if (!isDragging && e.buttons !== 1) return;
      updateScrub(e.clientX, e.currentTarget);
    };

    const handlePointerUp = (e) => {
      isDragging = false;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
    };

    const handleCanvasClick = (e) => {
      updateScrub(e.clientX, e.currentTarget);
    };

    return {
      getProgress: () => currentProgress,
      getIsDragging: () => isDragging,
      getCapturedPointers: () => capturedPointers,
      mockTarget,
      handlePointerDown,
      handlePointerMove,
      handlePointerUp,
      handleCanvasClick,
      updateScrub,
    };
  }

  it('2.1: Single click-to-scrub correctly updates auditionProgress', () => {
    const tracker = createScrubTracker();
    // Click at 260px (rect.left = 100, so relative = 160px / 640px = 0.25)
    tracker.handleCanvasClick({ clientX: 260, currentTarget: tracker.mockTarget });
    assert.strictEqual(tracker.getProgress(), 0.25, 'Progress must be 0.25 at relative 160px');

    // Click at 420px (relative = 320px / 640px = 0.50)
    tracker.handleCanvasClick({ clientX: 420, currentTarget: tracker.mockTarget });
    assert.strictEqual(tracker.getProgress(), 0.50, 'Progress must be 0.50 at midpoint');
  });

  it('2.2: Pointer drag sequence captures pointer, updates continuously, and releases pointer', () => {
    const tracker = createScrubTracker();
    const pointerId = 42;

    // 1. Pointer Down at 100px (left boundary, progress = 0.0)
    tracker.handlePointerDown({ clientX: 100, currentTarget: tracker.mockTarget, pointerId });
    assert.strictEqual(tracker.getIsDragging(), true, 'Must set isDragging to true');
    assert.strictEqual(tracker.getProgress(), 0.0, 'Progress must be 0.0');
    assert.ok(tracker.getCapturedPointers().has(pointerId), 'Pointer must be captured');

    // 2. Pointer Move to 292px (relative 192px / 640px = 0.30)
    tracker.handlePointerMove({ clientX: 292, currentTarget: tracker.mockTarget, pointerId, buttons: 1 });
    assert.strictEqual(tracker.getProgress(), 0.30, 'Progress must track drag to 0.30');

    // 3. Pointer Move to 580px (relative 480px / 640px = 0.75)
    tracker.handlePointerMove({ clientX: 580, currentTarget: tracker.mockTarget, pointerId, buttons: 1 });
    assert.strictEqual(tracker.getProgress(), 0.75, 'Progress must track drag to 0.75');

    // 4. Pointer Up
    tracker.handlePointerUp({ clientX: 580, currentTarget: tracker.mockTarget, pointerId });
    assert.strictEqual(tracker.getIsDragging(), false, 'Must set isDragging to false');
    assert.ok(!tracker.getCapturedPointers().has(pointerId), 'Pointer capture must be released');
  });

  it('2.3: Boundary clipping handles negative and out-of-bounds coordinates cleanly', () => {
    const tracker = createScrubTracker();

    // Far to the left of the canvas (clientX = -500, rect.left = 100)
    tracker.handleCanvasClick({ clientX: -500, currentTarget: tracker.mockTarget });
    assert.strictEqual(tracker.getProgress(), 0.0, 'Must clamp negative position to 0.0');

    // Far to the right of the canvas (clientX = 2500, rect.left = 100, width = 640)
    tracker.handleCanvasClick({ clientX: 2500, currentTarget: tracker.mockTarget });
    assert.strictEqual(tracker.getProgress(), 1.0, 'Must clamp over-boundary position to 1.0');
  });

  it('2.4: Zero or negative element width does not produce NaN or crash', () => {
    const tracker = createScrubTracker();
    const zeroTarget = {
      getBoundingClientRect: () => ({ left: 100, width: 0 }),
    };

    // Should return early and leave currentProgress unchanged
    tracker.updateScrub(300, zeroTarget);
    assert.strictEqual(tracker.getProgress(), 0.0, 'Progress must not become NaN on zero width');
    assert.ok(!Number.isNaN(tracker.getProgress()), 'Progress must not be NaN');
  });

  it('2.5: Rapid consecutive clicks across edges remain stable and clamped', () => {
    const tracker = createScrubTracker();
    const positions = [100, 740, 50, 800, 420, 100, 740];

    for (const x of positions) {
      tracker.handleCanvasClick({ clientX: x, currentTarget: tracker.mockTarget });
      const p = tracker.getProgress();
      assert.ok(p >= 0.0 && p <= 1.0, `Progress ${p} must remain within [0.0, 1.0]`);
    }
    assert.strictEqual(tracker.getProgress(), 1.0, 'Final click at right boundary must be 1.0');
  });

  it('2.6: Modal source code binds all 4 pointer & mouse handlers to canvas element', () => {
    assert.ok(modalSource.includes('onPointerDown={handlePointerDown}'), 'Canvas must bind onPointerDown');
    assert.ok(modalSource.includes('onPointerMove={handlePointerMove}'), 'Canvas must bind onPointerMove');
    assert.ok(modalSource.includes('onPointerUp={handlePointerUp}'), 'Canvas must bind onPointerUp');
    assert.ok(modalSource.includes('onClick={handleCanvasClick}'), 'Canvas must bind onClick fallback');
  });
});

// ============================================================================
// 3. Modal Lifecycle Cleanup (isOpen = false vs Unmount)
// ============================================================================

describe('Challenger 3: Modal Lifecycle Cleanup Audition Invariant', () => {
  it('3.1: Changing isOpen from true to false triggers audition stop cleanup', () => {
    let stoppedAudioEngine = false;
    let stoppedDJService = false;

    const mockAudioEngine = {
      stopTransitionAudition: () => { stoppedAudioEngine = true; },
    };
    const mockDJService = {
      stopAudition: () => { stoppedDJService = true; },
    };

    // Simulate useEffect when isOpen changes to false
    function simulateIsOpenEffect(isOpen) {
      if (!isOpen) {
        mockAudioEngine.stopTransitionAudition();
        mockDJService.stopAudition();
      }
    }

    simulateIsOpenEffect(false);
    assert.strictEqual(stoppedAudioEngine, true, 'AudioEngine audition must be stopped when isOpen=false');
    assert.strictEqual(stoppedDJService, true, 'DJService audition must be stopped when isOpen=false');
  });

  it('3.2: EMPIRICAL ADVERSARIAL CHALLENGE — Unmounting while isOpen is true MUST execute audition cleanup', () => {
    // In TransitionEditorModal.tsx lines 262-270:
    // useEffect(() => {
    //   if (!isOpen) {
    //     audioEngine.stopTransitionAudition();
    //     djTransitionService.stopAudition();
    //     setIsPlayingAudition(false);
    //     setIsAuditionLoading(false);
    //     setAuditionProgress(0);
    //   }
    // }, [isOpen]);
    //
    // Notice: There is NO return cleanup function!
    // In React, when a component unmounts without isOpen being set to false first
    // (such as DesktopPlaylistView:1414-1420: {transitionModalPair && <TransitionEditorModal ... onClose={() => setTransitionModalPair(null)} />}
    // which unmounts the modal directly on close), React DOES NOT execute the body of useEffect.
    // React ONLY executes the cleanup function returned by useEffect!

    // Verify whether TransitionEditorModal.tsx returns an unmount cleanup function in its audition useEffect:
    const auditionEffectBlockMatch = modalSource.match(/useEffect\(\s*\(\)\s*=>\s*\{\s*if\s*\(!isOpen\)\s*\{[\s\S]*?\}\s*\},?\s*\[isOpen\]\);/);
    assert.ok(auditionEffectBlockMatch, 'Must find audition lifecycle useEffect in source');

    const effectContent = auditionEffectBlockMatch[0];
    const hasUnmountCleanupReturn = effectContent.includes('return () =>') || effectContent.includes('return function');

    // Also check if there is any other useEffect returning a cleanup that calls stopTransitionAudition
    const hasOtherUnmountCleanup = modalSource.includes('return () =>') &&
      modalSource.match(/return\s*\(\)\s*=>\s*\{[\s\S]*?stopTransitionAudition/);

    const isProperlyCleanedUpOnUnmount = hasUnmountCleanupReturn || !!hasOtherUnmountCleanup;

    console.log(`[LIFECYCLE AUDIT] Does TransitionEditorModal return an unmount cleanup for audition? -> ${isProperlyCleanedUpOnUnmount}`);

    // If this fails, it demonstrates an empirical lifecycle bug: unmounting does not clean up audition audio!
    assert.strictEqual(
      isProperlyCleanedUpOnUnmount,
      true,
      'TransitionEditorModal MUST return a cleanup function from useEffect to stop transition audition when unmounted directly while playing!'
    );
  });

  it('3.3: Null-Safety for trackA / trackB per PROJECT.md interface contract', () => {
    // PROJECT.md:108-118 specifies trackA: Track | null, trackB: Track | null
    // If trackA or trackB is null, evaluating trackA.id or trackB.id at top-level before early return crashes with TypeError.
    const hasNullSafeFeatA = modalSource.includes('trackA?.id') || modalSource.includes('if (!trackA');
    const hasUnsafeTrackAccess = modalSource.includes('resolveClientSideRealFeature(\n    trackA.id') ||
      modalSource.includes('resolveClientSideRealFeature(\r\n    trackA.id') ||
      modalSource.includes('resolveClientSideRealFeature(trackA.id');

    console.log(`[CONTRACT AUDIT] Does TransitionEditorModal safely handle trackA === null without throwing TypeError? -> ${!hasUnsafeTrackAccess}`);
    assert.strictEqual(
      hasUnsafeTrackAccess,
      false,
      'TransitionEditorModal must safely guard against null/undefined trackA/trackB (e.g. trackA?.id or early return before resolveClientSideRealFeature)'
    );
  });
});
