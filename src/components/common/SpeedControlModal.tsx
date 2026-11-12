import React, { useEffect, useState } from 'react';
import { SPEED_SHEET_EVENT, useLabsStore } from '../../services/labsService';

const SPEED_PRESETS = [
  { val: 0.75, label: '0.75x' },
  { val: 0.8, label: '0.8x (Slowed)' },
  { val: 0.9, label: '0.9x' },
  { val: 1.0, label: '1.0x' },
  { val: 1.25, label: '1.25x' },
  { val: 1.5, label: '1.5x (Nightcore)' },
  { val: 2.0, label: '2.0x' },
];

export const SpeedControlModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const {
    playbackSpeed,
    preservesPitch,
    setPlaybackSpeed,
    setPreservesPitch,
    resetPlaybackSpeed,
  } = useLabsStore();

  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener(SPEED_SHEET_EVENT, handleOpen);
    return () => window.removeEventListener(SPEED_SHEET_EVENT, handleOpen);
  }, []);

  if (!isOpen) return null;

  const getSpeedLabel = (rate: number) => {
    if (rate <= 0.85) return 'Slowed';
    if (rate >= 1.35) return 'Nightcore / Sped Up';
    if (rate === 1.0) return 'Normal';
    if (rate < 1.0) return 'Relajado';
    return 'Acelerado';
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center select-none font-['SpotifyMixUI']">
      {/* Backdrop */}
      <div
        onClick={() => setIsOpen(false)}
        className="fixed inset-0 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
      />

      {/* Sheet / Dialog */}
      <div className="relative z-10 w-full sm:max-w-md bg-[#242424] rounded-t-[28px] sm:rounded-2xl p-6 space-y-5 border border-white/10 shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#1ed760]/15 text-[#1ed760] flex items-center justify-center font-black text-xs">
              {playbackSpeed.toFixed(2)}x
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-['SpotifyMixUITitle']">
                Velocidad de reproducción
              </h3>
              <p className="text-xs text-[#a7a7a7]">
                Ajuste fino de ritmo y tono en tiempo real
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="w-8 h-8 rounded-full hover:bg-white/10 active:scale-90 flex items-center justify-center text-[#b3b3b3] hover:text-white transition-all cursor-pointer"
            aria-label="Cerrar"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Live Indicator */}
        <div className="text-center py-1">
          <span className="text-3xl font-black text-[#1ed760] tracking-tight tabular-nums font-mono">
            {playbackSpeed.toFixed(2)}x
          </span>
          <p className="text-xs font-semibold text-[#b3b3b3] mt-0.5">
            {getSpeedLabel(playbackSpeed)}
          </p>
        </div>

        {/* Continuous Slider */}
        <div className="space-y-2 px-1">
          <input
            type="range"
            min="0.5"
            max="2.0"
            step="0.05"
            value={playbackSpeed}
            onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
            style={{
              background: `linear-gradient(to right, #1ed760 ${((playbackSpeed - 0.5) / 1.5) * 100}%, rgba(255, 255, 255, 0.2) ${((playbackSpeed - 0.5) / 1.5) * 100}%)`,
            }}
            className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-[#1ed760] touch-none"
          />
          <div className="flex justify-between text-[11px] font-bold text-[#727272]">
            <span>0.50x</span>
            <span>1.00x</span>
            <span>2.00x</span>
          </div>
        </div>

        {/* Preset Chips */}
        <div className="flex items-center gap-1.5 flex-wrap pt-1">
          {SPEED_PRESETS.map((p) => {
            const isMatch = Math.abs(playbackSpeed - p.val) < 0.02;
            return (
              <button
                key={p.val}
                type="button"
                onClick={() => setPlaybackSpeed(p.val)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  isMatch
                    ? 'bg-[#1ed760] text-black shadow-md scale-102'
                    : 'bg-white/5 hover:bg-white/10 text-white/80 hover:text-white'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* Pitch Preservation Toggle */}
        <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-white">Conservar tono original</p>
            <p className="text-xs text-[#a7a7a7] leading-tight mt-0.5">
              {preservesPitch
                ? 'El tono de voz se mantiene igual aunque aceleres o ralentices.'
                : 'El tono varía con la velocidad (más grave en slowed, más agudo en nightcore).'}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={preservesPitch}
            onClick={() => setPreservesPitch(!preservesPitch)}
            className={`w-11 h-6 rounded-full relative transition-colors shrink-0 cursor-pointer ${
              preservesPitch ? 'bg-[#1ed760]' : 'bg-[#535353]'
            }`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${
                preservesPitch ? 'left-[22px]' : 'left-0.5'
              }`}
            />
          </button>
        </div>

        {/* Reset button */}
        {playbackSpeed !== 1.0 && (
          <button
            type="button"
            onClick={resetPlaybackSpeed}
            className="w-full py-2.5 rounded-full border border-white/20 hover:border-white text-xs font-bold text-white hover:bg-white/5 active:scale-95 transition-all cursor-pointer"
          >
            Restablecer a 1.00x normal
          </button>
        )}
      </div>
    </div>
  );
};
