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
    const list = getSavedAccounts().filter(
      (a) => a.id !== account.id && a.cookie !== account.cookie && a.email !== account.email
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

  const [activeTab, setActiveTab] = useState<'login' | 'cookie' | 'saved'>('login');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [needs2FA, setNeeds2FA] = useState(false);

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
      setNeeds2FA(false);
      setTwoFactorCode('');
      if (accounts.length > 0 && !emailInput && !cookieInput) {
        setActiveTab('saved');
      } else {
        setActiveTab('login');
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

  const handleEmailLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const email = emailInput.trim();
    const password = passwordInput;

    if (!email || !password) {
      setErrorMessage('Por favor, introduce tu correo y contraseña de Spotify.');
      return;
    }

    if (needs2FA && !twoFactorCode.trim()) {
      setErrorMessage('Por favor, introduce el código de verificación de 6 cifras recibido.');
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
          email,
          password,
          twoFactorCode: needs2FA ? twoFactorCode.trim() : undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (data.needs2FA) {
          setNeeds2FA(true);
          setErrorMessage(data.error || 'Se requiere el código de verificación.');
        } else {
          setErrorMessage(data.error || 'Error al iniciar sesión en Spotify.');
        }
        setIsLoading(false);
        return;
      }

      if (data.needs2FA) {
        setNeeds2FA(true);
        setSuccessMessage(data.message || 'Código de seguridad solicitado. Introduce los 6 números abajo.');
        setIsLoading(false);
        return;
      }

      if (data.cookie) {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('user_spotify_cookie', data.cookie);
          if (data.user?.id) {
            window.localStorage.setItem('spotifree_active_user_id', data.user.id);
          }
          if (data.accessToken) {
            window.localStorage.setItem('spotify_access_token', data.accessToken);
          }
          window.localStorage.removeItem('spotify_extracted_session');
        }

        saveAccount({
          id: data.user?.id || `user-${Date.now()}`,
          displayName: data.user?.display_name || email.split('@')[0],
          email: email,
          avatarUrl: data.user?.images?.[0]?.url,
          cookie: data.cookie,
          accessToken: data.accessToken,
          lastUsed: Date.now(),
        });

        setSuccessMessage(`Sesión iniciada como ${data.user?.display_name || email} con éxito.`);
        await initialize();
        setSavedAccounts(getSavedAccounts());

        setTimeout(() => {
          closeLoginModal();
        }, 900);
      } else {
        throw new Error('No se pudo extraer la sesión de Spotify. Intenta con tu clave sp_dc.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error de conexión con Spotify.');
    } finally {
      setIsLoading(false);
    }
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
        window.localStorage.setItem('spotify_extracted_session', JSON.stringify({ ...data, _cookie: cookie }));
        if (data.user?.id) {
          window.localStorage.setItem('spotifree_active_user_id', data.user.id);
        }
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
      }, 700);
    } catch (err: any) {
      setErrorMessage('Error al cambiar de cuenta.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in duration-200">
      <div className="bg-[#121212] w-full max-w-[440px] rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col font-['SpotifyMixUI'] relative max-h-[92vh] overflow-y-auto">
        {/* Close Button top-right */}
        <button
          onClick={closeLoginModal}
          className="absolute right-4 top-4 w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 text-[#b3b3b3] hover:text-white flex items-center justify-center transition-colors cursor-pointer z-10"
          title="Cerrar"
        >
          ✕
        </button>

        {/* Modal Header */}
        <div className="p-6 pb-3 flex flex-col items-center border-b border-white/5">
          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center mb-3 shadow-md">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="black">
              <path d="M12 2C6.477 2 2 6.477 2 12c0 5.524 4.477 10 10 10s10-4.476 10-10c0-5.523-4.477-10-10-10zm4.586 14.424c-.18.295-.563.387-.857.207-2.35-1.435-5.308-1.76-8.793-.963-.335.077-.67-.133-.746-.468-.077-.334.132-.67.467-.746 3.808-.87 7.076-.496 9.722 1.115.294.18.386.563.207.855zm1.226-2.72c-.226.367-.706.482-1.072.257-2.687-1.652-6.785-2.131-9.965-1.166-.413.127-.848-.106-.973-.518-.125-.413.108-.848.52-.973 3.632-1.102 8.147-.568 11.233 1.328.366.226.481.707.257 1.072zm.105-2.835C14.692 8.95 9.375 8.775 6.297 9.71c-.494.15-1.018-.13-1.168-.624-.15-.494.13-1.018.624-1.168 3.532-1.073 9.404-.866 13.115 1.337.445.264.59.838.327 1.282-.264.443-.838.59-1.28.327z" />
            </svg>
          </div>

          <h1 className="text-xl lg:text-2xl font-black text-white font-['SpotifyMixUITitle'] text-center tracking-tight">
            Iniciar sesión en Spotify
          </h1>

          {/* Navigation Tabs */}
          <div className="flex gap-1.5 mt-4 bg-white/5 p-1 rounded-full border border-white/10 w-full text-xs">
            <button
              onClick={() => {
                setActiveTab('login');
                setErrorMessage(null);
              }}
              className={`flex-1 py-1.5 rounded-full font-bold transition-all ${
                activeTab === 'login'
                  ? 'bg-white text-black shadow'
                  : 'text-[#b3b3b3] hover:text-white'
              }`}
            >
              Cuenta
            </button>
            <button
              onClick={() => {
                setActiveTab('cookie');
                setErrorMessage(null);
              }}
              className={`flex-1 py-1.5 rounded-full font-bold transition-all ${
                activeTab === 'cookie'
                  ? 'bg-white text-black shadow'
                  : 'text-[#b3b3b3] hover:text-white'
              }`}
            >
              Clave sp_dc
            </button>
            <button
              onClick={() => {
                setActiveTab('saved');
                setErrorMessage(null);
              }}
              className={`flex-1 py-1.5 rounded-full font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'saved'
                  ? 'bg-white text-black shadow'
                  : 'text-[#b3b3b3] hover:text-white'
              }`}
            >
              <span>Guardadas</span>
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
            <div className="p-3 bg-red-500/15 border border-red-500/30 rounded-xl text-red-200 text-xs leading-relaxed">
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-emerald-200 text-xs font-semibold leading-relaxed">
              {successMessage}
            </div>
          )}

          {/* TAB 1: EMAIL & PASSWORD LOGIN (+ 2FA Verification) */}
          {activeTab === 'login' && (
            <form onSubmit={handleEmailLogin} className="space-y-3.5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-white block">
                  Correo o usuario de Spotify
                </label>
                <input
                  type="text"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="ejemplo@correo.com"
                  required
                  className="w-full h-11 px-3.5 rounded-lg bg-[#242424] text-white text-xs border border-white/10 focus:border-[#1ed760] outline-none placeholder:text-[#606060]"
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
                  placeholder="••••••••"
                  required
                  className="w-full h-11 px-3.5 rounded-lg bg-[#242424] text-white text-xs border border-white/10 focus:border-[#1ed760] outline-none placeholder:text-[#606060]"
                />
              </div>

              {/* 2FA Input (Dynamically shown if Spotify requires 2-step verification) */}
              {needs2FA && (
                <div className="p-3.5 rounded-xl bg-white/5 border border-[#1ed760]/30 space-y-2 animate-in fade-in duration-300">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#1ed760] animate-ping" />
                    <label className="text-xs font-bold text-[#1ed760] block">
                      Código de verificación (6 cifras)
                    </label>
                  </div>
                  <p className="text-[11px] text-[#b3b3b3] leading-relaxed">
                    Introduce el código de 6 números que te acaba de enviar Spotify para autorizar tu inicio de sesión:
                  </p>
                  <input
                    type="text"
                    maxLength={6}
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    autoFocus
                    className="w-full h-12 px-3.5 rounded-lg bg-[#181818] text-white text-center text-lg font-mono tracking-[0.35em] border border-[#1ed760] outline-none font-bold placeholder:text-[#535353]"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || !emailInput.trim() || !passwordInput.trim() || (needs2FA && twoFactorCode.trim().length !== 6)}
                className="w-full h-12 rounded-full bg-[#1ed760] hover:bg-[#1fdf64] hover:scale-102 active:scale-98 text-black font-bold text-sm transition-all disabled:opacity-40 cursor-pointer shadow-lg flex items-center justify-center gap-2 mt-4"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    <span>Conectando con Spotify...</span>
                  </>
                ) : needs2FA ? (
                  <span>Verificar código y entrar</span>
                ) : (
                  <span>Iniciar sesión en Spotifree</span>
                )}
              </button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => setActiveTab('cookie')}
                  className="text-xs text-[#a7a7a7] hover:text-[#1ed760] hover:underline transition-colors"
                >
                  ¿Prefieres conectar con tu clave de sesión sp_dc? Haz clic aquí
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: SP_DC COOKIE KEY */}
          {activeTab === 'cookie' && (
            <div className="space-y-4">
              <div className="bg-[#181818] rounded-xl p-3.5 border border-white/5 space-y-2">
                <span className="text-xs font-bold text-white block">
                  Conexión directa con cookie de sesión
                </span>
                <p className="text-[11px] text-[#b3b3b3] leading-relaxed">
                  Pega el valor de tu cookie <strong>sp_dc</strong> para transferir tu sesión completa de forma inmediata.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white block">
                    Clave de sesión (sp_dc)
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
                  placeholder="AQD... (o la línea sp_dc copiada)"
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
                  <span>Vincular cuenta</span>
                )}
              </button>

              {/* Help guide */}
              <div className="pt-2 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setShowHelpGuide(!showHelpGuide)}
                  className="text-xs text-[#a7a7a7] hover:text-white transition-colors cursor-pointer flex items-center justify-between w-full"
                >
                  <span>¿Dónde encontrar la clave sp_dc?</span>
                  <span>{showHelpGuide ? '▲' : '▼'}</span>
                </button>

                {showHelpGuide && (
                  <div className="mt-2.5 p-3 rounded-lg bg-[#181818] text-[11px] text-[#b3b3b3] space-y-1.5 leading-relaxed">
                    <p>1. En tu navegador donde tengas abierto Spotify, pulsa <strong>F12</strong> (Inspeccionar elemento).</p>
                    <p>2. En la pestaña <strong>Aplicación</strong> / <strong>Almacenamiento</strong> → <strong>Cookies</strong> → <strong>https://open.spotify.com</strong>.</p>
                    <p>3. Busca el nombre <strong>sp_dc</strong>, copia su valor y pégalo arriba.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: SAVED ACCOUNTS */}
          {activeTab === 'saved' && (
            <div className="space-y-3">
              {savedAccounts.length === 0 ? (
                <div className="py-8 text-center text-[#b3b3b3] space-y-2">
                  <p className="text-xs">No hay cuentas guardadas en este dispositivo.</p>
                  <button
                    onClick={() => setActiveTab('login')}
                    className="text-xs text-[#1ed760] font-bold hover:underline"
                  >
                    Iniciar sesión con una cuenta
                  </button>
                </div>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {savedAccounts.map((account) => {
                    const isCurrent = user?.id === account.id || user?.display_name === account.displayName;
                    return (
                      <div
                        key={account.id}
                        className={`p-3 rounded-xl flex items-center justify-between transition-all ${
                          isCurrent
                            ? 'bg-[#1ed760]/10 border border-[#1ed760]/30'
                            : 'bg-white/5 hover:bg-white/10 border border-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 pr-2">
                          <AccountAvatar url={account.avatarUrl} name={account.displayName} />
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-white text-xs truncate">
                                {account.displayName}
                              </span>
                              {isCurrent && (
                                <span className="text-[10px] bg-[#1ed760] text-black font-black px-1.5 py-0.5 rounded-full">
                                  ACTIVA
                                </span>
                              )}
                            </div>
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
                              className="px-3 py-1.5 rounded-full bg-white hover:bg-white/90 text-black text-xs font-bold transition-transform active:scale-95 cursor-pointer"
                            >
                              Activar
                            </button>
                          ) : (
                            <span className="text-xs text-[#1ed760] font-bold px-2">En uso</span>
                          )}

                          <button
                            onClick={() => {
                              removeSavedAccount(account.id);
                              setSavedAccounts(getSavedAccounts());
                            }}
                            className="w-7 h-7 rounded-full hover:bg-white/10 text-[#727272] hover:text-red-400 flex items-center justify-center transition-colors cursor-pointer"
                            title="Eliminar cuenta guardada"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                <button
                  onClick={() => setActiveTab('login')}
                  className="text-xs text-[#1ed760] font-bold hover:underline flex items-center gap-1"
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
