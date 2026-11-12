import React, { useEffect, useState } from 'react';
import { SPEED_SHEET_EVENT, useLabsStore } from '../../services/labsService';

const SPEED_PRESETS = [
  { val: 0.8, label: '0.8x (Slowed)' },
  { val: 1.0, label: '1.0x' },
  { val: 1.25, label: '1.25x' },
  { val: 1.5, label: '1.5x (Nightcore)' },
];

export const SpeedControlModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { playbackSpeed, setPlaybackSpeed, resetPlaybackSpeed } = useLabsStore();

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
    <>
      {/* Soft translucent backdrop */}
      <div
        onClick={() => setIsOpen(false)}
        className="fixed inset-0 z-[140] bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-150"
      />

      {/* Floating glass mini-player popover above play/pause */}
      <div className="fixed bottom-[96px] sm:bottom-[104px] left-1/2 -translate-x-1/2 z-[150] w-[92vw] max-w-[340px] select-none font-['SpotifyMixUI']">
        <div className="bg-[#242424]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.8)] text-white space-y-3.5 animate-in fade-in slide-in-from-bottom-3 zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#1ed760] animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-wider text-[#b3b3b3]">Velocidad</span>
              <span className="px-2 py-0.5 rounded-full bg-[#1ed760]/20 text-[#1ed760] font-mono font-bold text-xs">
                {playbackSpeed.toFixed(2)}x
              </span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="w-6 h-6 rounded-full hover:bg-white/10 active:scale-90 flex items-center justify-center text-[#b3b3b3] hover:text-white transition-all cursor-pointer"
              aria-label="Cerrar"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Live Indicator & Status */}
          <div className="text-center py-0.5">
            <div className="text-2xl font-black text-[#1ed760] tracking-tight tabular-nums font-mono">
              {playbackSpeed.toFixed(2)}x
            </div>
            <p className="text-[11px] font-semibold text-[#b3b3b3]">
              {getSpeedLabel(playbackSpeed)}
            </p>
          </div>

          {/* Continuous Slider */}
          <div className="space-y-1 px-1">
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
              className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-[#1ed760] touch-none"
            />
            <div className="flex justify-between text-[10px] font-bold text-[#727272]">
              <span>0.5x</span>
              <span>1.0x</span>
              <span>2.0x</span>
            </div>
          </div>

          {/* Preset Chips */}
          <div className="flex items-center justify-between gap-1.5 pt-0.5">
            {SPEED_PRESETS.map((p) => {
              const isMatch = Math.abs(playbackSpeed - p.val) < 0.02;
              return (
                <button
                  key={p.val}
                  type="button"
                  onClick={() => setPlaybackSpeed(p.val)}
                  className={`flex-1 py-1 px-1.5 rounded-lg text-[11px] font-bold text-center transition-all cursor-pointer truncate ${
                    isMatch
                      ? 'bg-[#1ed760] text-black shadow-md font-extrabold'
                      : 'bg-white/5 hover:bg-white/10 text-white/80 hover:text-white'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* Reset button */}
          {playbackSpeed !== 1.0 && (
            <button
              type="button"
              onClick={resetPlaybackSpeed}
              className="w-full py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-bold text-white transition-all cursor-pointer active:scale-95 text-center"
            >
              Restablecer a 1.00x normal
            </button>
          )}
        </div>
      </div>
    </>
  );
};
