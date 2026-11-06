import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  APP_ICON_OPTIONS,
  APP_ICON_CHANGED_EVENT,
  getAppIconPlatform,
  getSelectedAppIcon,
  setSelectedAppIcon,
  type AppIconId,
} from '../../utils/appIcon';

interface AppIconSelectorProps {
  variant: 'desktop' | 'mobile';
}

const ChevronRight: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden="true">
    <path d="M4.97.47a.75.75 0 0 0 0 1.06L11.44 8l-6.47 6.47a.75.75 0 1 0 1.06 1.06L13.56 8 6.03.47a.75.75 0 0 0-1.06 0z" />
  </svg>
);

const CloseIcon: React.FC = () => (
  <svg viewBox="0 0 16 16" className="w-4 h-4" fill="currentColor" aria-hidden="true">
    <path d="M1.47 1.47a.75.75 0 0 1 1.06 0L8 6.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L9.06 8l5.47 5.47a.75.75 0 1 1-1.06 1.06L8 9.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L6.94 8 1.47 2.53a.75.75 0 0 1 0-1.06z" />
  </svg>
);

/** Spotify-style radio: green filled with a black check when selected, grey ring otherwise. */
const Radio: React.FC<{ checked: boolean }> = ({ checked }) =>
  checked ? (
    <span className="w-5 h-5 rounded-full bg-[#1ed760] flex items-center justify-center shrink-0">
      <svg viewBox="0 0 16 16" className="w-3 h-3" fill="#000" aria-hidden="true">
        <path d="M13.985 2.383 5.127 12.754 1.388 8.375l-.658.77 4.397 5.149 9.618-11.262z" />
      </svg>
    </span>
  ) : (
    <span className="w-5 h-5 rounded-full border-2 border-[#727272] shrink-0" />
  );

/**
 * "Icono de la app" setting: a compact row showing the current icon. Tapping it opens a
 * sub-panel (bottom sheet on mobile, dialog on desktop) to pick another official logo.
 * Hidden in an installed PWA, where the OS no longer lets the icon change.
 */
export const AppIconSelector: React.FC<AppIconSelectorProps> = ({ variant }) => {
  const [platform] = useState(getAppIconPlatform);
  const [selected, setSelected] = useState<AppIconId>(getSelectedAppIcon);
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false); // drives the enter/exit animation

  useEffect(() => {
    const onChange = () => setSelected(getSelectedAppIcon());
    window.addEventListener(APP_ICON_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(APP_ICON_CHANGED_EVENT, onChange);
  }, []);

  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => setVisible(true));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (platform === 'installed-pwa') return null;

  const current = APP_ICON_OPTIONS.find((o) => o.id === selected) || APP_ICON_OPTIONS[0];
  const isMobile = variant === 'mobile';

  function close() {
    setVisible(false);
    window.setTimeout(() => setOpen(false), 200);
  }

  const handleSelect = (id: AppIconId) => {
    if (id !== selected) {
      setSelected(id);
      void setSelectedAppIcon(id);
    }
    window.setTimeout(close, 180);
  };

  const hint =
    platform === 'native'
      ? 'El icono de tu pantalla de inicio puede tardar unos segundos en cambiar.'
      : 'Elígelo antes de instalar Spotifree o añadirlo a la pantalla de inicio.';

  const list = (
    <div role="radiogroup" aria-label="Icono de la app">
      {APP_ICON_OPTIONS.map((opt) => {
        const active = opt.id === selected;
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => handleSelect(opt.id)}
            className={`w-full flex items-center gap-3 text-left cursor-pointer transition-colors ${
              isMobile ? 'px-4 py-2.5 active:bg-white/10' : 'px-3 py-2 rounded-md hover:bg-white/10'
            }`}
          >
            <img
              src={opt.preview}
              alt=""
              draggable={false}
              className="w-12 h-12 rounded-[22%] object-cover bg-[#3e3e3e] shrink-0"
            />
            <span className="flex-1 min-w-0">
              <span className={`block text-[15px] font-bold truncate ${active ? 'text-[#1ed760]' : 'text-white'}`}>
                {opt.name}
              </span>
              <span className="block text-[13px] text-[#a7a7a7] truncate">{opt.period}</span>
            </span>
            <Radio checked={active} />
          </button>
        );
      })}
    </div>
  );

  const panel =
    open &&
    createPortal(
      <div
        className={`fixed inset-0 z-[9999] flex ${isMobile ? 'items-end' : 'items-center justify-center'} transition-colors duration-200 ${
          visible ? 'bg-black/70' : 'bg-black/0'
        }`}
        onClick={close}
        role="presentation"
      >
        {isMobile ? (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Icono de la app"
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-h-[85vh] overflow-y-auto bg-[#282828] rounded-t-2xl pb-[max(16px,env(safe-area-inset-bottom))] transition-transform duration-200 ease-out ${
              visible ? 'translate-y-0' : 'translate-y-full'
            }`}
          >
            <div className="flex justify-center pt-2.5 pb-1">
              <span className="w-9 h-1 rounded-full bg-white/30" />
            </div>
            <div className="px-4 pt-2 pb-3">
              <h3 className="text-base font-bold text-white font-['SpotifyMixUITitle']">Icono de la app</h3>
              <p className="text-xs text-[#a7a7a7] mt-1">{hint}</p>
            </div>
            {list}
          </div>
        ) : (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Icono de la app"
            onClick={(e) => e.stopPropagation()}
            className={`w-[420px] max-w-[calc(100vw-32px)] max-h-[80vh] flex flex-col bg-[#282828] rounded-lg shadow-[0_16px_24px_rgba(0,0,0,0.3),0_6px_8px_rgba(0,0,0,0.2)] transition-all duration-200 ${
              visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
            }`}
          >
            <div className="flex items-start justify-between px-6 pt-6 pb-3">
              <div>
                <h3 className="text-2xl font-bold text-white font-['SpotifyMixUITitle']">Icono de la app</h3>
                <p className="text-sm text-[#a7a7a7] mt-1">{hint}</p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Cerrar"
                className="w-8 h-8 -mr-2 rounded-full flex items-center justify-center text-[#a7a7a7] hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
              >
                <CloseIcon />
              </button>
            </div>
            <div className="overflow-y-auto px-3 pb-4">{list}</div>
          </div>
        )}
      </div>,
      document.body
    );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className={`w-full flex items-center justify-between text-left cursor-pointer group ${
          isMobile ? '' : 'py-3 border-b border-white/5'
        }`}
      >
        <span className="pr-3 min-w-0">
          <span className={`block ${isMobile ? 'text-sm font-bold' : 'text-sm font-medium'} text-white`}>
            Icono de la app
          </span>
          <span className={`block text-xs mt-0.5 truncate ${isMobile ? 'text-[#b3b3b3]' : 'text-[#a7a7a7]'}`}>
            {current.name} · {current.period}
          </span>
        </span>
        <span className="flex items-center gap-3 shrink-0">
          <img
            src={current.preview}
            alt=""
            draggable={false}
            className="w-8 h-8 rounded-[22%] object-cover bg-[#3e3e3e]"
          />
          <ChevronRight className="w-3.5 h-3.5 text-[#a7a7a7] group-hover:text-white transition-colors" />
        </span>
      </button>
      {panel}
    </>
  );
};

export default AppIconSelector;
