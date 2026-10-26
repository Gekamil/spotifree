import React, { useState } from 'react';

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

  const externalIcon = (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="inline ml-1 text-[#b3b3b3]">
      <path d="M1 2.75C1 1.784 1.784 1 2.75 1h5.5a.75.75 0 0 1 0 1.5h-5.5a.25.25 0 0 0-.25.25v10.5c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25v-5.5a.75.75 0 0 1 1.5 0v5.5A1.75 1.75 0 0 1 13.25 15H2.75A1.75 1.75 0 0 1 1 13.25V2.75z" />
      <path d="M15 1.75a.75.75 0 0 0-.75-.75h-5.5a.75.75 0 0 0 0 1.5h3.69L7.22 7.72a.75.75 0 0 0 1.06 1.06l5.22-5.22v3.69a.75.75 0 0 0 1.5 0v-5.5z" />
    </svg>
  );

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
        {/* 1. CUENTA */}
        {matchesSearch('cuenta métodos inicio sesión') && (
          <section className="space-y-3">
            <h2 className="text-base font-bold text-white">Cuenta</h2>
            <div className="flex items-center justify-between py-2 border-b border-white/5">
              <span className="text-sm font-medium text-white">Editar métodos de inicio de sesión</span>
              <a
                href="https://www.spotify.com/account/overview/"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-1.5 rounded-full border border-[#727272] hover:border-white text-xs font-bold text-white transition-colors flex items-center gap-1 hover:scale-105"
              >
                Edición {externalIcon}
              </a>
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
