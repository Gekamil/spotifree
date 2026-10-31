import React, { useState, useEffect, useRef } from 'react';
import type { Track } from '../../types/spotify';
import {
  type AudioFeature,
  resolveClientSideRealFeature,
} from '../../utils/audioFeatures';
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
  compases: number
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
  const X_crossover = W_leadIn + 0.5 * W_mix;

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

  // Dropdown menus
  const [isCompasesMenuOpen, setIsCompasesMenuOpen] = useState(false);
  const [isVolumeMenuOpen, setIsVolumeMenuOpen] = useState(false);
  const [isEqMenuOpen, setIsEqMenuOpen] = useState(false);
  const [isFxMenuOpen, setIsFxMenuOpen] = useState(false);

  // Audition playback state
  const [isAuditionLoading, setIsAuditionLoading] = useState(false);
  const [isPlayingAudition, setIsPlayingAudition] = useState(false);
  const [auditionProgress, setAuditionProgress] = useState(0.0);
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

  // Load saved config on mount or track change, calculating tailored smart parameters
  useEffect(() => {
    if (!trackA?.id || !trackB?.id) return;
    const config = djTransitionService.getTransitionConfig(
      trackA.id,
      trackB.id,
      featA?.tempo,
      featB?.tempo,
      featA?.camelot,
      featB?.camelot
    );
    setCompases(config.compases || 2);
    setPreset(config.preset || 'automatica');
    setVolumeEnvelope(config.volumeEnvelope || 'superposicion');
    setEqMode(config.eqMode || 'intercambio_graves_central');
    setFxMode(config.fxMode || 'ninguno');
  }, [trackA?.id, trackB?.id, featA?.tempo, featB?.tempo, featA?.camelot, featB?.camelot]);

  // Clean up audition on close
  useEffect(() => {
    if (!isOpen) {
      audioEngine.stopTransitionAudition();
      djTransitionService.stopAudition();
      setIsPlayingAudition(false);
      setIsAuditionLoading(false);
      setAuditionProgress(0);
    }
    return () => {
      audioEngine.stopTransitionAudition();
      djTransitionService.stopAudition();
    }
  }, [isOpen]);

  // Handle Preset selection with dynamic smart calculations for Automática
  const handleSelectPreset = (p: TransitionPreset) => {
    if (!trackA || !trackB) return;
    setPreset(p);
    if (p === 'automatica') {
      const smart = djTransitionService.calculateSmartTransition(
        trackA.id,
        trackB.id,
        featA?.tempo,
        featB?.tempo,
        featA?.camelot,
        featB?.camelot
      );
      setVolumeEnvelope(smart.volumeEnvelope);
      setEqMode(smart.eqMode);
      setFxMode(smart.fxMode || 'ninguno');
      setCompases(smart.compases);
    } else if (p === 'fundido') {
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

        if (!playedReal) {
          setIsAuditionLoading(false);
          setIsPlayingAudition(false);
          setToastMessage('No se pudo precargar el audio para la preescucha.');
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
    const coords = computeTimelineCoordinates(width, height, featA.tempo, compases);
    const {
      W_leadIn,
      W_mix,
      W_leadOut,
      X_mixStart,
      X_mixEnd,
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
    ctx.fillText('◆ CRUCE', X_crossover, 12);

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

        // 1. Deck A Volume Envelope
        if (volumeEnvelope === 'superposicion' || preset === 'automatica' || preset === 'mezcla_voces') {
          volA = pMix <= 0.5 ? 1.0 : Math.cos((pMix - 0.5) * Math.PI);
        } else if (volumeEnvelope === 'corte_directo' || preset === 'corte') {
          volA = pMix < 0.4 ? 1.0 : pMix < 0.6 ? Math.cos(((pMix - 0.4) / 0.2) * 0.5 * Math.PI) : Math.max(0, (1 - pMix) * 0.25);
        } else if (preset === 'crescendo') {
          volA = Math.cos(pMix * 0.5 * Math.PI);
        } else if (volumeEnvelope === 'curva_s' || preset === 'eco_out' || preset === 'beat_roll' || preset === 'repeticion_ritmo') {
          volA = 0.5 * (1.0 + Math.cos(pMix * Math.PI));
        } else {
          volA = Math.max(0, 1.0 - pMix);
        }

        // 2. Deck B Volume Envelope
        if (volumeEnvelope === 'superposicion' || preset === 'automatica' || preset === 'mezcla_voces') {
          volB = pMix;
        } else if (volumeEnvelope === 'corte_directo' || preset === 'corte') {
          volB = pMix < 0.4 ? (pMix / 0.4) * 0.4 : pMix < 0.6 ? Math.sin((0.4 + ((pMix - 0.4) / 0.2) * 0.6) * 0.5 * Math.PI) : 1.0;
        } else if (preset === 'crescendo') {
          volB = Math.pow(pMix, 1.8);
        } else if (volumeEnvelope === 'curva_s' || preset === 'eco_out' || preset === 'beat_roll' || preset === 'repeticion_ritmo') {
          volB = 0.5 * (1.0 - Math.cos(pMix * Math.PI));
        } else {
          volB = Math.min(1, pMix);
        }

        // 3. Bass Swap Modulation
        if (eqMode === 'intercambio_graves_central' || ['automatica', 'corte'].includes(preset)) {
          bassA = pMix < 0.50 ? 1.0 : 0.08;
          bassB = pMix < 0.50 ? 0.05 : 1.0;
        } else if (eqMode === 'intercambio_gradual') {
          bassA = 1.0 - pMix;
          bassB = pMix;
        } else if (eqMode === 'filtro_paso_alto') {
          bassA = Math.max(0.08, 1.0 - pMix * 2.0);
          bassB = Math.min(1.0, pMix * 2.0);
        }

        // 4. Filter / FX Modulation
        if (preset === 'filtro' || eqMode === 'filtro_paso_bajo') {
          highsA = Math.pow(Math.max(0, 1 - pMix), 1.8);
          midsA = Math.pow(Math.max(0, 1 - pMix), 1.2);
        }
        if (fxMode === 'repeticion_loop' || preset === 'beat_roll') {
          const stutterTick = Math.floor(pMix * 24);
          if (stutterTick % 2 === 1 && pMix > 0.35) {
            volA *= 0.25;
          }
        }
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

    // Bass EQ Step Lines in Hub
    if (eqMode === 'intercambio_graves_central' || preset === 'automatica' || preset === 'corte') {
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.75)';
      ctx.lineWidth = 1.5;
      // Deck A step: High -> Low
      ctx.beginPath();
      ctx.moveTo(X_mixStart, Y_1 + 3);
      ctx.lineTo(X_crossover, Y_1 + 3);
      ctx.lineTo(X_crossover, Y_0 - 3);
      ctx.lineTo(X_mixEnd, Y_0 - 3);
      ctx.stroke();

      // Deck B step: Low -> High
      ctx.beginPath();
      ctx.moveTo(X_mixStart, Y_0 - 3);
      ctx.lineTo(X_crossover, Y_0 - 3);
      ctx.lineTo(X_crossover, Y_1 + 3);
      ctx.lineTo(X_mixEnd, Y_1 + 3);
      ctx.stroke();
    }

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

    // Mix window
    const curveSteps = 32;
    for (let s = 0; s <= curveSteps; s++) {
      const p = s / curveSteps;
      const cx = X_mixStart + p * W_mix;
      let valA = 1.0;
      if (volumeEnvelope === 'superposicion' || preset === 'automatica' || preset === 'mezcla_voces') {
        valA = p <= 0.5 ? 1.0 : Math.cos((p - 0.5) * Math.PI);
      } else if (volumeEnvelope === 'corte_directo' || preset === 'corte') {
        valA = p < 0.4 ? 1.0 : p < 0.6 ? Math.cos(((p - 0.4) / 0.2) * 0.5 * Math.PI) : Math.max(0, (1 - p) * 0.25);
      } else if (preset === 'crescendo') {
        valA = Math.cos(p * 0.5 * Math.PI);
      } else if (volumeEnvelope === 'curva_s' || preset === 'eco_out' || preset === 'beat_roll' || preset === 'repeticion_ritmo') {
        valA = 0.5 * (1.0 + Math.cos(p * Math.PI));
      } else {
        valA = Math.max(0, 1.0 - p);
      }
      ctx.lineTo(cx, yFromLevel(valA));
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
      const cx = X_mixStart + p * W_mix;
      let valB = 0.0;
      if (volumeEnvelope === 'superposicion' || preset === 'automatica' || preset === 'mezcla_voces') {
        valB = p;
      } else if (volumeEnvelope === 'corte_directo' || preset === 'corte') {
        valB = p < 0.4 ? (p / 0.4) * 0.4 : p < 0.6 ? Math.sin((0.4 + ((p - 0.4) / 0.2) * 0.6) * 0.5 * Math.PI) : 1.0;
      } else if (preset === 'crescendo') {
        valB = Math.pow(p, 1.8);
      } else if (volumeEnvelope === 'curva_s' || preset === 'eco_out' || preset === 'beat_roll' || preset === 'repeticion_ritmo') {
        valB = 0.5 * (1.0 - Math.cos(p * Math.PI));
      } else {
        valB = Math.min(1, p);
      }
      ctx.lineTo(cx, yFromLevel(valB));
    }

    // Lead-out: full groove (100%)
    ctx.lineTo(width, Y_1);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Filter Sweep / FX Overlays (Purple #c084fc)
    if (fxMode !== 'ninguno' || ['filtro', 'eco_out', 'freno_vinilo', 'beat_roll', 'distorsion_wash', 'repeticion_ritmo'].includes(preset)) {
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 2.0;
      ctx.beginPath();

      if (preset === 'freno_vinilo' || fxMode === 'freno_vinilo') {
        ctx.moveTo(X_mixStart, Y_1);
        ctx.lineTo(X_crossover, Y_1);
        ctx.quadraticCurveTo(X_crossover + W_mix * 0.25, Y_0 - 4, X_mixEnd - 4, Y_0);
        ctx.lineTo(X_mixEnd, Y_0);
      } else if (preset === 'beat_roll' || preset === 'repeticion_ritmo' || fxMode === 'repeticion_loop' || fxMode === 'distorsion_wash') {
        ctx.moveTo(X_mixStart, HUB_Y_MID);
        const stutterStart = X_mixStart + W_mix * 0.25;
        ctx.lineTo(stutterStart, HUB_Y_MID);
        for (let sx = stutterStart; sx < X_mixEnd - 6; sx += (X_mixEnd - stutterStart) / 10) {
          ctx.lineTo(sx, Y_1 + 4);
          ctx.lineTo(sx + 4, Y_0 - 4);
        }
        ctx.lineTo(X_mixEnd, Y_0);
      } else {
        ctx.moveTo(X_mixStart, Y_1 + 4);
        ctx.bezierCurveTo(X_crossover, Y_1 + 4, X_crossover + W_mix * 0.2, Y_0 - 2, X_mixEnd, Y_0);
      }
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
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in font-['SpotifyMixUI']">
      <div className="w-full max-w-md md:max-w-2xl lg:max-w-3xl bg-[#121212] rounded-t-3xl sm:rounded-2xl border border-white/10 shadow-2xl flex flex-col overflow-hidden max-h-[96vh] md:max-h-[88vh]">
        {/* Top Header Row matching Spotify Screenshot */}
        <div className="px-4 py-2.5 sm:px-5 flex items-center justify-between border-b border-white/5">
          {/* Close button (✕) */}
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Cerrar"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
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

        {/* Content Body */}
        <div className="p-3.5 sm:p-5 overflow-y-auto md:overflow-y-visible space-y-2.5 sm:space-y-3 flex-1">
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
                <span className="text-xs text-[#facc15] font-semibold">Cruce de Bombo/Bajo</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm bg-[#c084fc]" />
                <span className="text-xs text-[#c084fc] font-semibold">Filtro / FX</span>
              </div>
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
                  {preset === 'mezcla_voces'
                    ? '✦ Fusión Vocal Armónica'
                    : preset === 'repeticion_ritmo'
                    ? '✦ Ritmo & Distorsión Progresiva'
                    : preset === 'automatica'
                    ? '✦ Mezcla Adaptativa Inteligente'
                    : preset === 'filtro'
                    ? '✦ Filtro Resonante Pasa-Altos'
                    : preset === 'eco_out'
                    ? '✦ Eco Espacial y Filtro'
                    : preset === 'freno_vinilo'
                    ? '✦ Freno de Tornamesa Analógico'
                    : preset === 'beat_roll'
                    ? '✦ Beat Roll Rítmico'
                    : preset === 'crescendo'
                    ? '✦ Crescendo Exponencial'
                    : preset === 'corte'
                    ? '✦ Drop de Impacto'
                    : '✦ Fundido Dinámico'}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/10 text-[#b3b3b3]">
                  {compases} {compases === 1 ? 'compás' : 'compases'} ({((compases * 4 * 60) / (featA.tempo || 128)).toFixed(1)}s)
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-[#a7a7a7]">
                <span>Tempo: <strong className="text-white">{featA.tempo}</strong> → <strong className="text-white">{featB.tempo} BPM</strong></span>
                <span>•</span>
                <span>Clave: <strong className="text-white">{featA.camelot}</strong> → <strong className="text-white">{featB.camelot}</strong></span>
              </div>
            </div>
            <p className="text-xs text-[#b3b3b3] leading-relaxed">
              {preset === 'mezcla_voces'
                ? 'Aísla las frecuencias vocales suprimiendo el bajo en ambas pistas (-36dB) para entrelazar las voces con nitidez total. Al llegar al compás central, el bombo de la pista entrante toma el control sin choques ni silencios.'
                : preset === 'repeticion_ritmo'
                ? 'Repite el compás de la base rítmica acelerando en 1/4 y 1/8 con saturación armónica y barrido de frecuencias, adaptando progresivamente el pulso hasta encajar perfectamente en el drop de la nueva pista.'
                : preset === 'automatica'
                ? 'Analiza el tempo y la clave armónica para un intercambio quirúrgico de graves en el punto central, manteniendo la energía y eliminando silencios o choques de sonido.'
                : preset === 'eco_out'
                ? 'Aplica un retardo espacial sincronizado al compás con filtro pasa-bajos, disolviendo suavemente la pista saliente en una nube de reverberación.'
                : preset === 'freno_vinilo'
                ? 'Decelera la rotación del plato como en una tornamesa de vinilo analógica mientras la pista entrante entra gradualmente sin silencios bruscos.'
                : preset === 'beat_roll'
                ? 'Crea un redoble rítmico acelerado sobre el tiempo antes del drop para construir tensión en la transición.'
                : preset === 'crescendo'
                ? 'Incrementa progresivamente la energía y frecuencias agudas antes de lanzar la nueva pista con máxima potencia.'
                : preset === 'filtro'
                ? 'Barrido resonante de frecuencias para disolver disonancias antes de dar paso limpio a la siguiente pista.'
                : preset === 'corte'
                ? 'Cruce enérgico con rampa rápida anti-clic para pasar directamente a la pegada del bombo de la nueva pista sin pausas.'
                : 'Cruce suave de volumen para conectar ambas canciones de forma balanceada.'}
            </p>
          </div>

          {/* Lower Controls: Responsive side-by-side on desktop */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1 border-t border-white/5">
            {/* Left: Ajustes predefinidos */}
            <div className="space-y-2">
              <h5 className="text-[11px] font-semibold text-[#a7a7a7] px-1 uppercase tracking-wider">
                Ajustes predefinidos
              </h5>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar flex-wrap">
                {/* ✦ Automática */}
                <button
                  onClick={() => handleSelectPreset('automatica')}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                    preset === 'automatica'
                      ? 'bg-white text-black shadow-md'
                      : 'bg-[#242424] hover:bg-[#2e2e2e] text-white border border-white/5'
                  }`}
                >
                  <span>✦</span>
                  <span>Automática</span>
                </button>

                {/* ✦ Fusión Vocal */}
                <button
                  onClick={() => handleSelectPreset('mezcla_voces')}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                    preset === 'mezcla_voces'
                      ? 'bg-white text-black shadow-md'
                      : 'bg-[#242424] hover:bg-[#2e2e2e] text-white border border-white/5'
                  }`}
                >
                  <span>✦</span>
                  <span>Fusión Vocal</span>
                </button>

                {/* ✦ Ritmo & Distorsión */}
                <button
                  onClick={() => handleSelectPreset('repeticion_ritmo')}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                    preset === 'repeticion_ritmo'
                      ? 'bg-white text-black shadow-md'
                      : 'bg-[#242424] hover:bg-[#2e2e2e] text-white border border-white/5'
                  }`}
                >
                  <span>✦</span>
                  <span>Ritmo & Distorsión</span>
                </button>

                {/* Fundido */}
                <button
                  onClick={() => handleSelectPreset('fundido')}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    preset === 'fundido'
                      ? 'bg-white text-black shadow-md'
                      : 'bg-[#242424] hover:bg-[#2e2e2e] text-white border border-white/5'
                  }`}
                >
                  Fundido
                </button>

                {/* Crescendo */}
                <button
                  onClick={() => handleSelectPreset('crescendo')}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    preset === 'crescendo'
                      ? 'bg-white text-black shadow-md'
                      : 'bg-[#242424] hover:bg-[#2e2e2e] text-white border border-white/5'
                  }`}
                >
                  Crescendo
                </button>

                {/* Filtro */}
                <button
                  onClick={() => handleSelectPreset('filtro')}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    preset === 'filtro'
                      ? 'bg-white text-black shadow-md'
                      : 'bg-[#242424] hover:bg-[#2e2e2e] text-white border border-white/5'
                  }`}
                >
                  Filtro
                </button>

                {/* Corte */}
                <button
                  onClick={() => handleSelectPreset('corte')}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    preset === 'corte'
                      ? 'bg-white text-black shadow-md'
                      : 'bg-[#242424] hover:bg-[#2e2e2e] text-white border border-white/5'
                  }`}
                >
                  Corte
                </button>

                {/* Eco Out */}
                <button
                  onClick={() => handleSelectPreset('eco_out')}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    preset === 'eco_out'
                      ? 'bg-white text-black shadow-md'
                      : 'bg-[#242424] hover:bg-[#2e2e2e] text-white border border-white/5'
                  }`}
                >
                  Eco Out
                </button>

                {/* Freno Vinilo */}
                <button
                  onClick={() => handleSelectPreset('freno_vinilo')}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    preset === 'freno_vinilo'
                      ? 'bg-white text-black shadow-md'
                      : 'bg-[#242424] hover:bg-[#2e2e2e] text-white border border-white/5'
                  }`}
                >
                  Freno Vinilo
                </button>

                {/* Beat Roll */}
                <button
                  onClick={() => handleSelectPreset('beat_roll')}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    preset === 'beat_roll'
                      ? 'bg-white text-black shadow-md'
                      : 'bg-[#242424] hover:bg-[#2e2e2e] text-white border border-white/5'
                  }`}
                >
                  Beat Roll
                </button>

                {/* Saturación */}
                <button
                  onClick={() => handleSelectPreset('distorsion_wash')}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    preset === 'distorsion_wash'
                      ? 'bg-white text-black shadow-md'
                      : 'bg-[#242424] hover:bg-[#2e2e2e] text-white border border-white/5'
                  }`}
                >
                  Saturación
                </button>
              </div>
            </div>

            {/* Right: Detailed Parameter Rows (Volumen & EQ) */}
            <div className="space-y-2">
              <h5 className="text-[11px] font-semibold text-[#a7a7a7] px-1 uppercase tracking-wider">
                Parámetros de mezcla
              </h5>

              <div className="bg-[#181818] p-2 sm:p-2.5 rounded-xl space-y-2 border border-white/5">
                {/* Row 1: | Volumen */}
                <div className="flex items-center justify-between relative">
                  <div className="flex items-center gap-2">
                    <span className="w-1 h-3.5 bg-[#38bdf8] rounded-full inline-block" />
                    <span className="text-xs font-semibold text-white">Volumen</span>
                  </div>

                  <div className="relative">
                    <button
                      onClick={() => setIsVolumeMenuOpen(!isVolumeMenuOpen)}
                      className="text-xs font-medium text-[#b3b3b3] hover:text-white flex items-center gap-1.5 py-1 px-2 rounded-md hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <span className="capitalize">
                        {volumeEnvelope === 'superposicion'
                          ? 'Superposición'
                          : volumeEnvelope === 'lineal'
                          ? 'Fundido lineal'
                          : volumeEnvelope === 'curva_s'
                          ? 'Curva en S'
                          : 'Corte directo'}
                      </span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>

                    {isVolumeMenuOpen && (
                      <div className="absolute right-0 bottom-full mb-1 bg-[#282828] border border-white/10 rounded-xl py-1 w-44 shadow-2xl z-40">
                        {[
                          { id: 'superposicion', label: 'Superposición' },
                          { id: 'lineal', label: 'Fundido lineal' },
                          { id: 'curva_s', label: 'Curva en S' },
                          { id: 'corte_directo', label: 'Corte directo' },
                        ].map((opt) => (
                          <button
                            key={opt.id}
                            onClick={() => {
                              setVolumeEnvelope(opt.id as VolumeEnvelope);
                              setIsVolumeMenuOpen(false);
                            }}
                            className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                              volumeEnvelope === opt.id ? 'text-[#1ed760] font-bold bg-white/5' : 'text-white hover:bg-white/10'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Row 2: | EQ */}
                <div className="flex items-center justify-between relative">
                  <div className="flex items-center gap-2">
                    <span className="w-1 h-3.5 bg-[#facc15] rounded-full inline-block" />
                    <span className="text-xs font-semibold text-white">EQ</span>
                  </div>

                  <div className="relative">
                    <button
                      onClick={() => setIsEqMenuOpen(!isEqMenuOpen)}
                      className="text-xs font-medium text-[#b3b3b3] hover:text-white flex items-center gap-1.5 py-1 px-2 rounded-md hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <span>
                        {eqMode === 'intercambio_graves_central'
                          ? 'Intercambio de graves central'
                          : eqMode === 'intercambio_gradual'
                          ? 'Intercambio gradual'
                          : eqMode === 'filtro_paso_bajo'
                          ? 'Filtro paso bajo'
                          : 'Sin filtro EQ'}
                      </span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>

                    {isEqMenuOpen && (
                      <div className="absolute right-0 bottom-full mb-1 bg-[#282828] border border-white/10 rounded-xl py-1 w-52 shadow-2xl z-40">
                        {[
                          { id: 'intercambio_graves_central', label: 'Intercambio de graves central' },
                          { id: 'intercambio_gradual', label: 'Intercambio gradual' },
                          { id: 'filtro_paso_bajo', label: 'Filtro paso bajo' },
                          { id: 'sin_filtro', label: 'Sin filtro EQ' },
                        ].map((opt) => (
                          <button
                            key={opt.id}
                            onClick={() => {
                              setEqMode(opt.id as EQFilterMode);
                              setIsEqMenuOpen(false);
                            }}
                            className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                              eqMode === opt.id ? 'text-[#1ed760] font-bold bg-white/5' : 'text-white hover:bg-white/10'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Row 3: | FX */}
                <div className="flex items-center justify-between relative">
                  <div className="flex items-center gap-2">
                    <span className="w-1 h-3.5 bg-[#a855f7] rounded-full inline-block" />
                    <span className="text-xs font-semibold text-white">Efectos FX</span>
                  </div>

                  <div className="relative">
                    <button
                      onClick={() => setIsFxMenuOpen(!isFxMenuOpen)}
                      className="text-xs font-medium text-[#b3b3b3] hover:text-white flex items-center gap-1.5 py-1 px-2 rounded-md hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <span>
                        {fxMode === 'ninguno'
                          ? 'Sin efectos FX'
                          : fxMode === 'eco'
                          ? 'Eco / Delay Out'
                          : fxMode === 'freno_vinilo'
                          ? 'Freno de vinilo'
                          : fxMode === 'repeticion_loop'
                          ? 'Loop Roll / Stutter'
                          : 'Saturación & Wash'}
                      </span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>

                    {isFxMenuOpen && (
                      <div className="absolute right-0 bottom-full mb-1 bg-[#282828] border border-white/10 rounded-xl py-1 w-52 shadow-2xl z-40">
                        {[
                          { id: 'ninguno', label: 'Sin efectos FX' },
                          { id: 'eco', label: 'Eco / Delay Out' },
                          { id: 'freno_vinilo', label: 'Freno de vinilo' },
                          { id: 'repeticion_loop', label: 'Loop Roll / Stutter' },
                          { id: 'distorsion_wash', label: 'Saturación & Wash' },
                        ].map((opt) => (
                          <button
                            key={opt.id}
                            onClick={() => {
                              setFxMode(opt.id as DJFXMode);
                              setIsFxMenuOpen(false);
                            }}
                            className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                              fxMode === opt.id ? 'text-[#1ed760] font-bold bg-white/5' : 'text-white hover:bg-white/10'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
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
