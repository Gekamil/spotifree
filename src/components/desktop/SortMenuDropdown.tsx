import React, { useEffect, useRef } from 'react';
import { useUIStore } from '../../store/useUIStore';

const SORTS = [
  { id: 'recientes', label: 'Recientes' },
  { id: 'anadidos', label: 'Añadidos recientemente' },
  { id: 'alfabetico', label: 'Alfabético' },
  { id: 'creador', label: 'Creador' },
] as const;

const VIEWS = [
  { id: 'compacta', label: 'Compacta', d: 'M15.5 13.5H.5V12h15zm0-4.75H.5v-1.5h15zm0-4.75H.5V2.5h15z' },
  { id: 'lista', label: 'Lista', d: 'M15 14.5H5V13h10zm0-5.75H5v-1.5h10zM15 3H5V1.5h10zM3 3H1V1.5h2zm0 11.5H1V13h2zm0-5.75H1v-1.5h2z' },
  {
    id: 'cuadricula-compacta',
    label: 'Cuadrícula compacta',
    d: 'M1 1h3v3H1zm0 5.5h3v3H1zM4 12H1v3h3zM6.5 1h3v3h-3zm3 5.5h-3v3h3zm-3 5.5h3v3h-3zM15 1h-3v3h3zm-3 5.5h3v3h-3zm3 5.5h-3v3h3z',
  },
  { id: 'cuadricula', label: 'Cuadrícula', d: 'M1 1h6v6H1zm1.5 1.5v3h3v-3zM1 9h6v6H1zm1.5 1.5v3h3v-3zM9 1h6v6H9zm1.5 1.5v3h3v-3zM9 9h6v6H9zm1.5 1.5v3h3v-3z' },
] as const;

const Check = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="text-[#1ed760] shrink-0">
    <path d="M15.53 2.47a.75.75 0 0 1 0 1.06L4.907 14.153.47 9.716a.75.75 0 0 1 1.06-1.06l3.377 3.376L14.47 2.47a.75.75 0 0 1 1.06 0" />
  </svg>
);

/** "Ordenar por / Ver como" of Tu biblioteca, as in Spotify's desktop app */
export const SortMenuDropdown: React.FC = () => {
  const { isSortMenuOpen, closeSortMenu, sortOrder, setSortOrder, viewMode, setViewMode } = useUIStore();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isSortMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) closeSortMenu();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSortMenu();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSortMenuOpen, closeSortMenu]);

  if (!isSortMenuOpen) return null;

  return (
    <div
      ref={menuRef}
      role="menu"
      className="absolute top-9 right-0 w-[220px] bg-[#282828] rounded-[4px] shadow-[0_16px_24px_rgba(0,0,0,0.3),0_6px_8px_rgba(0,0,0,0.2)] p-1 z-50 text-white select-none origin-top-right animate-in fade-in zoom-in-95 duration-150 font-['SpotifyMixUI']"
    >
      <div className="px-3 pt-2 pb-1.5 text-[11px] font-bold text-[#b3b3b3]">Ordenar por</div>
      {SORTS.map((s) => {
        const on = sortOrder === s.id;
        return (
          <button
            key={s.id}
            role="menuitemradio"
            aria-checked={on}
            onClick={() => {
              setSortOrder(s.id as any);
              closeSortMenu();
            }}
            className={`w-full h-10 flex items-center justify-between gap-2 px-3 rounded-[2px] hover:bg-white/10 transition-colors text-[14px] text-left cursor-pointer ${
              on ? 'text-[#1ed760]' : 'text-[#e5e5e5]'
            }`}
          >
            <span className="truncate">{s.label}</span>
            {on && <Check />}
          </button>
        );
      })}

      <div className="h-px bg-white/10 my-1 mx-1" />

      <div className="px-3 pt-1.5 pb-1.5 text-[11px] font-bold text-[#b3b3b3]">Ver como</div>
      <div className="grid grid-cols-4 gap-1 px-1 pb-1">
        {VIEWS.map((v) => {
          const on = viewMode === v.id;
          return (
            <button
              key={v.id}
              role="menuitemradio"
              aria-checked={on}
              aria-label={v.label}
              title={v.label}
              onClick={() => {
                setViewMode(v.id as any);
                closeSortMenu();
              }}
              className={`h-9 rounded-[4px] flex items-center justify-center transition-colors cursor-pointer ${
                on ? 'bg-white/10 text-[#1ed760]' : 'text-[#b3b3b3] hover:text-white hover:bg-white/10'
              }`}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d={v.d} />
              </svg>
            </button>
          );
        })}
      </div>
    </div>
  );
};
