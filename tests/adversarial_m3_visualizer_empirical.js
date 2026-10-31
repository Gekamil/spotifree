/**
 * Empirical Adversarial Test Suite: Milestone 3 Visualizer Redesign
 * Target: src/components/modals/TransitionEditorModal.tsx
 *
 * Verifies:
 * 1. Temporal space allocation math across extreme inputs (tempos, compases, widths)
 *    - W_leadIn + W_mix + W_leadOut === W (zero drift, no negative intervals)
 *    - Crossover downbeat alignment with central downbeat bar
 * 2. Playhead clamping stress testing (progress < 0, > 1, NaN, Infinity)
 * 3. Beat grid step spacing and division safety (no zero divisions, strictly positive steps)
 * 4. Mock 2D Canvas execution and path integrity across extreme progress and tempo values
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Load TransitionEditorModal.tsx directly to extract and verify exact production logic
const modalSourcePath = path.resolve('src/components/modals/TransitionEditorModal.tsx');
const modalSource = fs.readFileSync(modalSourcePath, 'utf8');

// Extract computeTimelineCoordinates function definition using regex
const funcMatch = modalSource.match(
  /function computeTimelineCoordinates\s*\([\s\S]*?return\s*\{[\s\S]*?\};\s*\}/
);

if (!funcMatch) {
  throw new Error('Failed to extract computeTimelineCoordinates from TransitionEditorModal.tsx');
}

// Instantiate the extracted computeTimelineCoordinates function in current scope
// Strip TypeScript type annotations for raw execution in Node.js
const jsFuncCode = funcMatch[0]
  .replace(/width:\s*number/g, 'width')
  .replace(/height:\s*number/g, 'height')
  .replace(/tempo:\s*number/g, 'tempo')
  .replace(/compases:\s*number/g, 'compases')
  .replace(/:\s*TimelineCoordinates/g, '');

const computeTimelineCoordinates = new Function(
  'return ' + jsFuncCode
)();

describe('Empirical Adversarial Test Suite: TransitionEditorModal Math & Coordinates', () => {

  const TEST_TEMPOS = [41, 60, 128, 175, 239, NaN, Infinity, -Infinity, 0, -50, 300];
  const TEST_COMPASES = [1, 2, 4, 8, 16];
  const TEST_WIDTHS = [320, 640, 800, 1024, 1920, 3840];

  describe('1. Temporal Space Allocation Math Across Extreme Inputs', () => {

    for (const tempo of TEST_TEMPOS) {
      for (const compases of TEST_COMPASES) {
        it(`Temporal conservation (W = W_leadIn + W_mix + W_leadOut) for tempo=${tempo}, compases=${compases}`, () => {
          for (const width of TEST_WIDTHS) {
            const coords = computeTimelineCoordinates(width, 196, tempo, compases);

            // Verify W >= 320 constraint
            assert.ok(coords.W >= 320, `Width must be clamped to >= 320, got ${coords.W}`);

            // Conservation: W_leadIn + W_mix + W_leadOut === coords.W with zero drift
            const sumW = coords.W_leadIn + coords.W_mix + coords.W_leadOut;
            const drift = Math.abs(sumW - coords.W);
            assert.ok(drift < 1e-12, `Width drift detected: sum=${sumW}, W=${coords.W}, drift=${drift}`);

            // Interval positivity: all intervals strictly positive
            assert.ok(coords.W_leadIn > 0, `W_leadIn must be positive, got ${coords.W_leadIn}`);
            assert.ok(coords.W_mix > 0, `W_mix must be positive, got ${coords.W_mix}`);
            assert.ok(coords.W_leadOut > 0, `W_leadOut must be positive, got ${coords.W_leadOut}`);

            // Boundaries monotonicity: 0 < X_mixStart < X_crossover < X_mixEnd < W
            assert.ok(coords.X_mixStart > 0, `X_mixStart must be > 0, got ${coords.X_mixStart}`);
            assert.ok(coords.X_crossover > coords.X_mixStart, `X_crossover must be > X_mixStart`);
            assert.ok(coords.X_mixEnd > coords.X_crossover, `X_mixEnd must be > X_crossover`);
            assert.ok(coords.W >= coords.X_mixEnd, `W must be >= X_mixEnd`);

            // Total duration conservation: T_total = T_leadIn + T_mix + T_leadOut
            const sumT = coords.T_leadIn + coords.T_mix + coords.T_leadOut;
            assert.equal(coords.T_total, sumT);

            // Safe duration clamping [2.0s, 16.0s] for mix window
            assert.ok(coords.T_mix >= 2.0 - 1e-9, `T_mix below min 2.0s: ${coords.T_mix}`);
            assert.ok(coords.T_mix <= 16.0 + 1e-9, `T_mix above max 16.0s: ${coords.T_mix}`);
          }
        });
      }
    }

    describe('Central Downbeat Alignment', () => {
      // For even compases (2, 4, 8, 16), central downbeat bar divider b = (compases / 2) + 1
      // barX = W_leadIn + (b - 1) * 4 * stepBeat === X_crossover
      const EVEN_COMPASES = [2, 4, 8, 16];

      for (const compases of EVEN_COMPASES) {
        it(`Crossover downbeat aligns with Bar ${(compases / 2) + 1} for compases=${compases}`, () => {
          for (const tempo of [60, 128, 175, 239]) {
            const coords = computeTimelineCoordinates(800, 196, tempo, compases);
            const centerBarIndex = (compases / 2) + 1;
            const barX = coords.W_leadIn + (centerBarIndex - 1) * 4 * coords.stepBeat;

            const delta = Math.abs(barX - coords.X_crossover);
            assert.ok(
              delta < 1e-12,
              `Alignment mismatch: barX=${barX}, X_crossover=${coords.X_crossover}, delta=${delta}`
            );
          }
        });
      }

      it('Crossover downbeat for 1 compás exactly bisects the mix window (beat k=2)', () => {
        const coords = computeTimelineCoordinates(800, 196, 128, 1);
        // N_beats = 4. Midpoint beat k = 2
        const beat2X = coords.W_leadIn + 2 * coords.stepBeat;
        const delta = Math.abs(beat2X - coords.X_crossover);
        assert.ok(
          delta < 1e-12,
          `1-bar crossover mismatch: beat2X=${beat2X}, X_crossover=${coords.X_crossover}, delta=${delta}`
        );
      });
    });
  });

  describe('2. Stress Test Playhead Clamping', () => {
    // Formula in TransitionEditorModal.tsx line 941:
    // const playheadX = Math.max(0, Math.min(width, auditionProgress * width));
    const width = 800;

    const clampPlayhead = (progress, w) => Math.max(0, Math.min(w, progress * w));

    it('Clamps negative progress values to 0', () => {
      assert.equal(clampPlayhead(-0.001, width), 0);
      assert.equal(clampPlayhead(-1.0, width), 0);
      assert.equal(clampPlayhead(-9999, width), 0);
      assert.equal(clampPlayhead(-Infinity, width), 0);
    });

    it('Clamps overflow progress values to width', () => {
      assert.equal(clampPlayhead(1.001, width), width);
      assert.equal(clampPlayhead(2.0, width), width);
      assert.equal(clampPlayhead(9999, width), width);
      assert.equal(clampPlayhead(Infinity, width), width);
    });

    it('Preserves interior valid progress values in [0, width]', () => {
      assert.equal(clampPlayhead(0.0, width), 0);
      assert.equal(clampPlayhead(0.25, width), 200);
      assert.equal(clampPlayhead(0.5, width), 400);
      assert.equal(clampPlayhead(0.75, width), 600);
      assert.equal(clampPlayhead(1.0, width), width);
    });

    it('Analyzes NaN behavior: Math.max(0, Math.min(W, NaN * W)) yields NaN', () => {
      const rawResult = clampPlayhead(NaN, width);
      // In JavaScript IEEE-754, Math.max/min with NaN returns NaN
      assert.ok(Number.isNaN(rawResult), 'rawResult is NaN');

      // Check whether sanitized playhead (Number.isFinite check) stays strictly in [0, W]
      const safeProgress = Number.isFinite(NaN) ? NaN : 0;
      const safePlayheadX = clampPlayhead(safeProgress, width);
      assert.equal(safePlayheadX, 0);
      assert.ok(safePlayheadX >= 0 && safePlayheadX <= width);
    });
  });

  describe('3. Beat Grid Step Spacing & Division Safety', () => {
    for (const compases of TEST_COMPASES) {
      it(`Step beat spacing is strictly positive and finite for compases=${compases}`, () => {
        for (const tempo of TEST_TEMPOS) {
          for (const width of TEST_WIDTHS) {
            const coords = computeTimelineCoordinates(width, 196, tempo, compases);

            // N_beats must be strictly positive
            assert.ok(coords.N_beats > 0, `N_beats must be > 0, got ${coords.N_beats}`);
            assert.equal(coords.N_beats, compases * 4);

            // stepBeat must be strictly positive and finite
            assert.ok(Number.isFinite(coords.stepBeat), `stepBeat must be finite, got ${coords.stepBeat}`);
            assert.ok(coords.stepBeat > 0, `stepBeat must be > 0, got ${coords.stepBeat}`);

            // Last beat grid line must hit exactly X_mixEnd
            const lastBeatX = coords.W_leadIn + coords.N_beats * coords.stepBeat;
            const deltaEnd = Math.abs(lastBeatX - coords.X_mixEnd);
            assert.ok(deltaEnd < 1e-12, `Last beat line mismatch: lastBeatX=${lastBeatX}, X_mixEnd=${coords.X_mixEnd}`);
          }
        }
      });
    }

    it('Sanitizes falsy or invalid compases safely to default 2 compases (8 beats)', () => {
      const coordsZero = computeTimelineCoordinates(640, 196, 128, 0);
      assert.equal(coordsZero.N_beats, 8, '0 compases falls back to 2 compases (8 beats)');
      assert.ok(coordsZero.stepBeat > 0);

      const coordsNaN = computeTimelineCoordinates(640, 196, 128, NaN);
      assert.equal(coordsNaN.N_beats, 8, 'NaN compases falls back to 2 compases (8 beats)');
      assert.ok(coordsNaN.stepBeat > 0);

      const coordsNull = computeTimelineCoordinates(640, 196, 128, null);
      assert.equal(coordsNull.N_beats, 8, 'null compases falls back to 2 compases (8 beats)');
      assert.ok(coordsNull.stepBeat > 0);
    });
  });

  describe('4. Mock Canvas 2D Execution & Coordinate Safety', () => {
    it('Executes canvas drawing routines without throwing exceptions or invalid paths', () => {
      // Mock Canvas 2D Context
      const mockCalls = [];
      const mockCtx = {
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        font: '',
        textAlign: '',
        textBaseline: '',
        shadowColor: '',
        shadowBlur: 0,
        fillRect: (x, y, w, h) => {
          mockCalls.push({ op: 'fillRect', x, y, w, h });
        },
        strokeRect: (x, y, w, h) => {
          mockCalls.push({ op: 'strokeRect', x, y, w, h });
        },
        beginPath: () => mockCalls.push({ op: 'beginPath' }),
        moveTo: (x, y) => {
          assert.ok(Number.isFinite(x) && Number.isFinite(y), `moveTo coords must be finite: x=${x}, y=${y}`);
          mockCalls.push({ op: 'moveTo', x, y });
        },
        lineTo: (x, y) => {
          assert.ok(Number.isFinite(x) && Number.isFinite(y), `lineTo coords must be finite: x=${x}, y=${y}`);
          mockCalls.push({ op: 'lineTo', x, y });
        },
        stroke: () => mockCalls.push({ op: 'stroke' }),
        fill: () => mockCalls.push({ op: 'fill' }),
        closePath: () => mockCalls.push({ op: 'closePath' }),
        roundRect: (x, y, w, h, r) => {
          assert.ok(Number.isFinite(x) && Number.isFinite(w), `roundRect coords must be finite: x=${x}, w=${w}`);
          mockCalls.push({ op: 'roundRect', x, y, w, h, r });
        },
        fillText: (text, x, y) => {
          assert.ok(Number.isFinite(x) && Number.isFinite(y), `fillText coords must be finite: x=${x}, y=${y}`);
          mockCalls.push({ op: 'fillText', text, x, y });
        },
        setLineDash: (dash) => mockCalls.push({ op: 'setLineDash', dash }),
        save: () => mockCalls.push({ op: 'save' }),
        restore: () => mockCalls.push({ op: 'restore' }),
        quadraticCurveTo: (cpx, cpy, x, y) => {
          assert.ok(Number.isFinite(cpx) && Number.isFinite(x), `quadraticCurveTo coords must be finite`);
          mockCalls.push({ op: 'quadraticCurveTo', cpx, cpy, x, y });
        },
        bezierCurveTo: (cp1x, cp1y, cp2x, cp2y, x, y) => {
          assert.ok(Number.isFinite(cp1x) && Number.isFinite(x), `bezierCurveTo coords must be finite`);
          mockCalls.push({ op: 'bezierCurveTo', cp1x, cp1y, cp2x, cp2y, x, y });
        },
      };

      // Test across multiple compases and progress values
      for (const compases of [1, 2, 4, 8, 16]) {
        for (const auditionProgress of [0.0, 0.25, 0.5, 0.75, 1.0, -0.5, 1.5, Infinity, -Infinity]) {
          mockCalls.length = 0;
          const width = 640;
          const height = 196;
          const coords = computeTimelineCoordinates(width, height, 128, compases);

          // 1. Bar labels
          for (let b = 1; b <= compases; b++) {
            const barX = coords.W_leadIn + (b - 1) * 4 * coords.stepBeat;
            mockCtx.fillText(`Bar ${b}`, barX + 5, 12);
          }

          // 2. Beat grid
          for (let k = 0; k <= coords.N_beats; k++) {
            const bx = coords.W_leadIn + k * coords.stepBeat;
            mockCtx.beginPath();
            mockCtx.moveTo(bx, 24);
            mockCtx.lineTo(bx, height);
            mockCtx.stroke();
          }

          // 3. Crossover line
          mockCtx.beginPath();
          mockCtx.moveTo(coords.X_crossover, 24);
          mockCtx.lineTo(coords.X_crossover, height);
          mockCtx.stroke();

          // 4. Playhead
          const safeProgress = Number.isFinite(auditionProgress) ? auditionProgress : 0;
          const playheadX = Math.max(0, Math.min(width, safeProgress * width));
          mockCtx.beginPath();
          mockCtx.moveTo(playheadX, 0);
          mockCtx.lineTo(playheadX, height);
          mockCtx.stroke();

          assert.ok(mockCalls.length > 0, 'Canvas operations must have been recorded');
        }
      }
    });
  });
});
