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
  const { initialize } = useSpotifyDataStore();

  const [step, setStep] = useState<'identifier' | 'password' | 'verification'>('identifier');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [cookieInput, setCookieInput] = useState('');
  const [verificationTab, setVerificationTab] = useState<'cookie' | 'code'>('cookie');
  const [rememberMe, setRememberMe] = useState(true);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);

  useEffect(() => {
    if (isLoginModalOpen) {
      setSavedAccounts(getSavedAccounts());
      setErrorMessage(null);
      setSuccessMessage(null);
      setStep('identifier');
      setPasswordInput('');
      setVerificationCode('');
      const activeCookie = typeof window !== 'undefined' ? window.localStorage.getItem('user_spotify_cookie') || '' : '';
      setCookieInput(activeCookie);
    }
  }, [isLoginModalOpen]);

  if (!isLoginModalOpen) return null;

  // Step 1: Continue to password without redirecting out of the app
  const handleContinueIdentifier = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = emailInput.trim();
    if (!clean) {
      setErrorMessage('Por favor, introduce tu correo o nombre de usuario.');
      return;
    }
    setErrorMessage(null);
    setStep('password');
  };

  // Step 2: Submit password to /api/login
  const handleLoginWithPassword = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!passwordInput.trim()) {
      setErrorMessage('Por favor, introduce tu contraseña.');
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

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success && data.cookie) {
        // Direct successful login with extracted cookie
        await handleSuccessfulSession(data.cookie, data);
        return;
      }

      if (data.needs2FA || data.needsCookie || !res.ok) {
        // Spotify asks for 2FA verification or sp_dc session cookie
        setStep('verification');
        setVerificationTab('cookie');
        setErrorMessage(
          data.error ||
            'Spotify requiere verificación de seguridad o tu cookie sp_dc para conectar sin bloqueos.'
        );
        return;
      }

      throw new Error(data.error || 'No se pudo iniciar sesión con Spotify.');
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al conectar con Spotify.');
      setStep('verification');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3A: Submit 6-digit verification code
  const handleVerify2FACode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanCode = verificationCode.trim();
    if (!cleanCode) {
      setErrorMessage('Introduce el código de 6 cifras recibido por correo.');
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
          twoFactorCode: cleanCode,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success && data.cookie) {
        await handleSuccessfulSession(data.cookie, data);
        return;
      }

      throw new Error(
        data.error ||
          'El código de verificación no es válido o ha caducado. También puedes usar tu cookie sp_dc en la pestaña de al lado.'
      );
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al verificar el código.');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3B: Connect with direct sp_dc cookie
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
      await handleSuccessfulSession(cookie, data);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al conectar con Spotify.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuccessfulSession = async (cookie: string, data: any) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('user_spotify_cookie', cookie);
      if (data.accessToken) {
        window.localStorage.setItem('spotify_access_token', data.accessToken);
      }
    }

    if (rememberMe) {
      saveAccount({
        id: data.user?.id || `user-${Date.now()}`,
        displayName: data.user?.display_name || 'Usuario Spotify',
        email: data.user?.email || emailInput,
        avatarUrl: data.user?.images?.[0]?.url,
        cookie,
        accessToken: data.accessToken,
        lastUsed: Date.now(),
      });
    }

    setSuccessMessage(`¡Conectado como ${data.user?.display_name || 'Usuario'} con éxito!`);
    await initialize();
    setSavedAccounts(getSavedAccounts());

    setTimeout(() => {
      closeLoginModal();
    }, 900);
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

        {/* Center Spotify Logo */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-10 h-10 mb-3 flex items-center justify-center">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="white">
              <path d="M12 2C6.477 2 2 6.477 2 12c0 5.524 4.477 10 10 10s10-4.476 10-10c0-5.523-4.477-10-10-10zm4.586 14.424c-.18.295-.563.387-.857.207-2.35-1.435-5.308-1.76-8.793-.963-.335.077-.67-.133-.746-.468-.077-.334.132-.67.467-.746 3.808-.87 7.076-.496 9.722 1.115.294.18.386.563.207.855zm1.226-2.72c-.226.367-.706.482-1.072.257-2.687-1.652-6.785-2.131-9.965-1.166-.413.127-.848-.106-.973-.518-.125-.413.108-.848.52-.973 3.632-1.102 8.147-.568 11.233 1.328.366.226.481.707.257 1.072zm.105-2.835C14.692 8.95 9.375 8.775 6.297 9.71c-.494.15-1.018-.13-1.168-.624-.15-.494.13-1.018.624-1.168 3.532-1.073 9.404-.866 13.115 1.337.445.264.59.838.327 1.282-.264.443-.838.59-1.28.327z" />
            </svg>
          </div>

          <h1 className="text-3xl font-black text-white font-['SpotifyMixUITitle'] tracking-tight">
            {step === 'identifier' && '¡Hola de nuevo!'}
            {step === 'password' && 'Introduce tu contraseña'}
            {step === 'verification' && 'Verificación de sesión'}
          </h1>

          {step === 'password' && (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-[#b3b3b3]">{emailInput}</span>
              <button
                type="button"
                onClick={() => setStep('identifier')}
                className="text-xs text-[#1ed760] hover:underline font-semibold cursor-pointer"
              >
                Cambiar
              </button>
            </div>
          )}
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

        {/* Saved Accounts Switcher (Instant 1-click login) */}
        {savedAccounts.length > 0 && step === 'identifier' && (
          <div className="mb-6 pb-6 border-b border-white/10">
            <span className="text-xs font-bold text-[#b3b3b3] block mb-2.5">
              Cuentas guardadas
            </span>
            <div className="space-y-2">
              {savedAccounts.map((acc) => (
                <div
                  key={acc.id}
                  onClick={() => handleSwitchAccount(acc)}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <AccountAvatar url={acc.avatarUrl} name={acc.displayName} />
                    <div className="text-left">
                      <span className="text-sm font-bold text-white block group-hover:text-[#1ed760] transition-colors">
                        {acc.displayName}
                      </span>
                      {acc.email && (
                        <span className="text-xs text-[#b3b3b3] block">{acc.email}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-black bg-[#1ed760] px-3 py-1 rounded-full group-hover:scale-105 transition-transform">
                      Acceder
                    </span>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteAccount(e, acc.id)}
                      className="text-[#727272] hover:text-red-400 p-1 text-xs"
                      title="Eliminar de guardadas"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 1: Correo electrónico o nombre de usuario */}
        {step === 'identifier' && (
          <form onSubmit={handleContinueIdentifier} className="space-y-4">
            <div className="space-y-1.5 text-left">
              <label className="text-xs font-bold text-white block">
                Correo electrónico o nombre de usuario
              </label>
              <input
                type="text"
                autoFocus
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="Correo electrónico o nombre de usuario"
                className="w-full h-12 px-4 rounded-[4px] bg-[#121212] border border-[#727272] focus:border-white text-white text-sm outline-none transition-colors placeholder-[#727272]"
              />
            </div>

            {/* Green "Continuar" Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 rounded-full bg-[#1ed760] hover:bg-[#1fdf64] hover:scale-[1.02] active:scale-[0.98] text-black font-bold text-sm tracking-wide transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              <span>Continuar</span>
            </button>

            {/* Direct Cookie Shortcut link */}
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => {
                  setStep('verification');
                  setVerificationTab('cookie');
                }}
                className="text-xs text-[#b3b3b3] hover:text-white underline cursor-pointer"
              >
                O iniciar sesión directamente con tu cookie sp_dc
              </button>
            </div>

            {/* Divider matching Spotify */}
            <div className="flex items-center my-4">
              <div className="flex-1 border-t border-white/10" />
              <span className="px-4 text-xs font-semibold text-[#b3b3b3]">o</span>
              <div className="flex-1 border-t border-white/10" />
            </div>

            {/* Social Buttons */}
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => {
                  setStep('verification');
                  setVerificationTab('cookie');
                }}
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

              <button
                type="button"
                onClick={() => {
                  setStep('verification');
                  setVerificationTab('cookie');
                }}
                className="w-full h-12 rounded-full border border-[#727272] hover:border-white bg-transparent hover:bg-white/5 text-white font-bold text-sm flex items-center justify-center gap-3 transition-all cursor-pointer"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#1877F2">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
                <span>Continuar con Facebook</span>
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: Introduce tu contraseña */}
        {step === 'password' && (
          <form onSubmit={handleLoginWithPassword} className="space-y-4">
            <div className="space-y-1.5 text-left">
              <label className="text-xs font-bold text-white block">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoFocus
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Contraseña"
                  className="w-full h-12 px-4 pr-12 rounded-[4px] bg-[#121212] border border-[#727272] focus:border-white text-white text-sm outline-none transition-colors placeholder-[#727272]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3.5 text-[#b3b3b3] hover:text-white transition-colors cursor-pointer"
                  title={showPassword ? 'Ocultar' : 'Mostrar'}
                >
                  {showPassword ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-[#b3b3b3] hover:text-white">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="accent-[#1ed760] rounded cursor-pointer"
                />
                <span>Recordarme</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  setStep('verification');
                  setVerificationTab('cookie');
                }}
                className="text-[#b3b3b3] hover:text-white underline cursor-pointer"
              >
                ¿Usar cookie sp_dc?
              </button>
            </div>

            {/* Iniciar sesión Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 rounded-full bg-[#1ed760] hover:bg-[#1fdf64] hover:scale-[1.02] active:scale-[0.98] text-black font-bold text-sm tracking-wide transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer mt-3"
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

            {/* Back button */}
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setStep('identifier')}
                className="text-xs text-[#b3b3b3] hover:text-white cursor-pointer"
              >
                ← Volver al correo
              </button>
            </div>
          </form>
        )}

        {/* STEP 3: Verificación de seguridad (Código de correo o Cookie sp_dc) */}
        {step === 'verification' && (
          <div className="space-y-4 text-left">
            {/* Tab Switcher */}
            <div className="flex rounded-lg bg-white/5 p-1 mb-3">
              <button
                type="button"
                onClick={() => setVerificationTab('cookie')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer text-center ${
                  verificationTab === 'cookie'
                    ? 'bg-[#1ed760] text-black shadow'
                    : 'text-[#b3b3b3] hover:text-white'
                }`}
              >
                Cookie sp_dc (Directo)
              </button>
              <button
                type="button"
                onClick={() => setVerificationTab('code')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer text-center ${
                  verificationTab === 'code'
                    ? 'bg-[#1ed760] text-black shadow'
                    : 'text-[#b3b3b3] hover:text-white'
                }`}
              >
                Código por correo (6 cifras)
              </button>
            </div>

            {/* TAB: Cookie sp_dc */}
            {verificationTab === 'cookie' && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-white block">
                    Pega tu cookie sp_dc
                  </label>
                  <textarea
                    rows={2}
                    value={cookieInput}
                    onChange={(e) => setCookieInput(e.target.value)}
                    placeholder="AQ..."
                    className="w-full px-3.5 py-2.5 rounded-[4px] bg-[#121212] border border-[#727272] focus:border-[#1ed760] text-white text-xs font-mono outline-none transition-colors placeholder-[#727272] resize-none"
                  />
                </div>

                <div className="p-3 bg-white/5 border border-white/10 rounded-lg text-[11px] text-[#b3b3b3] leading-relaxed">
                  💡 <strong className="text-white">¿Cómo obtenerla en 10 segundos?</strong>
                  <br />
                  1. Abre <strong className="text-white">open.spotify.com</strong> en tu navegador.
                  <br />
                  2. Pulsa <strong className="text-white">F12</strong> &gt; Pestaña <strong className="text-white">Aplicación</strong> (o Almacenamiento).
                  <br />
                  3. En <strong className="text-white">Cookies</strong>, haz clic en Spotify y copia el valor de <strong className="text-[#1ed760]">sp_dc</strong>.
                </div>

                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => handleConnectWithCookie()}
                  className="w-full h-12 rounded-full bg-[#1ed760] hover:bg-[#1fdf64] hover:scale-[1.02] active:scale-[0.98] text-black font-bold text-sm tracking-wide transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer mt-2"
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      <span>Conectando sesión...</span>
                    </>
                  ) : (
                    <span>Conectar con cookie sp_dc</span>
                  )}
                </button>
              </div>
            )}

            {/* TAB: Código de 6 cifras */}
            {verificationTab === 'code' && (
              <form onSubmit={handleVerify2FACode} className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-white block">
                    Código de 6 cifras enviado por correo
                  </label>
                  <input
                    type="text"
                    maxLength={8}
                    autoFocus
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    placeholder="123456"
                    className="w-full h-12 px-4 rounded-[4px] bg-[#121212] border border-[#727272] focus:border-[#1ed760] text-white text-center font-mono text-xl tracking-[0.3em] outline-none transition-colors placeholder-[#727272]"
                  />
                </div>

                <p className="text-[11px] text-[#b3b3b3] leading-relaxed">
                  Revisa la bandeja de entrada o spam del correo asociado a tu cuenta de Spotify.
                </p>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12 rounded-full bg-[#1ed760] hover:bg-[#1fdf64] hover:scale-[1.02] active:scale-[0.98] text-black font-bold text-sm tracking-wide transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer mt-2"
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      <span>Verificando...</span>
                    </>
                  ) : (
                    <span>Verificar código y entrar</span>
                  )}
                </button>
              </form>
            )}

            {/* Back button */}
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setStep('password')}
                className="text-xs text-[#b3b3b3] hover:text-white cursor-pointer"
              >
                ← Volver a contraseña
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-white/10 text-center">
          <p className="text-xs text-[#b3b3b3]">
            ¿No tienes cuenta?{' '}
            <a
              href="https://www.spotify.com/signup"
              target="_blank"
              rel="noreferrer"
              className="text-white hover:underline font-bold"
            >
              Regístrate en Spotify
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};
