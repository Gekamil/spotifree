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
  title?: string;
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
  title: 'Automática',
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
    camelotB?: string,
    pairIndex = 0
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
    return this.calculateSmartTransition(trackAId, trackBId, tempoA, tempoB, camelotA, camelotB, pairIndex);
  }

  /**
   * Intelligently analyzes acoustic properties (BPM, Camelot harmonic compatibility & track progression)
   * to calculate diverse, tailored, studio-grade DJ transitions for each track pair.
   */
  public calculateSmartTransition(
    trackAId: string,
    trackBId: string,
    tempoA = 128,
    tempoB = 128,
    camelotA = '9A',
    camelotB = '11A',
    pairIndex = 0
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

    // Generate a deterministic variation seed so consecutive transitions always stay varied and exciting
    const seed = Math.abs(
      (trackAId ? trackAId.charCodeAt(trackAId.length - 1) : 0) +
      (trackBId ? trackBId.charCodeAt(trackBId.length - 1) * 31 : 0) +
      pairIndex * 17
    );

    // Rule 1: High Tempo Gap (>= 18 BPM) -> Turntable Vinyl Brake OR Spatial Echo Out
    if (diffBpm >= 18) {
      if (seed % 2 === 0) {
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
          title: 'Freno vinilo · 1 compás',
          label: '✦ Freno vinilo · 1 compás',
          detail: 'Freno analógico de tornamesa con corte directo en primer tiempo',
        };
      } else {
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
          title: 'Eco y filtro · 2 compases',
          label: '✦ Eco y filtro · 2 compases',
          detail: 'Eco espacial retardado disolviendo la pista saliente para salvar el cambio de tempo',
        };
      }
    }

    // Rule 2: Moderate BPM gap (8 - 17 BPM) -> Alternating Beat Roll, Echo Out, or Dry Drop Cut
    if (diffBpm > 8) {
      const mode = seed % 3;
      if (mode === 0) {
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
          title: 'Beat Roll · 2 compases',
          label: '✦ Beat Roll · 2 compases',
          detail: 'Redoble rítmico acelerado (1/4 a 1/8) construyendo tensión hacia el drop',
        };
      } else if (mode === 1) {
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
          title: 'Eco y filtro · 2 compases',
          label: '✦ Eco y filtro · 2 compases',
          detail: 'Filtro paso bajo progresivo con cola de delay espacial',
        };
      } else {
        return {
          trackAId,
          trackBId,
          compases: 1,
          preset: 'corte',
          volumeEnvelope: 'corte_directo',
          eqMode: 'intercambio_graves_central',
          fxMode: 'ninguno',
          tempoA,
          tempoB,
          camelotA,
          camelotB,
          title: 'Corte al golpe · 1 compás',
          label: '✦ Corte directo · 1 compás',
          detail: 'Corte seco al inicio del compás con impacto inmediato de bombo',
        };
      }
    }

    // Rule 3: Perfect Harmonic Match + Low BPM Gap (<= 5 BPM) -> 4-bar Melodic Blend or Saturation Riser
    if (isHarmonicMatch && diffBpm <= 5) {
      if (seed % 2 === 0) {
        return {
          trackAId,
          trackBId,
          compases: 4,
          preset: 'automatica',
          volumeEnvelope: 'superposicion',
          eqMode: 'intercambio_graves_central',
          fxMode: 'ninguno',
          tempoA,
          tempoB,
          camelotA,
          camelotB,
          title: 'Armónica pura · 4 compases',
          label: '✦ Armónica pura · 4 compases',
          detail: 'Fusión tonal melódica extendida en clave armónica con intercambio de bajo central',
        };
      } else {
        return {
          trackAId,
          trackBId,
          compases: 4,
          preset: 'crescendo',
          volumeEnvelope: 'curva_s',
          eqMode: 'intercambio_gradual',
          fxMode: 'distorsion_wash',
          tempoA,
          tempoB,
          camelotA,
          camelotB,
          title: 'Crescendo energía · 4 compases',
          label: '✦ Crescendo · 4 compases',
          detail: 'Subida exponencial de energía y saturación armónica antes de la entrada',
        };
      }
    }

    // Rule 4: Relative Major/Minor or adjacent harmonic match -> 2-bar Bass Swap or Beat Roll
    if (isRelativeMajorMinor || isHarmonicMatch) {
      if (seed % 2 === 0) {
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
          title: 'Intercambio graves · 2 compases',
          label: '✦ Intercambio graves · 2 compases',
          detail: 'Cruce dinámico de frecuencias graves en el segundo compás evitando barullo',
        };
      } else {
        return {
          trackAId,
          trackBId,
          compases: 2,
          preset: 'beat_roll',
          volumeEnvelope: 'curva_s',
          eqMode: 'intercambio_graves_central',
          fxMode: 'repeticion_loop',
          tempoA,
          tempoB,
          camelotA,
          camelotB,
          title: 'Beat Roll · 2 compases',
          label: '✦ Beat Roll · 2 compases',
          detail: 'Loop stutter progresivo sobre el compás previo al cruce tonal',
        };
      }
    }

    // Default Balanced Transition rotating based on seed
    const defMode = seed % 3;
    if (defMode === 0) {
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
        title: 'Intercambio graves · 2 compases',
        label: '✦ Intercambio graves · 2 compases',
        detail: 'Intercambio dinámico de frecuencias graves central',
      };
    } else if (defMode === 1) {
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
        title: 'Freno vinilo · 1 compás',
        label: '✦ Freno vinilo · 1 compás',
        detail: 'Freno de tornamesa con corte limpio al inicio del compás',
      };
    } else {
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
        title: 'Eco y filtro · 2 compases',
        label: '✦ Eco y filtro · 2 compases',
        detail: 'Eco espacial retardado y barrido de frecuencias para suavizar la entrada',
      };
    }
  }

  /**
   * Generates studio-grade DJ acoustic sound effects using the Web Audio API.
   * Delivers that authentic club/festival physical sound impact.
   */
  public triggerDJEffect(
    ctx: AudioContext,
    type: 'freno_vinilo' | 'beat_roll' | 'sub_impact' | 'riser'
  ): void {
    if (!ctx || ctx.state === 'suspended') return;
    const now = ctx.currentTime;

    try {
      if (type === 'sub_impact') {
        // Deep punchy sub-bass drop transient (sine 95Hz -> 36Hz)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(95, now);
        osc.frequency.exponentialRampToValueAtTime(36, now + 0.35);

        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.42);
      } else if (type === 'freno_vinilo') {
        // Turntable motor power-off sweep
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(380, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.55);

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1200, now);
        filter.frequency.exponentialRampToValueAtTime(150, now + 0.55);

        gain.gain.setValueAtTime(0.25, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.55);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.58);
      } else if (type === 'riser') {
        // White noise frequency sweep building into drop
        const bufferSize = Math.floor(ctx.sampleRate * 0.8);
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.Q.value = 3.0;
        filter.frequency.setValueAtTime(350, now);
        filter.frequency.exponentialRampToValueAtTime(4500, now + 0.8);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.linearRampToValueAtTime(0.3, now + 0.75);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.8);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        noise.start(now);
        noise.stop(now + 0.82);
      }
    } catch {}
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

    // Schedule Dynamic Sound Effects at the drop and transition point
    setTimeout(() => {
      if (this.isAuditionPlaying && this.audioCtx) {
        this.triggerDJEffect(this.audioCtx, 'sub_impact');
      }
    }, Math.max(0, (crossoverTime - now) * 1000));

    if (config.preset === 'freno_vinilo' || config.fxMode === 'freno_vinilo') {
      setTimeout(() => {
        if (this.isAuditionPlaying && this.audioCtx) {
          this.triggerDJEffect(this.audioCtx, 'freno_vinilo');
        }
      }, Math.max(0, (crossoverTime - 0.25 - now) * 1000));
    }

    if (config.preset === 'crescendo' || config.fxMode === 'distorsion_wash') {
      setTimeout(() => {
        if (this.isAuditionPlaying && this.audioCtx) {
          this.triggerDJEffect(this.audioCtx, 'riser');
        }
      }, Math.max(0, (transStart - now) * 1000));
    }

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
