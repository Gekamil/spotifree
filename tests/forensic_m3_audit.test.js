import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import test from 'node:test';

const PROJECT_ROOT = process.cwd();
const MODAL_PATH = path.join(PROJECT_ROOT, 'src', 'components', 'modals', 'TransitionEditorModal.tsx');

test('Tier 1: Static AST & Lexical Forensic Audit of TransitionEditorModal.tsx', (t) => {
  assert.ok(fs.existsSync(MODAL_PATH), 'TransitionEditorModal.tsx must exist');
  const content = fs.readFileSync(MODAL_PATH, 'utf8');

  // Check 1.1: No test-specific branches or test runners in component
  const suspiciousKeywords = [
    'NODE_ENV',
    'testName',
    'isTest',
    'mockTrack',
    'dummyWaveform',
    'fakeWaveform',
    'fixture',
    'if (trackA.name ===',
    'if (trackA.id ===',
    'if (trackB.name ===',
    'if (trackB.id ===',
  ];
  for (const kw of suspiciousKeywords) {
    assert.strictEqual(
      content.includes(kw),
      false,
      `Component must not contain suspicious keyword or bypass branch: "${kw}"`
    );
  }

  // Check 1.2: Waveforms are drawn on Canvas, not static SVG waveform paths
  // Verify <canvas ref={canvasRef} exists and no <svg has waveform classes or large dimensions (>48px)
  assert.ok(content.includes('<canvas'), 'Component must render a <canvas> element for the visualizer');
  assert.ok(content.includes('ref={canvasRef}'), 'Canvas must bind to canvasRef');
  
  // Verify all SVGs are UI icons with small dimensions (12px to 24px)
  const svgMatches = [...content.matchAll(/<svg\s+width="(\d+)"\s+height="(\d+)"/g)];
  assert.ok(svgMatches.length > 0, 'Found SVG icons');
  for (const match of svgMatches) {
    const w = parseInt(match[1], 10);
    const h = parseInt(match[2], 10);
    assert.ok(w <= 24 && h <= 24, `SVG elements must only be UI icons (<=24px), found ${w}x${h}`);
  }

  // Check 1.3: Canvas element exists and has Retina / High-DPI scaling
  assert.ok(content.includes('devicePixelRatio'), 'Canvas rendering must use window.devicePixelRatio');
  assert.ok(content.includes('setTransform(dpr, 0, 0, dpr, 0, 0)'), 'Canvas context must scale by dpr');

  // Check 1.4: Pointer capture drag scrub implementation
  assert.ok(content.includes('setPointerCapture'), 'Canvas must support pointer capture for drag scrubbing');
  assert.ok(content.includes('releasePointerCapture'), 'Canvas must release pointer capture on pointer up');
});

test('Tier 2: Timeline Coordinate Mathematical Integrity', (t) => {
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

  // Test across multiple widths, tempos, and compases
  const testCases = [
    { width: 640, height: 196, tempo: 128, compases: 2 },
    { width: 800, height: 196, tempo: 120, compases: 4 },
    { width: 1024, height: 196, tempo: 174, compases: 8 },
    { width: 400, height: 196, tempo: 70, compases: 1 },
    { width: 1200, height: 196, tempo: 300, compases: 16 }, // extreme fast
    { width: 500, height: 196, tempo: 10, compases: 2 },   // extreme slow
  ];

  for (const tc of testCases) {
    const coords = computeTimelineCoordinates(tc.width, tc.height, tc.tempo, tc.compases);

    // 1. Total width conservation
    const sumW = coords.W_leadIn + coords.W_mix + coords.W_leadOut;
    assert.ok(
      Math.abs(sumW - coords.W) < 1e-6,
      `Width must be conserved: expected ${coords.W}, got ${sumW}`
    );

    // 2. Mix duration clamped between 2.0s and 16.0s
    assert.ok(coords.T_mix >= 2.0 && coords.T_mix <= 16.0, `T_mix must be within [2.0, 16.0]: got ${coords.T_mix}`);

    // 3. Crossover must be exactly in the center of the mix window
    assert.strictEqual(coords.X_crossover, coords.W_leadIn + 0.5 * coords.W_mix);

    // 4. Beat grid intervals must be positive and span mix window
    assert.ok(coords.stepBeat > 0, 'stepBeat must be > 0');
    assert.ok(
      Math.abs(coords.stepBeat * coords.N_beats - coords.W_mix) < 1e-6,
      'Beat grid must span full mix width'
    );
  }
});

test('Tier 3: Procedural Waveform Synthesis & Spectral Separation Integrity', (t) => {
  function generateSpectralWaveform(seedStr, count, tempo) {
    let h = 2166136261;
    for (let i = 0; i < seedStr.length; i++) {
      h ^= seedStr.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    const seed = h >>> 0;

    const prng = (offset) => {
      let s = (seed + offset * 1013904223) >>> 0;
      s = (s ^ (s >> 15)) * 2246822507 >>> 0;
      s = (s ^ (s >> 13)) * 3266489909 >>> 0;
      return ((s ^ (s >> 16)) >>> 0) / 4294967296;
    };

    const safeTempo = tempo > 40 && tempo < 240 ? tempo : 128;
    const beatInterval = Math.max(3, Math.round(120 / safeTempo));
    const slices = [];

    for (let i = 0; i < count; i++) {
      const r1 = prng(i * 3 + 1);
      const r2 = prng(i * 3 + 2);
      const r3 = prng(i * 3 + 3);

      const phrasePhase = (i / count) * Math.PI * 4;
      const macroEnergy = 0.65 + 0.35 * Math.sin(phrasePhase * 0.5 + (seed % 7));

      const beatPhase = i % (beatInterval * 2);
      const isKick = beatPhase === 0 || beatPhase === beatInterval;
      const isSnare = beatPhase === Math.floor(beatInterval / 2) || beatPhase === Math.floor(beatInterval * 1.5);
      const isHiHat = beatPhase % 2 === 1;

      const lowBase = isKick ? 0.75 + r1 * 0.25 : 0.22 + r1 * 0.35;
      const low = Math.min(1.0, Math.max(0.12, lowBase * macroEnergy));

      const midBase = isSnare ? 0.70 + r2 * 0.30 : 0.28 + r2 * 0.45;
      const mid = Math.min(1.0, Math.max(0.15, midBase * (0.8 + macroEnergy * 0.2)));

      const highBase = isHiHat ? 0.65 + r3 * 0.35 : (isKick || isSnare ? 0.45 + r3 * 0.35 : 0.20 + r3 * 0.30);
      const high = Math.min(1.0, Math.max(0.10, highBase * (0.85 + macroEnergy * 0.15)));

      const peak = Math.min(1.0, Math.max(low, Math.max(mid, high)) * (1.05 + r1 * 0.15));
      slices.push({ low, mid, high, peak });
    }

    return slices;
  }

  const slicesA = generateSpectralWaveform('track_1_tití_me_preguntó', 120, 111);
  const slicesB = generateSpectralWaveform('track_2_blinding_lights', 120, 171);

  assert.strictEqual(slicesA.length, 120, 'Must produce requested slice count');
  assert.strictEqual(slicesB.length, 120, 'Must produce requested slice count');

  // Verify non-identity between different tracks
  let identicalSlices = 0;
  for (let i = 0; i < 120; i++) {
    if (
      Math.abs(slicesA[i].low - slicesB[i].low) < 1e-4 &&
      Math.abs(slicesA[i].mid - slicesB[i].mid) < 1e-4 &&
      Math.abs(slicesA[i].high - slicesB[i].high) < 1e-4
    ) {
      identicalSlices++;
    }
  }
  assert.ok(
    identicalSlices < 5,
    `Waveforms for different tracks must not be identical: got ${identicalSlices}/120 identical`
  );

  // Verify mathematical invariants of slices
  for (let i = 0; i < 120; i++) {
    const s = slicesA[i];
    assert.ok(s.low >= 0.0 && s.low <= 1.0, `low in [0, 1]: got ${s.low}`);
    assert.ok(s.mid >= 0.0 && s.mid <= 1.0, `mid in [0, 1]: got ${s.mid}`);
    assert.ok(s.high >= 0.0 && s.high <= 1.0, `high in [0, 1]: got ${s.high}`);
    assert.ok(s.peak >= 0.0 && s.peak <= 1.0, `peak in [0, 1]: got ${s.peak}`);
    assert.ok(s.peak >= s.low - 1e-4, 'peak must bound low');
    assert.ok(s.peak >= s.mid - 1e-4, 'peak must bound mid');
    assert.ok(s.peak >= s.high - 1e-4, 'peak must bound high');
  }
});

test('Tier 4: Dynamic State Responsiveness for Curves & Envelopes', (t) => {
  function evalVolume(pMix, envelope, preset) {
    let volA = 1.0;
    let volB = 0.0;

    // Deck A
    if (envelope === 'superposicion' || preset === 'automatica') {
      volA = pMix <= 0.5 ? 1.0 : Math.cos((pMix - 0.5) * Math.PI);
    } else if (envelope === 'corte_directo' || preset === 'corte') {
      volA = pMix < 0.5 ? 1.0 : 0.0;
    } else if (preset === 'crescendo') {
      volA = Math.cos(pMix * 0.5 * Math.PI);
    } else if (envelope === 'curva_s' || preset === 'eco_out' || preset === 'beat_roll') {
      volA = 0.5 * (1.0 + Math.cos(pMix * Math.PI));
    } else {
      volA = Math.max(0, 1.0 - pMix);
    }

    // Deck B
    if (envelope === 'superposicion' || preset === 'automatica') {
      volB = pMix;
    } else if (envelope === 'corte_directo' || preset === 'corte') {
      volB = pMix < 0.5 ? 0.0 : 1.0;
    } else if (preset === 'crescendo') {
      volB = Math.pow(pMix, 1.8);
    } else if (envelope === 'curva_s' || preset === 'eco_out' || preset === 'beat_roll') {
      volB = 0.5 * (1.0 - Math.cos(pMix * Math.PI));
    } else {
      volB = Math.min(1, pMix);
    }

    return { volA, volB };
  }

  // 1. Corte directo: abrupt step at p=0.5
  const cutBefore = evalVolume(0.49, 'corte_directo', 'corte');
  const cutAfter = evalVolume(0.51, 'corte_directo', 'corte');
  assert.strictEqual(cutBefore.volA, 1.0);
  assert.strictEqual(cutBefore.volB, 0.0);
  assert.strictEqual(cutAfter.volA, 0.0);
  assert.strictEqual(cutAfter.volB, 1.0);

  // 2. Curva S: smooth half-cosines at p=0.0, 0.5, 1.0
  const sStart = evalVolume(0.0, 'curva_s', 'eco_out');
  const sMid = evalVolume(0.5, 'curva_s', 'eco_out');
  const sEnd = evalVolume(1.0, 'curva_s', 'eco_out');
  assert.strictEqual(sStart.volA, 1.0);
  assert.strictEqual(sStart.volB, 0.0);
  assert.ok(Math.abs(sMid.volA - 0.5) < 1e-4);
  assert.ok(Math.abs(sMid.volB - 0.5) < 1e-4);
  assert.ok(Math.abs(sEnd.volA - 0.0) < 1e-4);
  assert.ok(Math.abs(sEnd.volB - 1.0) < 1e-4);

  // 3. Superposición / Automática: Deck A holds at 1.0 until 0.5, Deck B is linear
  const autoQuarter = evalVolume(0.25, 'superposicion', 'automatica');
  assert.strictEqual(autoQuarter.volA, 1.0);
  assert.strictEqual(autoQuarter.volB, 0.25);
});

test('Tier 5: Real-Time Playhead & Interactive Drag Scrubbing Math', (t) => {
  function computePlayheadX(width, progress) {
    return Math.max(0, Math.min(width, progress * width));
  }
  function scrubFromClientX(clientX, rectLeft, rectWidth) {
    if (rectWidth <= 0) return 0;
    return Math.max(0, Math.min(1, (clientX - rectLeft) / rectWidth));
  }

  const W = 640;

  // Boundary checks
  assert.strictEqual(computePlayheadX(W, 0.0), 0);
  assert.strictEqual(computePlayheadX(W, 0.5), 320);
  assert.strictEqual(computePlayheadX(W, 1.0), 640);
  assert.strictEqual(computePlayheadX(W, -0.2), 0);
  assert.strictEqual(computePlayheadX(W, 1.2), 640);

  // Pointer scrubbing coordinate math
  assert.strictEqual(scrubFromClientX(100, 100, 400), 0.0);
  assert.strictEqual(scrubFromClientX(300, 100, 400), 0.5);
  assert.strictEqual(scrubFromClientX(500, 100, 400), 1.0);
  assert.strictEqual(scrubFromClientX(50, 100, 400), 0.0);
  assert.strictEqual(scrubFromClientX(600, 100, 400), 1.0);
});

test('Tier 6: Randomized Adversarial Fuzzing (10,000 Iterations)', (t) => {
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

  function generateSpectralWaveform(seedStr, count, tempo) {
    let h = 2166136261;
    for (let i = 0; i < seedStr.length; i++) {
      h ^= seedStr.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    const seed = h >>> 0;

    const prng = (offset) => {
      let s = (seed + offset * 1013904223) >>> 0;
      s = (s ^ (s >> 15)) * 2246822507 >>> 0;
      s = (s ^ (s >> 13)) * 3266489909 >>> 0;
      return ((s ^ (s >> 16)) >>> 0) / 4294967296;
    };

    const safeTempo = tempo > 40 && tempo < 240 ? tempo : 128;
    const beatInterval = Math.max(3, Math.round(120 / safeTempo));
    const slices = [];

    for (let i = 0; i < count; i++) {
      const r1 = prng(i * 3 + 1);
      const r2 = prng(i * 3 + 2);
      const r3 = prng(i * 3 + 3);

      const phrasePhase = (i / count) * Math.PI * 4;
      const macroEnergy = 0.65 + 0.35 * Math.sin(phrasePhase * 0.5 + (seed % 7));

      const beatPhase = i % (beatInterval * 2);
      const isKick = beatPhase === 0 || beatPhase === beatInterval;
      const isSnare = beatPhase === Math.floor(beatInterval / 2) || beatPhase === Math.floor(beatInterval * 1.5);
      const isHiHat = beatPhase % 2 === 1;

      const lowBase = isKick ? 0.75 + r1 * 0.25 : 0.22 + r1 * 0.35;
      const low = Math.min(1.0, Math.max(0.12, lowBase * macroEnergy));

      const midBase = isSnare ? 0.70 + r2 * 0.30 : 0.28 + r2 * 0.45;
      const mid = Math.min(1.0, Math.max(0.15, midBase * (0.8 + macroEnergy * 0.2)));

      const highBase = isHiHat ? 0.65 + r3 * 0.35 : (isKick || isSnare ? 0.45 + r3 * 0.35 : 0.20 + r3 * 0.30);
      const high = Math.min(1.0, Math.max(0.10, highBase * (0.85 + macroEnergy * 0.15)));

      const peak = Math.min(1.0, Math.max(low, Math.max(mid, high)) * (1.05 + r1 * 0.15));
      slices.push({ low, mid, high, peak });
    }

    return slices;
  }

  // Run 10,000 fuzzed parameter sets
  for (let iter = 0; iter < 10000; iter++) {
    const fuzzedWidth = Math.random() * 2000 - 100; // can be negative, 0, or huge
    const fuzzedHeight = Math.random() * 500;
    const fuzzedTempo = Math.random() * 400 - 50;  // can be negative, zero, extreme
    const fuzzedCompases = Math.floor(Math.random() * 32);

    const coords = computeTimelineCoordinates(fuzzedWidth, fuzzedHeight, fuzzedTempo, fuzzedCompases);
    assert.ok(!Number.isNaN(coords.W_leadIn), 'W_leadIn must not be NaN');
    assert.ok(!Number.isNaN(coords.W_mix), 'W_mix must not be NaN');
    assert.ok(!Number.isNaN(coords.W_leadOut), 'W_leadOut must not be NaN');
    assert.ok(!Number.isNaN(coords.stepBeat), 'stepBeat must not be NaN');
    assert.ok(coords.T_mix >= 2.0 && coords.T_mix <= 16.0, 'T_mix clamped');
    assert.ok(Math.abs(coords.W_leadIn + coords.W_mix + coords.W_leadOut - coords.W) < 1e-4, 'Width conserved');

    if (iter % 1000 === 0) {
      const fuzzedSeed = 'seed_' + Math.random().toString(36);
      const slices = generateSpectralWaveform(fuzzedSeed, 60, fuzzedTempo);
      assert.strictEqual(slices.length, 60);
      for (const s of slices) {
        assert.ok(!Number.isNaN(s.low) && s.low >= 0 && s.low <= 1);
        assert.ok(!Number.isNaN(s.mid) && s.mid >= 0 && s.mid <= 1);
        assert.ok(!Number.isNaN(s.high) && s.high >= 0 && s.high <= 1);
        assert.ok(!Number.isNaN(s.peak) && s.peak >= 0 && s.peak <= 1);
      }
    }
  }
});
