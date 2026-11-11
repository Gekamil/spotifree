import React from 'react';

interface KaraokeMicButtonProps {
  active: boolean;
  switching?: boolean;
  onToggle: () => void;
  compact?: boolean;
}

/**
 * Animated microphone toggle button that appears strictly when a verified instrumental
 * ("sin voces") backing track is available for the active song.
 */
export const KaraokeMicButton: React.FC<KaraokeMicButtonProps> = ({
  active,
  switching = false,
  onToggle,
  compact = false,
}) => {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={switching}
      aria-pressed={active}
      aria-label="Modo karaoke sin voces"
      title={active ? 'Volver a la canción con voces' : 'Activar modo karaoke (sin voces)'}
      className={`spf-karaoke-mic-btn relative inline-flex items-center justify-center gap-1.5 rounded-full min-h-[44px] min-w-[44px] px-3.5 text-xs font-bold shrink-0 cursor-pointer border focus-visible:outline focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2 active:scale-95 disabled:opacity-65 ${
        active
          ? 'spf-karaoke-mic-active bg-[#1ed760] text-black border-[#1ed760] shadow-[0_0_24px_rgba(30,215,96,0.45)]'
          : 'spf-karaoke-mic-available bg-black/35 hover:bg-black/55 text-white border-white/25 backdrop-blur-md'
      }`}
    >
      {active && (
        <span
          aria-hidden="true"
          className="spf-karaoke-halo pointer-events-none absolute inset-0 rounded-full border border-[#1ed760]"
        />
      )}

      {switching ? (
        <span
          aria-hidden="true"
          className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin"
        />
      ) : (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className="spf-karaoke-mic-icon shrink-0"
        >
          {/* Microphone capsule + stand */}
          <rect x="9" y="3" width="6" height="10" rx="3" fill="currentColor" />
          <path
            d="M5.5 11.5a6.5 6.5 0 0 0 13 0"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M12 18v3M8.5 21h7"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          {/* Subtle animated acoustic arcs on sides */}
          <path
            d="M3.2 8.2a9.8 9.8 0 0 0 0 6.6M20.8 8.2a9.8 9.8 0 0 1 0 6.6"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            className="spf-karaoke-wave opacity-60"
          />
        </svg>
      )}

      <span className="whitespace-nowrap tracking-tight">
        {compact ? (active ? 'Karaoke' : 'Sin voces') : active ? 'Karaoke ON' : 'Modo karaoke'}
      </span>
    </button>
  );
};
