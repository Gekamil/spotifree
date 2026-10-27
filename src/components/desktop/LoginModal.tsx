import React, { useState, useEffect } from 'react';
import { useUIStore } from '../../store/useUIStore';
import { useSpotifyDataStore } from '../../store/useSpotifyDataStore';

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
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#1ed760] to-[#148A08] text-black font-black text-xs flex items-center justify-center shadow shrink-0">
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
      className="w-8 h-8 rounded-full object-cover shadow shrink-0"
    />
  );
};

export const LoginModal: React.FC = () => {
  const { isLoginModalOpen, closeLoginModal } = useUIStore();
  const { initialize, user } = useSpotifyDataStore();

  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [cookieInput, setCookieInput] = useState('');
  const [showAdvancedSession, setShowAdvancedSession] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);

  useEffect(() => {
    if (isLoginModalOpen) {
      setSavedAccounts(getSavedAccounts());
      setErrorMessage(null);
      setSuccessMessage(null);
      setInfoMessage(null);
      const activeCookie = typeof window !== 'undefined' ? window.localStorage.getItem('user_spotify_cookie') || '' : '';
      setCookieInput(activeCookie);
    }
  }, [isLoginModalOpen]);

  if (!isLoginModalOpen) return null;

  const handleConnectWithCookie = async (targetCookie?: string) => {
    const cookie = (targetCookie || cookieInput).trim();
    if (!cookie) {
      setErrorMessage('Por favor, introduce tu clave de sesión sp_dc.');
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
        throw new Error(err.error || 'La sesión no es válida o ha caducado.');
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
      setErrorMessage(err.message || 'Error al conectar la cuenta de Spotify.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) {
      setErrorMessage('Introduce tu correo electrónico o nombre de usuario.');
      return;
    }

    // If password not entered yet, prompt for password
    if (!passwordInput.trim()) {
      setErrorMessage('Introduce tu contraseña de Spotify para continuar.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailInput.trim(),
          password: passwordInput,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        // Spotify account has 2FA/Captcha active: open official Spotify in new tab as user requested
        window.open('https://accounts.spotify.com/es/login', '_blank');
        setShowAdvancedSession(true);
        throw new Error('Spotify ha abierto la sesión en una nueva pestaña para validar tu cuenta.');
      }

      if (data.cookie) {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('user_spotify_cookie', data.cookie);
          if (data.accessToken) {
            window.localStorage.setItem('spotify_access_token', data.accessToken);
          }
        }

        saveAccount({
          id: data.user?.id || `user-${Date.now()}`,
          displayName: data.user?.display_name || 'Usuario Spotify',
          email: emailInput.trim(),
          avatarUrl: data.user?.images?.[0]?.url,
          cookie: data.cookie,
          accessToken: data.accessToken,
          lastUsed: Date.now(),
        });

        setSuccessMessage(`¡Bienvenido, ${data.user?.display_name || 'Usuario'}!`);
        await initialize();
        setSavedAccounts(getSavedAccounts());

        setTimeout(() => {
          closeLoginModal();
        }, 1000);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al conectar con Spotify.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenOAuthTab = (provider: 'google' | 'facebook' | 'apple') => {
    setInfoMessage(`Abriendo Spotify en una nueva pestaña para iniciar sesión con ${provider.toUpperCase()}...`);
    window.open('https://accounts.spotify.com/es/login', '_blank');
    setShowAdvancedSession(true);
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setCookieInput(text.trim());
      }
    } catch {}
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in duration-200">
      <div className="bg-[#121212] w-full max-w-[420px] rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col font-['SpotifyMixUI'] relative">
        {/* Close Button top-right */}
        <button
          onClick={closeLoginModal}
          className="absolute right-4 top-4 w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 text-[#b3b3b3] hover:text-white flex items-center justify-center transition-colors cursor-pointer z-10"
          title="Cerrar"
        >
          ✕
        </button>

        {/* Modal Content styled 1:1 like Spotify Login (Image 2) */}
        <div className="p-8 pt-10 flex flex-col items-center">
          {/* Centered Spotify Brand Logo */}
          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center mb-6 shadow-md">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="black">
              <path d="M12 2C6.477 2 2 6.477 2 12c0 5.524 4.477 10 10 10s10-4.476 10-10c0-5.523-4.477-10-10-10zm4.586 14.424c-.18.295-.563.387-.857.207-2.35-1.435-5.308-1.76-8.793-.963-.335.077-.67-.133-.746-.468-.077-.334.132-.67.467-.746 3.808-.87 7.076-.496 9.722 1.115.294.18.386.563.207.855zm1.226-2.72c-.226.367-.706.482-1.072.257-2.687-1.652-6.785-2.131-9.965-1.166-.413.127-.848-.106-.973-.518-.125-.413.108-.848.52-.973 3.632-1.102 8.147-.568 11.233 1.328.366.226.481.707.257 1.072zm.105-2.835C14.692 8.95 9.375 8.775 6.297 9.71c-.494.15-1.018-.13-1.168-.624-.15-.494.13-1.018.624-1.168 3.532-1.073 9.404-.866 13.115 1.337.445.264.59.838.327 1.282-.264.443-.838.59-1.28.327z" />
            </svg>
          </div>

          {/* Heading */}
          <h1 className="text-3xl font-black text-white font-['SpotifyMixUITitle'] text-center tracking-tight mb-8">
            ¡Hola de nuevo!
          </h1>

          {/* Messages */}
          {errorMessage && (
            <div className="w-full mb-4 p-3 bg-red-500/15 border border-red-500/30 rounded-xl text-red-200 text-xs flex items-center gap-2">
              <span>⚠️</span>
              <span className="leading-snug">{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="w-full mb-4 p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-emerald-200 text-xs flex items-center gap-2">
              <span>✅</span>
              <span>{successMessage}</span>
            </div>
          )}

          {infoMessage && (
            <div className="w-full mb-4 p-3 bg-blue-500/15 border border-blue-500/30 rounded-xl text-blue-200 text-xs flex items-center gap-2">
              <span>ℹ️</span>
              <span className="leading-snug">{infoMessage}</span>
            </div>
          )}

          {/* Email / Username Form */}
          <form onSubmit={handleLoginSubmit} className="w-full space-y-3.5">
            <div>
              <label className="text-xs font-bold text-white block mb-2">
                Correo electrónico o nombre de usuario
              </label>
              <input
                type="text"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="Correo o nombre de usuario"
                className="w-full h-12 px-3.5 rounded-[4px] bg-[#121212] border border-[#727272] focus:border-white text-white text-sm outline-none transition-colors placeholder:text-[#535353]"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-white block mb-2">
                Contraseña
              </label>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Contraseña"
                className="w-full h-12 px-3.5 rounded-[4px] bg-[#121212] border border-[#727272] focus:border-white text-white text-sm outline-none transition-colors placeholder:text-[#535353]"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 rounded-full bg-[#1ed760] hover:bg-[#1fdf64] hover:scale-102 active:scale-98 text-black font-bold text-sm tracking-normal transition-all disabled:opacity-50 cursor-pointer shadow-lg flex items-center justify-center gap-2 mt-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  <span>Conectando...</span>
                </>
              ) : (
                <span>Continuar</span>
              )}
            </button>
          </form>

          {/* Centered 'o' divider */}
          <div className="w-full flex items-center gap-3 my-5">
            <div className="flex-1 h-[1px] bg-white/10" />
            <span className="text-xs text-white/70 font-normal">o</span>
            <div className="flex-1 h-[1px] bg-white/10" />
          </div>

          {/* Social OAuth Buttons */}
          <div className="w-full space-y-2.5">
            {/* Google */}
            <button
              type="button"
              onClick={() => handleOpenOAuthTab('google')}
              className="w-full h-12 rounded-full border border-[#727272] hover:border-white text-white text-sm font-bold flex items-center justify-center gap-3 transition-colors cursor-pointer group"
            >
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.616z" />
                <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
                <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" />
                <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" />
              </svg>
              <span>Continuar con Google</span>
            </button>

            {/* Facebook */}
            <button
              type="button"
              onClick={() => handleOpenOAuthTab('facebook')}
              className="w-full h-12 rounded-full border border-[#727272] hover:border-white text-white text-sm font-bold flex items-center justify-center gap-3 transition-colors cursor-pointer group"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#1877F2">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
              <span>Continuar con Facebook</span>
            </button>

            {/* Apple */}
            <button
              type="button"
              onClick={() => handleOpenOAuthTab('apple')}
              className="w-full h-12 rounded-full border border-[#727272] hover:border-white text-white text-sm font-bold flex items-center justify-center gap-3 transition-colors cursor-pointer group"
            >
              <svg width="18" height="18" viewBox="0 0 170 170" fill="currentColor">
                <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.69-3.08-7.83-8.12-12.44-15.12C17.65 133.02 11.2 118.66 4.6 91.73-.08 72.8 1.48 57.06 9.28 44.53c6.04-9.87 14.16-15.02 24.36-15.46 4.93 0 10.45 1.41 16.57 4.23 6.11 2.82 10.05 4.3 11.81 4.45 2.12-.27 6.22-1.82 12.3-4.66 6.09-2.83 11.45-4.14 16.08-3.92 11.96.64 21.6 5.23 28.91 13.78-10.43 6.32-15.54 15.04-15.34 26.16.22 8.7 3.58 15.98 10.08 21.84 6.5 5.86 14.28 9.07 23.33 9.63-2.39 7.07-5.22 14.07-8.5 21l-.01.02zM119.22 3.12c0 7.42-2.73 14.41-8.18 20.98-6.52 7.82-14.34 12.38-23.46 13.68-.22-1.3-.33-2.5-.33-3.59 0-7.18 2.84-14.24 8.52-21.19C101.44 5.92 109.52 1.4 119.22 0v3.12z" />
              </svg>
              <span>Continuar con Apple</span>
            </button>
          </div>

          {/* Bottom discreet expander for Saved accounts / Session key */}
          <div className="w-full mt-6 pt-4 border-t border-white/10 flex flex-col items-center">
            <button
              type="button"
              onClick={() => setShowAdvancedSession(!showAdvancedSession)}
              className="text-xs text-[#a7a7a7] hover:text-white transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <span>{showAdvancedSession ? 'Ocultar opciones avanzadas' : '¿Cambiar de cuenta o sincronizar sesión?'}</span>
              <span className="text-[10px]">{showAdvancedSession ? '▲' : '▼'}</span>
            </button>

            {/* Unfolded Session / Multi-account panel */}
            {showAdvancedSession && (
              <div className="w-full mt-4 space-y-4 animate-in fade-in duration-200">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-white block">
                      Clave de sesión de Spotify
                    </label>
                    <button
                      type="button"
                      onClick={handlePasteClipboard}
                      className="text-[11px] text-[#1ed760] hover:underline cursor-pointer"
                    >
                      Pegar del portapapeles
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={cookieInput}
                      onChange={(e) => setCookieInput(e.target.value)}
                      placeholder="Pega tu clave de sesión aquí..."
                      className="flex-1 h-10 px-3 rounded-lg bg-[#242424] text-white text-xs border border-white/10 focus:border-[#1ed760] outline-none font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => handleConnectWithCookie()}
                      className="px-3.5 h-10 rounded-lg bg-[#1ed760] hover:bg-[#1fdf64] text-black font-bold text-xs shrink-0 cursor-pointer"
                    >
                      Sincronizar
                    </button>
                  </div>
                </div>

                {/* Multi-account Switcher */}
                {savedAccounts.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-white/5">
                    <span className="text-[11px] font-bold text-white uppercase tracking-wider block">
                      Cuentas guardadas en este dispositivo
                    </span>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {savedAccounts.map((acc) => {
                        const isActive = user?.id === acc.id;
                        return (
                          <div
                            key={acc.id}
                            onClick={() => handleConnectWithCookie(acc.cookie)}
                            className="flex items-center justify-between p-2 rounded-xl bg-[#1e1e1e] hover:bg-[#282828] transition-colors cursor-pointer group"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <AccountAvatar url={acc.avatarUrl} name={acc.displayName} />
                              <div className="flex flex-col min-w-0">
                                <div className="flex items-center gap-1.5">
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
                                  <span className="text-[10px] text-[#a7a7a7] truncate">
                                    {acc.email}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-[#1ed760] opacity-0 group-hover:opacity-100 transition-opacity">
                                Entrar ➔
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeSavedAccount(acc.id);
                                  setSavedAccounts(getSavedAccounts());
                                }}
                                className="w-6 h-6 rounded-full hover:bg-white/10 text-[#727272] hover:text-red-400 flex items-center justify-center transition-colors text-xs"
                                title="Eliminar cuenta"
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
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
