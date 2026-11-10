import React, { useEffect, useState } from 'react';
import { APP_VERSION, CHANGELOG_RELEASES } from '../../data/changelog';

interface MessagesNotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SEEN_KEY = 'spotifree_seen_version';

/** Whether this version's changes were already opened (for a "new" dot next to the entry) */
export function hasUnseenChanges(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) !== APP_VERSION;
  } catch {
    return false;
  }
}

/**
 * "Novedades de la app": what changed in each version of Spotifree (the same history as
 * Settings › Acerca de la aplicación). The latest version opens expanded.
 */
export const MessagesNotificationsModal: React.FC<MessagesNotificationsModalProps> = ({ isOpen, onClose }) => {
  const [open, setOpen] = useState<string | null>(CHANGELOG_RELEASES[0]?.version || null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setClosing(false);
    setOpen(CHANGELOG_RELEASES[0]?.version || null);
    try {
      localStorage.setItem(SEEN_KEY, APP_VERSION);
      window.dispatchEvent(new Event('spotifree:changes-seen'));
    } catch {}
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  function close() {
    setClosing(true);
    setTimeout(onClose, 180);
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 font-['SpotifyMixUI'] select-none transition-opacity duration-200 ${
        closing ? 'opacity-0' : 'opacity-100 animate-in fade-in'
      }`}
      onClick={close}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Novedades de la app"
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full sm:max-w-[440px] bg-[#1f1f1f] text-white rounded-t-2xl sm:rounded-xl shadow-[0_16px_48px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col max-h-[86vh] transition-transform duration-200 ${
          closing ? 'translate-y-6 sm:translate-y-0 sm:scale-95' : 'animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200'
        }`}
      >
        {/* Grab handle (mobile) */}
        <div className="sm:hidden flex justify-center pt-2.5">
          <span className="w-9 h-1 rounded-full bg-white/25" />
        </div>

        <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[22px] font-bold tracking-tight font-['SpotifyMixUITitle'] leading-tight">Novedades de la app</h2>
            <p className="text-[13px] text-[#a7a7a7] mt-0.5">Qué ha cambiado en cada versión de Spotifree</p>
          </div>
          <button
            onClick={close}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#a7a7a7] hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
            aria-label="Cerrar"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2.47 2.47a.75.75 0 0 1 1.06 0L8 6.94l4.47-4.47a.75.75 0 1 1 1.06 1.06L9.06 8l4.47 4.47a.75.75 0 0 1-1.06 1.06L8 9.06l-4.47 4.47a.75.75 0 0 1-1.06-1.06L6.94 8 2.47 3.53a.75.75 0 0 1 0-1.06z" />
            </svg>
          </button>
        </div>

        <div className="px-3 pb-5 overflow-y-auto overscroll-contain space-y-1.5">
          {CHANGELOG_RELEASES.map((rel, i) => {
            const expanded = open === rel.version;
            return (
              <div key={rel.version} className={`rounded-lg transition-colors ${expanded ? 'bg-white/[0.06]' : 'hover:bg-white/[0.04]'}`}>
                <button
                  type="button"
                  onClick={() => setOpen(expanded ? null : rel.version)}
                  className="w-full flex items-center gap-3 px-3 py-3 text-left cursor-pointer"
                  aria-expanded={expanded}
                >
                  <span
                    className={`w-10 h-10 rounded-md flex items-center justify-center text-[12px] font-bold shrink-0 ${
                      i === 0 ? 'bg-[#1ed760] text-black' : 'bg-[#2a2a2a] text-white'
                    }`}
                  >
                    {rel.version.split('.').slice(0, 2).join('.')}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="text-[15px] font-bold truncate">{rel.title}</span>
                      {i === 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm bg-[#1ed760]/15 text-[#1ed760] shrink-0">Nueva</span>
                      )}
                    </span>
                    <span className="block text-[12.5px] text-[#a7a7a7]">
                      Versión {rel.version} · {rel.date}
                    </span>
                  </span>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                    className={`text-[#a7a7a7] shrink-0 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
                  >
                    <path d="M14 6l-6 6-6-6h12z" />
                  </svg>
                </button>
                <div
                  className="grid transition-[grid-template-rows] duration-300 ease-out"
                  style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
                >
                  <ul className="overflow-hidden px-4 space-y-2 text-[13px] text-[#cfcfcf] leading-snug">
                    {rel.highlights.map((h, k) => (
                      <li key={k} className={`flex gap-2.5 ${k === rel.highlights.length - 1 ? 'pb-4' : ''}`}>
                        <span className="mt-[7px] w-1.5 h-1.5 rounded-full bg-[#1ed760] shrink-0" />
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
