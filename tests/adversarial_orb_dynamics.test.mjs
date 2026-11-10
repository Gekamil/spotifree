import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

describe('Adversarial Challenge: DJ Chat Drawer & Dynamic 3-Layer Talking Orb', () => {
  const rootDir = process.cwd();
  const visualizerPath = path.join(rootDir, 'src', 'components', 'dj', 'SpotifyDJVisualizer.tsx');
  const aidjViewPath = path.join(rootDir, 'src', 'components', 'dj', 'AIDJView.tsx');

  assert.ok(fs.existsSync(visualizerPath), `Target visualizer file must exist at ${visualizerPath}`);
  assert.ok(fs.existsSync(aidjViewPath), `Target AIDJView file must exist at ${aidjViewPath}`);

  const visualizerSource = fs.readFileSync(visualizerPath, 'utf8');
  const aidjSource = fs.readFileSync(aidjViewPath, 'utf8');

  // Transpile TypeScript module to CommonJS for sandboxed execution
  const transpiledVisualizer = ts.transpileModule(visualizerSource, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.React,
    },
  });

  const sandbox = {
    exports: {},
    module: { exports: {} },
    require: () => ({
      useRef: (init) => ({ current: init }),
      useEffect: () => {},
    }),
    window: { devicePixelRatio: 1 },
    document: { hidden: false },
  };
  sandbox.module.exports = sandbox.exports;
  vm.createContext(sandbox);
  vm.runInContext(transpiledVisualizer.outputText, sandbox);

  const {
    getAngularDistance,
    getUpperRightWeight,
    calculateOrbLayerDisplacement,
    parseHexToRgb,
  } = sandbox.exports;

  // =========================================================================
  // 1. STATE TRANSITIONS & MONOTONIC SPLIT AMOUNT DYNAMICS
  // =========================================================================
  describe('1. Dynamic Talking Orb State Transitions & Monotonicity', () => {
    it('simulates rapid state transitions (idle -> listening -> speaking -> playing -> idle) with monotonic splitAmount', () => {
      // Replicate the frame-by-frame interpolation state machine from SpotifyDJVisualizer.tsx
      let splitAmount = 0.0;
      const history = [];

      const stepFrame = (isSpeaking) => {
        const targetSplit = isSpeaking ? 1.0 : 0.0;
        const splitRate = targetSplit > splitAmount ? 0.08 : 0.05;
        splitAmount += (targetSplit - splitAmount) * splitRate;
        return splitAmount;
      };

      // 1. IDLE (30 frames)
      for (let f = 0; f < 30; f++) {
        const val = stepFrame(false);
        assert.ok(val >= 0 && val <= 1, `Value ${val} out of bounds`);
        history.push({ state: 'idle', val });
      }
      assert.equal(splitAmount, 0.0, 'Initial idle state must stay at splitAmount = 0');

      // 2. LISTENING (30 frames) - Rising phase towards 1.0
      let prevVal = splitAmount;
      for (let f = 0; f < 30; f++) {
        const val = stepFrame(true);
        assert.ok(val >= prevVal, `splitAmount must be monotonic non-decreasing during listening (was ${prevVal}, now ${val})`);
        assert.ok(val <= 1.0, `splitAmount must not exceed 1.0 (got ${val})`);
        assert.ok(val >= 0.0, `splitAmount must not drop below 0.0 (got ${val})`);
        prevVal = val;
        history.push({ state: 'listening', val });
      }
      assert.ok(splitAmount > 0.9, `After 30 frames of listening, splitAmount (${splitAmount}) should be > 0.9`);

      // 3. SPEAKING (30 frames) - Continued speech / asymptotic hold near 1.0
      for (let f = 0; f < 30; f++) {
        const val = stepFrame(true);
        assert.ok(val >= prevVal, `splitAmount must be non-decreasing during continued speech (was ${prevVal}, now ${val})`);
        assert.ok(val <= 1.0, `splitAmount must never overshoot 1.0 (got ${val})`);
        prevVal = val;
        history.push({ state: 'speaking', val });
      }
      assert.ok(splitAmount > 0.99, `After 60 frames total speech, splitAmount (${splitAmount}) should be > 0.99`);

      // 4. PLAYING (40 frames) - Falling phase decaying towards 0.0
      for (let f = 0; f < 40; f++) {
        const val = stepFrame(false);
        assert.ok(val <= prevVal, `splitAmount must be monotonic non-increasing during playing (was ${prevVal}, now ${val})`);
        assert.ok(val >= 0.0, `splitAmount must never drop negative (got ${val})`);
        prevVal = val;
        history.push({ state: 'playing', val });
      }
      assert.ok(splitAmount < 0.15, `After 40 frames of playing, splitAmount (${splitAmount}) should decay < 0.15`);

      // 5. IDLE (40 frames) - Continued decay to rest
      for (let f = 0; f < 40; f++) {
        const val = stepFrame(false);
        assert.ok(val <= prevVal, `splitAmount must be non-increasing during idle return (was ${prevVal}, now ${val})`);
        assert.ok(val >= 0.0, `splitAmount must never drop negative (got ${val})`);
        prevVal = val;
        history.push({ state: 'idle', val });
      }
      assert.ok(splitAmount < 0.02, `After return to idle, splitAmount (${splitAmount}) should be < 0.02`);
    });

    it('survives high-frequency adversarial jitter toggles without numerical explosion or negative values', () => {
      let splitAmount = 0.5;

      // 500 frames of chaotic switching
      for (let i = 0; i < 500; i++) {
        const isSpeaking = (i % 3 === 0) || (i % 7 === 0);
        const targetSplit = isSpeaking ? 1.0 : 0.0;
        const splitRate = targetSplit > splitAmount ? 0.08 : 0.05;
        splitAmount += (targetSplit - splitAmount) * splitRate;

        assert.ok(Number.isFinite(splitAmount), `splitAmount became non-finite at step ${i}`);
        assert.ok(splitAmount >= 0.0, `splitAmount dropped below 0 at step ${i}: ${splitAmount}`);
        assert.ok(splitAmount <= 1.0, `splitAmount exceeded 1.0 at step ${i}: ${splitAmount}`);
      }
    });
  });

  // =========================================================================
  // 2. HARMONIC DISPLACEMENT FORMULA & UPPER-RIGHT SECTOR HIERARCHY
  // =========================================================================
  describe('2. Harmonic Displacement Formula Verification', () => {
    it('strictly maintains Layer 2 > Layer 1 > Layer 0 displacement across the upper-right sector [-PI/2, 0]', () => {
      const size = 260;
      const bulgeBase = 1.0;
      const splitAmount = 1.0; // Fully active orb

      // Dense sampling across theta in [-PI/2, 0]
      const numThetaSteps = 60;
      const thetaStart = -Math.PI / 2;
      const thetaEnd = 0;

      // Test multiple time points to stress harmonic sinusoidal phases
      const testTimes = [0, 0.5, 1.25, 2.718, 3.1415, 6.28, 10.0, 25.5, 50.0];
      // Test multiple voice levels from silence to full shout
      const testVoiceLevels = [0.0, 0.25, 0.5, 0.75, 1.0];

      let checksPerformed = 0;

      for (const time of testTimes) {
        for (const voiceLevel of testVoiceLevels) {
          for (let step = 0; step <= numThetaSteps; step++) {
            const theta = thetaStart + (step / numThetaSteps) * (thetaEnd - thetaStart);

            const d0 = calculateOrbLayerDisplacement(0, theta, time, voiceLevel, splitAmount, bulgeBase, size, false);
            const d1 = calculateOrbLayerDisplacement(1, theta, time, voiceLevel, splitAmount, bulgeBase, size, false);
            const d2 = calculateOrbLayerDisplacement(2, theta, time, voiceLevel, splitAmount, bulgeBase, size, false);

            // Layer 1 must be strictly greater than Layer 0 in upper-right sector
            assert.ok(
              d1 > d0,
              `At theta=${theta.toFixed(3)}, time=${time}, voice=${voiceLevel}: Layer 1 (${d1.toFixed(3)}) must be > Layer 0 (${d0.toFixed(3)})`
            );

            // Layer 2 must be strictly greater than Layer 1 in upper-right sector
            assert.ok(
              d2 > d1,
              `At theta=${theta.toFixed(3)}, time=${time}, voice=${voiceLevel}: Layer 2 (${d2.toFixed(3)}) must be > Layer 1 (${d1.toFixed(3)})`
            );

            checksPerformed++;
          }
        }
      }

      assert.ok(checksPerformed >= 2700, `Must have performed extensive checks, completed: ${checksPerformed}`);
    });

    it('confirms layer convergence to within 1% of base radius at theta = 3*PI/4 (opposite lower-left)', () => {
      // At theta = 3*PI/4 (bottom-left), Gaussian envelope W(theta) decays drastically (< 0.002)
      const thetaBL = (3 * Math.PI) / 4;
      const bulgeBase = 1.4;
      const time = 5.0;
      const voiceLevel = 1.0; // Worst-case maximum voice
      const splitAmount = 1.0;

      // Standard desktop/mobile size: size = 260, baseRadius = 260 * 0.31 = 80.6px
      const sizeNormal = 260;
      const baseRadiusNormal = sizeNormal * 0.31; // 80.6px
      const thresholdNormal = 0.01 * baseRadiusNormal; // 0.806px (1% of base radius)

      const d0Normal = calculateOrbLayerDisplacement(0, thetaBL, time, voiceLevel, splitAmount, bulgeBase, sizeNormal, false);
      const d1Normal = calculateOrbLayerDisplacement(1, thetaBL, time, voiceLevel, splitAmount, bulgeBase, sizeNormal, false);
      const d2Normal = calculateOrbLayerDisplacement(2, thetaBL, time, voiceLevel, splitAmount, bulgeBase, sizeNormal, false);

      const delta1Normal = Math.abs(d1Normal - d0Normal);
      const delta2Normal = Math.abs(d2Normal - d0Normal);

      assert.ok(
        delta1Normal < thresholdNormal,
        `Normal Layer 1 delta (${delta1Normal.toFixed(5)}px) exceeds 1% of base radius (${thresholdNormal.toFixed(3)}px)`
      );
      assert.ok(
        delta2Normal < thresholdNormal,
        `Normal Layer 2 delta (${delta2Normal.toFixed(5)}px) exceeds 1% of base radius (${thresholdNormal.toFixed(3)}px)`
      );

      // Mini mode size: size = 38, baseRadius = 38 * 0.30 = 11.4px
      const sizeMini = 38;
      const baseRadiusMini = sizeMini * 0.30; // 11.4px
      const thresholdMini = 0.01 * baseRadiusMini; // 0.114px (1% of base radius)

      const d0Mini = calculateOrbLayerDisplacement(0, thetaBL, time, voiceLevel, splitAmount, bulgeBase, sizeMini, true);
      const d1Mini = calculateOrbLayerDisplacement(1, thetaBL, time, voiceLevel, splitAmount, bulgeBase, sizeMini, true);
      const d2Mini = calculateOrbLayerDisplacement(2, thetaBL, time, voiceLevel, splitAmount, bulgeBase, sizeMini, true);

      const delta1Mini = Math.abs(d1Mini - d0Mini);
      const delta2Mini = Math.abs(d2Mini - d0Mini);

      assert.ok(
        delta1Mini < thresholdMini,
        `Mini Layer 1 delta (${delta1Mini.toFixed(5)}px) exceeds 1% of base radius (${thresholdMini.toFixed(3)}px)`
      );
      assert.ok(
        delta2Mini < thresholdMini,
        `Mini Layer 2 delta (${delta2Mini.toFixed(5)}px) exceeds 1% of base radius (${thresholdMini.toFixed(3)}px)`
      );
    });

    it('verifies getUpperRightWeight Gaussian curve roll-off and symmetry', () => {
      const targetUR = -Math.PI / 4;
      const sigma = 0.85;

      // Peak
      const peak = getUpperRightWeight(targetUR, sigma);
      assert.equal(peak, 1.0);

      // Equidistant delta +delta and -delta should produce equal weights
      const delta = 0.5;
      const wPlus = getUpperRightWeight(targetUR + delta, sigma);
      const wMinus = getUpperRightWeight(targetUR - delta, sigma);
      assert.ok(Math.abs(wPlus - wMinus) < 1e-12, 'Gaussian curve must be symmetric about -PI/4');

      // Monotonic decay moving away from target angle
      let prevW = peak;
      for (let offset = 0.1; offset <= Math.PI; offset += 0.1) {
        const currentW = getUpperRightWeight(targetUR + offset, sigma);
        assert.ok(currentW <= prevW, `Weight must monotonically decrease away from peak (offset ${offset})`);
        prevW = currentW;
      }
    });
  });

  // =========================================================================
  // 3. 60FPS FRAME RENDERING SIMULATION (120 FRAMES)
  // =========================================================================
  describe('3. Frame Rendering Simulation across 120 Frames (60fps)', () => {
    it('simulates 120 consecutive frames without geometry distortion or non-finite coordinates', () => {
      const size = 260;
      const numPoints = 160;
      const baseRadius = size * 0.31;
      const centerX = size / 2;
      const centerY = size / 2;

      let time = 0;
      let smoothedVoice = 0;
      let splitAmount = 0;

      // Track bounding box across all frames
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;

      let totalPointsComputed = 0;

      for (let frame = 0; frame < 120; frame++) {
        // Speech cycle: frame 0-60 speaking, 61-120 idle
        const isSpeaking = frame < 60;
        const targetVoice = isSpeaking ? 0.75 + Math.sin(frame * 0.2) * 0.25 : 0.0;

        time += isSpeaking ? 0.042 : 0.019;
        smoothedVoice += (targetVoice - smoothedVoice) * 0.16;

        const targetSplit = isSpeaking ? 1.0 : 0.0;
        const splitRate = targetSplit > splitAmount ? 0.08 : 0.05;
        splitAmount += (targetSplit - splitAmount) * splitRate;

        const pulseScale = isSpeaking
          ? 1 + Math.sin(time * 2.2) * 0.02 + smoothedVoice * 0.09
          : 1 + Math.sin(time * 1.4) * 0.024;
        const bulgeBase = isSpeaking
          ? (1.0 + smoothedVoice * 1.5) * (size / 260)
          : 1.9 * (size / 260);

        // Render all 3 layers
        const layersToRender = splitAmount > 0.005 ? [0, 1, 2] : [0];

        for (const layer of layersToRender) {
          for (let i = 0; i <= numPoints; i++) {
            const theta = (i / numPoints) * Math.PI * 2;
            const offset = calculateOrbLayerDisplacement(
              layer,
              theta,
              time,
              smoothedVoice,
              splitAmount,
              bulgeBase,
              size,
              false
            );

            const r = (baseRadius + offset) * pulseScale;
            assert.ok(r > 0, `Radius at frame ${frame}, layer ${layer}, theta ${theta} must be positive, was ${r}`);

            const px = centerX + Math.cos(theta) * r;
            const py = centerY + Math.sin(theta) * r;

            assert.ok(Number.isFinite(px), `px non-finite at frame ${frame}`);
            assert.ok(Number.isFinite(py), `py non-finite at frame ${frame}`);

            if (px < minX) minX = px;
            if (px > maxX) maxX = px;
            if (py < minY) minY = py;
            if (py > maxY) maxY = py;

            totalPointsComputed++;
          }
        }
      }

      assert.ok(totalPointsComputed > 40000, `Expected > 40,000 vertex calculations, completed ${totalPointsComputed}`);

      // Verify that coordinates remain within the canvas footprint (with comfortable margins, no clipping)
      assert.ok(minX >= 0, `minX was negative: ${minX}`);
      assert.ok(maxX <= size, `maxX exceeded size ${size}: ${maxX}`);
      assert.ok(minY >= 0, `minY was negative: ${minY}`);
      assert.ok(maxY <= size, `maxY exceeded size ${size}: ${maxY}`);
    });
  });

  // =========================================================================
  // 4. DJ CHAT DRAWER & VIEW INVARIANTS
  // =========================================================================
  describe('4. DJ Chat Drawer & View Invariants', () => {
    it('verifies prompt bar suppression: when showChatDrawer is true, main prompt input is absent from DOM', () => {
      // Find where main prompt input form is defined in AIDJView.tsx
      const promptCondition = '!showChatDrawer && (';
      assert.ok(
        aidjSource.includes(promptCondition),
        `AIDJView must conditionally render the prompt bar using ${promptCondition}`
      );

      // Verify that the condition wraps the main prompt input element
      const conditionIdx = aidjSource.indexOf(promptCondition);
      const inputIdx = aidjSource.indexOf('placeholder={isMicListening ? "Te escucho... habla conmigo" : "Escribe al DJ (ej. más reggaeton, algo chill)..."}', conditionIdx);
      assert.ok(inputIdx > conditionIdx, 'Main input placeholder must reside inside !showChatDrawer block');

      // Verify that the closing of this condition occurs after the prompt bar and vibe chips
      const closeIdx = aidjSource.indexOf(')}', inputIdx);
      const miniPlayerIdx = aidjSource.indexOf('CLASSIC SPOTIFY MINI-PLAYER', inputIdx);
      assert.ok(closeIdx > inputIdx && closeIdx < miniPlayerIdx, 'Condition must close before the mini-player');
    });

    it('verifies desktop docked sidebar classes in AIDJView.tsx', () => {
      const requiredDesktopClasses = [
        'sm:fixed',
        'sm:top-0',
        'sm:right-0',
        'sm:bottom-0',
        'sm:w-[420px]',
        'sm:max-h-full',
        'sm:rounded-none',
        'sm:border-l',
        'sm:backdrop-blur-2xl',
      ];

      for (const cls of requiredDesktopClasses) {
        assert.ok(
          aidjSource.includes(cls),
          `AIDJView drawer container must include class "${cls}" for desktop docking`
        );
      }
    });

    it('verifies drawer contains microphone toggle button and vibe chips', () => {
      const drawerStart = aidjSource.indexOf('{isChatRendered &&');
      assert.ok(drawerStart > -1, 'Drawer conditional block {isChatRendered && must exist');
      const drawerContent = aidjSource.slice(drawerStart);

      // Mic toggle button
      assert.ok(
        drawerContent.includes('onClick={toggleMic}'),
        'Drawer must contain microphone toggle button (onClick={toggleMic})'
      );

      // Vibe chips inside drawer
      assert.ok(
        drawerContent.includes('Quick Vibe Chips inside drawer') && drawerContent.includes('{vibeChips.map((chip) => ('),
        'Drawer must contain quick vibe chips section'
      );

      // Drawer input placeholder
      assert.ok(
        drawerContent.includes('placeholder={isMicListening ? "Te escucho... habla conmigo" : "Escribe una canción o petición al DJ..."}'),
        'Drawer input must feature dedicated placeholder and voice-active status'
      );
    });
  });

  // =========================================================================
  // 5. REQUIREMENT R5 PRESERVED OFFLINE & DOWNLOAD FILES INTEGRITY
  // =========================================================================
  describe('5. Requirement R5 Preserved Files Integrity', () => {
    const r5PreservedFiles = [
      'api/_lib/musicFallback.js',
      'api/audio.js',
      'scripts/audioService.mjs',
      'server.mjs',
      'native/android/SpotifreeLocalMusicPlugin.java',
      'src/utils/offlineStorage.ts',
      'tests/offline_downloads.test.js',
    ];

    for (const file of r5PreservedFiles) {
      it(`verifies preserved file is present and non-empty: ${file}`, () => {
        const fullPath = path.join(rootDir, file);
        assert.ok(fs.existsSync(fullPath), `Preserved file ${file} must exist`);
        const stat = fs.statSync(fullPath);
        assert.ok(stat.size > 0, `Preserved file ${file} must not be empty (size=${stat.size})`);
      });
    }
  });
});
