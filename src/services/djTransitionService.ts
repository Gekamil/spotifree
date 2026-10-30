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
  private onStopCallback: (() => void) | null = null;

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
          title: 'Freno vinilo',
          label: '✦ Freno vinilo',
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
          title: 'Eco y filtro',
          label: '✦ Eco y filtro',
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
          title: 'Beat Roll',
          label: '✦ Beat Roll',
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
          title: 'Eco y filtro',
          label: '✦ Eco y filtro',
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
          title: 'Corte directo',
          label: '✦ Corte directo',
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
          title: 'Automática',
          label: '✦ Automática',
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
          title: 'Crescendo',
          label: '✦ Crescendo',
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
          title: 'Automática',
          label: '✦ Automática',
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
          title: 'Beat Roll',
          label: '✦ Beat Roll',
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
        title: 'Automática',
        label: '✦ Automática',
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
        title: 'Freno vinilo',
        label: '✦ Freno vinilo',
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
        title: 'Eco y filtro',
        label: '✦ Eco y filtro',
        detail: 'Eco espacial retardado y barrido de frecuencias para suavizar la entrada',
      };
    }
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

  public stopAudition(): void {
    if (this.previewInterval !== null) {
      clearInterval(this.previewInterval);
      this.previewInterval = null;
    }
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
  }

  public isPlaying(): boolean {
    return this.isAuditionPlaying;
  }
}

export const djTransitionService = new DJTransitionService();
