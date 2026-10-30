import type { Track } from '../types/spotify';
import type { AudioFeature } from '../utils/audioFeatures';

export type TransitionPreset =
  | 'automatica'
  | 'fundido'
  | 'crescendo'
  | 'filtro'
  | 'corte'
  | 'eco_out'
  | 'freno_vinilo'
  | 'beat_roll'
  | 'distorsion_wash';

export type VolumeEnvelope = 'superposicion' | 'lineal' | 'curva_s' | 'corte_directo';
export type EQFilterMode =
  | 'intercambio_graves_central'
  | 'intercambio_gradual'
  | 'sin_filtro'
  | 'filtro_paso_bajo';

export type DJFXMode =
  | 'ninguno'
  | 'eco'
  | 'freno_vinilo'
  | 'repeticion_loop'
  | 'distorsion_wash';

export interface DJTransitionConfig {
  trackAId: string;
  trackBId: string;
  compases: number; // 1, 2, 4, 8, 16
  preset: TransitionPreset;
  volumeEnvelope: VolumeEnvelope;
  eqMode: EQFilterMode;
  fxMode?: DJFXMode;
  tempoA?: number;
  tempoB?: number;
  camelotA?: string;
  camelotB?: string;
  label?: string;
  detail?: string;
  updatedAt?: number;
}

export const DEFAULT_TRANSITION_CONFIG: Omit<DJTransitionConfig, 'trackAId' | 'trackBId'> = {
  compases: 2,
  preset: 'automatica',
  volumeEnvelope: 'superposicion',
  eqMode: 'intercambio_graves_central',
  fxMode: 'ninguno',
};

class DJTransitionService {
  private audioCtx: AudioContext | null = null;
  private previewInterval: number | null = null;
  private isAuditionPlaying = false;
  private onProgressCallback: ((progress: number) => void) | null = null;
  private onStopCallback: (() => void) | null = null;
  private gainA: GainNode | null = null;
  private gainB: GainNode | null = null;
  private filterA: BiquadFilterNode | null = null;
  private filterB: BiquadFilterNode | null = null;
  private synthNodes: Array<{ stop: () => void }> = [];

  public getTransitionKey(trackAId: string, trackBId: string): string {
    const cleanA = (trackAId || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
    const cleanB = (trackBId || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
    return `spotifree_dj_transition_${cleanA}_${cleanB}`;
  }

  public getTransitionConfig(
    trackAId: string,
    trackBId: string,
    tempoA?: number,
    tempoB?: number,
    camelotA?: string,
    camelotB?: string
  ): DJTransitionConfig {
    if (typeof window !== 'undefined') {
      try {
        const key = this.getTransitionKey(trackAId, trackBId);
        const saved = window.localStorage.getItem(key);
        if (saved) {
          const parsed = JSON.parse(saved);
          return {
            ...parsed,
            tempoA: parsed.tempoA ?? tempoA,
            tempoB: parsed.tempoB ?? tempoB,
            camelotA: parsed.camelotA ?? camelotA,
            camelotB: parsed.camelotB ?? camelotB,
          };
        }
      } catch {}
    }
    // Calculate tailored dynamic parameters for this exact track pair
    return this.calculateSmartTransition(trackAId, trackBId, tempoA, tempoB, camelotA, camelotB);
  }

  /**
   * Intelligently analyzes acoustic properties (BPM & Camelot harmonic compatibility)
   * to calculate the optimal DJ transition parameters between any pair of songs.
   */
  public calculateSmartTransition(
    trackAId: string,
    trackBId: string,
    tempoA = 128,
    tempoB = 128,
    camelotA = '9A',
    camelotB = '11A'
  ): DJTransitionConfig {
    const diffBpm = Math.abs(tempoA - tempoB);

    const parseCam = (c?: string) => {
      const match = (c || '9A').match(/^(\d+)([AB])$/i);
      if (!match) return { num: 9, letter: 'A' };
      return { num: parseInt(match[1], 10), letter: match[2].toUpperCase() };
    };

    const cA = parseCam(camelotA);
    const cB = parseCam(camelotB);
    const numDiff = Math.min((cA.num - cB.num + 12) % 12, (cB.num - cA.num + 12) % 12);
    const isSameLetter = cA.letter === cB.letter;
    const isHarmonicMatch = (numDiff === 0 || numDiff === 1) && isSameLetter;
    const isRelativeMajorMinor = numDiff === 0 && !isSameLetter;

    // Rule 1: High Tempo Gap (> 20 BPM) -> Turntable Vinyl Brake & Sharp Drop
    if (diffBpm >= 20) {
      return {
        trackAId,
        trackBId,
        compases: 1,
        preset: 'freno_vinilo',
        volumeEnvelope: 'corte_directo',
        eqMode: 'intercambio_graves_central',
        fxMode: 'freno_vinilo',
        tempoA,
        tempoB,
        camelotA,
        camelotB,
        label: '✦ Automática · Freno vinilo (1 compás)',
        detail: 'Freno de tornamesa y corte directo en primer tiempo para salvar diferencia de tempo',
      };
    }

    // Rule 2: Large BPM gap (12 - 19 BPM) or Dissonant Key -> Echo Out & Low-Pass Filter
    if (diffBpm > 12 || numDiff >= 3) {
      return {
        trackAId,
        trackBId,
        compases: 2,
        preset: 'eco_out',
        volumeEnvelope: 'curva_s',
        eqMode: 'filtro_paso_bajo',
        fxMode: 'eco',
        tempoA,
        tempoB,
        camelotA,
        camelotB,
        label: '✦ Automática · Eco y filtro paso bajo',
        detail: 'Eco retardado con filtro progresivo para enlazar el ritmo',
      };
    }

    // Rule 3: Moderate BPM gap (7 - 12 BPM) -> Beat Roll Loop Stutter build-up
    if (diffBpm > 6) {
      return {
        trackAId,
        trackBId,
        compases: 2,
        preset: 'beat_roll',
        volumeEnvelope: 'curva_s',
        eqMode: 'intercambio_gradual',
        fxMode: 'repeticion_loop',
        tempoA,
        tempoB,
        camelotA,
        camelotB,
        label: '✦ Automática · Beat Roll (Stutter)',
        detail: 'Redoble rítmico acelerado antes del impacto de entrada',
      };
    }

    // Rule 4: Perfect Harmonic Match + Low BPM Gap (<= 4 BPM) -> Long 4-bar harmonic blend with saturation wash
    if (isHarmonicMatch && diffBpm <= 4) {
      return {
        trackAId,
        trackBId,
        compases: 4,
        preset: 'automatica',
        volumeEnvelope: 'superposicion',
        eqMode: 'intercambio_graves_central',
        fxMode: 'distorsion_wash',
        tempoA,
        tempoB,
        camelotA,
        camelotB,
        label: '✦ Automática · 4 compases (Armónica)',
        detail: 'Mezcla armónica extendida con saturación suave y bajo central',
      };
    }

    // Rule 5: Relative Major/Minor or standard adjacent match -> 2-bar bass swap blend
    if (isRelativeMajorMinor || isHarmonicMatch) {
      return {
        trackAId,
        trackBId,
        compases: 2,
        preset: 'automatica',
        volumeEnvelope: 'superposicion',
        eqMode: 'intercambio_graves_central',
        fxMode: 'ninguno',
        tempoA,
        tempoB,
        camelotA,
        camelotB,
        label: '✦ Automática · 2 compases',
        detail: 'Transición tonal armónica con intercambio de graves',
      };
    }

    // Default Balanced Transition
    return {
      trackAId,
      trackBId,
      compases: 2,
      preset: 'automatica',
      volumeEnvelope: 'superposicion',
      eqMode: 'intercambio_graves_central',
      fxMode: 'ninguno',
      tempoA,
      tempoB,
      camelotA,
      camelotB,
      label: '✦ Automática · 2 compases',
      detail: 'Intercambio de frecuencias graves central',
    };
  }

  /**
   * Sorts a list of tracks using the Camelot Wheel & BPM proximity to produce
   * a continuous, harmonically mixed DJ path.
   */
  public sortPlaylistHarmonically(
    tracks: Track[],
    features: Record<string, AudioFeature>
  ): Track[] {
    if (!tracks || tracks.length <= 2) return tracks;

    const remaining = [...tracks];
    const sorted: Track[] = [];

    // Start with the first track
    const first = remaining.shift()!;
    sorted.push(first);

    const parseCam = (c?: string) => {
      const match = (c || '9A').match(/^(\d+)([AB])$/i);
      if (!match) return { num: 9, letter: 'A' };
      return { num: parseInt(match[1], 10), letter: match[2].toUpperCase() };
    };

    while (remaining.length > 0) {
      const prevTrack = sorted[sorted.length - 1];
      const prevCleanId = (prevTrack.id || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
      const prevFeat = features[prevCleanId] || features[prevTrack.id];
      const prevTempo = prevFeat?.tempo || 128;
      const prevCam = parseCam(prevFeat?.camelot);

      let bestIndex = 0;
      let minPenalty = Infinity;

      for (let i = 0; i < remaining.length; i++) {
        const candidate = remaining[i];
        const candCleanId = (candidate.id || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
        const candFeat = features[candCleanId] || features[candidate.id];
        const candTempo = candFeat?.tempo || 128;
        const candCam = parseCam(candFeat?.camelot);

        const bpmDelta = Math.abs(prevTempo - candTempo);
        const numDiff = Math.min(
          (prevCam.num - candCam.num + 12) % 12,
          (candCam.num - prevCam.num + 12) % 12
        );
        const isSameLetter = prevCam.letter === candCam.letter;

        let keyPenalty = 0;
        if (numDiff === 0 && isSameLetter) keyPenalty = 0; // Identical Key
        else if (numDiff === 1 && isSameLetter) keyPenalty = 8; // Adjacent Key (+1/-1)
        else if (numDiff === 0 && !isSameLetter) keyPenalty = 12; // Relative Maj/Min
        else if (numDiff === 1 && !isSameLetter) keyPenalty = 25;
        else keyPenalty = 50 + numDiff * 15;

        const totalPenalty = keyPenalty + bpmDelta * 1.5;

        if (totalPenalty < minPenalty) {
          minPenalty = totalPenalty;
          bestIndex = i;
        }
      }

      sorted.push(remaining.splice(bestIndex, 1)[0]);
    }

    return sorted;
  }

  public saveTransitionConfig(config: DJTransitionConfig): void {
    if (typeof window === 'undefined') return;
    try {
      const key = this.getTransitionKey(config.trackAId, config.trackBId);
      window.localStorage.setItem(
        key,
        JSON.stringify({ ...config, updatedAt: Date.now() })
      );
    } catch {}
  }

  /**
   * Calculates the exact transition duration in seconds based on BPM and bars (compases).
   * 1 compás (4/4 time) = 4 beats = (4 * 60) / tempo seconds.
   */
  public calculateDurationSeconds(tempo: number, compases: number): number {
    const safeTempo = tempo > 40 && tempo < 240 ? tempo : 128;
    const barSec = (4 * 60) / safeTempo;
    return Math.max(1.5, Math.min(16, barSec * compases));
  }

  /**
   * Starts a client-side Web Audio API audition of the DJ transition.
   * Runs 100% on the device with zero server latency or load.
   */
  public startAudition(
    config: DJTransitionConfig,
    tempoA = 128,
    tempoB = 128,
    onProgress: (progress: number) => void,
    onEnded: () => void
  ): void {
    this.stopAudition();

    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) {
      onEnded();
      return;
    }

    try {
      this.audioCtx = new AudioContextClass();
    } catch {
      onEnded();
      return;
    }

    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }

    this.isAuditionPlaying = true;
    this.onProgressCallback = onProgress;
    this.onStopCallback = onEnded;

    const ctx = this.audioCtx;
    const now = ctx.currentTime;
    const transitionDur = this.calculateDurationSeconds(tempoA, config.compases);
    // Add 1.5 seconds of lead-in for Song A and 1.5 seconds of lead-out for Song B so user feels the full context
    const leadInSec = 1.2;
    const leadOutSec = 1.5;
    const totalAuditionSec = leadInSec + transitionDur + leadOutSec;

    // Deck A (Outgoing): LowShelf filter + Gain
    this.filterA = ctx.createBiquadFilter();
    this.filterA.type = 'lowshelf';
    this.filterA.frequency.value = 250;
    this.filterA.gain.setValueAtTime(0, now);

    this.gainA = ctx.createGain();
    this.gainA.gain.setValueAtTime(1.0, now);

    // Deck B (Incoming): LowShelf filter + Gain
    this.filterB = ctx.createBiquadFilter();
    this.filterB.type = 'lowshelf';
    this.filterB.frequency.value = 250;
    this.filterB.gain.setValueAtTime(-24, now); // Starts with bass cut

    this.gainB = ctx.createGain();
    this.gainB.gain.setValueAtTime(0.0, now); // Starts muted

    // Master bus
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.85, now);
    masterGain.connect(ctx.destination);

    this.filterA.connect(this.gainA);
    this.gainA.connect(masterGain);

    this.filterB.connect(this.gainB);
    this.gainB.connect(masterGain);

    // Schedule Volume curves based on selected preset & volume envelope
    const transStart = now + leadInSec;
    const transEnd = transStart + transitionDur;
    const crossoverTime = transStart + transitionDur * 0.5;

    // Deck A Volume
    if (config.volumeEnvelope === 'superposicion' || config.preset === 'automatica') {
      // Maintains 100% through the first bar, then ramps down to 0
      this.gainA.gain.setValueAtTime(1.0, transStart);
      this.gainA.gain.setValueAtTime(1.0, crossoverTime);
      this.gainA.gain.linearRampToValueAtTime(0.0, transEnd);
    } else if (config.volumeEnvelope === 'corte_directo' || config.preset === 'corte') {
      this.gainA.gain.setValueAtTime(1.0, crossoverTime);
      this.gainA.gain.setValueAtTime(0.0, crossoverTime + 0.01);
    } else {
      // Linear or equal-power crossfade
      this.gainA.gain.setValueAtTime(1.0, transStart);
      this.gainA.gain.linearRampToValueAtTime(0.0, transEnd);
    }

    // Deck B Volume
    if (config.volumeEnvelope === 'superposicion' || config.preset === 'automatica') {
      this.gainB.gain.setValueAtTime(0.0, transStart);
      this.gainB.gain.linearRampToValueAtTime(1.0, transEnd);
    } else if (config.volumeEnvelope === 'corte_directo' || config.preset === 'corte') {
      this.gainB.gain.setValueAtTime(0.0, crossoverTime);
      this.gainB.gain.setValueAtTime(1.0, crossoverTime + 0.01);
    } else if (config.preset === 'crescendo') {
      this.gainB.gain.setValueAtTime(0.0, transStart);
      this.gainB.gain.exponentialRampToValueAtTime(1.0, transEnd);
    } else {
      this.gainB.gain.setValueAtTime(0.0, transStart);
      this.gainB.gain.linearRampToValueAtTime(1.0, transEnd);
    }

    // Schedule EQ Bass curves
    if (config.eqMode === 'intercambio_graves_central' || config.preset === 'automatica') {
      // Bass Swap: At the crossover beat, Deck A drops bass by -24dB and Deck B bass snaps to 0dB!
      this.filterA.gain.setValueAtTime(0, transStart);
      this.filterA.gain.setValueAtTime(0, crossoverTime - 0.05);
      this.filterA.gain.linearRampToValueAtTime(-24, crossoverTime);

      this.filterB.gain.setValueAtTime(-24, transStart);
      this.filterB.gain.setValueAtTime(-24, crossoverTime - 0.05);
      this.filterB.gain.linearRampToValueAtTime(0, crossoverTime);
    } else if (config.eqMode === 'intercambio_gradual') {
      this.filterA.gain.setValueAtTime(0, transStart);
      this.filterA.gain.linearRampToValueAtTime(-24, transEnd);
      this.filterB.gain.setValueAtTime(-24, transStart);
      this.filterB.gain.linearRampToValueAtTime(0, transEnd);
    } else if (config.eqMode === 'filtro_paso_bajo' || config.preset === 'filtro') {
      this.filterA.frequency.setValueAtTime(4000, transStart);
      this.filterA.frequency.exponentialRampToValueAtTime(350, transEnd);
      this.filterB.gain.setValueAtTime(0, transStart);
    } else {
      // No EQ filter change
      this.filterA.gain.setValueAtTime(0, transStart);
      this.filterB.gain.setValueAtTime(0, transStart);
    }

    // Generate harmonic acoustic elements so the user hears authentic music with beats and tone!
    this.createDeckAcousticTone(ctx, this.filterA, tempoA, 220, now, transEnd + 0.5);
    this.createDeckAcousticTone(ctx, this.filterB, tempoB, 261.63, transStart, transEnd + leadOutSec);

    // Playhead progress loop
    const startTime = Date.now();
    const durationMs = totalAuditionSec * 1000;

    this.previewInterval = window.setInterval(() => {
      if (!this.isAuditionPlaying) return;
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1.0, Math.max(0.0, elapsed / durationMs));

      if (this.onProgressCallback) {
        this.onProgressCallback(progress);
      }

      if (progress >= 1.0) {
        this.stopAudition();
      }
    }, 30);
  }

  private createDeckAcousticTone(
    ctx: AudioContext,
    dest: AudioNode,
    bpm: number,
    baseFreq: number,
    startTime: number,
    endTime: number
  ) {
    const beatSec = 60 / Math.max(60, Math.min(200, bpm));
    let t = startTime;

    // Rhythmic kick & bass pulses
    while (t < endTime) {
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        // Punchy kick / bass note
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(baseFreq * 0.5, t);
        osc.frequency.exponentialRampToValueAtTime(45, t + beatSec * 0.4);

        gain.gain.setValueAtTime(0.65, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + beatSec * 0.35);

        osc.connect(gain);
        gain.connect(dest);

        osc.start(t);
        osc.stop(t + beatSec * 0.4);
        this.synthNodes.push({ stop: () => { try { osc.stop(); } catch {} } });
      } catch {}

      // Chord warmth on the upbeat
      try {
        const chordOsc = ctx.createOscillator();
        const chordGain = ctx.createGain();
        chordOsc.type = 'sine';
        chordOsc.frequency.setValueAtTime(baseFreq, t + beatSec * 0.5);
        chordGain.gain.setValueAtTime(0.2, t + beatSec * 0.5);
        chordGain.gain.exponentialRampToValueAtTime(0.001, t + beatSec * 0.9);

        chordOsc.connect(chordGain);
        chordGain.connect(dest);

        chordOsc.start(t + beatSec * 0.5);
        chordOsc.stop(t + beatSec * 0.95);
        this.synthNodes.push({ stop: () => { try { chordOsc.stop(); } catch {} } });
      } catch {}

      t += beatSec;
    }
  }

  public stopAudition(): void {
    if (this.previewInterval !== null) {
      clearInterval(this.previewInterval);
      this.previewInterval = null;
    }
    this.synthNodes.forEach((node) => {
      try {
        node.stop();
      } catch {}
    });
    this.synthNodes = [];

    if (this.audioCtx) {
      try {
        this.audioCtx.close().catch(() => {});
      } catch {}
      this.audioCtx = null;
    }

    this.isAuditionPlaying = false;
    if (this.onStopCallback) {
      this.onStopCallback();
      this.onStopCallback = null;
    }
    this.onProgressCallback = null;
  }

  public isPlaying(): boolean {
    return this.isAuditionPlaying;
  }
}

export const djTransitionService = new DJTransitionService();
