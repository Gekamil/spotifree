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

export const LoginModal: React.FC = () => {
  const { isLoginModalOpen, closeLoginModal } = useUIStore();
  const { initialize } = useSpotifyDataStore();

  const [activeTab, setActiveTab] = useState<'cookie' | 'credentials'>('cookie');
  const [cookieInput, setCookieInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
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

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setCookieInput(text.trim());
      }
    } catch {
      // Fallback
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

      // Save to multi-account storage
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
      }, 1200);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al conectar con Spotify.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginWithCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim() || !passwordInput.trim()) {
      setErrorMessage('Introduce tu usuario/correo y contraseña.');
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
        if (data.needsCookie) {
          setActiveTab('cookie');
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
        }, 1200);
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

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in duration-200">
      <div className="bg-[#181818] w-full max-w-lg rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col font-['SpotifyMixUI']">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex items-center justify-between border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#1ed760] flex items-center justify-center shadow">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="black">
                <path d="M12 2C6.477 2 2 6.477 2 12c0 5.524 4.477 10 10 10s10-4.476 10-10c0-5.523-4.477-10-10-10zm4.586 14.424c-.18.295-.563.387-.857.207-2.35-1.435-5.308-1.76-8.793-.963-.335.077-.67-.133-.746-.468-.077-.334.132-.67.467-.746 3.808-.87 7.076-.496 9.722 1.115.294.18.386.563.207.855zm1.226-2.72c-.226.367-.706.482-1.072.257-2.687-1.652-6.785-2.131-9.965-1.166-.413.127-.848-.106-.973-.518-.125-.413.108-.848.52-.973 3.632-1.102 8.147-.568 11.233 1.328.366.226.481.707.257 1.072zm.105-2.835C14.692 8.95 9.375 8.775 6.297 9.71c-.494.15-1.018-.13-1.168-.624-.15-.494.13-1.018.624-1.168 3.532-1.073 9.404-.866 13.115 1.337.445.264.59.838.327 1.282-.264.443-.838.59-1.28.327z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-black text-white font-['SpotifyMixUITitle']">
                Conectar con Spotify
              </h2>
              <p className="text-xs text-[#b3b3b3]">
                Accede a tus playlists, tus canciones favoritas y tu feed real
              </p>
            </div>
          </div>
          <button
            onClick={closeLoginModal}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-[#b3b3b3] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Cerrar"
          >
            ✕
          </button>
        </div>

        {/* Tab switchers */}
        <div className="flex border-b border-white/5 bg-[#121212]/60 px-6 pt-2">
          <button
            onClick={() => setActiveTab('cookie')}
            className={`pb-3 px-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'cookie'
                ? 'border-[#1ed760] text-white'
                : 'border-transparent text-[#a7a7a7] hover:text-white'
            }`}
          >
            Conexión con Cookie (sp_dc)
          </button>
          <button
            onClick={() => setActiveTab('credentials')}
            className={`pb-3 px-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'credentials'
                ? 'border-[#1ed760] text-white'
                : 'border-transparent text-[#a7a7a7] hover:text-white'
            }`}
          >
            Extracción automática
          </button>
        </div>

        {/* Body content */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[60vh]">
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
                <label className="text-xs font-bold text-white block">
                  Cookie de Spotify (sp_dc)
                </label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={cookieInput}
                    onChange={(e) => setCookieInput(e.target.value)}
                    placeholder="Pega aquí tu cookie sp_dc..."
                    className="flex-1 h-11 px-3.5 rounded-xl bg-[#242424] text-white text-xs border border-white/10 focus:border-[#1ed760] outline-none transition-colors font-mono"
                  />
                  <button
                    type="button"
                    onClick={handlePasteClipboard}
                    className="px-3.5 h-11 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-colors shrink-0 cursor-pointer"
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
                className="w-full h-11 rounded-full bg-[#1ed760] hover:bg-[#1fdf64] hover:scale-102 active:scale-98 text-black font-black text-sm uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer shadow-lg flex items-center justify-center gap-2"
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

              {/* Step-by-Step visual instructions */}
              <div className="p-4 rounded-xl bg-[#121212] border border-white/5 space-y-2.5 text-xs text-[#a7a7a7]">
                <p className="font-bold text-white">¿Cómo conseguir tu cookie sp_dc en 10 segundos?</p>
                <ol className="list-decimal list-inside space-y-1 leading-relaxed">
                  <li>Inicia sesión en <a href="https://open.spotify.com" target="_blank" rel="noreferrer" className="text-[#1ed760] underline">open.spotify.com</a> en Chrome o Firefox.</li>
                  <li>Pulsa <kbd className="bg-white/10 px-1 py-0.5 rounded text-white">F12</kbd> (o clic derecho ➔ Inspeccionar).</li>
                  <li>Ve a la pestaña <strong>Aplicación</strong> (Application) ➔ <strong>Cookies</strong> ➔ <strong>https://open.spotify.com</strong>.</li>
                  <li>Copia el valor de la cookie <strong>sp_dc</strong> y pégalo arriba.</li>
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

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 rounded-full bg-[#1ed760] hover:bg-[#1fdf64] hover:scale-102 active:scale-98 text-black font-black text-sm uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer shadow-lg flex items-center justify-center gap-2 mt-2"
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
                Tus credenciales viajan de forma segura y cifrada para capturar la sesión de Spotify. No almacenamos tus contraseñas.
              </p>
            </form>
          )}

          {/* Multi-account Switcher Section */}
          {savedAccounts.length > 0 && (
            <div className="pt-3 border-t border-white/10 space-y-2.5">
              <span className="text-xs font-bold text-white uppercase tracking-wider block">
                Cuentas guardadas en este dispositivo
              </span>
              <div className="space-y-1.5">
                {savedAccounts.map((acc) => (
                  <div
                    key={acc.id}
                    onClick={() => handleSwitchAccount(acc)}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-[#242424] hover:bg-[#2e2e2e] transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {acc.avatarUrl ? (
                        <img
                          src={acc.avatarUrl}
                          alt={acc.displayName}
                          className="w-8 h-8 rounded-full object-cover shadow"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-[#ff6437] text-black font-bold text-xs flex items-center justify-center shadow">
                          {acc.displayName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-white text-xs truncate">
                          {acc.displayName}
                        </span>
                        {acc.email && (
                          <span className="text-[11px] text-[#a7a7a7] truncate">
                            {acc.email}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-[11px] font-bold text-[#1ed760] opacity-0 group-hover:opacity-100 transition-opacity">
                      Cambiar ➔
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
