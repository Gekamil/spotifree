import React from 'react';
import type { Track } from '../../types/spotify';
import { MobileSheet } from './MobileSheet';

/** How a playlist is shown (Spotify's "Ordenar"): only the view, the playlist itself doesn't change */
export type PlaylistSortKey = 'custom' | 'title' | 'artist' | 'album' | 'added' | 'duration';

export const PLAYLIST_SORTS: Array<{ id: PlaylistSortKey; label: string }> = [
  { id: 'custom', label: 'Orden personalizado' },
  { id: 'title', label: 'Título' },
  { id: 'artist', label: 'Artista' },
  { id: 'album', label: 'Álbum' },
  { id: 'added', label: 'Añadidas recientemente' },
  { id: 'duration', label: 'Duración' },
];

const sortKeyFor = (playlistId: string) => `spotifree_pl_sort_${playlistId}`;

export function loadPlaylistSort(playlistId: string): PlaylistSortKey {
  try {
    const v = localStorage.getItem(sortKeyFor(playlistId)) as PlaylistSortKey | null;
    return v && PLAYLIST_SORTS.some((s) => s.id === v) ? v : 'custom';
  } catch {
    return 'custom';
  }
}

export function savePlaylistSort(playlistId: string, key: PlaylistSortKey) {
  try {
    if (key === 'custom') localStorage.removeItem(sortKeyFor(playlistId));
    else localStorage.setItem(sortKeyFor(playlistId), key);
  } catch {}
}

const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true });
const addedTime = (t: Track, i: number) => {
  const v = Date.parse(String(t.added_at || ''));
  return Number.isFinite(v) ? v : i; // songs without a date keep their place (later = newer)
};

/** The songs in the chosen order (custom = as saved) */
export function sortPlaylistTracks(tracks: Track[], key: PlaylistSortKey): Track[] {
  if (key === 'custom') return tracks;
  const list = tracks.map((t, i) => ({ t, i }));
  const by = (a: { t: Track; i: number }, b: { t: Track; i: number }) => {
    switch (key) {
      case 'title':
        return collator.compare(a.t.name || '', b.t.name || '');
      case 'artist':
        return collator.compare(a.t.artists?.[0]?.name || '', b.t.artists?.[0]?.name || '') || collator.compare(a.t.name || '', b.t.name || '');
      case 'album':
        return collator.compare(a.t.album?.name || '', b.t.album?.name || '') || a.i - b.i;
      case 'added':
        return addedTime(b.t, b.i) - addedTime(a.t, a.i);
      case 'duration':
        return (a.t.duration_ms || 0) - (b.t.duration_ms || 0);
      default:
        return a.i - b.i;
    }
  };
  return list.sort(by).map((x) => x.t);
}

const Chip: React.FC<{ icon: React.ReactNode; label: string; onClick: () => void; active?: boolean }> = ({ icon, label, onClick, active }) => (
  <button
    type="button"
    onClick={onClick}
    className={`h-8 pl-2.5 pr-3.5 rounded-full flex items-center gap-1.5 text-[13px] font-bold shrink-0 border transition-colors active:scale-95 cursor-pointer ${
      active ? 'bg-white text-black border-white' : 'bg-transparent text-white border-white/25 active:bg-white/10'
    }`}
  >
    {icon}
    {label}
  </button>
);

/** Spotify's row under the play button: Añadir · Editar · Ordenar */
export const PlaylistToolbar: React.FC<{
  canEdit: boolean;
  sortKey: PlaylistSortKey;
  onAdd: () => void;
  onEdit: () => void;
  onSort: () => void;
}> = ({ canEdit, sortKey, onAdd, onEdit, onSort }) => (
  <div className="flex items-center gap-2 px-4 pt-3 pb-1 overflow-x-auto no-scrollbar animate-in fade-in duration-300">
    {canEdit && (
      <Chip
        onClick={onAdd}
        label="Añadir"
        icon={
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M15.25 8a.75.75 0 0 1-.75.75H8.75v5.75a.75.75 0 0 1-1.5 0V8.75H1.5a.75.75 0 0 1 0-1.5h5.75V1.5a.75.75 0 0 1 1.5 0v5.75h5.75a.75.75 0 0 1 .75.75z" />
          </svg>
        }
      />
    )}
    {canEdit && (
      <Chip
        onClick={onEdit}
        label="Editar"
        icon={
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M1 3.75A.75.75 0 0 1 1.75 3h12.5a.75.75 0 0 1 0 1.5H1.75A.75.75 0 0 1 1 3.75zm0 4.25a.75.75 0 0 1 .75-.75h12.5a.75.75 0 0 1 0 1.5H1.75A.75.75 0 0 1 1 8zm.75 3.5a.75.75 0 0 0 0 1.5h7.5a.75.75 0 0 0 0-1.5h-7.5z" />
          </svg>
        }
      />
    )}
    <Chip
      onClick={onSort}
      active={sortKey !== 'custom'}
      label={sortKey === 'custom' ? 'Ordenar' : PLAYLIST_SORTS.find((s) => s.id === sortKey)?.label || 'Ordenar'}
      icon={
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M4.25 1a.75.75 0 0 1 .75.75v10.69l1.72-1.72a.75.75 0 1 1 1.06 1.06l-3 3a.75.75 0 0 1-1.06 0l-3-3a.75.75 0 1 1 1.06-1.06l1.72 1.72V1.75A.75.75 0 0 1 4.25 1zm7.5 0a.75.75 0 0 1 .53.22l3 3a.75.75 0 0 1-1.06 1.06L12.5 3.56v10.69a.75.75 0 0 1-1.5 0V3.56L9.28 5.28a.75.75 0 0 1-1.06-1.06l3-3A.75.75 0 0 1 11.75 1z" />
        </svg>
      }
    />
  </div>
);

/** "Ordenar por" sheet of a playlist */
export const PlaylistSortSheet: React.FC<{
  open: boolean;
  value: PlaylistSortKey;
  onChange: (k: PlaylistSortKey) => void;
  onClose: () => void;
}> = ({ open, value, onChange, onClose }) => (
  <MobileSheet open={open} onClose={onClose}>
    <div className="font-['SpotifyMixUI']">
      <h3 className="px-1 pb-2 text-[17px] font-bold text-white font-['SpotifyMixUITitle']">Ordenar por</h3>
      {PLAYLIST_SORTS.map((s) => {
        const on = value === s.id;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => {
              onChange(s.id);
              setTimeout(onClose, 120);
            }}
            className="w-full flex items-center justify-between -mx-2 px-3 py-3.5 rounded-lg text-left active:bg-white/[0.06] transition-colors cursor-pointer"
            style={{ width: 'calc(100% + 16px)' }}
          >
            <span className={`text-[16px] ${on ? 'text-[#1ed760] font-bold' : 'text-white'}`}>{s.label}</span>
            <svg
              width="18"
              height="18"
              viewBox="0 0 16 16"
              fill="currentColor"
              className={`text-[#1ed760] transition-all duration-200 ${on ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}
            >
              <path d="M15.53 2.47a.75.75 0 0 1 0 1.06L4.907 14.153.47 9.716a.75.75 0 0 1 1.06-1.06l3.377 3.376L14.47 2.47a.75.75 0 0 1 1.06 0" />
            </svg>
          </button>
        );
      })}
    </div>
  </MobileSheet>
);
