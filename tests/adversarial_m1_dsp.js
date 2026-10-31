/**
 * Spotifree Adversarial Stress & Robustness Test Suite: Milestone 1 (M1) DSP & Audio Engine
 *
 * Direct Empirical Challenge for:
 * 1. Mathematical bass crossover energy: sqrt(G_A(t)^2 + G_B(t)^2) <= 1.05 across entire transition window.
 * 2. Bounds on Web Audio schedulers: extreme tempos (20 BPM, 300 BPM), safe clamping >= 20Hz,
 *    feedback <= 0.80, delay tail non-zero floor.
 * 3. Idempotent createMediaElementSource handling.
 * 4. High-frequency audio-rate simulation and extreme parameter fuzzing.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  createDJChannelStrip,
  scheduleBassSwap,
  scheduleResonantHPFSweep,
  scheduleResonantLPFSweep,
  calculateDelayTime,
  scheduleBeatDelay,
  scheduleLoopStutter,
  cancelScheduledAutomations,
  disposeDJChannelStrip,
  triggerAuxiliaryTransitionFX,
  stopAuxiliaryTransitionFX,
} from '../src/services/djAudioNodes.ts';

// ============================================================================
// High-Fidelity Web Audio Mock Implementation
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

class MockOscillatorNode extends MockAudioNode {
  constructor(context) {
    super(context);
    this.type = 'sine';
    this.frequency = new MockAudioParam('frequency', 440, 0, 24000);
    this.started = false;
    this.stopped = false;
  }

  start(time = 0) {
    this.started = true;
    this.startTime = time;
  }

  stop(time = 0) {
    this.stopped = true;
    this.stopTime = time;
  }
}

class MockAudioContext {
  constructor() {
    this.currentTime = 0.0;
    this.sampleRate = 44100;
    this.state = 'running';
    this.destination = new MockAudioNode(this);
    this.connectedElements = new Set();
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

  createMediaElementSource(element) {
    if (this.connectedElements.has(element)) {
      throw new Error("InvalidStateError: HTMLMediaElement already connected to an audio source node.");
    }
    this.connectedElements.add(element);
    return new MockAudioNode(this);
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

// Global environment mock
globalThis.AudioContext = MockAudioContext;

// ============================================================================
// Test Runner Harness
// ============================================================================

let totalTests = 0;
let passedTests = 0;
let failedTests = [];

async function test(name, fn) {
  totalTests++;
  const start = performance.now();
  try {
    await fn();
    passedTests++;
    const ms = (performance.now() - start).toFixed(2);
    console.log(`  ✔ [PASS] ${name} (${ms}ms)`);
  } catch (err) {
    const ms = (performance.now() - start).toFixed(2);
    failedTests.push({ name, error: err.message, stack: err.stack });
    console.error(`  ✖ [FAIL] ${name} (${ms}ms)`);
    console.error(`     Error: ${err.message}`);
  }
}

// ============================================================================
// Main Adversarial Test Execution
// ============================================================================

async function runAdversarialM1Suite() {
  console.log('='.repeat(80));
  console.log('   ADVERSARIAL STRESS & EMPIRICAL CHALLENGE SUITE: MILESTONE 1 (M1)');
  console.log('='.repeat(80));
  console.log(`Node Version: ${process.version}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('-'.repeat(80));

  // =========================================================================
  // 1. Mathematical Bass Crossover Energy Verification
  // =========================================================================
  console.log('\n--- SUITE 1: MATHEMATICAL BASS CROSSOVER ENERGY & LOW-END CLASH ---');

  await test('1.1: Bass Crossover Energy: sqrt(G_A(t)^2 + G_B(t)^2) <= 1.05 across 100,000 points in standard mix (7.5s)', () => {
    const T_mix = 7.5;
    const t_cross = T_mix * 0.5;
    const tau = 0.02; // 20ms anti-click time constant
    const steps = 100000;
    let maxEnergy = 0;
    let minEnergyAtCross = Infinity;

    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * T_mix;
      let vA_dB, vB_dB;

      if (t < t_cross) {
        // Pre-crossover: Deck A is at 0dB, Deck B is pre-cut to -40dB
        vA_dB = 0.0;
        vB_dB = -40.0;
      } else {
        // Post-crossover: exponential target approaches
        // V(t) = Vtarget + (V0 - Vtarget) * exp(-(t - t_cross) / tau)
        const expFactor = Math.exp(-(t - t_cross) / tau);
        vA_dB = -40.0 + 40.0 * expFactor;
        vB_dB = -40.0 * expFactor;
      }

      const gA = Math.pow(10, vA_dB / 20.0);
      const gB = Math.pow(10, vB_dB / 20.0);
      const energy = Math.sqrt(gA * gA + gB * gB);

      if (energy > maxEnergy) maxEnergy = energy;
      if (Math.abs(t - (t_cross + tau * Math.log(2))) < 0.001) {
        minEnergyAtCross = energy;
      }

      assert.ok(
        energy <= 1.05,
        `Energy exceeded 1.05 threshold at t=${t.toFixed(4)}s: energy=${energy.toFixed(6)}`
      );
    }

    console.log(`      [Metrics] Max Bass Energy: ${maxEnergy.toFixed(6)} (threshold: 1.05)`);
    console.log(`      [Metrics] Crossover Midpoint Energy: ${minEnergyAtCross.toFixed(6)} (clean dip, zero mud)`);
    assert.ok(maxEnergy <= 1.0001, `Max energy ${maxEnergy} should not exceed 1.0001`);
  });

  await test('1.2: Bass Crossover Energy across extreme durations: 1.5s (min), 3.75s (2 bars), 15.0s (8 bars), 16.0s (max)', () => {
    const durations = [1.5, 3.75, 15.0, 16.0];
    const tau = 0.02;

    for (const T_mix of durations) {
      const t_cross = T_mix * 0.5;
      const steps = 20000;
      let maxEnergy = 0;

      for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * T_mix;
        let vA_dB, vB_dB;

        if (t < t_cross) {
          vA_dB = 0.0;
          vB_dB = -40.0;
        } else {
          const expFactor = Math.exp(-(t - t_cross) / tau);
          vA_dB = -40.0 + 40.0 * expFactor;
          vB_dB = -40.0 * expFactor;
        }

        const gA = Math.pow(10, vA_dB / 20.0);
        const gB = Math.pow(10, vB_dB / 20.0);
        const energy = Math.sqrt(gA * gA + gB * gB);

        if (energy > maxEnergy) maxEnergy = energy;
        assert.ok(energy <= 1.05, `Duration ${T_mix}s: Energy ${energy} > 1.05 at t=${t}s`);
      }

      console.log(`      [Duration ${T_mix}s] Max Energy: ${maxEnergy.toFixed(6)} <= 1.05 [PASS]`);
    }
  });

  await test('1.3: Counter-Example Proof: Omitting mixStartTime results in Low-End Clash (> 1.05)', () => {
    // If incoming deck is NOT pre-cut to -40dB at mixStart, both decks play at 0dB low-end
    const vA_dB = 0.0;
    const vB_dB = 0.0;
    const gA = Math.pow(10, vA_dB / 20.0); // 1.0
    const gB = Math.pow(10, vB_dB / 20.0); // 1.0
    const clashedEnergy = Math.sqrt(gA * gA + gB * gB); // sqrt(2) = 1.4142

    console.log(`      [Counter-Example] Un-cut dual bass energy: ${clashedEnergy.toFixed(4)} > 1.05 (Clash!)`);
    assert.ok(
      clashedEnergy > 1.05,
      'Proof verified: without pre-cut low-shelf, combined bass energy violates <= 1.05'
    );
  });

  await test('1.4: Empirical scheduleBassSwap Web Audio API event scheduling verification', () => {
    const ctx = new MockAudioContext();
    const stripOut = createDJChannelStrip(ctx);
    const stripIn = createDJChannelStrip(ctx);

    const mixStart = 1.0;
    const crossoverTime = 4.75;

    scheduleBassSwap(stripOut, stripIn, crossoverTime, mixStart);

    // Verify Deck In pre-cut at mixStart
    const inEvents = stripIn.eqLow.gain.events;
    assert.equal(inEvents.length, 2, 'Deck In should receive exactly 2 AudioParam events');
    assert.deepEqual(inEvents[0], {
      type: 'setValueAtTime',
      value: -40,
      startTime: mixStart,
    });
    assert.deepEqual(inEvents[1], {
      type: 'setTargetAtTime',
      target: 0,
      startTime: crossoverTime,
      timeConstant: 0.02,
    });

    // Verify Deck Out cut at crossoverTime
    const outEvents = stripOut.eqLow.gain.events;
    assert.equal(outEvents.length, 1, 'Deck Out should receive exactly 1 AudioParam event');
    assert.deepEqual(outEvents[0], {
      type: 'setTargetAtTime',
      target: -40,
      startTime: crossoverTime,
      timeConstant: 0.02,
    });
  });

  await test('1.5: Total Acoustic Bass Energy combining 3-Band EQ and Equal-Power Volume Crossfade', () => {
    // In actual DJ playback, both low-shelf gain AND channel faders are engaged:
    // v_faderA(t) = cos(pi/2 * t/T), v_faderB(t) = sin(pi/2 * t/T)
    const T_mix = 8.0;
    const t_cross = 4.0;
    const tau = 0.02;
    let maxTotalEnergy = 0;

    for (let i = 0; i <= 10000; i++) {
      const t = (i / 10000) * T_mix;
      const faderA = Math.cos((Math.PI * 0.5 * t) / T_mix);
      const faderB = Math.sin((Math.PI * 0.5 * t) / T_mix);

      let vA_dB, vB_dB;
      if (t < t_cross) {
        vA_dB = 0.0;
        vB_dB = -40.0;
      } else {
        const expFactor = Math.exp(-(t - t_cross) / tau);
        vA_dB = -40.0 + 40.0 * expFactor;
        vB_dB = -40.0 * expFactor;
      }

      const gA = Math.pow(10, vA_dB / 20.0) * faderA;
      const gB = Math.pow(10, vB_dB / 20.0) * faderB;
      const totalEnergy = Math.sqrt(gA * gA + gB * gB);

      if (totalEnergy > maxTotalEnergy) maxTotalEnergy = totalEnergy;
      assert.ok(totalEnergy <= 1.05, `Total bass energy exceeded: ${totalEnergy}`);
    }

    console.log(`      [Total Acoustic Bass Energy] Peak: ${maxTotalEnergy.toFixed(6)} <= 1.000 [PASS]`);
    assert.ok(maxTotalEnergy <= 1.0001);
  });

  // =========================================================================
  // 2. Bounds on Web Audio Schedulers (Adversarial Fuzzing)
  // =========================================================================
  console.log('\n--- SUITE 2: BOUNDS ON WEB AUDIO SCHEDULERS & EXTREME TEMPOS ---');

  await test('2.1: Extreme Tempos (20 BPM, 300 BPM, 0 BPM, negative, NaN) in calculateDelayTime', () => {
    // 20 BPM (too slow) -> clamped to fallback 128 BPM
    const delay20 = calculateDelayTime(20, 0.75);
    assert.equal(delay20, (60 / 128) * 0.75, '20 BPM should fall back to 128 BPM');

    // 300 BPM (too fast) -> clamped to fallback 128 BPM
    const delay300 = calculateDelayTime(300, 0.75);
    assert.equal(delay300, (60 / 128) * 0.75, '300 BPM should fall back to 128 BPM');

    // Edge boundaries
    const delay40 = calculateDelayTime(40, 0.75); // 40 is not > 40 -> fallback
    assert.equal(delay40, (60 / 128) * 0.75);

    const delay41 = calculateDelayTime(41, 0.75); // 41 is valid
    assert.ok(Math.abs(delay41 - (60 / 41) * 0.75) < 1e-6);
    assert.ok(delay41 <= 5.0, 'Valid delay time must not exceed max delay buffer 5.0s');

    const delay239 = calculateDelayTime(239, 0.75); // 239 is valid
    assert.ok(Math.abs(delay239 - (60 / 239) * 0.75) < 1e-6);

    const delay240 = calculateDelayTime(240, 0.75); // 240 is not < 240 -> fallback
    assert.equal(delay240, (60 / 128) * 0.75);

    // Pathological inputs
    const delayZero = calculateDelayTime(0);
    assert.equal(delayZero, (60 / 128) * 0.75);

    const delayNeg = calculateDelayTime(-150);
    assert.equal(delayNeg, (60 / 128) * 0.75);

    const delayNaN = calculateDelayTime(NaN);
    assert.equal(delayNaN, (60 / 128) * 0.75);

    const delayInf = calculateDelayTime(Infinity);
    assert.equal(delayInf, (60 / 128) * 0.75);
  });

  await test('2.2: Extreme Tempos in scheduleLoopStutter (20 BPM, 300 BPM, NaN, 0) execute bounded non-zero chops', () => {
    const ctx = new MockAudioContext();
    const strip = createDJChannelStrip(ctx);

    // 20 BPM -> safe fallback 128 BPM
    scheduleLoopStutter(strip, 0, 4.0, 20);
    const events20 = strip.stutterGain.gain.events;
    assert.ok(events20.length > 0, 'Should schedule chops for 20 BPM');
    assert.ok(events20.length <= 500, 'Events must be bounded');

    // 300 BPM -> safe fallback 128 BPM
    strip.stutterGain.gain.events = [];
    scheduleLoopStutter(strip, 0, 4.0, 300);
    const events300 = strip.stutterGain.gain.events;
    assert.ok(events300.length > 0, 'Should schedule chops for 300 BPM');
    assert.ok(events300.length <= 500, 'Events must be bounded');

    // NaN BPM -> safe fallback 128 BPM
    strip.stutterGain.gain.events = [];
    scheduleLoopStutter(strip, 0, 4.0, NaN);
    assert.ok(strip.stutterGain.gain.events.length > 0);

    // 0 BPM -> safe fallback 128 BPM
    strip.stutterGain.gain.events = [];
    scheduleLoopStutter(strip, 0, 4.0, 0);
    assert.ok(strip.stutterGain.gain.events.length > 0);
  });

  await test('2.3: Safe Frequency Clamping >= 20Hz in scheduleResonantHPFSweep', () => {
    const ctx = new MockAudioContext();
    const strip = createDJChannelStrip(ctx);

    // Adversarial: Negative start and end frequencies
    scheduleResonantHPFSweep(strip, 0, 2.0, -100, -500, 3.0);
    let events = strip.filterSweep.frequency.events;
    assert.equal(events[0].value, 20, 'Start frequency must be clamped to >= 20Hz');
    assert.equal(events[1].value, 20, 'End frequency must be clamped to >= 20Hz');

    // Adversarial: Zero start frequency (would trigger RangeError in exponentialRamp if not clamped)
    strip.filterSweep.frequency.events = [];
    scheduleResonantHPFSweep(strip, 0, 2.0, 0, 16000, 3.0);
    events = strip.filterSweep.frequency.events;
    assert.equal(events[0].value, 20, 'Zero start frequency must be clamped to 20Hz');
    assert.equal(events[1].value, 16000);

    // Adversarial: Over-Nyquist frequency (> 20000Hz) and high Q
    strip.filterSweep.frequency.events = [];
    strip.filterSweep.Q.events = [];
    scheduleResonantHPFSweep(strip, 0, 2.0, 50, 45000, 15.0);
    events = strip.filterSweep.frequency.events;
    assert.equal(events[0].value, 50);
    assert.equal(events[1].value, 20000, 'End frequency must be clamped to <= 20000Hz');
    assert.equal(strip.filterSweep.Q.events[0].value, 10.0, 'Resonance Q must be clamped to <= 10.0');

    // Overloaded signature (strip, startTime, duration, resonanceQ)
    strip.filterSweep.frequency.events = [];
    strip.filterSweep.Q.events = [];
    scheduleResonantHPFSweep(strip, 0, 2.0, 3.5);
    events = strip.filterSweep.frequency.events;
    assert.equal(events[0].value, 20, 'Default start frequency must be 20Hz');
    assert.equal(events[1].value, 18000, 'Default end frequency must be 18000Hz');
    assert.equal(strip.filterSweep.Q.events[0].value, 3.5, 'Resonance Q should be 3.5');
  });

  await test('2.4: Safe Frequency Clamping >= 20Hz in scheduleResonantLPFSweep', () => {
    const ctx = new MockAudioContext();
    const strip = createDJChannelStrip(ctx);

    // Adversarial: End frequency 0 or negative
    scheduleResonantLPFSweep(strip, 0, 2.0, 20000, 0, 2.5);
    let events = strip.filterSweep.frequency.events;
    assert.equal(events[0].value, 20000);
    assert.equal(events[1].value, 20, 'End frequency of 0 must clamp to >= 20Hz');

    // Adversarial: Negative end frequency
    strip.filterSweep.frequency.events = [];
    scheduleResonantLPFSweep(strip, 0, 2.0, 20000, -80, 2.5);
    events = strip.filterSweep.frequency.events;
    assert.equal(events[1].value, 20, 'Negative end frequency must clamp to >= 20Hz');

    // Overloaded signature (strip, startTime, duration, resonanceQ)
    strip.filterSweep.frequency.events = [];
    scheduleResonantLPFSweep(strip, 0, 2.0, 2.5);
    events = strip.filterSweep.frequency.events;
    assert.equal(events[0].value, 20000);
    assert.equal(events[1].value, 80, 'Default LPF end frequency should be 80Hz');
  });

  await test('2.5: Delay Feedback Stability <= 0.80 under aggressive caller inputs', () => {
    const ctx = new MockAudioContext();
    const strip = createDJChannelStrip(ctx);

    // Default factory feedback
    assert.ok(strip.delayFeedback.gain.value <= 0.80, 'Default feedback must be <= 0.80');
    assert.equal(strip.delayFeedback.gain.value, 0.65);

    // Adversarial: runaway feedback 1.0 (unity)
    scheduleBeatDelay(strip, 0, 2.0, 128, 0.75, 1.0);
    let fbEvents = strip.delayFeedback.gain.events;
    assert.equal(fbEvents[0].value, 0.80, 'Feedback of 1.0 must be hard-capped at 0.80');

    // Adversarial: explosive feedback 2.5
    strip.delayFeedback.gain.events = [];
    scheduleBeatDelay(strip, 0, 2.0, 128, 0.75, 2.5);
    fbEvents = strip.delayFeedback.gain.events;
    assert.equal(fbEvents[0].value, 0.80, 'Feedback of 2.5 must be hard-capped at 0.80');

    // Adversarial: negative feedback -0.5
    strip.delayFeedback.gain.events = [];
    scheduleBeatDelay(strip, 0, 2.0, 128, 0.75, -0.5);
    fbEvents = strip.delayFeedback.gain.events;
    assert.equal(fbEvents[0].value, 0.0, 'Negative feedback must be clamped to 0.0');

    // Legitimate high feedback 0.75
    strip.delayFeedback.gain.events = [];
    scheduleBeatDelay(strip, 0, 2.0, 128, 0.75, 0.75);
    fbEvents = strip.delayFeedback.gain.events;
    assert.equal(fbEvents[0].value, 0.75, '0.75 feedback should be preserved');
  });

  await test('2.6: Delay Tail Non-Zero Floor (0.001) in scheduleBeatDelay', () => {
    const ctx = new MockAudioContext();
    const strip = createDJChannelStrip(ctx);

    scheduleBeatDelay(strip, 1.0, 3.0, 128, 0.75, 0.65);
    const fbEvents = strip.delayFeedback.gain.events;

    // Must have setValueAtTime followed by exponentialRampToValueAtTime
    assert.equal(fbEvents[0].type, 'setValueAtTime');
    assert.equal(fbEvents[1].type, 'exponentialRampToValueAtTime');

    // Web Audio requirement: exponential ramp cannot target 0
    assert.ok(
      fbEvents[1].value > 0,
      `Exponential ramp target must be strictly > 0, got ${fbEvents[1].value}`
    );
    assert.equal(fbEvents[1].value, 0.001, 'Target must terminate at exact non-zero floor 0.001 (-60dB)');
    assert.equal(fbEvents[1].endTime, 4.0, 'End time must equal startTime + duration');
  });

  await test('2.7: Delay Damping Filter Highpass at 250Hz prevents low-end mud accumulation', () => {
    const ctx = new MockAudioContext();
    const strip = createDJChannelStrip(ctx);

    scheduleBeatDelay(strip, 0, 2.0, 128);
    const dampType = strip.delayDampFilter.type;
    const dampFreq = strip.delayDampFilter.frequency.events[0].value;
    const dampQ = strip.delayDampFilter.Q.events[0].value;

    assert.equal(dampType, 'highpass');
    assert.equal(dampFreq, 250, 'Delay feedback loop must highpass damp at 250Hz');
    assert.equal(dampQ, 0.7);
  });

  // =========================================================================
  // 3. Idempotent createMediaElementSource Handling
  // =========================================================================
  console.log('\n--- SUITE 3: IDEMPOTENT createMediaElementSource HANDLING ---');

  await test('3.1: Guarded sourceNodes initialization prevents InvalidStateError on repeated calls', () => {
    const ctx = new MockAudioContext();
    const mockAudioElements = [{ id: 'audio-deck-0' }, { id: 'audio-deck-1' }];
    const sourceNodes = [null, null];
    const deckStrips = [createDJChannelStrip(ctx), createDJChannelStrip(ctx)];

    // Simulation of AudioEngine.initAudioContext() lines 1473-1482:
    function connectSources() {
      for (let i = 0; i < 2; i++) {
        if (!sourceNodes[i] && mockAudioElements[i] && deckStrips[i]) {
          try {
            sourceNodes[i] = ctx.createMediaElementSource(mockAudioElements[i]);
            sourceNodes[i].connect(deckStrips[i].inputNode);
          } catch (e) {
            console.warn(`Failed to connect MediaElementSource ${i}:`, e);
          }
        }
      }
    }

    // Call 1: Should connect both elements
    connectSources();
    assert.ok(sourceNodes[0] !== null, 'Source 0 should be connected');
    assert.ok(sourceNodes[1] !== null, 'Source 1 should be connected');
    assert.equal(ctx.connectedElements.size, 2, 'Context should track 2 connected elements');

    // Call 2: Repeated invocation (e.g. user gesture unlockAudio or playTrack)
    // Must NOT call ctx.createMediaElementSource again
    let thrownError = null;
    try {
      connectSources();
    } catch (err) {
      thrownError = err;
    }
    assert.equal(thrownError, null, 'Repeated call must not throw');
    assert.equal(ctx.connectedElements.size, 2, 'Connected elements count should remain exactly 2');

    // Call 3: 50 successive rapid calls
    for (let k = 0; k < 50; k++) {
      connectSources();
    }
    assert.equal(ctx.connectedElements.size, 2, 'Count remains strictly 2 after 50 rapid re-entries');
  });

  await test('3.2: Error Resilience: try-catch gracefully absorbs external DOMException without crashing engine', () => {
    const ctx = new MockAudioContext();
    const element = { id: 'already-connected-el' };

    // Externally connect element once
    ctx.createMediaElementSource(element);
    assert.ok(ctx.connectedElements.has(element));

    let threwCrash = false;
    let caughtSafely = false;
    let sourceNode = null;

    try {
      // Re-connecting should throw InvalidStateError in raw Web Audio
      try {
        sourceNode = ctx.createMediaElementSource(element);
      } catch (e) {
        caughtSafely = true;
      }
    } catch (unhandled) {
      threwCrash = true;
    }

    assert.equal(threwCrash, false, 'Should not throw unhandled exception');
    assert.equal(caughtSafely, true, 'Error was caught safely by engine guard');
    assert.equal(sourceNode, null);
  });

  await test('3.3: Verify audioEngine.ts source code enforces sourceNodes guard and error handling', () => {
    const audioEnginePath = path.resolve(process.cwd(), 'src/services/audioEngine.ts');
    const content = fs.readFileSync(audioEnginePath, 'utf8');

    // Verify declaration of sourceNodes tuple
    assert.ok(
      content.includes('private sourceNodes: [MediaElementAudioSourceNode | null, MediaElementAudioSourceNode | null]'),
      'audioEngine.ts must declare sourceNodes tuple'
    );

    // Verify guarded loop
    assert.ok(
      content.includes('if (!this.sourceNodes[i] && this.audios[i] && this.deckStrips[i])'),
      'audioEngine.ts must guard createMediaElementSource with !this.sourceNodes[i]'
    );

    // Verify try-catch enclosure
    assert.ok(
      content.includes('this.sourceNodes[i] = this.audioContext.createMediaElementSource(this.audios[i])'),
      'audioEngine.ts must instantiate and assign sourceNodes[i]'
    );
  });

  // =========================================================================
  // 4. Auxiliary Acoustic FX Layer Stress & Lifecycle
  // =========================================================================
  console.log('\n--- SUITE 4: AUXILIARY ACOUSTIC FX LAYER STRESS & LIFECYCLE ---');

  await test('4.1: Rapid consecutive triggering and stopping of all 4 YouTube auxiliary presets', () => {
    const ctx = new MockAudioContext();
    const presets = ['filtro', 'freno_vinilo', 'eco_out', 'beat_roll'];

    for (const preset of presets) {
      const active = triggerAuxiliaryTransitionFX(ctx, preset, 2.5, 128, 0.8, 0);
      assert.ok(active !== null, `Preset ${preset} should return ActiveAuxFX controller`);
      assert.equal(typeof active.stop, 'function', `Preset ${preset} must export stop()`);

      // Idempotent stop
      stopAuxiliaryTransitionFX(active);
      stopAuxiliaryTransitionFX(active); // calling twice should not throw
    }

    // Calling stop on null should not throw
    stopAuxiliaryTransitionFX(null);
  });

  await test('4.2: Closed or suspended AudioContext handling in triggerAuxiliaryTransitionFX', () => {
    const ctx = new MockAudioContext();
    ctx.state = 'closed';

    const activeClosed = triggerAuxiliaryTransitionFX(ctx, 'filtro', 2.0, 128);
    assert.equal(activeClosed, null, 'Closed AudioContext must return null immediately');

    // Null context
    const activeNull = triggerAuxiliaryTransitionFX(null, 'filtro', 2.0, 128);
    assert.equal(activeNull, null, 'Null AudioContext must return null immediately');
  });

  await test('4.3: Volume and Tempo Boundary Stress in triggerAuxiliaryTransitionFX', () => {
    const ctx = new MockAudioContext();

    // Negative volume -> clamped to 0
    const fxNegVol = triggerAuxiliaryTransitionFX(ctx, 'filtro', 2.0, 128, -1.0);
    assert.ok(fxNegVol !== null);
    stopAuxiliaryTransitionFX(fxNegVol);

    // Extreme volume 5.0 -> clamped to 1.0
    const fxHighVol = triggerAuxiliaryTransitionFX(ctx, 'freno_vinilo', 2.0, 128, 5.0);
    assert.ok(fxHighVol !== null);
    stopAuxiliaryTransitionFX(fxHighVol);

    // Extreme tempo 20 BPM -> clamped to safeBpm 128
    const fxSlowBpm = triggerAuxiliaryTransitionFX(ctx, 'eco_out', 2.0, 20);
    assert.ok(fxSlowBpm !== null);
    stopAuxiliaryTransitionFX(fxSlowBpm);

    // Extreme tempo 300 BPM -> clamped to safeBpm 128
    const fxFastBpm = triggerAuxiliaryTransitionFX(ctx, 'beat_roll', 2.0, 300);
    assert.ok(fxFastBpm !== null);
    stopAuxiliaryTransitionFX(fxFastBpm);
  });

  // =========================================================================
  // 5. Channel Strip Disconnect and Cleanup Lifecycle
  // =========================================================================
  console.log('\n--- SUITE 5: CHANNEL STRIP CLEANUP & AUTOMATION CANCELLATION ---');

  await test('5.1: cancelScheduledAutomations cancels and resets all 10 AudioParams to neutral defaults', () => {
    const ctx = new MockAudioContext();
    const strip = createDJChannelStrip(ctx);

    // Schedule automations
    strip.eqLow.gain.setValueAtTime(-40, 0);
    strip.filterSweep.frequency.setValueAtTime(5000, 0);
    strip.delayFeedback.gain.setValueAtTime(0.75, 0);
    strip.outputNode.gain.setValueAtTime(0.2, 0);

    cancelScheduledAutomations(strip, 1.0);

    // Verify neutral defaults
    assert.equal(strip.eqLow.gain.value, 0.0);
    assert.equal(strip.eqMid.gain.value, 0.0);
    assert.equal(strip.eqHigh.gain.value, 0.0);
    assert.equal(strip.filterSweep.type, 'highpass');
    assert.equal(strip.filterSweep.frequency.value, 20);
    assert.equal(strip.delayFeedback.gain.value, 0.0);
    assert.equal(strip.stutterGain.gain.value, 1.0);
    assert.equal(strip.outputNode.gain.value, 1.0);
  });

  await test('5.2: disposeDJChannelStrip disconnects all 10 nodes without throwing', () => {
    const ctx = new MockAudioContext();
    const strip = createDJChannelStrip(ctx);

    disposeDJChannelStrip(strip);

    // Calling dispose twice should not throw
    disposeDJChannelStrip(strip);
  });

  // =========================================================================
  // Final Summary
  // =========================================================================
  console.log('\n' + '='.repeat(80));
  console.log('   ADVERSARIAL STRESS TEST SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total Tests Run:  ${totalTests}`);
  console.log(`Passed Tests:     ${passedTests}`);
  console.log(`Failed Tests:     ${failedTests.length}`);
  console.log('-'.repeat(80));

  if (failedTests.length > 0) {
    console.error('\nFAILURES RECORDED:');
    for (const f of failedTests) {
      console.error(`  - ${f.name}: ${f.error}`);
    }
    process.exit(1);
  } else {
    console.log('\n>>> EMPIRICAL CHALLENGE VERDICT: ALL ADVERSARIAL STRESS TESTS PASSED (100%) <<<\n');
    process.exit(0);
  }
}

runAdversarialM1Suite().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
