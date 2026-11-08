import React, { useEffect, useRef, useState } from 'react';
import { getMotionCoverMode, setMotionCoverMode, type MotionCoverMode } from '../../services/motionCover';
import { MobileSheet } from '../mobile/MobileSheet';

const OPTIONS: Array<{ id: MotionCoverMode; label: string; hint: string }> = [
  { id: 'wifi', label: 'Solo con wifi', hint: 'No gasta datos móviles' },
  { id: 'always', label: 'Siempre', hint: 'También con datos (1-3 MB por portada)' },
  { id: 'off', label: 'Desactivadas', hint: 'Siempre la portada fija' },
];

/** "Portadas animadas": Apple Music's animated album covers in the player */
export const MotionCoverSetting: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const [mode, setMode] = useState<MotionCoverMode>(() => getMotionCoverMode());
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const current = OPTIONS.find((o) => o.id === mode) || OPTIONS[0];

  const choose = (id: MotionCoverMode) => {
    setMode(id);
    setMotionCoverMode(id);
    setOpen(false);
  };

  useEffect(() => {
    if (!open || compact) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, compact]);

  const Check = () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="#1ed760" aria-hidden="true">
      <path d="M15.53 2.47a.75.75 0 0 1 0 1.06L4.907 14.153.47 9.716a.75.75 0 0 1 1.06-1.06l3.377 3.376L14.47 2.47a.75.75 0 0 1 1.06 0z" />
    </svg>
  );

  if (compact) {
    return (
      <div className="w-full">
        <button onClick={() => setOpen(true)} className="w-full flex items-center justify-between gap-3 text-left cursor-pointer active:opacity-70">
          <span className="min-w-0">
            <span className="block text-[15px] text-white font-medium">Portadas animadas</span>
            <span className="block text-[13px] text-[#a7a7a7] truncate">{current.label} · las de Apple Music, en el reproductor</span>
          </span>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="#a7a7a7" aria-hidden="true">
            <path d="M4.97.47a.75.75 0 0 0 0 1.06L11.44 8l-6.47 6.47a.75.75 0 1 0 1.06 1.06L13.56 8 6.03.47a.75.75 0 0 0-1.06 0" />
          </svg>
        </button>
        <MobileSheet open={open} onClose={() => setOpen(false)}>
          <div className="pb-3 border-b border-white/10">
            <p className="text-base font-bold text-white font-['SpotifyMixUITitle']">Portadas animadas</p>
            <p className="text-xs text-[#b3b3b3] mt-0.5">Los álbumes que tienen portada en movimiento en Apple Music la muestran en el reproductor.</p>
          </div>
          <div className="space-y-0.5">
            {OPTIONS.map((o) => (
              <button key={o.id} onClick={() => choose(o.id)} className="w-full flex items-center gap-3 px-2 py-3 rounded-lg active:bg-white/10 text-left cursor-pointer">
                <span className="flex-1 min-w-0">
                  <span className={`block text-[15px] font-bold ${mode === o.id ? 'text-[#1ed760]' : 'text-white'}`}>{o.label}</span>
                  <span className="block text-xs text-[#a7a7a7]">{o.hint}</span>
                </span>
                {mode === o.id && <Check />}
              </button>
            ))}
          </div>
        </MobileSheet>
      </div>
    );
  }

  return (
    <div className="w-full flex items-center justify-between gap-6">
      <div className="min-w-0">
        <div className="text-sm font-medium text-white">Portadas animadas</div>
        <div className="text-xs text-[#a7a7a7] mt-0.5">Las portadas en movimiento de Apple Music, en el reproductor, cuando el álbum tiene una.</div>
      </div>
      <div ref={boxRef} className="relative shrink-0">
        <button
          onClick={() => setOpen((v) => !v)}
          className="h-8 min-w-[160px] pl-3 pr-2.5 rounded-[4px] bg-[#2a2a2a] hover:bg-[#333] flex items-center justify-between gap-3 text-sm text-white cursor-pointer transition-colors"
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <span className="truncate">{current.label}</span>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" className={`transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true">
            <path d="M14 6l-6 6-6-6h12z" />
          </svg>
        </button>
        {open && (
          <div role="listbox" className="absolute right-0 top-full mt-1 z-50 w-[240px] rounded-[4px] bg-[#282828] p-1 shadow-[0_16px_24px_rgba(0,0,0,0.3)] animate-in fade-in zoom-in-95 duration-150 origin-top-right">
            {OPTIONS.map((o) => (
              <button key={o.id} onClick={() => choose(o.id)} className="w-full flex items-center gap-3 px-3 py-2 rounded-sm hover:bg-white/10 text-left cursor-pointer">
                <span className="flex-1 min-w-0">
                  <span className={`block text-sm ${mode === o.id ? 'text-[#1ed760]' : 'text-white'}`}>{o.label}</span>
                  <span className="block text-xs text-[#a7a7a7]">{o.hint}</span>
                </span>
                {mode === o.id && <Check />}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MotionCoverSetting;
