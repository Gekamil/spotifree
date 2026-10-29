import { SpotifreeAuthCard } from '../common/SpotifreeAuthCard';
import React, { useState, useEffect } from 'react';
import { useSpotifyDataStore } from '../../store/useSpotifyDataStore';
import { useUIStore } from '../../store/useUIStore';
import { handleImageError } from '../../utils/imageFallback';
import { audioEngine } from '../../services/audioEngine';
import { getStorageUsage, clearOfflineCache } from '../../utils/offlineStorage';

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
      return v ? parseInt(v, 10) : 0;
    }
    return 0;
  });

  const [automix, setAutomix] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.localStorage.getItem('spotifree_automix') !== 'false';
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
  const [eqBands, setEqBands] = useState<number[]>(() => {
    try {
      const saved = typeof window !== 'undefined' ? window.localStorage.getItem('spotifree_eq_bands') : null;
      if (saved) return JSON.parse(saved);
    } catch {}
    return [0, 0, 0, 0, 0, 0];
  });
  const [draggingBandIndex, setDraggingBandIndex] = useState<number | null>(null);

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
      window.localStorage.setItem('spotifree_gapless', String(next));
      if (!next) {
        setCrossfadeSeconds(0);
        window.localStorage.setItem('spotifree_crossfade_sec', '0');
      }
    }
  };

  const handleToggleAutomix = () => {
    const next = !automix;
    setAutomix(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('spotifree_automix', String(next));
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

  const handleBandPointerDown = (index: number, e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
    setDraggingBandIndex(index);
    updateBandFromClientY(index, e.clientY, e.currentTarget);
  };

  const handleBandPointerMove = (index: number, e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingBandIndex === index) {
      e.preventDefault();
      e.stopPropagation();
      updateBandFromClientY(index, e.clientY, e.currentTarget);
    }
  };

  const handleBandPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
    setDraggingBandIndex(null);
  };

  const updateBandFromClientY = (index: number, clientY: number, target: HTMLElement) => {
    const rect = target.getBoundingClientRect();
    const padding = 12;
    const availH = rect.height - padding * 2;
    if (availH <= 0) return;
    const relY = Math.max(0, Math.min(availH, clientY - (rect.top + padding)));
    const norm = 1 - (relY / availH); // 0 at bottom (-12 dB), 1 at top (+12 dB)
    const db = Math.round(((norm * 24) - 12) * 2) / 2;
    const clampedDb = Math.max(-12, Math.min(12, db));
    handleBandSlider(index, clampedDb);
  };

  // 6 points for real-time SVG curve
  const svgW = 300;
  const svgH = 88;
  const padX = 20;
  const padY = 10;
  const availW = svgW - padX * 2;
  const availH = svgH - padY * 2;
  const zeroY = padY + availH / 2;

  const curvePoints = eqBands.map((db, i) => {
    const x = padX + (i / (eqBands.length - 1)) * availW;
    const norm = (db + 12) / 24; // 0 to 1
    const y = padY + (1 - norm) * availH;
    return { x, y };
  });

  let eqCurvePath = '';
  if (curvePoints.length > 0) {
    eqCurvePath = `M ${curvePoints[0].x} ${curvePoints[0].y}`;
    for (let i = 0; i < curvePoints.length - 1; i++) {
      const p0 = curvePoints[i === 0 ? 0 : i - 1];
      const p1 = curvePoints[i];
      const p2 = curvePoints[i + 1];
      const p3 = curvePoints[i + 2 < curvePoints.length ? i + 2 : i + 1];

      const cp1x = p1.x + (p2.x - p0.x) / 5;
      const cp1y = p1.y + (p2.y - p0.y) / 5;
      const cp2x = p2.x - (p3.x - p1.x) / 5;
      const cp2y = p2.y - (p3.y - p1.y) / 5;

      eqCurvePath += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
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

            {/* Crossfade / Fundido entre canciones (Solo visible si Reproducción sin pausas está activa) */}
            {gaplessAudio && (
              <div className="pt-2 border-t border-white/5 space-y-2 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-white">Fundido entre canciones</p>
                    <p className="text-xs text-[#b3b3b3]">Simultáneo entre pistas de audio</p>
                  </div>
                  <span className="text-xs font-['SpotifyMixUI'] tabular-nums font-bold text-[#1ed760]">
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
                  style={{
                    background: `linear-gradient(to right, #1ed760 ${(crossfadeSeconds / 12) * 100}%, rgba(255, 255, 255, 0.2) ${(crossfadeSeconds / 12) * 100}%)`,
                  }}
                  className="w-full h-1 rounded-lg appearance-none cursor-pointer accent-[#1ed760] touch-none"
                />
              </div>
            )}

            {/* Automix (Transiciones inteligentes entre canciones) */}
            <div className="flex items-center justify-between pt-2 border-t border-white/5">
              <div>
                <p className="text-sm font-bold text-white">Automix</p>
                <p className="text-xs text-[#b3b3b3]">
                  Detecta cambios de nivel y calcula la transición óptima dejando hueco a ambas canciones
                </p>
              </div>
              <button
                onClick={handleToggleAutomix}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                  automix ? 'bg-[#1ed760]' : 'bg-[#535353]'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
                    automix ? 'left-5' : 'left-0.5'
                  }`}
                />
              </button>
            </div>

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

        {/* Ecualizador Gráfico Rediseñado (Voz, Música y Frecuencias) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-[#b3b3b3] uppercase tracking-wider">
                Ecualizador de Audio
              </h3>
              <p className="text-[11px] text-[#727272] mt-0.5">
                Ajuste fino de frecuencias y decibelios en tiempo real
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
            <div className="p-4 rounded-2xl bg-[#181818] border border-white/[0.04] space-y-4 animate-in fade-in select-none">
              {/* Presets chips + Reset button */}
              <div className="flex items-center justify-between">
                <p className="text-xs text-[#b3b3b3] font-medium">Preajustes de respuesta</p>
                <button
                  onClick={() => handlePresetSelect('flat')}
                  className="text-[11px] text-[#1ed760] font-bold hover:underline transition-colors cursor-pointer"
                >
                  Restablecer a 0 dB
                </button>
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none touch-pan-x">
                {Object.keys(PRESETS).map((k) => (
                  <button
                    key={k}
                    onClick={() => handlePresetSelect(k)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold shrink-0 transition-all cursor-pointer ${
                      activePreset === k ? 'bg-[#1ed760] text-black shadow-md scale-102' : 'bg-[#242424] text-white hover:bg-white/10'
                    }`}
                  >
                    {PRESET_LABELS[k] || k}
                  </button>
                ))}
              </div>

              {/* Modificadores Rápidos de Audio: Voz vs Música */}
              <div className="pt-2 border-t border-white/5 space-y-2">
                <span className="text-xs font-bold text-white">Modificador de sonido</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handlePresetSelect('vocal')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      activePreset === 'vocal'
                        ? 'border-[#1ed760] bg-[#1ed760]/10 text-white'
                        : 'border-white/10 bg-[#121212] text-[#b3b3b3] hover:border-white/20'
                    }`}
                  >
                    <span className="block text-xs font-bold text-white">🎤 Realzar Voz</span>
                    <span className="block text-[10px] text-[#b3b3b3]">Voces claras y presentes</span>
                  </button>
                  <button
                    onClick={() => handlePresetSelect('rock')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      activePreset === 'rock'
                        ? 'border-[#1ed760] bg-[#1ed760]/10 text-white'
                        : 'border-white/10 bg-[#121212] text-[#b3b3b3] hover:border-white/20'
                    }`}
                  >
                    <span className="block text-xs font-bold text-white">🎵 Realzar Música</span>
                    <span className="block text-[10px] text-[#b3b3b3]">Instrumental y brillo</span>
                  </button>
                </div>
              </div>

              {/* Real-time SVG Frequency Curve Card */}
              <div className="relative h-[88px] bg-[#121212] rounded-xl border border-white/5 overflow-hidden px-3 pt-2">
                {/* Horizontal guide lines */}
                <div className="absolute inset-x-3 top-2 bottom-2 flex flex-col justify-between pointer-events-none opacity-40">
                  <div className="border-b border-dashed border-white/15 w-full flex justify-between">
                    <span className="text-[9px] font-['SpotifyMixUI'] tabular-nums text-white/30 -mt-2">+12 dB</span>
                  </div>
                  <div className="border-b border-white/30 w-full flex justify-between">
                    <span className="text-[9px] font-['SpotifyMixUI'] tabular-nums text-white/50 -mt-2">0 dB</span>
                  </div>
                  <div className="border-b border-dashed border-white/15 w-full flex justify-between">
                    <span className="text-[9px] font-['SpotifyMixUI'] tabular-nums text-white/30 -mt-2">-12 dB</span>
                  </div>
                </div>

                {/* SVG Curve */}
                <svg
                  viewBox={`0 0 ${svgW} ${svgH}`}
                  preserveAspectRatio="none"
                  className="w-full h-full pointer-events-none relative z-10"
                >
                  <defs>
                    <linearGradient id="mobileEqGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#1ed760" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="#1ed760" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  {/* Fill */}
                  <path
                    d={`${eqCurvePath} L ${curvePoints[curvePoints.length - 1].x} ${zeroY} L ${curvePoints[0].x} ${zeroY} Z`}
                    fill="url(#mobileEqGrad)"
                  />
                  {/* Stroke */}
                  <path
                    d={eqCurvePath}
                    fill="none"
                    stroke="#1ed760"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {/* Curve Nodes */}
                  {curvePoints.map((pt, idx) => (
                    <circle
                      key={`pt-${idx}`}
                      cx={pt.x}
                      cy={pt.y}
                      r={draggingBandIndex === idx ? 4.5 : 3}
                      fill={draggingBandIndex === idx ? '#ffffff' : '#1ed760'}
                      className="transition-all"
                    />
                  ))}
                </svg>
              </div>

              {/* 6 Touch-Optimized Vertical Decibel Sliders */}
              <div className="grid grid-cols-6 gap-1 pt-1 text-center select-none">
                {FREQ_POINTS.map((f, idx) => {
                  const dbVal = eqBands[idx];
                  const norm = (dbVal + 12) / 24; // 0 to 1
                  const topPercent = (1 - norm) * 100;
                  const isDraggingThis = draggingBandIndex === idx;

                  return (
                    <div key={f.label} className="flex flex-col items-center">
                      {/* dB Value Badge */}
                      <span
                        className={`text-[11px] font-['SpotifyMixUI'] tabular-nums font-bold transition-colors ${
                          dbVal > 0 ? 'text-[#1ed760]' : dbVal === 0 ? 'text-white/80' : 'text-[#888888]'
                        }`}
                      >
                        {dbVal > 0 ? `+${dbVal.toFixed(1)}` : dbVal.toFixed(1)} dB
                      </span>

                      {/* Touch-safe vertical channel with touch-none */}
                      <div
                        className="relative w-full h-[140px] flex items-center justify-center cursor-pointer touch-none select-none my-1"
                        onPointerDown={(e) => handleBandPointerDown(idx, e)}
                        onPointerMove={(e) => handleBandPointerMove(idx, e)}
                        onPointerUp={handleBandPointerUp}
                        onPointerCancel={handleBandPointerUp}
                      >
                        {/* Background track bar */}
                        <div className="absolute inset-y-3 w-1.5 bg-white/[0.08] rounded-full pointer-events-none" />

                        {/* Midline at 0 dB (50%) */}
                        <div className="absolute top-1/2 inset-x-2 h-[1px] bg-white/20 pointer-events-none" />

                        {/* Dynamic Active Fill bar */}
                        {dbVal >= 0 ? (
                          <div
                            style={{
                              top: `${topPercent}%`,
                              height: `${Math.max(0, 50 - topPercent)}%`,
                            }}
                            className="absolute w-1.5 bg-[#1ed760] rounded-t-full pointer-events-none transition-all duration-75"
                          />
                        ) : (
                          <div
                            style={{
                              top: '50%',
                              height: `${Math.max(0, topPercent - 50)}%`,
                            }}
                            className="absolute w-1.5 bg-white/30 rounded-b-full pointer-events-none transition-all duration-75"
                          />
                        )}

                        {/* Draggable Circle Handle / Thumb */}
                        <div
                          style={{ top: `${topPercent}%` }}
                          className={`absolute -translate-y-1/2 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-white border-[3px] border-[#1ed760] shadow-[0_2px_8px_rgba(0,0,0,0.8)] pointer-events-none transition-transform duration-75 ${
                            isDraggingThis ? 'scale-130 bg-[#1ed760] border-white shadow-[0_0_12px_#1ed760]' : ''
                          }`}
                        />
                      </div>

                      {/* Frequency label */}
                      <span className="text-[10px] text-[#b3b3b3] font-bold mt-1">
                        {f.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              <p className="text-[11px] text-[#727272] text-center pt-1 font-medium">
                Desliza verticalmente sobre cualquier frecuencia para modular el espectro sonoro en tiempo real.
              </p>
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
