import { SpotifreeAuthCard } from '../common/SpotifreeAuthCard';
import React, { useState, useRef, useEffect } from 'react';
import { useUIStore } from '../../store/useUIStore';
import { getStorageUsage, clearOfflineCache } from '../../utils/offlineStorage';
import { useSpotifyDataStore } from '../../store/useSpotifyDataStore';
import { audioEngine } from '../../services/audioEngine';
import {
  validateSpotifyCookie,
  extractSpotifySessionFromCookie,
} from '../../services/spotifyCookieService';
import {
  saveAccount,
  cleanSpDc,
  getSavedAccounts,
  removeSavedAccount,
  switchActiveAccount,
  type SavedAccount,
} from '../../utils/userAccounts';

interface FrequencyPoint {
  label: string;
  value: number; // dB from -12 to +12
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
  const { setActiveMainTab, viewMode, setViewMode, openLoginModal } = useUIStore();
  const { user, isAuthenticated, logout } = useSpotifyDataStore();

  const [spotifyCookie, setSpotifyCookie] = useState<string>(() => {
    return typeof window !== 'undefined'
      ? window.localStorage.getItem('user_spotify_cookie') || ''
      : '';
  });
  const [savedSpotifyCookieSuccess, setSavedSpotifyCookieSuccess] = useState(false);
  const [cookieError, setCookieError] = useState<string | null>(null);
  const [isExtractingCookie, setIsExtractingCookie] = useState(false);
  const [showMobileQr, setShowMobileQr] = useState(false);
  const [copiedMobileLink, setCopiedMobileLink] = useState(false);

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
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('user_spotify_cookie', val);
        window.localStorage.setItem('spotify_extracted_session', JSON.stringify({ ...session, _cookie: val }));
        if (session.user?.id) {
          window.localStorage.setItem('spotifree_active_user_id', session.user.id);
        }
        window.localStorage.removeItem('spotify_logged_out');
      }

      saveAccount({
        id: session.user.id || `user-${Date.now()}`,
        displayName: session.user.display_name || 'Usuario Spotify',
        email: session.user.email,
        avatarUrl: session.user.images?.[0]?.url,
        cookie: val,
        accessToken: session.accessToken,
        lastUsed: Date.now(),
      });

      useSpotifyDataStore.setState({
        isAuthenticated: true,
        user: session.user,
        playlists: session.playlists,
        dynamicShelves: session.shelves,
        quickAccessCards: session.quickAccess,
        isLoading: false,
      });
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

  const [savedAccountsList, setSavedAccountsList] = useState<SavedAccount[]>(() => getSavedAccounts());

  const handleSwitchAccount = async (account: SavedAccount) => {
    setCookieError(null);
    setIsExtractingCookie(true);
    try {
      await switchActiveAccount(account);
      const cleanCookie = cleanSpDc(account.cookie || '');
      setSpotifyCookie(cleanCookie);
      setSavedAccountsList(getSavedAccounts());
      setSavedSpotifyCookieSuccess(true);
      setTimeout(() => setSavedSpotifyCookieSuccess(false), 2500);
    } catch (err: any) {
      setCookieError(err.message || 'Error al cambiar de cuenta.');
    } finally {
      setIsExtractingCookie(false);
    }
  };


  const [language, setLanguage] = useState('es-ES');
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
      window.localStorage.setItem('spotifree_gapless', String(val));
      if (!val) {
        setCrossfadeSeconds(0);
        window.localStorage.setItem('spotifree_crossfade_sec', '0');
      }
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


  // Equalizer 6-band State (-12 to +12 dB)
  const [activePreset, setActivePreset] = useState<string>('flat');
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
      // relY = 0 is +12dB, relY = availableHeight is -12dB
      const norm = 1 - relY / availableHeight; // 0 to 1
      const db = Math.round(((norm * 24) - 12) * 2) / 2; // -12 to +12 in 0.5 steps
      handleBandChange(draggingBandIndex, Math.max(-12, Math.min(12, db)));
    };

    const onPointerUp = () => {
      setDraggingBandIndex(null);
    };

    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    window.addEventListener('touchmove', onPointerMove);
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

  const matchesSearch = (text: string) => {
    if (!searchQuery.trim()) return true;
    return text.toLowerCase().includes(searchQuery.toLowerCase());
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

  const PRESET_OPTIONS = Object.keys(PRESET_LABELS).map((k) => ({
    value: k,
    label: PRESET_LABELS[k],
  }));

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

            {/* Row 1: Estado de la cuenta */}
            <div className="flex items-center justify-between py-3 border-b border-white/5">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${isAuthenticated ? 'bg-[#1ed760]' : 'bg-[#727272]'}`} />
                  <span className="text-sm font-semibold text-white">
                    {isAuthenticated
                      ? `Conectado como ${
                          user?.display_name && user.display_name !== 'Cuenta de Spotify'
                            ? user.display_name
                            : (typeof window !== 'undefined' && JSON.parse(window.localStorage.getItem('spotifree_account') || '{}')?.displayName) || 'Usuario'
                        }`
                      : 'Sesión no conectada'}
                  </span>
                </div>
                <p className="text-xs text-[#a7a7a7] mt-1">
                  {isAuthenticated
                    ? 'Tus listas y recomendaciones están sincronizadas en este dispositivo.'
                    : 'Vincula tu cuenta mediante tu cookie sp_dc para cargar todas tus listas privadas.'}
                </p>
              </div>

              <div>
                {isAuthenticated ? (
                  <button
                    onClick={logout}
                    className="px-5 py-2 rounded-full border border-[#727272] hover:border-white text-xs font-bold text-white hover:scale-104 active:scale-95 transition-all cursor-pointer"
                  >
                    Cerrar sesión
                  </button>
                ) : (
                  <button
                    onClick={() => setActiveMainTab('guide')}
                    className="px-5 py-2 rounded-full bg-white hover:bg-[#f0f0f0] text-black text-xs font-bold transition-all shadow hover:scale-104 active:scale-95 cursor-pointer"
                  >
                    Ver guía
                  </button>
                )}
              </div>
            </div>

            {/* Row 1b: Cuentas guardadas (Spotify Multi-Account Selector) */}
            {savedAccountsList.length > 0 && (
              <div className="py-3 border-b border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#a7a7a7]">
                    Cuentas guardadas en este dispositivo
                  </span>
                  <button
                    onClick={openLoginModal}
                    className="text-xs font-bold text-[#1ed760] hover:underline cursor-pointer"
                  >
                    + Añadir cuenta
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {(() => {
                    const activeUserId = user?.id || (typeof window !== 'undefined' ? window.localStorage.getItem('spotifree_active_user_id') : '');
                    const activeCookie = spotifyCookie || (typeof window !== 'undefined' ? window.localStorage.getItem('user_spotify_cookie') : '');
                    const matchedAcc = savedAccountsList.find(
                      (a) => (activeUserId && a.id === activeUserId) ||
                             (activeCookie && a.cookie && cleanSpDc(a.cookie) === cleanSpDc(activeCookie))
                    );
                    const singleActiveId = matchedAcc?.id || (isAuthenticated && savedAccountsList.length > 0 ? savedAccountsList[0].id : null);

                    return savedAccountsList.map((acc) => {
                      const isActive = acc.id === singleActiveId;
                      return (
                        <div
                          key={acc.id}
                          onClick={() => handleSwitchAccount(acc)}
                          className={`p-3 rounded-lg flex items-center justify-between cursor-pointer transition-all border ${
                            isActive
                              ? 'bg-white/10 border-[#1ed760]/60 shadow-sm'
                              : 'bg-[#181818] border-white/5 hover:bg-white/[0.08]'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-full bg-[#242424] flex items-center justify-center font-bold text-xs text-white shrink-0 overflow-hidden shadow">
                              {acc.avatarUrl ? (
                                <img src={acc.avatarUrl} alt={acc.displayName} className="w-full h-full object-cover" />
                              ) : (
                                (acc.displayName || 'U').charAt(0).toUpperCase()
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-white truncate">{acc.displayName}</p>
                              <p className="text-[11px] text-[#a7a7a7] truncate">
                                {isActive ? (
                                  <span className="text-[#1ed760] font-semibold">Cuenta activa</span>
                                ) : (
                                  'Toca para cambiar'
                                )}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {isActive && (
                              <div className="w-2.5 h-2.5 rounded-full bg-[#1ed760] shrink-0 mr-1 shadow-[0_0_8px_#1ed760]" />
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeSavedAccount(acc.id);
                                if (acc.displayName) removeSavedAccount(acc.displayName);
                                if (acc.email) removeSavedAccount(acc.email);
                                const updated = getSavedAccounts();
                                setSavedAccountsList(updated);
                                if (isActive) {
                                  if (updated.length > 0) {
                                    handleSwitchAccount(updated[0]);
                                  } else {
                                    logout();
                                  }
                                }
                              }}
                              className="text-[#727272] hover:text-red-400 text-xs p-1 rounded hover:bg-white/10 transition-colors"
                              title="Eliminar de cuentas recordadas"
                            >
                              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}

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
                <input
                  type="password"
                  value={spotifyCookie}
                  onChange={(e) => {
                    setSpotifyCookie(e.target.value);
                    if (cookieError) setCookieError(null);
                  }}
                  placeholder="Pega aquí tu cookie sp_dc"
                  className="w-full sm:w-64 bg-[#242424] border border-[#727272] focus:border-white rounded-full px-4 py-2 text-xs text-white outline-none transition-colors font-mono"
                />
                <button
                  onClick={handleSaveSpotifyCookie}
                  disabled={isExtractingCookie}
                  className="px-5 py-2 rounded-full bg-white hover:bg-[#f0f0f0] text-black text-xs font-bold transition-all shadow hover:scale-104 active:scale-95 disabled:opacity-50 cursor-pointer"
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
            <h2 className="text-base font-bold text-white font-['SpotifyMixUITitle']">Idioma</h2>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 border-b border-white/5">
              <div>
                <p className="text-sm font-medium text-white">Idioma de la aplicación</p>
                <p className="text-xs text-[#a7a7a7] mt-0.5">Selecciona tu idioma preferido para la interfaz.</p>
              </div>
              <SpotifyCustomSelect
                value={language}
                options={LANGUAGE_OPTIONS}
                onChange={setLanguage}
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
        {matchesSearch('visualización sonando panel reproducir') && (
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

            {/* Ecualizador Gráfico */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-bold text-white">Ecualizador de audio</h3>
                  <p className="text-xs text-[#a7a7a7] mt-0.5">
                    Ajusta frecuencias y decibelios en tiempo real para todos los reproductores.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#a7a7a7]">Preajuste:</span>
                  <SpotifyCustomSelect
                    value={activePreset}
                    options={PRESET_OPTIONS}
                    onChange={handlePresetSelect}
                    minWidth="160px"
                  />
                </div>
              </div>

              {/* Modificadores Rápidos de Sonido (Estilo Spotify UI minimalista, sin emojis) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
                <button
                  onClick={() => handlePresetSelect('vocal')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    activePreset === 'vocal'
                      ? 'border-[#1ed760] bg-[#1ed760]/10 text-white shadow'
                      : 'border-white/10 bg-[#181818] text-[#b3b3b3] hover:border-white/20 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={activePreset === 'vocal' ? 'text-[#1ed760]' : 'text-[#b3b3b3]'}>
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
                  <div className="flex items-center gap-2 mb-1.5">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={activePreset === 'rock' ? 'text-[#1ed760]' : 'text-[#b3b3b3]'}>
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
                  <div className="flex items-center gap-2 mb-1.5">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={activePreset === 'bassBoost' ? 'text-[#1ed760]' : 'text-[#b3b3b3]'}>
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
                  <div className="flex items-center gap-2 mb-1.5">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={activePreset === 'flat' ? 'text-[#1ed760]' : 'text-[#b3b3b3]'}>
                      <line x1="3" y1="12" x2="21" y2="12"/>
                      <circle cx="12" cy="12" r="2.5" fill="currentColor"/>
                    </svg>
                    <span className="text-xs font-bold text-white">Plano (Fidelidad)</span>
                  </div>
                  <span className="block text-[10px] text-[#a7a7a7]">Respuesta neutra de estudio (0 dB)</span>
                </button>
              </div>
            </div>

            {/* Equalizer Container Card */}
            <div className="bg-[#181818] rounded-xl p-6 border border-white/5 shadow-2xl relative select-none">
              <div className="flex justify-between items-center mb-4">
                <span className="text-sm font-bold text-white font-['SpotifyMixUITitle']">
                  Curva de ecualización
                </span>
                <button
                  onClick={() => handlePresetSelect('flat')}
                  className="text-xs text-[#b3b3b3] hover:text-white hover:underline transition-colors cursor-pointer"
                >
                  Restablecer a plano (0 dB)
                </button>
              </div>

              {/* Flex container: dB Axis Scale + Canvas */}
              <div className="flex gap-2 items-center">
                {/* dB Scale Axis */}
                <div className="h-[180px] flex flex-col justify-between text-[10px] font-mono text-[#727272] select-none text-right shrink-0 w-11 pb-6 pt-1">
                  <span>+12 dB</span>
                  <span>+6 dB</span>
                  <span className="text-[#a7a7a7] font-bold">0 dB</span>
                  <span>-6 dB</span>
                  <span>-12 dB</span>
                </div>

                {/* Interactive Curve Canvas & Draggable Nodes */}
                <div
                  ref={eqCanvasRef}
                  className="relative flex-1 h-[180px] bg-[#121212] rounded-lg p-4 border border-white/10 overflow-hidden shadow-inner"
                >
                  {/* Horizontal dB Grid Lines */}
                  <div className="absolute inset-x-4 top-4 bottom-4 flex flex-col justify-between pointer-events-none">
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
                    className="absolute inset-x-4 inset-y-4 w-[calc(100%-32px)] h-[calc(100%-32px)] pointer-events-none"
                  >
                    <defs>
                      <linearGradient id="eqGradient2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#1ed760" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#1ed760" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Area fill */}
                    <path
                      d={`${curvePath} L ${points[points.length - 1].x} ${zeroY} L ${points[0].x} ${zeroY} Z`}
                      fill="url(#eqGradient2)"
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
                  <div className="absolute inset-x-4 inset-y-4 flex justify-between pointer-events-none">
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
                              const padding = 16;
                              const availH = rect.height - padding * 2;
                              const relY = Math.max(0, Math.min(availH, e.clientY - (rect.top + padding)));
                              const n = 1 - relY / availH;
                              const db = Math.round(((n * 24) - 12) * 2) / 2;
                              handleBandChange(idx, Math.max(-12, Math.min(12, db)));
                            }}
                            className="absolute inset-y-0 w-1 bg-white/[0.06] hover:bg-white/20 transition-colors cursor-pointer rounded-full"
                          />

                          {/* Draggable Circle Handle */}
                          <div
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setDraggingBandIndex(idx);
                            }}
                            onTouchStart={() => setDraggingBandIndex(idx)}
                            style={{ top: `${topPercent}%` }}
                            className="absolute -translate-y-1/2 cursor-grab active:cursor-grabbing z-30 group"
                          >
                            {/* Floating dB Badge */}
                            <div
                              className={`absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-black/95 text-[#1ed760] border border-[#1ed760]/40 font-mono font-black text-[10px] whitespace-nowrap shadow-2xl pointer-events-none transition-all ${
                                isDraggingThis ? 'opacity-100 scale-110' : 'opacity-0 group-hover:opacity-100 scale-95'
                              }`}
                            >
                              {band.value > 0 ? `+${band.value.toFixed(1)}` : band.value.toFixed(1)} dB
                            </div>

                            {/* Control Node */}
                            <div
                              className={`w-5 h-5 rounded-full border-[3px] transition-all duration-150 ${
                                isDraggingThis
                                  ? 'scale-125 bg-[#1ed760] border-white shadow-[0_0_14px_#1ed760]'
                                  : 'bg-white border-[#1ed760] group-hover:scale-125 shadow-md'
                              }`}
                            />
                          </div>

                          {/* Frequency label at bottom */}
                          <span className="absolute -bottom-6 text-[11px] font-mono text-[#b3b3b3] pointer-events-none font-medium">
                            {band.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center mt-7 pt-3 border-t border-white/5 text-xs text-[#a7a7a7]">
                <span>Haz clic o arrastra los puntos directamente en la curva para ajustar frecuencias.</span>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};
