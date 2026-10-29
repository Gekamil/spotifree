import React, { useEffect, useRef, useState } from 'react';
import { useUIStore } from '../../store/useUIStore';
import { useSpotifyDataStore } from '../../store/useSpotifyDataStore';
import { getSavedAccounts, switchActiveAccount, type SavedAccount } from '../../utils/userAccounts';

export const ProfileDropdown: React.FC = () => {
  const { isProfileOpen, closeProfile, setActiveMainTab, openLoginModal } = useUIStore();
  const { isAuthenticated, logout, user } = useSpotifyDataStore();
  const menuRef = useRef<HTMLDivElement>(null);
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);

  useEffect(() => {
    if (isProfileOpen) {
      setSavedAccounts(getSavedAccounts());
    }
  }, [isProfileOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeProfile();
      }
    };
    if (isProfileOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isProfileOpen, closeProfile]);

  const handleSwitchAccount = async (account: SavedAccount) => {
    try {
      await switchActiveAccount(account);
    } catch (e) {}
    closeProfile();
  };

  if (!isProfileOpen) return null;

  return (
    <div
      ref={menuRef}
      className="absolute top-14 right-4 w-60 bg-[#282828] rounded-[4px] shadow-[0_16px_24px_rgba(0,0,0,0.6),0_6px_8px_rgba(0,0,0,0.4)] p-1 z-50 text-white select-none border border-white/5 animate-in fade-in zoom-in-95 duration-100 font-['SpotifyMixUI']"
    >
      {!isAuthenticated ? (
        <>
          <button
            onClick={() => {
              openLoginModal();
              closeProfile();
            }}
            className="w-full h-10 px-3 flex items-center justify-between text-sm font-semibold text-white hover:bg-white/10 rounded-[2px] transition-colors cursor-pointer"
          >
            <span className="text-[#1ed760] font-bold">Iniciar sesión</span>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="text-[#1ed760]">
              <path d="M6 3.5l4.5 4.5L6 12.5" />
            </svg>
          </button>

          <div className="h-[1px] bg-white/10 my-1" />

          <button
            onClick={() => {
              setActiveMainTab('settings');
              closeProfile();
            }}
            className="w-full h-10 px-3 flex items-center text-sm font-normal text-white hover:bg-white/10 rounded-[2px] transition-colors cursor-pointer"
          >
            Configuración
          </button>

          <button
            onClick={() => {
              setActiveMainTab('guide');
              closeProfile();
            }}
            className="w-full h-10 px-3 flex items-center text-sm font-normal text-white hover:bg-white/10 rounded-[2px] transition-colors cursor-pointer"
          >
            Ayuda
          </button>
        </>
      ) : (
        <>
          {/* Active User Header */}
          <div
            onClick={() => {
              setActiveMainTab('profile');
              closeProfile();
            }}
            className="px-3 py-2.5 hover:bg-white/10 rounded-[2px] cursor-pointer transition-colors flex items-center justify-between group"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-[#181818] flex items-center justify-center font-bold text-xs text-white shrink-0 overflow-hidden shadow">
                {user?.images?.[0]?.url ? (
                  <img src={user.images[0].url} alt={user.display_name} className="w-full h-full object-cover" />
                ) : (
                  (user?.display_name || 'U').charAt(0).toUpperCase()
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-white truncate">{user?.display_name || 'Usuario'}</p>
                <p className="text-[11px] text-[#1ed760] flex items-center gap-1 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#1ed760]" />
                  Cuenta activa
                </p>
              </div>
            </div>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" className="text-[#b3b3b3] group-hover:text-white shrink-0">
              <path d="M6 3.5l4.5 4.5L6 12.5" />
            </svg>
          </div>

          <div className="h-[1px] bg-white/10 my-1" />

          {/* Saved Accounts Switcher */}
          {savedAccounts.length > 0 && (
            <div className="py-1">
              <span className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#a7a7a7] block">
                Cambiar de cuenta
              </span>
              {savedAccounts.slice(0, 4).map((acc) => {
                const isActive = acc.id === user?.id || acc.displayName === user?.display_name;
                return (
                  <div
                    key={acc.id}
                    onClick={() => handleSwitchAccount(acc)}
                    className="h-9 px-3 flex items-center justify-between hover:bg-white/10 rounded-[2px] cursor-pointer transition-colors text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded-full bg-[#181818] flex items-center justify-center font-bold text-[10px] text-white shrink-0 overflow-hidden">
                        {acc.avatarUrl ? (
                          <img src={acc.avatarUrl} alt={acc.displayName} className="w-full h-full object-cover" />
                        ) : (
                          acc.displayName.charAt(0).toUpperCase()
                        )}
                      </div>
                      <span className="truncate font-semibold text-white">{acc.displayName}</span>
                    </div>
                    {isActive && (
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="text-[#1ed760] shrink-0">
                        <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z" />
                      </svg>
                    )}
                  </div>
                );
              })}

              <button
                onClick={() => {
                  openLoginModal();
                  closeProfile();
                }}
                className="w-full h-8 px-3 flex items-center gap-2 text-xs font-semibold text-[#1ed760] hover:bg-white/10 rounded-[2px] transition-colors cursor-pointer"
              >
                <span>+ Añadir otra cuenta</span>
              </button>

              <div className="h-[1px] bg-white/10 my-1" />
            </div>
          )}

          <button
            onClick={() => {
              setActiveMainTab('settings');
              closeProfile();
            }}
            className="w-full h-10 px-3 flex items-center text-sm font-normal text-white hover:bg-white/10 rounded-[2px] transition-colors cursor-pointer"
          >
            Configuración
          </button>

          <div className="h-[1px] bg-white/10 my-1" />

          <button
            onClick={() => {
              logout();
              closeProfile();
            }}
            className="w-full h-10 px-3 flex items-center text-sm font-normal text-white hover:bg-white/10 rounded-[2px] transition-colors cursor-pointer"
          >
            Cerrar sesión
          </button>
        </>
      )}
    </div>
  );
};
