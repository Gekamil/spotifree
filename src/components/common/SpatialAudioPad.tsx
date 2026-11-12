import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useLabsStore } from '../../services/labsService';

export const SpatialAudioPad: React.FC<{ disabled?: boolean }> = ({ disabled = false }) => {
  const {
    spatialX,
    spatialY,
    audioMono,
    setSpatialPosition,
    resetSpatialPosition,
  } = useLabsStore();

  const padRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const updateFromCoords = useCallback(
    (clientX: number, clientY: number) => {
      if (!padRef.current || disabled || audioMono) return;
      const rect = padRef.current.getBoundingClientRect();
      const rawX = ((clientX - rect.left) / rect.width) * 2 - 1;
      const rawY = -(((clientY - rect.top) / rect.height) * 2 - 1); // inverted so top = +1 (front)
      const clampedX = Math.min(1, Math.max(-1, rawX));
      const clampedY = Math.min(1, Math.max(-1, rawY));
      setSpatialPosition(clampedX, clampedY);
    },
    [disabled, audioMono, setSpatialPosition]
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    if (disabled || audioMono) return;
    setIsDragging(true);
    updateFromCoords(e.clientX, e.clientY);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled || audioMono) return;
    setIsDragging(true);
    if (e.touches[0]) {
      updateFromCoords(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) updateFromCoords(e.clientX, e.clientY);
    };
    const handleMouseUp = () => setIsDragging(false);

    const handleTouchMove = (e: TouchEvent) => {
      if (isDragging && e.touches[0]) {
        updateFromCoords(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    const handleTouchEnd = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleTouchEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, updateFromCoords]);

  // Dot coordinates mapped to CSS percentages
  // spatialX: -1 -> 0%, +1 -> 100%
  // spatialY: +1 (top) -> 0%, -1 (bottom) -> 100%
  const dotLeft = ((spatialX + 1) / 2) * 100;
  const dotTop = ((-spatialY + 1) / 2) * 100;

  const isCentered = Math.abs(spatialX) < 0.03 && Math.abs(spatialY) < 0.03;

  return (
    <div className="space-y-3 font-['SpotifyMixUI'] select-none">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#b3b3b3]">
            Posición acústica y balance 3D
          </span>
          <p className="text-xs text-[#a7a7a7] mt-0.5">
            Arrastra el punto para orientar el campo sonoro con auriculares
          </p>
        </div>
        {!isCentered && !audioMono && (
          <button
            type="button"
            onClick={resetSpatialPosition}
            className="text-xs font-bold text-[#1ed760] hover:underline self-start sm:self-auto cursor-pointer"
          >
            Centrar audio
          </button>
        )}
      </div>

      {/* 2D Pad Area */}
      <div className="relative flex justify-center py-2">
        <div
          ref={padRef}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          className={`relative w-full max-w-[280px] h-[210px] rounded-2xl bg-[#141414] border border-white/10 overflow-hidden cursor-crosshair touch-none ${
            audioMono ? 'opacity-40 pointer-events-none' : ''
          }`}
          style={{
            backgroundImage:
              'radial-gradient(circle at center, rgba(30,215,96,0.06) 0%, rgba(18,18,18,0.95) 75%)',
          }}
        >
          {/* Grid lines */}
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-white/10" />
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-white/10" />
          <div className="absolute inset-6 rounded-full border border-dashed border-white/5 pointer-events-none" />

          {/* Center Headset / Head Icon */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/20 pointer-events-none flex flex-col items-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 1a9 9 0 0 0-9 9v7c0 1.66 1.34 3 3 3h1a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2H5v-2a7 7 0 0 1 14 0v2h-2a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h1c1.66 0 3-1.34 3-3v-7a9 9 0 0 0-9-9z" />
            </svg>
          </div>

          {/* Orientation Labels */}
          <span className="absolute top-2 left-1/2 -translate-x-1/2 text-[9px] font-black tracking-widest text-white/40 pointer-events-none">
            DELANTE
          </span>
          <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[9px] font-black tracking-widest text-white/40 pointer-events-none">
            DETRÁS
          </span>
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[9px] font-black tracking-widest text-white/40 pointer-events-none">
            IZQ
          </span>
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] font-black tracking-widest text-white/40 pointer-events-none">
            DER
          </span>

          {/* Draggable Puck Dot */}
          <div
            className="absolute w-5 h-5 -ml-2.5 -mt-2.5 rounded-full bg-[#1ed760] shadow-[0_0_12px_#1ed760] border-2 border-white pointer-events-none transition-transform duration-75"
            style={{
              left: `${dotLeft}%`,
              top: `${dotTop}%`,
            }}
          />
        </div>

        {/* Audio Mono banner overlay */}
        {audioMono && (
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="bg-[#181818]/95 border border-white/10 px-4 py-2.5 rounded-xl shadow-xl text-center max-w-xs">
              <p className="text-xs font-bold text-white">Audio mono activado</p>
              <p className="text-[11px] text-[#a7a7a7] mt-0.5">
                Ambos canales reproducen la señal centrada e idéntica.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Position metrics readout */}
      {!audioMono && (
        <div className="flex items-center justify-between text-[11px] text-[#a7a7a7] px-2 font-mono">
          <span>
            {spatialX < -0.05
              ? `Izq ${Math.round(Math.abs(spatialX) * 100)}%`
              : spatialX > 0.05
              ? `Der ${Math.round(spatialX * 100)}%`
              : 'Centro'}
          </span>
          <span>
            {spatialY > 0.05
              ? `Delante +${Math.round(spatialY * 100)}%`
              : spatialY < -0.05
              ? `Detrás ${Math.round(Math.abs(spatialY) * 100)}%`
              : 'Nivel medio'}
          </span>
        </div>
      )}
    </div>
  );
};
