import { SpotifreeAuthCard } from '../common/SpotifreeAuthCard';
import { AppIconSelector } from '../common/AppIconSelector';
import { getAppIconPlatform } from '../../utils/appIcon';
import React, { useState, useEffect, useRef } from 'react';
import { useSpotifyDataStore } from '../../store/useSpotifyDataStore';
import { useUIStore } from '../../store/useUIStore';
import { handleImageError } from '../../utils/imageFallback';
import { audioEngine } from '../../services/audioEngine';
import { getStorageUsage, clearOfflineCache } from '../../utils/offlineStorage';
import { useLanguageStore } from '../../utils/i18n';
import { useSharedSessionStore } from '../../services/sharedSessionService';

interface FrequencyPoint {
  label: string;
  value: number; // dB from -12 to +12
}

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


export const MobileSettingsView: React.FC<MobileSettingsViewProps> = ({
  onBack,
  onOpenProfile,
}) => {
  const { user, isAuthenticated, logout } = useSpotifyDataStore();
  const { openLoginModal, convertPhotosToBanners, setConvertPhotosToBanners } = useUIStore();
  const { language, setLanguage } = useLanguageStore();

  // Playback Settings
  const [normalizeAudio, setNormalizeAudio] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.localStorage.getItem('spotifree_normalize_volume') !== 'false';
    }
    return true;
  });

  const [normalizeLevel, setNormalizeLevel] = useState<'quiet' | 'normal' | 'loud'>('normal');

  const [gaplessAudio, setGaplessAudio] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.localStorage.getItem('spotifree_gapless') !== 'false';
    }
    return true;
  });

  const [crossfadeSeconds, setCrossfadeSeconds] = useState(() => {
    if (typeof window !== 'undefined') {
      const v = window.localStorage.getItem('spotifree_crossfade_sec');
      if (v) {
        const parsed = parseInt(v, 10);
        return parsed > 0 ? parsed : 5;
      }
    }
    return 5;
  });

  const [crossfadeEnabled, setCrossfadeEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.localStorage.getItem('spotifree_crossfade_enabled') !== 'false';
    }
    return true;
  });

  const [autoplaySimilar, setAutoplaySimilar] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.localStorage.getItem('spotifree_autoplay') !== 'false';
    }
    return true;
  });

  // Equalizer
  const [eqEnabled, setEqEnabled] = useState(true);
  const [activePreset, setActivePreset] = useState('flat');
  const [draggingBandIndex, setDraggingBandIndex] = useState<number | null>(null);
  const eqCanvasRef = useRef<HTMLDivElement>(null);
  const [eqBands, setEqBands] = useState<FrequencyPoint[]>(() => {
    const defaultBands: FrequencyPoint[] = [
      { label: '60Hz', value: 0 },
      { label: '150Hz', value: 0 },
      { label: '400Hz', value: 0 },
      { label: '1kHz', value: 0 },
      { label: '2.4kHz', value: 0 },
      { label: '15kHz', value: 0 },
    ];
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem('spotifree_eq_bands');
        if (raw) {
          const values: number[] = JSON.parse(raw);
          return defaultBands.map((b, idx) => ({ ...b, value: values[idx] ?? 0 }));
        }
      } catch {}
    }
    return defaultBands;
  });

  const syncEqWithEngine = (bands: FrequencyPoint[]) => {
    try {
      audioEngine.setAllEqualizerBands(bands);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('spotifree_eq_bands', JSON.stringify(bands.map(b => b.value)));
      }
    } catch {}
  };

  const handleBandChange = (index: number, newVal: number) => {
    setActivePreset('custom');
    setEqBands((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], value: newVal };
      syncEqWithEngine(copy);
      return copy;
    });
  };

  useEffect(() => {
    if (draggingBandIndex === null) return;

    const onPointerMove = (e: MouseEvent | TouchEvent) => {
      if (!eqCanvasRef.current) return;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const rect = eqCanvasRef.current.getBoundingClientRect();
      const padding = 16;
      const availableHeight = rect.height - padding * 2;
      const relY = Math.max(0, Math.min(availableHeight, clientY - (rect.top + padding)));
      const norm = 1 - relY / availableHeight; // 0 to 1
      const db = Math.round(((norm * 24) - 12) * 2) / 2; // -12 to +12 in 0.5 steps
      handleBandChange(draggingBandIndex, Math.max(-12, Math.min(12, db)));
    };

    const onPointerUp = () => {
      setDraggingBandIndex(null);
    };

    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    window.addEventListener('touchmove', onPointerMove, { passive: false });
    window.addEventListener('touchend', onPointerUp);

    return () => {
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('touchend', onPointerUp);
    };
  }, [draggingBandIndex]);

  const handlePresetSelect = (presetKey: string) => {
    setActivePreset(presetKey);
    const values = PRESETS[presetKey] || PRESETS.flat;
    const newBands = eqBands.map((b, idx) => ({ ...b, value: values[idx] ?? 0 }));
    setEqBands(newBands);
    syncEqWithEngine(newBands);
  };

  // Equalizer curve coordinates
  const eqWidth = 700;
  const eqHeight = 140;
  const zeroY = eqHeight / 2;

  const points = eqBands.map((band, idx) => {
    const x = 50 + (idx / (eqBands.length - 1)) * (eqWidth - 100);
    const y = zeroY - (band.value / 12) * (eqHeight / 2 - 15);
    return { x, y, value: band.value, label: band.label };
  });

  let curvePath = '';
  if (points.length > 0) {
    curvePath = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i === 0 ? 0 : i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2 < points.length ? i + 2 : i + 1];

      const cp1x = p1.x + (p2.x - p0.x) / 5;
      const cp1y = p1.y + (p2.y - p0.y) / 5;
      const cp2x = p2.x - (p3.x - p1.x) / 5;
      const cp2y = p2.y - (p3.y - p1.y) / 5;

      curvePath += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
  }

  // Storage & Cache
  const [cacheSize, setCacheSize] = useState('Calculando...');
  const [cacheCleared, setCacheCleared] = useState(false);

  useEffect(() => {
    getStorageUsage().then(({ formatted }) => {
      setCacheSize(formatted);
    });
  }, []);

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

  const handleClearCache = async () => {
    await clearOfflineCache();
    const { formatted } = await getStorageUsage();
    setCacheSize(formatted);
    setCacheCleared(true);
    setTimeout(() => setCacheCleared(false), 2500);
  };

  const handleToggleGapless = () => {
    const next = !gaplessAudio;
    setGaplessAudio(next);
    if (typeof window !== 'undefined') {
      // Gapless and crossfade are independent: never wipe the crossfade duration here
      window.localStorage.setItem('spotifree_gapless', String(next));
    }
  };

  const handleToggleCrossfade = () => {
    const next = !crossfadeEnabled;
    setCrossfadeEnabled(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('spotifree_crossfade_enabled', String(next));
    }
  };

  const handleToggleNormalize = () => {
    const next = !normalizeAudio;
    setNormalizeAudio(next);
    audioEngine.setVolumeNormalization?.(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('spotifree_normalize_volume', String(next));
    }
  };

  const handleToggleAutoplay = () => {
    const next = !autoplaySimilar;
    setAutoplaySimilar(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('spotifree_autoplay', String(next));
    }
  };

  const isGuestInSession = useSharedSessionStore((s) => s.isInSession && !s.isHost);
  if (isGuestInSession) {
    return (
      <div className="select-none min-h-full flex flex-col items-center justify-center p-8 text-center bg-[#121212] font-['SpotifyMixUI'] text-white">
        <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-4 shadow-xl text-[#b3b3b3]">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
          </svg>
        </div>
        <h2 className="text-xl font-black text-white mb-2 font-['SpotifyMixUITitle']">
          Configuración protegida
        </h2>
        <p className="text-xs text-[#b3b3b3] max-w-xs leading-relaxed mb-6">
          Estás participando en una sesión compartida como invitado. Por motivos de seguridad y privacidad del anfitrión, el panel de configuración está bloqueado.
        </p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            onClick={() => useSharedSessionStore.getState().setModalOpen(true)}
            className="w-full py-2.5 rounded-full bg-[#1ed760] text-black font-bold text-xs hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-lg shadow-[#1ed760]/20"
          >
            Ver sesión compartida
          </button>
          <button
            onClick={onBack}
            className="w-full py-2.5 rounded-full bg-white/10 text-white font-bold text-xs hover:bg-white/20 active:scale-95 transition-all cursor-pointer"
          >
            Volver a la música
          </button>
        </div>
      </div>
    );
  }

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
              Accede a tus playlists sincronizadas, canciones que te gustan y ajustes guardados en la nube.
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

        {/* Tu Cuenta Spotifree */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1 mb-1">
            <span className="text-xs font-bold text-[#b3b3b3] uppercase tracking-wider">Cuenta Spotifree</span>
            <span className="text-[10px] text-[#1ed760] font-bold uppercase tracking-wider">SINCRONIZACIÓN ACTIVADA</span>
          </div>
          <div className="rounded-2xl overflow-hidden border border-white/[0.06] bg-[#181818]">
            <div className="px-4 pt-4 pb-2">
              <p className="text-xs text-[#b3b3b3] leading-relaxed">
                Guarda tus playlists, canciones favoritas, historial y ajustes. Accede desde cualquier dispositivo con tu correo y contraseña.
              </p>
            </div>
            <div className="px-4 pb-4">
              <SpotifreeAuthCard />
            </div>
          </div>
        </div>

        {/* Idioma / Language */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-[#b3b3b3] uppercase tracking-wider px-1">
            {language === 'en' ? 'Language' : 'Idioma'}
          </h3>
          <div className="p-3 sm:p-4 rounded-2xl bg-[#181818] border border-white/[0.04] flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-white">
                {language === 'en' ? 'App Language' : 'Idioma de la aplicación'}
              </p>
              <p className="text-xs text-[#a7a7a7] mt-0.5">
                {language === 'en' ? 'Select interface & DJ voice language' : 'Selecciona el idioma de la app y la voz del DJ'}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setLanguage('es')}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  language === 'es' ? 'bg-[#1ed760] text-black shadow-md' : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                Español
              </button>
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  language === 'en' ? 'bg-[#1ed760] text-black shadow-md' : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                English
              </button>
            </div>
          </div>
        </div>



        {/* Visualización */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-[#b3b3b3] uppercase tracking-wider">
            Visualización
          </h3>

          <div className="p-4 rounded-2xl bg-[#181818] border border-white/[0.04] space-y-4">
            <div className="flex items-center justify-between">
              <div className="pr-3">
                <p className="text-sm font-bold text-white">Convertir fotos a banners</p>
                <p className="text-xs text-[#b3b3b3] mt-0.5">
                  Muestra las carátulas como banners panorámicos a pantalla completa en lugar del cuadro clásico.
                </p>
              </div>
              <button
                onClick={() => setConvertPhotosToBanners(!convertPhotosToBanners)}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                  convertPhotosToBanners ? 'bg-[#1ed760]' : 'bg-[#535353]'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
                    convertPhotosToBanners ? 'left-5' : 'left-0.5'
                  }`}
                />
              </button>
            </div>

            {/* Icono de la app: solo en navegador (antes de instalar) y en la APK */}
            {getAppIconPlatform() !== 'installed-pwa' && (
              <div className="pt-4 border-t border-white/5">
                <AppIconSelector variant="mobile" />
              </div>
            )}
          </div>
        </div>

        {/* Reproducción */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-[#b3b3b3] uppercase tracking-wider">
            Reproducción
          </h3>

          <div className="p-4 rounded-2xl bg-[#181818] border border-white/[0.04] space-y-4">
            {/* Normalizar volumen */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-white">Normalizar el volumen</p>
                <p className="text-xs text-[#b3b3b3]">Compresión dinámica de picos para nivel sonoro constante</p>
              </div>
              <button
                onClick={handleToggleNormalize}
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
                onClick={handleToggleGapless}
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

            {/* Fundido entre canciones (Solo visible si Reproducción sin pausas está activa) */}
            {gaplessAudio && (
              <div className="pt-2 border-t border-white/5 space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-white">Fundido entre canciones</p>
                    <p className="text-xs text-[#b3b3b3]">Transición simultánea sin pausas ni cortes</p>
                  </div>
                  <button
                    onClick={handleToggleCrossfade}
                    className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                      crossfadeEnabled ? 'bg-[#1ed760]' : 'bg-[#535353]'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
                        crossfadeEnabled ? 'left-5' : 'left-0.5'
                      }`}
                    />
                  </button>
                </div>

                {crossfadeEnabled && (
                  <div className="p-3 rounded-xl bg-[#181818] border border-white/5 space-y-2.5 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#b3b3b3]">
                        Duración del fundido
                      </span>
                      <span className="text-xs font-['SpotifyMixUI'] tabular-nums font-bold text-[#1ed760]">
                        {`${crossfadeSeconds} s`}
                      </span>
                    </div>

                    <input
                      type="range"
                      min="1"
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
                      style={{
                        background: `linear-gradient(to right, #1ed760 ${((crossfadeSeconds - 1) / 11) * 100}%, rgba(255, 255, 255, 0.2) ${((crossfadeSeconds - 1) / 11) * 100}%)`,
                      }}
                      className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-[#1ed760] touch-none"
                    />

                    <p className="text-[11px] text-[#a7a7a7]">
                      {`Fundido continuo de ${crossfadeSeconds} segundos entre canciones.`}
                    </p>

                    <div className="flex items-center gap-1.5 overflow-x-auto pt-1 scrollbar-none">
                      {[2, 4, 6, 8, 10, 12].map((s) => (
                        <button
                          key={s}
                          onClick={() => {
                            setCrossfadeSeconds(s);
                            if (typeof window !== 'undefined') window.localStorage.setItem('spotifree_crossfade_sec', String(s));
                          }}
                          className={`px-3 py-1 rounded-full text-xs font-bold shrink-0 transition-all cursor-pointer ${
                            crossfadeSeconds === s ? 'bg-[#1ed760] text-black shadow' : 'bg-[#242424] text-white/70'
                          }`}
                        >
                          {s} s
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Autoplay similar */}
            <div className="flex items-center justify-between pt-2 border-t border-white/5">
              <div>
                <p className="text-sm font-bold text-white">Reproducción automática</p>
                <p className="text-xs text-[#b3b3b3]">Sigue escuchando temas similares cuando termine la lista</p>
              </div>
              <button
                onClick={handleToggleAutoplay}
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

        {/* Ecualizador Gráfico (Idéntico a Escritorio) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-[#b3b3b3] uppercase tracking-wider">
                Ecualizador de audio
              </h3>
              <p className="text-[11px] text-[#727272] mt-0.5">
                Ajusta frecuencias y decibelios en tiempo real para todos los reproductores.
              </p>
            </div>
            <button
              onClick={() => setEqEnabled(!eqEnabled)}
              className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer shrink-0 ${
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
            <div className="space-y-4 animate-in fade-in select-none">
              {/* Presets Chips & Selector */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-[#b3b3b3] font-medium">Preajuste:</span>
                <select
                  value={activePreset}
                  onChange={(e) => handlePresetSelect(e.target.value)}
                  className="bg-[#242424] text-xs font-bold text-white px-3 py-1.5 rounded-lg border border-white/10 outline-none cursor-pointer focus:border-[#1ed760]"
                >
                  {Object.entries(PRESET_LABELS).map(([k, label]) => (
                    <option key={k} value={k} className="bg-[#181818] text-white">
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {/* 4 Quick Preset Cards (Voz, Música, Graves, Plano) */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handlePresetSelect('vocal')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    activePreset === 'vocal'
                      ? 'border-[#1ed760] bg-[#1ed760]/10 text-white shadow'
                      : 'border-white/10 bg-[#181818] text-[#b3b3b3] hover:border-white/20 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={activePreset === 'vocal' ? 'text-[#1ed760]' : 'text-[#b3b3b3]'}>
                      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                      <line x1="12" y1="19" x2="12" y2="22"/>
                    </svg>
                    <span className="text-xs font-bold text-white">Realzar voz</span>
                  </div>
                  <span className="block text-[10px] text-[#a7a7a7]">Frecuencias medias y voces claras</span>
                </button>

                <button
                  onClick={() => handlePresetSelect('rock')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    activePreset === 'rock'
                      ? 'border-[#1ed760] bg-[#1ed760]/10 text-white shadow'
                      : 'border-white/10 bg-[#181818] text-[#b3b3b3] hover:border-white/20 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={activePreset === 'rock' ? 'text-[#1ed760]' : 'text-[#b3b3b3]'}>
                      <path d="M9 18V5l12-2v13"/>
                      <circle cx="6" cy="18" r="3"/>
                      <circle cx="18" cy="16" r="3"/>
                    </svg>
                    <span className="text-xs font-bold text-white">Realzar música</span>
                  </div>
                  <span className="block text-[10px] text-[#a7a7a7]">Armonías, brillo e instrumentos</span>
                </button>

                <button
                  onClick={() => handlePresetSelect('bassBoost')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    activePreset === 'bassBoost'
                      ? 'border-[#1ed760] bg-[#1ed760]/10 text-white shadow'
                      : 'border-white/10 bg-[#181818] text-[#b3b3b3] hover:border-white/20 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={activePreset === 'bassBoost' ? 'text-[#1ed760]' : 'text-[#b3b3b3]'}>
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
                    </svg>
                    <span className="text-xs font-bold text-white">Graves profundos</span>
                  </div>
                  <span className="block text-[10px] text-[#a7a7a7]">Subgraves y pegada potente</span>
                </button>

                <button
                  onClick={() => handlePresetSelect('flat')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    activePreset === 'flat'
                      ? 'border-[#1ed760] bg-[#1ed760]/10 text-white shadow'
                      : 'border-white/10 bg-[#181818] text-[#b3b3b3] hover:border-white/20 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={activePreset === 'flat' ? 'text-[#1ed760]' : 'text-[#b3b3b3]'}>
                      <line x1="3" y1="12" x2="21" y2="12"/>
                      <circle cx="12" cy="12" r="2.5" fill="currentColor"/>
                    </svg>
                    <span className="text-xs font-bold text-white">Plano (Fidelidad)</span>
                  </div>
                  <span className="block text-[10px] text-[#a7a7a7]">Respuesta neutra (0 dB)</span>
                </button>
              </div>

              {/* Equalizer Container Card */}
              <div className="bg-[#181818] rounded-xl p-4 sm:p-6 border border-white/5 shadow-2xl relative select-none">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs sm:text-sm font-bold text-white font-['SpotifyMixUITitle']">
                    Curva de ecualización
                  </span>
                  <button
                    onClick={() => handlePresetSelect('flat')}
                    className="text-[11px] text-[#b3b3b3] hover:text-[#1ed760] transition-colors cursor-pointer"
                  >
                    Restablecer a plano (0 dB)
                  </button>
                </div>

                {/* Flex container: dB Axis Scale + Canvas */}
                <div className="flex gap-1.5 items-center">
                  {/* dB Scale Axis */}
                  <div className="h-[170px] flex flex-col justify-between text-[9px] font-mono text-[#727272] select-none text-right shrink-0 w-8 pb-6 pt-1">
                    <span>+12 dB</span>
                    <span>+6 dB</span>
                    <span className="text-[#a7a7a7] font-bold">0 dB</span>
                    <span>-6 dB</span>
                    <span>-12 dB</span>
                  </div>

                  {/* Interactive Curve Canvas & Draggable Nodes */}
                  <div
                    ref={eqCanvasRef}
                    className="relative flex-1 h-[170px] bg-[#121212] rounded-lg p-3 border border-white/10 overflow-hidden shadow-inner touch-none"
                  >
                    {/* Horizontal dB Grid Lines */}
                    <div className="absolute inset-x-3 top-3 bottom-3 flex flex-col justify-between pointer-events-none">
                      <div className="border-b border-dashed border-white/10 w-full" />
                      <div className="border-b border-dashed border-white/10 w-full" />
                      <div className="border-b border-white/25 w-full" />
                      <div className="border-b border-dashed border-white/10 w-full" />
                      <div className="border-b border-dashed border-white/10 w-full" />
                    </div>

                    {/* SVG Curve Background */}
                    <svg
                      viewBox={`0 0 ${eqWidth} ${eqHeight}`}
                      preserveAspectRatio="none"
                      className="absolute inset-x-3 inset-y-3 w-[calc(100%-24px)] h-[calc(100%-24px)] pointer-events-none"
                    >
                      <defs>
                        <linearGradient id="eqMobileGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#1ed760" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="#1ed760" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>

                      {/* Area fill */}
                      <path
                        d={`${curvePath} L ${points[points.length - 1].x} ${zeroY} L ${points[0].x} ${zeroY} Z`}
                        fill="url(#eqMobileGrad)"
                      />

                      {/* Frequency Curve */}
                      <path
                        d={curvePath}
                        fill="none"
                        stroke="#1ed760"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>

                    {/* Vertical frequency guide tracks + Draggable Circular Handles */}
                    <div className="absolute inset-x-3 inset-y-3 flex justify-between pointer-events-none">
                      {eqBands.map((band, idx) => {
                        const norm = (band.value + 12) / 24; // 0 to 1
                        const topPercent = (1 - norm) * 100;
                        const isDraggingThis = draggingBandIndex === idx;

                        return (
                          <div
                            key={idx}
                            className="relative h-full flex flex-col items-center pointer-events-auto"
                            style={{ width: `${100 / eqBands.length}%` }}
                          >
                            {/* Vertical line track */}
                            <div
                              onClick={(e) => {
                                if (!eqCanvasRef.current) return;
                                const rect = eqCanvasRef.current.getBoundingClientRect();
                                const padding = 12;
                                const availH = rect.height - padding * 2;
                                const relY = Math.max(0, Math.min(availH, e.clientY - (rect.top + padding)));
                                const n = 1 - relY / availH;
                                const db = Math.round(((n * 24) - 12) * 2) / 2;
                                handleBandChange(idx, Math.max(-12, Math.min(12, db)));
                              }}
                              className="absolute inset-y-0 w-1.5 bg-white/[0.06] hover:bg-white/20 transition-colors cursor-pointer rounded-full"
                            />

                            {/* Draggable Circle Handle */}
                            <div
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setDraggingBandIndex(idx);
                              }}
                              onTouchStart={() => setDraggingBandIndex(idx)}
                              style={{ top: `${topPercent}%` }}
                              className="absolute -translate-y-1/2 cursor-grab active:cursor-grabbing z-30 group p-2 -m-2 touch-none"
                            >
                              {/* Floating dB Badge */}
                              <div
                                className={`absolute -top-6 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-full bg-black/95 text-[#1ed760] border border-[#1ed760]/40 font-mono font-black text-[9px] whitespace-nowrap shadow-2xl pointer-events-none transition-all ${
                                  isDraggingThis ? 'opacity-100 scale-110' : 'opacity-0 scale-95'
                                }`}
                              >
                                {band.value > 0 ? `+${band.value.toFixed(1)}` : band.value.toFixed(1)} dB
                              </div>

                              {/* Control Node */}
                              <div
                                className={`w-5 h-5 rounded-full border-[3px] transition-all duration-150 ${
                                  isDraggingThis
                                    ? 'scale-125 bg-[#1ed760] border-white shadow-[0_0_14px_#1ed760]'
                                    : 'bg-white border-[#1ed760] shadow-md'
                                }`}
                              />
                            </div>

                            {/* Frequency label at bottom */}
                            <span className="absolute -bottom-5 text-[10px] font-mono text-[#b3b3b3] pointer-events-none font-medium">
                              {band.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-[#727272] text-center pt-3 font-medium">
                  Haz clic o arrastra los puntos directamente en la curva para modular frecuencias en tiempo real.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Almacenamiento & Caché Real */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-[#b3b3b3] uppercase tracking-wider">
            Almacenamiento y Caché
          </h3>

          <div className="p-4 rounded-2xl bg-[#181818] border border-white/[0.04] space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-white">Caché de canciones y portadas</p>
                <p className="text-xs text-[#b3b3b3]">{cacheSize} ocupados en «musica-spotifree»</p>
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
