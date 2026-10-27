import React, { useState, useEffect } from 'react';
import { useUIStore } from '../../store/useUIStore';
import { useSpotifyDataStore } from '../../store/useSpotifyDataStore';
import { initiateSpotifyLogin } from '../../services/spotifyAuth';

export interface SavedAccount {
  id: string;
  displayName: string;
  email?: string;
  avatarUrl?: string;
  cookie: string;
  accessToken?: string;
  lastUsed: number;
}

const ACCOUNTS_STORAGE_KEY = 'spotifree_saved_accounts';

export function getSavedAccounts(): SavedAccount[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(ACCOUNTS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

export function saveAccount(account: SavedAccount) {
  if (typeof window === 'undefined') return;
  try {
    const list = getSavedAccounts().filter((a) => a.id !== account.id && a.cookie !== account.cookie);
    list.unshift(account);
    window.localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(list.slice(0, 10)));
  } catch {}
}

export function removeSavedAccount(accountId: string) {
  if (typeof window === 'undefined') return;
  try {
    const list = getSavedAccounts().filter((a) => a.id !== accountId);
    window.localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(list));
  } catch {}
}

const AccountAvatar: React.FC<{ url?: string; name: string }> = ({ url, name }) => {
  const [error, setError] = useState(false);
  const initial = (name || 'U').charAt(0).toUpperCase();

  if (!url || error) {
    return (
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#1ed760] to-[#148A08] text-black font-black text-xs flex items-center justify-center shadow shrink-0">
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
      className="w-9 h-9 rounded-full object-cover shadow shrink-0"
    />
  );
};

export const LoginModal: React.FC = () => {
  const { isLoginModalOpen, closeLoginModal } = useUIStore();
  const { initialize, user } = useSpotifyDataStore();

  const [emailInput, setEmailInput] = useState('');
  const [cookieInput, setCookieInput] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);

  useEffect(() => {
    if (isLoginModalOpen) {
      setSavedAccounts(getSavedAccounts());
      setErrorMessage(null);
      setSuccessMessage(null);
      const activeCookie = typeof window !== 'undefined' ? window.localStorage.getItem('user_spotify_cookie') || '' : '';
      setCookieInput(activeCookie);
    }
  }, [isLoginModalOpen]);

  if (!isLoginModalOpen) return null;

  const handleOfficialLogin = () => {
    // Direct launch of official Spotify authorization in Spotify's real domain
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('spotify_logged_out');
    }
    initiateSpotifyLogin();
  };

  const handleConnectWithCookie = async (targetCookie?: string) => {
    const cookie = (targetCookie || cookieInput).trim();
    if (!cookie) {
      setErrorMessage('Por favor, introduce tu cookie sp_dc.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch('/api/spotify/extract-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookie }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'La cookie sp_dc no es válida o ha caducado.');
      }

      const data = await res.json();
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('user_spotify_cookie', cookie);
        if (data.accessToken) {
          window.localStorage.setItem('spotify_access_token', data.accessToken);
        }
      }

      saveAccount({
        id: data.user?.id || `user-${Date.now()}`,
        displayName: data.user?.display_name || 'Usuario Spotify',
        email: data.user?.email || emailInput,
        avatarUrl: data.user?.images?.[0]?.url,
        cookie,
        accessToken: data.accessToken,
        lastUsed: Date.now(),
      });

      setSuccessMessage(`¡Conectado como ${data.user?.display_name || 'Usuario'} con éxito!`);
      await initialize();
      setSavedAccounts(getSavedAccounts());

      setTimeout(() => {
        closeLoginModal();
      }, 1000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al conectar con Spotify.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwitchAccount = async (acc: SavedAccount) => {
    await handleConnectWithCookie(acc.cookie);
  };

  const handleDeleteAccount = (e: React.MouseEvent, accId: string) => {
    e.stopPropagation();
    removeSavedAccount(accId);
    setSavedAccounts(getSavedAccounts());
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in duration-200">
      <div className="bg-[#121212] w-full max-w-[460px] rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col font-['SpotifyMixUI'] relative p-8 sm:p-10">
        {/* Close Button top-right */}
        <button
          onClick={closeLoginModal}
          className="absolute right-5 top-5 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-[#b3b3b3] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          title="Cerrar"
        >
          ✕
        </button>

        {/* 1:1 Spotify Login Header matching screenshot 2 */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-10 h-10 mb-4 flex items-center justify-center">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="white">
              <path d="M12 2C6.477 2 2 6.477 2 12c0 5.524 4.477 10 10 10s10-4.476 10-10c0-5.523-4.477-10-10-10zm4.586 14.424c-.18.295-.563.387-.857.207-2.35-1.435-5.308-1.76-8.793-.963-.335.077-.67-.133-.746-.468-.077-.334.132-.67.467-.746 3.808-.87 7.076-.496 9.722 1.115.294.18.386.563.207.855zm1.226-2.72c-.226.367-.706.482-1.072.257-2.687-1.652-6.785-2.131-9.965-1.166-.413.127-.848-.106-.973-.518-.125-.413.108-.848.52-.973 3.632-1.102 8.147-.568 11.233 1.328.366.226.481.707.257 1.072zm.105-2.835C14.692 8.95 9.375 8.775 6.297 9.71c-.494.15-1.018-.13-1.168-.624-.15-.494.13-1.018.624-1.168 3.532-1.073 9.404-.866 13.115 1.337.445.264.59.838.327 1.282-.264.443-.838.59-1.28.327z" />
            </svg>
          </div>
          <h1 className="text-3xl font-black text-white font-['SpotifyMixUITitle'] tracking-tight">
            ¡Hola de nuevo!
          </h1>
        </div>

        {/* Feedback Alerts */}
        {errorMessage && (
          <div className="mb-4 p-3 bg-red-500/15 border border-red-500/30 rounded-xl text-red-200 text-xs flex items-center gap-2">
            <span>⚠️</span>
            <span>{errorMessage}</span>
          </div>
        )}
        {successMessage && (
          <div className="mb-4 p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-emerald-200 text-xs flex items-center gap-2">
            <span>✅</span>
            <span>{successMessage}</span>
          </div>
        )}

        {/* Input Form matching Spotify Web */}
        <div className="space-y-4">
          <div className="space-y-1.5 text-left">
            <label className="text-xs font-bold text-white block">
              Correo electrónico o nombre de usuario
            </label>
            <input
              type="text"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="Correo electrónico o nombre de usuario"
              className="w-full h-12 px-4 rounded-[4px] bg-[#121212] border border-[#727272] focus:border-white text-white text-sm outline-none transition-colors placeholder-[#727272]"
            />
          </div>

          {/* Green "Continuar" Button */}
          <button
            type="button"
            disabled={isLoading}
            onClick={handleOfficialLogin}
            className="w-full h-12 rounded-full bg-[#1ed760] hover:bg-[#1fdf64] hover:scale-[1.02] active:scale-[0.98] text-black font-bold text-sm tracking-wide transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                <span>Cargando...</span>
              </>
            ) : (
              <span>Continuar</span>
            )}
          </button>
        </div>

        {/* Divider matching Spotify */}
        <div className="flex items-center my-6">
          <div className="flex-1 border-t border-white/10" />
          <span className="px-4 text-xs font-semibold text-[#b3b3b3]">o</span>
          <div className="flex-1 border-t border-white/10" />
        </div>

        {/* Social Login Buttons 1:1 matching screenshot 2 */}
        <div className="space-y-2.5">
          {/* Continuar con Google */}
          <button
            type="button"
            onClick={handleOfficialLogin}
            className="w-full h-12 rounded-full border border-[#727272] hover:border-white bg-transparent hover:bg-white/5 text-white font-bold text-sm flex items-center justify-center gap-3 transition-all cursor-pointer"
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z" />
              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z" />
              <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z" />
              <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
            </svg>
            <span>Continuar con Google</span>
          </button>

          {/* Continuar con Facebook */}
          <button
            type="button"
            onClick={handleOfficialLogin}
            className="w-full h-12 rounded-full border border-[#727272] hover:border-white bg-transparent hover:bg-white/5 text-white font-bold text-sm flex items-center justify-center gap-3 transition-all cursor-pointer"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#1877F2">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
            <span>Continuar con Facebook</span>
          </button>

          {/* Continuar con Apple */}
          <button
            type="button"
            onClick={handleOfficialLogin}
            className="w-full h-12 rounded-full border border-[#727272] hover:border-white bg-transparent hover:bg-white/5 text-white font-bold text-sm flex items-center justify-center gap-3 transition-all cursor-pointer"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.63-.77 1.06-1.84.94-2.91-.91.04-2.02.61-2.67 1.38-.58.68-1.09 1.77-.95 2.82 1.01.08 2.05-.52 2.68-1.29" />
            </svg>
            <span>Continuar con Apple</span>
          </button>
        </div>

        {/* Saved Accounts if any exist */}
        {savedAccounts.length > 0 && (
          <div className="mt-6 pt-5 border-t border-white/10 space-y-2 text-left">
            <span className="text-xs font-bold text-white uppercase tracking-wider block">
              Cuentas guardadas en este dispositivo
            </span>
            <div className="space-y-1.5">
              {savedAccounts.map((acc) => {
                const isActive = user?.id === acc.id;
                return (
                  <div
                    key={acc.id}
                    onClick={() => handleSwitchAccount(acc)}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-[#1e1e1e] hover:bg-[#282828] transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <AccountAvatar url={acc.avatarUrl} name={acc.displayName} />
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-xs truncate">
                            {acc.displayName}
                          </span>
                          {isActive && (
                            <span className="px-1.5 py-0.2 rounded-full bg-[#1ed760]/20 text-[#1ed760] text-[9px] font-bold">
                              Activa
                            </span>
                          )}
                        </div>
                        {acc.email && (
                          <span className="text-[11px] text-[#a7a7a7] truncate">
                            {acc.email}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-[#1ed760] opacity-0 group-hover:opacity-100 transition-opacity">
                        {isActive ? 'Recargar' : 'Cambiar ➔'}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteAccount(e, acc.id)}
                        className="w-7 h-7 rounded-full hover:bg-white/10 text-[#727272] hover:text-red-400 flex items-center justify-center transition-colors text-xs cursor-pointer"
                        title="Eliminar cuenta guardada"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer Registration text matching Spotify */}
        <div className="mt-8 text-center text-xs text-[#b3b3b3]">
          ¿No tienes cuenta?{' '}
          <a
            href="https://www.spotify.com/signup"
            target="_blank"
            rel="noreferrer"
            className="text-white font-bold hover:text-[#1ed760] underline transition-colors"
          >
            Regístrate en Spotify
          </a>
        </div>

        {/* Discrete manual session toggle for power users */}
        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-[10px] text-[#535353] hover:text-[#727272] hover:underline cursor-pointer transition-colors"
          >
            {showAdvanced ? 'Ocultar ajustes manuales' : 'Ajustes avanzados de sesión'}
          </button>
        </div>

        {showAdvanced && (
          <div className="mt-3 p-3.5 rounded-xl bg-[#181818] border border-white/5 space-y-2 text-left animate-in fade-in">
            <label className="text-[11px] font-bold text-white block">
              Cookie de sesión directa (sp_dc)
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                value={cookieInput}
                onChange={(e) => setCookieInput(e.target.value)}
                placeholder="Pega tu cookie sp_dc..."
                className="flex-1 h-9 px-3 rounded-lg bg-[#242424] text-white text-xs border border-white/10 outline-none font-mono"
              />
              <button
                type="button"
                onClick={() => handleConnectWithCookie()}
                className="px-3 h-9 rounded-lg bg-[#1ed760] text-black font-bold text-xs hover:bg-[#1fdf64] transition-colors"
              >
                Conectar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
