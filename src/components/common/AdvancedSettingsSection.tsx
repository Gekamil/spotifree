import React, { useState } from 'react';
import { getRecentAtEnd, getShuffleAlgorithm, setRecentAtEnd, setShuffleAlgorithm, type ShuffleAlgorithm } from '../../utils/shuffleOrder';

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

/** Settings › Ajustes avanzados: how "Aleatorio" orders the songs */
export const AdvancedSettingsSection: React.FC<{ variant?: 'mobile' | 'desktop' }> = ({ variant = 'mobile' }) => {
  const [algo, setAlgo] = useState<ShuffleAlgorithm>(() => getShuffleAlgorithm());
  const [recent, setRecent] = useState(() => getRecentAtEnd());
  const desktop = variant === 'desktop';

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
      </div>
    );
  }

  return (
    <section className="space-y-3 font-['SpotifyMixUI']">
      {desktop && <h3 className="text-xs font-bold text-[#b3b3b3] uppercase tracking-wider">Ajustes avanzados</h3>}
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

      <p className="px-1 text-[12px] text-[#727272] leading-snug">
        Se aplica la próxima vez que actives el aleatorio o pongas una lista en aleatorio. El aleatorio inteligente (el segundo toque del botón) además añade recomendaciones.
      </p>
    </section>
  );
};
