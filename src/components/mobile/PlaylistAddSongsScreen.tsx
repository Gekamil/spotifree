import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Track } from '../../types/spotify';
import { searchSpotify } from '../../services/spotifyApi';
import { filterMusicTracksOnly } from '../../utils/trackFilter';
import { getTrackCoverUrl, TrackArtwork } from '../../utils/trackCovers';
import { parseTrackArtists } from '../../utils/trackArtists';

const keyOf = (t: Track) => `${(t.name || '').toLowerCase().trim()}::${(t.artists?.[0]?.name || '').toLowerCase().trim()}`;

/**
 * "Añadir a esta playlist" (Spotify mobile): search songs by name or artist and add them with
 * the (+); with nothing typed, songs recommended for this playlist.
 */
export const PlaylistAddSongsScreen: React.FC<{
  open: boolean;
  playlistName: string;
  existing: Track[];
  suggestions: Track[];
  onAdd: (t: Track) => void;
  onClose: () => void;
}> = ({ open, playlistName, existing, suggestions, onAdd, onClose }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Track[]>([]);
  const [searching, setSearching] = useState(false);
  const [closing, setClosing] = useState(false);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setClosing(false);
    setQuery('');
    setResults([]);
    setAdded(new Set());
    const t = setTimeout(() => inputRef.current?.focus(), 250);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const data = await searchSpotify(q);
        if (!cancelled) setResults((filterMusicTracksOnly(data?.tracks?.items || []) as Track[]).filter((t) => t?.id && t.name).slice(0, 30));
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  if (!open) return null;

  const inList = new Set(existing.map(keyOf));
  const close = () => {
    setClosing(true);
    setTimeout(onClose, 220);
  };
  const list = query.trim() ? results : suggestions;

  return createPortal(
    <div
      className={`fixed inset-0 z-[120] bg-[#121212] text-white flex flex-col font-['SpotifyMixUI'] transition-transform duration-200 ease-out ${
        closing ? 'translate-y-full' : 'translate-y-0 animate-in slide-in-from-bottom duration-300'
      }`}
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      role="dialog"
      aria-label="Añadir a esta playlist"
    >
      <div className="flex items-center gap-2 px-2 h-14 shrink-0">
        <button onClick={close} className="w-10 h-10 rounded-full flex items-center justify-center active:bg-white/10 cursor-pointer" aria-label="Cerrar">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
          </svg>
        </button>
        <div className="min-w-0">
          <h2 className="text-[16px] font-bold leading-tight">Añadir a esta playlist</h2>
          <p className="text-[12px] text-[#a7a7a7] truncate">{playlistName}</p>
        </div>
      </div>

      <div className="px-4 pb-3 shrink-0">
        <div className="relative">
          <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" className="absolute left-3 top-1/2 -translate-y-1/2 text-black/70 pointer-events-none">
            <path d="M7 1.75a5.25 5.25 0 1 0 0 10.5 5.25 5.25 0 0 0 0-10.5zM.25 7a6.75 6.75 0 1 1 12.096 4.12l3.184 3.185a.75.75 0 1 1-1.06 1.06L11.286 12.18A6.75 6.75 0 0 1 .25 7z" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Busca canciones o artistas"
            className="w-full h-11 pl-10 pr-10 rounded-md bg-white text-black text-[15px] font-semibold placeholder:text-black/55 placeholder:font-normal outline-none"
            enterKeyHint="search"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-black/70 cursor-pointer"
              aria-label="Borrar búsqueda"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M2.47 2.47a.75.75 0 0 1 1.06 0L8 6.94l4.47-4.47a.75.75 0 1 1 1.06 1.06L9.06 8l4.47 4.47a.75.75 0 0 1-1.06 1.06L8 9.06l-4.47 4.47a.75.75 0 0 1-1.06-1.06L6.94 8 2.47 3.53a.75.75 0 0 1 0-1.06z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain px-2 pb-8">
        {!query.trim() && suggestions.length > 0 && <p className="px-2 pt-1 pb-2 text-[15px] font-bold">Recomendadas para esta playlist</p>}
        {searching && (
          <div className="py-6 flex justify-center">
            <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        )}
        {!searching && query.trim() && results.length === 0 && (
          <p className="px-2 py-8 text-center text-[14px] text-[#a7a7a7]">No hemos encontrado «{query.trim()}»</p>
        )}
        {list.map((t) => {
          const k = keyOf(t);
          const isIn = inList.has(k) || added.has(k);
          return (
            <div key={`${t.id}-${k}`} className="flex items-center gap-3 px-2 py-2 rounded-md active:bg-white/[0.06]">
              <TrackArtwork src={getTrackCoverUrl(t)} alt={t.name} className="w-12 h-12 rounded object-cover shrink-0" size={48} />
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-bold truncate">{t.name}</p>
                <p className="text-[13px] text-[#a7a7a7] truncate">{parseTrackArtists(t.artists).map((a) => a.name).join(', ')}</p>
              </div>
              <button
                type="button"
                disabled={isIn}
                onClick={() => {
                  onAdd(t);
                  setAdded((s) => new Set(s).add(k));
                }}
                className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 cursor-pointer active:scale-90 transition-transform"
                aria-label={isIn ? 'Ya está en la playlist' : `Añadir ${t.name}`}
              >
                {isIn ? (
                  <svg width="22" height="22" viewBox="0 0 16 16" className="animate-in zoom-in-50 duration-200">
                    <circle cx="8" cy="8" r="8" fill="#1ed760" />
                    <path d="M11.6 5.4 7 10 4.4 7.4" stroke="#000" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke="#b3b3b3" strokeWidth="1.2">
                    <circle cx="8" cy="8" r="7.3" />
                    <path d="M8 4.5v7M4.5 8h7" strokeLinecap="round" />
                  </svg>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>,
    document.body
  );
};
