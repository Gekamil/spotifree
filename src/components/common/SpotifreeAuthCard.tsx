import React, { useState, useEffect } from 'react';
import {
  getSavedSpotifreeAccount,
  loginSpotifreeAccount,
  registerSpotifreeAccount,
  syncSpotifreeAccount,
  saveCurrentSpotifreeAccount,
  type SpotifreeAccount,
} from '../../services/spotifreeAuth';
import { useSpotifyDataStore } from '../../store/useSpotifyDataStore';
import { usePlayerStore } from '../../store/usePlayerStore';

export const SpotifreeAuthCard: React.FC<{ onAuthSuccess?: () => void }> = ({ onAuthSuccess }) => {
  const [currentAccount, setCurrentAccount] = useState<SpotifreeAccount | null>(null);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const acc = getSavedSpotifreeAccount();
    setCurrentAccount(acc);
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
        setMessage('¡Cuenta creada y sincronizada con éxito!');
      } else {
        const res = await loginSpotifreeAccount(cleanEmail, cleanPass);
        if (!res.success || !res.account) {
          setError(res.error || 'Correo o contraseña incorrectos.');
          setIsLoading(false);
          return;
        }
        setCurrentAccount(res.account);
        setMessage(`¡Bienvenido de nuevo, ${res.account.displayName}!`);

        // Apply account data to local stores
        const acc = res.account;
        if (acc.displayName) {
          useSpotifyDataStore.setState((s) => ({
            user: s.user ? { ...s.user, display_name: acc.displayName } : s.user,
          }));
        }
        if (Array.isArray(acc.playlists) && acc.playlists.length > 0) {
          useSpotifyDataStore.setState((s) => {
            const currentIds = new Set(s.playlists.map((p) => p.id));
            const toAdd = acc.playlists.filter((p) => !currentIds.has(p.id));
            return { playlists: [...toAdd, ...s.playlists] };
          });
        }
        if (Array.isArray(acc.likedTracks) && acc.likedTracks.length > 0) {
          usePlayerStore.setState((s) => ({
            likedTrackIds: Array.from(new Set([...s.likedTrackIds, ...acc.likedTracks])),
          }));
        }
        if (acc.spotifyCookie) {
          window.localStorage.setItem('user_spotify_cookie', acc.spotifyCookie);
          useSpotifyDataStore.getState().initialize?.();
        }
      }

      onAuthSuccess?.();
    } catch (err: any) {
      setError(err.message || 'Error de autenticación.');
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
      const playlists = useSpotifyDataStore.getState().playlists.filter((p: any) => p.is_custom || p.id.startsWith('custom-'));
      const likedTracks = usePlayerStore.getState().likedTrackIds;
      const user = useSpotifyDataStore.getState().user;
      const cookie = window.localStorage.getItem('user_spotify_cookie') || '';

      const updated = await syncSpotifreeAccount({
        email: currentAccount.email,
        displayName: user?.display_name || currentAccount.displayName,
        avatarUrl: user?.images?.[0]?.url || currentAccount.avatarUrl,
        bannerUrl: (user as any)?.bannerUrl || currentAccount.bannerUrl,
        playlists,
        likedTracks,
        spotifyCookie: cookie,
      });

      if (updated) {
        setCurrentAccount(updated);
        setMessage('✓ Todos tus datos se han sincronizado con la nube.');
        setTimeout(() => setMessage(null), 3500);
      }
    } catch {
      setError('Error al sincronizar.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    saveCurrentSpotifreeAccount(null);
    setCurrentAccount(null);
    setMessage('Sesión de Spotifree cerrada.');
    setTimeout(() => setMessage(null), 2500);
  };

  if (currentAccount) {
    return (
      <div className="p-4 rounded-2xl bg-gradient-to-br from-[#1ed760]/10 via-[#181818] to-[#121212] border border-[#1ed760]/30 space-y-3 font-['SpotifyMixUI']">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[#1ed760] uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#1ed760] animate-pulse" />
            Cuenta Spotifree en la Nube
          </span>
          <span className="text-[11px] text-[#b3b3b3] font-mono">
            {currentAccount.email}
          </span>
        </div>

        <div className="flex items-center gap-3 py-1">
          <div className="w-12 h-12 rounded-full bg-[#242424] border border-[#1ed760]/40 overflow-hidden flex items-center justify-center font-bold text-white text-base shrink-0 shadow-md">
            {currentAccount.avatarUrl ? (
              <img src={currentAccount.avatarUrl} alt={currentAccount.displayName} className="w-full h-full object-cover" />
            ) : (
              (currentAccount.displayName || 'U').charAt(0).toUpperCase()
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-bold text-white truncate font-['SpotifyMixUITitle']">
              {currentAccount.displayName}
            </h4>
            <p className="text-xs text-[#b3b3b3] truncate mt-0.5">
              Playlists, me gusta y perfil sincronizados
            </p>
          </div>
        </div>

        {message && (
          <p className="text-xs text-[#1ed760] font-bold bg-[#1ed760]/10 p-2 rounded-lg">
            {message}
          </p>
        )}
        {error && (
          <p className="text-xs text-red-400 font-bold bg-red-500/10 p-2 rounded-lg">
            {error}
          </p>
        )}

        <div className="flex gap-2 pt-1 border-t border-white/5">
          <button
            onClick={handleManualSync}
            disabled={isLoading}
            className="flex-1 py-2 rounded-xl bg-[#1ed760] hover:bg-[#1fdf64] text-black font-bold text-xs transition-transform active:scale-95 disabled:opacity-50 cursor-pointer shadow"
          >
            {isLoading ? 'Sincronizando...' : 'Sincronizar ahora'}
          </button>
          <button
            onClick={handleLogout}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition-colors active:scale-95 cursor-pointer"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-2xl bg-[#181818] border border-white/10 space-y-3 font-['SpotifyMixUI']">
      <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`text-xs font-bold pb-1 transition-colors cursor-pointer ${
              mode === 'login' ? 'text-[#1ed760] border-b-2 border-[#1ed760]' : 'text-[#b3b3b3] hover:text-white'
            }`}
          >
            Iniciar sesión
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError(null);
            }}
            className={`text-xs font-bold pb-1 transition-colors cursor-pointer ${
              mode === 'register' ? 'text-[#1ed760] border-b-2 border-[#1ed760]' : 'text-[#b3b3b3] hover:text-white'
            }`}
          >
            Crear cuenta
          </button>
        </div>
        <span className="text-[10px] text-[#b3b3b3] font-mono">Spotifree Cloud</span>
      </div>

      <p className="text-xs text-[#b3b3b3] leading-relaxed">
        {mode === 'login'
          ? 'Inicia sesión para sincronizar automáticamente tus playlists, me gusta y perfil en móvil y PC.'
          : 'Regístrate para guardar tus listas, canciones escuchadas y foto en cualquier dispositivo.'}
      </p>

      <form onSubmit={handleAuth} className="space-y-2.5">
        {mode === 'register' && (
          <div>
            <label className="text-[11px] font-bold text-white/80 block mb-1">Nombre para mostrar</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Ej: Pepe, Juan..."
              className="w-full bg-[#121212] border border-white/15 rounded-lg px-3 py-2 text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#1ed760]"
            />
          </div>
        )}

        <div>
          <label className="text-[11px] font-bold text-white/80 block mb-1">Correo o Usuario</label>
          <input
            type="text"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="pepe o pepe@gmail.com"
            className="w-full bg-[#121212] border border-white/15 rounded-lg px-3 py-2 text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#1ed760]"
          />
        </div>

        <div>
          <label className="text-[11px] font-bold text-white/80 block mb-1">Contraseña</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Tu contraseña"
            className="w-full bg-[#121212] border border-white/15 rounded-lg px-3 py-2 text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#1ed760]"
          />
        </div>

        {error && (
          <p className="text-xs text-red-400 font-bold bg-red-500/10 p-2 rounded-lg">
            {error}
          </p>
        )}
        {message && (
          <p className="text-xs text-[#1ed760] font-bold bg-[#1ed760]/10 p-2 rounded-lg">
            {message}
          </p>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2.5 rounded-xl bg-white hover:bg-white/90 text-black font-bold text-xs tracking-wide transition-all active:scale-95 disabled:opacity-50 cursor-pointer shadow-md mt-1"
        >
          {isLoading
            ? 'Cargando...'
            : mode === 'login'
            ? 'Iniciar sesión en Spotifree'
            : 'Registrarse en Spotifree'}
        </button>
      </form>
    </div>
  );
};
