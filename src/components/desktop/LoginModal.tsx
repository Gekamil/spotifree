import React, { useState, useEffect } from 'react';
import { SpotifreeAuthCard } from '../common/SpotifreeAuthCard';
import { useUIStore } from '../../store/useUIStore';
import { useSpotifyDataStore } from '../../store/useSpotifyDataStore';
import type { SavedAccount } from '../../utils/userAccounts';
import {
  getSavedAccounts,
  saveAccount,
  removeSavedAccount,
  cleanSpDc,
} from '../../utils/userAccounts';

export type { SavedAccount };
export { getSavedAccounts, saveAccount, removeSavedAccount, cleanSpDc };

const AccountAvatar: React.FC<{ url?: string; name: string }> = ({ url, name }) => {
  const [error, setError] = useState(false);
  const initial = (name || 'U').charAt(0).toUpperCase();

  if (!url || error) {
    return (
      <div className="w-10 h-10 rounded-full bg-[#282828] text-white font-bold text-sm flex items-center justify-center shrink-0">
        {initial}
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={name}
      onError={() => setError(true)}
      referrerPolicy="no-referrer"
      className="w-10 h-10 rounded-full object-cover shrink-0"
    />
  );
};

export const LoginModal: React.FC = () => {
  const { isLoginModalOpen, closeLoginModal } = useUIStore();
  const { initialize, user } = useSpotifyDataStore();

  const [activeTab, setActiveTab] = useState<'spotifree' | 'saved'>('spotifree');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);

  useEffect(() => {
    if (isLoginModalOpen) {
      const accounts = getSavedAccounts();
      setSavedAccounts(accounts);
      setErrorMessage(null);
      setSuccessMessage(null);
      setActiveTab('spotifree');
    }
  }, [isLoginModalOpen]);

  if (!isLoginModalOpen) return null;

  const handleSwitchAccount = async (account: SavedAccount) => {
    
    setErrorMessage(null);
    setSuccessMessage(`Cambiando a cuenta de ${account.displayName}...`);

    try {
      if (typeof window !== 'undefined') {
        if (account.cookie) {
          window.localStorage.setItem('user_spotify_cookie', account.cookie);
        }
        if (account.id) {
          window.localStorage.setItem('spotifree_active_user_id', account.id);
        }
        if (account.accessToken) {
          window.localStorage.setItem('spotify_access_token', account.accessToken);
        }
        window.localStorage.removeItem('spotify_extracted_session');
        window.localStorage.removeItem('spotify_logged_out');
      }

      account.lastUsed = Date.now();
      saveAccount(account);

      await initialize();
      setSuccessMessage(`Sesión activa: ${account.displayName}`);
      setTimeout(() => {
        closeLoginModal();
      }, 600);
    } catch {
      setErrorMessage('Error al cambiar de cuenta.');
    } finally {
      
    }
  };

  const handleDeleteSavedAccount = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeSavedAccount(id);
    const updated = getSavedAccounts();
    setSavedAccounts(updated);
    if (updated.length === 0) {
      setActiveTab('spotifree');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 select-none animate-in fade-in duration-150 font-['SpotifyMixUI']">
      <div className="bg-[#121212] w-full max-w-[420px] rounded-2xl border border-[#282828] shadow-2xl flex flex-col font-sans relative max-h-[92vh] overflow-y-auto">
        {/* Close Button top-right */}
        <button
          onClick={closeLoginModal}
          className="absolute right-4 top-4 w-8 h-8 rounded-full text-[#b3b3b3] hover:text-white flex items-center justify-center transition-colors cursor-pointer z-10 hover:bg-[#282828]"
          title="Cerrar"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
          </svg>
        </button>

        {/* Modal Header */}
        <div className="px-8 pt-8 pb-2 flex flex-col items-center">
          <svg width="38" height="38" viewBox="0 0 24 24" fill="white" className="mb-3">
            <path d="M12 2C6.477 2 2 6.477 2 12c0 5.524 4.477 10 10 10s10-4.476 10-10c0-5.523-4.477-10-10-10zm4.586 14.424c-.18.295-.563.387-.857.207-2.35-1.435-5.308-1.76-8.793-.963-.335.077-.67-.133-.746-.468-.077-.334.132-.67.467-.746 3.808-.87 7.076-.496 9.722 1.115.294.18.386.563.207.855zm1.226-2.72c-.226.367-.706.482-1.072.257-2.687-1.652-6.785-2.131-9.965-1.166-.413.127-.848-.106-.973-.518-.125-.413.108-.848.52-.973 3.632-1.102 8.147-.568 11.233 1.328.366.226.481.707.257 1.072zm.105-2.835C14.692 8.95 9.375 8.775 6.297 9.71c-.494.15-1.018-.13-1.168-.624-.15-.494.13-1.018.624-1.168 3.532-1.073 9.404-.866 13.115 1.337.445.264.59.838.327 1.282-.264.443-.838.59-1.28.327z" />
          </svg>

          <h1 className="text-2xl font-bold text-white font-title text-center tracking-tight leading-snug">
            Iniciar sesión en Spotifree
          </h1>

          {/* Navigation Tabs */}
          <div className="flex gap-4 mt-5 w-full border-b border-[#282828] pb-0">
            <button
              type="button"
              onClick={() => {
                setActiveTab('spotifree');
                setErrorMessage(null);
              }}
              className={`pb-2.5 text-xs font-bold tracking-tight transition-all relative ${
                activeTab === 'spotifree'
                  ? 'text-[#1ed760] border-b-2 border-[#1ed760]'
                  : 'text-[#b3b3b3] hover:text-white'
              }`}
            >
              Iniciar sesión / Registro
            </button>
            {savedAccounts.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setActiveTab('saved');
                  setErrorMessage(null);
                }}
                className={`pb-2.5 text-xs font-bold tracking-tight transition-all relative flex items-center gap-1.5 ${
                  activeTab === 'saved'
                    ? 'text-white border-b-2 border-[#1ed760]'
                    : 'text-[#b3b3b3] hover:text-white'
                }`}
              >
                <span>Cuentas guardadas</span>
                <span className="text-[10px] bg-[#282828] text-white px-1.5 py-0.5 rounded-full font-bold">
                  {savedAccounts.length}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Modal Body */}
        <div className="px-6 pb-6 pt-3 space-y-4">
          {errorMessage && (
            <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400 font-bold">
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div className="p-2.5 rounded-lg bg-[#1ed760]/10 border border-[#1ed760]/20 text-xs text-[#1ed760] font-bold">
              {successMessage}
            </div>
          )}

          {/* TAB 0: SPOTIFREE CLOUD ACCOUNT */}
          {activeTab === 'spotifree' && (
            <SpotifreeAuthCard onAuthSuccess={() => setTimeout(closeLoginModal, 600)} />
          )}

          {/* TAB 1: SAVED ACCOUNTS */}
          {activeTab === 'saved' && (
            <div className="space-y-3">
              <p className="text-xs text-[#b3b3b3]">
                Selecciona una de tus cuentas guardadas para acceder a tu música:
              </p>

              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {savedAccounts.map((account) => {
                  const isCurrent = account.id === user?.id;
                  return (
                    <div
                      key={account.id}
                      onClick={() => handleSwitchAccount(account)}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                        isCurrent
                          ? 'border-[#1ed760] bg-[#1ed760]/10'
                          : 'border-[#282828] bg-[#181818] hover:border-white/20 hover:bg-[#222222]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <AccountAvatar url={account.avatarUrl} name={account.displayName} />
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-white truncate">
                            {account.displayName}
                          </p>
                          <p className="text-xs text-[#b3b3b3] truncate">
                            {account.email || 'Cuenta de Spotify'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isCurrent ? (
                          <span className="text-xs font-bold text-[#1ed760] bg-[#1ed760]/20 px-2 py-0.5 rounded-full">
                            Activa
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => handleDeleteSavedAccount(account.id, e)}
                            className="w-7 h-7 rounded-full text-[#b3b3b3] hover:text-red-400 hover:bg-white/10 flex items-center justify-center transition-colors"
                            title="Eliminar cuenta"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
