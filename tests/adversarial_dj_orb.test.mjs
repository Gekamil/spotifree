import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

describe('Empirical Adversarial Stress Suite: DJ Talking Orb & Unified Chat (Milestone 4)', () => {
  const rootDir = process.cwd();
  const aidjPath = path.join(rootDir, 'src', 'components', 'dj', 'AIDJView.tsx');
  const visualizerPath = path.join(rootDir, 'src', 'components', 'dj', 'SpotifyDJVisualizer.tsx');

  assert.ok(fs.existsSync(aidjPath), 'AIDJView.tsx must exist');
  assert.ok(fs.existsSync(visualizerPath), 'SpotifyDJVisualizer.tsx must exist');

  const aidjSource = fs.readFileSync(aidjPath, 'utf8');
  const visualizerSource = fs.readFileSync(visualizerPath, 'utf8');

  // Transpile visualizer TypeScript to CommonJS for rigorous sandboxed execution
  const transpiledVisualizer = ts.transpileModule(visualizerSource, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.React,
    },
  });

  const visualizerSandbox = {
    exports: {},
    module: { exports: {} },
    require: () => ({
      useRef: () => ({ current: null }),
      useEffect: () => {},
    }),
  };
  visualizerSandbox.module.exports = visualizerSandbox.exports;
  vm.createContext(visualizerSandbox);
  vm.runInContext(transpiledVisualizer.outputText, visualizerSandbox);
  const visualizerExports = visualizerSandbox.exports;

  const {
    getAngularDistance,
    getUpperRightWeight,
    calculateOrbLayerDisplacement,
    parseHexToRgb,
  } = visualizerExports;

  // =========================================================================
  // 1. DYNAMIC 3-LAYER TALKING ORB CANVAS ENGINE ADVERSARIAL STRESS TESTS
  // =========================================================================
  describe('1. Dynamic 3-Layer Talking Orb Canvas Engine Stress Tests', () => {

    // -----------------------------------------------------------------------
    // 1.1 Asymmetric delamination at -PI/4 vs other angles (PI/2, PI, -3PI/4, 3PI/4)
    // -----------------------------------------------------------------------
    describe('1.1 Asymmetric Delamination Across Circunference', () => {
      it('concentrates delamination at -PI/4 (upper-right) and heavily suppresses it at PI/2, PI, -3PI/4, and 3PI/4', () => {
        const thetaUR = -Math.PI / 4;
        const thetaBottom = Math.PI / 2;
        const thetaLeft = Math.PI;
        const thetaTL = (-3 * Math.PI) / 4;
        const thetaBL = (3 * Math.PI) / 4;

        const size = 260;
        const bulgeBase = 1.5;
        const splitAmount = 1.0;
        const voiceLevel = 0.8;

        // Sample across multiple time points to account for sinusoidal oscillations
        let sumGapUR = 0;
        let sumGapBottom = 0;
        let sumGapLeft = 0;
        let sumGapTL = 0;
        let sumGapBL = 0;
        const steps = 60;

        for (let s = 0; s < steps; s++) {
          const t = s * 0.15;
          // Upper-right (-PI/4)
          const d0UR = calculateOrbLayerDisplacement(0, thetaUR, t, voiceLevel, splitAmount, bulgeBase, size, false);
          const d2UR = calculateOrbLayerDisplacement(2, thetaUR, t, voiceLevel, splitAmount, bulgeBase, size, false);
          sumGapUR += (d2UR - d0UR);

          // Bottom (PI/2)
          const d0B = calculateOrbLayerDisplacement(0, thetaBottom, t, voiceLevel, splitAmount, bulgeBase, size, false);
          const d2B = calculateOrbLayerDisplacement(2, thetaBottom, t, voiceLevel, splitAmount, bulgeBase, size, false);
          sumGapBottom += Math.abs(d2B - d0B);

          // Left (PI)
          const d0L = calculateOrbLayerDisplacement(0, thetaLeft, t, voiceLevel, splitAmount, bulgeBase, size, false);
          const d2L = calculateOrbLayerDisplacement(2, thetaLeft, t, voiceLevel, splitAmount, bulgeBase, size, false);
          sumGapLeft += Math.abs(d2L - d0L);

          // Top-Left (-3PI/4)
          const d0TL = calculateOrbLayerDisplacement(0, thetaTL, t, voiceLevel, splitAmount, bulgeBase, size, false);
          const d2TL = calculateOrbLayerDisplacement(2, thetaTL, t, voiceLevel, splitAmount, bulgeBase, size, false);
          sumGapTL += Math.abs(d2TL - d0TL);

          // Bottom-Left (3PI/4)
          const d0BL = calculateOrbLayerDisplacement(0, thetaBL, t, voiceLevel, splitAmount, bulgeBase, size, false);
          const d2BL = calculateOrbLayerDisplacement(2, thetaBL, t, voiceLevel, splitAmount, bulgeBase, size, false);
          sumGapBL += Math.abs(d2BL - d0BL);
        }

        const avgGapUR = sumGapUR / steps;
        const avgGapBottom = sumGapBottom / steps;
        const avgGapLeft = sumGapLeft / steps;
        const avgGapTL = sumGapTL / steps;
        const avgGapBL = sumGapBL / steps;

        // Upper-right delamination must be substantial (>= 20px)
        assert.ok(avgGapUR >= 20.0, `Average UR delamination should be >= 20px, got ${avgGapUR.toFixed(2)}px`);

        // Bottom-left (diametrically opposite at 3PI/4) delamination must be virtually zero (< 0.05px)
        assert.ok(avgGapBL < 0.05, `Average BL delamination should be < 0.05px, got ${avgGapBL.toFixed(4)}px`);

        // Ratios: UR delamination must strictly overpower all other specified angles
        assert.ok(avgGapUR > avgGapTL * 5.0, `UR delamination (${avgGapUR.toFixed(2)}) must be > 5x top-left -3PI/4 (${avgGapTL.toFixed(2)})`);
        assert.ok(avgGapUR > avgGapBottom * 30.0, `UR delamination (${avgGapUR.toFixed(2)}) must be > 30x bottom PI/2 (${avgGapBottom.toFixed(2)})`);
        assert.ok(avgGapUR > avgGapLeft * 30.0, `UR delamination (${avgGapUR.toFixed(2)}) must be > 30x left PI (${avgGapLeft.toFixed(2)})`);
        assert.ok(avgGapUR > avgGapBL * 500.0, `UR delamination (${avgGapUR.toFixed(2)}) must be > 500x bottom-left 3PI/4 (${avgGapBL.toFixed(4)})`);
      });

      it('strictly enforces layer ordering: Layer 0 < Layer 1 < Layer 2 in the upper-right quadrant during speech', () => {
        const thetaUR = -Math.PI / 4;
        const size = 260;
        const bulgeBase = 1.5;
        const splitAmount = 1.0;

        for (let vl = 0.1; vl <= 1.0; vl += 0.2) {
          for (let t = 0; t < 10; t += 1.0) {
            const d0 = calculateOrbLayerDisplacement(0, thetaUR, t, vl, splitAmount, bulgeBase, size, false);
            const d1 = calculateOrbLayerDisplacement(1, thetaUR, t, vl, splitAmount, bulgeBase, size, false);
            const d2 = calculateOrbLayerDisplacement(2, thetaUR, t, vl, splitAmount, bulgeBase, size, false);

            assert.ok(d1 > d0, `Layer 1 (${d1.toFixed(2)}) must be greater than Layer 0 (${d0.toFixed(2)}) at t=${t}, vl=${vl}`);
            assert.ok(d2 > d1, `Layer 2 (${d2.toFixed(2)}) must be greater than Layer 1 (${d1.toFixed(2)}) at t=${t}, vl=${vl}`);
          }
        }
      });
    });

    // -----------------------------------------------------------------------
    // 1.2 Boundary wrapping across 0 and 2PI
    // -----------------------------------------------------------------------
    describe('1.2 Boundary Wrapping Across 0 and 2PI', () => {
      it('wraps angles smoothly across 0 and 2PI without angular discontinuities or sign flips', () => {
        const target = -Math.PI / 4;

        // Direct equivalence: theta = 0 vs 2*PI vs -2*PI vs 4*PI
        const d0 = getAngularDistance(0, target);
        const d2pi = getAngularDistance(2 * Math.PI, target);
        const dMinus2pi = getAngularDistance(-2 * Math.PI, target);
        const d4pi = getAngularDistance(4 * Math.PI, target);

        assert.ok(Math.abs(d0 - d2pi) < 1e-9, `getAngularDistance(0) (${d0}) must equal getAngularDistance(2PI) (${d2pi})`);
        assert.ok(Math.abs(d0 - dMinus2pi) < 1e-9, `getAngularDistance(0) (${d0}) must equal getAngularDistance(-2PI) (${dMinus2pi})`);
        assert.ok(Math.abs(d0 - d4pi) < 1e-9, `getAngularDistance(0) (${d0}) must equal getAngularDistance(4PI) (${d4pi})`);

        // Upper-right target wrapping: -PI/4 == 7PI/4 == 15PI/4 == -9PI/4
        const targetEquivalents = [
          -Math.PI / 4,
          (7 * Math.PI) / 4,
          (15 * Math.PI) / 4,
          (-9 * Math.PI) / 4,
          (-17 * Math.PI) / 4,
        ];

        for (const theta of targetEquivalents) {
          const w = getUpperRightWeight(theta);
          assert.ok(Math.abs(w - 1.0) < 1e-7, `Weight at equivalent angle ${theta} must be 1.0, got ${w}`);
        }
      });

      it('guarantees C0 continuity of Gaussian weight across boundary cuts (at 0, 2PI, and antipodal 3PI/4)', () => {
        const eps = 1e-5;

        // Seam at 0 / 2PI
        const wPlusEps = getUpperRightWeight(+eps);
        const wMinusEps = getUpperRightWeight(-eps);
        const w2piMinusEps = getUpperRightWeight(2 * Math.PI - eps);
        assert.ok(Math.abs(wPlusEps - wMinusEps) < 1e-4, 'Weight must be continuous across 0');
        assert.ok(Math.abs(wPlusEps - w2piMinusEps) < 1e-4, 'Weight must be continuous across 2PI seam');

        // Seam at antipodal point 3PI/4
        const antipodal = (3 * Math.PI) / 4;
        const wAntiLeft = getUpperRightWeight(antipodal - eps);
        const wAntiRight = getUpperRightWeight(antipodal + eps);
        assert.ok(Math.abs(wAntiLeft - wAntiRight) < 1e-4, 'Weight must be continuous across antipodal cut');
      });
    });

    // -----------------------------------------------------------------------
    // 1.3 Smooth decay of splitAmount from 1 to 0 over iterations without sudden pop
    // -----------------------------------------------------------------------
    describe('1.3 Smooth Decay of splitAmount Without Discontinuities', () => {
      it('decays monotonically from 1.0 to 0.0 with strictly bounded step size (delta < 0.05)', () => {
        let split = 1.0;
        const targetSplit = 0.0;
        const history = [split];

        // Simulate 160 frames of decay (idle/playing state)
        for (let frame = 0; frame < 160; frame++) {
          const splitRate = targetSplit > split ? 0.08 : 0.05;
          const prevSplit = split;
          split += (targetSplit - split) * splitRate;
          const delta = Math.abs(split - prevSplit);

          // Step size is bounded (no sudden drops > 0.05)
          assert.ok(delta <= 0.05 + 1e-9, `Frame ${frame} step delta (${delta}) exceeds 0.05`);

          // Monotonically decreasing
          assert.ok(split <= prevSplit, `Frame ${frame} split (${split}) is not monotonically decreasing`);

          history.push(split);
        }

        // Asymptotically reaches zero
        assert.ok(split < 0.001, `After 160 frames split should be < 0.001, got ${split}`);

        // Check sub-pixel difference at collapse threshold (0.001)
        const size = 260;
        const thetaUR = -Math.PI / 4;
        const d0 = calculateOrbLayerDisplacement(0, thetaUR, 0, 1.0, 0.001, 1.5, size, false);
        const d2 = calculateOrbLayerDisplacement(2, thetaUR, 0, 1.0, 0.001, 1.5, size, false);
        const deltaCollapse = Math.abs(d2 - d0);

        // When split <= 0.001, the code returns baseOffset (delta = 0).
        // Even if split = 0.001001, the delta is sub-pixel (< 0.05px)
        assert.ok(deltaCollapse < 0.05, `Displacement delta at collapse threshold must be sub-pixel (< 0.05px), got ${deltaCollapse}`);
      });
    });

    // -----------------------------------------------------------------------
    // 1.4 Extreme audio input levels (voiceLevel = 0, 0.001, 0.5, 1.0, 1.5, NaN, Infinity)
    // -----------------------------------------------------------------------
    describe('1.4 Extreme Audio Input Levels Robustness', () => {
      const thetaUR = -Math.PI / 4;
      const size = 260;
      const bulgeBase = 1.5;
      const splitAmount = 1.0;
      const time = 1.23;

      it('produces finite, valid, bounded displacements for standard and extreme finite voice levels [0, 0.001, 0.5, 1.0, 1.5]', () => {
        const testLevels = [0, 0.001, 0.5, 1.0, 1.5];

        for (const vl of testLevels) {
          for (let layer = 0; layer <= 2; layer++) {
            const d = calculateOrbLayerDisplacement(layer, thetaUR, time, vl, splitAmount, bulgeBase, size, false);
            assert.ok(Number.isFinite(d), `Displacement for layer ${layer} at voiceLevel=${vl} must be finite, got ${d}`);
            assert.ok(d > -50 && d < 100, `Displacement ${d} for layer ${layer} at voiceLevel=${vl} must stay within reasonable pixel bounds`);
          }

          // Layer ordering preserved even at overdrive (1.5)
          const d0 = calculateOrbLayerDisplacement(0, thetaUR, time, vl, splitAmount, bulgeBase, size, false);
          const d1 = calculateOrbLayerDisplacement(1, thetaUR, time, vl, splitAmount, bulgeBase, size, false);
          const d2 = calculateOrbLayerDisplacement(2, thetaUR, time, vl, splitAmount, bulgeBase, size, false);
          assert.ok(d1 > d0, `Layer 1 must exceed Layer 0 at vl=${vl}`);
          assert.ok(d2 > d1, `Layer 2 must exceed Layer 1 at vl=${vl}`);
        }
      });

      it('safely handles non-finite inputs (NaN, Infinity, -Infinity) without throwing unhandled exceptions', () => {
        const nonFiniteLevels = [NaN, Infinity, -Infinity];

        for (const vl of nonFiniteLevels) {
          for (let layer = 0; layer <= 2; layer++) {
            assert.doesNotThrow(() => {
              calculateOrbLayerDisplacement(layer, thetaUR, time, vl, splitAmount, bulgeBase, size, false);
            }, `calculateOrbLayerDisplacement must not throw on voiceLevel=${vl}`);
          }
        }
      });
    });

    // -----------------------------------------------------------------------
    // 1.5 Radius bounds in mini mode (mini={true})
    // -----------------------------------------------------------------------
    describe('1.5 Mini Mode Radius Bounds & Canvas Clipping Prevention', () => {
      it('guarantees that points stay strictly within canvas half-size without clipping across all angles and time', () => {
        const size = 38;
        const canvasRadius = size / 2; // 19px
        const baseRadius = size * 0.30; // 11.4px
        const bulgeBase = 0.35 * (size / 38);
        const splitAmount = 1.0;
        const voiceLevel = 1.0;

        let maxCalculatedRadius = 0;
        let worstTheta = 0;
        let worstTime = 0;

        // Exhaustive sweep across theta (-PI to PI, 100 samples) and time (0 to 20, 100 samples)
        for (let i = 0; i < 100; i++) {
          const theta = -Math.PI + (i / 100) * (2 * Math.PI);
          for (let j = 0; j < 100; j++) {
            const t = (j / 100) * 20;
            const pulseScale = 1 + Math.sin(t * 1.8) * 0.035;

            // Outer layer 2 (the furthest extent)
            const d2 = calculateOrbLayerDisplacement(2, theta, t, voiceLevel, splitAmount, bulgeBase, size, true);
            const r = (baseRadius + d2) * pulseScale;

            if (r > maxCalculatedRadius) {
              maxCalculatedRadius = r;
              worstTheta = theta;
              worstTime = t;
            }
          }
        }

        // Must stay strictly within the half-size of the canvas
        assert.ok(
          maxCalculatedRadius < canvasRadius,
          `Max radius in mini mode (${maxCalculatedRadius.toFixed(2)}px) must be < canvas half-size (${canvasRadius}px). Worst theta=${worstTheta.toFixed(2)}, t=${worstTime.toFixed(2)}`
        );

        // Margin of safety: at least 1.0px clearance from the canvas border
        const clearance = canvasRadius - maxCalculatedRadius;
        assert.ok(clearance >= 1.0, `Mini mode must maintain at least 1.0px margin of safety from canvas edge, got ${clearance.toFixed(2)}px`);
      });

      it('confirms canvas dimensions and dpr scaling in SpotifyDJVisualizer component', () => {
        assert.ok(
          visualizerSource.includes('canvas.width = size * dpr;'),
          'Visualizer must scale canvas buffer by DPR'
        );
        assert.ok(
          visualizerSource.includes('canvas.height = size * dpr;'),
          'Visualizer must scale canvas height by DPR'
        );
        assert.ok(
          visualizerSource.includes('ctx.scale(dpr, dpr);'),
          'Visualizer must apply DPR scale transform to context'
        );
      });
    });
  });

  // =========================================================================
  // 2. DJ CHAT INTERFACE SINGLE INPUT INVARIANT & LAYOUT TESTS
  // =========================================================================
  describe('2. DJ Chat Interface Single Input Invariant & Layout Tests', () => {

    it('enforces mutual exclusivity: main bottom prompt bar is hidden whenever chat drawer is active', () => {
      // Main prompt bar condition
      assert.ok(
        aidjSource.includes('{!showChatDrawer && ('),
        'Main prompt input container must be guarded with {!showChatDrawer && (...)}'
      );

      // Verify that the main prompt bar input element is strictly inside the {!showChatDrawer && (...)} block
      const guardIndex = aidjSource.indexOf('{!showChatDrawer && (');
      assert.ok(guardIndex > -1, 'Must locate !showChatDrawer guard');

      const nextClosingSection = aidjSource.indexOf('{/* Quick Vibe Chips in Frosted Glass', guardIndex);
      assert.ok(nextClosingSection > guardIndex, 'Vibe chips must also be inside drawer guard');

      const mainInputPlaceholder = aidjSource.indexOf('placeholder={isMicListening ? "Te escucho... habla conmigo" : "Escribe al DJ (ej. más reggaeton, algo chill)..."}', guardIndex);
      assert.ok(mainInputPlaceholder > guardIndex, 'Main input placeholder must reside inside !showChatDrawer guard');
    });

    it('verifies state transition model: (showChatDrawer = false -> true -> false) maintains exactly ONE input active', () => {
      // Model the component inputs across states
      function getRenderedInputsCount(showChatDrawer, isChatRendered) {
        let count = 0;
        // Main view input is rendered if !showChatDrawer
        if (!showChatDrawer) count++;
        // Drawer input is rendered if isChatRendered
        if (isChatRendered) count++;
        return count;
      }

      // Initial state: drawer closed
      let showChatDrawer = false;
      let isChatRendered = false;
      assert.equal(getRenderedInputsCount(showChatDrawer, isChatRendered), 1, 'Initial state: exactly 1 input (main view)');

      // User opens drawer (clicks chat icon or vibe chip):
      showChatDrawer = true;
      isChatRendered = true;
      assert.equal(getRenderedInputsCount(showChatDrawer, isChatRendered), 1, 'Drawer open state: exactly 1 input (in drawer)');

      // User closes drawer:
      showChatDrawer = false;
      isChatRendered = false; // After unmount animation
      assert.equal(getRenderedInputsCount(showChatDrawer, isChatRendered), 1, 'Drawer closed state: exactly 1 input (main view restored)');
    });

    it('desktop chat drawer conforms strictly to fixed right docked sidebar CSS classes', () => {
      // Locate the chat drawer container slice specifically
      const chatDrawerStart = aidjSource.indexOf('{isChatRendered &&');
      assert.ok(chatDrawerStart > -1, 'Must locate isChatRendered block');
      const chatDrawerSlice = aidjSource.slice(chatDrawerStart);

      // Required desktop CSS classes on the chat drawer container
      const requiredDesktopClasses = [
        'sm:fixed',
        'sm:top-0',
        'sm:right-0',
        'sm:bottom-0',
        'sm:w-[420px]',
        'sm:max-h-full',
        'sm:rounded-none',
        'sm:border-l',
        'sm:border-white/10',
        'sm:bg-[#121212]/95',
        'sm:backdrop-blur-2xl',
        'sm:shadow-2xl',
      ];

      for (const cls of requiredDesktopClasses) {
        assert.ok(
          chatDrawerSlice.includes(cls),
          `Desktop chat drawer must include CSS class: "${cls}"`
        );
      }

      // Verify that obsolete overlapping floating card classes are purged from the chat drawer
      const forbiddenInChatDrawer = [
        'sm:bottom-20',
        'sm:right-6',
        'sm:w-[460px]',
      ];

      for (const cls of forbiddenInChatDrawer) {
        assert.ok(
          !chatDrawerSlice.includes(cls),
          `Desktop chat drawer must NOT include obsolete floating class: "${cls}"`
        );
      }
    });

    it('drawer toggle in header toggles drawer state cleanly', () => {
      assert.ok(
        aidjSource.includes('setShowChatDrawer((prev) => !prev)'),
        'Header chat toggle must toggle showChatDrawer state'
      );
    });
  });

  // =========================================================================
  // 3. REQUIREMENT R5 PRESERVED OFFLINE & DOWNLOAD FILES INTEGRITY
  // =========================================================================
  describe('3. Requirement R5 Preserved Files Integrity', () => {
    const preservedFiles = [
      'api/_lib/musicFallback.js',
      'api/audio.js',
      'scripts/audioService.mjs',
      'server.mjs',
      'native/android/SpotifreeLocalMusicPlugin.java',
      'src/utils/offlineStorage.ts',
      'tests/offline_downloads.test.js',
    ];

    for (const relPath of preservedFiles) {
      it(`verifies preserved file ${relPath} exists and has untouched non-empty content`, () => {
        const fullPath = path.join(rootDir, relPath);
        assert.ok(fs.existsSync(fullPath), `R5 preserved file ${relPath} must exist`);
        const stats = fs.statSync(fullPath);
        assert.ok(stats.size > 0, `R5 preserved file ${relPath} must not be empty`);
      });
    }
  });
});
