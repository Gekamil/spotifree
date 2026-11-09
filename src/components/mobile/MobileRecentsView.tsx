import React, { useState, useEffect } from 'react';
import { getListeningHistory, groupHistoryByDate, type HistoryItem, type DayGroup } from '../../services/listeningHistory';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useShallow } from 'zustand/react/shallow';
import { handleImageError } from '../../utils/imageFallback';
import type { Track, Playlist } from '../../types/spotify';

interface MobileRecentsViewProps {
  onBack: () => void;
  onSelectPlaylist?: (playlist: Playlist) => void;
  onSelectPlaylistById?: (id: string, name?: string, image?: string) => void;
}

export const MobileRecentsView: React.FC<MobileRecentsViewProps> = ({
  onBack,
  onSelectPlaylist,
  onSelectPlaylistById,
}) => {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const { playTrack, currentTrack, isPlaying } = usePlayerStore(
    useShallow((s) => ({
      playTrack: s.playTrack,
      currentTrack: s.currentTrack,
      isPlaying: s.isPlaying,
    }))
  );

  useEffect(() => {
    const load = () => setHistory(getListeningHistory());
    load();
    window.addEventListener('spotifree:history_updated', load);
    return () => window.removeEventListener('spotifree:history_updated', load);
  }, []);

  const groups: DayGroup[] = groupHistoryByDate(history);

  const handleItemClick = (item: HistoryItem) => {
    if (item.type === 'track' && item.track) {
      playTrack(item.track);
      return;
    }

    if (item.type === 'track') {
      const syntheticTrack: Track = {
        id: item.id,
        name: item.name,
        duration_ms: 180000,
        artists: [{ id: `art-${item.id}`, name: item.subtitle?.replace(/^Canción • /i, '') || 'Artista' }],
        album: {
          id: `alb-${item.id}`,
          name: item.name,
          images: [{ url: item.image || '' }],
        },
      };
      playTrack(syntheticTrack);
      return;
    }

    // It is a playlist or album
    if (onSelectPlaylistById) {
      onSelectPlaylistById(item.id, item.name, item.image);
    } else if (onSelectPlaylist) {
      onSelectPlaylist({
        id: item.id,
        name: item.name,
        description: item.subtitle || '',
        images: [{ url: item.image || '' }],
        type: item.type === 'artist' ? 'artist' : 'playlist',
        tracks: { total: 0, items: [] },
      } as any);
    }
  };

  return (
    <div className="select-none min-h-full pb-28 bg-[#121212] font-['SpotifyMixUI'] text-white">
      {/* Top Sticky Header */}
      <div className="sticky top-0 z-30 px-4 py-3 bg-[#121212]/95 backdrop-blur-md flex items-center justify-between border-b border-white/[0.06]">
        <button
          type="button"
          onClick={onBack}
          className="w-9 h-9 rounded-full flex items-center justify-center text-white/90 hover:text-white active:scale-90 transition-transform cursor-pointer"
          title="Volver"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
          </svg>
        </button>

        <h1 className="text-base font-bold text-white tracking-tight">Recientes</h1>

        <div className="w-9" />
      </div>

      <div className="px-4 pt-4 space-y-6">
        {groups.length === 0 ? (
          <div className="py-20 text-center flex flex-col items-center justify-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-[#1e1e1e] flex items-center justify-center text-[#727272]">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-white font-['SpotifyMixUITitle']">
              Sin reproducciones recientes
            </h2>
            <p className="text-xs text-[#a7a7a7] max-w-xs">
              La música y playlists que escuches se mostrarán aquí organizadas por día.
            </p>
          </div>
        ) : (
          groups.map((group) => (
            <section key={group.dateLabel} className="space-y-2">
              <h2 className="text-sm font-bold text-[#b3b3b3] tracking-wide uppercase px-1 pt-1">
                {group.dateLabel}
              </h2>

              <div className="space-y-1">
                {group.items.map((item) => {
                  const isCurrentItemPlaying = isPlaying && currentTrack?.id === item.id;
                  const isArtist = item.type === 'artist';

                  return (
                    <div
                      key={`${item.id}-${item.playedAt}`}
                      onClick={() => handleItemClick(item)}
                      className="flex items-center gap-3.5 p-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.06] active:bg-white/[0.1] cursor-pointer transition-colors"
                    >
                      {/* Thumbnail */}
                      <div
                        className={`w-12 h-12 shrink-0 bg-[#242424] overflow-hidden shadow relative ${
                          isArtist ? 'rounded-full' : 'rounded-[4px]'
                        }`}
                      >
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.name}
                            onError={handleImageError}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white/30">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                            </svg>
                          </div>
                        )}
                        {isCurrentItemPlaying && (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <div className="w-3 h-3 rounded-full bg-[#1ed760] animate-pulse" />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex flex-col min-w-0 flex-1">
                        <span
                          className={`font-bold text-sm truncate ${
                            isCurrentItemPlaying ? 'text-[#1ed760]' : 'text-white'
                          }`}
                        >
                          {item.name}
                        </span>
                        <span className="text-xs text-[#a7a7a7] mt-0.5 truncate">
                          {item.subtitle || (item.type === 'track' ? 'Canción' : 'Playlist')}
                        </span>
                      </div>

                      {/* Trailing arrow / play indicator */}
                      <div className="shrink-0 text-white/40 pr-1">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z" />
                        </svg>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
};
