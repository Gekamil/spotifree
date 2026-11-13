import React, { useState } from 'react';
import { getRecentAtEnd, getShuffleAlgorithm, setRecentAtEnd, setShuffleAlgorithm, type ShuffleAlgorithm } from '../../utils/shuffleOrder';
import { useLabsStore } from '../../services/labsService';
import { clearAllNotInterested, getNotInterestedCount } from '../../utils/notInterested';
import { SpatialAudioPad } from './SpatialAudioPad';

const OPTIONS: Array<{ id: ShuffleAlgorithm; title: string; desc: string }> = [
  {
    id: 'balanced',
    title: 'Aleatorio equilibrado',
    desc: 'Reparte las canciones de cada artista por toda la lista para que no suene el mismo artista varias veces seguidas. Es como funciona el aleatorio de Spotify.',
  },
  {
    id: 'random',
    title: 'Aleatorio clásico',
    desc: 'Un orden al azar, sin más. Puede repetir artista seguido.',
  },
];

/** Settings › Ajustes avanzados: shuffle, labs, playback speed, 3D spatial and taste ratings */
export const AdvancedSettingsSection: React.FC<{ variant?: 'mobile' | 'desktop' }> = ({ variant = 'mobile' }) => {
  const [algo, setAlgo] = useState<ShuffleAlgorithm>(() => getShuffleAlgorithm());
  const [recent, setRecent] = useState(() => getRecentAtEnd());
  const desktop = variant === 'desktop';

  // Labs Store state (called unconditionally at top level)
  const {
    labsEnabled,
    setLabsEnabled,
    speedControlEnabled,
    setSpeedControlEnabled,
    playbackSpeed,
    audioMono,
    setAudioMono,
    spatialEnabled,
    setSpatialEnabled,
    tasteRatingEnabled,
    setTasteRatingEnabled,
    dislikedTasteKeys,
    clearAllDislikes,
  } = useLabsStore();

  const discardedCount = Math.max(dislikedTasteKeys.length, getNotInterestedCount());
  const handleClearDiscards = () => {
    clearAllDislikes();
    clearAllNotInterested();
  };

  if (desktop) {
    return (
      <div className="font-['SpotifyMixUI']">
        {/* Shuffle Mode */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 py-3 border-b border-white/5">
          <div className="space-y-1 max-w-md">
            <span className="text-sm font-semibold text-white">Modo aleatorio</span>
            <p className="text-xs text-[#a7a7a7] leading-relaxed">
              Elige cómo se ordenan las canciones al activar la reproducción aleatoria.
            </p>
          </div>
          <div role="radiogroup" aria-label="Modo aleatorio" className="flex flex-col gap-2 shrink-0 sm:min-w-[280px]">
            {OPTIONS.map((o) => {
              const on = algo === o.id;
              return (
                <button
                  key={o.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => {
                    setAlgo(o.id);
                    setShuffleAlgorithm(o.id);
                  }}
                  className={`flex items-start gap-2.5 p-2 rounded-lg transition-colors cursor-pointer text-left ${
                    on ? 'bg-white/10' : 'hover:bg-white/5'
                  }`}
                >
                  <span className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                    on ? 'border-[#1ed760]' : 'border-[#727272]'
                  }`}>
                    <span className={`w-2 h-2 rounded-full bg-[#1ed760] transition-transform duration-200 ${on ? 'scale-100' : 'scale-0'}`} />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white truncate">{o.title}</span>
                      {o.id === 'balanced' && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-sm bg-[#1ed760]/15 text-[#1ed760]">
                          Recomendado
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-[#a7a7a7] leading-tight block mt-0.5">{o.desc}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Lo escuchado hace poco, al final */}
        <div className="flex items-center justify-between py-3 border-b border-white/5">
          <div className="space-y-0.5 max-w-md">
            <span className="text-sm font-semibold text-white">Lo escuchado hace poco, al final</span>
            <p className="text-xs text-[#a7a7a7] leading-relaxed">
              Las canciones que has escuchado en los últimos días van más tarde en el aleatorio, para empezar por lo que hace tiempo que no oyes.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={recent}
            aria-label="Lo escuchado hace poco, al final"
            onClick={() => {
              setRecent(!recent);
              setRecentAtEnd(!recent);
            }}
            className={`relative inline-flex h-[24px] w-[42px] shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${
              recent ? 'bg-[#1ed760]' : 'bg-[#535353] hover:bg-[#727272]'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-[20px] w-[20px] rounded-full bg-white shadow transform transition duration-200 ease-in-out mt-[2px] ${
                recent ? 'translate-x-[20px]' : 'translate-x-[2px]'
              }`}
            />
          </button>
        </div>

        {/* Modo Labs: Master Switch */}
        <div className="flex items-center justify-between py-3.5 border-b border-white/5">
          <div className="space-y-0.5 max-w-md">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white">Modo Labs (Spotifree Labs)</span>
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#1ed760]/20 text-[#1ed760]">
                Experimental
              </span>
            </div>
            <p className="text-xs text-[#a7a7a7] leading-relaxed">
              Desbloquea funciones avanzadas: control de velocidad en reproducción, balance acústico 3D y sistema de valoración Like / Dislike.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={labsEnabled}
            aria-label="Modo Labs (Spotifree Labs)"
            onClick={() => setLabsEnabled(!labsEnabled)}
            className={`relative inline-flex h-[24px] w-[42px] shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${
              labsEnabled ? 'bg-[#1ed760]' : 'bg-[#535353] hover:bg-[#727272]'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-[20px] w-[20px] rounded-full bg-white shadow transform transition duration-200 ease-in-out mt-[2px] ${
                labsEnabled ? 'translate-x-[20px]' : 'translate-x-[2px]'
              }`}
            />
          </button>
        </div>

        {/* Labs Feature 1: Control de velocidad */}
        {labsEnabled && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-3 border-b border-white/5 animate-in fade-in">
            <div className="space-y-0.5 max-w-md">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white">Control de velocidad y tono</span>
                {playbackSpeed !== 1.0 && (
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#1ed760]/20 text-[#1ed760]">
                    {playbackSpeed.toFixed(2)}x
                  </span>
                )}
              </div>
              <p className="text-xs text-[#a7a7a7] leading-relaxed">
                Permite cambiar la velocidad de las canciones (efecto slowed o nightcore) desde el menú de opciones o la barra del reproductor.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                role="switch"
                aria-checked={speedControlEnabled}
                aria-label="Control de velocidad y tono"
                onClick={() => setSpeedControlEnabled(!speedControlEnabled)}
                className={`relative inline-flex h-[24px] w-[42px] shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${
                  speedControlEnabled ? 'bg-[#1ed760]' : 'bg-[#535353] hover:bg-[#727272]'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-[20px] w-[20px] rounded-full bg-white shadow transform transition duration-200 ease-in-out mt-[2px] ${
                    speedControlEnabled ? 'translate-x-[20px]' : 'translate-x-[2px]'
                  }`}
                />
              </button>
            </div>
          </div>
        )}

        {/* Labs Feature 2: Audio Mono */}
        {labsEnabled && (
          <div className="flex items-center justify-between py-3 border-b border-white/5 animate-in fade-in">
            <div className="space-y-0.5 max-w-md">
              <span className="text-sm font-semibold text-white">Audio mono</span>
              <p className="text-xs text-[#a7a7a7] leading-relaxed">
                Combina los canales izquierdo y derecho para que suenen exactamente iguales por ambos altavoces o auriculares.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={audioMono}
              aria-label="Audio mono"
              onClick={() => setAudioMono(!audioMono)}
              className={`relative inline-flex h-[24px] w-[42px] shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${
                audioMono ? 'bg-[#1ed760]' : 'bg-[#535353] hover:bg-[#727272]'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-[20px] w-[20px] rounded-full bg-white shadow transform transition duration-200 ease-in-out mt-[2px] ${
                  audioMono ? 'translate-x-[20px]' : 'translate-x-[2px]'
                }`}
              />
            </button>
          </div>
        )}

        {/* Labs Feature 3: Posicionamiento 3D interactivo */}
        {labsEnabled && !audioMono && (
          <div className="py-4 border-b border-white/5 animate-in fade-in space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5 max-w-md">
                <span className="text-sm font-semibold text-white">Campo sonoro y balance 3D</span>
                <p className="text-xs text-[#a7a7a7] leading-relaxed">
                  Ubica el sonido en el espacio (izquierda, derecha, delante o detrás) para disfrutarlo con auriculares.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={spatialEnabled}
                aria-label="Campo sonoro y balance 3D"
                onClick={() => setSpatialEnabled(!spatialEnabled)}
                className={`relative inline-flex h-[24px] w-[42px] shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${
                  spatialEnabled ? 'bg-[#1ed760]' : 'bg-[#535353] hover:bg-[#727272]'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-[20px] w-[20px] rounded-full bg-white shadow transform transition duration-200 ease-in-out mt-[2px] ${
                    spatialEnabled ? 'translate-x-[20px]' : 'translate-x-[2px]'
                  }`}
                />
              </button>
            </div>
            {spatialEnabled && (
              <div className="pt-2 pl-2 sm:pl-4 border-l-2 border-[#1ed760]/30 animate-in fade-in">
                <SpatialAudioPad />
              </div>
            )}
          </div>
        )}

        {/* Labs Feature 4: Like / Dislike (Amazon Music style) */}
        {labsEnabled && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-3.5 border-b border-white/5 animate-in fade-in">
            <div className="space-y-0.5 max-w-md">
              <span className="text-sm font-semibold text-white">Sistema de valoración (Like / Dislike)</span>
              <p className="text-xs text-[#a7a7a7] leading-relaxed">
                Control de afinidad musical. Si marcas No me gusta, la canción salta inmediatamente y no volverá a sonar en listas, aleatorio ni Android Auto.
              </p>
              {discardedCount > 0 && (
                <p className="text-[11px] text-[#1ed760] pt-1">
                  {discardedCount} {discardedCount === 1 ? 'canción descartada' : 'canciones descartadas'}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {discardedCount > 0 && (
                <button
                  type="button"
                  onClick={handleClearDiscards}
                  className="text-xs font-bold text-[#b3b3b3] hover:text-white underline cursor-pointer"
                >
                  Restablecer descartes
                </button>
              )}
              <button
                type="button"
                role="switch"
                aria-checked={tasteRatingEnabled}
                aria-label="Sistema de valoración (Like / Dislike)"
                onClick={() => setTasteRatingEnabled(!tasteRatingEnabled)}
                className={`relative inline-flex h-[24px] w-[42px] shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${
                  tasteRatingEnabled ? 'bg-[#1ed760]' : 'bg-[#535353] hover:bg-[#727272]'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-[20px] w-[20px] rounded-full bg-white shadow transform transition duration-200 ease-in-out mt-[2px] ${
                    tasteRatingEnabled ? 'translate-x-[20px]' : 'translate-x-[2px]'
                  }`}
                />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <section className="space-y-4 font-['SpotifyMixUI']">
      {desktop && <h3 className="text-xs font-bold text-[#b3b3b3] uppercase tracking-wider">Ajustes avanzados</h3>}

      {/* Aleatorio Section */}
      <div>
        <p className="px-1 pb-2 text-[13px] font-bold text-[#b3b3b3]">Modo aleatorio</p>
        <div role="radiogroup" aria-label="Modo aleatorio" className="rounded-xl bg-[#181818] overflow-hidden divide-y divide-white/[0.05]">
          {OPTIONS.map((o) => {
            const on = algo === o.id;
            return (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => {
                  setAlgo(o.id);
                  setShuffleAlgorithm(o.id);
                }}
                className="w-full flex items-start gap-3 px-4 py-3.5 text-left active:bg-white/[0.06] hover:bg-white/[0.03] transition-colors cursor-pointer"
              >
                <span className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${on ? 'border-[#1ed760]' : 'border-[#727272]'}`}>
                  <span className={`w-2.5 h-2.5 rounded-full bg-[#1ed760] transition-transform duration-200 ${on ? 'scale-100' : 'scale-0'}`} />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="text-[15px] font-bold text-white">{o.title}</span>
                    {o.id === 'balanced' && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm bg-[#1ed760]/15 text-[#1ed760]">Recomendado</span>}
                  </span>
                  <span className="block text-[12.5px] text-[#a7a7a7] leading-snug mt-0.5">{o.desc}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl bg-[#181818] px-4 py-3.5 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[15px] font-bold text-white">Lo escuchado hace poco, al final</p>
          <p className="text-[12.5px] text-[#a7a7a7] leading-snug mt-0.5">
            Las canciones que has escuchado en los últimos días van más tarde en el aleatorio, para empezar por lo que hace tiempo que no oyes.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={recent}
          onClick={() => {
            setRecent(!recent);
            setRecentAtEnd(!recent);
          }}
          className={`w-11 h-6 rounded-full relative transition-colors shrink-0 cursor-pointer ${recent ? 'bg-[#1ed760]' : 'bg-[#535353]'}`}
        >
          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${recent ? 'left-[22px]' : 'left-0.5'}`} />
        </button>
      </div>

      {/* Modo Labs Section (Mobile) */}
      <div className="pt-2">
        <p className="px-1 pb-2 text-[13px] font-bold text-[#b3b3b3]">Spotifree Labs</p>
        <div className="rounded-xl bg-[#181818] px-4 py-3.5 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[15px] font-bold text-white">Activar Modo Labs</p>
              <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#1ed760]/20 text-[#1ed760]">
                Experimental
              </span>
            </div>
            <p className="text-[12.5px] text-[#a7a7a7] leading-snug mt-0.5">
              Habilita funciones experimentales como control de velocidad, balance acústico 3D y sistema de valoración Like / Dislike.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={labsEnabled}
            onClick={() => setLabsEnabled(!labsEnabled)}
            className={`w-11 h-6 rounded-full relative transition-colors shrink-0 cursor-pointer ${labsEnabled ? 'bg-[#1ed760]' : 'bg-[#535353]'}`}
          >
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${labsEnabled ? 'left-[22px]' : 'left-0.5'}`} />
          </button>
        </div>
      </div>

      {/* Labs Experimental Controls (Mobile) */}
      {labsEnabled && (
        <div className="space-y-3 animate-in fade-in">
          {/* Speed Control */}
          <div className="rounded-xl bg-[#181818] p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[15px] font-bold text-white">Velocidad de reproducción</p>
                  {playbackSpeed !== 1.0 && (
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#1ed760]/20 text-[#1ed760]">
                      {playbackSpeed.toFixed(2)}x
                    </span>
                  )}
                </div>
                <p className="text-[12px] text-[#a7a7a7] mt-0.5">
                  Ralentiza (slowed) o acelera (nightcore) la música al vuelo.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={speedControlEnabled}
                onClick={() => setSpeedControlEnabled(!speedControlEnabled)}
                className={`w-11 h-6 rounded-full relative transition-colors shrink-0 cursor-pointer ${speedControlEnabled ? 'bg-[#1ed760]' : 'bg-[#535353]'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${speedControlEnabled ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
            </div>
          </div>

          {/* Audio Mono & 3D Spatial */}
          <div className="rounded-xl bg-[#181818] p-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[15px] font-bold text-white">Audio mono</p>
                <p className="text-[12px] text-[#a7a7a7] mt-0.5">
                  Combina canales izquierdo y derecho para escuchar con un solo auricular.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={audioMono}
                onClick={() => setAudioMono(!audioMono)}
                className={`w-11 h-6 rounded-full relative transition-colors shrink-0 cursor-pointer ${audioMono ? 'bg-[#1ed760]' : 'bg-[#535353]'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${audioMono ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
            </div>

            {!audioMono && (
              <div className="pt-3 border-t border-white/5 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[15px] font-bold text-white">Balance y campo acústico 3D</p>
                    <p className="text-[12px] text-[#a7a7a7] mt-0.5">
                      Orienta la música en el espacio para auriculares.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={spatialEnabled}
                    onClick={() => setSpatialEnabled(!spatialEnabled)}
                    className={`w-11 h-6 rounded-full relative transition-colors shrink-0 cursor-pointer ${spatialEnabled ? 'bg-[#1ed760]' : 'bg-[#535353]'}`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${spatialEnabled ? 'left-[22px]' : 'left-0.5'}`} />
                  </button>
                </div>
                {spatialEnabled && <SpatialAudioPad />}
              </div>
            )}
          </div>

          {/* Like / Dislike */}
          <div className="rounded-xl bg-[#181818] p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[15px] font-bold text-white">Valoraciones (Like / Dislike)</p>
                <p className="text-[12px] text-[#a7a7a7] mt-0.5">
                  Control de afinidad musical estilo Amazon Music. Descartar una canción la salta y la bloquea de tus listas y Android Auto.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={tasteRatingEnabled}
                onClick={() => setTasteRatingEnabled(!tasteRatingEnabled)}
                className={`w-11 h-6 rounded-full relative transition-colors shrink-0 cursor-pointer ${tasteRatingEnabled ? 'bg-[#1ed760]' : 'bg-[#535353]'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${tasteRatingEnabled ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
            </div>
            {tasteRatingEnabled && discardedCount > 0 && (
              <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs">
                <span className="text-[#a7a7a7]">{discardedCount} {discardedCount === 1 ? 'canción descartada' : 'canciones descartadas'}</span>
                <button
                  type="button"
                  onClick={handleClearDiscards}
                  className="font-bold text-[#1ed760] hover:underline"
                >
                  Borrar descartes
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <p className="px-1 text-[12px] text-[#727272] leading-snug">
        Se aplica la próxima vez que actives el aleatorio o pongas una lista en aleatorio. El aleatorio inteligente (el segundo toque del botón) además añade recomendaciones.
      </p>
    </section>
  );
};
