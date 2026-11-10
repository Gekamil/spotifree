import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

describe('DJ Interface Unification & Dynamic 3-Layer Talking Orb (Requirement R4)', () => {
  const rootDir = process.cwd();
  const aidjViewPath = path.join(rootDir, 'src', 'components', 'dj', 'AIDJView.tsx');
  const visualizerPath = path.join(rootDir, 'src', 'components', 'dj', 'SpotifyDJVisualizer.tsx');

  const aidjSource = fs.readFileSync(aidjViewPath, 'utf8');
  const visualizerSource = fs.readFileSync(visualizerPath, 'utf8');

  // Parse TSX ASTs
  const aidjAST = ts.createSourceFile('AIDJView.tsx', aidjSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const visualizerAST = ts.createSourceFile('SpotifyDJVisualizer.tsx', visualizerSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

  // Transpile visualizer to execute exported mathematical functions in a sandbox
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
  const visualizerModule = visualizerSandbox.exports;

  const {
    getAngularDistance,
    getUpperRightWeight,
    calculateOrbLayerDisplacement,
  } = visualizerModule;

  // =========================================================================
  // 1. DJ CHAT INTERFACE UNIFICATION IN AIDJView.tsx
  // =========================================================================
  describe('1. DJ Chat Interface Unification & Single Input Invariant', () => {
    it('enforces single input invariant: main view prompt bar is conditionally hidden when drawer is open (!showChatDrawer)', () => {
      // Find the conditional expression wrapping the main prompt bar
      assert.ok(
        aidjSource.includes('!showChatDrawer &&'),
        'Main view prompt bar must be conditionally hidden when showChatDrawer is true'
      );

      // Verify that the main prompt bar is within the !showChatDrawer condition
      const mainBarIndex = aidjSource.indexOf('!showChatDrawer &&');
      const mainFormIndex = aidjSource.indexOf('onSubmit={(e) => {\n                e.preventDefault();\n                handleSendPrompt();\n              }}', mainBarIndex);
      assert.ok(mainFormIndex > mainBarIndex, 'Main input form must be nested inside !showChatDrawer block');
    });

    it('displays main bottom prompt bar and vibe chips when chat drawer is closed', () => {
      // Main prompt bar includes vibe chips container
      assert.ok(
        aidjSource.includes('{vibeChips.map((chip) => ('),
        'Must render dynamic vibe chips'
      );
      assert.ok(
        aidjSource.includes('Escribe al DJ (ej. más reggaeton, algo chill)...'),
        'Must have main prompt placeholder'
      );
    });

    it('submitting prompt or clicking vibe chips opens chat drawer via handleSendPrompt', () => {
      // Check handleSendPrompt implementation
      assert.ok(
        aidjSource.includes('setShowChatDrawer(true);'),
        'handleSendPrompt must set showChatDrawer to true'
      );

      // Check handleSendPrompt resets promptInput and triggers handleUserPrompt
      assert.ok(
        aidjSource.includes('handleUserPrompt(q);') && aidjSource.includes("setPromptInput('');"),
        'handleSendPrompt must dispatch prompt and clear input'
      );
    });

    it('drawer contains microphone toggle button for full voice input parity', () => {
      // Locate the in-drawer form
      const drawerMarker = aidjSource.indexOf('{isChatRendered &&');
      assert.ok(drawerMarker > -1, 'Chat drawer must exist');
      const inDrawerSection = aidjSource.slice(drawerMarker);

      // Check microphone button in drawer form
      assert.ok(
        inDrawerSection.includes('onClick={toggleMic}'),
        'Chat drawer input form must include toggleMic button'
      );
      assert.ok(
        inDrawerSection.includes('isMicListening'),
        'Chat drawer input form must reflect isMicListening state'
      );
      assert.ok(
        inDrawerSection.includes('Te escucho... habla conmigo'),
        'Chat drawer input placeholder must respond when mic is active'
      );
    });

    it('chat drawer in desktop mode is docked to right side panel without floating overlap', () => {
      // Check desktop docked sidebar classes
      assert.ok(
        aidjSource.includes('sm:fixed sm:top-0 sm:right-0 sm:bottom-0 sm:w-[420px] sm:max-h-full sm:rounded-none sm:border-l sm:border-white/10 sm:bg-[#121212]/95 sm:backdrop-blur-2xl sm:shadow-2xl'),
        'Chat drawer must be docked to the right edge with Spotify desktop panel styling'
      );

      // Verify that the old floating card styling is eliminated
      assert.ok(
        !aidjSource.includes('sm:bottom-20 sm:right-6 sm:w-[460px]'),
        'Old floating box positioning (sm:bottom-20 sm:right-6 sm:w-[460px]) must be eliminated'
      );

      // Mobile top drag indicator must be hidden on desktop
      assert.ok(
        aidjSource.includes('title="Cerrar chat"') && aidjSource.includes('sm:hidden'),
        'Mobile drag bar must have sm:hidden on desktop'
      );
    });

    it('desktop chat drawer animates smoothly with right-slide transition', () => {
      assert.ok(
        aidjSource.includes('sm:translate-x-0') && aidjSource.includes('sm:translate-x-full'),
        'Chat drawer must slide horizontally on desktop (sm:translate-x-full to sm:translate-x-0)'
      );
    });
  });

  // =========================================================================
  // 2. DYNAMIC 3-LAYER TALKING ORB MATHEMATICAL PROPERTIES
  // =========================================================================
  describe('2. Dynamic 3-Layer Talking Orb Mathematical Properties', () => {
    it('getAngularDistance calculates shortest circular arc distance in [-PI, PI]', () => {
      assert.equal(typeof getAngularDistance, 'function');
      const target = -Math.PI / 4;

      // Exact match
      assert.ok(Math.abs(getAngularDistance(target, target)) < 1e-9);

      // Wrapped angle: 7*PI/4 is equivalent to -PI/4
      const wrappedAngle = (7 * Math.PI) / 4;
      assert.ok(Math.abs(getAngularDistance(wrappedAngle, target)) < 1e-9);

      // Diametrically opposite angle: 3*PI/4
      const oppositeAngle = (3 * Math.PI) / 4;
      assert.ok(Math.abs(Math.abs(getAngularDistance(oppositeAngle, target)) - Math.PI) < 1e-9);
    });

    it('getUpperRightWeight peaks at theta = -PI/4 (1.0) and decays smoothly to 0 in bottom-left', () => {
      assert.equal(typeof getUpperRightWeight, 'function');
      const targetUR = -Math.PI / 4;

      // Peak at upper-right center
      const weightUR = getUpperRightWeight(targetUR);
      assert.ok(Math.abs(weightUR - 1.0) < 1e-9, `Weight at -PI/4 must be 1.0, got ${weightUR}`);

      // Smooth decay at adjacent cardinal points
      const weightRight = getUpperRightWeight(0);
      const weightTop = getUpperRightWeight(-Math.PI / 2);
      assert.ok(weightRight > 0.6 && weightRight < 0.75, `Weight at right must be ~0.65, got ${weightRight}`);
      assert.ok(weightTop > 0.6 && weightTop < 0.75, `Weight at top must be ~0.65, got ${weightTop}`);

      // Bottom-left quadrant: diametrically opposite (3*PI/4)
      const weightBottomLeft = getUpperRightWeight((3 * Math.PI) / 4);
      assert.ok(weightBottomLeft < 0.002, `Weight at bottom-left must be < 0.002, got ${weightBottomLeft}`);

      // Bottom: PI/2
      const weightBottom = getUpperRightWeight(Math.PI / 2);
      assert.ok(weightBottom < 0.08, `Weight at bottom must be < 0.08, got ${weightBottom}`);
    });

    it('calculateOrbLayerDisplacement collapses all layers into Layer 0 when splitAmount is 0 (idle/playing)', () => {
      assert.equal(typeof calculateOrbLayerDisplacement, 'function');
      const thetaUR = -Math.PI / 4;
      const bulgeBase = 1.5;
      const size = 260;
      const time = 10;
      const voiceLevel = 0.8;
      const splitAmount = 0.0; // Idle or playing mode

      const d0 = calculateOrbLayerDisplacement(0, thetaUR, time, voiceLevel, splitAmount, bulgeBase, size, false);
      const d1 = calculateOrbLayerDisplacement(1, thetaUR, time, voiceLevel, splitAmount, bulgeBase, size, false);
      const d2 = calculateOrbLayerDisplacement(2, thetaUR, time, voiceLevel, splitAmount, bulgeBase, size, false);

      assert.equal(d0, d1, 'Layer 1 must collapse exactly to Layer 0 when splitAmount is 0');
      assert.equal(d1, d2, 'Layer 2 must collapse exactly to Layer 0 when splitAmount is 0');
    });

    it('calculateOrbLayerDisplacement produces 3 distinct concentric layers in upper-right when speaking (splitAmount = 1)', () => {
      const thetaUR = -Math.PI / 4;
      const bulgeBase = 1.5;
      const size = 260;
      const time = 0;
      const voiceLevel = 0.5;
      const splitAmount = 1.0;

      const d0 = calculateOrbLayerDisplacement(0, thetaUR, time, voiceLevel, splitAmount, bulgeBase, size, false);
      const d1 = calculateOrbLayerDisplacement(1, thetaUR, time, voiceLevel, splitAmount, bulgeBase, size, false);
      const d2 = calculateOrbLayerDisplacement(2, thetaUR, time, voiceLevel, splitAmount, bulgeBase, size, false);

      // Verify concentric ordering: Layer 0 < Layer 1 < Layer 2
      assert.ok(d1 > d0, `Layer 1 displacement (${d1}) must exceed Layer 0 (${d0}) in upper-right`);
      assert.ok(d2 > d1, `Layer 2 displacement (${d2}) must exceed Layer 1 (${d1}) in upper-right`);

      // Radial delamination separation
      const gap1 = d1 - d0;
      const gap2 = d2 - d1;
      assert.ok(gap1 >= 8.0, `Radial gap between Layer 0 and 1 must be >= 8px, got ${gap1}`);
      assert.ok(gap2 >= 8.0, `Radial gap between Layer 1 and 2 must be >= 8px, got ${gap2}`);
    });

    it('calculateOrbLayerDisplacement keeps layers unified at the bottom-left even during speech', () => {
      const thetaBL = (3 * Math.PI) / 4; // Bottom-left
      const bulgeBase = 1.5;
      const size = 260;
      const time = 5;
      const voiceLevel = 1.0;
      const splitAmount = 1.0;

      const d0 = calculateOrbLayerDisplacement(0, thetaBL, time, voiceLevel, splitAmount, bulgeBase, size, false);
      const d1 = calculateOrbLayerDisplacement(1, thetaBL, time, voiceLevel, splitAmount, bulgeBase, size, false);
      const d2 = calculateOrbLayerDisplacement(2, thetaBL, time, voiceLevel, splitAmount, bulgeBase, size, false);

      // In bottom-left, Gaussian weight is < 0.002, so layer offsets are virtually zero
      assert.ok(Math.abs(d1 - d0) < 0.1, `Layer 1 must not noticeably diverge in bottom-left, delta was ${Math.abs(d1 - d0)}`);
      assert.ok(Math.abs(d2 - d0) < 0.15, `Layer 2 must not noticeably diverge in bottom-left, delta was ${Math.abs(d2 - d0)}`);
    });

    it('voiceLevel modulates speech harmonics and flutter amplitude in Layer 1 and Layer 2', () => {
      const thetaUR = -Math.PI / 4;
      const bulgeBase = 1.0;
      const size = 260;
      const time = 0;
      const splitAmount = 1.0;

      const d1Silent = calculateOrbLayerDisplacement(1, thetaUR, time, 0.0, splitAmount, bulgeBase, size, false);
      const d1Loud = calculateOrbLayerDisplacement(1, thetaUR, time, 1.0, splitAmount, bulgeBase, size, false);

      const d2Silent = calculateOrbLayerDisplacement(2, thetaUR, time, 0.0, splitAmount, bulgeBase, size, false);
      const d2Loud = calculateOrbLayerDisplacement(2, thetaUR, time, 1.0, splitAmount, bulgeBase, size, false);

      assert.ok(d1Loud !== d1Silent, 'voiceLevel must modulate Layer 1 displacement');
      assert.ok(d2Loud !== d2Silent, 'voiceLevel must modulate Layer 2 displacement');
    });

    it('mini mode (mini=true) scales displacements proportionally to prevent canvas clipping', () => {
      const size = 38;
      const thetaUR = -Math.PI / 4;
      const bulgeBase = 0.35;
      const time = 2;
      const voiceLevel = 1.0;
      const splitAmount = 1.0;

      const baseRadius = size * 0.30; // 11.4px
      const pulseScale = 1.035;

      const d2 = calculateOrbLayerDisplacement(2, thetaUR, time, voiceLevel, splitAmount, bulgeBase, size, true);
      const maxRadius = (baseRadius + d2) * pulseScale;

      const canvasRadius = size / 2; // 19px
      assert.ok(
        maxRadius < canvasRadius,
        `Mini mode max layer radius (${maxRadius.toFixed(2)}px) must be less than canvas half-width (${canvasRadius}px)`
      );
    });

    it('SpotifyDJVisualizer implementation manages splitAmountRef decay towards target', () => {
      assert.ok(
        visualizerSource.includes('splitAmountRef'),
        'Visualizer must track splitAmountRef across animation frames'
      );
      assert.ok(
        visualizerSource.includes('const targetSplit = isSpeaking ? 1.0 : 0.0;'),
        'Visualizer must target 1.0 when speaking and 0.0 when not speaking'
      );
      assert.ok(
        visualizerSource.includes('splitAmountRef.current += (targetSplit - splitAmountRef.current) *'),
        'Visualizer must interpolate splitAmountRef towards targetSplit smoothly'
      );
    });
  });

  // =========================================================================
  // 3. REQUIREMENT R5: PRESERVED OFFLINE & DOWNLOAD FILES INTEGRITY
  // =========================================================================
  describe('3. Requirement R5 Preserved Files Integrity', () => {
    const r5Files = [
      'api/_lib/musicFallback.js',
      'api/audio.js',
      'scripts/audioService.mjs',
      'server.mjs',
      'native/android/SpotifreeLocalMusicPlugin.java',
      'src/utils/offlineStorage.ts',
      'tests/offline_downloads.test.js',
    ];

    for (const relPath of r5Files) {
      it(`preserves R5 file intact: ${relPath}`, () => {
        const fullPath = path.join(rootDir, relPath);
        assert.ok(fs.existsSync(fullPath), `Preserved file ${relPath} must exist`);
        const stat = fs.statSync(fullPath);
        assert.ok(stat.size > 0, `Preserved file ${relPath} must not be empty`);
      });
    }
  });
});
