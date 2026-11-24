import React, { useState } from 'react';
import { APP_VERSION, CHANGELOG_RELEASES } from '../../data/changelog';

interface AboutAppSectionProps {
  variant?: 'mobile' | 'desktop';
}

export const AboutAppSection: React.FC<AboutAppSectionProps> = ({ variant = 'mobile' }) => {
  const [activeTab, setActiveTab] = useState<'versions' | 'credits'>('versions');
  const [showChangelog, setShowChangelog] = useState(true);
  const isDesktop = variant === 'desktop';

  return (
    <section className="space-y-3 font-['SpotifyMixUI']">
      <h3 className={`font-bold text-[#b3b3b3] uppercase tracking-wider ${isDesktop ? 'text-xs' : 'text-xs'}`}>
        Acerca de la aplicación
      </h3>

      <div className={`p-4 rounded-2xl bg-[#181818] border border-white/[0.06] space-y-4`}>
        {/* App Info Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Spotify Green App Icon */}
            <img src="/icon-192.png" alt="" className="w-10 h-10 rounded-xl shrink-0 shadow-md" />

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white font-['SpotifyMixUITitle']">Spotifree</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#1ed760]/15 text-[#1ed760] tracking-wide">
                  v{APP_VERSION}
                </span>
              </div>
              <p className="text-xs text-[#a7a7a7] truncate">
                Música libre sin anuncios · Modo DJ · Descargas offline
              </p>
            </div>
          </div>

          {activeTab === 'versions' && (
            <button
              type="button"
              onClick={() => setShowChangelog(!showChangelog)}
              className="px-3.5 py-1.5 rounded-full border border-white/20 hover:border-white text-white text-xs font-bold transition-all active:scale-95 cursor-pointer shrink-0"
            >
              {showChangelog ? 'Ocultar cambios' : 'Últimos cambios'}
            </button>
          )}
        </div>

        {/* Bottom Tabs inside About: Versiones | Créditos */}
        <div className="flex items-center gap-2 pt-1 border-t border-white/5">
          <button
            type="button"
            onClick={() => {
              setActiveTab('versions');
              setShowChangelog(true);
            }}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'versions'
                ? 'bg-white text-black shadow-sm'
                : 'bg-white/[0.06] text-[#b3b3b3] hover:text-white hover:bg-white/10'
            }`}
          >
            Versiones
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('credits')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'credits'
                ? 'bg-[#1ed760] text-black shadow-sm'
                : 'bg-white/[0.06] text-[#b3b3b3] hover:text-white hover:bg-white/10'
            }`}
          >
            Créditos
          </button>
        </div>

        {/* Version History Tab */}
        {activeTab === 'versions' && showChangelog && (
          <div className="pt-2 space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Historial de versiones y novedades
              </span>
              <a
                href="https://github.com/Gekamil/spotifree/releases/tag/android-latest"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-[#1ed760] hover:underline font-bold inline-flex items-center gap-1"
              >
                Descargar APK
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M4.47 5.47a.75.75 0 0 1 1.06 0L8 7.94l2.47-2.47a.75.75 0 1 1 1.06 1.06l-3 3a.75.75 0 0 1-1.06 0l-3-3a.75.75 0 0 1 0-1.06z" />
                  <path d="M3.75 12a.75.75 0 0 1 .75-.75h7a.75.75 0 0 1 0 1.5h-7a.75.75 0 0 1-.75-.75z" />
                </svg>
              </a>
            </div>

            <div className="space-y-3.5">
              {CHANGELOG_RELEASES.map((rel) => (
                <div
                  key={rel.version}
                  className={`p-3 rounded-xl border transition-colors ${
                    rel.isLatest
                      ? 'bg-white/[0.06] border-white/15'
                      : 'bg-white/[0.02] border-white/5'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white font-['SpotifyMixUITitle']">
                        v{rel.version}
                      </span>
                      {rel.isLatest && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-[#1ed760] text-black">
                          ACTUAL
                        </span>
                      )}
                      <span className="text-xs text-white/80 font-medium">· {rel.title}</span>
                    </div>
                    <span className="text-[10px] text-[#a7a7a7] shrink-0">{rel.date}</span>
                  </div>

                  <ul className="space-y-1 pl-3.5 list-disc text-xs text-[#b3b3b3] leading-relaxed">
                    {rel.highlights.map((item, idx) => (
                      <li key={idx} className="marker:text-[#1ed760]">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Credits Tab */}
        {activeTab === 'credits' && (
          <div className="pt-2 space-y-3 animate-in fade-in duration-200">
            <div className="p-3.5 rounded-xl bg-white/[0.04] border border-white/10 space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-[#1ed760]">
                    Autor y desarrollo
                  </span>
                  <h4 className="text-sm font-bold text-white font-['SpotifyMixUITitle'] mt-0.5">
                    Jorge Pérez
                  </h4>
                  <p className="text-xs text-[#a7a7a7]">
                    Creador y desarrollador principal de Spotifree
                  </p>
                </div>
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-white/10 text-white shrink-0">
                  v{APP_VERSION}
                </span>
              </div>

              <div className="pt-2.5 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <a
                  href="https://github.com/Gekamil"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-black/30 hover:bg-black/50 border border-white/10 transition-colors"
                >
                  <div className="min-w-0">
                    <span className="block text-[10px] text-[#a7a7a7]">GitHub oficial</span>
                    <span className="font-bold text-white truncate block">@Gekamil</span>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="text-white/80 shrink-0">
                    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
                  </svg>
                </a>

                <a
                  href="https://github.com/Gekamil/spotifree"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-black/30 hover:bg-black/50 border border-white/10 transition-colors"
                >
                  <div className="min-w-0">
                    <span className="block text-[10px] text-[#a7a7a7]">Código fuente</span>
                    <span className="font-bold text-[#1ed760] truncate block">Gekamil/spotifree</span>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="text-[#1ed760] shrink-0">
                    <path d="M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z" />
                  </svg>
                </a>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1.5 text-xs text-[#b3b3b3] leading-relaxed">
              <p>
                <span className="text-white font-semibold">Tecnologías:</span> React, TypeScript, Vite, Tailwind CSS, Capacitor, Android Auto MediaSession, Web Audio API DSP y sincronización Firebase.
              </p>
              <p>
                <span className="text-white font-semibold">Catálogo y audio:</span> Integración independiente de metadatos musicales, letras sincronizadas y reproducción adaptable para Web, Escritorio y Android.
              </p>
              <p className="text-[11px] text-[#8a8a8a] pt-1">
                Proyecto Open Source desarrollado sin ánimo de lucro con fines personales y educativos. Todos los nombres comerciales, marcas y portadas pertenecen a sus respectivos propietarios.
              </p>
            </div>
          </div>
        )}

        {/* Footer Meta */}
        <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-[#727272]">
          <span>Plataforma: Web PWA & Android Nativo</span>
          <span>Spotifree v{APP_VERSION} · Open Source</span>
        </div>
      </div>
    </section>
  );
};
