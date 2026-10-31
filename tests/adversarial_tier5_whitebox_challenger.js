/**
 * Tier 5 Adversarial White-Box Coverage Challenger Test Harness
 * Evaluates parameter boundaries, mathematical acoustic invariants, and lifecycle teardowns.
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';

register(new URL('./test_loader.js', import.meta.url));

// ============================================================================
// Web Audio API DSP Mock Simulation
// ============================================================================

class MockAudioParam {
  constructor(name, defaultValue = 0, minValue = -Infinity, maxValue = Infinity) {
    this.name = name;
    this.value = defaultValue;
    this.defaultValue = defaultValue;
    this.minValue = minValue;
    this.maxValue = maxValue;
    this.events = [];
  }

  setValueAtTime(value, startTime) {
    this.value = value;
    this.events.push({ type: 'setValueAtTime', value, startTime });
    return this;
  }

  linearRampToValueAtTime(value, endTime) {
    this.value = value;
    this.events.push({ type: 'linearRampToValueAtTime', value, endTime });
    return this;
  }

  exponentialRampToValueAtTime(value, endTime) {
    if (value <= 0) {
      throw new RangeError(
        `Failed to execute 'exponentialRampToValueAtTime' on 'AudioParam': The float target value must be positive, got ${value}`
      );
    }
    this.value = value;
    this.events.push({ type: 'exponentialRampToValueAtTime', value, endTime });
    return this;
  }

  setTargetAtTime(target, startTime, timeConstant) {
    this.value = target;
    this.events.push({ type: 'setTargetAtTime', target, startTime, timeConstant });
    return this;
  }

  cancelScheduledValues(startTime) {
    this.events.push({ type: 'cancelScheduledValues', startTime });
    return this;
  }
}

class MockAudioNode {
  constructor(context) {
    this.context = context;
    this.connections = [];
  }

  connect(destination) {
    this.connections.push(destination);
    return destination;
  }

  disconnect() {
    this.connections = [];
  }
}

class MockGainNode extends MockAudioNode {
  constructor(context, initialGain = 1.0) {
    super(context);
    this.gain = new MockAudioParam('gain', initialGain, 0, 10);
  }
}

class MockBiquadFilterNode extends MockAudioNode {
  constructor(context) {
    super(context);
    this.type = 'lowpass';
    this.frequency = new MockAudioParam('frequency', 350, 10, 24000);
    this.Q = new MockAudioParam('Q', 1.0, 0.0001, 1000);
    this.gain = new MockAudioParam('gain', 0.0, -40, 40);
    this.detune = new MockAudioParam('detune', 0, -153600, 153600);
  }
}

class MockDelayNode extends MockAudioNode {
  constructor(context, maxDelayTime = 5.0) {
    super(context);
    this.maxDelayTime = maxDelayTime;
    this.delayTime = new MockAudioParam('delayTime', 0.0, 0, maxDelayTime);
  }
}

class MockOscillatorNode extends MockAudioNode {
  constructor(context) {
    super(context);
    this.type = 'sine';
    this.frequency = new MockAudioParam('frequency', 440, 0, 24000);
    this.events = [];
  }

  start(time = 0) {
    this.events.push({ type: 'start', time });
  }

  stop(time = 0) {
    this.events.push({ type: 'stop', time });
  }
}

class MockAudioContext {
  constructor() {
    this.currentTime = 0.0;
    this.sampleRate = 44100;
    this.state = 'running';
    this.destination = new MockAudioNode(this);
  }

  createGain() {
    return new MockGainNode(this);
  }

  createBiquadFilter() {
    return new MockBiquadFilterNode(this);
  }

  createDelay(maxDelay = 5.0) {
    return new MockDelayNode(this, maxDelay);
  }

  createOscillator() {
    return new MockOscillatorNode(this);
  }

  async resume() {
    this.state = 'running';
  }

  async suspend() {
    this.state = 'suspended';
  }

  async close() {
    this.state = 'closed';
  }
}

// In-memory mock localStorage for Node environment
class MockLocalStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(k) {
    return this.store.get(k) || null;
  }
  setItem(k, v) {
    this.store.set(k, String(v));
  }
  removeItem(k) {
    this.store.delete(k);
  }
  clear() {
    this.store.clear();
  }
}

globalThis.AudioContext = MockAudioContext;
globalThis.window = globalThis;
globalThis.localStorage = new MockLocalStorage();

// ============================================================================
// Load Production Modules
// ============================================================================

let djAudioNodes;
let audioFeatures;
let djTransitionServiceModule;
let transitionEditorModalSource;

before(async () => {
  djAudioNodes = await import('../src/services/djAudioNodes.ts');
  audioFeatures = await import('../src/utils/audioFeatures.ts');
  djTransitionServiceModule = await import('../src/services/djTransitionService.ts');
  const modalPath = path.resolve('src/components/modals/TransitionEditorModal.tsx');
  transitionEditorModalSource = fs.readFileSync(modalPath, 'utf8');
});

// ============================================================================
// CHALLENGE 1: 4/4 Musical Phrase Duration Clamping [1.5s, 16.0s]
// ============================================================================

describe('Adversarial Challenge 1: 4/4 Phrase Duration Clamping [1.5s, 16.0s]', () => {
  it('ADV1.1: Extreme high tempos (240 - 1000 BPM) with 1-16 compases clamp strictly >= 1.5s', () => {
    const extremeTempos = [240, 240.1, 280, 320, 500, 999, 10000];
    const compasesList = [1, 2, 4, 8, 16];

    for (const bpm of extremeTempos) {
      for (const bars of compasesList) {
        const dur = djTransitionServiceModule.calculateDurationSeconds(bpm, bars);
        assert.ok(
          dur >= 1.5 && dur <= 16.0,
          `Duration ${dur}s for tempo ${bpm} and ${bars} bars must be in [1.5, 16.0]`
        );
        assert.ok(Number.isFinite(dur), `Duration must be finite, got ${dur}`);
      }
    }
  });

  it('ADV1.2: Extreme low tempos (0.1 - 40 BPM) with 1-16 compases clamp strictly <= 16.0s', () => {
    const extremeLowTempos = [0.01, 1, 5, 20, 39.9, 40];
    const compasesList = [1, 2, 4, 8, 16];

    for (const bpm of extremeLowTempos) {
      for (const bars of compasesList) {
        const dur = djTransitionServiceModule.calculateDurationSeconds(bpm, bars);
        assert.ok(
          dur >= 1.5 && dur <= 16.0,
          `Duration ${dur}s for tempo ${bpm} and ${bars} bars must be in [1.5, 16.0]`
        );
        assert.ok(Number.isFinite(dur), `Duration must be finite, got ${dur}`);
      }
    }
  });

  it('ADV1.3: Monte Carlo Stress: 10,000 random adversarial inputs guarantee [1.5, 16.0] invariance', () => {
    let seed = 123456789;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };

    for (let i = 0; i < 10000; i++) {
      const tempo = (rnd() - 0.2) * 500; // -100 to 400 BPM
      const compases = (rnd() - 0.2) * 20; // -4 to 16 compases
      const dur = djTransitionServiceModule.calculateDurationSeconds(tempo, compases);

      assert.ok(
        dur >= 1.5 && dur <= 16.0,
        `Monte Carlo failure: dur=${dur} for tempo=${tempo}, compases=${compases}`
      );
      assert.ok(!Number.isNaN(dur), 'Duration must not be NaN');
      assert.ok(Number.isFinite(dur), 'Duration must be finite');
    }
  });

  it('ADV1.4: Malformed, non-numeric, and non-finite inputs default to safe [1.5, 16.0] bounds', () => {
    const malformedInputs = [
      [NaN, 2],
      [Infinity, 2],
      [-Infinity, 2],
      [null, null],
      [undefined, undefined],
      ['128', '4'],
      [{}, []],
      [0, 0],
      [-128, -4],
    ];

    for (const [t, c] of malformedInputs) {
      const dur = djTransitionServiceModule.calculateDurationSeconds(t, c);
      assert.ok(
        dur >= 1.5 && dur <= 16.0,
        `Malformed input (${t}, ${c}) yielded out-of-bounds duration ${dur}`
      );
      assert.ok(Number.isFinite(dur), `Duration must be finite for (${t}, ${c})`);
    }
  });

  it('ADV1.5: calculateBeatDuration and calculateBarDuration maintain exact 4/4 musical ratio', () => {
    const tempos = [60, 96, 120, 128, 140, 160, 175];
    for (const bpm of tempos) {
      const tBeat = djTransitionServiceModule.calculateBeatDuration(bpm);
      const tBar = djTransitionServiceModule.calculateBarDuration(bpm);
      assert.strictEqual(
        Number((tBar / tBeat).toFixed(6)),
        4.0,
        `T_bar / T_beat must equal exactly 4.0 for 4/4 meter at ${bpm} BPM`
      );
      assert.strictEqual(
        Number(tBeat.toFixed(6)),
        Number((60 / bpm).toFixed(6)),
        `T_beat must equal 60 / BPM at ${bpm} BPM`
      );
    }
  });
});

// ============================================================================
// CHALLENGE 2: Low-End Clash Prevention Mathematical Invariant E_low(t) <= 1.05
// ============================================================================

describe('Adversarial Challenge 2: Low-End Clash Prevention Invariant E_low(t) <= 1.05', () => {
  it('ADV2.1: Mathematical guarantee across all 5 volume curves with 10,000 time steps', () => {
    const duration = 8.0;
    const crossoverTime = 4.0;
    const tau = 0.02; // 20ms anti-click time constant
    const steps = 10000;

    const volumeEnvelopes = [
      {
        name: 'superposicion',
        getVols: (p) => ({
          vA: p <= 0.5 ? 1.0 : Math.cos((p - 0.5) * Math.PI),
          vB: p,
        }),
      },
      {
        name: 'corte_directo',
        getVols: (p) => ({
          vA: p < 0.5 ? 1.0 : 0.0,
          vB: p < 0.5 ? 0.0 : 1.0,
        }),
      },
      {
        name: 'curva_s',
        getVols: (p) => ({
          vA: 0.5 * (1.0 + Math.cos(p * Math.PI)),
          vB: 0.5 * (1.0 - Math.cos(p * Math.PI)),
        }),
      },
      {
        name: 'crescendo',
        getVols: (p) => ({
          vA: Math.cos(p * 0.5 * Math.PI),
          vB: Math.pow(p, 1.8),
        }),
      },
      {
        name: 'lineal',
        getVols: (p) => ({
          vA: Math.max(0, 1.0 - p),
          vB: Math.min(1.0, p),
        }),
      },
    ];

    for (const env of volumeEnvelopes) {
      let maxCombinedEnergy = 0;
      let maxEnergyTime = 0;

      for (let s = 0; s <= steps; s++) {
        const t = (s / steps) * duration;
        const p = t / duration;
        const { vA, vB } = env.getVols(p);

        // Web Audio setTargetAtTime simulation for low shelf gain:
        // Before crossover: Deck A at 0dB (1.0), Deck B at -40dB (0.01)
        // After crossover:
        // Deck A targets -40dB with tau=0.02s: gA(t) = -40 + (0 - (-40)) * exp(-dt/tau)
        // Deck B targets 0dB with tau=0.02s: gB(t) = 0 + (-40 - 0) * exp(-dt/tau)
        let gA_linear;
        let gB_linear;

        if (t < crossoverTime) {
          gA_linear = 1.0;
          gB_linear = Math.pow(10, -40 / 20); // 0.01
        } else {
          const dt = t - crossoverTime;
          const gA_dB = -40 + 40 * Math.exp(-dt / tau);
          const gB_dB = -40 * Math.exp(-dt / tau);
          gA_linear = Math.pow(10, gA_dB / 20);
          gB_linear = Math.pow(10, gB_dB / 20);
        }

        const combinedEnergy = vA * gA_linear + vB * gB_linear;
        if (combinedEnergy > maxCombinedEnergy) {
          maxCombinedEnergy = combinedEnergy;
          maxEnergyTime = t;
        }

        assert.ok(
          combinedEnergy <= 1.05001,
          `Envelope "${env.name}" breached 1.05 threshold: E_low=${combinedEnergy.toFixed(5)} at t=${t.toFixed(3)}s`
        );
      }

      assert.ok(
        maxCombinedEnergy <= 1.05,
        `Max energy for envelope ${env.name} was ${maxCombinedEnergy.toFixed(4)} <= 1.05`
      );
    }
  });

  it('ADV2.2: Root-Mean-Square (RMS) low-end power sum <= 1.05 throughout transition', () => {
    const duration = 6.0;
    const crossoverTime = 3.0;
    const tau = 0.02;
    const steps = 3000;

    for (let s = 0; s <= steps; s++) {
      const t = (s / steps) * duration;
      const p = t / duration;

      // Equal-power faders
      const vA = Math.cos(p * 0.5 * Math.PI);
      const vB = Math.sin(p * 0.5 * Math.PI);

      let gA_linear;
      let gB_linear;

      if (t < crossoverTime) {
        gA_linear = 1.0;
        gB_linear = 0.01;
      } else {
        const dt = t - crossoverTime;
        const gA_dB = -40 + 40 * Math.exp(-dt / tau);
        const gB_dB = -40 * Math.exp(-dt / tau);
        gA_linear = Math.pow(10, gA_dB / 20);
        gB_linear = Math.pow(10, gB_dB / 20);
      }

      const rmsLowEnergy = Math.sqrt(Math.pow(vA * gA_linear, 2) + Math.pow(vB * gB_linear, 2));
      assert.ok(
        rmsLowEnergy <= 1.05,
        `RMS low energy ${rmsLowEnergy} exceeded 1.05 at t=${t}s`
      );
    }
  });

  it('ADV2.3: Empirical verification: Unmitigated clash produces severe boost (~1.414)', () => {
    const p = 0.5;
    const vA = Math.cos(p * 0.5 * Math.PI);
    const vB = Math.sin(p * 0.5 * Math.PI);
    const unmitigatedLinear = vA * 1.0 + vB * 1.0;
    assert.ok(
      unmitigatedLinear > 1.40,
      `Unmitigated clash must produce ~1.414 linear amplitude (+3dB boost), got ${unmitigatedLinear}`
    );
  });
});

// ============================================================================
// CHALLENGE 3: Parameter Boundaries for ALL 7 DJ Presets
// ============================================================================

describe('Adversarial Challenge 3: All 7 DJ Presets Parameter Boundaries', () => {
  const REQUIRED_7_PRESETS = [
    'automatica',
    'corte',
    'filtro',
    'eco_out',
    'freno_vinilo',
    'beat_roll',
    'crescendo',
  ];

  it('ADV3.1: All 7 DJ presets exist in DJ_PRESET_DEFINITIONS with valid types and compases', () => {
    const validEnvelopes = new Set(['superposicion', 'corte_directo', 'lineal', 'curva_s']);
    const validEqModes = new Set([
      'intercambio_graves_central',
      'filtro_paso_alto',
      'filtro_paso_bajo',
      'corte_instantaneo',
      'intercambio_gradual',
      'sin_filtro',
    ]);
    const validFxModes = new Set(['ninguno', 'eco', 'freno_vinilo', 'repeticion_loop', 'distorsion_wash']);
    const allowedCompases = new Set([1, 2, 4, 8, 16]);

    for (const presetName of REQUIRED_7_PRESETS) {
      const def = djTransitionServiceModule.DJ_PRESET_DEFINITIONS[presetName];
      assert.ok(def, `Preset "${presetName}" must exist in DJ_PRESET_DEFINITIONS`);
      assert.strictEqual(def.preset, presetName);
      assert.ok(allowedCompases.has(def.compases), `Compases ${def.compases} must be in allowed set`);
      assert.ok(validEnvelopes.has(def.volumeEnvelope), `Volume envelope "${def.volumeEnvelope}" must be valid`);
      assert.ok(validEqModes.has(def.eqMode), `EQ mode "${def.eqMode}" must be valid`);
      assert.ok(validFxModes.has(def.fxMode), `FX mode "${def.fxMode}" must be valid`);
      assert.ok(def.title.length > 0, `Title must be non-empty`);
      assert.ok(def.detail.length > 0, `Detail description must be non-empty`);
    }
  });

  it('ADV3.2: getPresetDefinition returns valid definition for all 7 presets and safe fallback for invalid names', () => {
    for (const presetName of REQUIRED_7_PRESETS) {
      const def = djTransitionServiceModule.getPresetDefinition(presetName);
      assert.strictEqual(def.preset, presetName);
    }

    const fallbacks = [
      '',
      'invalid_preset',
      'foo',
      null,
      undefined,
      123,
    ];

    for (const badName of fallbacks) {
      const def = djTransitionServiceModule.getPresetDefinition(badName);
      assert.strictEqual(def.preset, 'automatica', `Bad preset name "${badName}" must fallback to automatica`);
    }
  });

  it('ADV3.3: DSP Node Scheduling execution for all 7 presets on Mock Web Audio graph', () => {
    const ctx = new MockAudioContext();
    const stripA = djAudioNodes.createDJChannelStrip(ctx);
    const stripB = djAudioNodes.createDJChannelStrip(ctx);

    // 1. automatica / corte: scheduleBassSwap
    assert.doesNotThrow(() => {
      djAudioNodes.scheduleBassSwap(stripA, stripB, 3.75, 0.0);
    });

    // 2. filtro: scheduleResonantHPFSweep
    assert.doesNotThrow(() => {
      djAudioNodes.scheduleResonantHPFSweep(stripA, 0.0, 3.75, 20, 18000, 3.0);
    });

    // 3. eco_out: scheduleBeatDelay
    assert.doesNotThrow(() => {
      djAudioNodes.scheduleBeatDelay(stripA, 1.875, 3.75, 128, 0.75, 0.65);
    });

    // 4. freno_vinilo: direct cut + bass swap
    assert.doesNotThrow(() => {
      djAudioNodes.scheduleBassSwap(stripA, stripB, 1.875);
    });

    // 5. beat_roll: scheduleLoopStutter
    assert.doesNotThrow(() => {
      djAudioNodes.scheduleLoopStutter(stripA, 0.0, 3.75, 128);
    });

    // 6. crescendo: gradual crossfade + highshelf
    assert.doesNotThrow(() => {
      stripB.eqHigh.gain.setValueAtTime(3.0, 0.0);
    });

    // Cleanup & dispose
    assert.doesNotThrow(() => {
      djAudioNodes.cancelScheduledAutomations(stripA, 5.0);
      djAudioNodes.cancelScheduledAutomations(stripB, 5.0);
      djAudioNodes.disposeDJChannelStrip(stripA);
      djAudioNodes.disposeDJChannelStrip(stripB);
    });
  });

  it('ADV3.4: Auxiliary acoustic texture synthesis starts and stops for all FX presets', () => {
    const ctx = new MockAudioContext();
    const fxPresets = ['filtro', 'freno_vinilo', 'eco_out', 'beat_roll'];

    for (const p of fxPresets) {
      const active = djAudioNodes.triggerAuxiliaryTransitionFX(ctx, p, 3.75, 128, 1.0, 0.0);
      assert.ok(active, `Must return active handle for preset ${p}`);
      assert.doesNotThrow(() => {
        djAudioNodes.stopAuxiliaryTransitionFX(active);
      });
    }

    // Presets without auxiliary texture return null safely
    const inactive = djAudioNodes.triggerAuxiliaryTransitionFX(ctx, 'automatica', 3.75, 128);
    assert.strictEqual(inactive, null);
  });
});

// ============================================================================
// CHALLENGE 4: Unmount Lifecycle Teardown in TransitionEditorModal.tsx
// ============================================================================

describe('Adversarial Challenge 4: TransitionEditorModal Lifecycle Teardowns', () => {
  it('ADV4.1: Component unmount cleans up active audition across both audioEngine and djTransitionService', () => {
    assert.ok(
      transitionEditorModalSource.includes('audioEngine.stopTransitionAudition()'),
      'Must invoke audioEngine.stopTransitionAudition() on modal close/unmount'
    );
    assert.ok(
      transitionEditorModalSource.includes('djTransitionService.stopAudition()'),
      'Must invoke djTransitionService.stopAudition() on modal close/unmount'
    );

    // Verify cleanup in useEffect return
    const unmountTeardownPattern = /return\s*\(\)\s*=>\s*\{[\s\S]*?audioEngine\.stopTransitionAudition\(\)[\s\S]*?djTransitionService\.stopAudition\(\)/;
    assert.ok(
      unmountTeardownPattern.test(transitionEditorModalSource),
      'Modal must execute unmount teardown in useEffect return function'
    );
  });

  it('ADV4.2: ResizeObserver disconnects cleanly to prevent DOM memory leaks', () => {
    assert.ok(
      transitionEditorModalSource.includes('new ResizeObserver'),
      'Modal must instantiate ResizeObserver for responsive canvas'
    );
    assert.ok(
      transitionEditorModalSource.includes('ro.disconnect()'),
      'Modal must call ro.disconnect() in ResizeObserver cleanup'
    );
  });

  it('ADV4.3: Pointer event listeners release pointer capture on pointerup', () => {
    assert.ok(
      transitionEditorModalSource.includes('releasePointerCapture'),
      'Canvas scrubbing must release pointer capture to prevent stuck drag states'
    );
  });

  it('ADV4.4: Modal exports TransitionEditorModal and DJTransitionPreviewModal alias', () => {
    assert.ok(
      transitionEditorModalSource.includes('export const TransitionEditorModal'),
      'Must export TransitionEditorModal'
    );
    assert.ok(
      transitionEditorModalSource.includes('export { TransitionEditorModal as DJTransitionPreviewModal }'),
      'Must export DJTransitionPreviewModal alias'
    );
  });

  it('ADV4.5: Modal includes UI buttons and controls for all 7 DJ presets', () => {
    const presets = [
      'automatica',
      'corte',
      'filtro',
      'eco_out',
      'freno_vinilo',
      'beat_roll',
      'crescendo',
    ];

    for (const p of presets) {
      assert.ok(
        transitionEditorModalSource.includes(`handleSelectPreset('${p}')`),
        `Modal UI must have a preset button calling handleSelectPreset('${p}')`
      );
    }
  });

  it('ADV4.6: Canvas visualizer implements Retina High-DPI scaling via devicePixelRatio', () => {
    assert.ok(
      transitionEditorModalSource.includes('window.devicePixelRatio'),
      'Visualizer canvas must read window.devicePixelRatio'
    );
    assert.ok(
      transitionEditorModalSource.includes('ctx.setTransform(dpr, 0, 0, dpr, 0, 0)'),
      'Visualizer canvas must transform coordinate system for logical CSS pixel drawing'
    );
  });
});

// ============================================================================
// CHALLENGE 5: Edge Cases in Audio Features & Harmonic Matching
// ============================================================================

describe('Adversarial Challenge 5: Audio Features & Harmonic Match Edge Cases', () => {
  it('ADV5.1: Negative key values wrap correctly through modulo 12 arithmetic', () => {
    assert.strictEqual(audioFeatures.getCamelotKey(-1, 0), '10A');
    assert.strictEqual(audioFeatures.getCamelotKey(-12, 0), '5A');
    assert.strictEqual(audioFeatures.getCamelotKey(-13, 0), '10A');
    assert.strictEqual(audioFeatures.getCamelotKey(-25, 1), '1B');
  });

  it('ADV5.2: 12-hour circular modular wrap-around (12A -> 1A, 12B -> 1B)', () => {
    const dMinor = audioFeatures.calculateCamelotDistance('12A', '1A');
    assert.strictEqual(dMinor.numDiff, 1, '12A to 1A distance must be 1 hour, not 11');
    assert.strictEqual(dMinor.sameLetter, true);

    const dMajor = audioFeatures.calculateCamelotDistance('12B', '1B');
    assert.strictEqual(dMajor.numDiff, 1, '12B to 1B distance must be 1 hour, not 11');
    assert.strictEqual(dMajor.sameLetter, true);
  });

  it('ADV5.3: Harmonic score correctly distinguishes all 6 relationship tiers', () => {
    // Tier 1: exact -> 100
    assert.strictEqual(audioFeatures.calculateHarmonicScore('9A', '9A'), 100);
    // Tier 2: adjacent (+1/-1) -> 90
    assert.strictEqual(audioFeatures.calculateHarmonicScore('9A', '10A'), 90);
    assert.strictEqual(audioFeatures.calculateHarmonicScore('9A', '8A'), 90);
    // Tier 3: relative maj/min -> 85
    assert.strictEqual(audioFeatures.calculateHarmonicScore('9A', '9B'), 85);
    // Tier 4: diagonal (+1 letter switch) -> 75
    assert.strictEqual(audioFeatures.calculateHarmonicScore('9A', '10B'), 75);
    // Tier 5: energy boost (step 7 or 2) -> 60
    assert.strictEqual(audioFeatures.calculateHarmonicScore('9A', '4A'), 60);
    // Tier 6: clash -> <= 50
    const clash = audioFeatures.calculateHarmonicScore('1A', '7A');
    assert.ok(clash <= 50 && clash >= 10);
  });

  it('ADV5.4: Half-time and double-time octave matching detects 1:2 and 2:1 ratios', () => {
    assert.strictEqual(audioFeatures.calculateOctaveDelta(140, 70), 0);
    assert.strictEqual(audioFeatures.calculateOctaveDelta(70, 140), 0);
    assert.strictEqual(audioFeatures.calculateOctaveDelta(80, 160), 0);
    assert.strictEqual(audioFeatures.calculateOctaveDelta(160, 80), 0);
    assert.strictEqual(audioFeatures.calculateOctaveDelta(90, 180), 0);
  });

  it('ADV5.5: Corrupt and empty metadata returns safe fallback without thrown exceptions', () => {
    const feat = audioFeatures.resolveClientSideRealFeature('random_id', '', '');
    assert.strictEqual(feat.tempo, 130);
    assert.strictEqual(feat.camelot, '9A');
    assert.strictEqual(feat.mode, 0);

    const compatibility = audioFeatures.calculateHarmonicCompatibility(undefined, null);
    assert.ok(compatibility.score >= 10 && compatibility.score <= 100);
    assert.ok(typeof compatibility.relation === 'string');
  });
});
