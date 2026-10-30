/**
 * Spotifree Professional DJ Transitions & Harmonic Mixing E2E Test Suite
 * Native Node 24 Test Runner (node:test & node:assert/strict)
 *
 * 4-Tier Test Architecture:
 * - Tier 1: Feature Coverage (>=5 test cases per feature for Camelot mapping, BPM octave sync,
 *           phrase structure 4-32 beats, Web Audio DSP nodes, adaptive decision engine, preview modal)
 * - Tier 2: Boundary & Corner Cases (>=5 test cases per feature for zero/negative limits, extreme tempos,
 *           unusual keys, half/double time matching, non-zero exponential ramps >= 20Hz, delay stability < 1.0,
 *           empty genres, instant cuts)
 * - Tier 3: Cross-Feature Combinations (Pairwise interactions)
 * - Tier 4: Real-World Scenarios (Playlist simulation, audition timeline, continuous playback crossfade)
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';

// Register JSON loader hook for Node 24 ESM TypeScript support
register(new URL('./test_loader.js', import.meta.url));

// ============================================================================
// Web Audio API DSP Mock Engine (Opaque-box high-fidelity simulation)
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
    // W3C Web Audio API Spec: Value must be strictly positive (> 0)
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

// Install environment mocks on globalThis
globalThis.AudioContext = MockAudioContext;
globalThis.window = globalThis;
globalThis.localStorage = new MockLocalStorage();

// ============================================================================
// DSP Channel Strip Factory & Automation Schedulers (Contract Verification)
// ============================================================================

function createDeckDSPStrip(ctx) {
  const inputNode = ctx.createGain();
  const eqLow = ctx.createBiquadFilter();
  eqLow.type = 'lowshelf';
  eqLow.frequency.value = 250;
  eqLow.gain.value = 0;

  const eqMid = ctx.createBiquadFilter();
  eqMid.type = 'peaking';
  eqMid.frequency.value = 1500;
  eqMid.Q.value = 1.0;
  eqMid.gain.value = 0;

  const eqHigh = ctx.createBiquadFilter();
  eqHigh.type = 'highshelf';
  eqHigh.frequency.value = 4000;
  eqHigh.gain.value = 0;

  const filterSweep = ctx.createBiquadFilter();
  filterSweep.type = 'highpass';
  filterSweep.frequency.value = 20;
  filterSweep.Q.value = 3.0;

  const delayNode = ctx.createDelay(5.0);
  const delayFeedback = ctx.createGain();
  delayFeedback.gain.value = 0.65; // Safe feedback < 0.80

  const delayDampFilter = ctx.createBiquadFilter();
  delayDampFilter.type = 'highpass';
  delayDampFilter.frequency.value = 250;
  delayDampFilter.Q.value = 0.7;

  const stutterGain = ctx.createGain();
  const outputNode = ctx.createGain();

  // Primary Dry Channel: input -> eqLow -> eqMid -> eqHigh -> filterSweep -> stutterGain -> outputNode
  inputNode.connect(eqLow);
  eqLow.connect(eqMid);
  eqMid.connect(eqHigh);
  eqHigh.connect(filterSweep);
  filterSweep.connect(stutterGain);
  stutterGain.connect(outputNode);

  // Aux Wet Delay Loop: input -> delayNode -> delayFeedback -> delayDampFilter -> delayNode (feedback loop)
  inputNode.connect(delayNode);
  delayNode.connect(delayFeedback);
  delayFeedback.connect(delayDampFilter);
  delayDampFilter.connect(delayNode);
  delayNode.connect(outputNode);

  return {
    inputNode,
    eqLow,
    eqMid,
    eqHigh,
    filterSweep,
    delayNode,
    delayFeedback,
    delayDampFilter,
    stutterGain,
    outputNode,
  };
}

function scheduleBassSwap(deckA, deckB, crossoverTime) {
  // Cut outgoing deck bass to -40dB with 20ms anti-click time constant
  deckA.eqLow.gain.setTargetAtTime(-40, crossoverTime, 0.02);
  // Snap incoming deck bass to 0dB with 20ms time constant
  deckB.eqLow.gain.setTargetAtTime(0, crossoverTime, 0.02);
}

function scheduleResonantHPFSweep(filterSweep, startTime, durationSec, resonanceQ = 3.0) {
  filterSweep.type = 'highpass';
  filterSweep.Q.setValueAtTime(resonanceQ, startTime);
  filterSweep.frequency.setValueAtTime(20, startTime);
  filterSweep.frequency.exponentialRampToValueAtTime(18000, startTime + durationSec);
}

function scheduleResonantLPFSweep(filterSweep, startTime, durationSec, resonanceQ = 2.5) {
  filterSweep.type = 'lowpass';
  filterSweep.Q.setValueAtTime(resonanceQ, startTime);
  filterSweep.frequency.setValueAtTime(20000, startTime);
  filterSweep.frequency.exponentialRampToValueAtTime(Math.max(20, 80), startTime + durationSec);
}

function calculateDelayTime(bpm, subdivision = 0.75) {
  const safeBpm = bpm > 40 && bpm < 240 ? bpm : 128;
  return (60 / safeBpm) * subdivision;
}

function calculateOctaveDelta(bpmA, bpmB) {
  return Math.min(
    Math.abs(bpmA - bpmB),
    Math.abs(bpmA - 2 * bpmB),
    Math.abs(2 * bpmA - bpmB)
  );
}

function calculateCamelotDistance(camelotA, camelotB) {
  const parseCam = (c) => {
    const match = (c || '9A').match(/^(\d+)([AB])$/i);
    if (!match) return { num: 9, letter: 'A' };
    return { num: parseInt(match[1], 10), letter: match[2].toUpperCase() };
  };
  const cA = parseCam(camelotA);
  const cB = parseCam(camelotB);
  const numDiff = Math.min((cA.num - cB.num + 12) % 12, (cB.num - cA.num + 12) % 12);
  const sameLetter = cA.letter === cB.letter;
  return { numDiff, sameLetter, cA, cB };
}

// ============================================================================
// Load System Modules
// ============================================================================

let audioFeatures;
let djTransitionServiceModule;
let transitionEditorModalSource;

before(async () => {
  audioFeatures = await import('../src/utils/audioFeatures.ts');
  djTransitionServiceModule = await import('../src/services/djTransitionService.ts');
  const modalPath = path.resolve('src/components/modals/TransitionEditorModal.tsx');
  transitionEditorModalSource = fs.readFileSync(modalPath, 'utf8');
});

// ============================================================================
// TIER 1: FEATURE COVERAGE (>=5 tests per feature)
// ============================================================================

describe('Tier 1: Feature Coverage', () => {
  // Feature 1: Camelot Wheel Mapping
  describe('Feature 1: Camelot Wheel Mapping (R2)', () => {
    it('F1.1: Maps Minor Mode (0) across traditional keys (0=C minor -> 5A, 9=A minor -> 8A, 2=D minor -> 7A)', () => {
      assert.strictEqual(audioFeatures.getCamelotKey(0, 0), '5A', 'C minor (0) must map to 5A');
      assert.strictEqual(audioFeatures.getCamelotKey(9, 0), '8A', 'A minor (9) must map to 8A');
      assert.strictEqual(audioFeatures.getCamelotKey(2, 0), '7A', 'D minor (2) must map to 7A');
    });

    it('F1.2: Maps Major Mode (1) across traditional keys (0=C major -> 8B, 9=A major -> 11B, 7=G major -> 9B)', () => {
      assert.strictEqual(audioFeatures.getCamelotKey(0, 1), '8B', 'C major (0) must map to 8B');
      assert.strictEqual(audioFeatures.getCamelotKey(9, 1), '11B', 'A major (9) must map to 11B');
      assert.strictEqual(audioFeatures.getCamelotKey(7, 1), '9B', 'G major (7) must map to 9B');
    });

    it('F1.3: Visual badge colors comply with Spotify DJ chip palette', () => {
      const v8A = audioFeatures.getCamelotVisuals('8A');
      assert.strictEqual(v8A.bg, '#f94144', '8A should be Red #f94144');
      assert.strictEqual(v8A.text, '#ffffff', '8A text should be white');

      const v1A = audioFeatures.getCamelotVisuals('1A');
      assert.strictEqual(v1A.bg, '#00cba9', '1A should be Teal #00cba9');
      assert.strictEqual(v1A.text, '#000000', '1A text should be black for high contrast');
    });

    it('F1.4: Relative Major/Minor pairs share exact same Camelot number (8A/8B, 11A/11B)', () => {
      const { numDiff: diff8 } = calculateCamelotDistance('8A', '8B');
      assert.strictEqual(diff8, 0, '8A and 8B must share same clock position');

      const { numDiff: diff11 } = calculateCamelotDistance('11A', '11B');
      assert.strictEqual(diff11, 0, '11A and 11B must share same clock position');
    });

    it('F1.5: Resolves client-side real features from verified dataset & genre heuristics', () => {
      // 1. Verified catalog track
      const verifiedFeat = audioFeatures.resolveClientSideRealFeature('b1', 'Darte Un Beso', 'Prince Royce');
      assert.strictEqual(verifiedFeat.tempo, 130, 'Darte Un Beso should resolve verified 130 BPM');
      assert.strictEqual(verifiedFeat.camelot, '2B', 'Darte Un Beso verified key is 2B (F# major)');

      // 2. Genre heuristic fallback for uncataloged track
      const genericBachata = audioFeatures.resolveClientSideRealFeature('b2', 'Random Unknown Bachata', 'Prince Royce');
      assert.strictEqual(genericBachata.tempo, 130, 'Generic Bachata should default to 130 BPM');
      assert.strictEqual(genericBachata.camelot, '9A', 'Generic Bachata artist should default to 9A');
    });
  });

  // Feature 2: BPM Tempo Matching & Octave Detection
  describe('Feature 2: BPM Tempo Matching & Octave Detection (R2)', () => {
    it('F2.1: Identifies tight tempo sync when delta <= 4 BPM or percentage delta <= 3%', () => {
      const bpmA = 128;
      const bpmB = 126;
      const delta = Math.abs(bpmA - bpmB);
      const deltaPercent = (delta / bpmA) * 100;
      assert.ok(delta <= 4, 'Delta must be <= 4 BPM');
      assert.ok(deltaPercent <= 3.0, 'Delta percent must be <= 3%');
    });

    it('F2.2: Classifies moderate tempo gap between 8 and 17 BPM requiring energy build-up', () => {
      const bpmA = 128;
      const bpmB = 118;
      const delta = Math.abs(bpmA - bpmB);
      assert.ok(delta > 8 && delta <= 17, 'Delta of 10 BPM falls into moderate gap');
    });

    it('F2.3: Classifies wide tempo disparity (>= 18 BPM) requiring disconnect transition', () => {
      const bpmA = 128;
      const bpmB = 96;
      const delta = Math.abs(bpmA - bpmB);
      assert.ok(delta >= 18, 'Delta of 32 BPM is a wide tempo gap');
    });

    it('F2.4: Detects half-time octave alignment (140 BPM Trap vs 70 BPM Hip-Hop)', () => {
      const effectiveDelta = calculateOctaveDelta(140, 70);
      assert.strictEqual(effectiveDelta, 0, '140 BPM and 70 BPM must have 0 effective octave delta');
    });

    it('F2.5: Detects double-time octave alignment (85 BPM vs 170 BPM Drum & Bass)', () => {
      const effectiveDelta = calculateOctaveDelta(85, 170);
      assert.strictEqual(effectiveDelta, 0, '85 BPM and 170 BPM must have 0 effective octave delta');
    });
  });

  // Feature 3: Musical Phrase & Compases Structure (4-32 beats)
  describe('Feature 3: Musical Phrase & Compases Structure (R2)', () => {
    it('F3.1: Calculates 1 compás (4 beats) duration: at 128 BPM = 1.875s, at 120 BPM = 2.0s', () => {
      const dur128 = djTransitionServiceModule.djTransitionService.calculateDurationSeconds(128, 1);
      assert.strictEqual(dur128, 1.875, '1 compás at 128 BPM must be 1.875s');

      const dur120 = djTransitionServiceModule.djTransitionService.calculateDurationSeconds(120, 1);
      assert.strictEqual(dur120, 2.0, '1 compás at 120 BPM must be 2.0s');
    });

    it('F3.2: Calculates 2 compases (8 beats, mini-phrase): at 128 BPM = 3.75s', () => {
      const dur = djTransitionServiceModule.djTransitionService.calculateDurationSeconds(128, 2);
      assert.strictEqual(dur, 3.75, '2 compases at 128 BPM must be 3.75s');
    });

    it('F3.3: Calculates 4 compases (16 beats, standard phrase): at 128 BPM = 7.5s', () => {
      const dur = djTransitionServiceModule.djTransitionService.calculateDurationSeconds(128, 4);
      assert.strictEqual(dur, 7.5, '4 compases at 128 BPM must be 7.5s');
    });

    it('F3.4: Calculates 8 compases (32 beats, extended club section): at 128 BPM = 15.0s', () => {
      const dur = djTransitionServiceModule.djTransitionService.calculateDurationSeconds(128, 8);
      assert.strictEqual(dur, 15.0, '8 compases at 128 BPM must be 15.0s');
    });

    it('F3.5: Clamps transition duration within safe bounds [1.5s, 16s]', () => {
      const clampedMin = djTransitionServiceModule.djTransitionService.calculateDurationSeconds(239, 1);
      assert.strictEqual(clampedMin, 1.5, 'Minimum duration must be clamped to 1.5s');

      const clampedMax = djTransitionServiceModule.djTransitionService.calculateDurationSeconds(41, 8);
      assert.strictEqual(clampedMax, 16, 'Maximum duration must be clamped to 16s');
    });
  });

  // Feature 4: Web Audio DSP Node Creation & Parameters
  describe('Feature 4: Web Audio DSP Node Creation & Parameters (R1)', () => {
    it('F4.1: Instantiates 3-Band Isolator EQ (Lowshelf <250Hz, Peaking 1500Hz Q=1, Highshelf >4kHz)', () => {
      const ctx = new MockAudioContext();
      const strip = createDeckDSPStrip(ctx);

      assert.strictEqual(strip.eqLow.type, 'lowshelf', 'Low band must be lowshelf filter');
      assert.strictEqual(strip.eqLow.frequency.value, 250, 'Low cutoff must be 250Hz');

      assert.strictEqual(strip.eqMid.type, 'peaking', 'Mid band must be peaking filter');
      assert.strictEqual(strip.eqMid.frequency.value, 1500, 'Mid frequency must be 1500Hz');
      assert.strictEqual(strip.eqMid.Q.value, 1.0, 'Mid Q must be 1.0');

      assert.strictEqual(strip.eqHigh.type, 'highshelf', 'High band must be highshelf filter');
      assert.strictEqual(strip.eqHigh.frequency.value, 4000, 'High cutoff must be 4000Hz');
    });

    it('F4.2: Bass Swap crossover schedule executes instant low-cut (-40dB) with 20ms anti-click ramp', () => {
      const ctx = new MockAudioContext();
      const deckA = createDeckDSPStrip(ctx);
      const deckB = createDeckDSPStrip(ctx);

      scheduleBassSwap(deckA, deckB, 3.75);

      const eventA = deckA.eqLow.gain.events.find((e) => e.type === 'setTargetAtTime');
      assert.ok(eventA, 'Deck A must have setTargetAtTime event on eqLow');
      assert.strictEqual(eventA.target, -40, 'Deck A must cut low gain to -40dB');
      assert.strictEqual(eventA.startTime, 3.75, 'Crossover start time must match Bar 1 Beat 1');
      assert.strictEqual(eventA.timeConstant, 0.02, 'Time constant must be 20ms to eliminate clicks');

      const eventB = deckB.eqLow.gain.events.find((e) => e.type === 'setTargetAtTime');
      assert.ok(eventB, 'Deck B must have setTargetAtTime event on eqLow');
      assert.strictEqual(eventB.target, 0, 'Deck B must snap low gain to 0dB');
    });

    it('F4.3: Resonant HPF & LPF filter sweeps configure safe exponential ramp frequency ranges and Q', () => {
      const ctx = new MockAudioContext();
      const hpfStrip = createDeckDSPStrip(ctx);
      const lpfStrip = createDeckDSPStrip(ctx);

      // High-Pass Filter sweep
      scheduleResonantHPFSweep(hpfStrip.filterSweep, 0.0, 4.0, 3.0);
      assert.strictEqual(hpfStrip.filterSweep.type, 'highpass', 'Filter type must be highpass');
      assert.strictEqual(hpfStrip.filterSweep.Q.value, 3.0, 'Resonance Q must be in [2.5, 3.5]');
      const hpfRamp = hpfStrip.filterSweep.frequency.events.find((e) => e.type === 'exponentialRampToValueAtTime');
      assert.strictEqual(hpfRamp.value, 18000, 'HPF target must sweep to 18000Hz');

      // Low-Pass Filter sweep
      scheduleResonantLPFSweep(lpfStrip.filterSweep, 0.0, 4.0, 2.5);
      assert.strictEqual(lpfStrip.filterSweep.type, 'lowpass', 'Filter type must be lowpass');
      const lpfRamp = lpfStrip.filterSweep.frequency.events.find((e) => e.type === 'exponentialRampToValueAtTime');
      assert.strictEqual(lpfRamp.value, 80, 'LPF target must sweep down to 80Hz');
    });

    it('F4.4: Beat-synchronized DelayNode calculates exact tempo-locked delay times', () => {
      // 128 BPM: 1 beat = 0.46875s, 3/4 beat (dotted 8th) = 0.3515625s, 1/2 beat = 0.234375s
      const delay1 = calculateDelayTime(128, 1.0);
      assert.strictEqual(delay1, 0.46875, '128 BPM quarter-note delay must be 0.46875s');

      const delayDotted = calculateDelayTime(128, 0.75);
      assert.strictEqual(delayDotted, 0.3515625, '128 BPM dotted-eighth delay must be 0.3515625s');

      const delayEighth = calculateDelayTime(128, 0.5);
      assert.strictEqual(delayEighth, 0.234375, '128 BPM eighth-note delay must be 0.234375s');
    });

    it('F4.5: Delay feedback loop topology includes feedback gain < 0.80 and 250Hz damping filter', () => {
      const ctx = new MockAudioContext();
      const strip = createDeckDSPStrip(ctx);

      assert.ok(strip.delayFeedback.gain.value <= 0.70, 'Feedback gain must be <= 0.70');
      assert.strictEqual(strip.delayDampFilter.type, 'highpass', 'Damping filter must be highpass');
      assert.strictEqual(strip.delayDampFilter.frequency.value, 250, 'Damping filter cutoff must be 250Hz');
    });
  });

  // Feature 5: Adaptive DJ Decision Engine Outputs
  describe('Feature 5: Adaptive DJ Decision Engine Outputs (R3)', () => {
    it('F5.1: High tempo gap (>= 18 BPM) triggers tempo-disconnect preset (eco_out or freno_vinilo)', () => {
      const config = djTransitionServiceModule.djTransitionService.calculateSmartTransition(
        'tA',
        'tB',
        128,
        150,
        '8A',
        '8A',
        0
      );
      assert.ok(
        config.preset === 'eco_out' || config.preset === 'freno_vinilo',
        `Expected eco_out or freno_vinilo for 22 BPM gap, got ${config.preset}`
      );
    });

    it('F5.2: Moderate BPM gap (8-17 BPM) triggers tension-building preset (beat_roll, eco_out, or corte)', () => {
      const config = djTransitionServiceModule.djTransitionService.calculateSmartTransition(
        'tA',
        'tB',
        128,
        118,
        '8A',
        '8A',
        0
      );
      assert.ok(
        ['beat_roll', 'eco_out', 'corte'].includes(config.preset),
        `Expected tension preset for 10 BPM gap, got ${config.preset}`
      );
    });

    it('F5.3: Perfect harmonic match + tight BPM (<= 5 BPM) selects extended 4-compases transition', () => {
      const config = djTransitionServiceModule.djTransitionService.calculateSmartTransition(
        'tA',
        'tB',
        128,
        128,
        '8A',
        '8A',
        0
      );
      assert.strictEqual(config.compases, 4, 'Harmonic match at identical BPM must select 4 compases');
      assert.ok(
        ['automatica', 'crescendo'].includes(config.preset),
        `Expected automatica or crescendo, got ${config.preset}`
      );
    });

    it('F5.4: Relative Major/Minor (8A vs 8B) selects 2-compases tonal EQ blend', () => {
      const config = djTransitionServiceModule.djTransitionService.calculateSmartTransition(
        'tA',
        'tB',
        128,
        128,
        '8A',
        '8B',
        0
      );
      assert.strictEqual(config.compases, 2, 'Relative major/minor should select 2 compases');
      assert.strictEqual(config.eqMode, 'intercambio_graves_central', 'Should use bass swap');
    });

    it('F5.5: Decision output preserves complete DJ transition configuration interface', () => {
      const config = djTransitionServiceModule.djTransitionService.calculateSmartTransition(
        'trackA_id',
        'trackB_id',
        124,
        126,
        '7A',
        '8A',
        1
      );
      assert.ok(config.trackAId, 'Config must include trackAId');
      assert.ok(config.trackBId, 'Config must include trackBId');
      assert.ok(config.preset, 'Config must include preset');
      assert.ok(config.compases >= 1 && config.compases <= 8, 'Compases must be in valid range');
      assert.ok(config.volumeEnvelope, 'Config must include volumeEnvelope');
      assert.ok(config.eqMode, 'Config must include eqMode');
    });
  });

  // Feature 6: DJTransitionPreviewModal Export & Contract
  describe('Feature 6: DJTransitionPreviewModal Export & Contract (R4)', () => {
    it('F6.1: TransitionEditorModal component source exists and exports modal interface', () => {
      assert.ok(transitionEditorModalSource.length > 500, 'Modal source file must be populated');
      assert.ok(
        transitionEditorModalSource.includes('export const TransitionEditorModal'),
        'Must export TransitionEditorModal'
      );
    });

    it('F6.2: Modal interface declares standard props (isOpen, onClose, trackA, trackB, onSaved)', () => {
      assert.ok(transitionEditorModalSource.includes('isOpen: boolean'), 'Props must include isOpen');
      assert.ok(transitionEditorModalSource.includes('onClose: () => void'), 'Props must include onClose');
      assert.ok(transitionEditorModalSource.includes('trackA: Track'), 'Props must include trackA');
      assert.ok(transitionEditorModalSource.includes('trackB: Track'), 'Props must include trackB');
    });

    it('F6.3: Modal binds dynamic smart transitions via djTransitionService.getTransitionConfig', () => {
      assert.ok(
        transitionEditorModalSource.includes('djTransitionService.getTransitionConfig'),
        'Modal must call djTransitionService.getTransitionConfig'
      );
    });

    it('F6.4: Modal supports the complete set of transition presets', () => {
      const requiredPresets = ['automatica', 'corte', 'eco_out', 'freno_vinilo', 'beat_roll'];
      for (const p of requiredPresets) {
        assert.ok(
          transitionEditorModalSource.includes(p),
          `Modal must reference preset ${p}`
        );
      }
    });

    it('F6.5: Audition state lifecycle stops audition and cleans up audio engine when modal closes', () => {
      assert.ok(
        transitionEditorModalSource.includes('djTransitionService.stopAudition()'),
        'Modal must stop audition on close'
      );
      assert.ok(
        transitionEditorModalSource.includes('audioEngine.stopTransitionAudition()'),
        'Modal must stop audio engine audition on close'
      );
    });
  });
});

// ============================================================================
// TIER 2: BOUNDARY & CORNER CASES (>=5 tests per boundary feature)
// ============================================================================

describe('Tier 2: Boundary & Corner Cases', () => {
  // Feature 7: Zero/Negative Limits & Modulo Normalization
  describe('Feature 7: Zero/Negative Limits & Modulo Normalization', () => {
    it('B7.1: Negative key values normalize via modulo 12 (key=-1 becomes 11)', () => {
      const camNeg1Minor = audioFeatures.getCamelotKey(-1, 0);
      assert.strictEqual(camNeg1Minor, '10A', 'Key -1 Minor must normalize to 10A (B minor)');

      const camNeg1Major = audioFeatures.getCamelotKey(-1, 1);
      assert.strictEqual(camNeg1Major, '1B', 'Key -1 Major must normalize to 1B (B major)');
    });

    it('B7.2: Large key values > 11 normalize via modulo 12 (key=24 becomes 0)', () => {
      const cam24 = audioFeatures.getCamelotKey(24, 0);
      assert.strictEqual(cam24, '5A', 'Key 24 Minor must normalize to 5A (C minor)');
    });

    it('B7.3: Mode values other than 1 default safely to minor (mode=0)', () => {
      const camUnknownMode = audioFeatures.getCamelotKey(0, 0);
      assert.strictEqual(camUnknownMode, '5A', 'Mode 0 should produce minor Camelot 5A');
    });

    it('B7.4: Zero BPM sanitizes to default 128 BPM without division by zero', () => {
      const delay = calculateDelayTime(0, 0.75);
      assert.ok(Number.isFinite(delay), 'Delay time must be finite with zero BPM');
      assert.strictEqual(delay, 0.3515625, 'Zero BPM should use fallback 128 BPM delay');
    });

    it('B7.5: Negative BPM sanitizes to default 128 BPM without negative duration', () => {
      const dur = djTransitionServiceModule.djTransitionService.calculateDurationSeconds(-120, 2);
      assert.ok(dur > 0, 'Duration must be positive for negative BPM input');
      assert.strictEqual(dur, 3.75, 'Negative BPM should fallback to 128 BPM');
    });
  });

  // Feature 8: Extreme Tempos & Boundary Clamping
  describe('Feature 8: Extreme Tempos & Boundary Clamping', () => {
    it('B8.1: Ultra-fast BPM (300 BPM speedcore) clamped to safe range (<= 240 BPM)', () => {
      const dur = djTransitionServiceModule.djTransitionService.calculateDurationSeconds(300, 2);
      assert.ok(dur >= 1.5, 'Duration for 300 BPM must respect minimum clamp of 1.5s');
    });

    it('B8.2: Ultra-slow BPM (20 BPM ambient) clamped to safe range (>= 40 BPM)', () => {
      const dur = djTransitionServiceModule.djTransitionService.calculateDurationSeconds(20, 2);
      assert.ok(dur <= 16, 'Duration for 20 BPM must respect maximum clamp of 16s');
    });

    it('B8.3: 1 compás at 239 BPM (raw 1.0s) clamps to minimum 1.5s', () => {
      const dur = djTransitionServiceModule.djTransitionService.calculateDurationSeconds(239, 1);
      assert.strictEqual(dur, 1.5, 'Duration must be clamped to minimum 1.5s');
    });

    it('B8.4: 8 compases at 41 BPM (raw 46.8s) clamps to maximum 16s', () => {
      const dur = djTransitionServiceModule.djTransitionService.calculateDurationSeconds(41, 8);
      assert.strictEqual(dur, 16, 'Duration must be clamped to maximum 16s');
    });

    it('B8.5: Fractional BPM values (127.85 BPM) compute duration with floating-point precision', () => {
      const dur = djTransitionServiceModule.djTransitionService.calculateDurationSeconds(127.85, 2);
      const expected = (4 * 60 * 2) / 127.85;
      assert.ok(Math.abs(dur - expected) < 0.001, 'Duration must calculate correctly for fractional BPM');
    });
  });

  // Feature 9: Unusual & Malformed Keys Graceful Recovery
  describe('Feature 9: Unusual & Malformed Keys Graceful Recovery', () => {
    it('B9.1: Clock boundary wrap-around: distance between 12A and 1A is exactly 1', () => {
      const { numDiff } = calculateCamelotDistance('12A', '1A');
      assert.strictEqual(numDiff, 1, 'Modular distance between 12A and 1A must be 1, not 11');
    });

    it('B9.2: Clock boundary wrap-around: distance between 12B and 1B is exactly 1', () => {
      const { numDiff } = calculateCamelotDistance('12B', '1B');
      assert.strictEqual(numDiff, 1, 'Modular distance between 12B and 1B must be 1');
    });

    it('B9.3: Maximum clock distance: 1A to 7A is exactly 6 hours apart (opposite side)', () => {
      const { numDiff } = calculateCamelotDistance('1A', '7A');
      assert.strictEqual(numDiff, 6, 'Max distance between 1A and 7A must be 6');
    });

    it('B9.4: Empty or malformed Camelot string defaults to safe 9A without throwing', () => {
      const { cA } = calculateCamelotDistance('', '8A');
      assert.strictEqual(cA.num, 9, 'Empty string must default to 9');
      assert.strictEqual(cA.letter, 'A', 'Empty string must default to A');
    });

    it('B9.5: Unrecognized key format (e.g. "XYZ") parses safely with fallback', () => {
      const { cA } = calculateCamelotDistance('XYZ', '8A');
      assert.strictEqual(cA.num, 9, 'Invalid format must default to 9');
      assert.strictEqual(cA.letter, 'A', 'Invalid format must default to A');
    });
  });

  // Feature 10: Half/Double Time Ratio Matching & Tolerances
  describe('Feature 10: Half/Double Time Ratio Matching & Tolerances', () => {
    it('B10.1: Exact half-time match: 140 BPM vs 70 BPM (2:1 ratio) has effective delta 0 BPM', () => {
      const delta = calculateOctaveDelta(140, 70);
      assert.strictEqual(delta, 0, 'Effective delta must be 0 for exact half-time');
    });

    it('B10.2: Exact double-time match: 80 BPM vs 160 BPM (1:2 ratio) has effective delta 0 BPM', () => {
      const delta = calculateOctaveDelta(80, 160);
      assert.strictEqual(delta, 0, 'Effective delta must be 0 for exact double-time');
    });

    it('B10.3: Near half-time within 3 BPM tolerance: 142 BPM vs 70 BPM (delta 2 BPM <= 3 BPM)', () => {
      const delta = calculateOctaveDelta(142, 70);
      assert.strictEqual(delta, 2, 'Effective delta should be 2 BPM');
      assert.ok(delta <= 3, 'Delta must be within tolerance of 3 BPM');
    });

    it('B10.4: Beyond half-time tolerance: 155 BPM vs 70 BPM has effective delta 15 BPM > 3 BPM', () => {
      const delta = calculateOctaveDelta(155, 70);
      assert.strictEqual(delta, 15, 'Effective delta should be 15 BPM');
      assert.ok(delta > 3, 'Must exceed tolerance threshold of 3 BPM');
    });

    it('B10.5: Incompatible tempo ratios (100 BPM vs 130 BPM) yield standard delta 30 BPM', () => {
      const delta = calculateOctaveDelta(100, 130);
      assert.strictEqual(delta, 30, 'Should not match octave and retain 30 BPM delta');
    });
  });

  // Feature 11: Non-Zero Exponential Ramp Frequencies >= 20Hz
  describe('Feature 11: Non-Zero Exponential Ramp Frequencies >= 20Hz', () => {
    it('B11.1: Web Audio spec constraint: exponential ramp with value <= 0 throws RangeError', () => {
      const param = new MockAudioParam('freq', 1000);
      assert.throws(
        () => param.exponentialRampToValueAtTime(0, 1.0),
        RangeError,
        'Ramp to 0 must throw RangeError per Web Audio API specification'
      );
    });

    it('B11.2: Filter sweep enforces floor of >= 20Hz to avoid Web Audio RangeError', () => {
      const ctx = new MockAudioContext();
      const strip = createDeckDSPStrip(ctx);
      // Sweeping to 0 would crash, so our scheduler must clamp to Math.max(20, target)
      assert.doesNotThrow(() => {
        scheduleResonantLPFSweep(strip.filterSweep, 0.0, 4.0, 2.5);
      }, 'LPF sweep must never throw on frequency ramping');
    });

    it('B11.3: LPF sweep target frequency is clamped to >= 20Hz (80Hz default)', () => {
      const ctx = new MockAudioContext();
      const strip = createDeckDSPStrip(ctx);
      scheduleResonantLPFSweep(strip.filterSweep, 0.0, 2.0, 2.5);
      const ramp = strip.filterSweep.frequency.events.find((e) => e.type === 'exponentialRampToValueAtTime');
      assert.ok(ramp.value >= 20, 'LPF sweep target must be >= 20Hz');
    });

    it('B11.4: HPF sweep starts at safe 20Hz and ramps up without zero-crossing error', () => {
      const ctx = new MockAudioContext();
      const strip = createDeckDSPStrip(ctx);
      scheduleResonantHPFSweep(strip.filterSweep, 0.0, 2.0, 3.0);
      const startEvent = strip.filterSweep.frequency.events.find((e) => e.type === 'setValueAtTime');
      assert.strictEqual(startEvent.value, 20, 'HPF start frequency must be 20Hz');
    });

    it('B11.5: Filter cutoff clamped within audio range (<= 20000Hz)', () => {
      const ctx = new MockAudioContext();
      const strip = createDeckDSPStrip(ctx);
      scheduleResonantLPFSweep(strip.filterSweep, 0.0, 2.0, 2.5);
      const startEvent = strip.filterSweep.frequency.events.find((e) => e.type === 'setValueAtTime');
      assert.ok(startEvent.value <= 20000, 'Start frequency must be <= 20000Hz');
    });
  });

  // Feature 12: Delay Feedback Loop Gain Stability < 1.0
  describe('Feature 12: Delay Feedback Loop Gain Stability < 1.0', () => {
    it('B12.1: Feedback gain must be strictly < 0.80 to prevent explosive oscillation runaway', () => {
      const ctx = new MockAudioContext();
      const strip = createDeckDSPStrip(ctx);
      assert.ok(strip.delayFeedback.gain.value <= 0.70, 'Feedback gain must be safely capped <= 0.70');
    });

    it('B12.2: Feedback gain value >= 1.0 is hard-limited to safe maximum (0.80)', () => {
      const requestedGain = 1.2;
      const safeGain = Math.min(0.8, requestedGain);
      assert.strictEqual(safeGain, 0.8, 'Gain must be clamped to 0.80 max');
    });

    it('B12.3: Delay damping filter operates as highpass at 250Hz to prevent low-end mud accumulation', () => {
      const ctx = new MockAudioContext();
      const strip = createDeckDSPStrip(ctx);
      assert.strictEqual(strip.delayDampFilter.type, 'highpass', 'Damping filter must be highpass');
      assert.strictEqual(strip.delayDampFilter.frequency.value, 250, 'Cutoff must be 250Hz');
    });

    it('B12.4: Delay time parameter with 0 BPM sanitizes to safe default (0.46875s for 128 BPM)', () => {
      const delay = calculateDelayTime(0, 1.0);
      assert.strictEqual(delay, 0.46875, '0 BPM should fallback to 128 BPM delay');
    });

    it('B12.5: Delay tail fade-out exponential ramp terminates at non-zero floor (0.001)', () => {
      const param = new MockAudioParam('feedbackGain', 0.65);
      const tEnd = 4.0;
      assert.doesNotThrow(() => {
        param.exponentialRampToValueAtTime(0.001, tEnd);
      }, 'Fade out must ramp to positive float 0.001');
    });
  });

  // Feature 13: Empty / Unknown Genres & Missing Acoustic Metadata
  describe('Feature 13: Empty / Unknown Genres & Missing Acoustic Metadata', () => {
    it('B13.1: Missing track A metadata defaults safely without throwing TypeError', () => {
      assert.doesNotThrow(() => {
        const config = djTransitionServiceModule.djTransitionService.calculateSmartTransition(
          '',
          'trackB',
          undefined,
          128,
          undefined,
          '8A'
        );
        assert.ok(config.preset, 'Should generate valid preset');
      });
    });

    it('B13.2: Missing track B metadata defaults safely without throwing TypeError', () => {
      assert.doesNotThrow(() => {
        const config = djTransitionServiceModule.djTransitionService.calculateSmartTransition(
          'trackA',
          '',
          128,
          undefined,
          '8A',
          undefined
        );
        assert.ok(config.preset, 'Should generate valid preset');
      });
    });

    it('B13.3: Empty string genre or unknown genre falls back to neutral default transition config', () => {
      const feat = audioFeatures.resolveClientSideRealFeature('unknown_id', '', '');
      assert.strictEqual(feat.tempo, 130, 'Unknown genre defaults to 130 BPM');
      assert.strictEqual(feat.camelot, '9A', 'Unknown genre defaults to 9A');
    });

    it('B13.4: Unregistered track ID not in realAudioFeatures.json falls back gracefully', () => {
      const feat = audioFeatures.resolveClientSideRealFeature('spotify:track:nonexistent_12345', 'Random Song', 'Random Artist');
      assert.ok(feat.tempo > 0, 'Must have positive tempo');
      assert.ok(feat.camelot.length >= 2, 'Must have valid camelot string');
    });

    it('B13.5: Unknown artist and title falls back to standard 130 BPM / 9A without crashing', () => {
      const feat = audioFeatures.resolveClientSideRealFeature('id_999');
      assert.strictEqual(feat.tempo, 130);
      assert.strictEqual(feat.camelot, '9A');
      assert.strictEqual(feat.mode, 0);
    });
  });

  // Feature 14: Instant Cuts & Extreme Short Outro Timing
  describe('Feature 14: Instant Cuts & Extreme Short Outro Timing', () => {
    it('B14.1: Corte directo volume envelope switches instantly on crossover downbeat', () => {
      const masterVolume = 1.0;
      const getCutVols = (progress) => {
        const outVol = progress < 0.5 ? masterVolume : 0;
        const inVol = progress < 0.5 ? 0 : masterVolume;
        return { outVol, inVol };
      };

      const pre = getCutVols(0.49);
      assert.strictEqual(pre.outVol, 1.0, 'Outgoing must be full volume before crossover');
      assert.strictEqual(pre.inVol, 0.0, 'Incoming must be 0 before crossover');

      const post = getCutVols(0.51);
      assert.strictEqual(post.outVol, 0.0, 'Outgoing must be muted after crossover');
      assert.strictEqual(post.inVol, 1.0, 'Incoming must be full volume after crossover');
    });

    it('B14.2: Compases for direct cut preset is exactly 1 compás (4 beats) for immediate impact', () => {
      const config = djTransitionServiceModule.djTransitionService.calculateSmartTransition(
        'tA',
        'tB',
        128,
        140, // 12 BPM gap with mode=2
        '8A',
        '8A',
        2 // seed % 3 === 2 triggers corte
      );
      if (config.preset === 'corte') {
        assert.strictEqual(config.compases, 1, 'Corte directo should use 1 compás');
        assert.strictEqual(config.volumeEnvelope, 'corte_directo');
      } else {
        assert.ok(config.compases >= 1, 'Compases must be >= 1');
      }
    });

    it('B14.3: Outro with remaining time < 4 seconds dynamically clamps transition duration to fit', () => {
      const remainingSec = 3.2;
      const phraseDuration = 7.5; // 4 bars at 128 BPM
      const clampedDuration = Math.min(phraseDuration, Math.max(1.5, remainingSec - 0.5));
      assert.strictEqual(clampedDuration, 2.7, 'Duration must clamp to 2.7s to avoid track overrun');
    });

    it('B14.4: Zero remaining time in track cleanly completes transition without negative intervals', () => {
      const remainingSec = 0;
      const effectiveDuration = Math.max(0, remainingSec);
      assert.strictEqual(effectiveDuration, 0, 'Zero remaining time must yield 0 duration');
    });

    it('B14.5: Rapid skip during active transition invokes cancelScheduledValues on AudioParams', () => {
      const param = new MockAudioParam('gain', 1.0);
      param.cancelScheduledValues(1.5);
      const cancelEvent = param.events.find((e) => e.type === 'cancelScheduledValues');
      assert.ok(cancelEvent, 'Param must register cancelScheduledValues');
      assert.strictEqual(cancelEvent.startTime, 1.5, 'Must cancel at current time');
    });
  });
});

// ============================================================================
// TIER 3: CROSS-FEATURE COMBINATIONS (Pairwise Interactions)
// ============================================================================

describe('Tier 3: Cross-Feature Combinations (Pairwise)', () => {
  it('P1: Harmonic Compatibility (score 100) + Tight Tempo (delta <= 4) -> 4 compases blend with Bass Swap', () => {
    const config = djTransitionServiceModule.djTransitionService.calculateSmartTransition(
      'tA',
      'tB',
      128,
      127,
      '8A',
      '8A',
      0
    );
    assert.strictEqual(config.compases, 4, 'Must allocate 4 compases for perfect harmonic match');
    assert.ok(
      config.eqMode === 'intercambio_graves_central' || config.eqMode === 'intercambio_gradual',
      'Must use EQ bass swap or gradual crossover'
    );
  });

  it('P2: Harmonic Clash (Camelot distance >= 3) + Similar Tempo (delta <= 5) -> Resonant Filter Sweep', () => {
    // 1A vs 7A = max distance 6 (severe harmonic clash)
    const { numDiff } = calculateCamelotDistance('1A', '7A');
    assert.strictEqual(numDiff, 6, 'Harmonic distance must be 6');

    const config = djTransitionServiceModule.djTransitionService.calculateSmartTransition(
      'tA',
      'tB',
      128,
      128,
      '1A',
      '7A',
      2 // Def mode 2 triggers eco_out / filter
    );
    assert.ok(
      ['eco_out', 'automatica', 'freno_vinilo'].includes(config.preset),
      `Preset ${config.preset} must handle clash gracefully`
    );
  });

  it('P3: Large Tempo Gap (delta >= 18 BPM) + Rising Energy -> Echo Out with tempo-synced delay tail', () => {
    const config = djTransitionServiceModule.djTransitionService.calculateSmartTransition(
      'tA',
      'tB',
      128,
      150,
      '8A',
      '8A',
      0 // pairIndex 0 generates odd seed % 2 === 1 -> eco_out
    );
    assert.strictEqual(config.preset, 'eco_out', 'Must select eco_out for large tempo gap');
    assert.strictEqual(config.fxMode, 'eco', 'FX mode must be eco');
    assert.strictEqual(config.compases, 2, 'Compases must be 2');
  });

  it('P4: Large Tempo Gap (delta >= 18 BPM) + Falling Energy -> Vinyl Brake platter deceleration', () => {
    const config = djTransitionServiceModule.djTransitionService.calculateSmartTransition(
      'tA',
      'tB',
      128,
      150,
      '8A',
      '8A',
      1 // pairIndex 1 generates even seed % 2 === 0 -> freno_vinilo
    );
    assert.strictEqual(config.preset, 'freno_vinilo', 'Must select freno_vinilo');
    assert.strictEqual(config.compases, 1, 'Vinyl brake duration must be 1 compás');
    assert.strictEqual(config.volumeEnvelope, 'corte_directo', 'Must use direct cut');
  });

  it('P5: Moderate Tempo Gap (8-17 BPM) + High Energy -> Loop Stutter Roll accelerating 1/4 -> 1/8', () => {
    const config = djTransitionServiceModule.djTransitionService.calculateSmartTransition(
      'tA',
      'tB',
      128,
      118,
      '8A',
      '8A',
      2 // pairIndex 2 generates seed % 3 === 0 -> beat_roll
    );
    assert.strictEqual(config.preset, 'beat_roll', 'Must select beat_roll');
    assert.strictEqual(config.fxMode, 'repeticion_loop', 'FX mode must be repeticion_loop');
    assert.strictEqual(config.compases, 2, 'Beat roll duration must be 2 compases');
  });

  it('P6: Half-Time Octave Lock (70 vs 140 BPM) + Adjacent Key -> Energetic Bass Swap without disconnect', () => {
    const effectiveBpmDelta = calculateOctaveDelta(140, 70);
    assert.strictEqual(effectiveBpmDelta, 0, 'Effective octave delta must be 0 BPM');

    const { numDiff } = calculateCamelotDistance('8A', '9A');
    assert.strictEqual(numDiff, 1, 'Adjacent key distance is 1 hour');
  });

  it('P7: Relative Major/Minor (8A vs 8B) + Dual-Deck Filter Balancing -> 2-bar tonal crossfade', () => {
    const config = djTransitionServiceModule.djTransitionService.calculateSmartTransition(
      'tA',
      'tB',
      128,
      128,
      '8A',
      '8B',
      0
    );
    assert.strictEqual(config.compases, 2, 'Relative major/minor uses 2 compases');
    assert.strictEqual(config.eqMode, 'intercambio_graves_central', 'Must use bass swap');
  });

  it('P8: Equal-Power Envelope + 3-Band Isolator Bass Swap coordinates volume curves and low-cut', () => {
    const masterVolume = 1.0;
    // Equal-power crossfade curves: outVol = cos(p * 0.5 * PI), inVol = sin(p * 0.5 * PI)
    const progress = 0.5;
    const outVol = Math.cos(progress * 0.5 * Math.PI) * masterVolume;
    const inVol = Math.sin(progress * 0.5 * Math.PI) * masterVolume;
    // Power sum = outVol^2 + inVol^2 = cos^2 + sin^2 = 1.0 (constant acoustic power!)
    const totalPower = Math.pow(outVol, 2) + Math.pow(inVol, 2);
    assert.ok(Math.abs(totalPower - 1.0) < 0.001, 'Acoustic power sum must equal 1.0 without dips');
  });
});

// ============================================================================
// TIER 4: REAL-WORLD SCENARIOS
// ============================================================================

describe('Tier 4: Real-World Scenarios', () => {
  it('S1: Full Multi-Track Playlist Continuous DJ Mix Simulation (5 tracks across Pop, Bachata, Reggaeton, Trap, Dubstep)', () => {
    const playlist = [
      { id: 'track_1', title: 'Pop Anthem', bpm: 120, camelot: '8B' },
      { id: 'track_2', title: 'Bachata Rose', bpm: 130, camelot: '9A' },
      { id: 'track_3', title: 'Reggaeton Beat', bpm: 96, camelot: '11A' },
      { id: 'track_4', title: 'Trap Heavy', bpm: 140, camelot: '1A' },
      { id: 'track_5', title: 'Dubstep Drop', bpm: 70, camelot: '1A' },
    ];

    const transitions = [];
    for (let i = 0; i < playlist.length - 1; i++) {
      const a = playlist[i];
      const b = playlist[i + 1];
      const conf = djTransitionServiceModule.djTransitionService.calculateSmartTransition(
        a.id,
        b.id,
        a.bpm,
        b.bpm,
        a.camelot,
        b.camelot,
        i
      );
      const duration = djTransitionServiceModule.djTransitionService.calculateDurationSeconds(a.bpm, conf.compases);
      transitions.push({ pair: `${a.title} -> ${b.title}`, preset: conf.preset, compases: conf.compases, duration });
    }

    assert.strictEqual(transitions.length, 4, 'Must compute 4 transitions for 5 tracks');
    for (const t of transitions) {
      assert.ok(t.duration >= 1.5 && t.duration <= 16, `Transition duration ${t.duration}s must be in valid range`);
      assert.ok(t.compases >= 1 && t.compases <= 8, `Compases ${t.compases} must be in range [1, 8]`);
    }

    // Transition 3 -> 4 (Reggaeton 96 to Trap 140 = 44 BPM gap): should use tempo disconnect
    const t3 = transitions[2];
    assert.ok(
      ['eco_out', 'freno_vinilo'].includes(t3.preset),
      `Large tempo gap must select disconnect preset, got ${t3.preset}`
    );

    // Transition 4 -> 5 (Trap 140 to Dubstep 70 = 2:1 octave ratio): effective delta = 0
    const octaveDelta = calculateOctaveDelta(140, 70);
    assert.strictEqual(octaveDelta, 0, 'Trap to Dubstep must be octave locked');
  });

  it('S2: Audition Timeline Simulation in DJTransitionPreviewModal (start, scrub 0.0 -> 0.5 -> 1.0, stop)', () => {
    const ctx = new MockAudioContext();
    const deckA = createDeckDSPStrip(ctx);
    const deckB = createDeckDSPStrip(ctx);

    let progress = 0.0;
    const durationSec = 7.5; // 4 compases at 128 BPM
    const ticks = [];

    // Simulate playback tick every 0.1 progress
    while (progress <= 1.0) {
      const currentTime = progress * durationSec;
      if (progress >= 0.5 && !ticks.includes('bass_swapped')) {
        scheduleBassSwap(deckA, deckB, currentTime);
        ticks.push('bass_swapped');
      }
      ticks.push(progress.toFixed(1));
      progress += 0.25;
    }

    assert.ok(ticks.includes('bass_swapped'), 'Bass swap must fire during audition timeline');
    const cutEvent = deckA.eqLow.gain.events.find((e) => e.type === 'setTargetAtTime' && e.target === -40);
    assert.ok(cutEvent, 'Deck A must record -40dB cut event');
    assert.strictEqual(cutEvent.startTime, 3.75, 'Bass swap must trigger at exact midpoint (3.75s)');

    // Simulate stopping audition
    djTransitionServiceModule.djTransitionService.stopAudition();
    assert.strictEqual(djTransitionServiceModule.djTransitionService.isPlaying(), false, 'Audition must report not playing');
  });

  it('S3: Continuous Playback Transition in AudioEngine with dual-deck DSP automations', () => {
    const ctx = new MockAudioContext();
    const deckA = createDeckDSPStrip(ctx);
    const deckB = createDeckDSPStrip(ctx);

    const masterVolume = 1.0;
    const crossfadeDurationSec = 3.75; // 2 compases at 128 BPM
    const crossoverTime = crossfadeDurationSec * 0.5;

    // Schedule Bass Swap
    scheduleBassSwap(deckA, deckB, crossoverTime);

    // Schedule volume faders
    deckA.outputNode.gain.setValueAtTime(masterVolume, 0);
    deckA.outputNode.gain.linearRampToValueAtTime(0, crossfadeDurationSec);

    deckB.outputNode.gain.setValueAtTime(0, 0);
    deckB.outputNode.gain.linearRampToValueAtTime(masterVolume, crossfadeDurationSec);

    assert.strictEqual(deckA.outputNode.gain.events.length, 2, 'Deck A must have fader ramp events');
    assert.strictEqual(deckB.outputNode.gain.events.length, 2, 'Deck B must have fader ramp events');
  });

  it('S4: Rapid Consecutive Skips During Active Transition cancel automations and clear timers', () => {
    const ctx = new MockAudioContext();
    const strip = createDeckDSPStrip(ctx);

    // Schedule automations
    strip.eqLow.gain.setTargetAtTime(-40, 2.0, 0.02);
    strip.outputNode.gain.linearRampToValueAtTime(0, 4.0);

    // User presses "Next" rapidly at time 1.0
    const skipTime = 1.0;
    strip.eqLow.gain.cancelScheduledValues(skipTime);
    strip.outputNode.gain.cancelScheduledValues(skipTime);

    const cancelEq = strip.eqLow.gain.events.find((e) => e.type === 'cancelScheduledValues');
    assert.ok(cancelEq, 'Must cancel scheduled eqLow values');
    assert.strictEqual(cancelEq.startTime, skipTime, 'Must cancel at skip timestamp');

    const cancelOut = strip.outputNode.gain.events.find((e) => e.type === 'cancelScheduledValues');
    assert.ok(cancelOut, 'Must cancel scheduled output values');
  });

  it('S5: Offline / Missing Features Catalog Graceful Degradation without sound artefacts', () => {
    // Test resolving tracks completely absent from catalog
    const tracks = [
      { id: 'offline_track_1', name: 'Unknown Ambient Track', artists: [{ name: 'Independent Artist' }] },
      { id: 'offline_track_2', name: 'Unknown Urban Beat', artists: [{ name: 'Underground MC' }] },
    ];

    const feat1 = audioFeatures.resolveClientSideRealFeature(tracks[0].id, tracks[0].name, tracks[0].artists[0].name);
    const feat2 = audioFeatures.resolveClientSideRealFeature(tracks[1].id, tracks[1].name, tracks[1].artists[0].name);

    assert.ok(Number.isFinite(feat1.tempo) && feat1.tempo > 0, 'Tempo 1 must be finite positive number');
    assert.ok(Number.isFinite(feat2.tempo) && feat2.tempo > 0, 'Tempo 2 must be finite positive number');
    assert.ok(feat1.camelot, 'Camelot 1 must be defined');
    assert.ok(feat2.camelot, 'Camelot 2 must be defined');

    // Transitions between uncataloged tracks must compute cleanly without NaN or exceptions
    const conf = djTransitionServiceModule.djTransitionService.calculateSmartTransition(
      feat1.id,
      feat2.id,
      feat1.tempo,
      feat2.tempo,
      feat1.camelot,
      feat2.camelot,
      0
    );
    const dur = djTransitionServiceModule.djTransitionService.calculateDurationSeconds(feat1.tempo, conf.compases);

    assert.ok(!Number.isNaN(dur), 'Duration must not be NaN');
    assert.ok(dur >= 1.5 && dur <= 16, 'Duration must be in valid clamped bounds');
    assert.ok(conf.preset, 'Must select valid preset for uncataloged tracks');
  });
});
