import React, { useState } from 'react';
import { APP_VERSION, CHANGELOG_RELEASES } from '../../data/changelog';

interface AboutAppSectionProps {
  variant?: 'mobile' | 'desktop';
}

export const AboutAppSection: React.FC<AboutAppSectionProps> = ({ variant = 'mobile' }) => {
  const [showChangelog, setShowChangelog] = useState(false);
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
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#1ed760]/15 text-[#1ed760] border border-[#1ed760]/30 tracking-wide">
                  v{APP_VERSION}
                </span>
              </div>
              <p className="text-xs text-[#a7a7a7] truncate">
                Música libre sin anuncios · Modo DJ · Descargas offline
              </p>
            </div>
          </div>

          {/* Changelog Toggle Button */}
          <button
            type="button"
            onClick={() => setShowChangelog(!showChangelog)}
            className="px-3.5 py-1.5 rounded-full border border-white/20 hover:border-white text-white text-xs font-bold transition-all active:scale-95 cursor-pointer shrink-0"
          >
            {showChangelog ? 'Ocultar cambios' : 'Últimos cambios'}
          </button>
        </div>

        {/* Expandable Changelog Timeline */}
        {showChangelog && (
          <div className="pt-3 border-t border-white/5 space-y-4 animate-in fade-in duration-200">
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
                      ? 'bg-white/[0.04] border-[#1ed760]/30'
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

        {/* Footer Meta */}
        <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-[#727272]">
          <span>Plataforma: Web PWA & Android Nativo</span>
          <span>Open Source</span>
        </div>
      </div>
    </section>
  );
};
