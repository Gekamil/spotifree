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
    const list = getSavedAccounts().filter(
      (a) => a.id !== account.id && a.cookie !== account.cookie
    );
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

export function cleanSpDc(raw: string): string {
  if (!raw) return '';
  let str = raw.trim();
  const match = str.match(/sp_dc=([^;]+)/);
  if (match) return match[1].trim();
  return str.replace(/^sp_dc=/i, '').trim();
}

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

  const [activeTab, setActiveTab] = useState<'cookie' | 'oauth' | 'saved'>('cookie');
  const [cookieInput, setCookieInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const [showHelpGuide, setShowHelpGuide] = useState(false);

  useEffect(() => {
    if (isLoginModalOpen) {
      const accounts = getSavedAccounts();
      setSavedAccounts(accounts);
      setErrorMessage(null);
      setSuccessMessage(null);
      if (accounts.length > 0 && !cookieInput) {
        setActiveTab('saved');
      } else {
        setActiveTab('cookie');
      }
    }
  }, [isLoginModalOpen]);

  if (!isLoginModalOpen) return null;

  const handleConnectWithCookie = async (targetCookie?: string) => {
    const raw = (targetCookie || cookieInput).trim();
    const cookie = cleanSpDc(raw);

    if (!cookie) {
      setErrorMessage('Introduce tu clave de sesión sp_dc.');
      return;
    }

    if (!cookie.startsWith('AQ') || cookie.length < 50) {
      setErrorMessage('La clave sp_dc debe comenzar por "AQ" y contener el valor completo.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch('/api/extract-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookie }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'La clave de sesión no es válida o ha caducado en Spotify.');
      }

      const data = await res.json();
      if (!data || !data.user) {
        throw new Error('No se pudieron obtener los datos de la cuenta de Spotify.');
      }

      if (typeof window !== 'undefined') {
        window.localStorage.setItem('user_spotify_cookie', cookie);
        window.localStorage.setItem('spotify_extracted_session', JSON.stringify({ ...data, _cookie: cookie }));
        if (data.user?.id) {
          window.localStorage.setItem('spotifree_active_user_id', data.user.id);
        }
        if (data.accessToken) {
          window.localStorage.setItem('spotify_access_token', data.accessToken);
        }
      }

      saveAccount({
        id: data.user.id || `user-${Date.now()}`,
        displayName: data.user.display_name || 'Usuario Spotify',
        email: data.user.email,
        avatarUrl: data.user.images?.[0]?.url,
        cookie,
        accessToken: data.accessToken,
        lastUsed: Date.now(),
      });

      setSuccessMessage(`Sesión iniciada como ${data.user.display_name || 'Usuario'}.`);
      await initialize();
      setSavedAccounts(getSavedAccounts());

      setTimeout(() => {
        closeLoginModal();
      }, 700);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al conectar con Spotify.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwitchAccount = async (account: SavedAccount) => {
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(`Cambiando a cuenta de ${account.displayName}...`);

    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('user_spotify_cookie', account.cookie);
        if (account.id) {
          window.localStorage.setItem('spotifree_active_user_id', account.id);
        }
        if (account.accessToken) {
          window.localStorage.setItem('spotify_access_token', account.accessToken);
        }
        window.localStorage.removeItem('spotify_extracted_session');
      }

      account.lastUsed = Date.now();
      saveAccount(account);

      await initialize();
      setSuccessMessage(`Sesión activa: ${account.displayName}`);
      setTimeout(() => {
        closeLoginModal();
      }, 600);
    } catch (err: any) {
      setErrorMessage('Error al cambiar de cuenta.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthLogin = () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      initiateSpotifyLogin();
    } catch (e: any) {
      setErrorMessage(e.message || 'No se pudo abrir el inicio de sesión oficial.');
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 select-none animate-in fade-in duration-150">
      <div className="bg-[#121212] w-full max-w-[420px] rounded-lg border border-[#282828] shadow-2xl overflow-hidden flex flex-col font-['SpotifyMixUI'] relative max-h-[90vh] overflow-y-auto">
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

        {/* Modal Header (Authentic Spotify Styling) */}
        <div className="px-8 pt-8 pb-4 flex flex-col items-center">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="white" className="mb-4">
            <path d="M12 2C6.477 2 2 6.477 2 12c0 5.524 4.477 10 10 10s10-4.476 10-10c0-5.523-4.477-10-10-10zm4.586 14.424c-.18.295-.563.387-.857.207-2.35-1.435-5.308-1.76-8.793-.963-.335.077-.67-.133-.746-.468-.077-.334.132-.67.467-.746 3.808-.87 7.076-.496 9.722 1.115.294.18.386.563.207.855zm1.226-2.72c-.226.367-.706.482-1.072.257-2.687-1.652-6.785-2.131-9.965-1.166-.413.127-.848-.106-.973-.518-.125-.413.108-.848.52-.973 3.632-1.102 8.147-.568 11.233 1.328.366.226.481.707.257 1.072zm.105-2.835C14.692 8.95 9.375 8.775 6.297 9.71c-.494.15-1.018-.13-1.168-.624-.15-.494.13-1.018.624-1.168 3.532-1.073 9.404-.866 13.115 1.337.445.264.59.838.327 1.282-.264.443-.838.59-1.28.327z" />
          </svg>

          <h1 className="text-2xl font-bold text-white font-['SpotifyMixUITitle'] text-center tracking-tight">
            Iniciar sesión en Spotify
          </h1>

          {/* Navigation Tabs */}
          <div className="flex gap-2 mt-6 w-full border-b border-[#282828] pb-1">
            <button
              onClick={() => {
                setActiveTab('cookie');
                setErrorMessage(null);
              }}
              className={`pb-2 px-1 text-xs font-bold transition-all relative ${
                activeTab === 'cookie'
                  ? 'text-white border-b-2 border-[#1ed760]'
                  : 'text-[#b3b3b3] hover:text-white'
              }`}
            >
              Clave de sesión
            </button>
            <button
              onClick={() => {
                setActiveTab('oauth');
                setErrorMessage(null);
              }}
              className={`pb-2 px-1 text-xs font-bold transition-all relative ${
                activeTab === 'oauth'
                  ? 'text-white border-b-2 border-[#1ed760]'
                  : 'text-[#b3b3b3] hover:text-white'
              }`}
            >
              Página oficial
            </button>
            <button
              onClick={() => {
                setActiveTab('saved');
                setErrorMessage(null);
              }}
              className={`pb-2 px-1 text-xs font-bold transition-all relative flex items-center gap-1.5 ${
                activeTab === 'saved'
                  ? 'text-white border-b-2 border-[#1ed760]'
                  : 'text-[#b3b3b3] hover:text-white'
              }`}
            >
              <span>Cuentas guardadas</span>
              {savedAccounts.length > 0 && (
                <span className="text-[10px] bg-[#282828] text-white px-1.5 py-0.2 rounded-full">
                  {savedAccounts.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="px-8 pb-8 pt-2 space-y-4">
          {/* TAB 1: COOKIE SP_DC (AUTHENTIC SPOTIFY INPUT & BUTTONS) */}
          {activeTab === 'cookie' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-white block">
                  Clave de sesión (sp_dc)
                </label>
                <input
                  type="password"
                  value={cookieInput}
                  onChange={(e) => {
                    setCookieInput(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="Pega el valor de la cookie sp_dc"
                  className={`w-full h-11 px-3.5 rounded bg-[#121212] text-white text-xs border outline-none font-mono transition-colors ${
                    errorMessage
                      ? 'border-[#e22134] focus:border-[#e22134]'
                      : 'border-[#727272] hover:border-white focus:border-white'
                  }`}
                />

                {/* Spotify-styled error message */}
                {errorMessage && (
                  <div className="flex items-center gap-1.5 text-[#e22134] text-xs font-normal mt-1.5">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="shrink-0">
                      <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm8-3.75a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4.25zm0 6.5a.875.875 0 1 1 0-1.75.875.875 0 0 1 0 1.75z" />
                    </svg>
                    <span>{errorMessage}</span>
                  </div>
                )}

                {successMessage && (
                  <div className="flex items-center gap-1.5 text-[#1ed760] text-xs font-normal mt-1.5">
                    <span>{successMessage}</span>
                  </div>
                )}
              </div>

              {/* Primary Spotify Button */}
              <button
                type="button"
                onClick={() => handleConnectWithCookie()}
                disabled={isLoading || !cookieInput.trim()}
                className="w-full h-12 rounded-full bg-[#1ed760] hover:bg-[#1fdf64] hover:scale-[1.02] active:scale-[0.98] text-black font-bold text-sm tracking-normal transition-all disabled:opacity-40 cursor-pointer shadow-lg flex items-center justify-center mt-2"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span>Iniciar sesión</span>
                )}
              </button>

              {/* Help guide toggle */}
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => setShowHelpGuide(!showHelpGuide)}
                  className="text-xs text-[#b3b3b3] hover:text-white underline transition-colors cursor-pointer"
                >
                  {showHelpGuide ? 'Ocultar ayuda' : '¿Dónde encontrar la clave sp_dc?'}
                </button>

                {showHelpGuide && (
                  <div className="mt-3 p-3 rounded bg-[#181818] border border-[#282828] text-left text-xs text-[#b3b3b3] space-y-1.5 leading-relaxed">
                    <p>1. Abre <a href="https://open.spotify.com" target="_blank" rel="noopener noreferrer" className="text-[#1ed760] underline">open.spotify.com</a> en tu navegador.</p>
                    <p>2. Pulsa <strong>F12</strong> (Inspeccionar) → <strong>Aplicación</strong> → <strong>Cookies</strong> → <code>open.spotify.com</code>.</p>
                    <p>3. Busca el valor de <strong>sp_dc</strong>, cópialo y pégalo arriba.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: SPOTIFY OFFICIAL PAGE (OAUTH PKCE) */}
          {activeTab === 'oauth' && (
            <div className="space-y-4 text-center">
              <p className="text-xs text-[#b3b3b3] leading-relaxed text-left">
                Inicia sesión de forma segura a través de la página oficial de Spotify. Resolverás cualquier verificación en Spotify y volverás conectado automáticamente.
              </p>

              {errorMessage && (
                <div className="flex items-center gap-1.5 text-[#e22134] text-xs font-normal text-left">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="shrink-0">
                    <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm8-3.75a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4.25zm0 6.5a.875.875 0 1 1 0-1.75.875.875 0 0 1 0 1.75z" />
                  </svg>
                  <span>{errorMessage}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleOAuthLogin}
                disabled={isLoading}
                className="w-full h-12 rounded-full border border-[#727272] hover:border-white text-white font-bold text-sm tracking-normal hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span>Continuar con Spotify</span>
                )}
              </button>
            </div>
          )}

          {/* TAB 3: SAVED ACCOUNTS */}
          {activeTab === 'saved' && (
            <div className="space-y-3">
              {savedAccounts.length === 0 ? (
                <div className="py-6 text-center text-[#b3b3b3] space-y-2">
                  <p className="text-xs">No hay cuentas guardadas en este dispositivo.</p>
                  <button
                    onClick={() => setActiveTab('cookie')}
                    className="text-xs text-[#1ed760] font-bold hover:underline"
                  >
                    Vincular una cuenta con clave sp_dc
                  </button>
                </div>
              ) : (
                <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                  {savedAccounts.map((account) => {
                    const isCurrent = user?.id === account.id || user?.display_name === account.displayName;
                    return (
                      <div
                        key={account.id}
                        className={`p-3 rounded flex items-center justify-between transition-colors ${
                          isCurrent
                            ? 'bg-[#282828] border border-[#1ed760]/40'
                            : 'bg-[#181818] hover:bg-[#202020]'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 pr-2">
                          <AccountAvatar url={account.avatarUrl} name={account.displayName} />
                          <div className="flex flex-col min-w-0">
                            <span className="font-bold text-white text-xs truncate">
                              {account.displayName}
                            </span>
                            {account.email && (
                              <span className="text-[11px] text-[#b3b3b3] truncate">
                                {account.email}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {!isCurrent ? (
                            <button
                              onClick={() => handleSwitchAccount(account)}
                              disabled={isLoading}
                              className="px-3 py-1.5 rounded-full border border-[#727272] hover:border-white text-white text-xs font-bold transition-all cursor-pointer"
                            >
                              Activar
                            </button>
                          ) : (
                            <span className="text-xs text-[#1ed760] font-bold px-2">Activa</span>
                          )}

                          <button
                            onClick={() => {
                              removeSavedAccount(account.id);
                              setSavedAccounts(getSavedAccounts());
                            }}
                            className="w-7 h-7 rounded-full text-[#727272] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                            title="Eliminar cuenta"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="pt-2 border-t border-[#282828] flex items-center justify-between">
                <button
                  onClick={() => setActiveTab('cookie')}
                  className="text-xs text-white hover:underline flex items-center gap-1 font-bold"
                >
                  <span>+</span>
                  <span>Añadir otra cuenta</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
