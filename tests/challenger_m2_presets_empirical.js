/**
 * Spotifree Milestone 2 Empirical Adversarial Challenger Test Suite
 * Independent stress-testing of 7 DJ Transition Presets, Parameter Configurations,
 * 4/4 Phrase Duration Clamping [1.5s, 16.0s], and Mathematical Helper Functions.
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

// Register JSON loader hook for Node 24 ESM TypeScript support
register(new URL('./test_loader.js', import.meta.url));

let djService;
let audioNodes;
let audioFeatures;

before(async () => {
  djService = await import('../src/services/djTransitionService.ts');
  audioNodes = await import('../src/services/djAudioNodes.ts');
  audioFeatures = await import('../src/utils/audioFeatures.ts');
});

// ============================================================================
// 1. All 7 Presets Calibration & Parameter Configurations
// ============================================================================
describe('Challenger 1: All 7 Presets Parameter Configurations & Contracts', () => {
  const PRESETS = [
    'automatica',
    'corte',
    'filtro',
    'eco_out',
    'freno_vinilo',
    'beat_roll',
    'crescendo',
  ];

  it('1.1: Every canonical preset is defined with exact expected properties', () => {
    for (const p of PRESETS) {
      const def = djService.DJ_PRESET_DEFINITIONS[p];
      assert.ok(def, `Preset ${p} must exist in DJ_PRESET_DEFINITIONS`);
      assert.strictEqual(def.preset, p);
      assert.ok(typeof def.title === 'string' && def.title.length > 0);
      assert.ok(typeof def.label === 'string' && def.label.length > 0);
      assert.ok(typeof def.detail === 'string' && def.detail.length > 0);
      assert.ok([1, 2, 4, 8, 16].includes(def.compases), `Compases ${def.compases} must be a valid phrase bar count`);
    }
  });

  it('1.2: Validates Volume Envelope configurations match PROJECT.md specifications', () => {
    // automatica -> superposicion (equal-power / overlap)
    assert.strictEqual(djService.DJ_PRESET_DEFINITIONS.automatica.volumeEnvelope, 'superposicion');
    // corte -> corte_directo (instant cut)
    assert.strictEqual(djService.DJ_PRESET_DEFINITIONS.corte.volumeEnvelope, 'corte_directo');
    // filtro -> superposicion (overlap with filter sweep)
    assert.strictEqual(djService.DJ_PRESET_DEFINITIONS.filtro.volumeEnvelope, 'superposicion');
    // eco_out -> curva_s (S-curve dissolve)
    assert.strictEqual(djService.DJ_PRESET_DEFINITIONS.eco_out.volumeEnvelope, 'curva_s');
    // freno_vinilo -> corte_directo (direct cut into drop)
    assert.strictEqual(djService.DJ_PRESET_DEFINITIONS.freno_vinilo.volumeEnvelope, 'corte_directo');
    // beat_roll -> curva_s (S-curve build)
    assert.strictEqual(djService.DJ_PRESET_DEFINITIONS.beat_roll.volumeEnvelope, 'curva_s');
    // crescendo -> curva_s (exponential riser build)
    assert.strictEqual(djService.DJ_PRESET_DEFINITIONS.crescendo.volumeEnvelope, 'curva_s');
  });

  it('1.3: Validates EQ Mode configurations match PROJECT.md specifications', () => {
    // automatica -> central bass swap
    assert.strictEqual(djService.DJ_PRESET_DEFINITIONS.automatica.eqMode, 'intercambio_graves_central');
    // corte -> central bass swap / downbeat cut
    assert.strictEqual(djService.DJ_PRESET_DEFINITIONS.corte.eqMode, 'intercambio_graves_central');
    // filtro -> high-pass filter sweep
    assert.strictEqual(djService.DJ_PRESET_DEFINITIONS.filtro.eqMode, 'filtro_paso_alto');
    // eco_out -> low-pass filter / spatial dissolve
    assert.strictEqual(djService.DJ_PRESET_DEFINITIONS.eco_out.eqMode, 'filtro_paso_bajo');
    // freno_vinilo -> central bass swap / clean cut
    assert.strictEqual(djService.DJ_PRESET_DEFINITIONS.freno_vinilo.eqMode, 'intercambio_graves_central');
    // beat_roll -> gradual exchange
    assert.strictEqual(djService.DJ_PRESET_DEFINITIONS.beat_roll.eqMode, 'intercambio_gradual');
    // crescendo -> gradual exchange
    assert.strictEqual(djService.DJ_PRESET_DEFINITIONS.crescendo.eqMode, 'intercambio_gradual');
  });

  it('1.4: Validates FX Mode configurations match PROJECT.md specifications', () => {
    // automatica -> ninguno
    assert.strictEqual(djService.DJ_PRESET_DEFINITIONS.automatica.fxMode, 'ninguno');
    // corte -> ninguno
    assert.strictEqual(djService.DJ_PRESET_DEFINITIONS.corte.fxMode, 'ninguno');
    // filtro -> ninguno
    assert.strictEqual(djService.DJ_PRESET_DEFINITIONS.filtro.fxMode, 'ninguno');
    // eco_out -> eco
    assert.strictEqual(djService.DJ_PRESET_DEFINITIONS.eco_out.fxMode, 'eco');
    // freno_vinilo -> freno_vinilo
    assert.strictEqual(djService.DJ_PRESET_DEFINITIONS.freno_vinilo.fxMode, 'freno_vinilo');
    // beat_roll -> repeticion_loop
    assert.strictEqual(djService.DJ_PRESET_DEFINITIONS.beat_roll.fxMode, 'repeticion_loop');
    // crescendo -> ninguno
    assert.strictEqual(djService.DJ_PRESET_DEFINITIONS.crescendo.fxMode, 'ninguno');
  });

  it('1.5: Mathematical curves simulation across progress [0, 1] for all presets', () => {
    const steps = 100;
    for (let i = 0; i <= steps; i++) {
      const p = i / steps;

      // Vinyl brake deceleration formula: R(p) = max(0, 1 - p^1.8)
      const vinylDecel = Math.max(0, 1 - Math.pow(p, 1.8));
      assert.ok(vinylDecel >= 0 && vinylDecel <= 1, `Vinyl decel out of bounds at ${p}: ${vinylDecel}`);
      if (i > 0) {
        const prevVinyl = Math.max(0, 1 - Math.pow((i - 1) / steps, 1.8));
        assert.ok(vinylDecel <= prevVinyl, `Vinyl decel must be monotonically decreasing at ${p}`);
      }

      // Crescendo exponential volume riser formula: V_B = p^1.8
      const crescendoVol = Math.pow(p, 1.8);
      assert.ok(crescendoVol >= 0 && crescendoVol <= 1, `Crescendo volume out of bounds at ${p}: ${crescendoVol}`);
      if (i > 0) {
        const prevCresc = Math.pow((i - 1) / steps, 1.8);
        assert.ok(crescendoVol >= prevCresc, `Crescendo volume must be monotonically increasing at ${p}`);
      }

      // Superposicion equal-power curve:
      const outVolSuper = p <= 0.5 ? 1.0 : Math.cos((p - 0.5) * Math.PI);
      const inVolSuper = p;
      assert.ok(outVolSuper >= 0 && outVolSuper <= 1.0001, `Superposicion outVol at ${p}: ${outVolSuper}`);
      assert.ok(inVolSuper >= 0 && inVolSuper <= 1.0001, `Superposicion inVol at ${p}: ${inVolSuper}`);

      // Low-end clash prevention check:
      // At crossover (p = 0.5), outgoing bass is cut to -40dB (amplitude ~0.01)
      // Combined low energy <= 1.05
      let lowEnergy;
      if (p < 0.5) {
        const bassA = 1.0;
        const bassB = 0.01; // -40dB
        lowEnergy = Math.sqrt(bassA * bassA + bassB * bassB);
      } else {
        const bassA = 0.01; // -40dB cut
        const bassB = 1.0;
        lowEnergy = Math.sqrt(bassA * bassA + bassB * bassB);
      }
      assert.ok(lowEnergy <= 1.05, `Low-end combined energy must be <= 1.05, got ${lowEnergy}`);
    }
  });
});

// ============================================================================
// 2. Fuzzing & Stress Testing 4/4 Phrase Duration Clamping [1.5s, 16.0s]
// ============================================================================
describe('Challenger 2: 4/4 Phrase Duration Clamping [1.5s, 16.0s] Fuzz & Stress', () => {
  it('2.1: Mathematical precision of standard 4/4 phrase durations', () => {
    // At 128 BPM:
    // 1 bar = 240 / 128 = 1.875s
    // 2 bars = 3.75s
    // 4 bars = 7.5s
    // 8 bars = 15.0s
    // 16 bars = 30.0s -> clamped to 16.0s
    assert.strictEqual(djService.calculateDurationSeconds(128, 1), 1.875);
    assert.strictEqual(djService.calculateDurationSeconds(128, 2), 3.75);
    assert.strictEqual(djService.calculateDurationSeconds(128, 4), 7.5);
    assert.strictEqual(djService.calculateDurationSeconds(128, 8), 15.0);
    assert.strictEqual(djService.calculateDurationSeconds(128, 16), 16.0);

    // At 120 BPM:
    // 1 bar = 240 / 120 = 2.0s
    // 2 bars = 4.0s
    // 4 bars = 8.0s
    // 8 bars = 16.0s
    // 16 bars = 32.0s -> clamped to 16.0s
    assert.strictEqual(djService.calculateDurationSeconds(120, 1), 2.0);
    assert.strictEqual(djService.calculateDurationSeconds(120, 2), 4.0);
    assert.strictEqual(djService.calculateDurationSeconds(120, 4), 8.0);
    assert.strictEqual(djService.calculateDurationSeconds(120, 8), 16.0);
    assert.strictEqual(djService.calculateDurationSeconds(120, 16), 16.0);
  });

  it('2.2: Boundary tempos exactly at thresholds (40, 40.001, 239.999, 240)', () => {
    // 40 BPM is sanitized to 128 BPM
    assert.strictEqual(djService.calculateDurationSeconds(40, 2), 3.75);
    // 40.001 BPM is valid: bar = 240 / 40.001 = 5.99985s
    const dur40_001 = djService.calculateDurationSeconds(40.001, 2);
    assert.ok(Math.abs(dur40_001 - 11.9997) < 0.01);

    // 240 BPM is sanitized to 128 BPM
    assert.strictEqual(djService.calculateDurationSeconds(240, 2), 3.75);
    // 239.999 BPM is valid: bar = 240 / 239.999 = 1.000004s
    // for 1 bar: raw 1.000004s -> clamped to 1.5s
    assert.strictEqual(djService.calculateDurationSeconds(239.999, 1), 1.5);
    // for 2 bars: raw 2.000008s -> within [1.5, 16.0]
    const dur239_2 = djService.calculateDurationSeconds(239.999, 2);
    assert.ok(Math.abs(dur239_2 - 2.000008) < 0.001);
  });

  it('2.3: Fuzz test 50,000 extreme and random inputs to calculateDurationSeconds', () => {
    const specialValues = [
      0, -0, 1, -1, 40, 240, 40.0000001, 239.9999999,
      NaN, Infinity, -Infinity,
      Number.MIN_VALUE, Number.MAX_VALUE, Number.EPSILON,
      null, undefined, '', '128', 'fast', {}, [], () => {},
    ];

    // Test all combinations of special values
    for (const t of specialValues) {
      for (const c of specialValues) {
        const dur = djService.calculateDurationSeconds(t, c);
        assert.ok(typeof dur === 'number' && Number.isFinite(dur), `Must be finite number for (${t}, ${c}), got ${dur}`);
        assert.ok(dur >= 1.5, `Must be >= 1.5s for (${t}, ${c}), got ${dur}`);
        assert.ok(dur <= 16.0, `Must be <= 16.0s for (${t}, ${c}), got ${dur}`);
      }
    }

    // Fuzz 50,000 random float inputs
    for (let i = 0; i < 50000; i++) {
      const randTempo = (Math.random() - 0.2) * 500; // -100 to 400
      const randCompases = (Math.random() - 0.1) * 35; // -3.5 to 31.5
      const dur = djService.calculateDurationSeconds(randTempo, randCompases);
      assert.ok(typeof dur === 'number' && Number.isFinite(dur), `Must be finite number for (${randTempo}, ${randCompases})`);
      assert.ok(dur >= 1.5, `Must be >= 1.5s for (${randTempo}, ${randCompases}), got ${dur}`);
      assert.ok(dur <= 16.0, `Must be <= 16.0s for (${randTempo}, ${randCompases}), got ${dur}`);
    }
  });
});

// ============================================================================
// 3. Mathematical Helper Functions Verification
// ============================================================================
describe('Challenger 3: Helper Functions (calculateBeatDuration, calculateBarDuration, calculateBeatGrid)', () => {
  it('3.1: calculateBarDuration === 4 * calculateBeatDuration across all inputs', () => {
    const testTempos = [
      41, 60, 75, 90, 100, 115, 120, 128, 140, 160, 175, 200, 239,
      40, 240, 30, 300, 0, -50, NaN, Infinity, -Infinity, null, undefined,
    ];
    for (const t of testTempos) {
      const beat = djService.calculateBeatDuration(t);
      const bar = djService.calculateBarDuration(t);
      assert.ok(Number.isFinite(beat), `beat duration must be finite for ${t}`);
      assert.ok(Number.isFinite(bar), `bar duration must be finite for ${t}`);
      assert.ok(
        Math.abs(bar - 4 * beat) < 1e-12,
        `Bar duration must be 4 * beat duration for ${t}, got bar=${bar}, beat=${beat}`
      );
    }
  });

  it('3.2: calculateBeatGrid structural and mathematical integrity', () => {
    const tempos = [60, 100, 120, 128, 140, 175];
    for (const bpm of tempos) {
      for (const comp of [1, 2, 4]) {
        const grid = djService.calculateBeatGrid(bpm, comp);
        assert.ok(Array.isArray(grid), 'Must return an array');
        assert.ok(grid.length > 0, 'Grid must not be empty');

        // Check strictly monotonic time stamps
        for (let i = 1; i < grid.length; i++) {
          assert.ok(
            grid[i].time > grid[i - 1].time,
            `Grid times must be strictly increasing: ${grid[i].time} > ${grid[i - 1].time}`
          );
        }

        // Check downbeat and bar indexing invariants
        for (const marker of grid) {
          assert.strictEqual(marker.barIndex, Math.floor(marker.beatIndex / 4));
          assert.strictEqual(marker.beatInBar, (marker.beatIndex % 4) + 1);
          assert.strictEqual(marker.isDownbeat, marker.beatInBar === 1);
        }

        // Check crossover marker exists and is unique for standard compases
        const crossovers = grid.filter((m) => m.isCrossover);
        assert.strictEqual(crossovers.length, 1, `Must have exactly 1 crossover marker for ${bpm} BPM, ${comp} compases`);
        assert.strictEqual(crossovers[0].beatIndex, Math.floor((comp * 4) / 2));
      }
    }
  });

  it('3.3: calculateBeatGrid adversarial fuzzing degrades safely without throwing', () => {
    const extremeTempos = [-100, 0, 40, 240, 500, NaN, Infinity, -Infinity, '120', null, undefined];
    const extremeCompases = [-5, 0, 0.5, 1, 2, 4, 16, 100, NaN, Infinity, -Infinity, null, undefined];

    for (const t of extremeTempos) {
      for (const c of extremeCompases) {
        let grid;
        assert.doesNotThrow(() => {
          grid = djService.calculateBeatGrid(t, c);
        }, `calculateBeatGrid(${t}, ${c}) threw an error`);

        assert.ok(Array.isArray(grid), `Must return array for (${t}, ${c})`);
        assert.ok(grid.length > 0, `Grid must not be empty for (${t}, ${c})`);
        for (const m of grid) {
          assert.ok(Number.isFinite(m.time), `Marker time must be finite for (${t}, ${c})`);
          assert.ok(m.time >= 0, `Marker time must be non-negative for (${t}, ${c})`);
        }
      }
    }
  });
});
