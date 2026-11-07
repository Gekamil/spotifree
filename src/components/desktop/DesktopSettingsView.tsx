import { SpotifreeAuthCard } from '../common/SpotifreeAuthCard';
import { AppIconSelector } from '../common/AppIconSelector';
import { SpotifyEqualizer } from '../common/SpotifyEqualizer';
import { DJEffectsSelector } from '../common/DJEffectsSelector';
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
          onClick={() => useSharedSessionStore.getState().setModalOpen(true)}
          className="px-6 py-2.5 rounded-full bg-[#1ed760] text-black font-black text-xs hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-lg shadow-[#1ed760]/20"
        >
          Ver participantes de la sesión
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
        {/* 1. CUENTA Y SESIÓN (Spotify 1:1 Clean Design) */}
        {matchesSearch('cuenta sesión spotify cookie sp_dc usuario desconectar') && (
          <section className="space-y-4">
            <h2 className="text-base font-bold text-white font-['SpotifyMixUITitle']">Cuenta Spotifree (Sincronización en la Nube)</h2>
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

            {/* Verified cookie status notification matching Point 17 */}
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



        {/* 2. IDIOMA (Custom Spotify Dropdown) */}
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

        {/* 3. ALMACENAMIENTO Y CACHÉ REAL */}
        {matchesSearch('almacenamiento caché memoria espacio archivos offline musica-spotifree') && (
          <section className="space-y-3">
            <h2 className="text-base font-bold text-white font-['SpotifyMixUITitle']">Almacenamiento y Caché</h2>
            <div className="flex items-center justify-between py-3 border-b border-white/5">
              <div>
                <p className="text-sm font-medium text-white">Caché de canciones y portadas</p>
                <p className="text-xs text-[#a7a7a7] mt-0.5">
                  {cacheSize} ocupados en almacenamiento seguro «musica-spotifree».
                </p>
              </div>
              <button
                onClick={handleClearCache}
                className="px-5 py-2 rounded-full border border-[#727272] hover:border-white text-xs font-bold text-white hover:scale-104 active:scale-95 transition-all cursor-pointer"
              >
                {cacheCleared ? '¡Caché borrada!' : 'Borrar caché'}
              </button>
            </div>
          </section>
        )}

        {/* 4. BIBLIOTECA (Compact View Connected) */}
        {matchesSearch('biblioteca compacta diseño lista') && (
          <section className="space-y-3">
            <h2 className="text-base font-bold text-white font-['SpotifyMixUITitle']">Tu biblioteca</h2>
            <div className="flex items-center justify-between py-3 border-b border-white/5">
              <div>
                <span className="text-sm font-medium text-white">Usar diseño de biblioteca compacta</span>
                <p className="text-xs text-[#a7a7a7] mt-0.5">Oculta las carátulas y comprime la lista de playlists en la barra lateral.</p>
              </div>
              <SpotifyToggle
                checked={viewMode === 'compacta'}
                onChange={(val) => setViewMode(val ? 'compacta' : 'lista')}
                ariaLabel="Usar diseño de biblioteca compacta"
              />
            </div>
          </section>
        )}

        {/* 5. VISUALIZACIÓN */}
        {matchesSearch('visualización sonando panel reproducir banners fotos carátulas icono app logo aniversario') && (
          <section className="space-y-3">
            <h2 className="text-base font-bold text-white font-['SpotifyMixUITitle']">Visualización</h2>
            <div className="flex items-center justify-between py-3 border-b border-white/5">
              <div>
                <span className="text-sm font-medium text-white">
                  Mostrar el panel Sonando al reproducir
                </span>
                <p className="text-xs text-[#a7a7a7] mt-0.5">Despliega automáticamente los detalles de la pista en el panel lateral.</p>
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
                  Convertir fotos a banners
                </span>
                <p className="text-xs text-[#a7a7a7] mt-0.5">
                  Muestra las carátulas de las playlists como banners panorámicos a pantalla completa en lugar del cuadro clásico.
                </p>
              </div>
              <SpotifyToggle
                checked={convertPhotosToBanners}
                onChange={setConvertPhotosToBanners}
                ariaLabel="Convertir fotos a banners"
              />
            </div>

            {/* Icono de la app: solo en navegador (antes de instalar) y en la APK */}
            <AppIconSelector variant="desktop" />
          </section>
        )}

        {/* 6. VÍDEOS Y CANVAS */}
        {matchesSearch('vídeos canvas musicales') && (
          <section className="space-y-3">
            <h2 className="text-base font-bold text-white font-['SpotifyMixUITitle']">Vídeos y Canvas</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-3 border-b border-white/5">
                <div>
                  <div className="text-sm font-medium text-white">Vídeos musicales</div>
                  <div className="text-xs text-[#a7a7a7] mt-0.5">
                    Reproducir vídeos y actuaciones en directo cuando estén disponibles.
                  </div>
                </div>
                <SpotifyToggle
                  checked={musicVideos}
                  onChange={setMusicVideos}
                  ariaLabel="Vídeos musicales"
                />
              </div>

              <div className="flex items-center justify-between py-3 border-b border-white/5">
                <div>
                  <div className="text-sm font-medium text-white">Canvas</div>
                  <div className="text-xs text-[#a7a7a7] mt-0.5">
                    Imágenes breves y en bucle mientras suena una canción.
                  </div>
                </div>
                <SpotifyToggle
                  checked={canvasEnabled}
                  onChange={setCanvasEnabled}
                  ariaLabel="Canvas"
                />
              </div>
            </div>
          </section>
        )}

        {/* 7. REPRODUCCIÓN (Controles de Reproducción y Ecualizador) */}
        {matchesSearch('reproducción ecualizador decibelios hz frecuencia sonido normalizar pausas fundido automática') && (
          <section className="space-y-4">
            <h2 className="text-base font-bold text-white font-['SpotifyMixUITitle']">Reproducción</h2>

            <div className="space-y-3">
              {/* Normalizar volumen */}
              <div className="flex items-center justify-between py-3 border-b border-white/5">
                <div>
                  <div className="text-sm font-medium text-white">Normalizar el volumen</div>
                  <div className="text-xs text-[#a7a7a7] mt-0.5">
                    Establece el mismo nivel de volumen para todas las canciones mediante compresión dinámica.
                  </div>
                </div>
                <SpotifyToggle
                  checked={normalizeAudio}
                  onChange={handleToggleNormalize}
                  ariaLabel="Normalizar el volumen"
                />
              </div>

              {/* Reproducción sin pausas */}
              <div className="flex items-center justify-between py-3 border-b border-white/5">
                <div>
                  <div className="text-sm font-medium text-white">Reproducción sin pausas</div>
                  <div className="text-xs text-[#a7a7a7] mt-0.5">
                    Permite transiciones continuas sin silencios entre pistas.
                  </div>
                </div>
                <SpotifyToggle
                  checked={gaplessAudio}
                  onChange={handleToggleGapless}
                  ariaLabel="Reproducción sin pausas"
                />
              </div>

              {/* Fundido entre canciones (Solo visible si Reproducción sin pausas está activa) */}
              {gaplessAudio && (
                <div className="py-3 border-b border-white/5 animate-in fade-in space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-white">Fundido entre canciones</div>
                      <div className="text-xs text-[#a7a7a7] mt-0.5">
                        Permite que las canciones se fundan suavemente sin silencios ni cortes bruscos.
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
                          <span>Duración del fundido continuo entre pistas</span>
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
                  <div className="text-sm font-medium text-white">Reproducción automática similar</div>
                  <div className="text-xs text-[#a7a7a7] mt-0.5 max-w-xl">
                    Recomienda y reproduce música similar del mismo estilo y género como el algoritmo de Spotify cuando finalice tu lista. Si se desactiva, pasa a tu siguiente lista o vuelve al inicio sin añadir temas aleatorios.
                  </div>
                </div>
                <SpotifyToggle
                  checked={autoplaySimilar}
                  onChange={handleToggleAutoplay}
                  ariaLabel="Reproducción automática similar"
                />
              </div>
            </div>

            {/* Efectos de DJ */}
            <div className="py-3 border-b border-white/5">
              <DJEffectsSelector />
            </div>

            {/* Ecualizador (estilo Spotify) */}
            <div className="pt-4">
              <SpotifyEqualizer variant="desktop" />
            </div>
          </section>
        )}
      </div>
    </div>
  );
};
