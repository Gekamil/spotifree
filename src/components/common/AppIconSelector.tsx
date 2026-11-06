import React, { useEffect, useState } from 'react';
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

const CheckBadge: React.FC = () => (
  <span className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-[#1ed760] flex items-center justify-center shadow-[0_2px_8px_rgba(0,0,0,0.5)]">
    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="#000" aria-hidden="true">
      <path d="M13.985 2.383 5.127 12.754 1.388 8.375l-.658.77 4.397 5.149 9.618-11.262z" />
    </svg>
  </span>
);

/**
 * "Icono de la app" picker. Shown in the APK (real launcher icon) and in the browser
 * (icon used when adding the web to the home screen). Hidden in an installed PWA,
 * where the OS no longer lets the icon change.
 */
export const AppIconSelector: React.FC<AppIconSelectorProps> = ({ variant }) => {
  const [platform] = useState(getAppIconPlatform);
  const [selected, setSelected] = useState<AppIconId>(getSelectedAppIcon);
  const [justChanged, setJustChanged] = useState(false);

  useEffect(() => {
    const onChange = () => setSelected(getSelectedAppIcon());
    window.addEventListener(APP_ICON_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(APP_ICON_CHANGED_EVENT, onChange);
  }, []);

  useEffect(() => {
    if (!justChanged) return;
    const t = window.setTimeout(() => setJustChanged(false), 2500);
    return () => window.clearTimeout(t);
  }, [justChanged]);

  if (platform === 'installed-pwa') return null;

  const handleSelect = (id: AppIconId) => {
    if (id === selected) return;
    setSelected(id);
    setJustChanged(true);
    void setSelectedAppIcon(id);
  };

  const hint =
    platform === 'native'
      ? 'Cambia el icono de Spotifree en tu pantalla de inicio. Puede tardar unos segundos en actualizarse.'
      : 'Elige el icono antes de instalar Spotifree o añadirlo a la pantalla de inicio. Una vez instalado, el sistema no permite cambiarlo.';

  const confirmText = platform === 'native' ? 'Icono actualizado' : 'Icono listo para instalar';

  const isMobile = variant === 'mobile';

  return (
    <div>
      <p className={isMobile ? 'text-xs text-[#b3b3b3] mb-4' : 'text-xs text-[#a7a7a7] mb-4'}>{hint}</p>

      <div
        className={
          isMobile
            ? 'grid grid-cols-3 gap-x-3 gap-y-5'
            : 'grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-x-4 gap-y-6'
        }
        role="radiogroup"
        aria-label="Icono de la app"
      >
        {APP_ICON_OPTIONS.map((opt) => {
          const active = opt.id === selected;
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => handleSelect(opt.id)}
              className="group flex flex-col items-center text-center cursor-pointer focus:outline-none"
            >
              <span
                className={`relative block rounded-[22%] transition-all duration-200 ${
                  isMobile ? 'w-[72px] h-[72px]' : 'w-[88px] h-[88px]'
                } ${
                  active
                    ? 'ring-2 ring-[#1ed760] ring-offset-[3px] ring-offset-[#121212] scale-100'
                    : 'ring-1 ring-white/10 group-hover:ring-white/40 group-hover:scale-[1.04] group-active:scale-95'
                }`}
              >
                <img
                  src={opt.preview}
                  alt=""
                  loading="lazy"
                  draggable={false}
                  className="w-full h-full rounded-[22%] object-cover bg-[#282828]"
                />
                {active && <CheckBadge />}
              </span>
              <span
                className={`mt-2.5 text-[13px] leading-tight font-bold truncate max-w-full ${
                  active ? 'text-[#1ed760]' : 'text-white'
                }`}
              >
                {opt.name}
              </span>
              <span className="text-[11px] leading-tight text-[#a7a7a7] mt-0.5 truncate max-w-full">{opt.period}</span>
            </button>
          );
        })}
      </div>

      <div
        aria-live="polite"
        className={`mt-4 flex items-center gap-2 text-xs font-bold text-[#1ed760] transition-opacity duration-300 ${
          justChanged ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor" aria-hidden="true">
          <path d="M13.985 2.383 5.127 12.754 1.388 8.375l-.658.77 4.397 5.149 9.618-11.262z" />
        </svg>
        {confirmText}
      </div>
    </div>
  );
};

export default AppIconSelector;
