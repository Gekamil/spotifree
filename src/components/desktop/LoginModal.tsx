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

  const [activeTab, setActiveTab] = useState<'cookie' | 'login' | 'saved'>('cookie');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');

  const [cookieInput, setCookieInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const [showHelpGuide, setShowHelpGuide] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  useEffect(() => {
    if (isLoginModalOpen) {
      const accounts = getSavedAccounts();
      setSavedAccounts(accounts);
      setErrorMessage(null);
      setSuccessMessage(null);
      if (accounts.length > 0 && !emailInput && !cookieInput) {
        setActiveTab('saved');
      } else {
        setActiveTab('cookie');
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
          if (cleaned.startsWith('AQ') && cleaned.length >= 50) {
            setSuccessMessage('Clave detectada en el portapapeles. Conectando...');
            handleConnectWithCookie(cleaned);
            return;
          }
        }
      }
      setErrorMessage('No se detectó una clave sp_dc válida en el portapapeles. Pégala directamente en el recuadro.');
    } catch {
      setErrorMessage('No se pudo acceder al portapapeles del navegador. Pega la clave manualmente en el recuadro.');
    }
  };

  const handleCopySnippet = () => {
    const code = "copy(document.cookie.match(/sp_dc=([^;]+)/)?.[1])";
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(code);
      setCopiedSnippet(true);
      setTimeout(() => setCopiedSnippet(false), 2500);
    }
  };

  const handleEmailLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const email = emailInput.trim();
    const password = passwordInput;

    if (!email || !password) {
      setErrorMessage('Por favor, introduce tu correo y contraseña de Spotify.');
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
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        setErrorMessage(
          data.error ||
            'Spotify requiere comprobación de seguridad en el navegador (reCAPTCHA) y no enviará correos de verificación a conexiones automatizadas. Usa tu Clave sp_dc para acceder al instante.'
        );
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
      setErrorMessage('Por favor, introduce o pega la clave de sesión sp_dc.');
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
      <div className="bg-[#121212] w-full max-w-[450px] rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col font-['SpotifyMixUI'] relative max-h-[92vh] overflow-y-auto">
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
                setActiveTab('cookie');
                setErrorMessage(null);
              }}
              className={`flex-1 py-1.5 rounded-full font-bold transition-all flex items-center justify-center gap-1 ${
                activeTab === 'cookie'
                  ? 'bg-white text-black shadow'
                  : 'text-[#b3b3b3] hover:text-white'
              }`}
            >
              <span>Clave sp_dc</span>
              <span className="text-[10px] bg-[#1ed760] text-black font-black px-1.5 rounded-full">✓</span>
            </button>
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
            <div className="p-3.5 bg-red-500/15 border border-red-500/30 rounded-xl text-red-200 text-xs leading-relaxed space-y-2">
              <p>{errorMessage}</p>
              {activeTab === 'login' && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('cookie');
                    setErrorMessage(null);
                  }}
                  className="px-3 py-1.5 rounded-full bg-white text-black font-bold text-xs hover:bg-[#1ed760] transition-colors"
                >
                  👉 Usar Clave sp_dc (Acceso directo en 3s)
                </button>
              )}
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-emerald-200 text-xs font-semibold leading-relaxed">
              {successMessage}
            </div>
          )}

          {/* TAB 1: SP_DC COOKIE KEY (FASTEST & 100% RELIABLE) */}
          {activeTab === 'cookie' && (
            <div className="space-y-4">
              <div className="bg-[#181818] rounded-xl p-3.5 border border-white/5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#1ed760] flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#1ed760]" />
                    Método Rápido 100% Funcional
                  </span>
                  <span className="text-[10px] bg-white/10 text-white px-2 py-0.5 rounded-full font-bold">
                    Sin códigos ni captchas
                  </span>
                </div>
                <p className="text-[11px] text-[#b3b3b3] leading-relaxed">
                  Pega tu clave <strong>sp_dc</strong> para transferir tu sesión completa de Spotify en 1 segundo con tu perfil, listas y canciones reales.
                </p>
              </div>

              {/* 1-Click Paste & Connect */}
              <button
                type="button"
                onClick={handlePasteClipboard}
                className="w-full py-3 px-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all hover:scale-101 active:scale-98 cursor-pointer"
              >
                <span className="text-base">📋</span>
                <span>Pegar clave desde portapapeles y entrar</span>
              </button>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white block">
                    O introduce la clave manualmente (sp_dc)
                  </label>
                  {cookieInput && (
                    <button
                      type="button"
                      onClick={() => setCookieInput('')}
                      className="text-[10px] text-[#b3b3b3] hover:text-white"
                    >
                      Limpiar
                    </button>
                  )}
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
                    <span>Sincronizando cuenta con Spotify...</span>
                  </>
                ) : (
                  <span>Conectar sesión</span>
                )}
              </button>

              {/* Step-by-step Quick Help */}
              <div className="pt-2 border-t border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">¿Cómo obtener tu clave en 5 segundos?</span>
                  <button
                    type="button"
                    onClick={() => setShowHelpGuide(!showHelpGuide)}
                    className="text-xs text-[#1ed760] hover:underline"
                  >
                    {showHelpGuide ? 'Ocultar guía' : 'Ver opciones'}
                  </button>
                </div>

                {showHelpGuide && (
                  <div className="p-3.5 rounded-xl bg-[#181818] border border-white/5 space-y-3 text-xs text-[#b3b3b3] leading-relaxed">
                    {/* Option 1: Direct Web Link */}
                    <div className="space-y-1">
                      <span className="font-bold text-white flex items-center gap-1.5">
                        <span>Opción 1:</span> Abrir Spotify Web
                      </span>
                      <p className="text-[11px]">
                        Abre Spotify en tu navegador donde ya tienes tu sesión iniciada:
                      </p>
                      <a
                        href="https://open.spotify.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-[#1ed760] font-bold hover:underline mt-1"
                      >
                        <span>Abrir open.spotify.com</span>
                        <span>↗</span>
                      </a>
                    </div>

                    {/* Option 2: 1-Line Console Script */}
                    <div className="space-y-1 pt-2 border-t border-white/5">
                      <span className="font-bold text-white flex items-center gap-1.5">
                        <span>Opción 2:</span> Comando automático de 1 clic (F12)
                      </span>
                      <p className="text-[11px]">
                        En la pestaña de Spotify, pulsa <strong>F12</strong>, ve a <strong>Consola</strong>, pega este comando y pulsa Enter (tu clave se copiará sola):
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="bg-black/60 p-2 rounded-lg font-mono text-[10px] text-white flex-1 truncate">
                          copy(document.cookie.match(/sp_dc=([^;]+)/)?.[1])
                        </code>
                        <button
                          type="button"
                          onClick={handleCopySnippet}
                          className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold shrink-0"
                        >
                          {copiedSnippet ? '✓ Copiado' : 'Copiar'}
                        </button>
                      </div>
                    </div>

                    {/* Option 3: Manual F12 inspection */}
                    <div className="space-y-1 pt-2 border-t border-white/5">
                      <span className="font-bold text-white flex items-center gap-1.5">
                        <span>Opción 3:</span> Manual desde Cookies
                      </span>
                      <p className="text-[11px]">
                        F12 → Pestaña <strong>Aplicación</strong> (Application) → <strong>Cookies</strong> → <code>https://open.spotify.com</code> → Copia el valor de <strong>sp_dc</strong>.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: EMAIL & PASSWORD LOGIN */}
          {activeTab === 'login' && (
            <form onSubmit={handleEmailLogin} className="space-y-3.5">
              <div className="p-3 bg-white/5 border border-white/10 rounded-xl text-[11px] text-[#b3b3b3] space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-white">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="#1ed760">
                    <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0m.75 4.5v5h-1.5v-5zm0 6.5v1.5h-1.5V11z"/>
                  </svg>
                  <span>Aviso sobre acceso por contraseña</span>
                </div>
                <p>
                  Spotify bloquea los correos de verificación automáticos mediante reCAPTCHA. Para entrar en 3 segundos sin esperas ni códigos que nunca llegan, recomendamos usar la pestaña <strong>«Clave sp_dc»</strong>.
                </p>
              </div>

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

              <button
                type="submit"
                disabled={isLoading || !emailInput.trim() || !passwordInput.trim()}
                className="w-full h-12 rounded-full bg-[#1ed760] hover:bg-[#1fdf64] hover:scale-102 active:scale-98 text-black font-bold text-sm transition-all disabled:opacity-40 cursor-pointer shadow-lg flex items-center justify-center gap-2 mt-4"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    <span>Conectando con Spotify...</span>
                  </>
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

          {/* TAB 3: SAVED ACCOUNTS */}
          {activeTab === 'saved' && (
            <div className="space-y-3">
              {savedAccounts.length === 0 ? (
                <div className="py-8 text-center text-[#b3b3b3] space-y-2">
                  <p className="text-xs">No hay cuentas guardadas en este dispositivo.</p>
                  <button
                    onClick={() => setActiveTab('cookie')}
                    className="text-xs text-[#1ed760] font-bold hover:underline"
                  >
                    Vincular una cuenta con sp_dc
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
                  onClick={() => setActiveTab('cookie')}
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
