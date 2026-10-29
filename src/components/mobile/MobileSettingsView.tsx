import React, { useState } from 'react';
import { useSpotifyDataStore } from '../../store/useSpotifyDataStore';
import { useUIStore } from '../../store/useUIStore';
import { handleImageError } from '../../utils/imageFallback';
import { audioEngine } from '../../services/audioEngine';
import {
  getSavedAccounts,
  removeSavedAccount,
  saveAccount,
  cleanSpDc,
  switchActiveAccount,
  type SavedAccount,
} from '../../utils/userAccounts';
import { validateSpotifyCookie } from '../../services/spotifyCookieService';

interface MobileSettingsViewProps {
  onBack: () => void;
  onOpenProfile: () => void;
}

const PRESETS: Record<string, number[]> = {
  flat: [0, 0, 0, 0, 0, 0],
  bassBoost: [6, 4.5, 2, 0, 0, 0],
  acoustic: [3.5, 2.5, 0.5, 1.5, 3, 3.5],
  electronic: [5, 4, 1, 2, 4.5, 5.5],
  pop: [-1, 2, 4, 3, 1, -1],
  rock: [4.5, 3, -1, 1.5, 3.5, 5],
  vocal: [-2, 0.5, 3.5, 4, 2, -1],
  custom: [0, 0, 0, 0, 0, 0],
};

const PRESET_LABELS: Record<string, string> = {
  flat: 'Plano',
  bassBoost: 'Refuerzo de graves',
  acoustic: 'Acústico',
  electronic: 'Electrónica',
  pop: 'Pop',
  rock: 'Rock',
  vocal: 'Vocal',
  custom: 'Personalizado',
};

const FREQ_POINTS = [
  { label: '60 Hz', freq: 60 },
  { label: '150 Hz', freq: 150 },
  { label: '400 Hz', freq: 400 },
  { label: '1 kHz', freq: 1000 },
  { label: '2.4 kHz', freq: 2400 },
  { label: '15 kHz', freq: 15000 },
];

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

  // Audio & Playback Settings (Desktop Parity)
  const [normalizeAudio, setNormalizeAudio] = useState(true);
  const [normalizeLevel, setNormalizeLevel] = useState<'quiet' | 'normal' | 'loud'>('normal');
  const [gaplessAudio, setGaplessAudio] = useState(true);
  const [streamingQuality, setStreamingQuality] = useState<'baja' | 'normal' | 'alta' | 'muy_alta'>('muy_alta');
  const [audioEnginePref, setAudioEnginePref] = useState<'hybrid' | 'stream' | 'direct'>(() => {
    if (typeof window !== 'undefined') {
      return (window.localStorage.getItem('spotifree_audio_engine') as any) || 'hybrid';
    }
    return 'hybrid';
  });
  const [crossfadeSeconds, setCrossfadeSeconds] = useState(() => {
    if (typeof window !== 'undefined') {
      const v = window.localStorage.getItem('spotifree_crossfade_sec');
      return v ? parseInt(v, 10) : 0;
    }
    return 0;
  });
  const [autoplaySimilar, setAutoplaySimilar] = useState(true);
  const [offlineMode, setOfflineMode] = useState(false);

  // Equalizer
  const [eqEnabled, setEqEnabled] = useState(true);
  const [activePreset, setActivePreset] = useState('flat');
  const [eqBands, setEqBands] = useState<number[]>([0, 0, 0, 0, 0, 0]);

  // Storage
  const [cacheSize, setCacheSize] = useState('146.8 MB');
  const [cacheCleared, setCacheCleared] = useState(false);

  const activeUserId = user?.id || (typeof window !== 'undefined' ? window.localStorage.getItem('spotifree_active_user_id') : '') || 'default';
  let customAvatar: string | undefined;
  if (typeof window !== 'undefined') {
    try {
      const saved = window.localStorage.getItem(`spotifree_custom_profile_${activeUserId}`) || window.localStorage.getItem('spotifree_custom_profile');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.avatarUrl) customAvatar = parsed.avatarUrl;
      }
    } catch {}
  }
  const avatarUrl = customAvatar || user?.images?.[0]?.url;
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

      setSavedAccounts(getSavedAccounts());

      useSpotifyDataStore.setState({
        isAuthenticated: true,
        user: data.user,
        playlists: data.playlists || [],
        dynamicShelves: data.shelves || [],
        quickAccessCards: data.quickAccess || [],
        playlistDetailsCache: cacheToSave,
        isLoading: false,
      });

      setCookieStatus('¡Sesión vinculada con éxito!');
      setCookieInput('');
      setTimeout(() => setCookieStatus(null), 3000);
    } catch (err: any) {
      setCookieStatus(`Error: ${err.message || 'Error de conexión'}`);
    } finally {
      setIsVerifyingCookie(false);
    }
  };

  const handleSwitchAccount = async (acc: SavedAccount) => {
    if (acc.id === user?.id) return;
    try {
      await switchActiveAccount(acc);
      setSavedAccounts(getSavedAccounts());
    } catch (err) {
      console.error('Error switching account on mobile settings:', err);
    }
  };

  const handleDeleteAccount = (accountId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeSavedAccount(accountId);
    setSavedAccounts(getSavedAccounts());
  };

  const handleClearCache = () => {
    if (typeof window !== 'undefined') {
      try {
        const keysToRemove = Object.keys(window.localStorage).filter(
          (k) =>
            k.startsWith('spotifree_vibrant_color_') ||
            k.startsWith('spotifree_track_cover_') ||
            k.startsWith('spotifree_yt_cache')
        );
        keysToRemove.forEach((k) => window.localStorage.removeItem(k));
      } catch {}
    }
    setCacheSize('0.0 MB');
    setCacheCleared(true);
    setTimeout(() => setCacheCleared(false), 2500);
  };

  const handlePresetSelect = (presetKey: string) => {
    setActivePreset(presetKey);
    const values = PRESETS[presetKey] || PRESETS.flat;
    setEqBands(values);
    try {
      audioEngine.setAllEqualizerBands(
        FREQ_POINTS.map((f, i) => ({ label: f.label, value: values[i] }))
      );
    } catch {}
  };

  const handleBandSlider = (index: number, val: number) => {
    setActivePreset('custom');
    const updated = [...eqBands];
    updated[index] = val;
    setEqBands(updated);
    try {
      audioEngine.setAllEqualizerBands(
        FREQ_POINTS.map((f, i) => ({ label: f.label, value: updated[i] }))
      );
    } catch {}
  };

  return (
    <div className="select-none min-h-full pb-32 bg-[#121212] font-['SpotifyMixUI'] text-white">
      {/* Top Header */}
      <div className="sticky top-0 z-30 px-4 py-3 bg-[#121212]/90 backdrop-blur-md flex items-center justify-between border-b border-white/[0.06]">
        <button
          onClick={onBack}
          className="p-1.5 text-white hover:text-white/80 active:scale-90 transition-transform -ml-1 cursor-pointer"
          title="Atrás"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.54 21.15L6.39 12l9.15-9.15.71.71L7.81 12l8.44 8.44-.71.71z" />
          </svg>
        </button>
        <h2 className="text-base font-black text-white font-['SpotifyMixUITitle']">
          Configuración
        </h2>
        <div className="w-8" />
      </div>

      <div className="p-4 space-y-6">
        {/* User Card */}
        {isAuthenticated ? (
          <div
            onClick={onOpenProfile}
            className="flex items-center justify-between p-4 rounded-2xl bg-[#181818] border border-white/[0.08] cursor-pointer active:scale-[0.99] transition-transform hover:bg-[#222222]"
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
                  <span className="font-bold text-white text-base">
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
        <div className="p-4 rounded-2xl bg-gradient-to-br from-[#181818] to-[#121212] border border-white/[0.08] relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[#b3b3b3] uppercase tracking-wider">Tu Plan</span>
            <span className="px-2 py-0.5 rounded-full bg-[#1ed760] text-black font-black text-[10px] tracking-wider">
              PREMIUM
            </span>
          </div>
          <h3 className="text-lg font-black text-white font-['SpotifyMixUITitle']">
            Spotifree Premium Ilimitado
          </h3>
          <p className="text-xs text-[#b3b3b3] mt-1 leading-relaxed">
            Música sin anuncios, saltos de canciones ilimitados y reproducción de máxima fidelidad en segundo plano.
          </p>
        </div>

        {/* Sesión y Conexión de Spotify */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-[#b3b3b3] uppercase tracking-wider">
            Sesión y Conexión de Spotify
          </h3>

          <div className="p-4 rounded-2xl bg-[#181818] border border-white/[0.04] space-y-3">
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

        {/* Cuentas guardadas */}
        {savedAccounts.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-[#b3b3b3] uppercase tracking-wider">
              Cuentas guardadas ({savedAccounts.length})
            </h3>

            <div className="space-y-2">
              {savedAccounts.map((acc) => {
                const isCurrent = acc.id === user?.id;
                return (
                  <div
                    key={acc.id}
                    onClick={() => handleSwitchAccount(acc)}
                    className={`flex items-center justify-between p-3 rounded-2xl transition-all cursor-pointer ${
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
                          {isCurrent ? 'Sesión activa' : 'Guardada'}
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

        {/* Motor de Audio (Paridad PC) */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-[#b3b3b3] uppercase tracking-wider">
            Motor de Audio
          </h3>

          <div className="p-4 rounded-2xl bg-[#181818] border border-white/[0.04] space-y-3">
            {[
              { id: 'hybrid', title: 'Híbrido Inteligente (Recomendado)', desc: 'Máxima resiliencia en redes móviles y Wi-Fi' },
              { id: 'stream', title: 'WebAudio Hi-Fi', desc: 'Streaming directo HTML5 sin transcodificación' },
              { id: 'direct', title: 'Reproducción Directa', desc: 'Buffer nativo de bajo consumo de batería' },
            ].map((engine) => (
              <div
                key={engine.id}
                onClick={() => {
                  setAudioEnginePref(engine.id as any);
                  if (typeof window !== 'undefined') {
                    window.localStorage.setItem('spotifree_audio_engine', engine.id);
                  }
                }}
                className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                  audioEnginePref === engine.id
                    ? 'border-[#1ed760] bg-[#1ed760]/10'
                    : 'border-white/5 bg-[#121212] hover:border-white/20'
                }`}
              >
                <div className="min-w-0 pr-2">
                  <p className="text-xs font-bold text-white truncate">{engine.title}</p>
                  <p className="text-[11px] text-[#b3b3b3] mt-0.5">{engine.desc}</p>
                </div>
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  audioEnginePref === engine.id ? 'border-[#1ed760] bg-[#1ed760]' : 'border-white/40'
                }`}>
                  {audioEnginePref === engine.id && <div className="w-1.5 h-1.5 rounded-full bg-black" />}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Reproducción (Paridad PC) */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-[#b3b3b3] uppercase tracking-wider">
            Reproducción
          </h3>

          <div className="p-4 rounded-2xl bg-[#181818] border border-white/[0.04] space-y-4">
            {/* Normalizar volumen */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-white">Normalizar el volumen</p>
                <p className="text-xs text-[#b3b3b3]">Establece el mismo nivel sonoro para todas las canciones</p>
              </div>
              <button
                onClick={() => setNormalizeAudio(!normalizeAudio)}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
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

            {/* Nivel de volumen normalizado */}
            {normalizeAudio && (
              <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                <span className="text-xs text-[#b3b3b3]">Nivel de volumen</span>
                <div className="flex gap-1.5">
                  {(['quiet', 'normal', 'loud'] as const).map((lvl) => (
                    <button
                      key={lvl}
                      onClick={() => setNormalizeLevel(lvl)}
                      className={`px-3 py-1 rounded-full text-xs font-bold capitalize transition-colors ${
                        normalizeLevel === lvl ? 'bg-[#1ed760] text-black' : 'bg-[#242424] text-white'
                      }`}
                    >
                      {lvl === 'quiet' ? 'Silencioso' : lvl === 'normal' ? 'Normal' : 'Ruidoso'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Reproducción sin pausas / Gapless */}
            <div className="flex items-center justify-between pt-2 border-t border-white/5">
              <div>
                <p className="text-sm font-bold text-white">Reproducción sin pausas</p>
                <p className="text-xs text-[#b3b3b3]">Transición continua sin silencios entre pistas</p>
              </div>
              <button
                onClick={() => setGaplessAudio(!gaplessAudio)}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
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

            {/* Crossfade / Fundido entre canciones */}
            <div className="pt-2 border-t border-white/5 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-white">Fundido entre canciones</p>
                <span className="text-xs font-mono font-bold text-[#1ed760]">
                  {crossfadeSeconds === 0 ? 'Desactivado' : `${crossfadeSeconds} s`}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="12"
                step="1"
                value={crossfadeSeconds}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setCrossfadeSeconds(val);
                  if (typeof window !== 'undefined') {
                    window.localStorage.setItem('spotifree_crossfade_sec', String(val));
                  }
                }}
                className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-[#1ed760]"
              />
            </div>

            {/* Autoplay similar */}
            <div className="flex items-center justify-between pt-2 border-t border-white/5">
              <div>
                <p className="text-sm font-bold text-white">Reproducción automática</p>
                <p className="text-xs text-[#b3b3b3]">Sigue escuchando temas similares cuando termine la lista</p>
              </div>
              <button
                onClick={() => setAutoplaySimilar(!autoplaySimilar)}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                  autoplaySimilar ? 'bg-[#1ed760]' : 'bg-[#535353]'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
                    autoplaySimilar ? 'left-5' : 'left-0.5'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Calidad de Streaming (Paridad PC) */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-[#b3b3b3] uppercase tracking-wider">
            Calidad de Sonido
          </h3>

          <div className="p-4 rounded-2xl bg-[#181818] border border-white/[0.04] space-y-3">
            <p className="text-xs text-[#b3b3b3]">Selecciona la tasa de bits para la reproducción de música</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'baja', label: 'Baja', kbps: '24 kbit/s' },
                { id: 'normal', label: 'Normal', kbps: '96 kbit/s' },
                { id: 'alta', label: 'Alta', kbps: '160 kbit/s' },
                { id: 'muy_alta', label: 'Muy alta', kbps: '320 kbit/s' },
              ].map((q) => (
                <button
                  key={q.id}
                  onClick={() => setStreamingQuality(q.id as any)}
                  className={`p-2.5 rounded-xl text-left border transition-all ${
                    streamingQuality === q.id
                      ? 'border-[#1ed760] bg-[#1ed760]/10 text-white'
                      : 'border-white/5 bg-[#121212] text-[#b3b3b3] hover:border-white/20'
                  }`}
                >
                  <span className="block text-xs font-bold">{q.label}</span>
                  <span className="block text-[10px] text-white/50">{q.kbps}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Ecualizador Gráfico (Paridad PC) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-[#b3b3b3] uppercase tracking-wider">
              Ecualizador de Audio
            </h3>
            <button
              onClick={() => setEqEnabled(!eqEnabled)}
              className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${
                eqEnabled ? 'bg-[#1ed760]' : 'bg-[#535353]'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${
                  eqEnabled ? 'left-5' : 'left-0.5'
                }`}
              />
            </button>
          </div>

          {eqEnabled && (
            <div className="p-4 rounded-2xl bg-[#181818] border border-white/[0.04] space-y-4 animate-in fade-in">
              {/* Presets chips */}
              <div>
                <p className="text-xs text-[#b3b3b3] mb-2 font-medium">Presets</p>
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                  {Object.keys(PRESETS).map((k) => (
                    <button
                      key={k}
                      onClick={() => handlePresetSelect(k)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold shrink-0 transition-colors ${
                        activePreset === k ? 'bg-[#1ed760] text-black' : 'bg-[#242424] text-white hover:bg-white/10'
                      }`}
                    >
                      {PRESET_LABELS[k] || k}
                    </button>
                  ))}
                </div>
              </div>

              {/* 6-Band Frequency Sliders */}
              <div className="grid grid-cols-6 gap-2 pt-2 text-center">
                {FREQ_POINTS.map((f, idx) => (
                  <div key={f.label} className="flex flex-col items-center space-y-2">
                    <span className="text-[10px] font-mono text-[#1ed760]">
                      {eqBands[idx] > 0 ? `+${eqBands[idx]}` : eqBands[idx]} dB
                    </span>
                    <input
                      type="range"
                      min="-12"
                      max="12"
                      step="0.5"
                      value={eqBands[idx]}
                      onChange={(e) => handleBandSlider(idx, parseFloat(e.target.value))}
                      className="w-16 h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-[#1ed760] -rotate-90 my-8"
                    />
                    <span className="text-[10px] text-[#b3b3b3] font-bold">{f.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modo Sin Conexión */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-[#b3b3b3] uppercase tracking-wider">
            Modo Sin Conexión
          </h3>

          <div className="p-4 rounded-2xl bg-[#181818] border border-white/[0.04] flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-white">Modo sin conexión</p>
              <p className="text-xs text-[#b3b3b3]">Reproduce únicamente canciones guardadas en caché</p>
            </div>
            <button
              onClick={() => setOfflineMode(!offlineMode)}
              className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                offlineMode ? 'bg-[#1ed760]' : 'bg-[#535353]'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
                  offlineMode ? 'left-5' : 'left-0.5'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Almacenamiento & Caché */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-[#b3b3b3] uppercase tracking-wider">
            Almacenamiento
          </h3>

          <div className="p-4 rounded-2xl bg-[#181818] border border-white/[0.04] space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-white">Caché de canciones y portadas</p>
                <p className="text-xs text-[#b3b3b3]">{cacheSize} utilizados localmente</p>
              </div>
              <button
                onClick={handleClearCache}
                className="px-4 py-2 rounded-full border border-white/30 text-white font-bold text-xs hover:border-white active:scale-95 transition-all cursor-pointer"
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
              className="px-8 py-3 rounded-full bg-white text-black font-bold text-xs uppercase tracking-wider active:scale-95 hover:bg-white/90 transition-all shadow-lg cursor-pointer font-black"
            >
              Cerrar sesión
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
