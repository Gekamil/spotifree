import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { create } from 'zustand';
import { getPlaylistVersions, restorePlaylistVersion, usePlaylistVersions } from '../../services/playlistVersions';
import { useSpotifyDataStore } from '../../store/useSpotifyDataStore';
import { confirmDialog } from './ConfirmDialog';
import { showGlobalToast } from '../../utils/globalToast';

const useVersionsUI = create<{ id: string | null; name: string }>(() => ({ id: null, name: '' }));

/** Opens "Historial de versiones" of a playlist (from any screen) */
export function openPlaylistVersions(id: string, name: string) {
  useVersionsUI.setState({ id, name });
}

function when(ts: number): string {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return 'Hace un momento';
  if (m < 60) return `Hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `Hace ${h} h`;
  return new Date(ts).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/** Mounted once (App) */
export const PlaylistVersionsHost: React.FC = () => {
  const { id, name } = useVersionsUI();
  usePlaylistVersions((s) => s.version);
  const [open, setOpen] = useState<number | null>(null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (!id) return;
    setOpen(null);
    setClosing(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!id) return null;

  function close() {
    setClosing(true);
    setTimeout(() => useVersionsUI.setState({ id: null }), 180);
  }

  const versions = getPlaylistVersions(id);
  const st = useSpotifyDataStore.getState();
  const current = (st.playlistDetailsCache[id] || st.playlists.find((p) => p.id === id))?.tracks?.items?.length ?? 0;

  return createPortal(
    <div
      className={`fixed inset-0 z-[150] flex items-end sm:items-center justify-center bg-black/70 font-['SpotifyMixUI'] transition-opacity duration-200 ${
        closing ? 'opacity-0' : 'opacity-100 animate-in fade-in'
      }`}
      onClick={close}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Historial de versiones"
        onClick={(e) => e.stopPropagation()}
        className={`w-full sm:max-w-[460px] max-h-[85vh] flex flex-col rounded-t-2xl sm:rounded-xl bg-[#1f1f1f] text-white shadow-[0_16px_48px_rgba(0,0,0,0.6)] transition-transform duration-200 ${
          closing ? 'translate-y-6 sm:translate-y-0 sm:scale-95' : 'animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200'
        }`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="sm:hidden flex justify-center pt-2.5">
          <span className="w-9 h-1 rounded-full bg-white/25" />
        </div>
        <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[20px] font-bold leading-tight font-['SpotifyMixUITitle']">Historial de versiones</h2>
            <p className="text-[13px] text-[#a7a7a7] truncate">{name}</p>
          </div>
          <button onClick={close} className="w-8 h-8 rounded-full flex items-center justify-center text-[#a7a7a7] hover:text-white hover:bg-white/10 cursor-pointer shrink-0" aria-label="Cerrar">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2.47 2.47a.75.75 0 0 1 1.06 0L8 6.94l4.47-4.47a.75.75 0 1 1 1.06 1.06L9.06 8l4.47 4.47a.75.75 0 0 1-1.06 1.06L8 9.06l-4.47 4.47a.75.75 0 0 1-1.06-1.06L6.94 8 2.47 3.53a.75.75 0 0 1 0-1.06z" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto overscroll-contain px-3 pb-5">
          {/* Now */}
          <div className="flex items-center gap-3 px-2 py-3">
            <span className="w-2.5 h-2.5 rounded-full bg-[#1ed760] shrink-0 ml-1.5" />
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-bold">Versión actual</p>
              <p className="text-[12.5px] text-[#a7a7a7]">{current} {current === 1 ? 'canción' : 'canciones'}</p>
            </div>
          </div>

          {versions.length === 0 ? (
            <p className="px-3 py-6 text-center text-[13px] text-[#a7a7a7]">
              Aún no hay versiones anteriores. Cuando añadas, quites o reordenes canciones, la versión de antes aparecerá aquí durante 30 días.
            </p>
          ) : (
            versions.map((v) => {
              const expanded = open === v.at;
              return (
                <div key={v.at} className={`rounded-lg transition-colors ${expanded ? 'bg-white/[0.06]' : ''}`}>
                  <div className="flex items-center gap-3 px-2 py-3">
                    <span className="w-2.5 h-2.5 rounded-full border-2 border-[#727272] shrink-0 ml-1.5" />
                    <button type="button" onClick={() => setOpen(expanded ? null : v.at)} className="flex-1 min-w-0 text-left cursor-pointer" aria-expanded={expanded}>
                      <p className="text-[15px] font-bold">{when(v.at)}</p>
                      <p className="text-[12.5px] text-[#a7a7a7] truncate">
                        {v.total} {v.total === 1 ? 'canción' : 'canciones'} · después: {v.change}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const ok = await confirmDialog({
                          title: '¿Volver a esta versión?',
                          body: `«${name}» volverá a tener las ${v.total} canciones que tenía. La versión actual también se guarda aquí, por si quieres deshacerlo.`,
                          confirmLabel: 'Restaurar',
                        });
                        if (!ok) return;
                        const done = await restorePlaylistVersion(id, v.at);
                        showGlobalToast(done ? 'Versión restaurada' : 'No se pudo restaurar');
                        if (done) close();
                      }}
                      className="h-8 px-4 rounded-full border border-white/40 text-[13px] font-bold hover:border-white hover:scale-[1.03] active:scale-95 transition-all shrink-0 cursor-pointer"
                    >
                      Restaurar
                    </button>
                  </div>
                  <div className="grid transition-[grid-template-rows] duration-300" style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}>
                    <ol className="overflow-hidden px-10 text-[13px] text-[#cfcfcf] space-y-1">
                      {v.items.slice(0, 8).map((t, i) => (
                        <li key={`${t.id}-${i}`} className={`truncate ${i === Math.min(7, v.items.length - 1) ? 'pb-3' : ''}`}>
                          <span className="text-[#727272] tabular-nums mr-2">{i + 1}</span>
                          {t.name} <span className="text-[#a7a7a7]">· {t.artists?.[0]?.name}</span>
                        </li>
                      ))}
                      {v.items.length > 8 && <li className="text-[#a7a7a7] pb-3">y {v.items.length - 8} más</li>}
                    </ol>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
