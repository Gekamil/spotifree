/**
 * Spotifree Web Audio API DJ DSP Channel Strip & Parameter Automation Engine
 * Production-grade 3-Band Isolator EQ, Resonant Filter Sweeps, Tempo-Synced Delay, and Loop Stutter.
 */

export interface DJChannelStrip {
  readonly inputNode: GainNode;
  readonly eqLow: BiquadFilterNode;        // lowshelf, 250Hz, gain -40dB to +6dB
  readonly eqMid: BiquadFilterNode;        // peaking, 1500Hz, Q=1.0, gain -40dB to +6dB
  readonly eqHigh: BiquadFilterNode;       // highshelf, 4000Hz, gain -40dB to +6dB
  readonly filterSweep: BiquadFilterNode;  // highpass/lowpass, Q=2.0-3.5
  readonly delayNode: DelayNode;           // beat-synchronized delay line (max 5.0s)
  readonly delayFeedback: GainNode;        // feedback gain <= 0.80
  readonly delayDampFilter: BiquadFilterNode; // highpass damping at 250Hz, Q=0.7
  readonly stutterGain: GainNode;          // rhythmic loop roll gating
  readonly outputNode: GainNode;           // master channel output / fader
}

export interface TransitionAutomationParams {
  bpmA: number;
  bpmB: number;
  durationSec: number;
  preset: string;
  startTime: number;
  resonanceQ?: number;
  subdivision?: number;
  feedbackGain?: number;
}

export interface FilterSweepOptions {
  type: 'highpass' | 'lowpass';
  startFreq?: number;
  endFreq?: number;
  resonanceQ?: number;
}

// ============================================================================
// Factory & DSP Graph Construction
// ============================================================================

/**
 * Creates and connects a complete 10-node DJ DSP channel strip on the provided AudioContext.
 *
 * Graph Topology:
 * - Primary Dry Path: inputNode -> eqLow -> eqMid -> eqHigh -> filterSweep -> stutterGain -> outputNode
 * - Aux Wet Delay Loop: inputNode -> delayNode -> delayFeedback -> delayDampFilter -> delayNode (loop)
 *                                  └───────────────────────────────────────────────> outputNode
 */
export function createDJChannelStrip(audioCtx: AudioContext): DJChannelStrip {
  const inputNode = audioCtx.createGain();
  inputNode.gain.value = 1.0;

  // 1. 3-Band Isolator EQ
  const eqLow = audioCtx.createBiquadFilter();
  eqLow.type = 'lowshelf';
  eqLow.frequency.value = 250;
  eqLow.gain.value = 0;

  const eqMid = audioCtx.createBiquadFilter();
  eqMid.type = 'peaking';
  eqMid.frequency.value = 1500;
  eqMid.Q.value = 1.0;
  eqMid.gain.value = 0;

  const eqHigh = audioCtx.createBiquadFilter();
  eqHigh.type = 'highshelf';
  eqHigh.frequency.value = 4000;
  eqHigh.gain.value = 0;

  // 2. Resonant Sweep Filter (neutral highpass at 20Hz, Q=3.0)
  const filterSweep = audioCtx.createBiquadFilter();
  filterSweep.type = 'highpass';
  filterSweep.frequency.value = 20;
  filterSweep.Q.value = 3.0;

  // 3. Beat-Synchronized Delay Line with Highpass Damped Feedback Loop
  const delayNode = audioCtx.createDelay(5.0);
  delayNode.delayTime.value = 0.0;

  const delayFeedback = audioCtx.createGain();
  delayFeedback.gain.value = 0.65; // Safe default feedback < 0.80

  const delayDampFilter = audioCtx.createBiquadFilter();
  delayDampFilter.type = 'highpass';
  delayDampFilter.frequency.value = 250;
  delayDampFilter.Q.value = 0.7;

  // 4. Loop Stutter & Channel Output
  const stutterGain = audioCtx.createGain();
  stutterGain.gain.value = 1.0;

  const outputNode = audioCtx.createGain();
  outputNode.gain.value = 1.0;

  // Primary Dry Channel Routing
  inputNode.connect(eqLow);
  eqLow.connect(eqMid);
  eqMid.connect(eqHigh);
  eqHigh.connect(filterSweep);
  filterSweep.connect(stutterGain);
  stutterGain.connect(outputNode);

  // Aux Wet Delay Feedback Loop Routing
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

/**
 * Alias factory for backward-compatibility with test suite contract verification.
 */
export const createDeckDSPStrip = createDJChannelStrip;

// ============================================================================
// Parameter Automation Schedulers
// ============================================================================

/**
 * Schedules instantaneous bass swap at the crossover downbeat using a 20ms anti-click time constant.
 * Optionally initializes incoming deck's low shelf at -40dB from mixStartTime to prevent low-end clash.
 * Cuts outgoing low-shelf gain to -40dB and snaps incoming low-shelf gain to 0dB.
 */
export function scheduleBassSwap(
  deckOut: DJChannelStrip,
  deckIn: DJChannelStrip,
  crossoverTime: number,
  mixStartTime?: number
): void {
  if (mixStartTime !== undefined && mixStartTime < crossoverTime) {
    deckIn.eqLow.gain.setValueAtTime(-40, mixStartTime);
  }
  deckOut.eqLow.gain.setTargetAtTime(-40, crossoverTime, 0.02);
  deckIn.eqLow.gain.setTargetAtTime(0, crossoverTime, 0.02);
}

/**
 * Schedules a resonant High-Pass Filter sweep.
 * Safely clamps frequency trajectory >= 20Hz and <= 20000Hz to prevent Web Audio RangeError.
 *
 * Supports overloaded signatures:
 * - (target, startTime, duration, startFreq, endFreq, Q = 3.0)
 * - (target, startTime, duration, resonanceQ = 3.0) [default sweep 20Hz -> 18000Hz]
 */
export function scheduleResonantHPFSweep(
  target: DJChannelStrip | BiquadFilterNode,
  startTime: number,
  duration: number,
  arg4?: number,
  arg5?: number,
  arg6?: number
): void {
  const filter = 'filterSweep' in target ? target.filterSweep : target;

  let startFreq: number;
  let endFreq: number;
  let resonanceQ: number;

  if (arg5 !== undefined) {
    // Signature: (target, startTime, duration, startFreq, endFreq, Q)
    startFreq = arg4 !== undefined ? arg4 : 20;
    endFreq = arg5;
    resonanceQ = arg6 !== undefined ? arg6 : 3.0;
  } else {
    // Signature: (target, startTime, duration, resonanceQ)
    resonanceQ = arg4 !== undefined && arg4 <= 20 ? arg4 : 3.0;
    startFreq = arg4 !== undefined && arg4 > 20 ? arg4 : 20;
    endFreq = 18000;
  }

  const safeQ = Math.max(0.1, Math.min(10.0, resonanceQ));
  const safeStartFreq = Math.max(20, Math.min(20000, startFreq));
  const safeEndFreq = Math.max(20, Math.min(20000, endFreq));

  filter.type = 'highpass';
  filter.Q.setValueAtTime(safeQ, startTime);
  filter.frequency.setValueAtTime(safeStartFreq, startTime);
  filter.frequency.exponentialRampToValueAtTime(safeEndFreq, startTime + duration);
}

/**
 * Schedules a resonant Low-Pass Filter sweep.
 * Safely clamps frequency trajectory >= 20Hz and <= 20000Hz to prevent Web Audio RangeError.
 *
 * Supports overloaded signatures:
 * - (target, startTime, duration, startFreq, endFreq, Q = 2.5)
 * - (target, startTime, duration, resonanceQ = 2.5) [default sweep 20000Hz -> 80Hz]
 */
export function scheduleResonantLPFSweep(
  target: DJChannelStrip | BiquadFilterNode,
  startTime: number,
  duration: number,
  arg4?: number,
  arg5?: number,
  arg6?: number
): void {
  const filter = 'filterSweep' in target ? target.filterSweep : target;

  let startFreq: number;
  let endFreq: number;
  let resonanceQ: number;

  if (arg5 !== undefined) {
    // Signature: (target, startTime, duration, startFreq, endFreq, Q)
    startFreq = arg4 !== undefined ? arg4 : 20000;
    endFreq = arg5;
    resonanceQ = arg6 !== undefined ? arg6 : 2.5;
  } else {
    // Signature: (target, startTime, duration, resonanceQ)
    resonanceQ = arg4 !== undefined && arg4 <= 20 ? arg4 : 2.5;
    startFreq = 20000;
    endFreq = arg4 !== undefined && arg4 > 20 ? arg4 : 80;
  }

  const safeQ = Math.max(0.1, Math.min(10.0, resonanceQ));
  const safeStartFreq = Math.max(20, Math.min(20000, startFreq));
  const safeEndFreq = Math.max(20, Math.min(20000, endFreq));

  filter.type = 'lowpass';
  filter.Q.setValueAtTime(safeQ, startTime);
  filter.frequency.setValueAtTime(safeStartFreq, startTime);
  filter.frequency.exponentialRampToValueAtTime(safeEndFreq, startTime + duration);
}

/**
 * Computes tempo-locked delay time in seconds.
 * Clamps BPM within musical boundaries (40 < BPM < 240, fallback 128 BPM).
 */
export function calculateDelayTime(bpm: number, subdivision = 0.75): number {
  const safeBpm = bpm > 40 && bpm < 240 ? bpm : 128;
  return (60 / safeBpm) * subdivision;
}

/**
 * Schedules beat-synchronized delay with damping filter and dissolving feedback tail.
 * Caps feedback gain strictly < 0.80 to prevent acoustic runaway.
 */
export function scheduleBeatDelay(
  deck: DJChannelStrip,
  startTime: number,
  duration: number,
  bpm: number,
  subdivision = 0.75,
  feedback = 0.65
): void {
  const delaySec = calculateDelayTime(bpm, subdivision);
  const safeFeedback = Math.min(0.80, Math.max(0, feedback));

  // 1. Configure 250Hz highpass damping filter to prevent bass mud accumulation
  deck.delayDampFilter.type = 'highpass';
  deck.delayDampFilter.frequency.setValueAtTime(250, startTime);
  deck.delayDampFilter.Q.setValueAtTime(0.7, startTime);

  // 2. Set tempo-locked delay time and initial feedback
  deck.delayNode.delayTime.setValueAtTime(delaySec, startTime);
  deck.delayFeedback.gain.setValueAtTime(safeFeedback, startTime);

  // 3. Mute dry channel at crossover, allowing wet delay tail to wash out
  deck.stutterGain.gain.setValueAtTime(0, startTime);

  // 4. Exponential decay tail terminating at safe non-zero floor (0.001)
  deck.delayFeedback.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
}

/**
 * Alias for scheduleBeatDelay.
 */
export const scheduleEchoOut = scheduleBeatDelay;

/**
 * Schedules an accelerating loop stutter roll (1/4 -> 1/8 -> 1/16 beat) with 5ms linear micro-ramps.
 * Uses 70% active / 30% muted duty cycle for authentic rhythmic chopping.
 */
export function scheduleLoopStutter(
  target: DJChannelStrip | GainNode,
  startTime: number,
  duration: number,
  bpm: number
): void {
  const stutterGain = 'stutterGain' in target ? target.stutterGain : target;
  const safeBpm = bpm > 40 && bpm < 240 ? bpm : 128;
  const beatSec = 60 / safeBpm;
  const ramp = 0.005; // 5ms linear anti-click micro-ramp

  // Split duration into 3 progressive acceleration phases:
  // Phase 1 (0% - 50%): 1/4-beat chops
  // Phase 2 (50% - 75%): 1/8-beat chops
  // Phase 3 (75% - 100%): 1/16-beat chops
  const p1End = startTime + duration * 0.50;
  const p2End = startTime + duration * 0.75;
  const p3End = startTime + duration;

  const scheduleChops = (from: number, to: number, sliceDur: number) => {
    let t = from;
    while (t + sliceDur <= to) {
      const activeDur = sliceDur * 0.70;
      const effectiveRamp = Math.min(ramp, activeDur * 0.25, (sliceDur - activeDur) * 0.25);

      stutterGain.gain.setValueAtTime(1.0, t);
      stutterGain.gain.setValueAtTime(1.0, t + activeDur - effectiveRamp);
      stutterGain.gain.linearRampToValueAtTime(0.0, t + activeDur);

      stutterGain.gain.setValueAtTime(0.0, t + sliceDur - effectiveRamp);
      stutterGain.gain.linearRampToValueAtTime(1.0, t + sliceDur);

      t += sliceDur;
    }
  };

  scheduleChops(startTime, p1End, beatSec * 0.25);
  scheduleChops(p1End, p2End, beatSec * 0.125);
  scheduleChops(p2End, p3End, beatSec * 0.0625);
}

/**
 * Cancels all scheduled AudioParam automations on a channel strip and restores neutral values.
 */
export function cancelScheduledAutomations(deck: DJChannelStrip, currentTime = 0): void {
  // Cancel scheduled automation curves
  deck.inputNode.gain.cancelScheduledValues(currentTime);
  deck.eqLow.gain.cancelScheduledValues(currentTime);
  deck.eqMid.gain.cancelScheduledValues(currentTime);
  deck.eqHigh.gain.cancelScheduledValues(currentTime);
  deck.filterSweep.frequency.cancelScheduledValues(currentTime);
  deck.filterSweep.Q.cancelScheduledValues(currentTime);
  deck.delayNode.delayTime.cancelScheduledValues(currentTime);
  deck.delayFeedback.gain.cancelScheduledValues(currentTime);
  deck.stutterGain.gain.cancelScheduledValues(currentTime);
  deck.outputNode.gain.cancelScheduledValues(currentTime);

  // Restore neutral defaults
  deck.inputNode.gain.setValueAtTime(1.0, currentTime);
  deck.eqLow.gain.setValueAtTime(0.0, currentTime);
  deck.eqMid.gain.setValueAtTime(0.0, currentTime);
  deck.eqHigh.gain.setValueAtTime(0.0, currentTime);

  deck.filterSweep.type = 'highpass';
  deck.filterSweep.frequency.setValueAtTime(20, currentTime);
  deck.filterSweep.Q.setValueAtTime(0.707, currentTime);

  deck.delayFeedback.gain.setValueAtTime(0.0, currentTime);
  deck.stutterGain.gain.setValueAtTime(1.0, currentTime);
  deck.outputNode.gain.setValueAtTime(1.0, currentTime);
}

/**
 * Aliases for cancelScheduledAutomations.
 */
export const resetChannelStrip = cancelScheduledAutomations;
export const cancelDeckAutomations = cancelScheduledAutomations;

/**
 * Cleanly disconnects all 10 audio nodes in a channel strip to avoid memory leaks.
 */
export function disposeDJChannelStrip(strip: DJChannelStrip): void {
  const nodes = [
    strip.inputNode,
    strip.eqLow,
    strip.eqMid,
    strip.eqHigh,
    strip.filterSweep,
    strip.delayNode,
    strip.delayFeedback,
    strip.delayDampFilter,
    strip.stutterGain,
    strip.outputNode,
  ];

  for (const node of nodes) {
    try {
      node.disconnect();
    } catch {
      // Disconnect may throw if already disconnected; ignore safely
    }
  }
}

/**
 * Alias for disposeDJChannelStrip.
 */
export const disposeChannelStrip = disposeDJChannelStrip;

// ============================================================================
// Auxiliary Acoustic Layering for YouTube FX Presets
// ============================================================================

export interface ActiveAuxFX {
  stop: () => void;
}

/**
 * Triggers synthesized Web Audio acoustic textures to layer over YouTube playback,
 * ensuring DJ transition presets ('filtro', 'freno_vinilo', 'eco_out', 'beat_roll')
 * are audibly distinct despite YouTube iframe CORS restrictions.
 */
export function triggerAuxiliaryTransitionFX(
  ctx: AudioContext,
  preset: string,
  durationSec: number,
  bpm: number,
  masterVol = 1.0,
  startTime?: number
): ActiveAuxFX | null {
  if (!ctx || ctx.state === 'closed') return null;

  try {
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const start = startTime !== undefined ? startTime : ctx.currentTime;
    const safeVol = Math.max(0, Math.min(1, masterVol));
    const safeBpm = bpm > 40 && bpm < 240 ? bpm : 128;

    if (preset === 'filtro') {
      // Resonant Highpass Filter Sweep Texture
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(65, start);

      filter.type = 'highpass';
      filter.Q.setValueAtTime(3.0, start);
      filter.frequency.setValueAtTime(20, start);
      filter.frequency.exponentialRampToValueAtTime(16000, start + durationSec);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.12 * safeVol, start + durationSec * 0.5);
      gain.gain.exponentialRampToValueAtTime(0.001, start + durationSec);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + durationSec);

      return {
        stop: () => {
          try {
            osc.stop();
            osc.disconnect();
            gain.disconnect();
          } catch {}
        },
      };
    } else if (preset === 'freno_vinilo') {
      // Turntable Platter Deceleration Tone & Needle Drag
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(120, start);
      osc.frequency.exponentialRampToValueAtTime(20, start + durationSec * 0.95);

      gain.gain.setValueAtTime(0.15 * safeVol, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + durationSec * 0.95);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + durationSec);

      return {
        stop: () => {
          try {
            osc.stop();
            osc.disconnect();
            gain.disconnect();
          } catch {}
        },
      };
    } else if (preset === 'eco_out') {
      // Dotted-Eighth Delay Ping Dissolve
      const delaySec = (60 / safeBpm) * 0.75;
      const osc = ctx.createOscillator();
      const delay = ctx.createDelay(5.0);
      const feedback = ctx.createGain();
      const damp = ctx.createBiquadFilter();
      const wetGain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, start);

      delay.delayTime.setValueAtTime(delaySec, start);
      feedback.gain.setValueAtTime(0.65, start);
      feedback.gain.exponentialRampToValueAtTime(0.001, start + durationSec);

      damp.type = 'highpass';
      damp.frequency.setValueAtTime(250, start);

      wetGain.gain.setValueAtTime(0.18 * safeVol, start);
      wetGain.gain.exponentialRampToValueAtTime(0.001, start + durationSec);

      const burstGain = ctx.createGain();
      burstGain.gain.setValueAtTime(1.0, start);
      burstGain.gain.exponentialRampToValueAtTime(0.001, start + 0.08);

      osc.connect(burstGain);
      burstGain.connect(delay);
      delay.connect(feedback);
      feedback.connect(damp);
      damp.connect(delay);
      delay.connect(wetGain);
      wetGain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + 0.1);

      return {
        stop: () => {
          try {
            osc.stop();
            delay.disconnect();
            wetGain.disconnect();
          } catch {}
        },
      };
    } else if (preset === 'beat_roll') {
      // Stutter Roll Transient Accents
      const beatSec = 60 / safeBpm;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(220, start);

      const p1End = start + durationSec * 0.50;
      const p2End = start + durationSec * 0.75;
      const p3End = start + durationSec * 0.98;

      const schedulePulses = (from: number, to: number, subSec: number) => {
        let t = from;
        while (t + subSec <= to) {
          gain.gain.setValueAtTime(0.10 * safeVol, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + subSec * 0.4);
          t += subSec;
        }
      };

      schedulePulses(start, p1End, beatSec * 0.25);
      schedulePulses(p1End, p2End, beatSec * 0.125);
      schedulePulses(p2End, p3End, beatSec * 0.0625);

      gain.gain.setValueAtTime(0, p3End);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + durationSec);

      return {
        stop: () => {
          try {
            osc.stop();
            osc.disconnect();
            gain.disconnect();
          } catch {}
        },
      };
    }
  } catch (err) {
    console.warn('[djAudioNodes] triggerAuxiliaryTransitionFX error:', err);
  }

  return null;
}

/**
 * Stops any actively running auxiliary transition effect.
 */
export function stopAuxiliaryTransitionFX(active: ActiveAuxFX | null): void {
  if (active) {
    try {
      active.stop();
    } catch {}
  }
}

