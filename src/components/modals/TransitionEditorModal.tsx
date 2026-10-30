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
} from '../../services/djTransitionService';
import { audioEngine } from '../../services/audioEngine';

interface TransitionEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  trackA: Track;
  trackB: Track;
  onSaved?: () => void;
}

export const TransitionEditorModal: React.FC<TransitionEditorModalProps> = ({
  isOpen,
  onClose,
  trackA,
  trackB,
  onSaved,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Audio features
  const featA: AudioFeature = resolveClientSideRealFeature(
    trackA.id,
    trackA.name,
    trackA.artists?.[0]?.name
  );
  const featB: AudioFeature = resolveClientSideRealFeature(
    trackB.id,
    trackB.name,
    trackB.artists?.[0]?.name
  );

  // Transition parameters state
  const [compases, setCompases] = useState<number>(2);
  const [preset, setPreset] = useState<TransitionPreset>('automatica');
  const [volumeEnvelope, setVolumeEnvelope] = useState<VolumeEnvelope>('superposicion');
  const [eqMode, setEqMode] = useState<EQFilterMode>('intercambio_graves_central');

  // Dropdown menus
  const [isCompasesMenuOpen, setIsCompasesMenuOpen] = useState(false);
  const [isVolumeMenuOpen, setIsVolumeMenuOpen] = useState(false);
  const [isEqMenuOpen, setIsEqMenuOpen] = useState(false);

  // Audition playback state
  const [isPlayingAudition, setIsPlayingAudition] = useState(false);
  const [auditionProgress, setAuditionProgress] = useState(0.0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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
  }, [trackA?.id, trackB?.id, featA?.tempo, featB?.tempo, featA?.camelot, featB?.camelot]);

  // Clean up audition on close
  useEffect(() => {
    if (!isOpen) {
      audioEngine.stopTransitionAudition();
      djTransitionService.stopAudition();
      setIsPlayingAudition(false);
      setAuditionProgress(0);
    }
  }, [isOpen]);

  // Handle Preset selection with dynamic smart calculations for Automática
  const handleSelectPreset = (p: TransitionPreset) => {
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
      setCompases(smart.compases);
    } else if (p === 'fundido') {
      setVolumeEnvelope('lineal');
      setEqMode('sin_filtro');
      setCompases(2);
    } else if (p === 'crescendo') {
      setVolumeEnvelope('curva_s');
      setEqMode('intercambio_gradual');
      setCompases(4);
    } else if (p === 'filtro') {
      setVolumeEnvelope('superposicion');
      setEqMode('filtro_paso_bajo');
      setCompases(2);
    } else if (p === 'corte') {
      setVolumeEnvelope('corte_directo');
      setEqMode('intercambio_graves_central');
      setCompases(1);
    }
  };

  // Toggle Audition with Real Songs Audio
  const handleToggleAudition = async () => {
    if (isPlayingAudition) {
      audioEngine.stopTransitionAudition();
      djTransitionService.stopAudition();
      setIsPlayingAudition(false);
      setAuditionProgress(0);
    } else {
      setIsPlayingAudition(true);
      const config: DJTransitionConfig = {
        trackAId: trackA.id,
        trackBId: trackB.id,
        compases,
        preset,
        volumeEnvelope,
        eqMode,
        tempoA: featA.tempo,
        tempoB: featB.tempo,
        camelotA: featA.camelot,
        camelotB: featB.camelot,
      };

      // 1. Try real audio from actual songs first!
      const playedReal = await audioEngine.startTransitionAudition(
        trackA,
        trackB,
        config,
        (progress) => {
          setAuditionProgress(progress);
        },
        () => {
          setIsPlayingAudition(false);
          setAuditionProgress(0);
        }
      );

      // 2. If real audio is unavailable (e.g. offline or unresolvable), fallback to acoustic tone
      if (!playedReal) {
        djTransitionService.startAudition(
          config,
          featA.tempo,
          featB.tempo,
          (progress) => {
            setAuditionProgress(progress);
          },
          () => {
            setIsPlayingAudition(false);
            setAuditionProgress(0);
          }
        );
      }
    }
  };

  // Save Config
  const handleSave = () => {
    const config: DJTransitionConfig = {
      trackAId: trackA.id,
      trackBId: trackB.id,
      compases,
      preset,
      volumeEnvelope,
      eqMode,
      tempoA: featA.tempo,
      tempoB: featB.tempo,
      camelotA: featA.camelot,
      camelotB: featB.camelot,
    };
    djTransitionService.saveTransitionConfig(config);
    setToastMessage('✦ Transición DJ guardada correctamente');
    setTimeout(() => {
      setToastMessage(null);
      if (onSaved) onSaved();
      onClose();
    }, 900);
  };

  // Draw high-fidelity dual-deck waveform canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Deck heights & axes
    const deckHeight = height * 0.44;
    const deckAY = 6;
    const deckBY = height - deckHeight - 6;
    const centerAY = deckAY + deckHeight / 2;
    const centerBY = deckBY + deckHeight / 2;

    // Transition Window coordinates
    // Outgoing transition occurs at the right half of Deck A
    // Incoming transition occurs at the left half of Deck B
    const boxWidth = Math.min(width * 0.72, width * (0.35 + (compases / 16) * 0.45));
    const boxStartA = width - boxWidth - 12;
    const boxEndA = width - 12;
    const boxStartB = 12;
    const boxEndB = 12 + boxWidth;

    // Helper: generate seeded pseudo-random waveform bars based on track string
    const generateWaveform = (seedStr: string, count: number, tempo: number) => {
      let hash = 0;
      for (let i = 0; i < seedStr.length; i++) {
        hash = (hash << 5) - hash + seedStr.charCodeAt(i);
        hash |= 0;
      }
      const bars: Array<{ amp: number; peak: number }> = [];
      const beatInterval = Math.max(3, Math.round(120 / (tempo || 120)));

      for (let i = 0; i < count; i++) {
        const beatBoost = i % beatInterval === 0 ? 1.4 : 1.0;
        const pseudo = Math.abs(Math.sin((hash + i * 17) * 0.23));
        const amp = Math.min(1.0, (0.25 + pseudo * 0.6) * beatBoost);
        const peak = Math.min(1.0, amp * (1.1 + Math.abs(Math.cos(i * 0.3)) * 0.25));
        bars.push({ amp, peak });
      }
      return bars;
    };

    const numBars = 110;
    const barsA = generateWaveform(trackA.id + trackA.name, numBars, featA.tempo);
    const barsB = generateWaveform(trackB.id + trackB.name, numBars, featB.tempo);

    const barWidth = width / numBars;

    // Draw Deck Waveform Function
    const drawDeckWaveform = (
      bars: Array<{ amp: number; peak: number }>,
      centerY: number,
      h: number,
      dimmed = false
    ) => {
      const halfH = h * 0.46;

      for (let i = 0; i < bars.length; i++) {
        const x = i * barWidth;
        const { amp, peak } = bars[i];
        const barH = amp * halfH;
        const peakH = peak * halfH;

        // 1. Layer 1: Body (Amber/Bronze Base Envelope)
        ctx.fillStyle = dimmed ? '#5a3d1d' : '#ab7232';
        ctx.fillRect(x, centerY - barH, barWidth * 0.85, barH * 2);

        // 2. Layer 2: Electric Blue Peak Envelope
        ctx.fillStyle = dimmed ? '#1e3a66' : '#2979ff';
        const diffH = Math.max(1, peakH - barH);
        ctx.fillRect(x, centerY - peakH, barWidth * 0.85, diffH);
        ctx.fillRect(x, centerY + barH, barWidth * 0.85, diffH);

        // 3. Layer 3: White/Cream Core Transient Spine
        ctx.fillStyle = dimmed ? '#999999' : '#fff8e7';
        ctx.fillRect(x, centerY - barH * 0.25, barWidth * 0.85, barH * 0.5);
      }
    };

    // Draw Deck A Waveform
    drawDeckWaveform(barsA, centerAY, deckHeight);

    // Draw Deck B Waveform
    drawDeckWaveform(barsB, centerBY, deckHeight);

    // --- Draw Cyan Transition Framing Boxes ---
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#00e5ff';

    // Deck A Cyan Box (Right aligned outro)
    ctx.fillStyle = 'rgba(0, 229, 255, 0.05)';
    ctx.fillRect(boxStartA, deckAY, boxWidth, deckHeight);
    ctx.beginPath();
    ctx.moveTo(boxStartA, deckAY);
    ctx.lineTo(boxEndA, deckAY);
    ctx.lineTo(boxEndA, deckAY + deckHeight);
    ctx.lineTo(boxStartA, deckAY + deckHeight);
    ctx.stroke();

    // Deck B Cyan Box (Left aligned intro)
    ctx.fillStyle = 'rgba(0, 229, 255, 0.05)';
    ctx.fillRect(boxStartB, deckBY, boxWidth, deckHeight);
    ctx.beginPath();
    ctx.moveTo(boxEndB, deckBY);
    ctx.lineTo(boxStartB, deckBY);
    ctx.lineTo(boxStartB, deckBY + deckHeight);
    ctx.lineTo(boxEndB, deckBY + deckHeight);
    ctx.stroke();

    // --- Draw Pink Volume Curves ---
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#f472b6'; // Vibrant Pink
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Deck A Pink Curve: Flat at 100% until transition midpoint/ramp down to 0% at boxEnd
    ctx.beginPath();
    ctx.moveTo(0, deckAY + deckHeight * 0.15);
    const midA = boxStartA + boxWidth * 0.5;
    if (volumeEnvelope === 'superposicion' || preset === 'automatica') {
      ctx.lineTo(midA, deckAY + deckHeight * 0.15);
      ctx.lineTo(boxEndA, deckAY + deckHeight * 0.85);
    } else if (volumeEnvelope === 'corte_directo' || preset === 'corte') {
      ctx.lineTo(midA, deckAY + deckHeight * 0.15);
      ctx.lineTo(midA, deckAY + deckHeight * 0.85);
      ctx.lineTo(boxEndA, deckAY + deckHeight * 0.85);
    } else {
      ctx.lineTo(boxStartA, deckAY + deckHeight * 0.15);
      ctx.lineTo(boxEndA, deckAY + deckHeight * 0.85);
    }
    ctx.stroke();

    // Deck B Pink Curve: Ramps up from 0% at boxStart to 100% at boxEnd
    ctx.beginPath();
    ctx.moveTo(boxStartB, deckBY + deckHeight * 0.85);
    const midB = boxStartB + boxWidth * 0.5;
    if (volumeEnvelope === 'superposicion' || preset === 'automatica') {
      ctx.lineTo(midB, deckBY + deckHeight * 0.15);
      ctx.lineTo(boxEndB, deckBY + deckHeight * 0.15);
    } else if (volumeEnvelope === 'corte_directo' || preset === 'corte') {
      ctx.lineTo(midB, deckBY + deckHeight * 0.85);
      ctx.lineTo(midB, deckBY + deckHeight * 0.15);
      ctx.lineTo(boxEndB, deckBY + deckHeight * 0.15);
    } else {
      ctx.lineTo(boxEndB, deckBY + deckHeight * 0.15);
    }
    ctx.lineTo(width, deckBY + deckHeight * 0.15);
    ctx.stroke();

    // --- Draw Yellow EQ Bass-Swap Curves ---
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#facc15'; // Pure Yellow

    // Deck A Yellow Curve: 100% bass, at crossover midpoint drops sharply to 0!
    ctx.beginPath();
    ctx.moveTo(0, deckAY + deckHeight * 0.25);
    ctx.lineTo(midA, deckAY + deckHeight * 0.25);
    ctx.lineTo(midA + 4, deckAY + deckHeight * 0.85);
    ctx.lineTo(boxEndA, deckAY + deckHeight * 0.85);
    ctx.stroke();

    // Deck B Yellow Curve: 0% bass during first half, then steps up sharply to 100% at crossover!
    ctx.beginPath();
    ctx.moveTo(boxStartB, deckBY + deckHeight * 0.85);
    ctx.lineTo(midB, deckBY + deckHeight * 0.85);
    ctx.lineTo(midB + 4, deckBY + deckHeight * 0.25);
    ctx.lineTo(width, deckBY + deckHeight * 0.25);
    ctx.stroke();

    // --- Draw Green Scrub Playhead ---
    // If playing, position moves from left to right; if stopped, stays at scrub point
    const playheadX = auditionProgress > 0 ? auditionProgress * width : 16;
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#1ed760';
    ctx.shadowColor = '#1ed760';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, height);
    ctx.stroke();
    ctx.shadowBlur = 0; // reset
  }, [
    trackA.id,
    trackB.id,
    featA.tempo,
    featB.tempo,
    compases,
    preset,
    volumeEnvelope,
    eqMode,
    auditionProgress,
  ]);

  // Scrub click handler on canvas
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const progress = Math.max(0, Math.min(1, clickX / rect.width));
    setAuditionProgress(progress);
  };

  if (!isOpen) return null;

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
          <div className="relative rounded-2xl bg-[#181818] border border-white/5 p-2 shadow-inner overflow-hidden select-none">
            <canvas
              ref={canvasRef}
              width={640}
              height={165}
              onClick={handleCanvasClick}
              className="w-full h-[165px] rounded-xl cursor-pointer block"
            />

            {/* Center Floating Audition Button (▶ / ■) */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <button
                onClick={handleToggleAudition}
                className="pointer-events-auto w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-black/75 hover:bg-black/90 active:scale-95 border border-white/20 backdrop-blur-md flex items-center justify-center shadow-2xl transition-all cursor-pointer z-30 group"
                title={isPlayingAudition ? 'Detener preescucha' : 'Escuchar transición DJ'}
              >
                {isPlayingAudition ? (
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
