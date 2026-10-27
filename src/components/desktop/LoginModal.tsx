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

  const [activeTab, setActiveTab] = useState<'cookie' | 'credentials'>('cookie');
  const [cookieInput, setCookieInput] = useState('');
  const [showCookie, setShowCookie] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [needs2FA, setNeeds2FA] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);

  useEffect(() => {
    if (isLoginModalOpen) {
      setSavedAccounts(getSavedAccounts());
      setErrorMessage(null);
      setSuccessMessage(null);
      setNeeds2FA(false);
      setTwoFactorCode('');
      const activeCookie = typeof window !== 'undefined' ? window.localStorage.getItem('user_spotify_cookie') || '' : '';
      setCookieInput(activeCookie);
    }
  }, [isLoginModalOpen]);

  if (!isLoginModalOpen) return null;

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setCookieInput(text.trim());
      }
    } catch {
      // Clipboard fallback
    }
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
        email: data.user?.email,
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
      }, 1100);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al conectar con Spotify.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginWithCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim() || !passwordInput.trim()) {
      setErrorMessage('Introduce tu usuario o correo y tu contraseña.');
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
          twoFactorCode: twoFactorCode.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.needs2FA) {
          setNeeds2FA(true);
        }
        throw new Error(data.error || 'No se pudo iniciar sesión.');
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
        }, 1100);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al procesar el inicio de sesión.');
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
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in duration-200">
      <div className="bg-[#121212] w-full max-w-lg rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col font-['SpotifyMixUI']">
        {/* Spotify Authentic Header */}
        <div className="px-6 pt-6 pb-4 flex items-center justify-between border-b border-white/5 bg-[#181818]/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#1ed760] flex items-center justify-center shadow-md shrink-0">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="black">
                <path d="M12 2C6.477 2 2 6.477 2 12c0 5.524 4.477 10 10 10s10-4.476 10-10c0-5.523-4.477-10-10-10zm4.586 14.424c-.18.295-.563.387-.857.207-2.35-1.435-5.308-1.76-8.793-.963-.335.077-.67-.133-.746-.468-.077-.334.132-.67.467-.746 3.808-.87 7.076-.496 9.722 1.115.294.18.386.563.207.855zm1.226-2.72c-.226.367-.706.482-1.072.257-2.687-1.652-6.785-2.131-9.965-1.166-.413.127-.848-.106-.973-.518-.125-.413.108-.848.52-.973 3.632-1.102 8.147-.568 11.233 1.328.366.226.481.707.257 1.072zm.105-2.835C14.692 8.95 9.375 8.775 6.297 9.71c-.494.15-1.018-.13-1.168-.624-.15-.494.13-1.018.624-1.168 3.532-1.073 9.404-.866 13.115 1.337.445.264.59.838.327 1.282-.264.443-.838.59-1.28.327z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-black text-white font-['SpotifyMixUITitle'] tracking-tight">
                Inicia sesión en Spotify
              </h2>
              <p className="text-xs text-[#b3b3b3]">
                Accede a tus playlists, tus canciones favoritas y tu feed real
              </p>
            </div>
          </div>
          <button
            onClick={closeLoginModal}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 text-[#b3b3b3] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Cerrar"
          >
            ✕
          </button>
        </div>

        {/* 2FA Friendly Information Alert */}
        <div className="mx-6 mt-4 p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/25 flex items-start gap-2.5 text-xs text-[#b3b3b3]">
          <span className="text-blue-400 font-bold shrink-0 mt-0.5">🔐</span>
          <div className="space-y-0.5">
            <span className="font-bold text-white block">¿Tu cuenta tiene 2FA (doble factor)?</span>
            <p className="text-[11px] leading-relaxed">
              Al conectar con tu cookie <code className="text-white font-mono bg-white/10 px-1 py-0.2 rounded">sp_dc</code>, entras directamente sin necesidad de códigos SMS ni apps de autenticación, porque representa una sesión ya validada.
            </p>
          </div>
        </div>

        {/* Tab switchers styled like Spotify navigation pills */}
        <div className="flex border-b border-white/5 bg-[#181818]/40 px-6 pt-3 gap-2">
          <button
            onClick={() => setActiveTab('cookie')}
            className={`pb-3 px-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'cookie'
                ? 'border-[#1ed760] text-white'
                : 'border-transparent text-[#a7a7a7] hover:text-white'
            }`}
          >
            Cookie de sesión (sp_dc) <span className="text-[10px] text-[#1ed760] font-normal ml-1">Recomendado</span>
          </button>
          <button
            onClick={() => setActiveTab('credentials')}
            className={`pb-3 px-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'credentials'
                ? 'border-[#1ed760] text-white'
                : 'border-transparent text-[#a7a7a7] hover:text-white'
            }`}
          >
            Usuario y contraseña
          </button>
        </div>

        {/* Body content */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[62vh]">
          {/* Notifications */}
          {errorMessage && (
            <div className="p-3.5 bg-red-500/15 border border-red-500/30 rounded-xl text-red-200 text-xs flex items-center gap-2.5">
              <span>⚠️</span>
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-emerald-200 text-xs flex items-center gap-2.5">
              <span>✅</span>
              <span>{successMessage}</span>
            </div>
          )}

          {/* TAB 1: Direct Cookie sp_dc */}
          {activeTab === 'cookie' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white block">
                    Cookie de Spotify (sp_dc)
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowCookie(!showCookie)}
                    className="text-[11px] text-[#b3b3b3] hover:text-white cursor-pointer underline"
                  >
                    {showCookie ? 'Ocultar' : 'Mostrar'}
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    type={showCookie ? 'text' : 'password'}
                    value={cookieInput}
                    onChange={(e) => setCookieInput(e.target.value)}
                    placeholder="Pega aquí tu cookie sp_dc..."
                    className="flex-1 h-11 px-3.5 rounded-xl bg-[#242424] text-white text-xs border border-white/10 focus:border-[#1ed760] outline-none transition-colors font-mono"
                  />
                  <button
                    type="button"
                    onClick={handlePasteClipboard}
                    className="px-4 h-11 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-colors shrink-0 cursor-pointer"
                    title="Pegar del portapapeles"
                  >
                    Pegar
                  </button>
                </div>
              </div>

              {/* Action Button */}
              <button
                type="button"
                disabled={isLoading}
                onClick={() => handleConnectWithCookie()}
                className="w-full h-12 rounded-full bg-[#1ed760] hover:bg-[#1fdf64] hover:scale-102 active:scale-98 text-black font-black text-sm uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer shadow-lg flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    <span>Conectando tu cuenta...</span>
                  </>
                ) : (
                  <span>Conectar y sincronizar</span>
                )}
              </button>

              {/* Step-by-Step visual instructions for Desktop & Mobile */}
              <div className="p-4 rounded-xl bg-[#181818] border border-white/5 space-y-2.5 text-xs text-[#a7a7a7]">
                <p className="font-bold text-white">¿Cómo conseguir tu cookie sp_dc?</p>
                <ol className="list-decimal list-inside space-y-1.5 leading-relaxed">
                  <li>Inicia sesión en <a href="https://open.spotify.com" target="_blank" rel="noreferrer" className="text-[#1ed760] underline">open.spotify.com</a> en tu navegador.</li>
                  <li>Pulsa <kbd className="bg-white/10 px-1 py-0.5 rounded text-white">F12</kbd> (o clic derecho ➔ Inspeccionar).</li>
                  <li>Ve a la pestaña <strong>Aplicación</strong> (Application) ➔ <strong>Cookies</strong> ➔ <strong>https://open.spotify.com</strong>.</li>
                  <li>Copia el valor de <strong>sp_dc</strong> y pégalo arriba. Al guardarse, tu sesión queda registrada en este dispositivo para siempre.</li>
                </ol>
              </div>
            </div>
          )}

          {/* TAB 2: Automatic extraction with credentials */}
          {activeTab === 'credentials' && (
            <form onSubmit={handleLoginWithCredentials} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-white block">
                  Correo o nombre de usuario de Spotify
                </label>
                <input
                  type="text"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="ejemplo@correo.com"
                  className="w-full h-11 px-3.5 rounded-xl bg-[#242424] text-white text-xs border border-white/10 focus:border-[#1ed760] outline-none transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-white block">
                  Contraseña
                </label>
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Tu contraseña de Spotify"
                  className="w-full h-11 px-3.5 rounded-xl bg-[#242424] text-white text-xs border border-white/10 focus:border-[#1ed760] outline-none transition-colors"
                />
              </div>

              {needs2FA && (
                <div className="space-y-1.5 p-3 rounded-xl bg-[#1e1e1e] border border-[#1ed760]/40 animate-in fade-in">
                  <label className="text-xs font-bold text-[#1ed760] block">
                    Código de verificación 2FA (6 dígitos)
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value)}
                    placeholder="123456"
                    className="w-full h-11 px-3.5 rounded-xl bg-[#282828] text-white text-center tracking-widest text-lg font-mono border border-[#1ed760] outline-none"
                  />
                  <p className="text-[11px] text-[#a7a7a7]">
                    Introduce el código enviado por SMS o generado por tu app de autenticación.
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 rounded-full bg-[#1ed760] hover:bg-[#1fdf64] hover:scale-102 active:scale-98 text-black font-black text-sm uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer shadow-lg flex items-center justify-center gap-2 mt-2"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    <span>Iniciando sesión...</span>
                  </>
                ) : (
                  <span>Iniciar sesión</span>
                )}
              </button>

              <p className="text-[11px] text-[#727272] leading-snug text-center">
                Tus credenciales viajan de forma segura y cifrada para capturar la sesión de Spotify.
              </p>
            </form>
          )}

          {/* Multi-account Switcher Section */}
          {savedAccounts.length > 0 && (
            <div className="pt-4 border-t border-white/10 space-y-2.5">
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
                          className="w-7 h-7 rounded-full hover:bg-white/10 text-[#727272] hover:text-red-400 flex items-center justify-center transition-colors text-xs"
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
        </div>
      </div>
    </div>
  );
};
