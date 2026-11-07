import { SpotifreeAuthCard } from '../common/SpotifreeAuthCard';
import { AppIconSelector } from '../common/AppIconSelector';
import { SpotifyEqualizer } from '../common/SpotifyEqualizer';
import { DJEffectsSelector } from '../common/DJEffectsSelector';
import { DJVoicePicker } from '../common/DJVoicePicker';
import {
  getBackgroundPlaybackAllowed,
  getCarLyricsEnabled,
  isNativeMediaAvailable,
  requestBackgroundPlayback,
  setCarLyricsEnabled,
} from '../../services/nativeMedia';
import { getAppIconPlatform } from '../../utils/appIcon';
import React, { useState, useEffect } from 'react';
import { useSpotifyDataStore } from '../../store/useSpotifyDataStore';
import { useUIStore } from '../../store/useUIStore';
import { handleImageError } from '../../utils/imageFallback';
import { audioEngine } from '../../services/audioEngine';
import { getStorageUsage, clearOfflineCache } from '../../utils/offlineStorage';
import { useLanguageStore } from '../../utils/i18n';
import { useSharedSessionStore } from '../../services/sharedSessionService';

interface MobileSettingsViewProps {
  onBack: () => void;
  onOpenProfile: () => void;
}

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

  const [carLyrics, setCarLyrics] = useState(() => getCarLyricsEnabled());

  // APK: can music keep playing with the screen off? (battery optimization exemption)
  const [bgAllowed, setBgAllowed] = useState<boolean | null>(null);
  useEffect(() => {
    if (!isNativeMediaAvailable()) return;
    const check = () => void getBackgroundPlaybackAllowed().then(setBgAllowed);
    check();
    // Coming back from the system dialog
    const onVis = () => {
      if (!document.hidden) check();
    };
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);
  const [autoplaySimilar, setAutoplaySimilar] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.localStorage.getItem('spotifree_autoplay') !== 'false';
    }
    return true;
  });


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

        {/* Instalar la app: página /instalar (APK, iPhone, ordenador). En la APK ya está instalada. */}
        {getAppIconPlatform() !== 'native' && (
          <a
            href="/instalar.html"
            className="flex items-center gap-3 p-4 rounded-2xl bg-[#181818] border border-white/[0.06] active:scale-[0.98] active:bg-[#202020] transition-all"
          >
            <span className="w-11 h-11 rounded-xl bg-[#1ed760] flex items-center justify-center shrink-0">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="#000" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 3v12" />
                <path d="m7 10 5 5 5-5" />
                <path d="M5 21h14" />
              </svg>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-white">
                {language === 'en' ? 'Install the app' : 'Instalar la app'}
              </span>
              <span className="block text-xs text-[#b3b3b3] leading-snug mt-0.5">
                {language === 'en'
                  ? 'Android APK with Android Auto, iPhone and computer'
                  : 'APK para Android con Android Auto, iPhone y ordenador'}
              </span>
            </span>
            <svg viewBox="0 0 16 16" className="w-4 h-4 shrink-0 fill-[#b3b3b3]" aria-hidden="true">
              <path d="M5.47 2.47a.75.75 0 0 1 1.06 0l5 5a.75.75 0 0 1 0 1.06l-5 5a.75.75 0 1 1-1.06-1.06L9.94 8 5.47 3.53a.75.75 0 0 1 0-1.06z" />
            </svg>
          </a>
        )}

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

            {/* Efectos de las transiciones del DJ */}
            <div className="pt-3 border-t border-white/5">
              <DJEffectsSelector compact />
            </div>

            {/* Voz del DJ con IA */}
            <div className="pt-3 border-t border-white/5">
              <DJVoicePicker compact />
            </div>

            {/* APK: letra en la pantalla del coche / Bluetooth */}
            {isNativeMediaAvailable() && (
              <div className="pt-3 border-t border-white/5 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white">Letra en el coche</p>
                  <p className="text-xs text-[#b3b3b3] leading-snug">
                    Muestra la línea de la letra que suena en Android Auto y en la pantalla del Bluetooth del coche.
                  </p>
                </div>
                <button
                  onClick={() => {
                    const next = !carLyrics;
                    setCarLyrics(next);
                    setCarLyricsEnabled(next);
                  }}
                  role="switch"
                  aria-checked={carLyrics}
                  className={`w-10 h-6 rounded-full relative transition-colors shrink-0 ${carLyrics ? 'bg-[#1ed760]' : 'bg-[#535353]'}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${carLyrics ? 'left-[18px]' : 'left-0.5'}`} />
                </button>
              </div>
            )}

            {/* APK: música con la pantalla apagada */}
            {isNativeMediaAvailable() && bgAllowed !== null && (
              <div className="pt-3 border-t border-white/5 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white">Música con la pantalla apagada</p>
                  <p className="text-xs text-[#b3b3b3] leading-snug">
                    {bgAllowed
                      ? 'Activado: la música sigue con el móvil bloqueado y en el coche.'
                      : 'Permite a Spotifree funcionar en segundo plano para que tu móvil no la cierre al bloquearlo.'}
                  </p>
                </div>
                {bgAllowed ? (
                  <span className="shrink-0 text-xs font-bold text-[#1ed760]">Activado</span>
                ) : (
                  <button
                    onClick={() => {
                      void requestBackgroundPlayback();
                      // While music plays the page never goes "hidden": check for the answer for a while
                      let tries = 0;
                      const timer = window.setInterval(() => {
                        tries += 1;
                        void getBackgroundPlaybackAllowed().then((ok) => {
                          setBgAllowed(ok);
                          if (ok || tries >= 30) window.clearInterval(timer);
                        });
                      }, 2000);
                    }}
                    className="shrink-0 px-4 py-1.5 rounded-full bg-[#1ed760] text-black text-xs font-bold active:scale-95 transition-transform"
                  >
                    Permitir
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Ecualizador (estilo Spotify) */}
        <div className="p-4 rounded-2xl bg-[#121212] border border-white/[0.06]">
          <SpotifyEqualizer variant="mobile" />
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
