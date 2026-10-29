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
        setMessage('¡Cuenta creada! Todo listo para sincronizar.');
      } else {
        const res = await loginSpotifreeAccount(cleanEmail, cleanPass);
        if (!res.success || !res.account) {
          setError(res.error || 'Correo o contraseña incorrectos.');
          setIsLoading(false);
          return;
        }
        setCurrentAccount(res.account);
        setMessage(`Bienvenido de nuevo, ${res.account.displayName}.`);

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
        setMessage('Datos sincronizados con la nube.');
        setTimeout(() => setMessage(null), 3000);
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
          <span className="flex items-center gap-1 text-[10px] font-bold text-[#1ed760] uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1ed760] animate-pulse" />
            Activa
          </span>
        </div>

        {message && (
          <p className="text-xs text-[#1ed760] mb-2">{message}</p>
        )}
        {error && (
          <p className="text-xs text-red-400 mb-2">{error}</p>
        )}

        <div className="grid grid-cols-2 gap-2 mt-1">
          <button
            onClick={handleManualSync}
            disabled={isLoading}
            className="py-2.5 rounded-full bg-[#1ed760] hover:bg-[#1fdf64] text-black font-bold text-xs transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            {isLoading ? 'Sincronizando...' : 'Sincronizar'}
          </button>
          <button
            onClick={handleLogout}
            className="py-2.5 rounded-full border border-white/20 text-white font-bold text-xs hover:border-white/40 transition-colors active:scale-95 cursor-pointer"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="font-['SpotifyMixUI']">
      {/* Tab switcher — like Spotify login/signup */}
      <div className="flex gap-1 mb-4 bg-[#121212] p-1 rounded-full">
        <button
          type="button"
          onClick={() => { setMode('login'); setError(null); }}
          className={`flex-1 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
            mode === 'login' ? 'bg-white text-black shadow' : 'text-[#b3b3b3] hover:text-white'
          }`}
        >
          Iniciar sesión
        </button>
        <button
          type="button"
          onClick={() => { setMode('register'); setError(null); }}
          className={`flex-1 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
            mode === 'register' ? 'bg-white text-black shadow' : 'text-[#b3b3b3] hover:text-white'
          }`}
        >
          Registrarse
        </button>
      </div>

      <form onSubmit={handleAuth} className="space-y-3">
        {mode === 'register' && (
          <div>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Cómo te llamamos"
              className="w-full bg-[#2a2a2a] border border-transparent focus:border-white/30 rounded-lg px-4 py-3 text-sm text-white placeholder-[#727272] focus:outline-none transition-colors"
            />
          </div>
        )}

        <div>
          <input
            type="text"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Correo electrónico o usuario"
            className="w-full bg-[#2a2a2a] border border-transparent focus:border-white/30 rounded-lg px-4 py-3 text-sm text-white placeholder-[#727272] focus:outline-none transition-colors"
          />
        </div>

        <div>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña"
            className="w-full bg-[#2a2a2a] border border-transparent focus:border-white/30 rounded-lg px-4 py-3 text-sm text-white placeholder-[#727272] focus:outline-none transition-colors"
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
          className="w-full py-3 rounded-full bg-[#1ed760] hover:bg-[#1fdf64] text-black font-bold text-sm tracking-wide transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer mt-1"
        >
          {isLoading
            ? 'Un momento...'
            : mode === 'login'
            ? 'Iniciar sesión'
            : 'Crear cuenta'}
        </button>
      </form>
    </div>
  );
};
