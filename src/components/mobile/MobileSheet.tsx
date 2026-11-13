/**
 * Bottom sheet for the phone's "..." menus and option sheets.
 * Follows official Spotify Mobile sheet aesthetics and interaction design:
 * rounded top (rounded-t-[32px]), 40x4px drag handle with >= 48px touch target,
 * drag-to-dismiss gesture via useDragToDismiss, cover header, round icon rows,
 * hardware back / Escape dismissal, and a full-width "Cerrar" action button.
 */
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { handleImageError } from '../../utils/imageFallback';
import { useDragToDismiss } from '../../hooks/useDragToDismiss';

export interface SheetDragHandleProps extends React.HTMLAttributes<HTMLDivElement> {
  barClassName?: string;
}

/**
 * Top pill handle complying with Spotify UI standards:
 * - Minimum 40px width x 4px height bar
 * - Minimum 48px vertical touch target area (h-12 / min-h-[48px])
 * - touch-none to prevent browser scroll conflicts
 */
export const SheetDragHandle: React.FC<SheetDragHandleProps> = ({
  barClassName = 'bg-white/30',
  className = '',
  ...rest
}) => (
  <div
    {...rest}
    className={`w-full min-h-[48px] h-12 shrink-0 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none select-none ${className}`}
    aria-label="Arrastrar para cerrar"
    role="presentation"
  >
    <div className={`w-10 h-1 min-w-[40px] rounded-full ${barClassName}`} />
  </div>
);

export interface MobileSheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  closeLabel?: string;
  zIndex?: number;
}

export const MobileSheet: React.FC<MobileSheetProps> = ({
  open,
  onClose,
  children,
  closeLabel = 'Cerrar',
  zIndex = 120,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const { dragY, handleProps, contentProps, sheetStyle } = useDragToDismiss({
    onClose,
    scrollRef,
    threshold: 80,
    velocityThreshold: 0.5,
  });

  // Android hardware/system back button & Escape key dismiss
  useEffect(() => {
    if (!open) return;
    const onBack = (e: Event) => {
      (e as CustomEvent).detail?.setHandled?.();
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('spotifree_android_back', onBack);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('spotifree_android_back', onBack);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 flex flex-col justify-end select-none font-['SpotifyMixUI']"
      style={{ zIndex }}
    >
      {/* Backdrop overlay */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/75 backdrop-blur-sm animate-fade-in transition-opacity duration-200"
        style={{
          opacity: dragY > 0 ? Math.max(0, 1 - dragY / 400) : undefined,
        }}
      />

      {/* Draggable sheet container */}
      <div
        onClick={(e) => e.stopPropagation()}
        {...contentProps}
        className="relative z-10 bg-[#242424] rounded-t-[32px] border-t border-white/10 shadow-2xl animate-slide-up-modal max-h-[85vh] flex flex-col overflow-hidden touch-pan-y"
        style={sheetStyle}
      >
        {/* Top Handle with 48px touch target area */}
        <SheetDragHandle {...handleProps} />

        {/* Scrollable content body (gated by inner scroll for drag-to-dismiss) */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-6 pb-[calc(env(safe-area-inset-bottom,0px)+24px)] space-y-5"
        >
          {children}
          <button
            onClick={onClose}
            className="w-full py-3.5 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white font-bold text-sm transition-all cursor-pointer"
          >
            {closeLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export const SheetHeader: React.FC<{
  image?: string | null;
  title: string;
  subtitle?: string;
  round?: boolean;
}> = ({ image, title, subtitle, round }) => (
  <div className="flex items-center gap-3.5 pb-3 border-b border-white/10">
    <div
      className={`w-14 h-14 overflow-hidden bg-[#181818] shrink-0 shadow ${
        round ? 'rounded-full' : 'rounded-lg'
      }`}
    >
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

export const SheetList: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="space-y-1">{children}</div>
);

export interface SheetItemProps {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  onClick: () => void;
  danger?: boolean;
  active?: boolean;
}

export const SheetItem: React.FC<SheetItemProps> = ({
  icon,
  label,
  sublabel,
  onClick,
  danger,
  active,
}) => (
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
      <p className={`font-bold text-sm ${danger ? 'text-[#f3727f]' : active ? 'text-[#1ed760]' : 'text-white'}`}>
        {label}
      </p>
      {sublabel && <p className="text-xs text-[#b3b3b3] truncate">{sublabel}</p>}
    </div>
  </button>
);
