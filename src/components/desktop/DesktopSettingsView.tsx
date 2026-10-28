import React, { useState, useRef, useEffect } from 'react';
import { useUIStore } from '../../store/useUIStore';
import { useSpotifyDataStore } from '../../store/useSpotifyDataStore';
import { audioEngine } from '../../services/audioEngine';
import {
  validateSpotifyCookie,
  extractSpotifySessionFromCookie,
} from '../../services/spotifyCookieService';
import { saveAccount, cleanSpDc } from '../../utils/userAccounts';

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
  const { setActiveMainTab, viewMode, setViewMode } = useUIStore();
  const { user, isAuthenticated, logout } = useSpotifyDataStore();

  const [spotifyCookie, setSpotifyCookie] = useState<string>(() => {
    return typeof window !== 'undefined'
      ? window.localStorage.getItem('user_spotify_cookie') || ''
      : '';
  });
  const [savedSpotifyCookieSuccess, setSavedSpotifyCookieSuccess] = useState(false);
  const [cookieError, setCookieError] = useState<string | null>(null);
  const [isExtractingCookie, setIsExtractingCookie] = useState(false);
  const [showAdvancedAudio, setShowAdvancedAudio] = useState(false);

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

  const [engineMode, setEngineMode] = useState<string>(() => {
    return typeof window !== 'undefined'
      ? window.localStorage.getItem('spotifree_audio_engine') || 'hybrid'
      : 'hybrid';
  });

  // Settings State
  const [language, setLanguage] = useState('es-ES');
  const [audioQuality, setAudioQuality] = useState('very_high');
  const [showNowPlayingOnClick, setShowNowPlayingOnClick] = useState(true);
  const [musicVideos, setMusicVideos] = useState(true);
  const [canvasEnabled, setCanvasEnabled] = useState(true);

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

  const QUALITY_OPTIONS = [
    { value: 'auto', label: 'Automática' },
    { value: 'low', label: 'Baja (96 kbps)' },
    { value: 'normal', label: 'Normal (160 kbps)' },
    { value: 'high', label: 'Alta (320 kbps)' },
    { value: 'very_high', label: 'Muy alta (Sin pérdida)' },
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
            <h2 className="text-base font-bold text-white font-['SpotifyMixUITitle']">Cuenta</h2>

            {/* Row 1: Estado de la cuenta */}
            <div className="flex items-center justify-between py-3 border-b border-white/5">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${isAuthenticated ? 'bg-[#1ed760]' : 'bg-[#727272]'}`} />
                  <span className="text-sm font-semibold text-white">
                    {isAuthenticated ? `Conectado como ${user?.display_name || 'Usuario'}` : 'Sesión no conectada'}
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

            {cookieError && (
              <p className="text-xs font-semibold text-[#f87171] animate-in fade-in">
                {cookieError}
              </p>
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

        {/* 3. CALIDAD DEL AUDIO (Custom Spotify Dropdown) */}
        {matchesSearch('calidad audio streaming normalizar volumen') && (
          <section className="space-y-3">
            <h2 className="text-base font-bold text-white font-['SpotifyMixUITitle']">Calidad del audio</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-3 border-b border-white/5">
                <div>
                  <span className="text-sm font-medium text-white">Calidad de streaming</span>
                  <p className="text-xs text-[#a7a7a7] mt-0.5">Ajusta el ancho de banda y la tasa de muestreo.</p>
                </div>
                <SpotifyCustomSelect
                  value={audioQuality}
                  options={QUALITY_OPTIONS}
                  onChange={setAudioQuality}
                  minWidth="200px"
                />
              </div>

              <div className="flex items-center justify-between py-3 border-b border-white/5">
                <div>
                  <div className="text-sm font-medium text-white">Normalizar el volumen</div>
                  <div className="text-xs text-[#a7a7a7] mt-0.5">
                    Establece el mismo nivel de volumen para todas las canciones.
                  </div>
                </div>
                <SpotifyToggle
                  checked={true}
                  onChange={() => {}}
                  ariaLabel="Normalizar el volumen"
                />
              </div>
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

        {/* 7. REPRODUCCIÓN (Ecualizador Spotify 1:1 con Web Audio API) */}
        {matchesSearch('reproducción ecualizador decibelios hz frecuencia sonido') && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white font-['SpotifyMixUITitle']">Reproducción</h2>
                <p className="text-xs text-[#a7a7a7] mt-0.5">
                  Ajusta las frecuencias de audio en tiempo real con el ecualizador activo.
                </p>
              </div>

              {/* Presets Dropdown */}
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

            {/* Equalizer Container Card */}
            <div className="bg-[#181818] rounded-xl p-6 border border-white/5 shadow-2xl relative select-none">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white font-['SpotifyMixUITitle']">
                    Curva de respuesta en frecuencia
                  </span>
                  <span className="text-[10px] font-black tracking-wider uppercase px-2 py-0.5 rounded-full bg-[#1ed760]/15 text-[#1ed760] border border-[#1ed760]/30 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#1ed760] animate-pulse" />
                    Web Audio DSP
                  </span>
                </div>
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
                <span>Haz clic o arrastra los puntos directamente en la curva para ecualizar.</span>
                <span className="font-mono text-[11px] text-[#1ed760]">
                  6 bandas paramétricas activas
                </span>
              </div>
            </div>
          </section>
        )}

        {/* 8. AVANZADO: MOTOR DE AUDIO (Clean Collapsible) */}
        {matchesSearch('avanzado motor audio youtube streaming proxy') && (
          <section className="space-y-3 pt-2">
            <button
              type="button"
              onClick={() => setShowAdvancedAudio(!showAdvancedAudio)}
              className="flex items-center gap-2 text-sm font-semibold text-[#a7a7a7] hover:text-white transition-colors cursor-pointer"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="currentColor"
                className={`transition-transform duration-200 ${showAdvancedAudio ? 'rotate-90' : ''}`}
              >
                <path d="M4.97 15.53a.75.75 0 0 1 0-1.06L11.44 8 4.97 1.53a.75.75 0 0 1 1.06-1.06l7.5 7.5a.75.75 0 0 1 0 1.06l-7.5 7.5a.75.75 0 0 1-1.06 0" />
              </svg>
              <span>Configuración avanzada de audio</span>
            </button>

            {showAdvancedAudio && (
              <div className="p-4 rounded-lg bg-[#181818] border border-white/5 space-y-3 animate-in fade-in duration-200">
                <p className="text-xs text-[#a7a7a7] leading-relaxed">
                  Spotifree resuelve el streaming de audio automáticamente a través de la red global de YouTube Music sin límites.
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setEngineMode('hybrid');
                      localStorage.setItem('spotifree_audio_engine', 'hybrid');
                    }}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      engineMode === 'hybrid' ? 'bg-[#1ed760] text-black' : 'bg-[#242424] text-white hover:bg-[#333]'
                    }`}
                  >
                    Nativo Híbrido (Recomendado)
                  </button>
                  <button
                    onClick={() => {
                      setEngineMode('stream');
                      localStorage.setItem('spotifree_audio_engine', 'stream');
                    }}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      engineMode === 'stream' ? 'bg-[#1ed760] text-black' : 'bg-[#242424] text-white hover:bg-[#333]'
                    }`}
                  >
                    Servidor Proxy Stream
                  </button>
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
};
