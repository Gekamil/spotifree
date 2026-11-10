import React, { useState } from 'react';
import { purgeFromTrash, restoreFromTrash, usePlaylistTrash } from '../../services/playlistTrash';
import { getAutoPlaylistCover, EMPTY_PLAYLIST_COVER } from '../../utils/playlistCover';
import { showGlobalToast } from '../../utils/globalToast';

function dateLabel(ts: number): string {
  const days = Math.floor((Date.now() - ts) / 86400000);
  if (days < 1) return 'Eliminada hoy';
  if (days === 1) return 'Eliminada ayer';
  return `Eliminada el ${new Date(ts).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}`;
}

/** Settings › Recuperar playlists (Spotify's "Recover playlists"): the last 90 days' deleted playlists */
export const RecoverPlaylistsSection: React.FC<{ variant?: 'mobile' | 'desktop' }> = ({ variant = 'mobile' }) => {
  const entries = usePlaylistTrash((s) => s.entries);
  const [busy, setBusy] = useState<string | null>(null);

  return (
    <section className="space-y-3 font-['SpotifyMixUI']">
      {variant === 'desktop' && <h3 className="text-xs font-bold text-[#b3b3b3] uppercase tracking-wider">Recuperar playlists</h3>}
      <p className="px-1 text-[13px] text-[#a7a7a7] leading-snug">
        Las playlists que borres se pueden recuperar durante 90 días, con sus canciones, desde cualquiera de tus dispositivos.
      </p>
      {entries.length === 0 ? (
        <div className="rounded-xl bg-[#181818] px-4 py-8 text-center">
          <p className="text-[15px] font-bold text-white">No hay playlists para recuperar</p>
          <p className="text-[13px] text-[#a7a7a7] mt-1">Cuando borres una, aparecerá aquí.</p>
        </div>
      ) : (
        <div className="rounded-xl bg-[#181818] overflow-hidden divide-y divide-white/[0.05]">
          {entries.map((e) => {
            const auto = getAutoPlaylistCover(e.playlist.tracks?.items);
            const cover = e.image || (auto !== EMPTY_PLAYLIST_COVER ? auto : '');
            return (
              <div key={e.id} className="flex items-center gap-3 px-3 py-2.5 animate-in fade-in duration-200">
                <div className="w-12 h-12 rounded bg-[#2a2a2a] overflow-hidden shrink-0">
                  {cover ? <img src={cover} alt="" className="w-full h-full object-cover" /> : null}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-bold text-white truncate">{e.name}</p>
                  <p className="text-[12.5px] text-[#a7a7a7] truncate">
                    {e.total} {e.total === 1 ? 'canción' : 'canciones'} · {dateLabel(e.deletedAt)}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy === e.id}
                  onClick={async () => {
                    setBusy(e.id);
                    const ok = await restoreFromTrash(e.id);
                    setBusy(null);
                    showGlobalToast(ok ? `«${e.name}» vuelve a estar en Tu biblioteca` : 'No se pudo recuperar');
                  }}
                  className="h-8 px-4 rounded-full border border-white/40 text-[13px] font-bold text-white hover:border-white hover:scale-[1.03] active:scale-95 transition-all shrink-0 cursor-pointer disabled:opacity-50"
                >
                  {busy === e.id ? 'Recuperando…' : 'Restaurar'}
                </button>
                <button
                  type="button"
                  onClick={() => purgeFromTrash(e.id)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[#727272] hover:text-white hover:bg-white/10 shrink-0 cursor-pointer"
                  aria-label={`Quitar «${e.name}» de la lista`}
                  title="Quitar de la lista"
                >
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M2.47 2.47a.75.75 0 0 1 1.06 0L8 6.94l4.47-4.47a.75.75 0 1 1 1.06 1.06L9.06 8l4.47 4.47a.75.75 0 0 1-1.06 1.06L8 9.06l-4.47 4.47a.75.75 0 0 1-1.06-1.06L6.94 8 2.47 3.53a.75.75 0 0 1 0-1.06z" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
