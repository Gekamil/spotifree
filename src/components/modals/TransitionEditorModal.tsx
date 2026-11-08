import React, { useState, useEffect, useRef } from 'react';
import type { Track } from '../../types/spotify';
import {
  type AudioFeature,
  getTrackAnalysis,
  resolveClientSideRealFeature,
  TRACK_ANALYSIS_EVENT,
} from '../../utils/audioFeatures';
import {
  alignEntry,
  computeTransitionGains,
  fitBars,
  getDJSessionSeed,
  getMixTrackInfo,
  mixStyleName,
  mixStyleOf,
  planTransition,
  transitionSwapPoint,
  type MixStyle,
  type PlannedTransition,
} from '../../services/djMixPlanner';
import { nativeFxStatus } from '../../services/nativeAudioFx';

/** The four mixing styles offered in the editor (older saved styles map onto them) */
const STYLE_CHIPS: Array<{ id: Exclude<MixStyle, 'linear'>; label: string }> = [
  { id: 'blend', label: 'Mezcla' },
  { id: 'fade', label: 'Fundido' },
  { id: 'cut', label: 'Corte en el 1' },
  { id: 'build', label: 'Subidón' },
];
const STYLE_TEXT: Record<MixStyle, string> = {
  blend:
    'B entra desde lejos sobre el final de A y va subiendo. A aguanta y luego se va, y las dos solo suenan fuerte un momento. La intro de B termina justo cuando acaba la música de A.',
  fade: 'Fundido cruzado de potencia constante: el volumen total no baja ni sube mientras una canción da paso a la otra.',
  linear: 'Fundido lineal: una canción baja mientras la otra sube al mismo ritmo.',
  cut: 'A suena entera hasta el compás. B ya va sonando en silencio y entra justo en su parte fuerte, sin solapar ritmos.',
  build: 'A sostiene y deja hueco, sube un barrido suave durante los dos últimos compases y B entra de golpe en su parte fuerte.',
};
import { analyzeTrackAudio } from '../../services/trackAnalysisService';

/** Human label for where a track's BPM / key come from. */
function sourceLabel(f: AudioFeature): string {
  switch (f.source) {
    case 'analysis':
      return 'Medido del audio';
    case 'deezer':
      return 'BPM de Deezer · tono estimado';
    case 'catalog':
      return 'Catálogo verificado';
    case 'artist':
      return 'Estimado por artista';
    default:
      return 'Estimado';
  }
}
import { formatDuration } from '../../utils/formatters';
import { getTrackCoverUrl } from '../../utils/trackCovers';
import {
  djTransitionService,
  type DJTransitionConfig,
  type TransitionPreset,
  type VolumeEnvelope,
  type EQFilterMode,
  type DJFXMode,
} from '../../services/djTransitionService';
import { audioEngine } from '../../services/audioEngine';

export interface SpectralSlice {
  low: number;   // 0.0 - 1.0 (sub-bass / kick foundation)
  mid: number;   // 0.0 - 1.0 (midrange / vocals / synth)
  high: number;  // 0.0 - 1.0 (treble / hats / air)
  peak: number;  // 0.0 - 1.0 (transient peak)
}

export interface DeckSpectralPalette {
  lows: string;
  mids: string;
  highs: string;
  ghostLine: string;
  labelColor: string;
}

const DECK_A_PALETTE: DeckSpectralPalette = {
  lows: '#0077b6',       // Deep electric cyan/blue
  mids: '#00b4d8',       // Bright cyan
  highs: '#caf0f8',      // Crisp ice white/cyan
  ghostLine: 'rgba(0, 180, 216, 0.15)',
  labelColor: 'rgba(56, 189, 248, 0.70)',
};

const DECK_B_PALETTE: DeckSpectralPalette = {
  lows: '#be185d',       // Deep magenta / crimson base
  mids: '#f43f5e',       // Vibrant neon pink
  highs: '#ffe4e6',      // Warm white / pink transients
  ghostLine: 'rgba(244, 63, 94, 0.15)',
  labelColor: 'rgba(244, 63, 94, 0.70)',
};

export interface TimelineCoordinates {
  T_leadIn: number;
  T_mix: number;
  T_leadOut: number;
  T_total: number;
  W: number;
  H: number;
  W_leadIn: number;
  W_mix: number;
  W_leadOut: number;
  X_mixStart: number;
  X_mixEnd: number;
  X_crossover: number;
  N_beats: number;
  stepBeat: number;
}

function computeTimelineCoordinates(
  width: number,
  height: number,
  tempo: number,
  compases: number,
  swapPoint = 0.5
): TimelineCoordinates {
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
  const X_crossover = W_leadIn + swapPoint * W_mix;

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

function generateSpectralWaveform(
  seedStr: string,
  count: number,
  tempo: number
): SpectralSlice[] {
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const seed = h >>> 0;

  const prng = (offset: number) => {
    let s = (seed + offset * 1013904223) >>> 0;
    s = (s ^ (s >> 15)) * 2246822507 >>> 0;
    s = (s ^ (s >> 13)) * 3266489909 >>> 0;
    return ((s ^ (s >> 16)) >>> 0) / 4294967296;
  };

  const safeTempo = tempo > 40 && tempo < 240 ? tempo : 128;
  const beatInterval = Math.max(3, Math.round(120 / safeTempo));
  const slices: SpectralSlice[] = [];

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

export interface TransitionEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  trackA: Track | null;
  trackB: Track | null;
  onSaved?: () => void;
  onSaveConfig?: (config: DJTransitionConfig) => void;
}

export const TransitionEditorModal: React.FC<TransitionEditorModalProps> = ({
  isOpen,
  onClose,
  trackA,
  trackB,
  onSaved,
  onSaveConfig,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [canvasWidth, setCanvasWidth] = useState<number>(640);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const CANVAS_HEIGHT = 196;

  // Audio features
  const featA: AudioFeature = resolveClientSideRealFeature(
    trackA?.id || '',
    trackA?.name || '',
    trackA?.artists?.[0]?.name
  );
  const featB: AudioFeature = resolveClientSideRealFeature(
    trackB?.id || '',
    trackB?.name || '',
    trackB?.artists?.[0]?.name
  );

  // Transition parameters state
  const [compases, setCompases] = useState<number>(2);
  const [preset, setPreset] = useState<TransitionPreset>('automatica');
  const [volumeEnvelope, setVolumeEnvelope] = useState<VolumeEnvelope>('superposicion');
  const [eqMode, setEqMode] = useState<EQFilterMode>('intercambio_graves_central');
  const [fxMode, setFxMode] = useState<DJFXMode>('ninguno');
  // Where song B enters (seconds) and why the planner chose this transition
  const [mixInSec, setMixInSec] = useState<number>(0);
  const [planReason, setPlanReason] = useState<string | null>(null);
  const [planIntensity, setPlanIntensity] = useState<DJTransitionConfig['intensity']>(undefined);
  const [ideaNonce, setIdeaNonce] = useState(0);
  const [analysisVersion, setAnalysisVersion] = useState(0);
  const [isMeasuring, setIsMeasuring] = useState(false);
  // True once the user changes something by hand (then new analysis data won't overwrite it)
  const dirtyRef = useRef(false);
  const lastAppliedRef = useRef('');
  const shownIdeasRef = useRef<Array<{ preset: TransitionPreset; intensity: 'basic' | 'smooth' | 'wow' }>>([]);

  const applyConfig = (cfg: Partial<PlannedTransition> & Partial<DJTransitionConfig>) => {
    const next = {
      compases: cfg.compases || 2,
      preset: cfg.preset || 'automatica',
      volumeEnvelope: cfg.volumeEnvelope || 'superposicion',
      eqMode: cfg.eqMode || 'intercambio_graves_central',
      fxMode: cfg.fxMode || 'ninguno',
      mixInSec: typeof cfg.mixInSec === 'number' ? cfg.mixInSec : 0,
    } as const;
    lastAppliedRef.current = JSON.stringify(next);
    setCompases(next.compases);
    setPreset(next.preset);
    setVolumeEnvelope(next.volumeEnvelope);
    setEqMode(next.eqMode);
    setFxMode(next.fxMode);
    setMixInSec(next.mixInSec);
    setPlanReason(cfg.reason || null);
    setPlanIntensity(cfg.intensity);
  };

  // Dropdown menus
  const [isCompasesMenuOpen, setIsCompasesMenuOpen] = useState(false);

  // Audition playback state
  const [isAuditionLoading, setIsAuditionLoading] = useState(false);
  const [isPlayingAudition, setIsPlayingAudition] = useState(false);
  const [auditionProgress, setAuditionProgress] = useState(0.0);
  const auditionRunRef = useRef(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Responsive ResizeObserver for canvas width
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (container.clientWidth > 0) {
      setCanvasWidth(container.clientWidth);
    }

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const cr = entry.contentRect;
        if (cr.width > 0) {
          setCanvasWidth((prev) => {
            if (Math.abs(cr.width - prev) >= 1) {
              return Math.floor(cr.width);
            }
            return prev;
          });
        }
      }
    });

    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // Load the saved transition for this pair, or the planner's choice (real BPM / key / energy)
  useEffect(() => {
    dirtyRef.current = false;
    shownIdeasRef.current = [];
    setIdeaNonce(0);
  }, [trackA?.id, trackB?.id]);

  useEffect(() => {
    if (!trackA?.id || !trackB?.id) return;
    if (dirtyRef.current) return; // never overwrite the user's manual edits
    applyConfig(djTransitionService.getPlannedTransition(trackA, trackB));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackA?.id, trackB?.id, analysisVersion]);

  // Any state that differs from the last applied plan is a manual edit
  useEffect(() => {
    if (!lastAppliedRef.current) return;
    const current = JSON.stringify({ compases, preset, volumeEnvelope, eqMode, fxMode, mixInSec });
    if (current !== lastAppliedRef.current) dirtyRef.current = true;
  }, [compases, preset, volumeEnvelope, eqMode, fxMode, mixInSec]);

  // Measure both songs from their real audio when the editor opens
  useEffect(() => {
    if (!isOpen || !trackA || !trackB) return;
    const onAnalysis = (e: Event) => {
      const id = (e as CustomEvent<{ id?: string }>).detail?.id || '';
      if (trackA.id.includes(id) || trackB.id.includes(id)) setAnalysisVersion((v) => v + 1);
    };
    window.addEventListener(TRACK_ANALYSIS_EVENT, onAnalysis);
    const needsA = getTrackAnalysis(trackA.id)?.tempoSource !== 'analysis';
    const needsB = getTrackAnalysis(trackB.id)?.tempoSource !== 'analysis';
    if (needsA || needsB) {
      setIsMeasuring(true);
      Promise.all([needsA ? analyzeTrackAudio(trackA) : null, needsB ? analyzeTrackAudio(trackB) : null]).finally(() =>
        setIsMeasuring(false)
      );
    }
    return () => window.removeEventListener(TRACK_ANALYSIS_EVENT, onAnalysis);
  }, [isOpen, trackA?.id, trackB?.id]);

  // "Otra idea": ask the planner for a different transition that still makes sense
  const handleAnotherIdea = () => {
    if (!trackA || !trackB) return;
    const a = getMixTrackInfo(trackA);
    const b = getMixTrackInfo(trackB);
    // Everything already suggested counts as "recent", so each click explores something new
    shownIdeasRef.current.push({ preset, intensity: planIntensity || 'smooth' });
    if (shownIdeasRef.current.length > 4) shownIdeasRef.current.shift();
    const recent = [...shownIdeasRef.current];
    // Look for a different style that still fits these two songs
    let nonce = ideaNonce;
    let plan = planTransition(a, b, { seed: getDJSessionSeed(), recent, nonce: ++nonce });
    for (let tries = 0; tries < 12 && plan.preset === preset && plan.compases === compases; tries++) {
      plan = planTransition(a, b, { seed: getDJSessionSeed(), recent, nonce: ++nonce });
    }
    setIdeaNonce(nonce);
    dirtyRef.current = false;
    applyConfig(plan);
  };

  const analysisB = getTrackAnalysis(trackB?.id);
  const mixInOptions: Array<{ label: string; sec: number }> = [{ label: 'Inicio', sec: 0 }];
  if (analysisB?.tempoSource === 'analysis') {
    if ((analysisB.audioStartSec || 0) > 0.4) mixInOptions.push({ label: 'Tras el silencio', sec: Math.round((analysisB.audioStartSec || 0) * 10) / 10 });
    if ((analysisB.introEndSec || 0) > (analysisB.audioStartSec || 0) + 2 && (analysisB.introEndSec || 0) <= 45) {
      mixInOptions.push({ label: 'Parte fuerte', sec: Math.round((analysisB.introEndSec || 0) * 10) / 10 });
    }
  }

  // Parents pass an inline onClose (new function every render). Keep it in a ref so the
  // audition is NOT stopped every time the screen behind re-renders (it used to cut the
  // preview after ~1 second, on the first progress tick of the player).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Stop the audition only when the editor closes / unmounts
  useEffect(() => {
    if (!isOpen) {
      audioEngine.stopTransitionAudition();
      djTransitionService.stopAudition();
      setIsPlayingAudition(false);
      setIsAuditionLoading(false);
      setAuditionProgress(0);
      return;
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      audioEngine.stopTransitionAudition();
      djTransitionService.stopAudition();
    };
  }, [isOpen]);

  // The style being edited (any saved / older preset maps onto one of the four)
  const currentStyle: MixStyle = mixStyleOf({ preset, volumeEnvelope });

  /** Pick one of the four styles: sets its shape, length and where B enters */
  const handleSelectStyle = (style: Exclude<MixStyle, 'linear'> | 'auto') => {
    if (!trackA || !trackB) return;
    if (style === 'auto') {
      handleSelectPreset('automatica');
      return;
    }
    const a = getMixTrackInfo(trackA);
    const b = getMixTrackInfo(trackB);
    const shape =
      style === 'blend'
        ? { preset: 'automatica' as TransitionPreset, env: 'superposicion' as VolumeEnvelope, eq: 'intercambio_graves_central' as EQFilterMode, bars: 4, intensity: 'smooth' as const }
        : style === 'fade'
          ? { preset: 'fundido' as TransitionPreset, env: 'curva_s' as VolumeEnvelope, eq: 'sin_filtro' as EQFilterMode, bars: 2, intensity: 'basic' as const }
          : style === 'cut'
            ? { preset: 'corte' as TransitionPreset, env: 'corte_directo' as VolumeEnvelope, eq: 'intercambio_graves_central' as EQFilterMode, bars: 1, intensity: 'basic' as const }
            : { preset: 'crescendo' as TransitionPreset, env: 'curva_s' as VolumeEnvelope, eq: 'intercambio_gradual' as EQFilterMode, bars: 2, intensity: 'wow' as const };
    const bars = fitBars(shape.bars, a.tempo);
    const dur = bars * (240 / (a.tempo > 40 && a.tempo < 240 ? a.tempo : 120));
    setPreset(shape.preset);
    setVolumeEnvelope(shape.env);
    setEqMode(shape.eq);
    setFxMode('ninguno');
    setCompases(bars);
    setMixInSec(alignEntry(b, style, dur, transitionSwapPoint({ preset: shape.preset, volumeEnvelope: shape.env })));
    setPlanReason(null);
    setPlanIntensity(shape.intensity);
  };

  // Handle Preset selection with dynamic smart calculations for Automática
  const handleSelectPreset = (p: TransitionPreset) => {
    if (!trackA || !trackB) return;
    if (p === 'automatica') {
      // Let the planner decide from the real BPM / key / energy of both songs
      applyConfig(planTransition(getMixTrackInfo(trackA), getMixTrackInfo(trackB), { seed: getDJSessionSeed(), recent: [], nonce: ideaNonce }));
      dirtyRef.current = true;
      return;
    }
    setPreset(p);
    setPlanReason(null);
    setPlanIntensity(p === 'crescendo' || p === 'beat_roll' || p === 'freno_vinilo' ? 'wow' : p === 'corte' || p === 'fundido' ? 'basic' : 'smooth');
    if (p === 'fundido') {
      setVolumeEnvelope('lineal');
      setEqMode('sin_filtro');
      setFxMode('ninguno');
      setCompases(2);
    } else if (p === 'crescendo') {
      setVolumeEnvelope('curva_s');
      setEqMode('intercambio_gradual');
      setFxMode('ninguno');
      setCompases(4);
    } else if (p === 'filtro') {
      setVolumeEnvelope('superposicion');
      setEqMode('filtro_paso_bajo');
      setFxMode('ninguno');
      setCompases(2);
    } else if (p === 'corte') {
      setVolumeEnvelope('corte_directo');
      setEqMode('intercambio_graves_central');
      setFxMode('ninguno');
      setCompases(1);
    } else if (p === 'eco_out') {
      setVolumeEnvelope('curva_s');
      setEqMode('filtro_paso_bajo');
      setFxMode('eco');
      setCompases(2);
    } else if (p === 'freno_vinilo') {
      setVolumeEnvelope('corte_directo');
      setEqMode('intercambio_graves_central');
      setFxMode('freno_vinilo');
      setCompases(1);
    } else if (p === 'beat_roll') {
      setVolumeEnvelope('curva_s');
      setEqMode('intercambio_gradual');
      setFxMode('repeticion_loop');
      setCompases(2);
    } else if (p === 'distorsion_wash') {
      setVolumeEnvelope('superposicion');
      setEqMode('intercambio_graves_central');
      setFxMode('distorsion_wash');
      setCompases(4);
    } else if (p === 'mezcla_voces') {
      setVolumeEnvelope('superposicion');
      setEqMode('intercambio_graves_central');
      setFxMode('ninguno');
      setCompases(4);
    } else if (p === 'repeticion_ritmo') {
      setVolumeEnvelope('curva_s');
      setEqMode('intercambio_gradual');
      setFxMode('distorsion_wash');
      setCompases(2);
    }
  };

  // Toggle Audition with Real Songs Audio
  const handleToggleAudition = async () => {
    if (!trackA || !trackB) return;
    auditionRunRef.current += 1;
    const run = auditionRunRef.current;
    if (isPlayingAudition || isAuditionLoading) {
      audioEngine.stopTransitionAudition();
      djTransitionService.stopAudition();
      setIsPlayingAudition(false);
      setIsAuditionLoading(false);
      setAuditionProgress(0);
    } else {
      setIsAuditionLoading(true);
      const config: DJTransitionConfig = {
        trackAId: trackA.id,
        trackBId: trackB.id,
        compases,
        preset,
        volumeEnvelope,
        eqMode,
        fxMode,
        tempoA: featA.tempo,
        tempoB: featB.tempo,
        camelotA: featA.camelot,
        camelotB: featB.camelot,
        mixInSec,
        intensity: planIntensity,
      };

      try {
        const playedReal = await audioEngine.startTransitionAudition(
          trackA,
          trackB,
          config,
          (progress) => {
            setIsAuditionLoading(false);
            setIsPlayingAudition(true);
            setAuditionProgress(progress);
          },
          () => {
            setIsPlayingAudition(false);
            setIsAuditionLoading(false);
            setAuditionProgress(0);
          }
        );

        // Stopped by hand (or closed) while loading: nothing to report
        if (!playedReal && run === auditionRunRef.current) {
          setIsAuditionLoading(false);
          setIsPlayingAudition(false);
          setToastMessage('No se pudieron cargar las dos canciones. Comprueba la conexión e inténtalo otra vez.');
          setTimeout(() => setToastMessage(null), 3000);
        }
      } catch {
        setIsAuditionLoading(false);
        setIsPlayingAudition(false);
      }
    }
  };

  // Save Config
  const handleSave = () => {
    if (!trackA || !trackB) return;
    const config: DJTransitionConfig = {
      trackAId: trackA.id,
      trackBId: trackB.id,
      compases,
      preset,
      volumeEnvelope,
      eqMode,
      fxMode,
      tempoA: featA.tempo,
      tempoB: featB.tempo,
      camelotA: featA.camelot,
      camelotB: featB.camelot,
      mixInSec,
      intensity: planIntensity,
      reason: planReason || undefined,
      isCustom: true,
    };
    djTransitionService.saveTransitionConfig(config);
    if (onSaveConfig) {
      onSaveConfig(config);
    }
    setToastMessage('✦ Transición DJ guardada correctamente');
    setTimeout(() => {
      setToastMessage(null);
      if (onSaved) onSaved();
      onClose();
    }, 900);
  };

  // Pointer & mouse interactive scrubbing
  const updateScrub = (clientX: number, target: HTMLElement) => {
    const rect = target.getBoundingClientRect();
    if (rect.width <= 0) return;
    const progress = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    setAuditionProgress(progress);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    updateScrub(e.clientX, e.currentTarget);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDragging && e.buttons !== 1) return;
    updateScrub(e.clientX, e.currentTarget);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    setIsDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    updateScrub(e.clientX, e.currentTarget);
  };

  // Draw high-fidelity professional dual-deck waveform & transition visualizer
  useEffect(() => {
    if (!isOpen || !trackA || !trackB) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const width = canvasWidth > 0 ? canvasWidth : (canvas.clientWidth || 640);
    const height = CANVAS_HEIGHT;

    // Retina High-DPI buffer scaling
    const targetBufferW = Math.round(width * dpr);
    const targetBufferH = Math.round(height * dpr);
    if (canvas.width !== targetBufferW || canvas.height !== targetBufferH) {
      canvas.width = targetBufferW;
      canvas.height = targetBufferH;
    }

    // Set 2D transform to logical CSS pixels
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    // Compute unified temporal coordinates
    const coords = computeTimelineCoordinates(
      width,
      height,
      featA.tempo,
      compases,
      transitionSwapPoint({ preset, volumeEnvelope })
    );
    // Same gains the live mix and the preview play
    const gainsCfg = { preset, volumeEnvelope, eqMode, fxMode, tempoA: featA.tempo };
    const gainsAt = (p: number) => computeTransitionGains(gainsCfg, p, coords.T_mix);
    const {
      W_leadIn,
      W_mix,
      W_leadOut,
      X_mixStart,
      X_crossover,
      N_beats,
      stepBeat,
    } = coords;

    // Layer 1: Time & Bar Ruler Header (Y: 0 to 24px)
    ctx.fillStyle = '#141414';
    ctx.fillRect(0, 0, width, 24);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 24);
    ctx.lineTo(width, 24);
    ctx.stroke();

    // 1. "Solo A" badge in lead-in
    const soloAW = Math.min(48, Math.max(36, W_leadIn * 0.55));
    const soloAX = Math.max(8, (W_leadIn - soloAW) / 2);
    ctx.fillStyle = 'rgba(0, 180, 216, 0.12)';
    ctx.strokeStyle = 'rgba(0, 180, 216, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(soloAX, 4, soloAW, 16, 4);
    ctx.fill();
    ctx.stroke();

    ctx.font = 'bold 9px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#38bdf8';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Solo A', soloAX + soloAW / 2, 12);

    // 2. Bar labels & Downbeats across the Mix Window
    ctx.textAlign = 'left';
    for (let b = 1; b <= compases; b++) {
      const barX = W_leadIn + (b - 1) * 4 * stepBeat;
      if (Math.abs(barX + 18 - X_crossover) < 52) continue; // the change marker sits there
      ctx.font = 'bold 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.fillText(`Bar ${b}`, barX + 5, 12);
    }

    // Secondary beat ticks in ruler header
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 1;
    for (let k = 1; k < N_beats; k++) {
      if (k % 4 !== 0) {
        const bx = W_leadIn + k * stepBeat;
        ctx.beginPath();
        ctx.moveTo(bx, 16);
        ctx.lineTo(bx, 23);
        ctx.stroke();
      }
    }

    // 3. Golden Diamond Crossover Marker (◆ CRUCE)
    const cruceW = 54;
    const cruceX = X_crossover - cruceW / 2;
    ctx.fillStyle = 'rgba(250, 204, 21, 0.18)';
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.70)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(cruceX, 4, cruceW, 16, 4);
    ctx.fill();
    ctx.stroke();

    ctx.font = 'bold 9px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#facc15';
    ctx.textAlign = 'center';
    ctx.fillText('◆ CAMBIO', X_crossover, 12);

    // 4. "Solo B" badge in lead-out
    const soloBW = Math.min(48, Math.max(36, W_leadOut * 0.55));
    const soloBX = W_leadIn + W_mix + Math.max(8, (W_leadOut - soloBW) / 2);
    ctx.fillStyle = 'rgba(244, 63, 94, 0.12)';
    ctx.strokeStyle = 'rgba(244, 63, 94, 0.35)';
    ctx.beginPath();
    ctx.roundRect(soloBX, 4, soloBW, 16, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f43f5e';
    ctx.fillText('Solo B', soloBX + soloBW / 2, 12);

    // Layer 2 & 4: Dual-Deck 3-Band Spectral Waveforms
    const numSlices = 120;
    const barsCount = numSlices;
    const slicesA = generateSpectralWaveform(trackA.id + trackA.name, barsCount, featA.tempo);
    const slicesB = generateSpectralWaveform(trackB.id + trackB.name, barsCount, featB.tempo);

    const barWidth = width / numSlices;
    const sliceRenderW = Math.max(1.5, barWidth * 0.82);

    const centerAY = 57;
    const centerBY = 163;
    const maxHalfH = 26;

    // Deck Labels / Watermarks
    ctx.font = 'bold 9px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = DECK_A_PALETTE.labelColor;
    ctx.fillText('DECK A • SALIENTE', 8, 38);

    ctx.fillStyle = DECK_B_PALETTE.labelColor;
    ctx.fillText('DECK B • ENTRANTE', 8, 144);

    // Render Slices across full timeline
    for (let i = 0; i < numSlices; i++) {
      const x = i * barWidth;
      const sliceA = slicesA[i];
      const sliceB = slicesB[i];

      let volA = 1.0;
      let bassA = 1.0;
      let midsA = 1.0;
      let highsA = 1.0;
      let isGhostA = false;

      let volB = 1.0;
      let bassB = 1.0;
      let midsB = 1.0;
      let highsB = 1.0;
      let isGhostB = false;

      if (x < W_leadIn) {
        // Zone 1: Solo A (Deck B in standby)
        isGhostB = true;
      } else if (x > W_leadIn + W_mix) {
        // Zone 3: Solo B (Deck A muted)
        isGhostA = true;
      } else {
        // Zone 2: Mix Window
        const pMix = Math.max(0, Math.min(1, (x - W_leadIn) / W_mix));

        // The exact volumes the mix plays at this point (no fake EQ / FX drawn)
        const g = gainsAt(pMix);
        volA = g.outVol;
        volB = g.inVol;
      }

      // Render Deck A Slice
      if (isGhostA) {
        ctx.fillStyle = DECK_A_PALETTE.ghostLine;
        ctx.fillRect(x, centerAY - 1, sliceRenderW, 2);
      } else {
        const aLow = Math.max(0.05, sliceA.low * volA * bassA);
        const aMid = Math.max(0.05, sliceA.mid * volA * midsA);
        const aHigh = Math.max(0.05, sliceA.high * volA * highsA);
        const aPeak = Math.max(aLow, sliceA.peak * volA);

        const hLow = Math.max(1.5, aLow * maxHalfH);
        const hMid = Math.max(1.5, aMid * maxHalfH * 0.80);
        const hHigh = Math.max(1.0, aHigh * maxHalfH * 0.45);
        const hPeak = Math.max(hLow, aPeak * maxHalfH);

        // Lows (Base foundation)
        ctx.fillStyle = DECK_A_PALETTE.lows;
        ctx.fillRect(x, centerAY - hLow, sliceRenderW, hLow * 2);

        // Mids (Musical body)
        ctx.fillStyle = DECK_A_PALETTE.mids;
        ctx.fillRect(x, centerAY - hMid, sliceRenderW, hMid * 2);

        // Highs (Core spine & peaks)
        ctx.fillStyle = DECK_A_PALETTE.highs;
        ctx.fillRect(x, centerAY - hHigh, sliceRenderW, hHigh * 2);

        // Transient Needle Peaks
        if (hPeak > hLow + 1) {
          ctx.fillRect(x, centerAY - hPeak, sliceRenderW, hPeak - hLow);
          ctx.fillRect(x, centerAY + hLow, sliceRenderW, hPeak - hLow);
        }
      }

      // Render Deck B Slice
      if (isGhostB) {
        ctx.fillStyle = DECK_B_PALETTE.ghostLine;
        ctx.fillRect(x, centerBY - 1, sliceRenderW, 2);
      } else {
        const bLow = Math.max(0.05, sliceB.low * volB * bassB);
        const bMid = Math.max(0.05, sliceB.mid * volB * midsB);
        const bHigh = Math.max(0.05, sliceB.high * volB * highsB);
        const bPeak = Math.max(bLow, sliceB.peak * volB);

        const hLow = Math.max(1.5, bLow * maxHalfH);
        const hMid = Math.max(1.5, bMid * maxHalfH * 0.80);
        const hHigh = Math.max(1.0, bHigh * maxHalfH * 0.45);
        const hPeak = Math.max(hLow, bPeak * maxHalfH);

        // Lows (Base foundation)
        ctx.fillStyle = DECK_B_PALETTE.lows;
        ctx.fillRect(x, centerBY - hLow, sliceRenderW, hLow * 2);

        // Mids (Musical body)
        ctx.fillStyle = DECK_B_PALETTE.mids;
        ctx.fillRect(x, centerBY - hMid, sliceRenderW, hMid * 2);

        // Highs (Core spine & peaks)
        ctx.fillStyle = DECK_B_PALETTE.highs;
        ctx.fillRect(x, centerBY - hHigh, sliceRenderW, hHigh * 2);

        // Transient Needle Peaks
        if (hPeak > hLow + 1) {
          ctx.fillRect(x, centerBY - hPeak, sliceRenderW, hPeak - hLow);
          ctx.fillRect(x, centerBY + hLow, sliceRenderW, hPeak - hLow);
        }
      }
    }

    // Synchronized Beat Grid across both decks (Y: 24 to 196)
    for (let k = 0; k <= N_beats; k++) {
      const bx = W_leadIn + k * stepBeat;
      const isDownbeat = k % 4 === 0;

      ctx.beginPath();
      ctx.moveTo(bx, 24);
      ctx.lineTo(bx, height);

      if (isDownbeat) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([]);
      } else {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 1.0;
        ctx.setLineDash([2, 4]);
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Golden Crossover Downbeat Line with Glow
    ctx.save();
    ctx.shadowColor = '#facc15';
    ctx.shadowBlur = 8;
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(X_crossover, 24);
    ctx.lineTo(X_crossover, height);
    ctx.stroke();
    ctx.restore();

    // Layer 3: Center Mixing Hub & Envelope Curves (Y: 90 to 130px)
    const HUB_Y_TOP = 90;
    const HUB_Y_BOTTOM = 130;
    const HUB_HEIGHT = 40;
    const HUB_Y_MID = 110;
    const Y_1 = 96;  // 100% volume
    const Y_0 = 124; // 0% volume
    const Y_RANGE = 28;

    const yFromLevel = (v: number) => Y_0 - Math.max(0, Math.min(1, v)) * Y_RANGE;

    // Hub background & subtle borders
    ctx.fillStyle = 'rgba(18, 18, 18, 0.75)';
    ctx.fillRect(0, HUB_Y_TOP, width, HUB_HEIGHT);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, HUB_Y_TOP);
    ctx.lineTo(width, HUB_Y_TOP);
    ctx.moveTo(0, HUB_Y_BOTTOM);
    ctx.lineTo(width, HUB_Y_BOTTOM);
    ctx.stroke();

    // Guideline 50%
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.moveTo(0, HUB_Y_MID);
    ctx.lineTo(width, HUB_Y_MID);
    ctx.stroke();
    ctx.setLineDash([]);

    // Bass Swap vertical dashed line in Hub
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(X_crossover, HUB_Y_TOP);
    ctx.lineTo(X_crossover, HUB_Y_BOTTOM);
    ctx.stroke();
    ctx.setLineDash([]);

    // Diamond badge at (X_crossover, 110)
    ctx.fillStyle = '#facc15';
    ctx.shadowColor = '#facc15';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(X_crossover, HUB_Y_MID - 5);
    ctx.lineTo(X_crossover + 5, HUB_Y_MID);
    ctx.lineTo(X_crossover, HUB_Y_MID + 5);
    ctx.lineTo(X_crossover - 5, HUB_Y_MID);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;


    // Deck A Volume Curve (Cyan #38bdf8)
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 4;
    ctx.beginPath();

    // Lead-in: 100%
    ctx.moveTo(0, Y_1);
    ctx.lineTo(X_mixStart, Y_1);

    // Mix window: the exact gains the live mix and the preview play
    const curveSteps = 64;
    for (let s = 0; s <= curveSteps; s++) {
      const p = s / curveSteps;
      ctx.lineTo(X_mixStart + p * W_mix, yFromLevel(gainsAt(p).outVol));
    }

    // Lead-out: muted (0%)
    ctx.lineTo(width, Y_0);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Deck B Volume Curve (Neon Pink #f43f5e)
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = '#f43f5e';
    ctx.shadowBlur = 4;
    ctx.beginPath();

    // Lead-in: standby (0%)
    ctx.moveTo(0, Y_0);
    ctx.lineTo(X_mixStart, Y_0);

    // Mix window
    for (let s = 0; s <= curveSteps; s++) {
      const p = s / curveSteps;
      ctx.lineTo(X_mixStart + p * W_mix, yFromLevel(gainsAt(p).inVol));
    }

    // Lead-out: full groove (100%)
    ctx.lineTo(width, Y_1);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Filter Sweep / FX Overlays (Purple #c084fc)
    // Only the build-up (Subidón) has an effect: a rising sweep that ends on the drop
    if (mixStyleOf({ preset, volumeEnvelope }) === 'build') {
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      const riseStart = Math.max(X_mixStart, X_crossover - stepBeat * 8);
      ctx.moveTo(riseStart, Y_0 - 2);
      ctx.quadraticCurveTo(X_crossover - (X_crossover - riseStart) * 0.25, Y_0 - 4, X_crossover, Y_1 + 2);
      ctx.lineTo(X_crossover, Y_0 - 2);
      ctx.stroke();
    }

    // Playhead & Pointer Caps (Spotify Neon Green #1ed760)
    const playheadX = Math.max(0, Math.min(width, auditionProgress * width));
    ctx.save();
    ctx.strokeStyle = '#1ed760';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#1ed760';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, height);
    ctx.stroke();

    // Top Pointer Cap (Downward Triangle at Y = 0)
    ctx.fillStyle = '#1ed760';
    ctx.beginPath();
    ctx.moveTo(playheadX - 6, 0);
    ctx.lineTo(playheadX + 6, 0);
    ctx.lineTo(playheadX, 8);
    ctx.closePath();
    ctx.fill();

    // Bottom Pointer Cap (Upward Triangle at Y = height)
    ctx.beginPath();
    ctx.moveTo(playheadX - 6, height);
    ctx.lineTo(playheadX + 6, height);
    ctx.lineTo(playheadX, height - 8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

  }, [
    canvasWidth,
    trackA,
    trackA?.id,
    trackA?.name,
    trackB,
    trackB?.id,
    trackB?.name,
    featA?.tempo,
    featB?.tempo,
    compases,
    preset,
    volumeEnvelope,
    eqMode,
    fxMode,
    auditionProgress,
    isOpen,
  ]);

  if (!isOpen || !trackA || !trackB) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-start sm:items-center justify-center p-2.5 sm:p-4 pt-14 sm:pt-6 pb-4 overflow-y-auto animate-fade-in font-['SpotifyMixUI']">
      <div className="w-full max-w-md md:max-w-2xl lg:max-w-3xl bg-[#121212] rounded-2xl border border-white/10 shadow-2xl flex flex-col overflow-hidden max-h-[88vh] sm:max-h-[90vh] my-auto shrink-0">
        {/* Top Header Row matching Spotify Screenshot */}
        <div className="px-4 py-3 sm:px-5 flex items-center justify-between border-b border-white/10 shrink-0 bg-[#121212] sticky top-0 z-50">
          {/* Close button (✕ Cerrar) */}
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white transition-all cursor-pointer font-bold text-xs"
            title="Cerrar modal (Esc)"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            <span>Cerrar</span>
          </button>

          {/* Center Beta badge */}
          <span className="px-2.5 py-0.5 rounded-full bg-[#282828] text-white/90 text-xs font-semibold tracking-wide border border-white/10 select-none">
            Beta
          </span>

          {/* Right Action buttons: Options (···) + Guardar */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => {}}
              className="text-white/70 hover:text-white p-1 transition-colors cursor-pointer"
              title="Opciones"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="5" cy="12" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="19" cy="12" r="2" />
              </svg>
            </button>

            <button
              onClick={handleSave}
              className="px-4 py-1.5 rounded-full bg-[#1ed760] hover:bg-[#1fdf64] active:scale-95 text-black text-xs font-bold tracking-tight shadow-md transition-all cursor-pointer"
            >
              Guardar
            </button>
          </div>
        </div>

        {/* Content Body with proper internal scrolling */}
        <div className="p-3.5 sm:p-5 overflow-y-auto space-y-3 flex-1 min-h-0">
          {/* Track 1 Card (Outgoing Track) */}
          <div className="flex items-center justify-between gap-3 px-1">
            <div className="flex items-center gap-3 min-w-0">
              <img
                src={getTrackCoverUrl(trackA)}
                alt={trackA.name}
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-[6px] object-cover bg-[#282828] shadow-md shrink-0"
              />
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-white truncate leading-tight font-['SpotifyMixUITitle']">
                  {trackA.name}
                </h4>
                <p className="text-xs text-[#b3b3b3] truncate mt-0.5">
                  {trackA.artists?.[0]?.name || 'Artista'}
                </p>
              </div>
            </div>

            {/* Right BPM & Camelot info */}
            <div className="flex flex-col items-end shrink-0 pl-2">
              <span className="text-xs text-[#a7a7a7] font-medium font-['SpotifyMixUI'] tabular-nums">
                {featA.tempo} bpm
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className="px-1.5 py-0.5 rounded-[3px] text-[10px] font-black leading-none uppercase tracking-tight"
                  style={{
                    backgroundColor: featA.color || '#cfa23e',
                    color: featA.textColor || '#000000',
                  }}
                >
                  {featA.camelot}
                </span>
                <span className="text-xs text-[#a7a7a7] font-['SpotifyMixUI'] tabular-nums">
                  {formatDuration(trackA.duration_ms)}
                </span>
              </div>
            </div>
          </div>

          {/* Dual-Deck Waveform Canvas Box */}
          <div className="flex items-center justify-between px-1 text-[11px] text-[#a7a7a7] flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#38bdf8]" />
                <span className="text-xs text-white/90 font-medium">Pista A (Voces & Salida)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#f43f5e]" />
                <span className="text-xs text-white/90 font-medium">Pista B (Entrante)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm bg-[#facc15]" />
                <span className="text-xs text-[#facc15] font-semibold">Punto de cambio</span>
              </div>
              {currentStyle === 'build' && (
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-sm bg-[#c084fc]" />
                  <span className="text-xs text-[#c084fc] font-semibold">Subida</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 font-medium">
              <span className="text-[#1ed760] flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#1ed760] animate-pulse" />
                Sin vacíos
              </span>
              <span>•</span>
              <span>Camelot:</span>
              <span className="font-bold text-white">{featA.camelot} → {featB.camelot}</span>
            </div>
          </div>

          {/* Visualizer Canvas Container with High-DPI Support */}
          <div
            ref={containerRef}
            className="relative rounded-2xl bg-[#181818] border border-white/5 p-2 shadow-inner overflow-hidden select-none"
          >
            <canvas
              ref={canvasRef}
              width={canvasWidth}
              height={CANVAS_HEIGHT}
              style={{ width: '100%', height: `${CANVAS_HEIGHT}px` }}
              onClick={handleCanvasClick}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              className="w-full h-[196px] rounded-xl cursor-pointer block"
            />

            {/* Center Floating Audition Button (▶ / ■ / Loading spinner) */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <button
                onClick={handleToggleAudition}
                className="pointer-events-auto w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-black/75 hover:bg-black/90 active:scale-95 border border-white/20 backdrop-blur-md flex items-center justify-center shadow-2xl transition-all cursor-pointer z-30 group"
                title={
                  isAuditionLoading
                    ? 'Cargando y sincronizando canciones reales...'
                    : isPlayingAudition
                    ? 'Detener preescucha'
                    : 'Escuchar transición DJ'
                }
              >
                {isAuditionLoading ? (
                  <div className="w-4 h-4 border-2 border-white/20 border-t-[#1ed760] rounded-full animate-spin" />
                ) : isPlayingAudition ? (
                  <div className="w-3.5 h-3.5 bg-white rounded-sm group-hover:scale-105 transition-transform" />
                ) : (
                  <div className="w-0 h-0 border-y-[7px] border-y-transparent border-l-[11px] border-l-white ml-0.5 group-hover:scale-105 transition-transform" />
                )}
              </button>
            </div>

            {/* Compases Dropdown Pill at the bottom center of Waveform Card */}
            <div className="absolute bottom-2 left-0 right-0 flex justify-center z-20">
              <div className="relative">
                <button
                  onClick={() => setIsCompasesMenuOpen(!isCompasesMenuOpen)}
                  className="px-3.5 py-1 rounded-full bg-[#282828] hover:bg-[#333333] border border-white/10 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
                >
                  <span>{compases} compases</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {isCompasesMenuOpen && (
                  <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 bg-[#282828] border border-white/10 rounded-xl py-1 w-32 shadow-2xl z-40">
                    {[1, 2, 4, 8, 16].map((bars) => (
                      <button
                        key={bars}
                        onClick={() => {
                          setCompases(bars);
                          setIsCompasesMenuOpen(false);
                        }}
                        className={`w-full text-left px-3.5 py-1.5 text-xs transition-colors flex items-center justify-between ${
                          compases === bars ? 'text-[#1ed760] font-bold bg-white/5' : 'text-white hover:bg-white/10'
                        }`}
                      >
                        <span>{bars} {bars === 1 ? 'compás' : 'compases'}</span>
                        {compases === bars && <span>✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Track 2 Card (Incoming Track) */}
          <div className="flex items-center justify-between gap-3 px-1">
            <div className="flex items-center gap-3 min-w-0">
              <img
                src={getTrackCoverUrl(trackB)}
                alt={trackB.name}
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-[6px] object-cover bg-[#282828] shadow-md shrink-0"
              />
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-white truncate leading-tight font-['SpotifyMixUITitle']">
                  {trackB.name}
                </h4>
                <p className="text-xs text-[#b3b3b3] truncate mt-0.5">
                  {trackB.artists?.[0]?.name || 'Artista'}
                </p>
              </div>
            </div>

            {/* Right BPM & Camelot info */}
            <div className="flex flex-col items-end shrink-0 pl-2">
              <span className="text-xs text-[#a7a7a7] font-medium font-['SpotifyMixUI'] tabular-nums">
                {featB.tempo} bpm
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className="px-1.5 py-0.5 rounded-[3px] text-[10px] font-black leading-none uppercase tracking-tight"
                  style={{
                    backgroundColor: featB.color || '#cfa23e',
                    color: featB.textColor || '#000000',
                  }}
                >
                  {featB.camelot}
                </span>
                <span className="text-xs text-[#a7a7a7] font-['SpotifyMixUI'] tabular-nums">
                  {formatDuration(trackB.duration_ms)}
                </span>
              </div>
            </div>
          </div>

          {/* Plan de Transición y Mezcla DJ Dinámica */}
          <div className="rounded-xl bg-white/[0.03] border border-white/10 p-3.5 shadow-sm space-y-1.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#1ed760] animate-pulse" />
                <span className="text-xs font-bold text-white font-['SpotifyMixUITitle']">
                  {`✦ ${mixStyleName(currentStyle)}`}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/10 text-[#b3b3b3]">
                  {compases} {compases === 1 ? 'compás' : 'compases'} ({djTransitionService.calculateDurationSeconds(featA.tempo || 128, compases).toFixed(1)}s)
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-[#a7a7a7]">
                <span>Tempo: <strong className="text-white">{featA.tempo}</strong> → <strong className="text-white">{featB.tempo} BPM</strong></span>
                <span>•</span>
                <span>Clave: <strong className="text-white">{featA.camelot}</strong> → <strong className="text-white">{featB.camelot}</strong></span>
              </div>
            </div>
            {planReason && (
              <p className="text-xs text-white/90 leading-relaxed">
                <span className="font-bold text-[#1ed760]">Por qué: </span>
                {planReason}
              </p>
            )}
            <p className={`text-xs text-[#b3b3b3] leading-relaxed ${planReason ? 'hidden' : ''}`}>
              {STYLE_TEXT[currentStyle]}
            </p>

            {/* Where the data comes from + "another idea" */}
            <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
              <span className="text-[11px] text-[#a7a7a7]">
                {isMeasuring ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-3 h-3 border-2 border-[#1ed760] border-t-transparent rounded-full animate-spin" />
                    Midiendo BPM y tono del audio real…
                  </span>
                ) : (
                  <>
                    A: {sourceLabel(featA)} · B: {sourceLabel(featB)}
                  </>
                )}
              </span>
              <button
                type="button"
                onClick={handleAnotherIdea}
                className="px-3 py-1 rounded-full border border-[#727272] hover:border-white text-[11px] font-bold text-white hover:scale-[1.04] active:scale-95 transition-all cursor-pointer"
              >
                Otra idea
              </button>
            </div>

            {/* Song B entry point */}
            <div className="pt-2 border-t border-white/5 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-[#a7a7a7] uppercase tracking-wider">Entrada de B</span>
                <span className="text-xs font-bold text-white tabular-nums">{formatDuration(Math.round(mixInSec * 1000))}</span>
              </div>
              <input
                type="range"
                min={0}
                max={45}
                step={0.5}
                value={mixInSec}
                onChange={(e) => setMixInSec(Number(e.target.value))}
                aria-label="Segundo de la canción B en el que empieza la mezcla"
                className="w-full accent-[#1ed760] cursor-pointer"
              />
              <div className="flex items-center gap-1.5 flex-wrap">
                {mixInOptions.map((o) => (
                  <button
                    key={o.label}
                    type="button"
                    onClick={() => setMixInSec(o.sec)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors cursor-pointer ${
                      Math.abs(mixInSec - o.sec) < 0.3 ? 'bg-white text-black' : 'bg-white/10 text-white hover:bg-white/20'
                    }`}
                  >
                    {o.label}
                    {o.sec > 0 ? ` · ${formatDuration(Math.round(o.sec * 1000))}` : ''}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Style of the transition: four clean styles that really sound like that */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1 border-t border-white/5">
            <div className="space-y-2">
              <h5 className="text-[11px] font-semibold text-[#a7a7a7] px-1 uppercase tracking-wider">Estilo</h5>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => handleSelectStyle('auto')}
                  className="px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer bg-[#242424] hover:bg-[#2e2e2e] text-white border border-white/10"
                  title="El DJ elige según el tempo, el tono y la energía de las dos canciones"
                >
                  <span>✦</span>
                  <span>Automática</span>
                </button>
                {STYLE_CHIPS.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleSelectStyle(s.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                      currentStyle === s.id ? 'bg-white text-black shadow-md' : 'bg-[#242424] hover:bg-[#2e2e2e] text-white border border-white/5'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <h5 className="text-[11px] font-semibold text-[#a7a7a7] px-1 uppercase tracking-wider">Qué va a pasar</h5>
              <div className="bg-[#181818] p-3 rounded-xl border border-white/5 text-xs text-[#d6d6d6] leading-relaxed">
                {STYLE_TEXT[currentStyle]}
                {nativeFxStatus().available && currentStyle !== 'fade' && currentStyle !== 'linear' && (
                  <span className="block mt-1.5 text-[#1ed760]">
                    En el móvil, además, el ecualizador mueve los graves de verdad en el cambio.
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Floating feedback toast */}
        {toastMessage && (
          <div className="absolute bottom-4 left-4 right-4 bg-[#1ed760] text-black font-black text-xs py-2 px-3 rounded-xl shadow-2xl flex items-center justify-center animate-fade-in z-50">
            {toastMessage}
          </div>
        )}
      </div>
    </div>
  );
};

export { TransitionEditorModal as DJTransitionPreviewModal };
