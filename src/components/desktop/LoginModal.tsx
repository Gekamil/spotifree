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
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1ed760] to-[#148A08] text-black font-black text-sm flex items-center justify-center shadow shrink-0">
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
      className="w-10 h-10 rounded-full object-cover shadow shrink-0"
    />
  );
};

export const LoginModal: React.FC = () => {
  const { isLoginModalOpen, closeLoginModal } = useUIStore();
  const { initialize, user } = useSpotifyDataStore();

  const [activeTab, setActiveTab] = useState<'connect' | 'saved'>('connect');
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
        setActiveTab('connect');
      }
    }
  }, [isLoginModalOpen]);

  if (!isLoginModalOpen) return null;

  const handlePasteClipboard = async () => {
    try {
      if (navigator?.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          const cleaned = cleanSpDc(text);
          setCookieInput(cleaned);
        }
      }
    } catch {}
  };

  const handleConnectWithCookie = async (targetCookie?: string) => {
    const raw = (targetCookie || cookieInput).trim();
    const cookie = cleanSpDc(raw);

    if (!cookie) {
      setErrorMessage('Por favor, introduce o pega la clave de sesión.');
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

      setSuccessMessage(`Conectado como ${data.user?.display_name || 'Usuario'} con éxito.`);
      await initialize();
      setSavedAccounts(getSavedAccounts());

      setTimeout(() => {
        closeLoginModal();
      }, 900);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al conectar la cuenta de Spotify.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in duration-200">
      <div className="bg-[#121212] w-full max-w-[440px] rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col font-['SpotifyMixUI'] relative">
        {/* Close Button top-right */}
        <button
          onClick={closeLoginModal}
          className="absolute right-4 top-4 w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 text-[#b3b3b3] hover:text-white flex items-center justify-center transition-colors cursor-pointer z-10"
          title="Cerrar"
        >
          ✕
        </button>

        {/* Modal Header */}
        <div className="p-6 pb-4 flex flex-col items-center border-b border-white/5">
          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center mb-3 shadow-md">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="black">
              <path d="M12 2C6.477 2 2 6.477 2 12c0 5.524 4.477 10 10 10s10-4.476 10-10c0-5.523-4.477-10-10-10zm4.586 14.424c-.18.295-.563.387-.857.207-2.35-1.435-5.308-1.76-8.793-.963-.335.077-.67-.133-.746-.468-.077-.334.132-.67.467-.746 3.808-.87 7.076-.496 9.722 1.115.294.18.386.563.207.855zm1.226-2.72c-.226.367-.706.482-1.072.257-2.687-1.652-6.785-2.131-9.965-1.166-.413.127-.848-.106-.973-.518-.125-.413.108-.848.52-.973 3.632-1.102 8.147-.568 11.233 1.328.366.226.481.707.257 1.072zm.105-2.835C14.692 8.95 9.375 8.775 6.297 9.71c-.494.15-1.018-.13-1.168-.624-.15-.494.13-1.018.624-1.168 3.532-1.073 9.404-.866 13.115 1.337.445.264.59.838.327 1.282-.264.443-.838.59-1.28.327z" />
            </svg>
          </div>

          <h1 className="text-2xl font-black text-white font-['SpotifyMixUITitle'] text-center tracking-tight">
            Vincular cuenta de Spotify
          </h1>

          {/* Navigation Tabs */}
          <div className="flex gap-2 mt-4 bg-white/5 p-1 rounded-full border border-white/10 w-full">
            <button
              onClick={() => setActiveTab('connect')}
              className={`flex-1 py-1.5 rounded-full text-xs font-bold transition-all ${
                activeTab === 'connect'
                  ? 'bg-white text-black shadow'
                  : 'text-[#b3b3b3] hover:text-white'
              }`}
            >
              Conectar cuenta
            </button>
            <button
              onClick={() => setActiveTab('saved')}
              className={`flex-1 py-1.5 rounded-full text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'saved'
                  ? 'bg-white text-black shadow'
                  : 'text-[#b3b3b3] hover:text-white'
              }`}
            >
              <span>Cuentas guardadas</span>
              {savedAccounts.length > 0 && (
                <span className="w-4 h-4 rounded-full bg-[#1ed760] text-black text-[10px] flex items-center justify-center font-black">
                  {savedAccounts.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          {/* Alerts */}
          {errorMessage && (
            <div className="p-3 bg-red-500/15 border border-red-500/30 rounded-xl text-red-200 text-xs">
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-emerald-200 text-xs font-semibold">
              {successMessage}
            </div>
          )}

          {/* TAB 1: CONNECT NEW ACCOUNT */}
          {activeTab === 'connect' && (
            <div className="space-y-4">
              <div className="bg-[#181818] rounded-xl p-3.5 border border-white/5 space-y-2">
                <span className="text-xs font-bold text-white block">
                  Paso 1: Inicia sesión en Spotify
                </span>
                <p className="text-[11px] text-[#b3b3b3] leading-relaxed">
                  Si ya tienes tu sesión abierta (como en Spotify Web), puedes vincularla directamente abajo. Si no, abre Spotify para iniciar sesión:
                </p>
                <button
                  type="button"
                  onClick={() => window.open('https://open.spotify.com', '_blank')}
                  className="inline-flex items-center gap-1.5 text-xs text-[#1ed760] hover:underline font-bold"
                >
                  <span>Abrir Spotify en otra pestaña</span>
                  <span>↗</span>
                </button>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white block">
                    Paso 2: Pega la clave de sesión (sp_dc)
                  </label>
                  <button
                    type="button"
                    onClick={handlePasteClipboard}
                    className="text-[11px] text-[#1ed760] hover:underline font-bold cursor-pointer"
                  >
                    Pegar del portapapeles
                  </button>
                </div>

                <input
                  type="password"
                  value={cookieInput}
                  onChange={(e) => setCookieInput(e.target.value)}
                  placeholder="AQD... (o la línea de cookies copiada)"
                  className="w-full h-11 px-3.5 rounded-lg bg-[#242424] text-white text-xs border border-white/10 focus:border-[#1ed760] outline-none font-mono placeholder:text-[#535353]"
                />
              </div>

              <button
                type="button"
                onClick={() => handleConnectWithCookie()}
                disabled={isLoading || !cookieInput.trim()}
                className="w-full h-12 rounded-full bg-[#1ed760] hover:bg-[#1fdf64] hover:scale-102 active:scale-98 text-black font-bold text-sm transition-all disabled:opacity-40 cursor-pointer shadow-lg flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    <span>Sincronizando cuenta...</span>
                  </>
                ) : (
                  <span>Vincular cuenta con Spotifree</span>
                )}
              </button>

              {/* Help accordion */}
              <div className="pt-2 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setShowHelpGuide(!showHelpGuide)}
                  className="text-xs text-[#a7a7a7] hover:text-white transition-colors cursor-pointer flex items-center justify-between w-full"
                >
                  <span>¿Cómo obtener la clave sp_dc en 10 segundos?</span>
                  <span>{showHelpGuide ? '▲' : '▼'}</span>
                </button>

                {showHelpGuide && (
                  <div className="mt-2.5 p-3 rounded-lg bg-[#181818] text-[11px] text-[#b3b3b3] space-y-1.5 leading-relaxed">
                    <p>1. En tu pestaña de Spotify donde ya iniciaste sesión, pulsa <strong>F12</strong> (o clic derecho → Inspeccionar).</p>
                    <p>2. Ve a la pestaña <strong>Aplicación</strong> (o <em>Almacenamiento</em>) → <strong>Cookies</strong> → <strong>https://open.spotify.com</strong>.</p>
                    <p>3. Busca la fila llamada <strong>sp_dc</strong>, haz doble clic en su valor, cópialo y pégalo arriba.</p>
                    <p className="text-[#1ed760]">¡Solo se hace una vez! La cuenta quedará guardada en tu dispositivo para siempre.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: SAVED ACCOUNTS */}
          {activeTab === 'saved' && (
            <div className="space-y-3">
              {savedAccounts.length === 0 ? (
                <div className="py-8 text-center space-y-3">
                  <p className="text-xs text-[#b3b3b3]">
                    No hay cuentas guardadas en este navegador todavía.
                  </p>
                  <button
                    onClick={() => setActiveTab('connect')}
                    className="px-4 py-2 rounded-full bg-white text-black font-bold text-xs hover:scale-105 active:scale-95 transition-transform"
                  >
                    Vincular primera cuenta
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-xs text-[#b3b3b3]">
                    Toca en cualquier cuenta para entrar al instante sin contraseñas:
                  </p>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {savedAccounts.map((acc) => {
                      const isActive = user?.id === acc.id;
                      return (
                        <div
                          key={acc.id}
                          onClick={() => handleConnectWithCookie(acc.cookie)}
                          className="flex items-center justify-between p-3 rounded-xl bg-[#181818] hover:bg-[#242424] transition-colors cursor-pointer group border border-white/5"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <AccountAvatar url={acc.avatarUrl} name={acc.displayName} />
                            <div className="flex flex-col min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white text-sm truncate">
                                  {acc.displayName}
                                </span>
                                {isActive && (
                                  <span className="px-2 py-0.5 rounded-full bg-[#1ed760]/20 text-[#1ed760] text-[10px] font-bold">
                                    En uso
                                  </span>
                                )}
                              </div>
                              {acc.email && (
                                <span className="text-xs text-[#a7a7a7] truncate">
                                  {acc.email}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeSavedAccount(acc.id);
                                setSavedAccounts(getSavedAccounts());
                              }}
                              className="w-7 h-7 rounded-full hover:bg-white/10 text-[#727272] hover:text-red-400 flex items-center justify-center transition-colors text-xs"
                              title="Eliminar cuenta"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => setActiveTab('connect')}
                    className="w-full py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-colors"
                  >
                    + Vincular otra cuenta
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
