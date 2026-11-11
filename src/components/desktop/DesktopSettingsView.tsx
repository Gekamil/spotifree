import { SpotifreeAuthCard } from '../common/SpotifreeAuthCard';
import { AppIconSelector } from '../common/AppIconSelector';
import { SpotifyEqualizer } from '../common/SpotifyEqualizer';
import { NativeSpotifyLoginButton } from '../common/NativeSpotifyLoginButton';
import { DJEffectsSelector } from '../common/DJEffectsSelector';
import { DJVoicePicker } from '../common/DJVoicePicker';
import { MotionCoverSetting } from '../common/MotionCoverSetting';
import { AboutAppSection } from '../common/AboutAppSection';
import { ListeningFriendsSection } from '../common/ListeningFriendsSection';
import { AdvancedSettingsSection } from '../common/AdvancedSettingsSection';
import { CloudSyncBadge } from '../common/CloudSyncBadge';
import { RecoverPlaylistsSection } from '../common/RecoverPlaylistsSection';
import React, { useState, useRef, useEffect } from 'react';
import { useUIStore } from '../../store/useUIStore';
import { getStorageUsage, clearOfflineCache } from '../../utils/offlineStorage';
import { useSpotifyDataStore } from '../../store/useSpotifyDataStore';
import { audioEngine } from '../../services/audioEngine';
import {
  validateSpotifyCookie,
  extractSpotifySessionFromCookie,
} from '../../services/spotifyCookieService';
import { cleanSpDc } from '../../utils/userAccounts';
import { getSavedSpotifreeAccount, syncSpotifreeAccount } from '../../services/spotifreeAuth';
import { useLanguageStore } from '../../utils/i18n';
import { useSharedSessionStore } from '../../services/sharedSessionService';

const SpotifyToggle: React.FC<{
  checked: boolean;
  onChange: (val: boolean) => void;
  ariaLabel?: string;
}> = ({ checked, onChange, ariaLabel }) => {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-[24px] w-[42px] shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${
        checked ? 'bg-[#1ed760]' : 'bg-[#535353] hover:bg-[#727272]'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-[20px] w-[20px] rounded-full bg-white shadow transform transition duration-200 ease-in-out mt-[2px] ${
          checked ? 'translate-x-[20px]' : 'translate-x-[2px]'
        }`}
      />
    </button>
  );
};

interface SelectOption {
  value: string;
  label: string;
}

const SpotifyCustomSelect: React.FC<{
  value: string;
  options: SelectOption[];
  onChange: (val: string) => void;
  minWidth?: string;
}> = ({ value, options, onChange, minWidth = '220px' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isOpen]);

  const selectedOption = options.find((o) => o.value === value) || options[0];

  return (
    <div ref={containerRef} className="relative inline-block text-left select-none">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{ minWidth }}
        className="h-8 px-3 rounded-[4px] bg-[#242424] hover:bg-[#2a2a2a] text-white text-xs font-semibold flex items-center justify-between gap-3 border border-[#727272] hover:border-white transition-colors cursor-pointer shadow-sm"
      >
        <span className="truncate">{selectedOption?.label}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 16 16"
          fill="currentColor"
          className={`text-[#b3b3b3] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        >
          <path d="M.47 4.97a.75.75 0 0 1 1.06 0L8 11.44l6.47-6.47a.75.75 0 1 1 1.06 1.06L8.53 12.5a.75.75 0 0 1-1.06 0L.47 6.03a.75.75 0 0 1 0-1.06" />
        </svg>
      </button>

      {isOpen && (
        <div
          style={{ minWidth }}
          className="absolute right-0 mt-1.5 bg-[#282828] rounded-[4px] shadow-[0_16px_24px_rgba(0,0,0,0.6),0_6px_8px_rgba(0,0,0,0.4)] border border-white/10 p-1 z-50 animate-in fade-in zoom-in-95 duration-100 max-h-64 overflow-y-auto"
        >
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-[2px] text-xs font-semibold text-left transition-colors cursor-pointer ${
                  isSelected ? 'bg-white/10 text-[#1ed760]' : 'text-white hover:bg-[#3e3e3e]'
                }`}
              >
                <span className="truncate">{opt.label}</span>
                {isSelected && (
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="text-[#1ed760] shrink-0 ml-2">
                    <path d="M15.53 2.47a.75.75 0 0 1 0 1.06L4.907 14.153.47 9.716a.75.75 0 0 1 1.06-1.06l3.377 3.376L14.47 2.47a.75.75 0 0 1 1.06 0" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const DesktopSettingsView: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const { setActiveMainTab, viewMode, setViewMode, convertPhotosToBanners, setConvertPhotosToBanners } = useUIStore();
  const { user } = useSpotifyDataStore();

  const [spotifyCookie, setSpotifyCookie] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const local = window.localStorage.getItem('user_spotify_cookie');
      if (local) return local;
    }
    const acc = getSavedSpotifreeAccount();
    return acc?.spotifyCookie || '';
  });
  const [showCookieText, setShowCookieText] = useState(false);
  const [copiedCookie, setCopiedCookie] = useState(false);
  const [savedSpotifyCookieSuccess, setSavedSpotifyCookieSuccess] = useState(false);
  const [cookieError, setCookieError] = useState<string | null>(null);
  const [isExtractingCookie, setIsExtractingCookie] = useState(false);
  const [showMobileQr, setShowMobileQr] = useState(false);
  const [copiedMobileLink, setCopiedMobileLink] = useState(false);

  const handleCopyCookie = () => {
    if (!spotifyCookie) return;
    navigator.clipboard.writeText(spotifyCookie);
    setCopiedCookie(true);
    setTimeout(() => setCopiedCookie(false), 2000);
  };

  const handleSaveSpotifyCookie = async () => {
    setCookieError(null);
    const val = cleanSpDc(spotifyCookie);
    const validation = validateSpotifyCookie(val);
    if (!validation.valid) {
      setCookieError(validation.error || 'Cookie no válida.');
      return;
    }

    setIsExtractingCookie(true);
    try {
      const session = await extractSpotifySessionFromCookie(val);

      const cloudAcc = getSavedSpotifreeAccount();
      if (cloudAcc) {
        await syncSpotifreeAccount({
          email: cloudAcc.email,
          uid: cloudAcc.uid,
          spotifyCookie: val,
        });
      }

      // Re-saving the cookie never resets the library: same account → merged with your changes
      useSpotifyDataStore.getState().applyCookieSession(
        session,
        val,
        cloudAcc
          ? {
              id: cloudAcc.uid || session.user.id,
              display_name: cloudAcc.displayName,
              email: cloudAcc.email,
              images: cloudAcc.avatarUrl ? [{ url: cloudAcc.avatarUrl }] : session.user.images,
              followers: session.user.followers || { total: 0 },
            }
          : undefined
      );
      setSavedSpotifyCookieSuccess(true);
      setTimeout(() => {
        setSavedSpotifyCookieSuccess(false);
        setActiveMainTab('home');
      }, 1000);
    } catch (err: any) {
      setCookieError(err.message || 'Error al procesar la cookie.');
    } finally {
      setIsExtractingCookie(false);
    }
  };


  const { language, setLanguage } = useLanguageStore();

  const handleLanguageSelect = (val: string) => {
    if (val.startsWith('en')) {
      setLanguage('en');
    } else {
      setLanguage('es');
    }
  };
  const [showNowPlayingOnClick, setShowNowPlayingOnClick] = useState(true);
  const [musicVideos, setMusicVideos] = useState(true);
  const [canvasEnabled, setCanvasEnabled] = useState(true);

  // Streaming & Download quality matching official Spotify Desktop
  const [streamingQuality, setStreamingQuality] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.localStorage.getItem('spotifree_streaming_quality') || 'very_high';
    }
    return 'very_high';
  });

  const [downloadQuality, setDownloadQuality] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.localStorage.getItem('spotifree_download_quality') || 'very_high';
    }
    return 'very_high';
  });

  const [normalizeLevel, setNormalizeLevel] = useState<'quiet' | 'normal' | 'loud'>(() => {
    if (typeof window !== 'undefined') {
      return (window.localStorage.getItem('spotifree_normalize_level') as any) || 'normal';
    }
    return 'normal';
  });

  const [automixEnabled, setAutomixEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.localStorage.getItem('spotifree_automix_enabled') !== 'false';
    }
    return true;
  });

  const [hardwareAccel, setHardwareAccel] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.localStorage.getItem('spotifree_hardware_accel') !== 'false';
    }
    return true;
  });

  const [privateSession, setPrivateSession] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.localStorage.getItem('spotifree_private_session') === 'true';
    }
    return false;
  });

  const handleSelectStreamingQuality = (val: string) => {
    setStreamingQuality(val);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('spotifree_streaming_quality', val);
    }
  };

  const handleSelectDownloadQuality = (val: string) => {
    setDownloadQuality(val);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('spotifree_download_quality', val);
    }
  };

  const handleSelectNormalizeLevel = (lvl: 'quiet' | 'normal' | 'loud') => {
    setNormalizeLevel(lvl);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('spotifree_normalize_level', lvl);
    }
  };

  const handleToggleAutomix = (val: boolean) => {
    setAutomixEnabled(val);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('spotifree_automix_enabled', String(val));
    }
  };

  const handleToggleHardwareAccel = (val: boolean) => {
    setHardwareAccel(val);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('spotifree_hardware_accel', String(val));
    }
  };

  const handleTogglePrivateSession = (val: boolean) => {
    setPrivateSession(val);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('spotifree_private_session', String(val));
    }
  };

  // Playback & Audio settings
  const [normalizeAudio, setNormalizeAudio] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.localStorage.getItem('spotifree_normalize_volume') !== 'false';
    }
    return true;
  });

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

  const handleToggleCrossfade = (val: boolean) => {
    setCrossfadeEnabled(val);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('spotifree_crossfade_enabled', String(val));
    }
  };

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

  const handleClearCache = async () => {
    await clearOfflineCache();
    const { formatted } = await getStorageUsage();
    setCacheSize(formatted);
    setCacheCleared(true);
    setTimeout(() => setCacheCleared(false), 2500);
  };

  const handleToggleGapless = (val: boolean) => {
    setGaplessAudio(val);
    if (typeof window !== 'undefined') {
      // Gapless and crossfade are independent: never wipe the crossfade duration here
      window.localStorage.setItem('spotifree_gapless', String(val));
    }
  };

  const handleToggleNormalize = (val: boolean) => {
    setNormalizeAudio(val);
    audioEngine.setVolumeNormalization?.(val);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('spotifree_normalize_volume', String(val));
    }
  };

  const handleToggleAutoplay = (val: boolean) => {
    setAutoplaySimilar(val);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('spotifree_autoplay', String(val));
    }
  };


  const matchesSearch = (text: string) => {
    if (!searchQuery.trim()) return true;
    return text.toLowerCase().includes(searchQuery.toLowerCase());
  };


  const LANGUAGE_OPTIONS = [
    { value: 'es-ES', label: 'Español de España (European Spanish)' },
    { value: 'en-US', label: 'English (English)' },
    { value: 'es-419', label: 'Español de Latinoamérica (Latin American)' },
    { value: 'fr-FR', label: 'Français (French)' },
    { value: 'de-DE', label: 'Deutsch (German)' },
    { value: 'it-IT', label: 'Italiano (Italian)' },
    { value: 'pt-BR', label: 'Português do Brasil (Brazilian Portuguese)' },
    { value: 'ja-JP', label: '日本語 (Japanese)' },
  ];


  const isGuestInSession = useSharedSessionStore((s) => s.isInSession && !s.isHost);
  if (isGuestInSession) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center p-12 text-center select-none font-['SpotifyMixUI']">
        <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-4 shadow-xl text-[#b3b3b3]">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
          </svg>
        </div>
        <h2 className="text-2xl font-black text-white mb-2 font-['SpotifyMixUITitle']">
          Configuración protegida
        </h2>
        <p className="text-sm text-[#b3b3b3] max-w-md leading-relaxed mb-6">
          Estás participando en una sesión compartida como invitado. Por motivos de seguridad y privacidad del anfitrión, el panel de configuración está bloqueado.
        </p>
        <button
          onClick={() => {
            // On the computer the session lives in the right panel
            const ui = useUIStore.getState();
            if (ui.activeRightSidebar !== 'friends') ui.toggleRightSidebar('friends');
          }}
          className="h-12 px-8 rounded-full bg-white text-black font-bold text-[15px] hover:scale-[1.04] active:scale-95 transition-transform cursor-pointer"
        >
          Ver la sesión
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gradient-to-b from-[#1e1e1e] via-[#121212] to-[#121212] text-white p-6 md:p-8 select-none max-w-4xl mx-auto pb-24 font-['SpotifyMixUI',sans-serif]">
      {/* Title & Search Bar */}
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-white mb-4 font-['SpotifyMixUITitle']">
          Configuración
        </h1>
        <div className="relative max-w-sm">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-[#b3b3b3]">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M7 1.75a5.25 5.25 0 1 0 0 10.5 5.25 5.25 0 0 0 0-10.5M.25 7a6.75 6.75 0 1 1 12.096 4.12l3.184 3.185a.75.75 0 1 1-1.06 1.06L11.304 12.2A6.75 6.75 0 0 1 .25 7" />
            </svg>
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar opciones de configuración"
            className="w-full bg-[#242424] hover:bg-[#2a2a2a] focus:bg-[#242424] text-sm text-white placeholder-[#727272] pl-10 pr-4 py-2 rounded-full border border-transparent focus:border-white focus:outline-none transition-colors"
          />
        </div>
      </div>

      <div className="space-y-8">
        {/* 1. CUENTA (Official Spotify Desktop Category 1) */}
        {matchesSearch('cuenta sesión spotify cookie sp_dc usuario desconectar account') && (
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3 max-w-xl">
              <h2 className="text-base font-bold text-white font-['SpotifyMixUITitle']">Cuenta</h2>
              <CloudSyncBadge />
            </div>
            <div className="max-w-xl">
              <SpotifreeAuthCard showCookieInput={false} />
            </div>

            {/* Row 2: Sincronización mediante cookie sp_dc */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-3 border-b border-white/5">
              <div className="space-y-1 max-w-md">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white">Cookie de sesión (sp_dc)</span>
                  {savedSpotifyCookieSuccess && (
                    <span className="text-xs font-bold text-[#1ed760] animate-in fade-in">
                      ✓ Guardada
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#a7a7a7] leading-relaxed">
                  Permite sincronizar tu sesión de Spotify directamente. Se almacena localmente de forma privada en tu navegador.
                </p>
                <button
                  onClick={() => setActiveMainTab('guide')}
                  className="text-xs text-[#b3b3b3] hover:text-white underline cursor-pointer inline-block pt-0.5"
                >
                  ¿Cómo obtener tu cookie sp_dc?
                </button>
                <div className="pt-2 max-w-[340px]">
                  <NativeSpotifyLoginButton
                    compact
                    onDone={() => {
                      setSpotifyCookie(window.localStorage.getItem('user_spotify_cookie') || '');
                      setActiveMainTab('home');
                    }}
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                <div className="relative flex items-center">
                  <input
                    type={showCookieText ? 'text' : 'password'}
                    value={spotifyCookie}
                    onChange={(e) => {
                      setSpotifyCookie(e.target.value);
                      if (cookieError) setCookieError(null);
                    }}
                    placeholder="Pega aquí tu cookie sp_dc"
                    className="w-full sm:w-64 bg-[#242424] border border-[#727272] focus:border-white rounded-full pl-4 pr-9 py-2 text-xs text-white outline-none transition-colors font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCookieText(!showCookieText)}
                    className="absolute right-3 text-[#b3b3b3] hover:text-white cursor-pointer transition-colors"
                    title={showCookieText ? 'Ocultar cookie' : 'Mostrar cookie'}
                  >
                    {showCookieText ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    )}
                  </button>
                </div>
                {spotifyCookie && (
                  <button
                    type="button"
                    onClick={handleCopyCookie}
                    className="px-3.5 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all shadow active:scale-95 cursor-pointer shrink-0 flex items-center gap-1.5"
                    title="Copiar cookie sp_dc"
                  >
                    <span>{copiedCookie ? '✓ Copiada' : 'Copiar'}</span>
                  </button>
                )}
                <button
                  onClick={handleSaveSpotifyCookie}
                  disabled={isExtractingCookie}
                  className="px-5 py-2 rounded-full bg-white hover:bg-[#f0f0f0] text-black text-xs font-bold transition-all shadow hover:scale-104 active:scale-95 disabled:opacity-50 cursor-pointer shrink-0"
                >
                  {isExtractingCookie ? 'Sincronizando...' : 'Guardar'}
                </button>
              </div>
            </div>

            {/* Verified cookie status notification */}
            {spotifyCookie && !cookieError && (
              <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg bg-[#1ed760]/10 border border-[#1ed760]/30 text-white text-xs">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="text-[#1ed760] shrink-0">
                  <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z" />
                </svg>
                <div className="min-w-0">
                  <p className="font-bold text-[#1ed760]">Clave sp_dc verificada y activa</p>
                  <p className="text-[#a7a7a7] text-[11px] truncate">
                    Conectada con la cuenta de <strong>{user?.display_name || 'Spotify'}</strong>. Tus canciones, playlists y biblioteca están sincronizadas.
                  </p>
                </div>
              </div>
            )}

            {cookieError && (
              <p className="text-xs font-semibold text-[#f87171] animate-in fade-in">
                {cookieError}
              </p>
            )}

            {/* Row 3: Vincular con el móvil mediante QR o enlace */}
            {spotifyCookie && (
              <div className="py-3 border-b border-white/5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-sm font-semibold text-white flex items-center gap-2">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="text-white shrink-0">
                        <path d="M11 1.5H5a1.5 1.5 0 0 0-1.5 1.5v10A1.5 1.5 0 0 0 5 14.5h6a1.5 1.5 0 0 0 1.5-1.5V3A1.5 1.5 0 0 0 11 1.5zM5 2.5h6a.5.5 0 0 1 .5.5v9H4.5V3a.5.5 0 0 1 .5-.5zm3 11a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5z" />
                      </svg>
                      <span>Vincular con la app móvil</span>
                    </span>
                    <p className="text-xs text-[#a7a7a7] mt-0.5">
                      Escanea este código con la cámara de tu teléfono móvil para iniciar sesión al instante sin tener que buscar o pegar claves en el teléfono.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowMobileQr(!showMobileQr)}
                    className="self-start sm:self-auto px-4 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all cursor-pointer shadow active:scale-95"
                  >
                    {showMobileQr ? 'Ocultar código QR' : 'Mostrar código QR'}
                  </button>
                </div>

                {showMobileQr && (
                  <div className="p-4 rounded-xl bg-[#181818] border border-white/10 flex flex-col sm:flex-row items-center gap-5 animate-in fade-in">
                    <div className="bg-white p-2.5 rounded-lg shrink-0 shadow-lg">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(
                          `${typeof window !== 'undefined' ? window.location.origin : ''}/?sp_dc=${encodeURIComponent(cleanSpDc(spotifyCookie))}`
                        )}`}
                        alt="Código QR para móvil"
                        className="w-[150px] h-[150px]"
                      />
                    </div>
                    <div className="space-y-2 text-center sm:text-left">
                      <p className="text-xs font-bold text-white">Pasos para conectar tu móvil:</p>
                      <ol className="text-xs text-[#b3b3b3] list-decimal list-inside space-y-1">
                        <li>Abre la cámara de tu teléfono móvil.</li>
                        <li>Apunta a este código y pulsa en la notificación para abrir el enlace.</li>
                        <li>Tu móvil iniciará sesión automáticamente con tus mismas playlists y biblioteca.</li>
                      </ol>
                      <div className="pt-1">
                        <button
                          onClick={() => {
                            const link = `${typeof window !== 'undefined' ? window.location.origin : ''}/?sp_dc=${encodeURIComponent(cleanSpDc(spotifyCookie))}`;
                            navigator.clipboard.writeText(link);
                            setCopiedMobileLink(true);
                            setTimeout(() => setCopiedMobileLink(false), 2500);
                          }}
                          className="text-xs bg-[#1ed760] hover:bg-[#1fdf64] text-black font-bold px-4 py-2 rounded-full cursor-pointer transition-transform active:scale-95 inline-flex items-center gap-2 shadow"
                        >
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M4 1.5A1.5 1.5 0 0 0 2.5 3v8A1.5 1.5 0 0 0 4 12.5h6A1.5 1.5 0 0 0 11.5 11V3A1.5 1.5 0 0 0 10 1.5H4zm0 1h6a.5.5 0 0 1 .5.5v8a.5.5 0 0 1-.5.5H4a.5.5 0 0 1-.5-.5V3a.5.5 0 0 1 .5-.5zm8 3a.5.5 0 0 1 .5.5v7.5a1 1 0 0 1-1 1H5a.5.5 0 0 1 0-1h6.5a.5.5 0 0 0 .5-.5V6a.5.5 0 0 1 .5-.5z" />
                          </svg>
                          <span>{copiedMobileLink ? 'Enlace copiado al portapapeles' : 'Copiar enlace directo para móvil'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* 2. IDIOMA (Official Spotify Desktop Category 2) */}
        {matchesSearch('idioma language english español') && (
          <section className="space-y-3">
            <h2 className="text-base font-bold text-white font-['SpotifyMixUITitle']">
              {language === 'en' ? 'Language' : 'Idioma'}
            </h2>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 border-b border-white/5">
              <div>
                <p className="text-sm font-medium text-white">
                  {language === 'en' ? 'App Language' : 'Idioma de la aplicación'}
                </p>
                <p className="text-xs text-[#a7a7a7] mt-0.5">
                  {language === 'en'
                    ? 'Select your preferred language for the interface.'
                    : 'Selecciona tu idioma preferido para la interfaz.'}
                </p>
              </div>
              <SpotifyCustomSelect
                value={language === 'en' ? 'en-US' : 'es-ES'}
                options={LANGUAGE_OPTIONS}
                onChange={handleLanguageSelect}
                minWidth="250px"
              />
            </div>
          </section>
        )}

        {/* 3. CALIDAD DE AUDIO Y ECUALIZADOR (Official Spotify Desktop Category 3) */}
        {matchesSearch('calidad audio streaming descarga ecualizador decibelios hz frecuencia sonido normalizar volumen equalizer') && (
          <section className="space-y-4">
            <h2 className="text-base font-bold text-white font-['SpotifyMixUITitle']">
              {language === 'en' ? 'Audio Quality & Equalizer' : 'Calidad de audio y Ecualizador'}
            </h2>

            {/* Calidad del streaming */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 border-b border-white/5">
              <div>
                <p className="text-sm font-medium text-white">
                  {language === 'en' ? 'Streaming quality' : 'Calidad del streaming'}
                </p>
                <p className="text-xs text-[#a7a7a7] mt-0.5">
                  {language === 'en'
                    ? 'Higher quality uses more data and requires a faster internet connection.'
                    : 'Una mayor calidad consume más datos y requiere una conexión a Internet más rápida.'}
                </p>
              </div>
              <SpotifyCustomSelect
                value={streamingQuality}
                options={[
                  { value: 'auto', label: language === 'en' ? 'Automatic (recommended)' : 'Automática (recomendada)' },
                  { value: 'low', label: language === 'en' ? 'Low (96 kbit/s)' : 'Baja (96 kbit/s)' },
                  { value: 'normal', label: language === 'en' ? 'Normal (160 kbit/s)' : 'Normal (160 kbit/s)' },
                  { value: 'high', label: language === 'en' ? 'High (256 kbit/s)' : 'Alta (256 kbit/s)' },
                  { value: 'very_high', label: language === 'en' ? 'Very high (320 kbit/s)' : 'Muy alta (320 kbit/s)' },
                ]}
                onChange={handleSelectStreamingQuality}
                minWidth="240px"
              />
            </div>

            {/* Calidad de la descarga */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 border-b border-white/5">
              <div>
                <p className="text-sm font-medium text-white">
                  {language === 'en' ? 'Download quality' : 'Calidad de la descarga'}
                </p>
                <p className="text-xs text-[#a7a7a7] mt-0.5">
                  {language === 'en'
                    ? 'Determines audio quality for offline tracks saved in «musica-spotifree».'
                    : 'Determina la tasa de bits para las canciones descargadas en «musica-spotifree».'}
                </p>
              </div>
              <SpotifyCustomSelect
                value={downloadQuality}
                options={[
                  { value: 'normal', label: language === 'en' ? 'Normal (160 kbit/s)' : 'Normal (160 kbit/s)' },
                  { value: 'high', label: language === 'en' ? 'High (256 kbit/s)' : 'Alta (256 kbit/s)' },
                  { value: 'very_high', label: language === 'en' ? 'Very high (320 kbit/s)' : 'Muy alta (320 kbit/s)' },
                ]}
                onChange={handleSelectDownloadQuality}
                minWidth="240px"
              />
            </div>

            {/* Normalizar volumen */}
            <div className="flex items-center justify-between py-3 border-b border-white/5">
              <div>
                <div className="text-sm font-medium text-white">
                  {language === 'en' ? 'Normalize volume' : 'Normalizar el volumen'}
                </div>
                <div className="text-xs text-[#a7a7a7] mt-0.5">
                  {language === 'en'
                    ? 'Set the same volume level for all tracks with dynamic compression.'
                    : 'Establece el mismo nivel de volumen para todas las canciones mediante compresión dinámica.'}
                </div>
              </div>
              <SpotifyToggle
                checked={normalizeAudio}
                onChange={handleToggleNormalize}
                ariaLabel="Normalizar el volumen"
              />
            </div>

            {/* Nivel de volumen (solo si normalización está activa) */}
            {normalizeAudio && (
              <div className="flex items-center justify-between py-3 border-b border-white/5 animate-in fade-in">
                <div>
                  <span className="text-sm font-medium text-white">
                    {language === 'en' ? 'Volume level' : 'Nivel de volumen'}
                  </span>
                  <p className="text-xs text-[#a7a7a7] mt-0.5">
                    {language === 'en'
                      ? 'Adjust normalization target according to your listening environment.'
                      : 'Ajusta el objetivo según si escuchas en silencio o en un entorno ruidoso.'}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 bg-[#181818] p-1 rounded-full border border-white/10">
                  {(['quiet', 'normal', 'loud'] as const).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => handleSelectNormalizeLevel(lvl)}
                      className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                        normalizeLevel === lvl
                          ? 'bg-[#1ed760] text-black shadow'
                          : 'text-[#b3b3b3] hover:text-white'
                      }`}
                    >
                      {lvl === 'quiet' ? (language === 'en' ? 'Quiet' : 'Silencioso') : lvl === 'normal' ? (language === 'en' ? 'Normal' : 'Normal') : (language === 'en' ? 'Loud' : 'Alto')}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-2">
              <SpotifyEqualizer variant="desktop" />
            </div>
          </section>
        )}

        {/* 4. REPRODUCCIÓN (Official Spotify Desktop Category 4) */}
        {matchesSearch('reproducción pausas fundido crossfade automática dj efectos voz playback') && (
          <section className="space-y-4">
            <h2 className="text-base font-bold text-white font-['SpotifyMixUITitle']">
              {language === 'en' ? 'Playback' : 'Reproducción'}
            </h2>

            <div className="space-y-3">
              {/* Reproducción sin pausas */}
              <div className="flex items-center justify-between py-3 border-b border-white/5">
                <div>
                  <div className="text-sm font-medium text-white">
                    {language === 'en' ? 'Gapless playback' : 'Reproducción sin pausas'}
                  </div>
                  <div className="text-xs text-[#a7a7a7] mt-0.5">
                    {language === 'en'
                      ? 'Allows continuous transitions without silence between tracks.'
                      : 'Permite transiciones continuas sin silencios entre pistas.'}
                  </div>
                </div>
                <SpotifyToggle
                  checked={gaplessAudio}
                  onChange={handleToggleGapless}
                  ariaLabel="Reproducción sin pausas"
                />
              </div>

              {/* Automix (Transiciones automáticas estilo Spotify) */}
              <div className="flex items-center justify-between py-3 border-b border-white/5">
                <div>
                  <div className="text-sm font-medium text-white">Automix</div>
                  <div className="text-xs text-[#a7a7a7] mt-0.5">
                    {language === 'en'
                      ? 'Allows smooth transitions between songs on supported playlists.'
                      : 'Permite transiciones continuas y fluidas entre canciones en las playlists compatibles.'}
                  </div>
                </div>
                <SpotifyToggle
                  checked={automixEnabled}
                  onChange={handleToggleAutomix}
                  ariaLabel="Automix"
                />
              </div>

              {/* Fundido entre canciones (Solo visible si Reproducción sin pausas está activa) */}
              {gaplessAudio && (
                <div className="py-3 border-b border-white/5 animate-in fade-in space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-white">
                        {language === 'en' ? 'Crossfade songs' : 'Fundido entre canciones'}
                      </div>
                      <div className="text-xs text-[#a7a7a7] mt-0.5">
                        {language === 'en'
                          ? 'Allows tracks to crossfade smoothly without silence or sudden cuts.'
                          : 'Permite que las canciones se fundan suavemente sin silencios ni cortes bruscos.'}
                      </div>
                    </div>
                    <SpotifyToggle
                      checked={crossfadeEnabled}
                      onChange={handleToggleCrossfade}
                      ariaLabel="Fundido entre canciones"
                    />
                  </div>

                  {crossfadeEnabled && (
                    <div className="pt-2 pl-2 sm:pl-4 border-l-2 border-[#1ed760]/30 space-y-3 animate-in fade-in">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="text-xs text-[#b3b3b3]">
                          <span>
                            {language === 'en'
                              ? 'Continuous crossfade duration between tracks'
                              : 'Duración del fundido continuo entre pistas'}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 w-full sm:w-72">
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
                            className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-[#1ed760]"
                          />
                          <span className="text-xs font-mono font-bold text-[#1ed760] tabular-nums shrink-0 min-w-[70px] text-right">
                            {`${crossfadeSeconds} s`}
                          </span>
                        </div>
                      </div>

                      {/* Quick chips */}
                      <div className="flex items-center gap-1.5 flex-wrap pt-1">
                        {[2, 4, 6, 8, 10, 12].map((s) => (
                          <button
                            key={s}
                            onClick={() => {
                              setCrossfadeSeconds(s);
                              if (typeof window !== 'undefined') window.localStorage.setItem('spotifree_crossfade_sec', String(s));
                            }}
                            className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                              crossfadeSeconds === s ? 'bg-[#1ed760] text-black shadow' : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
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

              {/* Reproducción automática */}
              <div className="flex items-center justify-between py-3 border-b border-white/5">
                <div>
                  <div className="text-sm font-medium text-white">
                    {language === 'en' ? 'Autoplay similar songs' : 'Reproducción automática similar'}
                  </div>
                  <div className="text-xs text-[#a7a7a7] mt-0.5 max-w-xl">
                    {language === 'en'
                      ? 'Recommends and plays similar music matching your style when your current playlist ends.'
                      : 'Recomienda y reproduce música similar del mismo estilo y género como el algoritmo de Spotify cuando finalice tu lista. Si se desactiva, pasa a tu siguiente lista o vuelve al inicio sin añadir temas aleatorios.'}
                  </div>
                </div>
                <SpotifyToggle
                  checked={autoplaySimilar}
                  onChange={handleToggleAutoplay}
                  ariaLabel="Reproducción automática similar"
                />
              </div>

              {/* Efectos de DJ */}
              <div className="py-3 border-b border-white/5">
                <DJEffectsSelector />
              </div>

              {/* Voz del DJ con IA */}
              <div className="py-3 border-b border-white/5">
                <DJVoicePicker />
              </div>
            </div>
          </section>
        )}

        {/* 5. VISUALIZACIÓN Y CONTENIDO (Official Spotify Desktop Category 5) */}
        {matchesSearch('visualización contenido sonando panel reproducir banners fotos carátulas icono app canvas vídeos musicales portadas animadas') && (
          <section className="space-y-3">
            <h2 className="text-base font-bold text-white font-['SpotifyMixUITitle']">
              {language === 'en' ? 'Display & Content' : 'Visualización y Contenido'}
            </h2>

            <div className="flex items-center justify-between py-3 border-b border-white/5">
              <div>
                <span className="text-sm font-medium text-white">
                  {language === 'en' ? 'Show Now Playing panel on playback' : 'Mostrar el panel Sonando al reproducir'}
                </span>
                <p className="text-xs text-[#a7a7a7] mt-0.5">
                  {language === 'en'
                    ? 'Automatically displays track details in the right sidebar.'
                    : 'Despliega automáticamente los detalles de la pista en el panel lateral.'}
                </p>
              </div>
              <SpotifyToggle
                checked={showNowPlayingOnClick}
                onChange={setShowNowPlayingOnClick}
                ariaLabel="Mostrar el panel Sonando al hacer clic a reproducir"
              />
            </div>

            <div className="flex items-center justify-between py-3 border-b border-white/5">
              <div>
                <span className="text-sm font-medium text-white">
                  {language === 'en' ? 'Convert photos to banners' : 'Convertir fotos a banners'}
                </span>
                <p className="text-xs text-[#a7a7a7] mt-0.5">
                  {language === 'en'
                    ? 'Displays playlist covers as full widescreen banners instead of the classic square box.'
                    : 'Muestra las carátulas de las playlists como banners panorámicos a pantalla completa en lugar del cuadro clásico.'}
                </p>
              </div>
              <SpotifyToggle
                checked={convertPhotosToBanners}
                onChange={setConvertPhotosToBanners}
                ariaLabel="Convertir fotos a banners"
              />
            </div>

            <div className="flex items-center justify-between py-3 border-b border-white/5">
              <div>
                <div className="text-sm font-medium text-white">Canvas</div>
                <div className="text-xs text-[#a7a7a7] mt-0.5">
                  {language === 'en'
                    ? 'Short, looping visuals while a song is playing.'
                    : 'Imágenes breves y en bucle mientras suena una canción.'}
                </div>
              </div>
              <SpotifyToggle
                checked={canvasEnabled}
                onChange={setCanvasEnabled}
                ariaLabel="Canvas"
              />
            </div>

            <div className="flex items-center justify-between py-3 border-b border-white/5">
              <div>
                <div className="text-sm font-medium text-white">
                  {language === 'en' ? 'Music videos' : 'Vídeos musicales'}
                </div>
                <div className="text-xs text-[#a7a7a7] mt-0.5">
                  {language === 'en'
                    ? 'Play live performances and music videos when available.'
                    : 'Reproducir vídeos y actuaciones en directo cuando estén disponibles.'}
                </div>
              </div>
              <SpotifyToggle
                checked={musicVideos}
                onChange={setMusicVideos}
                ariaLabel="Vídeos musicales"
              />
            </div>

            <div className="py-3 border-b border-white/5">
              <MotionCoverSetting />
            </div>

            {/* Icono de la app: solo en navegador (antes de instalar) y en la APK */}
            <AppIconSelector variant="desktop" />

            {/* Aceleración por hardware */}
            <div className="flex items-center justify-between py-3 border-b border-white/5">
              <div>
                <span className="text-sm font-medium text-white">
                  {language === 'en' ? 'Hardware acceleration' : 'Aceleración por hardware'}
                </span>
                <p className="text-xs text-[#a7a7a7] mt-0.5">
                  {language === 'en'
                    ? 'Uses the graphics processor to optimize app smoothness and rendering.'
                    : 'Usa la tarjeta gráfica para optimizar la fluidez visual y el rendimiento de la aplicación.'}
                </p>
              </div>
              <SpotifyToggle
                checked={hardwareAccel}
                onChange={handleToggleHardwareAccel}
                ariaLabel="Aceleración por hardware"
              />
            </div>
          </section>
        )}

        {/* 6. TU BIBLIOTECA Y ARCHIVOS LOCALES (Official Spotify Desktop Category 6) */}
        {matchesSearch('tu biblioteca archivos locales compacta diseño lista recuperar playlists trash borrar aleatorio shuffle reciente library') && (
          <section className="space-y-3">
            <h2 className="text-base font-bold text-white font-['SpotifyMixUITitle']">
              {language === 'en' ? 'Your Library & Local Files' : 'Tu biblioteca y Archivos locales'}
            </h2>

            {/* Usar diseño de biblioteca compacta */}
            <div className="flex items-center justify-between py-3 border-b border-white/5">
              <div>
                <span className="text-sm font-medium text-white">
                  {language === 'en' ? 'Use compact library layout' : 'Usar diseño de biblioteca compacta'}
                </span>
                <p className="text-xs text-[#a7a7a7] mt-0.5">
                  {language === 'en'
                    ? 'Hide artwork and compress the playlist list in the sidebar.'
                    : 'Oculta las carátulas y comprime la lista de playlists en la barra lateral.'}
                </p>
              </div>
              <SpotifyToggle
                checked={viewMode === 'compacta'}
                onChange={(val) => setViewMode(val ? 'compacta' : 'lista')}
                ariaLabel="Usar diseño de biblioteca compacta"
              />
            </div>

            {/* Archivos locales */}
            <div className="flex items-center justify-between py-3 border-b border-white/5">
              <div>
                <span className="text-sm font-medium text-white">
                  {language === 'en' ? 'Local Files' : 'Archivos locales'}
                </span>
                <p className="text-xs text-[#a7a7a7] mt-0.5">
                  {language === 'en'
                    ? 'Show and play local audio files and downloaded tracks from your computer.'
                    : 'Muestra y reproduce tus archivos de audio descargados y pistas MP3 locales en tu ordenador.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveMainTab('local')}
                className="px-5 py-2 rounded-full border border-[#727272] hover:border-white text-xs font-bold text-white hover:scale-104 active:scale-95 transition-all cursor-pointer shrink-0"
              >
                {language === 'en' ? 'Open Local Files' : 'Abrir Archivos locales'}
              </button>
            </div>

            {/* Shuffle algorithm & recent-at-end */}
            <AdvancedSettingsSection variant="desktop" />

            {/* Recuperar playlists borradas (90 días) */}
            <div className="pt-2">
              <RecoverPlaylistsSection variant="desktop" />
            </div>
          </section>
        )}

        {/* 7. ALMACENAMIENTO (Official Spotify Desktop Category 7) */}
        {matchesSearch('almacenamiento caché memoria espacio archivos offline musica-spotifree storage') && (
          <section className="space-y-3">
            <h2 className="text-base font-bold text-white font-['SpotifyMixUITitle']">
              {language === 'en' ? 'Storage' : 'Almacenamiento'}
            </h2>
            <div className="flex items-center justify-between py-3 border-b border-white/5">
              <div>
                <p className="text-sm font-medium text-white">
                  {language === 'en' ? 'Track and cover art cache' : 'Caché de canciones y portadas'}
                </p>
                <p className="text-xs text-[#a7a7a7] mt-0.5">
                  {cacheSize} {language === 'en' ? 'used in secure storage «musica-spotifree».' : 'ocupados en almacenamiento seguro «musica-spotifree».'}
                </p>
              </div>
              <button
                onClick={handleClearCache}
                className="px-5 py-2 rounded-full border border-[#727272] hover:border-white text-xs font-bold text-white hover:scale-104 active:scale-95 transition-all cursor-pointer shrink-0"
              >
                {cacheCleared ? (language === 'en' ? '✓ Cache cleared!' : '¡Caché borrada!') : (language === 'en' ? 'Clear cache' : 'Borrar caché')}
              </button>
            </div>
          </section>
        )}

        {/* 8. SOCIAL Y ACERCA DE (Official Spotify Desktop Category 8) */}
        {matchesSearch('social acerca de amigos sesión compartida gustos recomendaciones artistas favoritos personalizar taste onboarding versión changelog about') && (
          <section className="space-y-3">
            <h2 className="text-base font-bold text-white font-['SpotifyMixUITitle']">
              {language === 'en' ? 'Social & About' : 'Social y Acerca de'}
            </h2>

            {/* Shared session listening */}
            <div className="py-1">
              <ListeningFriendsSection variant="desktop" />
            </div>

            {/* Sesión privada */}
            <div className="flex items-center justify-between py-3 border-b border-white/5">
              <div>
                <span className="text-sm font-medium text-white">
                  {language === 'en' ? 'Private session' : 'Sesión privada'}
                </span>
                <p className="text-xs text-[#a7a7a7] mt-0.5">
                  {language === 'en'
                    ? 'Start a private session to listen anonymously without updating activity with friends.'
                    : 'Inicia una sesión privada para escuchar de forma anónima sin compartir tu actividad con amigos.'}
                </p>
              </div>
              <SpotifyToggle
                checked={privateSession}
                onChange={handleTogglePrivateSession}
                ariaLabel="Sesión privada"
              />
            </div>

            {/* Gustos Musicales & Recomendaciones */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-3 border-b border-white/5">
              <div className="space-y-1 max-w-md">
                <span className="text-sm font-semibold text-white">
                  {language === 'en' ? 'Personalize favorite artists' : 'Personalizar mis artistas favoritos'}
                </span>
                <p className="text-xs text-[#a7a7a7] leading-relaxed">
                  {language === 'en'
                    ? 'Choose or update artists you like to improve your Daily Mixes, Discover Weekly, and recommendations.'
                    : 'Elige o actualiza los artistas que te gustan para afinar tus Mixes diarios, Descubrimiento semanal y recomendaciones estilo Spotify.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => useUIStore.getState().openTasteOnboarding()}
                className="px-5 py-2 rounded-full bg-[#1ed760] text-black text-xs font-bold hover:scale-105 active:scale-95 transition-all cursor-pointer shadow shrink-0"
              >
                {language === 'en' ? 'Adjust taste' : 'Ajustar gustos'}
              </button>
            </div>

            {/* Acerca de la aplicación (Versión y Cambios) */}
            <div className="pt-2">
              <AboutAppSection variant="desktop" />
            </div>
          </section>
        )}
      </div>
    </div>
  );
};
