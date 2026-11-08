/**
 * Bottom sheet for the phone's "..." menus. Same look and motion as the player's "Más opciones"
 * (MobileNowPlayingModal): rounded top, cover header, round icon rows and a "Cerrar" button.
 */
import React from 'react';
import { createPortal } from 'react-dom';
import { handleImageError } from '../../utils/imageFallback';

interface MobileSheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  closeLabel?: string;
  zIndex?: number;
}

export const MobileSheet: React.FC<MobileSheetProps> = ({ open, onClose, children, closeLabel = 'Cerrar', zIndex = 120 }) => {
  if (!open || typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 flex flex-col justify-end select-none font-['SpotifyMixUI']" style={{ zIndex }}>
      <div onClick={onClose} className="fixed inset-0 bg-black/75 backdrop-blur-sm animate-fade-in" />
      <div
        className="relative z-10 bg-[#242424] rounded-t-[32px] p-6 space-y-5 animate-slide-up-modal max-h-[85vh] overflow-y-auto border-t border-white/10 shadow-2xl"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }}
      >
        {children}
        <button
          onClick={onClose}
          className="w-full py-3.5 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white font-bold text-sm transition-all cursor-pointer"
        >
          {closeLabel}
        </button>
      </div>
    </div>,
    document.body
  );
};

export const SheetHeader: React.FC<{ image?: string | null; title: string; subtitle?: string; round?: boolean }> = ({
  image,
  title,
  subtitle,
  round,
}) => (
  <div className="flex items-center gap-3.5 pb-3 border-b border-white/10">
    <div className={`w-14 h-14 overflow-hidden bg-[#181818] shrink-0 shadow ${round ? 'rounded-full' : 'rounded-lg'}`}>
      {image ? (
        <img src={image} alt={title} onError={handleImageError} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-white/40">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
          </svg>
        </div>
      )}
    </div>
    <div className="min-w-0 flex-1">
      <p className="font-bold text-white text-base truncate font-['SpotifyMixUITitle']">{title}</p>
      {subtitle && <p className="text-xs text-[#b3b3b3] truncate mt-0.5">{subtitle}</p>}
    </div>
  </div>
);

export const SheetList: React.FC<{ children: React.ReactNode }> = ({ children }) => <div className="space-y-1">{children}</div>;

interface SheetItemProps {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  onClick: () => void;
  danger?: boolean;
  active?: boolean;
}

export const SheetItem: React.FC<SheetItemProps> = ({ icon, label, sublabel, onClick, danger, active }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-4 py-3 px-2 rounded-xl active:scale-[0.98] transition-all cursor-pointer ${
      danger ? 'text-[#f3727f] hover:bg-[#f3727f]/10' : 'text-white hover:bg-white/10'
    }`}
  >
    <div
      className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
        danger ? 'bg-[#f3727f]/15 text-[#f3727f]' : active ? 'bg-white/10 text-[#1ed760]' : 'bg-white/10 text-white'
      }`}
    >
      {icon}
    </div>
    <div className="text-left flex-1 min-w-0">
      <p className={`font-bold text-sm ${danger ? 'text-[#f3727f]' : active ? 'text-[#1ed760]' : 'text-white'}`}>{label}</p>
      {sublabel && <p className="text-xs text-[#b3b3b3] truncate">{sublabel}</p>}
    </div>
  </button>
);
