import React, { useState } from 'react';
import { useUIStore } from '../../store/useUIStore';
import { useSpotifyDataStore } from '../../store/useSpotifyDataStore';
import { audioEngine } from '../../services/audioEngine';
import {
  validateSpotifyCookie,
  extractSpotifySessionFromCookie,
} from '../../services/spotifyCookieService';

interface FrequencyPoint {
  label: string;
  value: number; // dB from -12 to +12
}

const PRESETS: Record<string, number[]> = {
  custom: [0, 0, 0, 0, 0, 0],
  flat: [0, 0, 0, 0, 0, 0],
  bassBoost: [6, 4.5, 2, 0, 0, 0],
  acoustic: [3.5, 2.5, 0.5, 1.5, 3, 3.5],
  electronic: [5, 4, 1, 2, 4.5, 5.5],
  pop: [-1, 2, 4, 3, 1, -1],
  rock: [4.5, 3, -1, 1.5, 3.5, 5],
  vocal: [-2, 0.5, 3.5, 4, 2, -1],
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

export const DesktopSettingsView: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const { setActiveMainTab } = useUIStore();
  const { user, isAuthenticated, logout } = useSpotifyDataStore();

  const [spotifyCookie, setSpotifyCookie] = useState<string>(() => {
    return typeof window !== 'undefined'
      ? window.localStorage.getItem('user_spotify_cookie') || ''
      : '';
  });
  const [savedSpotifyCookieSuccess, setSavedSpotifyCookieSuccess] = useState(false);
  const [cookieError, setCookieError] = useState<string | null>(null);
  const [isExtractingCookie, setIsExtractingCookie] = useState(false);

  const handleSaveSpotifyCookie = async () => {
    setCookieError(null);
    const val = spotifyCookie.trim();
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
        window.localStorage.setItem('spotify_extracted_session', JSON.stringify(session));
      }
      useSpotifyDataStore.setState({
        isAuthenticated: true,
        user: session.user,
        playlists: session.playlists,
        dynamicShelves: session.shelves,
        quickAccessCards: session.quickAccess,
      });
      setSavedSpotifyCookieSuccess(true);
      setTimeout(() => {
        setSavedSpotifyCookieSuccess(false);
        setActiveMainTab('home');
      }, 1200);
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
  const [youtubeCookies, setYoutubeCookies] = useState<string>(() => {
    return typeof window !== 'undefined'
      ? window.localStorage.getItem('user_youtube_cookies') || ''
      : '';
  });
  const [savedCookiesSuccess, setSavedCookiesSuccess] = useState(false);
  const [testingAudio, setTestingAudio] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const [customClientId, setCustomClientId] = useState<string>(() => {
    return typeof window !== 'undefined'
      ? window.localStorage.getItem('custom_spotify_client_id') || ''
      : '';
  });
  const [savedClientIdSuccess, setSavedClientIdSuccess] = useState(false);

  const handleSaveClientId = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('custom_spotify_client_id', customClientId.trim());
      setSavedClientIdSuccess(true);
      setTimeout(() => setSavedClientIdSuccess(false), 3000);
    }
  };

  const handleSaveCookies = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('user_youtube_cookies', youtubeCookies.trim());
      window.localStorage.setItem('spotifree_audio_engine', engineMode);
      setSavedCookiesSuccess(true);
      setTimeout(() => setSavedCookiesSuccess(false), 3000);
    }
  };

  const handleTestAudio = async () => {
    setTestingAudio(true);
    setTestResult(null);
    try {
      await audioEngine.playTrack('test-coldplay-yellow', 'Coldplay Yellow', 0);
      setTestResult('¡Reproducción iniciada con éxito! Comprueba la barra inferior.');
    } catch (e: any) {
      setTestResult('Error: ' + e.message);
    } finally {
      setTestingAudio(false);
    }
  };

  // Settings State
  const [language, setLanguage] = useState('es-ES');
  const [audioQuality, setAudioQuality] = useState('very_high');
  const [normalizeVolume, setNormalizeVolume] = useState(true);
  const [compactLibrary, setCompactLibrary] = useState(false);
  const [showNowPlayingOnClick, setShowNowPlayingOnClick] = useState(true);
  const [musicVideos, setMusicVideos] = useState(true);
  const [canvasEnabled, setCanvasEnabled] = useState(true);

  // Equalizer 6-band State (-12 to +12 dB)
  const [activePreset, setActivePreset] = useState<string>('flat');
  const [eqBands, setEqBands] = useState<FrequencyPoint[]>([
    { label: '60Hz', value: 0 },
    { label: '150Hz', value: 0 },
    { label: '400Hz', value: 0 },
    { label: '1KHz', value: 0 },
    { label: '2.4KHz', value: 0 },
    { label: '15KHz', value: 0 },
  ]);

  const syncEqWithEngine = (bands: FrequencyPoint[]) => {
    if (typeof window !== 'undefined' && (window as any).__audioEngine) {
      (window as any).__audioEngine.setAllEqualizerBands(bands);
    }
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
  const eqWidth = 720;
  const eqHeight = 160;
  const zeroY = eqHeight / 2;

  const points = eqBands.map((band, idx) => {
    const x = 50 + (idx / (eqBands.length - 1)) * (eqWidth - 100);
    const y = zeroY - (band.value / 12) * (eqHeight / 2 - 20);
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

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      curvePath += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
  }



  return (
    <div className="min-h-full bg-gradient-to-b from-[#1e1e1e] via-[#121212] to-[#121212] text-white p-6 md:p-8 select-none max-w-4xl mx-auto pb-16">
      {/* Title & Search Bar */}
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-white mb-4">Configuración</h1>
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

      <div className="space-y-10">
        {/* 1. CUENTA Y SESIÓN INDEPENDIENTE */}
        {matchesSearch('cuenta métodos inicio sesión spotify usuario invitado cookies sp_dc') && (
          <section className="space-y-3">
            <h2 className="text-base font-bold text-white">Cuenta & Sesión de Spotify</h2>
            <div className="bg-[#181818] p-4 rounded-xl border border-white/5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${isAuthenticated ? 'bg-[#1ed760] animate-pulse' : 'bg-[#a7a7a7]'}`} />
                    <span className="text-sm font-bold text-white">
                      {isAuthenticated ? `Conectado como: ${user?.display_name || 'Usuario'}` : 'Sesión local (No conectado)'}
                    </span>
                  </div>
                  <p className="text-xs text-[#a7a7a7] mt-1">
                    {isAuthenticated
                      ? 'Tu sesión es privada e independiente en este dispositivo.'
                      : 'Introduce tu cookie de sesión para sincronizar tus listas de reproducción sin restricciones.'}
                  </p>
                </div>
                <div>
                  {isAuthenticated ? (
                    <button
                      onClick={logout}
                      className="px-4 py-1.5 rounded-full border border-white/20 text-[#b3b3b3] hover:text-white hover:border-white text-xs font-bold transition-all"
                    >
                      Desconectar
                    </button>
                  ) : (
                    <button
                      onClick={() => setActiveMainTab('guide')}
                      className="px-4 py-1.5 rounded-full bg-white hover:bg-[#f0f0f0] text-black text-xs font-bold transition-all shadow cursor-pointer"
                    >
                      Guía paso a paso
                    </button>
                  )}
                </div>
              </div>

              {/* Cookie de sesión sp_dc */}
              <div className="pt-3 border-t border-white/5 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white">
                    Cookie de sesión de Spotify (sp_dc)
                  </label>
                  <div className="flex items-center gap-2">
                    {savedSpotifyCookieSuccess && (
                      <span className="text-[11px] font-bold text-[#1ed760] animate-in fade-in">
                        Guardada en este navegador
                      </span>
                    )}
                    <button
                      onClick={() => setActiveMainTab('guide')}
                      className="text-[11px] text-[#b3b3b3] hover:text-white underline cursor-pointer"
                    >
                      ¿Cómo obtener tu cookie?
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-[#a7a7a7] leading-relaxed">
                  Permite sincronizar tu biblioteca de Spotify de forma directa sin limitaciones de cuenta de desarrollador. Se almacena localmente en tu navegador.
                </p>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={spotifyCookie}
                    onChange={(e) => {
                      setSpotifyCookie(e.target.value);
                      if (cookieError) setCookieError(null);
                    }}
                    placeholder="Pega aquí tu cookie sp_dc (AQD...)"
                    className="flex-1 bg-[#121212] border border-white/10 rounded px-3 py-1.5 text-xs text-white outline-none focus:border-white transition-colors font-mono"
                  />
                  <button
                    onClick={handleSaveSpotifyCookie}
                    disabled={isExtractingCookie}
                    className="px-4 py-1.5 bg-white hover:bg-[#f0f0f0] text-black text-xs font-bold rounded transition-all shrink-0 cursor-pointer shadow disabled:opacity-50"
                  >
                    {isExtractingCookie ? 'Extrayendo...' : 'Guardar cookie'}
                  </button>
                </div>
                {cookieError && (
                  <p className="text-xs font-semibold text-[#f87171] animate-in fade-in">
                    {cookieError}
                  </p>
                )}
              </div>

              {/* Custom Spotify Client ID field (Opcional) */}
              <div className="pt-3 border-t border-white/5 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#b3b3b3]">
                    Client ID de Spotify Developer (Opcional)
                  </label>
                  {savedClientIdSuccess && (
                    <span className="text-[11px] font-bold text-[#1ed760] animate-in fade-in">
                      Guardado correctamente
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[#a7a7a7]">
                  Si dispones de una cuenta de desarrollador de Spotify, puedes vincular tu propio Client ID.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customClientId}
                    onChange={(e) => setCustomClientId(e.target.value)}
                    placeholder="ea3003771e264c4690a2ac289afd22a4 (por defecto)"
                    className="flex-1 bg-[#121212] border border-white/10 rounded px-3 py-1.5 text-xs text-white outline-none focus:border-white"
                  />
                  <button
                    onClick={handleSaveClientId}
                    className="px-4 py-1.5 bg-[#282828] hover:bg-[#333] text-white text-xs font-bold rounded transition-all shrink-0 cursor-pointer"
                  >
                    Guardar
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* 1.5 MOTOR DE REPRODUCCIÓN & SESIÓN DE YOUTUBE */}
        {matchesSearch('motor reproducción youtube cookies audio stream ip conexión') && (
          <section className="space-y-4">
            <h2 className="text-base font-bold text-white">Motor de Reproducción & YouTube (Por Dispositivo)</h2>
            <div className="bg-[#181818] p-4 rounded-xl border border-white/5 space-y-4">
              <div>
                <label className="text-xs font-bold text-[#b3b3b3] uppercase tracking-wider block mb-2">
                  Modo de Reproducción de Audio
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={() => {
                      setEngineMode('hybrid');
                      if (typeof window !== 'undefined') window.localStorage.setItem('spotifree_audio_engine', 'hybrid');
                    }}
                    className={`p-3 rounded-lg text-left border transition-all cursor-pointer ${
                      engineMode === 'hybrid'
                        ? 'border-[#1ed760] bg-[#1ed760]/10 text-white'
                        : 'border-white/10 bg-[#222] text-[#b3b3b3] hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-white">Modo Nativo Híbrido (Recomendado)</span>
                      {engineMode === 'hybrid' && <span className="w-2 h-2 rounded-full bg-[#1ed760]" />}
                    </div>
                    <p className="text-[11px] text-[#a7a7a7]">
                      Reproduce directamente en tu navegador usando la IP de tu dispositivo. 100% inmune a bloqueos de centro de datos.
                    </p>
                  </button>

                  <button
                    onClick={() => {
                      setEngineMode('stream');
                      if (typeof window !== 'undefined') window.localStorage.setItem('spotifree_audio_engine', 'stream');
                    }}
                    className={`p-3 rounded-lg text-left border transition-all cursor-pointer ${
                      engineMode === 'stream'
                        ? 'border-[#1ed760] bg-[#1ed760]/10 text-white'
                        : 'border-white/10 bg-[#222] text-[#b3b3b3] hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-white">Modo Servidor Proxy Stream</span>
                      {engineMode === 'stream' && <span className="w-2 h-2 rounded-full bg-[#1ed760]" />}
                    </div>
                    <p className="text-[11px] text-[#a7a7a7]">
                      Canaliza el audio a través del backend en la nube con cookies de sesión personalizadas.
                    </p>
                  </button>
                </div>
              </div>

              {/* Sesión de YouTube Personal */}
              <div className="pt-2 border-t border-white/5 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#b3b3b3] uppercase tracking-wider">
                    Cookies / Sesión de YouTube Personal (Opcional)
                  </label>
                  <span className="text-[11px] text-[#1ed760]">● Almacenado local en este dispositivo</span>
                </div>
                <p className="text-xs text-[#a7a7a7]">
                  Si deseas conectar tu propia cuenta de YouTube de manera independiente en este dispositivo (sin depender de una cuenta compartida), pega aquí tus cookies (formato JSON o Netscape):
                </p>
                <textarea
                  value={youtubeCookies}
                  onChange={(e) => setYoutubeCookies(e.target.value)}
                  placeholder="Pega aquí tus cookies de YouTube (JSON exportado o Netscape)..."
                  rows={3}
                  className="w-full bg-[#242424] text-xs text-white p-3 rounded-lg font-mono border border-white/10 focus:border-[#1ed760] focus:outline-none transition-colors"
                />
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSaveCookies}
                      className="px-4 py-2 rounded-full bg-[#1ed760] text-black font-bold text-xs hover:scale-104 transition-all"
                    >
                      Guardar configuración local
                    </button>
                    {savedCookiesSuccess && (
                      <span className="text-xs text-[#1ed760] font-semibold">¡Ajustes guardados correctamente!</span>
                    )}
                  </div>

                  <button
                    onClick={handleTestAudio}
                    disabled={testingAudio}
                    className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-all disabled:opacity-50"
                  >
                    {testingAudio ? 'Comprobando...' : 'Probar reproducción ahora'}
                  </button>
                </div>

                {testResult && (
                  <div className={`p-3 rounded-lg text-xs mt-2 ${testResult.startsWith('Error') ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-[#1ed760]/10 text-[#1ed760] border border-[#1ed760]/20'}`}>
                    {testResult}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* 2. IDIOMA */}
        {matchesSearch('idioma language english español') && (
          <section className="space-y-3">
            <h2 className="text-base font-bold text-white">Idioma</h2>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-2 border-b border-white/5">
              <p className="text-sm font-medium text-white">Elige tu idioma; los cambios se aplicarán tras reiniciar la aplicación</p>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="bg-[#242424] hover:bg-[#2a2a2a] text-white text-xs font-semibold px-3 py-2 rounded-md border border-[#727272] hover:border-white focus:outline-none cursor-pointer"
              >
                <option value="es-ES">Español de España (European Spanish)</option>
                <option value="en-US">English (English)</option>
                <option value="es-419">Español de Latinoamérica (Latin American Spanish)</option>
                <option value="fr-FR">Français (French)</option>
                <option value="de-DE">Deutsch (German)</option>
                <option value="it-IT">Italiano (Italian)</option>
                <option value="pt-BR">Português do Brasil (Brazilian Portuguese)</option>
                <option value="ja-JP">日本語 (Japanese)</option>
              </select>
            </div>
          </section>
        )}

        {/* 3. CALIDAD DEL AUDIO */}
        {matchesSearch('calidad audio streaming normalizar volumen') && (
          <section className="space-y-3">
            <h2 className="text-base font-bold text-white">Calidad del audio</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-white/5">
                <span className="text-sm font-medium text-white">Calidad de streaming</span>
                <select
                  value={audioQuality}
                  onChange={(e) => setAudioQuality(e.target.value)}
                  className="bg-[#242424] hover:bg-[#2a2a2a] text-white text-xs font-semibold px-3 py-2 rounded-md border border-[#727272] hover:border-white focus:outline-none cursor-pointer"
                >
                  <option value="auto">Automática</option>
                  <option value="low">Baja (96 kbps)</option>
                  <option value="normal">Normal (160 kbps)</option>
                  <option value="high">Alta (320 kbps)</option>
                  <option value="very_high">Muy alta (Sin pérdida FLAC)</option>
                </select>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-white/5">
                <span className="text-sm font-medium text-white">
                  Normalizar el volumen - igualar el volumen de todas las canciones y pódcasts
                </span>
                <SpotifyToggle
                  checked={normalizeVolume}
                  onChange={setNormalizeVolume}
                  ariaLabel="Normalizar el volumen"
                />
              </div>
            </div>
          </section>
        )}

        {/* 4. TU BIBLIOTECA */}
        {matchesSearch('tu biblioteca compacta importar música aplicaciones') && (
          <section className="space-y-3">
            <h2 className="text-base font-bold text-white">Tu biblioteca</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-white/5">
                <span className="text-sm font-medium text-white">Usar diseño de biblioteca compacta</span>
                <SpotifyToggle
                  checked={compactLibrary}
                  onChange={setCompactLibrary}
                  ariaLabel="Usar diseño de biblioteca compacta"
                />
              </div>
            </div>
          </section>
        )}

        {/* 5. VISUALIZACIÓN */}
        {matchesSearch('visualización sonando panel reproducir') && (
          <section className="space-y-3">
            <h2 className="text-base font-bold text-white">Visualización</h2>
            <div className="flex items-center justify-between py-2 border-b border-white/5">
              <span className="text-sm font-medium text-white">
                Mostrar el panel Sonando al hacer clic a reproducir
              </span>
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
            <div className="flex items-center gap-2 text-xs text-[#a7a7a7] mb-1">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="text-[#a7a7a7]">
                <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8z" />
                <path d="M7.25 4.75a.75.75 0 1 1 1.5 0 .75.75 0 0 1-1.5 0zM7.25 7h1.5v4.5h-1.5V7z" />
              </svg>
              <span>Tu experiencia puede tardar un poco en actualizarse.</span>
            </div>
            <h2 className="text-base font-bold text-white">Vídeos y Canvas</h2>

            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-white/5">
                <div>
                  <div className="text-sm font-medium text-white">Vídeos musicales</div>
                  <div className="text-xs text-[#a7a7a7] mt-0.5">
                    Si esta opción está desactivada, los vídeos musicales y las actuaciones en directo se reproducen solo con audio.
                  </div>
                </div>
                <SpotifyToggle
                  checked={musicVideos}
                  onChange={setMusicVideos}
                  ariaLabel="Vídeos musicales"
                />
              </div>

              <div className="flex items-center justify-between py-2 border-b border-white/5">
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

        {/* 7. REPRODUCCIÓN (Ecualizador Real de 6 Bandas con Web Audio API) */}
        {matchesSearch('reproducción ecualizador decibelios hz frecuencia sonido') && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white">Reproducción</h2>
                <p className="text-xs text-[#a7a7a7] mt-0.5">
                  Ajusta las frecuencias de audio en tiempo real con el ecualizador activo.
                </p>
              </div>

              {/* Presets Dropdown */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#a7a7a7]">Preajuste:</span>
                <select
                  value={activePreset}
                  onChange={(e) => handlePresetSelect(e.target.value)}
                  className="bg-[#242424] hover:bg-[#2a2a2a] text-white text-xs font-semibold px-3 py-1.5 rounded-md border border-[#727272] hover:border-white focus:outline-none cursor-pointer"
                >
                  <option value="flat">Plano</option>
                  <option value="bassBoost">Refuerzo de graves</option>
                  <option value="acoustic">Acústico</option>
                  <option value="electronic">Electrónica</option>
                  <option value="pop">Pop</option>
                  <option value="rock">Rock</option>
                  <option value="vocal">Vocal</option>
                  {activePreset === 'custom' && <option value="custom">Personalizado</option>}
                </select>
              </div>
            </div>

            {/* Equalizer Container Card */}
            <div className="bg-[#181818] rounded-xl p-6 border border-white/5 shadow-2xl relative overflow-hidden">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-[#b3b3b3]">+12dB</span>
                <span className="text-[11px] font-bold text-[#1ed760] tracking-wider uppercase flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#1ed760] animate-pulse" />
                  Ecualizador Activo
                </span>
              </div>

              {/* Interactive Curve SVG & Sliders */}
              <div className="relative w-full h-[180px] flex items-center justify-center">
                {/* SVG Curve Background */}
                <svg
                  viewBox={`0 0 ${eqWidth} ${eqHeight}`}
                  preserveAspectRatio="none"
                  className="absolute inset-0 w-full h-full pointer-events-none"
                >
                  {/* Grid Lines */}
                  <line x1="40" y1={zeroY} x2={eqWidth - 40} y2={zeroY} stroke="#333333" strokeWidth="1" strokeDasharray="3 3" />
                  <line x1="40" y1="20" x2={eqWidth - 40} y2="20" stroke="#222222" strokeWidth="1" />
                  <line x1="40" y1={eqHeight - 20} x2={eqWidth - 40} y2={eqHeight - 20} stroke="#222222" strokeWidth="1" />

                  {/* Gradient area under curve */}
                  <defs>
                    <linearGradient id="eqGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#1ed760" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#1ed760" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Frequency Curve */}
                  <path
                    d={curvePath}
                    fill="none"
                    stroke="#1ed760"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* Frequency Knobs */}
                  {points.map((p, i) => (
                    <circle
                      key={i}
                      cx={p.x}
                      cy={p.y}
                      r="6.5"
                      fill="#ffffff"
                      stroke="#1ed760"
                      strokeWidth="3"
                    />
                  ))}
                </svg>

                {/* Vertical slider tracks */}
                <div className="relative z-10 w-full h-full flex justify-between px-6 sm:px-12 items-end pb-6">
                  {eqBands.map((band, idx) => (
                    <div key={idx} className="flex flex-col items-center group">
                      <span className="text-[10px] text-[#a7a7a7] group-hover:text-white font-mono mb-1.5 transition-colors">
                        {band.value > 0 ? `+${band.value.toFixed(1)}` : band.value.toFixed(1)}dB
                      </span>
                      <input
                        type="range"
                        min="-12"
                        max="12"
                        step="0.5"
                        value={band.value}
                        onChange={(e) => handleBandChange(idx, parseFloat(e.target.value))}
                        aria-label={`cambiar decibelios a ${band.label}`}
                        className="h-28 w-2 appearance-none bg-[#2e2e2e] group-hover:bg-[#404040] rounded-full cursor-pointer accent-[#1ed760] [writing-mode:vertical-lr] [direction:rtl] transition-colors"
                      />
                      <label className="text-[11px] font-semibold text-[#b3b3b3] group-hover:text-white mt-2 font-mono transition-colors">
                        {band.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center mt-1">
                <span className="text-xs font-bold text-[#b3b3b3]">-12dB</span>
                <button
                  onClick={() => handlePresetSelect('flat')}
                  className="text-xs text-[#a7a7a7] hover:text-white hover:underline transition-colors"
                >
                  Restablecer a plano
                </button>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};
