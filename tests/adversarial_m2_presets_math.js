/**
 * Spotifree Milestone 2 Adversarial Stress Test Suite
 * Empirical verification of 4/4 Phrase Math Bounds, 7 Presets Calibration,
 * Dynamic Filtro Selection, and Beat Grid Generator in src/services/djTransitionService.ts.
 *
 * Native Node 24 Test Runner (node:test & node:assert/strict)
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

// Register JSON loader hook for Node 24 ESM TypeScript support
register(new URL('./test_loader.js', import.meta.url));

let djServiceModule;
let audioFeaturesModule;

before(async () => {
  djServiceModule = await import('../src/services/djTransitionService.ts');
  audioFeaturesModule = await import('../src/utils/audioFeatures.ts');
});

// ============================================================================
// 1. Duration Bounds Clamping
// ============================================================================
describe('1. Duration Bounds Clamping: calculateDurationSeconds', () => {
  it('1.1: Extremely fast tempo (240 BPM, 300 BPM) with 1 compas does not drop below 1.5s', () => {
    // 240 BPM boundary: tempo < 240 is false, falls back to safe 128 BPM
    const dur240 = djServiceModule.calculateDurationSeconds(240, 1);
    assert.ok(dur240 >= 1.5, `Duration at 240 BPM must be >= 1.5s, got ${dur240}`);
    assert.ok(dur240 <= 16.0, `Duration at 240 BPM must be <= 16.0s, got ${dur240}`);

    // 300 BPM extreme speedcore: falls back to safe 128 BPM
    const dur300 = djServiceModule.calculateDurationSeconds(300, 1);
    assert.ok(dur300 >= 1.5, `Duration at 300 BPM must be >= 1.5s, got ${dur300}`);
    assert.ok(dur300 <= 16.0, `Duration at 300 BPM must be <= 16.0s, got ${dur300}`);

    // Extreme high BPM: 999 BPM
    const dur999 = djServiceModule.calculateDurationSeconds(999, 1);
    assert.ok(dur999 >= 1.5, `Duration at 999 BPM must be >= 1.5s, got ${dur999}`);

    // Valid fast tempo right below ceiling (239 BPM, 1 compas):
    // raw = (4 * 60) / 239 = 1.00418s -> must be strictly clamped to 1.5s
    const dur239 = djServiceModule.calculateDurationSeconds(239, 1);
    assert.strictEqual(dur239, 1.5, `239 BPM with 1 compas must clamp to exactly 1.5s, got ${dur239}`);
  });

  it('1.2: Extremely slow tempo (40 BPM, 30 BPM) with 8 or 16 compases does not exceed 16.0s', () => {
    // 40 BPM boundary with 8 compases: falls back to safe 128 BPM
    const dur40_8 = djServiceModule.calculateDurationSeconds(40, 8);
    assert.ok(dur40_8 <= 16.0, `Duration at 40 BPM 8 compases must be <= 16.0s, got ${dur40_8}`);
    assert.ok(dur40_8 >= 1.5, `Duration at 40 BPM 8 compases must be >= 1.5s, got ${dur40_8}`);

    // 30 BPM extreme ambient with 8 compases: falls back to safe 128 BPM
    const dur30_8 = djServiceModule.calculateDurationSeconds(30, 8);
    assert.ok(dur30_8 <= 16.0, `Duration at 30 BPM 8 compases must be <= 16.0s, got ${dur30_8}`);

    // 30 BPM with 16 compases: raw 128 * 16 = 30.0s -> must clamp to 16.0s
    const dur30_16 = djServiceModule.calculateDurationSeconds(30, 16);
    assert.strictEqual(dur30_16, 16.0, `30 BPM with 16 compases must clamp to 16.0s, got ${dur30_16}`);

    // 40 BPM with 16 compases: raw 128 * 16 = 30.0s -> must clamp to 16.0s
    const dur40_16 = djServiceModule.calculateDurationSeconds(40, 16);
    assert.strictEqual(dur40_16, 16.0, `40 BPM with 16 compases must clamp to 16.0s, got ${dur40_16}`);

    // Valid slow tempo right above floor (41 BPM, 8 compases):
    // raw = (4 * 60 / 41) * 8 = 46.829s -> must be strictly clamped to 16.0s
    const dur41_8 = djServiceModule.calculateDurationSeconds(41, 8);
    assert.strictEqual(dur41_8, 16.0, `41 BPM with 8 compases must clamp to exactly 16.0s, got ${dur41_8}`);
  });

  it('1.3: Invalid inputs (NaN, negative, 0, undefined, null, non-number) return valid numbers in [1.5, 16.0]', () => {
    const invalidTempos = [NaN, -120, -1, 0, undefined, null, '128', {}, [], Infinity, -Infinity];
    for (const t of invalidTempos) {
      const dur = djServiceModule.calculateDurationSeconds(t, 2);
      assert.ok(typeof dur === 'number' && Number.isFinite(dur), `Duration must be finite number for tempo ${t}, got ${dur}`);
      assert.ok(dur >= 1.5 && dur <= 16.0, `Duration for tempo ${t} must be in [1.5, 16.0], got ${dur}`);
    }

    const invalidCompases = [NaN, -4, -1, 0, undefined, null, '2', {}, [], Infinity, -Infinity];
    for (const c of invalidCompases) {
      const dur = djServiceModule.calculateDurationSeconds(128, c);
      assert.ok(typeof dur === 'number' && Number.isFinite(dur), `Duration must be finite number for compases ${c}, got ${dur}`);
      assert.ok(dur >= 1.5 && dur <= 16.0, `Duration for compases ${c} must be in [1.5, 16.0], got ${dur}`);
    }

    // Both tempo and compases invalid
    const durBoth = djServiceModule.calculateDurationSeconds(NaN, NaN);
    assert.ok(durBoth >= 1.5 && durBoth <= 16.0, `Duration for NaN/NaN must be in [1.5, 16.0], got ${durBoth}`);
  });

  it('1.4: Standalone export matches singleton instance method across random BPM and compas values', () => {
    const testCases = [
      [128, 1], [128, 2], [128, 4], [128, 8],
      [100, 2], [140, 4], [175, 2], [70, 2],
      [45, 8], [235, 1], [0, 2], [300, 4],
    ];
    for (const [bpm, comp] of testCases) {
      const fnResult = djServiceModule.calculateDurationSeconds(bpm, comp);
      const methodResult = djServiceModule.djTransitionService.calculateDurationSeconds(bpm, comp);
      assert.strictEqual(fnResult, methodResult, `Standalone function and class method must match for ${bpm} BPM, ${comp} compases`);
    }
  });
});

// ============================================================================
// 2. Preset Dictionary Completeness & Calibration
// ============================================================================
describe('2. Preset Dictionary Completeness & Calibration: DJ_PRESET_DEFINITIONS', () => {
  const CANONICAL_PRESETS = [
    'automatica',
    'corte',
    'filtro',
    'eco_out',
    'freno_vinilo',
    'beat_roll',
    'crescendo',
  ];

  const VALID_EQ_MODES = [
    'intercambio_graves_central',
    'filtro_paso_alto',
    'filtro_paso_bajo',
    'corte_instantaneo',
    'intercambio_gradual',
    'sin_filtro',
  ];

  const VALID_FX_MODES = [
    'ninguno',
    'eco',
    'freno_vinilo',
    'repeticion_loop',
    'distorsion_wash',
  ];

  const VALID_VOLUME_ENVELOPES = [
    'superposicion',
    'corte_directo',
    'lineal',
    'curva_s',
  ];

  it('2.1: Contains all 7 canonical presets', () => {
    assert.ok(djServiceModule.DJ_PRESET_DEFINITIONS, 'DJ_PRESET_DEFINITIONS must be exported');
    for (const preset of CANONICAL_PRESETS) {
      assert.ok(
        djServiceModule.DJ_PRESET_DEFINITIONS[preset],
        `DJ_PRESET_DEFINITIONS must contain canonical preset '${preset}'`
      );
      assert.strictEqual(
        djServiceModule.DJ_PRESET_DEFINITIONS[preset].preset,
        preset,
        `Preset property must match key '${preset}'`
      );
    }
  });

  it('2.2: Every canonical preset has compases > 0 and is an integer', () => {
    for (const preset of CANONICAL_PRESETS) {
      const def = djServiceModule.DJ_PRESET_DEFINITIONS[preset];
      assert.ok(
        typeof def.compases === 'number' && Number.isInteger(def.compases) && def.compases > 0,
        `Preset '${preset}' must have integer compases > 0, got ${def.compases}`
      );
    }
  });

  it('2.3: Every canonical preset has valid volume envelope governing Deck A and Deck B curves', () => {
    for (const preset of CANONICAL_PRESETS) {
      const def = djServiceModule.DJ_PRESET_DEFINITIONS[preset];
      assert.ok(
        VALID_VOLUME_ENVELOPES.includes(def.volumeEnvelope),
        `Preset '${preset}' volumeEnvelope '${def.volumeEnvelope}' must be in VALID_VOLUME_ENVELOPES`
      );

      // Verify simulated volume curves volA and volB behavior over normalized progress p in [0, 1]
      for (const p of [0.0, 0.25, 0.5, 0.75, 1.0]) {
        let volA, volB;
        if (def.volumeEnvelope === 'superposicion') {
          volA = p <= 0.5 ? 1.0 : Math.cos((p - 0.5) * Math.PI);
          volB = p;
        } else if (def.volumeEnvelope === 'corte_directo') {
          volA = p < 0.5 ? 1.0 : 0.0;
          volB = p < 0.5 ? 0.0 : 1.0;
        } else if (def.volumeEnvelope === 'curva_s') {
          volA = Math.cos(p * 0.5 * Math.PI);
          volB = Math.pow(p, 1.8);
        } else {
          volA = 1.0 - p;
          volB = p;
        }

        assert.ok(volA >= 0.0 && volA <= 1.0, `volA at p=${p} for '${preset}' must be in [0, 1], got ${volA}`);
        assert.ok(volB >= 0.0 && volB <= 1.0, `volB at p=${p} for '${preset}' must be in [0, 1], got ${volB}`);
      }
    }
  });

  it('2.4: Every canonical preset has valid eqMode in EQFilterMode', () => {
    for (const preset of CANONICAL_PRESETS) {
      const def = djServiceModule.DJ_PRESET_DEFINITIONS[preset];
      assert.ok(
        VALID_EQ_MODES.includes(def.eqMode),
        `Preset '${preset}' eqMode '${def.eqMode}' must be in EQFilterMode`
      );
    }
  });

  it('2.5: Every canonical preset has valid fxMode in DJFXMode', () => {
    for (const preset of CANONICAL_PRESETS) {
      const def = djServiceModule.DJ_PRESET_DEFINITIONS[preset];
      assert.ok(
        VALID_FX_MODES.includes(def.fxMode),
        `Preset '${preset}' fxMode '${def.fxMode}' must be in DJFXMode`
      );
    }
  });

  it('2.6: getPresetDefinition resolves known presets and falls back gracefully for invalid keys', () => {
    assert.strictEqual(typeof djServiceModule.getPresetDefinition, 'function', 'getPresetDefinition must be exported');
    for (const preset of CANONICAL_PRESETS) {
      const def = djServiceModule.getPresetDefinition(preset);
      assert.strictEqual(def.preset, preset, `getPresetDefinition('${preset}') must resolve correctly`);
    }

    // Fallback on non-existent preset defaults to 'automatica'
    const fallback = djServiceModule.getPresetDefinition('non_existent_preset');
    assert.strictEqual(fallback.preset, 'automatica', "Fallback for unknown preset must default to 'automatica'");
  });
});

// ============================================================================
// 3. Dynamic Filtro Selection
// ============================================================================
describe('3. Dynamic Filtro Selection: calculateSmartTransition', () => {
  it('3.1: Dynamically selects preset filtro with eqMode filtro_paso_alto on harmonic clash (dist >= 2)', () => {
    // Camelot clash: 1A vs 5A has circular distance 4 >= 2
    // Pair indices 1 and 4 yield seed % 3 === 1
    const config = djServiceModule.calculateSmartTransition(
      'track_alpha',
      'track_beta',
      128,
      128,
      '1A',
      '5A',
      1 // pairIndex 1 triggers clashMode === 1 ('filtro')
    );

    assert.strictEqual(config.preset, 'filtro', `Expected preset 'filtro' for harmonic clash, got '${config.preset}'`);
    assert.strictEqual(config.eqMode, 'filtro_paso_alto', `Expected eqMode 'filtro_paso_alto', got '${config.eqMode}'`);
    assert.strictEqual(config.volumeEnvelope, 'superposicion', "Filtro preset must use 'superposicion' envelope");
    assert.strictEqual(config.fxMode, 'ninguno', "Filtro preset must use 'ninguno' fxMode");
    assert.strictEqual(config.compases, 2, 'Filtro preset must use 2 compases');
    assert.ok(config.harmonicScore <= 50, `Harmonic clash score must be <= 50, got ${config.harmonicScore}`);
    assert.strictEqual(config.bpmDelta, 0, 'BPM delta must be 0 for identical tempo');
  });

  it('3.2: Selects filtro using track object signatures', () => {
    const trackA = { id: 'track_1', tempo: 126, camelot: '2A' };
    const trackB = { id: 'track_2', tempo: 128, camelot: '7A' }; // 2A to 7A: distance 5 >= 2, BPM delta 2 <= 8

    // Test across seed variations to find filtro
    let filtroFound = false;
    for (let seed = 0; seed < 10; seed++) {
      const res = djServiceModule.calculateSmartTransition(trackA, trackB, seed);
      if (res.preset === 'filtro') {
        filtroFound = true;
        assert.strictEqual(res.eqMode, 'filtro_paso_alto', `Filtro must have eqMode 'filtro_paso_alto', got '${res.eqMode}'`);
        assert.ok(res.detail.includes('HPF') || res.explanation.includes('HPF'), 'Explanation must mention HPF filter');
        break;
      }
    }
    assert.ok(filtroFound, "calculateSmartTransition must dynamically select 'filtro' across track object permutations");
  });

  it('3.3: Harmonic clash with wide BPM gap (>= 18 BPM) selects disconnect preset rather than filtro', () => {
    // 120 vs 150 BPM (delta 30 >= 18) with Camelot clash (1A vs 7A)
    const config = djServiceModule.calculateSmartTransition(
      'tA',
      'tB',
      120,
      150,
      '1A',
      '7A',
      1
    );
    assert.ok(
      ['freno_vinilo', 'eco_out'].includes(config.preset),
      `Expected tempo-disconnect preset for delta 30 BPM, got '${config.preset}'`
    );
    assert.notStrictEqual(config.preset, 'filtro', 'Filtro must not be chosen when tempo gap is wide');
  });

  it('3.4: Harmonic matches (distance 0 or 1) do NOT select filtro preset', () => {
    // Identical key (distance 0)
    for (let i = 0; i < 6; i++) {
      const confExact = djServiceModule.calculateSmartTransition('tA', 'tB', 128, 128, '8A', '8A', i);
      assert.notStrictEqual(confExact.preset, 'filtro', `Exact match must not select filtro (pairIndex ${i})`);
      assert.ok(['automatica', 'crescendo'].includes(confExact.preset));
    }

    // Relative Major/Minor (distance 0)
    for (let i = 0; i < 6; i++) {
      const confRel = djServiceModule.calculateSmartTransition('tA', 'tB', 128, 128, '8A', '8B', i);
      assert.notStrictEqual(confRel.preset, 'filtro', `Relative match must not select filtro (pairIndex ${i})`);
      assert.ok(['automatica', 'beat_roll'].includes(confRel.preset));
    }
  });

  it('3.5: Octave-locked clash (70 vs 140 BPM) with Camelot clash routes through Rule 5 and can select filtro', () => {
    // 70 vs 140 BPM: linear delta is 70 (>= 18), but octave delta is 0 (<= 4) -> isOctaveSynced = true
    // effectiveBpmDelta becomes 0 (<= 8), allowing harmonic clash Rule 5 to evaluate
    let filtroFound = false;
    for (let pairIndex = 0; pairIndex < 6; pairIndex++) {
      const res = djServiceModule.calculateSmartTransition(
        'tA',
        'tB',
        70,
        140,
        '1A',
        '7A',
        pairIndex
      );
      assert.strictEqual(res.isOctaveSynced, true, '70 vs 140 BPM must have isOctaveSynced = true');
      assert.strictEqual(res.bpmDelta, 0, 'effective bpmDelta must be 0 for 70 vs 140 BPM');
      if (res.preset === 'filtro') {
        filtroFound = true;
        assert.strictEqual(res.eqMode, 'filtro_paso_alto');
      }
    }
    assert.ok(filtroFound, 'Octave-synced harmonic clash must allow dynamic filtro selection');
  });
});

// ============================================================================
// 4. Beat Grid Generator
// ============================================================================
describe('4. Beat Grid Generator: calculateBeatGrid', () => {
  it('4.1: Generates exact number of markers: 4 * compases for standard compases (1, 2, 4, 8)', () => {
    const compasCases = [1, 2, 4, 8];
    for (const c of compasCases) {
      const grid = djServiceModule.calculateBeatGrid(128, c);
      assert.strictEqual(
        grid.length,
        c * 4,
        `Beat grid length for ${c} compases must be exactly ${c * 4}, got ${grid.length}`
      );
    }
  });

  it('4.2: Every 4th marker starting at index 0 has isDownbeat: true and beatInBar === 1', () => {
    const grid = djServiceModule.calculateBeatGrid(128, 4); // 16 beats
    assert.strictEqual(grid.length, 16);

    for (let i = 0; i < grid.length; i++) {
      const marker = grid[i];
      assert.strictEqual(marker.beatIndex, i, `beatIndex must be ${i}`);
      assert.strictEqual(marker.barIndex, Math.floor(i / 4), `barIndex must be ${Math.floor(i / 4)}`);
      assert.strictEqual(marker.beatInBar, (i % 4) + 1, `beatInBar must be ${(i % 4) + 1}`);

      if (i % 4 === 0) {
        assert.strictEqual(marker.isDownbeat, true, `Marker ${i} must have isDownbeat: true`);
        assert.strictEqual(marker.beatInBar, 1, `Marker ${i} must have beatInBar === 1`);
      } else {
        assert.strictEqual(marker.isDownbeat, false, `Marker ${i} must have isDownbeat: false`);
        assert.notStrictEqual(marker.beatInBar, 1, `Marker ${i} must not have beatInBar === 1`);
      }
    }
  });

  it('4.3: Exact beat interval equals 60 / tempo across various musical tempos', () => {
    const tempos = [100, 120, 128, 130, 140, 160];
    for (const bpm of tempos) {
      const expectedInterval = 60 / bpm;
      const grid = djServiceModule.calculateBeatGrid(bpm, 2); // 8 beats
      assert.strictEqual(grid.length, 8);

      for (let i = 1; i < grid.length; i++) {
        const delta = grid[i].time - grid[i - 1].time;
        assert.ok(
          Math.abs(delta - expectedInterval) < 1e-9,
          `Interval at ${bpm} BPM between marker ${i - 1} and ${i} must be ${expectedInterval}, got ${delta}`
        );
      }
    }
  });

  it('4.4: Durations match 4/4 meter and calculateBarDuration matches 4 * calculateBeatDuration', () => {
    const testTempos = [90, 120, 128, 140, 175];
    for (const bpm of testTempos) {
      const beatDur = djServiceModule.calculateBeatDuration(bpm);
      const barDur = djServiceModule.calculateBarDuration(bpm);
      assert.ok(
        Math.abs(barDur - 4 * beatDur) < 1e-9,
        `Bar duration (${barDur}) must be exactly 4 * beat duration (${beatDur}) for ${bpm} BPM`
      );
    }
  });

  it('4.5: Exact crossover marker is placed at central downbeat Math.floor(totalBeats / 2)', () => {
    const compasesList = [1, 2, 4, 8];
    for (const c of compasesList) {
      const grid = djServiceModule.calculateBeatGrid(128, c);
      const totalBeats = c * 4;
      const expectedCrossover = Math.floor(totalBeats / 2);

      const crossoverMarkers = grid.filter((m) => m.isCrossover);
      assert.strictEqual(crossoverMarkers.length, 1, `Exactly one marker must be isCrossover for ${c} compases`);
      assert.strictEqual(
        crossoverMarkers[0].beatIndex,
        expectedCrossover,
        `Crossover beatIndex must be ${expectedCrossover}, got ${crossoverMarkers[0].beatIndex}`
      );
    }
  });

  it('4.6: Adversarial edge inputs to calculateBeatGrid (NaN, negative, zero, extreme tempos) degrade safely', () => {
    // Extreme tempos fall back to safe 128 BPM
    const gridFast = djServiceModule.calculateBeatGrid(300, 2);
    assert.strictEqual(gridFast.length, 8, '300 BPM must safely generate 8 markers');

    const gridSlow = djServiceModule.calculateBeatGrid(30, 2);
    assert.strictEqual(gridSlow.length, 8, '30 BPM must safely generate 8 markers');

    const gridNaNTempo = djServiceModule.calculateBeatGrid(NaN, 2);
    assert.strictEqual(gridNaNTempo.length, 8, 'NaN BPM must safely generate 8 markers');

    // Invalid compases fall back to safe 2 compases (8 markers)
    const gridNegComp = djServiceModule.calculateBeatGrid(128, -2);
    assert.strictEqual(gridNegComp.length, 8, 'Negative compases must safely generate 8 markers');

    const gridZeroComp = djServiceModule.calculateBeatGrid(128, 0);
    assert.strictEqual(gridZeroComp.length, 8, 'Zero compases must safely generate 8 markers');

    const gridNaNComp = djServiceModule.calculateBeatGrid(128, NaN);
    assert.strictEqual(gridNaNComp.length, 8, 'NaN compases must safely generate 8 markers');

    // Timestamps are strictly monotonic
    for (const g of [gridFast, gridSlow, gridNaNTempo, gridNegComp, gridZeroComp, gridNaNComp]) {
      for (let i = 1; i < g.length; i++) {
        assert.ok(g[i].time > g[i - 1].time, `Timestamps must be strictly monotonic: ${g[i].time} > ${g[i - 1].time}`);
      }
    }
  });
});
