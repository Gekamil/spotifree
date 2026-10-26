import React, { useEffect, useRef } from 'react';
import { useUIStore } from '../../store/useUIStore';

export const SortMenuDropdown: React.FC = () => {
  const {
    isSortMenuOpen,
    closeSortMenu,
    sortOrder,
    setSortOrder,
    viewMode,
    setViewMode,
  } = useUIStore();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeSortMenu();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeSortMenu();
      }
    };
    if (isSortMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSortMenuOpen, closeSortMenu]);

  if (!isSortMenuOpen) return null;

  return (
    <div
      ref={menuRef}
      className="absolute top-9 right-0 w-[208px] bg-[#282828] rounded-[4px] shadow-[0_16px_24px_rgba(0,0,0,0.5),0_6px_8px_rgba(0,0,0,0.3)] p-1 z-50 text-white select-none border border-white/5 animate-in fade-in zoom-in-95 duration-100"
    >
      <div className="px-3 py-2 text-[11px] font-bold text-[#a7a7a7] uppercase tracking-wider">
        Ordenar por
      </div>

      {/* Recientes */}
      <button
        onClick={() => {
          setSortOrder('recientes');
          closeSortMenu();
        }}
        className="w-full flex items-center justify-between px-3 py-2 rounded-[2px] hover:bg-[#3e3e3e] transition-colors text-[13px] font-semibold text-left"
      >
        <span className={sortOrder === 'recientes' ? 'text-[#1ed760]' : 'text-white'}>
          Recientes
        </span>
        {sortOrder === 'recientes' && (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="text-[#1ed760] shrink-0">
            <path d="M15.53 2.47a.75.75 0 0 1 0 1.06L4.907 14.153.47 9.716a.75.75 0 0 1 1.06-1.06l3.377 3.376L14.47 2.47a.75.75 0 0 1 1.06 0" />
          </svg>
        )}
      </button>

      {/* Añadidos recientemente */}
      <button
        onClick={() => {
          setSortOrder('anadidos');
          closeSortMenu();
        }}
        className="w-full flex items-center justify-between px-3 py-2 rounded-[2px] hover:bg-[#3e3e3e] transition-colors text-[13px] font-semibold text-left"
      >
        <span className={sortOrder === 'anadidos' ? 'text-[#1ed760]' : 'text-white'}>
          Añadidos recientemente
        </span>
        {sortOrder === 'anadidos' && (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="text-[#1ed760] shrink-0">
            <path d="M15.53 2.47a.75.75 0 0 1 0 1.06L4.907 14.153.47 9.716a.75.75 0 0 1 1.06-1.06l3.377 3.376L14.47 2.47a.75.75 0 0 1 1.06 0" />
          </svg>
        )}
      </button>

      {/* Orden alfabético */}
      <button
        onClick={() => {
          setSortOrder('alfabetico');
          closeSortMenu();
        }}
        className="w-full flex items-center justify-between px-3 py-2 rounded-[2px] hover:bg-[#3e3e3e] transition-colors text-[13px] font-semibold text-left"
      >
        <span className={sortOrder === 'alfabetico' ? 'text-[#1ed760]' : 'text-white'}>
          Orden alfabético
        </span>
        {sortOrder === 'alfabetico' && (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="text-[#1ed760] shrink-0">
            <path d="M15.53 2.47a.75.75 0 0 1 0 1.06L4.907 14.153.47 9.716a.75.75 0 0 1 1.06-1.06l3.377 3.376L14.47 2.47a.75.75 0 0 1 1.06 0" />
          </svg>
        )}
      </button>

      {/* Creador */}
      <button
        onClick={() => {
          setSortOrder('creador');
          closeSortMenu();
        }}
        className="w-full flex items-center justify-between px-3 py-2 rounded-[2px] hover:bg-[#3e3e3e] transition-colors text-[13px] font-semibold text-left"
      >
        <span className={sortOrder === 'creador' ? 'text-[#1ed760]' : 'text-white'}>
          Creador
        </span>
        {sortOrder === 'creador' && (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="text-[#1ed760] shrink-0">
            <path d="M15.53 2.47a.75.75 0 0 1 0 1.06L4.907 14.153.47 9.716a.75.75 0 0 1 1.06-1.06l3.377 3.376L14.47 2.47a.75.75 0 0 1 1.06 0" />
          </svg>
        )}
      </button>

      {/* Divider */}
      <div className="h-px bg-white/10 my-1 mx-1" />

      {/* Ver como Header */}
      <div className="px-3 py-1.5 text-[11px] font-bold text-[#a7a7a7] uppercase tracking-wider">
        Ver como
      </div>

      {/* 4 View Mode Icon Buttons Row (Matching Image 4 exactly) */}
      <div className="grid grid-cols-4 gap-1 p-1 bg-[#181818] rounded mx-1 mb-1">
        {/* 1. Compact List */}
        <button
          onClick={() => {
            setViewMode('compacta');
            closeSortMenu();
          }}
          className={`h-8 rounded flex items-center justify-center transition-colors ${
            viewMode === 'compacta'
              ? 'bg-[#383838] text-[#1ed760]'
              : 'text-[#a7a7a7] hover:text-white hover:bg-white/5'
          }`}
          title="Vista compacta"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M15.5 13.5H.5V12h15zm0-4.75H.5v-1.5h15zm0-4.75H.5V2.5h15z" />
          </svg>
        </button>

        {/* 2. Detailed List */}
        <button
          onClick={() => {
            setViewMode('lista');
            closeSortMenu();
          }}
          className={`h-8 rounded flex items-center justify-center transition-colors ${
            viewMode === 'lista'
              ? 'bg-[#383838] text-[#1ed760]'
              : 'text-[#a7a7a7] hover:text-white hover:bg-white/5'
          }`}
          title="Vista de lista"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M15 14.5H5V13h10zm0-5.75H5v-1.5h10zM15 3H5V1.5h10zM3 3H1V1.5h2zm0 11.5H1V13h2zm0-5.75H1v-1.5h2z" />
          </svg>
        </button>

        {/* 3. Compact Grid 3x3 */}
        <button
          onClick={() => {
            setViewMode('cuadricula-compacta');
            closeSortMenu();
          }}
          className={`h-8 rounded flex items-center justify-center transition-colors ${
            viewMode === 'cuadricula-compacta'
              ? 'bg-[#383838] text-[#1ed760]'
              : 'text-[#a7a7a7] hover:text-white hover:bg-white/5'
          }`}
          title="Vista de cuadrícula compacta"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M1 1h3v3H1zm0 5.5h3v3H1zM4 12H1v3h3zM6.5 1h3v3h-3zm3 5.5h-3v3h3zm-3 5.5h3v3h-3zM15 1h-3v3h3zm-3 5.5h3v3h-3zm3 5.5h-3v3h3z" />
          </svg>
        </button>

        {/* 4. Large Grid 2x2 */}
        <button
          onClick={() => {
            setViewMode('cuadricula');
            closeSortMenu();
          }}
          className={`h-8 rounded flex items-center justify-center transition-colors ${
            viewMode === 'cuadricula'
              ? 'bg-[#383838] text-[#1ed760]'
              : 'text-[#a7a7a7] hover:text-white hover:bg-white/5'
          }`}
          title="Vista de cuadrícula"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M1 1h6v6H1zm1.5 1.5v3h3v-3zM1 9h6v6H1zm1.5 1.5v3h3v-3zM9 1h6v6H9zm1.5 1.5v3h3v-3zM9 9h6v6H9zm1.5 1.5v3h3v-3z" />
          </svg>
        </button>
      </div>
    </div>
  );
};
