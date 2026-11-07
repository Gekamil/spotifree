import React, { useState, useEffect } from 'react';
import {
  getSavedSpotifreeAccount,
  loginSpotifreeAccount,
  registerSpotifreeAccount,
  loginWithGoogleAccount,
  logoutSpotifreeAccount,
  syncSpotifreeAccount,
  type SpotifreeAccount,
} from '../../services/spotifreeAuth';
import { useSpotifyDataStore } from '../../store/useSpotifyDataStore';
import { usePlayerStore } from '../../store/usePlayerStore';
import { NativeSpotifyLoginButton } from './NativeSpotifyLoginButton';

export const SpotifreeAuthCard: React.FC<{ onAuthSuccess?: () => void; showCookieInput?: boolean }> = ({
  onAuthSuccess,
  showCookieInput = true,
}) => {
  const [currentAccount, setCurrentAccount] = useState<SpotifreeAccount | null>(null);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [cookieInput, setCookieInput] = useState('');
  const [showCookie, setShowCookie] = useState(false);
  const [copiedCookie, setCopiedCookie] = useState(false);

  useEffect(() => {
    const acc = getSavedSpotifreeAccount();
    setCurrentAccount(acc);
    if (acc?.spotifyCookie) {
      setCookieInput(acc.spotifyCookie);
    } else if (typeof window !== 'undefined') {
      const local = window.localStorage.getItem('user_spotify_cookie');
      if (local) setCookieInput(local);
    }
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const cleanEmail = email.trim();
    const cleanPass = password.trim();

    if (!cleanEmail || !cleanPass) {
      setError('Por favor, completa correo y contraseña.');
      return;
    }

    setIsLoading(true);

    try {
      if (mode === 'register') {
        const res = await registerSpotifreeAccount(cleanEmail, cleanPass, displayName.trim());
        if (!res.success || !res.account) {
          setError(res.error || 'Error al crear la cuenta.');
          setIsLoading(false);
          return;
        }
        setCurrentAccount(res.account);
        setMessage('¡Cuenta creada y sincronizada con Firebase!');
      } else {
        const res = await loginSpotifreeAccount(cleanEmail, cleanPass);
        if (!res.success || !res.account) {
          setError(res.error || 'Correo o contraseña incorrectos.');
          setIsLoading(false);
          return;
        }
        setCurrentAccount(res.account);
        setMessage(`Bienvenido de nuevo, ${res.account.displayName}.`);
      }

      onAuthSuccess?.();
    } catch (err: any) {
      setError(err.message || 'Error de autenticación.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setMessage(null);
    setIsLoading(true);
    try {
      const res = await loginWithGoogleAccount();
      if (!res.success || !res.account) {
        setError(res.error || 'Error al iniciar sesión con Google.');
        setIsLoading(false);
        return;
      }
      setCurrentAccount(res.account);
      setMessage(`Sesión iniciada como ${res.account.displayName}`);
      onAuthSuccess?.();
    } catch (err: any) {
      setError(err.message || 'Error con Google Sign In.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualSync = async () => {
    if (!currentAccount) return;
    setIsLoading(true);
    setMessage(null);
    setError(null);

    try {
      const rawImported = typeof window !== 'undefined' ? window.localStorage.getItem('user_imported_playlists') : null;
      const importedPlaylists = rawImported ? JSON.parse(rawImported) : [];
      const storeCustom = useSpotifyDataStore.getState().playlists.filter((p: any) => p.is_custom || p.id.startsWith('custom-'));
      const allPlaylistMap = new Map<string, any>();
      [...storeCustom, ...importedPlaylists].forEach((p) => {
        if (p && p.id && !allPlaylistMap.has(p.id)) allPlaylistMap.set(p.id, p);
      });
      const playlists = Array.from(allPlaylistMap.values());
      const likedTracks = usePlayerStore.getState().likedTrackIds;
      const user = useSpotifyDataStore.getState().user;
      const cookie = typeof window !== 'undefined' ? window.localStorage.getItem('user_spotify_cookie') || '' : '';

      const rawProf = typeof window !== 'undefined' ? window.localStorage.getItem('spotifree_custom_profile') : null;
      let customBanner: string | null = null;
      let customAvatar: string | null = null;
      if (rawProf) {
        try {
          const p = JSON.parse(rawProf);
          if (p.bannerUrl) customBanner = p.bannerUrl;
          if (p.avatarUrl) customAvatar = p.avatarUrl;
        } catch {}
      }
      const banner = customBanner || (user as any)?.bannerUrl || currentAccount.bannerUrl || null;
      const avatar = customAvatar || user?.images?.[0]?.url || currentAccount.avatarUrl;

      const updated = await syncSpotifreeAccount({
        email: currentAccount.email,
        uid: currentAccount.uid,
        displayName: user?.display_name || currentAccount.displayName,
        avatarUrl: avatar,
        bannerUrl: banner,
        playlists,
        likedTracks,
        spotifyCookie: cookie,
      });

      if (updated) {
        setCurrentAccount(updated);
        setMessage('✓ Datos sincronizados con Cloud Firestore.');
        setTimeout(() => setMessage(null), 3000);
      }
    } catch {
      setError('Error al sincronizar.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveCookie = async () => {
    if (!currentAccount || !cookieInput.trim()) return;
    setIsLoading(true);
    setError(null);
    setMessage(null);
    try {
      const cleanCookie = cookieInput.trim();
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('user_spotify_cookie', cleanCookie);
      }
      const updated = await syncSpotifreeAccount({
        email: currentAccount.email,
        uid: currentAccount.uid,
        spotifyCookie: cleanCookie,
      });
      if (updated) {
        setCurrentAccount(updated);
        setMessage('✓ Cookie vinculada y guardada en tu cuenta.');
        setCookieInput(cleanCookie);
        setTimeout(() => setMessage(null), 3500);
      }
    } catch {
      setError('Error al guardar la cookie.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await logoutSpotifreeAccount();
    setCurrentAccount(null);
    setMessage(null);
    setError(null);
  };

  if (currentAccount) {
    return (
      <div className="font-['SpotifyMixUI']">
        {/* Logged-in state — Spotify-like profile row */}
        <div className="flex items-center gap-3.5 py-3">
          <div className="w-12 h-12 rounded-full bg-[#242424] border border-white/10 overflow-hidden flex items-center justify-center font-bold text-white text-base shrink-0">
            {currentAccount.avatarUrl ? (
              <img src={currentAccount.avatarUrl} alt={currentAccount.displayName} className="w-full h-full object-cover" />
            ) : (
              <span className="text-lg">{(currentAccount.displayName || 'U').charAt(0).toUpperCase()}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate">{currentAccount.displayName}</p>
            <p className="text-xs text-[#b3b3b3] truncate">{currentAccount.email}</p>
          </div>
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#1ed760]/10 border border-[#1ed760]/20 text-[10px] font-bold text-[#1ed760] shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1ed760] animate-pulse" />
            Firebase
          </span>
        </div>

        {message && (
          <p className="text-xs text-[#1ed760] mb-2">{message}</p>
        )}
        {error && (
          <p className="text-xs text-red-400 mb-2">{error}</p>
        )}

        {/* Vincular Cookie de Spotify a esta cuenta (opcional si ya se pide abajo) */}
        {showCookieInput && (
          <div className="pt-3 pb-1 border-t border-white/10 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white">Cookie de Spotify (sp_dc)</span>
              {currentAccount.spotifyCookie ? (
                <span className="text-[10px] text-[#1ed760] font-bold">✓ Vinculada en la nube</span>
              ) : (
                <span className="text-[10px] text-[#b3b3b3]">No vinculada</span>
              )}
            </div>
            <NativeSpotifyLoginButton compact />
            <p className="text-[11px] text-[#b3b3b3] leading-relaxed">
              Pega aquí tu cookie para vincular tus playlists privadas de Spotify. Se sincronizará automáticamente en todos tus dispositivos.
            </p>
            <div className="flex items-center gap-2">
              <div className="relative flex-1 flex items-center">
                <input
                  type={showCookie ? "text" : "password"}
                  placeholder={currentAccount.spotifyCookie ? "Cookie guardada" : "Pega tu cookie sp_dc..."}
                  value={cookieInput}
                  onChange={(e) => setCookieInput(e.target.value)}
                  className="w-full bg-[#121212] border border-white/20 rounded-lg pl-3 pr-8 py-2 text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#1ed760] font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowCookie(!showCookie)}
                  className="absolute right-2.5 text-[#b3b3b3] hover:text-white cursor-pointer transition-colors"
                  title={showCookie ? "Ocultar cookie" : "Mostrar cookie"}
                >
                  {showCookie ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>

              {(cookieInput || currentAccount.spotifyCookie) && (
                <button
                  type="button"
                  onClick={() => {
                    const toCopy = cookieInput || currentAccount.spotifyCookie || '';
                    if (!toCopy) return;
                    navigator.clipboard.writeText(toCopy);
                    setCopiedCookie(true);
                    setTimeout(() => setCopiedCookie(false), 2000);
                  }}
                  className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-xs active:scale-95 transition-all cursor-pointer shadow shrink-0"
                  title="Copiar cookie sp_dc"
                >
                  {copiedCookie ? '✓ Copiada' : 'Copiar'}
                </button>
              )}

              <button
                onClick={handleSaveCookie}
                disabled={isLoading || !cookieInput.trim()}
                className="px-4 py-2 rounded-lg bg-white hover:bg-white/90 text-black font-bold text-xs disabled:opacity-40 active:scale-95 transition-all cursor-pointer shadow shrink-0"
              >
                Guardar
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 mt-3">
          <button
            onClick={handleManualSync}
            disabled={isLoading}
            className="py-2.5 rounded-full bg-[#1ed760] hover:bg-[#1fdf64] text-black font-bold text-xs transition-all active:scale-95 disabled:opacity-50 cursor-pointer shadow-md"
          >
            {isLoading ? 'Sincronizando...' : 'Sincronizar nube'}
          </button>
          <button
            onClick={handleLogout}
            className="py-2.5 rounded-full border border-white/20 text-white font-bold text-xs hover:border-white/40 hover:bg-white/5 transition-colors active:scale-95 cursor-pointer"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="font-['SpotifyMixUI'] space-y-3">
      {/* 1-Click Google Sign In */}
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={isLoading}
        className="w-full py-2.5 px-4 rounded-full border border-white/20 hover:border-white/40 bg-[#1e1e1e] hover:bg-[#282828] text-white font-bold text-xs flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] cursor-pointer"
      >
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
        </svg>
        <span>Continuar con Google</span>
      </button>

      {/* Divider */}
      <div className="flex items-center gap-3 my-1">
        <div className="flex-1 h-px bg-white/10" />
        <span className="text-[11px] text-[#727272] uppercase font-semibold">o con correo</span>
        <div className="flex-1 h-px bg-white/10" />
      </div>

      {/* Tab switcher — Login / Register */}
      <div className="flex gap-1 bg-[#121212] p-1 rounded-full">
        <button
          type="button"
          onClick={() => { setMode('login'); setError(null); }}
          className={`flex-1 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
            mode === 'login' ? 'bg-white text-black shadow' : 'text-[#b3b3b3] hover:text-white'
          }`}
        >
          Iniciar sesión
        </button>
        <button
          type="button"
          onClick={() => { setMode('register'); setError(null); }}
          className={`flex-1 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
            mode === 'register' ? 'bg-white text-black shadow' : 'text-[#b3b3b3] hover:text-white'
          }`}
        >
          Registrarse
        </button>
      </div>

      <form onSubmit={handleAuth} className="space-y-2.5">
        {mode === 'register' && (
          <div>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="¿Cómo te llamas?"
              className="w-full bg-[#2a2a2a] border border-transparent focus:border-white/30 rounded-lg px-4 py-2.5 text-xs text-white placeholder-[#727272] focus:outline-none transition-colors"
            />
          </div>
        )}

        <div>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Correo electrónico (ej: usuario@gmail.com)"
            className="w-full bg-[#2a2a2a] border border-transparent focus:border-white/30 rounded-lg px-4 py-2.5 text-xs text-white placeholder-[#727272] focus:outline-none transition-colors"
          />
        </div>

        <div>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña (mínimo 6 caracteres)"
            className="w-full bg-[#2a2a2a] border border-transparent focus:border-white/30 rounded-lg px-4 py-2.5 text-xs text-white placeholder-[#727272] focus:outline-none transition-colors"
          />
        </div>

        {error && (
          <p className="text-xs text-red-400">{error}</p>
        )}
        {message && (
          <p className="text-xs text-[#1ed760]">{message}</p>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2.5 rounded-full bg-[#1ed760] hover:bg-[#1fdf64] text-black font-bold text-xs tracking-wide transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer shadow-md"
        >
          {isLoading
            ? 'Conectando con Firebase...'
            : mode === 'login'
            ? 'Iniciar sesión'
            : 'Crear cuenta en la nube'}
        </button>
      </form>
    </div>
  );
};
