import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Track } from '../../types/spotify';
import { getTrackCoverUrl, TrackArtwork } from '../../utils/trackCovers';
import { parseTrackArtists } from '../../utils/trackArtists';
import { buildDJSetOrder } from '../../services/djMixPlanner';

const ROW = 64; // px per song row (drag maths)

/**
 * "Editar" a playlist (Spotify mobile): remove songs with the (−) and drag them by the handle
 * to reorder. "Ordenar para mezclar" orders them so each song flows into the next (tempo, key
 * and energy, the same analysis the DJ uses). Nothing changes until "Guardar".
 */
export const PlaylistEditScreen: React.FC<{
  open: boolean;
  playlistName: string;
  tracks: Track[];
  onSave: (order: Track[], removed: Track[]) => void;
  onClose: () => void;
}> = ({ open, playlistName, tracks, onSave, onClose }) => {
  const [list, setList] = useState<Track[]>(tracks);
  const [removed, setRemoved] = useState<Track[]>([]);
  const [closing, setClosing] = useState(false);
  const [drag, setDrag] = useState<{ index: number; offset: number } | null>(null);
  const [smartLabel, setSmartLabel] = useState<string | null>(null);
  const startY = useRef(0);
  const startIndex = useRef(0);

  useEffect(() => {
    if (!open) return;
    setList(tracks);
    setRemoved([]);
    setClosing(false);
    setDrag(null);
    setSmartLabel(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const dirty = removed.length > 0 || list.length !== tracks.length || list.some((t, i) => t !== tracks[i]);
  const close = () => {
    setClosing(true);
    setTimeout(onClose, 220);
  };

  const onPointerDown = (e: React.PointerEvent, index: number) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    startY.current = e.clientY;
    startIndex.current = index;
    setDrag({ index, offset: 0 });
    try {
      navigator.vibrate?.(10);
    } catch {}
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const dy = e.clientY - startY.current;
    const target = Math.max(0, Math.min(list.length - 1, startIndex.current + Math.round(dy / ROW)));
    if (target !== drag.index) {
      setList((l) => {
        const next = l.slice();
        const [moved] = next.splice(drag.index, 1);
        next.splice(target, 0, moved);
        return next;
      });
    }
    setDrag({ index: target, offset: dy - (target - startIndex.current) * ROW });
  };
  const onPointerUp = () => setDrag(null);

  const smartOrder = () => {
    const { order, strategy } = buildDJSetOrder(list, Date.now() % 2147483647);
    setList(order);
    const labels: Record<string, string> = {
      calentamiento: 'de menos a más energía',
      olas: 'con subidas y bajadas',
      viaje_armonico: 'por tonos que encajan',
      contrastes: 'con contrastes',
    };
    setSmartLabel(`Ordenadas para mezclar ${labels[strategy] || ''}`.trim());
  };

  return createPortal(
    <div
      className={`fixed inset-0 z-[120] bg-[#121212] text-white flex flex-col font-['SpotifyMixUI'] select-none transition-transform duration-200 ease-out ${
        closing ? 'translate-y-full' : 'translate-y-0 animate-in slide-in-from-bottom duration-300'
      }`}
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      role="dialog"
      aria-label="Editar playlist"
    >
      <div className="flex items-center justify-between px-2 h-14 shrink-0">
        <button onClick={close} className="px-3 h-10 rounded-full text-[15px] font-bold text-white active:bg-white/10 cursor-pointer">
          Cancelar
        </button>
        <h2 className="text-[16px] font-bold truncate px-2">Editar playlist</h2>
        <button
          onClick={() => {
            if (dirty) onSave(list, removed);
            close();
          }}
          className={`px-3 h-10 rounded-full text-[15px] font-bold active:bg-white/10 cursor-pointer ${dirty ? 'text-[#1ed760]' : 'text-[#727272]'}`}
        >
          Guardar
        </button>
      </div>

      <div className="px-4 pb-3 shrink-0 space-y-2">
        <p className="text-[13px] text-[#a7a7a7] truncate">
          {playlistName} · {list.length} {list.length === 1 ? 'canción' : 'canciones'}
          {removed.length > 0 ? ` · ${removed.length} quitada${removed.length === 1 ? '' : 's'}` : ''}
        </p>
        {list.length > 2 && (
          <button
            type="button"
            onClick={smartOrder}
            className="h-9 px-4 rounded-full border border-white/25 text-[13px] font-bold flex items-center gap-2 active:bg-white/10 active:scale-95 transition-transform cursor-pointer"
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" className="text-[#1ed760]">
              <path d="M8 0l1.6 4.4L14 6l-4.4 1.6L8 12 6.4 7.6 2 6l4.4-1.6z" />
              <path d="M13 10l.7 1.8 1.8.7-1.8.7L13 15l-.7-1.8-1.8-.7 1.8-.7z" />
            </svg>
            Ordenar para mezclar
          </button>
        )}
        {smartLabel && <p className="text-[12px] text-[#1ed760] animate-in fade-in duration-300">{smartLabel}. Pulsa Guardar para quedártelo.</p>}
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain pb-10" onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
        {list.map((t, i) => {
          const dragging = drag?.index === i;
          return (
            <div
              key={`${t.id}-${i}`}
              className={`flex items-center gap-3 px-3 ${dragging ? 'bg-[#2a2a2a] shadow-[0_8px_24px_rgba(0,0,0,0.6)] relative z-10 rounded-md' : ''}`}
              style={{ height: ROW, transform: dragging ? `translateY(${drag!.offset}px) scale(1.02)` : undefined, transition: dragging ? 'none' : 'transform 150ms' }}
            >
              <button
                type="button"
                onClick={() => {
                  setRemoved((r) => [...r, t]);
                  setList((l) => l.filter((_, k) => k !== i));
                }}
                className="w-9 h-9 -ml-1 flex items-center justify-center shrink-0 cursor-pointer active:scale-90 transition-transform"
                aria-label={`Quitar ${t.name}`}
              >
                <svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke="#b3b3b3" strokeWidth="1.2">
                  <circle cx="8" cy="8" r="7.3" />
                  <path d="M4.8 8h6.4" strokeLinecap="round" />
                </svg>
              </button>
              <TrackArtwork src={getTrackCoverUrl(t)} alt={t.name} className="w-11 h-11 rounded object-cover shrink-0" size={44} />
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-bold truncate">{t.name}</p>
                <p className="text-[13px] text-[#a7a7a7] truncate">{parseTrackArtists(t.artists).map((a) => a.name).join(', ')}</p>
              </div>
              <div
                onPointerDown={(e) => onPointerDown(e, i)}
                className="w-11 h-11 -mr-1 flex items-center justify-center text-[#b3b3b3] shrink-0 cursor-grab active:cursor-grabbing"
                style={{ touchAction: 'none' }}
                aria-label={`Mover ${t.name}`}
                role="button"
              >
                <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M1 4.75A.75.75 0 0 1 1.75 4h12.5a.75.75 0 0 1 0 1.5H1.75A.75.75 0 0 1 1 4.75zM1 8a.75.75 0 0 1 .75-.75h12.5a.75.75 0 0 1 0 1.5H1.75A.75.75 0 0 1 1 8zm.75 2.5a.75.75 0 0 0 0 1.5h12.5a.75.75 0 0 0 0-1.5H1.75z" />
                </svg>
              </div>
            </div>
          );
        })}
        {list.length === 0 && <p className="px-4 py-10 text-center text-[14px] text-[#a7a7a7]">La playlist se quedará vacía.</p>}
      </div>
    </div>,
    document.body
  );
};
