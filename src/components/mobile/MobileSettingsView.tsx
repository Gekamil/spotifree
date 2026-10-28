import React, { useState } from 'react';
import { useSpotifyDataStore } from '../../store/useSpotifyDataStore';
import { useUIStore } from '../../store/useUIStore';
import { handleImageError } from '../../utils/imageFallback';
import {
  getSavedAccounts,
  removeSavedAccount,
  saveAccount,
  cleanSpDc,
  type SavedAccount,
} from '../../utils/userAccounts';
import { validateSpotifyCookie } from '../../services/spotifyCookieService';

interface MobileSettingsViewProps {
  onBack: () => void;
  onOpenProfile: () => void;
}

export const MobileSettingsView: React.FC<MobileSettingsViewProps> = ({
  onBack,
  onOpenProfile,
}) => {
  const { user, isAuthenticated, logout } = useSpotifyDataStore();
  const { openLoginModal } = useUIStore();

  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>(() => getSavedAccounts());
  const [cookieInput, setCookieInput] = useState('');
  const [cookieStatus, setCookieStatus] = useState<string | null>(null);
  const [isVerifyingCookie, setIsVerifyingCookie] = useState(false);
  const [normalizeAudio, setNormalizeAudio] = useState(true);
  const [gaplessAudio, setGaplessAudio] = useState(true);
  const [streamingQuality, setStreamingQuality] = useState<'normal' | 'alta' | 'muy_alta'>('muy_alta');
  const [cacheCleared, setCacheCleared] = useState(false);

  const avatarUrl = user?.images?.[0]?.url;
  const displayName = user?.display_name || 'Usuario';

  const handleApplyCookie = async () => {
    if (!cookieInput.trim()) return;
    setIsVerifyingCookie(true);
    setCookieStatus('Comprobando clave de sesión...');

    try {
      const cleanKey = cleanSpDc(cookieInput.trim());
      const validation = validateSpotifyCookie(cleanKey);
      if (!validation.valid) {
        setCookieStatus(`Error: ${validation.error || 'La clave introducida no es válida.'}`);
        setIsVerifyingCookie(false);
        return;
      }

      const res = await fetch('/api/extract-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookie: cleanKey }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'La clave no es válida o ha caducado en Spotify.');
      }

      const data = await res.json();
      if (!data || !data.user) {
        throw new Error('No se obtuvieron datos de la cuenta.');
      }

      const cacheToSave: Record<string, any> = {};
      if (data.playlists && Array.isArray(data.playlists)) {
        data.playlists.forEach((p: any) => {
          if (p && p.id) {
            cacheToSave[p.id] = p;
          }
        });
      }
      if (data.cachedPlaylistDetails) {
        Object.assign(cacheToSave, data.cachedPlaylistDetails);
      }

      if (typeof window !== 'undefined') {
        window.localStorage.setItem('user_spotify_cookie', cleanKey);
        window.localStorage.setItem('spotify_extracted_session', JSON.stringify({ ...data, _cookie: cleanKey }));
        if (data.user?.id) {
          window.localStorage.setItem('spotifree_active_user_id', data.user.id);
          window.localStorage.setItem(`spotifree_playlist_cache_${data.user.id}`, JSON.stringify(cacheToSave));
        }
        window.localStorage.setItem('spotifree_playlist_cache_active', JSON.stringify(cacheToSave));
        window.localStorage.removeItem('spotify_logged_out');
      }

      saveAccount({
        id: data.user.id || `user-${Date.now()}`,
        displayName: data.user.display_name || 'Usuario Spotify',
        email: data.user.email,
        avatarUrl: data.user.images?.[0]?.url,
        cookie: cleanKey,
        accessToken: data.accessToken,
        lastUsed: Date.now(),
      });

      useSpotifyDataStore.setState({
        isAuthenticated: true,
        user: data.user,
        playlists: data.playlists || [],
        dynamicShelves: data.shelves || [],
        quickAccessCards: data.quickAccess || [],
        playlistDetailsCache: cacheToSave,
        isLoading: false,
      });

      setSavedAccounts(getSavedAccounts());
      setCookieStatus('¡Sesión actualizada con éxito!');
      setCookieInput('');
    } catch (err: any) {
      setCookieStatus(`Error: ${err.message || 'Inténtalo de nuevo'}`);
    } finally {
      setIsVerifyingCookie(false);
    }
  };

  const handleSwitchAccount = async (acc: SavedAccount) => {
    if (acc.id === user?.id) return;
    saveAccount({ ...acc, lastUsed: Date.now() });

    let existingCachedPlaylists: Record<string, any> = {};
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('user_spotify_cookie', acc.cookie);
      window.localStorage.setItem('spotifree_active_user_id', acc.id);
      window.localStorage.removeItem('spotify_logged_out');
      try {
        const raw = window.localStorage.getItem(`spotifree_playlist_cache_${acc.id}`);
        if (raw) existingCachedPlaylists = JSON.parse(raw);
      } catch {}
    }

    try {
      const res = await fetch('/api/extract-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookie: acc.cookie }),
      });

      if (res.ok) {
        const data = await res.json();
        const cacheToSave: Record<string, any> = { ...existingCachedPlaylists };
        if (data.playlists && Array.isArray(data.playlists)) {
          data.playlists.forEach((p: any) => {
            if (p && p.id) {
              cacheToSave[p.id] = p;
            }
          });
        }
        if (data.cachedPlaylistDetails) {
          Object.assign(cacheToSave, data.cachedPlaylistDetails);
        }

        if (typeof window !== 'undefined') {
          window.localStorage.setItem('spotify_extracted_session', JSON.stringify({ ...data, _cookie: acc.cookie }));
          window.localStorage.setItem(`spotifree_playlist_cache_${acc.id}`, JSON.stringify(cacheToSave));
          window.localStorage.setItem('spotifree_playlist_cache_active', JSON.stringify(cacheToSave));
        }

        useSpotifyDataStore.setState({
          isAuthenticated: true,
          user: data.user,
          playlists: data.playlists || [],
          dynamicShelves: data.shelves || [],
          quickAccessCards: data.quickAccess || [],
          playlistDetailsCache: cacheToSave,
          isLoading: false,
        });
      } else {
        useSpotifyDataStore.setState({
          isAuthenticated: true,
          user: {
            id: acc.id,
            display_name: acc.displayName,
            images: acc.avatarUrl ? [{ url: acc.avatarUrl }] : [],
            email: acc.email,
          } as any,
          playlistDetailsCache: existingCachedPlaylists,
        });
      }
      setSavedAccounts(getSavedAccounts());
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteAccount = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeSavedAccount(id);
    setSavedAccounts(getSavedAccounts());
  };

  const handleClearCache = () => {
    try {
      if (typeof window !== 'undefined') {
        const keysToRemove: string[] = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (key && (key.startsWith('spotifree_playlist_cache_') || key.startsWith('spotifree_cache_'))) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((k) => window.localStorage.removeItem(k));
      }
      setCacheCleared(true);
      setTimeout(() => setCacheCleared(false), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="select-none min-h-full pb-32 relative bg-[#121212] font-['SpotifyMixUI'] text-white">
      {/* Top Sticky Bar */}
      <div className="sticky top-0 z-30 px-4 py-3 bg-[#121212]/95 backdrop-blur-md flex items-center justify-between border-b border-white/[0.06]">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-full flex items-center justify-center text-white/90 hover:text-white active:scale-90 transition-transform cursor-pointer"
          title="Volver"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
          </svg>
        </button>

        <h2 className="text-base font-bold text-white tracking-tight">Configuración</h2>

        <div className="w-9" />
      </div>

      <div className="px-4 py-4 space-y-6">
        {/* User Profile Card */}
        {isAuthenticated ? (
          <div
            onClick={onOpenProfile}
            className="flex items-center justify-between p-3.5 rounded-xl bg-[#181818] hover:bg-[#222222] active:bg-[#282828] cursor-pointer transition-all border border-white/[0.04]"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-12 h-12 rounded-full overflow-hidden bg-[#242424] shrink-0 border border-white/10 flex items-center justify-center">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    onError={handleImageError}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="font-black text-white text-base">
                    {displayName.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-white text-base truncate">{displayName}</span>
                <span className="text-xs text-[#b3b3b3] mt-0.5">Ver perfil</span>
              </div>
            </div>

            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-white/40">
              <path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z" />
            </svg>
          </div>
        ) : (
          <div
            onClick={openLoginModal}
            className="p-4 rounded-xl bg-[#181818] border border-white/[0.08] text-center space-y-2 cursor-pointer active:scale-98 transition-transform"
          >
            <p className="font-bold text-white text-sm">Inicia sesión en Spotifree</p>
            <p className="text-xs text-[#b3b3b3]">
              Vincula tu cuenta de Spotify para acceder a tu música, playlists y recomendaciones.
            </p>
            <button
              onClick={openLoginModal}
              className="mt-2 px-6 py-2.5 rounded-full bg-[#1ed760] text-black font-bold text-xs uppercase tracking-wider shadow"
            >
              Iniciar sesión
            </button>
          </div>
        )}

        {/* Plan / Suscripción */}
        <div className="p-4 rounded-xl bg-gradient-to-br from-[#181818] to-[#121212] border border-white/[0.08] relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[#b3b3b3] uppercase tracking-wider">Tu Plan</span>
            <span className="px-2 py-0.5 rounded-full bg-[#1ed760] text-black font-black text-[10px] tracking-wider">
              PREMIUM
            </span>
          </div>
          <h3 className="text-lg font-black text-white font-['SpotifyMixUITitle']">
            Spotifree Premium Individual
          </h3>
          <p className="text-xs text-[#b3b3b3] mt-1 leading-relaxed">
            Música sin anuncios, saltos de canciones ilimitados y reproducción de máxima fidelidad.
          </p>
        </div>

        {/* Cuenta & Sesión Spotify */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider text-[#b3b3b3]">
            Sesión y Conexión de Spotify
          </h3>

          <div className="p-4 rounded-xl bg-[#181818] border border-white/[0.04] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#b3b3b3]">Estado de la sesión</span>
              <span className="px-2.5 py-1 rounded-full bg-[#1ed760]/20 text-[#1ed760] text-xs font-bold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#1ed760] animate-pulse" />
                {isAuthenticated ? 'Conectado a Spotify' : 'Sin cuenta activa'}
              </span>
            </div>

            <div className="pt-2">
              <label className="text-xs font-bold text-white block mb-1.5">
                Actualizar clave de sesión (sp_dc)
              </label>
              <div className="flex gap-2">
                <input
                  type="password"
                  placeholder="Pega aquí tu cookie sp_dc..."
                  value={cookieInput}
                  onChange={(e) => setCookieInput(e.target.value)}
                  className="flex-1 bg-[#121212] border border-white/20 rounded-lg px-3 py-2 text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#1ed760]"
                />
                <button
                  onClick={handleApplyCookie}
                  disabled={isVerifyingCookie || !cookieInput.trim()}
                  className="px-4 py-2 rounded-lg bg-white text-black font-bold text-xs disabled:opacity-40 active:scale-95 transition-all cursor-pointer"
                >
                  {isVerifyingCookie ? '...' : 'Guardar'}
                </button>
              </div>
              {cookieStatus && (
                <p className={`text-[11px] mt-1.5 ${cookieStatus.includes('Error') ? 'text-red-400' : 'text-[#1ed760]'}`}>
                  {cookieStatus}
                </p>
              )}
            </div>

            <div className="pt-2 border-t border-white/5 flex items-center justify-between">
              <span className="text-xs text-white font-medium">Emparejar desde ordenador con QR</span>
              <button
                onClick={openLoginModal}
                className="px-3 py-1.5 rounded-full border border-white/20 text-white font-bold text-xs hover:border-white active:scale-95"
              >
                Abrir QR
              </button>
            </div>
          </div>
        </div>

        {/* Cuentas vinculadas */}
        {savedAccounts.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider text-[#b3b3b3]">
              Cuentas guardadas ({savedAccounts.length})
            </h3>

            <div className="space-y-2">
              {savedAccounts.map((acc) => {
                const isCurrent = acc.id === user?.id;
                return (
                  <div
                    key={acc.id}
                    onClick={() => handleSwitchAccount(acc)}
                    className={`flex items-center justify-between p-3 rounded-xl transition-all cursor-pointer ${
                      isCurrent
                        ? 'bg-white/[0.08] border border-[#1ed760]/30'
                        : 'bg-[#181818] hover:bg-[#222222]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full overflow-hidden bg-[#242424] shrink-0 border border-white/10 flex items-center justify-center">
                        {acc.avatarUrl ? (
                          <img
                            src={acc.avatarUrl}
                            alt={acc.displayName}
                            onError={handleImageError}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="font-bold text-white text-xs">
                            {acc.displayName.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-white text-sm truncate">{acc.displayName}</span>
                        <span className="text-[11px] text-[#b3b3b3] truncate">
                          {isCurrent ? 'Sesión en curso' : 'Guardada'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {!isCurrent && (
                        <button
                          onClick={(e) => handleDeleteAccount(acc.id, e)}
                          className="w-7 h-7 rounded-full flex items-center justify-center text-white/40 hover:text-red-400 active:scale-90"
                          title="Eliminar cuenta"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                          </svg>
                        </button>
                      )}
                      {isCurrent ? (
                        <span className="text-xs text-[#1ed760] font-bold">Activa</span>
                      ) : (
                        <span className="text-xs text-[#b3b3b3] font-medium">Usar</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Reproducción y Audio */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider text-[#b3b3b3]">
            Reproducción y Calidad
          </h3>

          <div className="p-4 rounded-xl bg-[#181818] border border-white/[0.04] space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-white">Normalizar el volumen</p>
                <p className="text-xs text-[#b3b3b3]">Establece el mismo volumen para todas las pistas</p>
              </div>
              <button
                onClick={() => setNormalizeAudio(!normalizeAudio)}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                  normalizeAudio ? 'bg-[#1ed760]' : 'bg-[#535353]'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
                    normalizeAudio ? 'left-5' : 'left-0.5'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-white/5">
              <div>
                <p className="text-sm font-bold text-white">Reproducción sin pausas</p>
                <p className="text-xs text-[#b3b3b3]">Transición continua entre canciones consecutivas</p>
              </div>
              <button
                onClick={() => setGaplessAudio(!gaplessAudio)}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                  gaplessAudio ? 'bg-[#1ed760]' : 'bg-[#535353]'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
                    gaplessAudio ? 'left-5' : 'left-0.5'
                  }`}
                />
              </button>
            </div>

            <div className="pt-2 border-t border-white/5">
              <p className="text-sm font-bold text-white mb-2">Calidad de audio</p>
              <div className="grid grid-cols-3 gap-2">
                {(['normal', 'alta', 'muy_alta'] as const).map((q) => (
                  <button
                    key={q}
                    onClick={() => setStreamingQuality(q)}
                    className={`py-2 rounded-lg text-xs font-bold transition-all ${
                      streamingQuality === q
                        ? 'bg-[#1ed760] text-black shadow'
                        : 'bg-[#121212] text-white hover:bg-white/10'
                    }`}
                  >
                    {q === 'normal' ? 'Normal' : q === 'alta' ? 'Alta' : 'Muy alta'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Almacenamiento & Caché */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider text-[#b3b3b3]">
            Almacenamiento
          </h3>

          <div className="p-4 rounded-xl bg-[#181818] border border-white/[0.04] space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-white">Caché de canciones y playlists</p>
                <p className="text-xs text-[#b3b3b3]">Libera espacio de almacenamiento local</p>
              </div>
              <button
                onClick={handleClearCache}
                className="px-4 py-2 rounded-full border border-white/30 text-white font-bold text-xs hover:border-white active:scale-95 transition-all"
              >
                {cacheCleared ? '¡Borrada!' : 'Borrar caché'}
              </button>
            </div>
          </div>
        </div>

        {/* Cerrar Sesión */}
        {isAuthenticated && (
          <div className="pt-4 pb-8 flex flex-col items-center">
            <button
              onClick={logout}
              className="px-8 py-3 rounded-full bg-white text-black font-bold text-xs uppercase tracking-wider active:scale-95 hover:bg-white/90 transition-all shadow-lg cursor-pointer"
            >
              Cerrar sesión
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
