import React from 'react';
import { useStatsStore } from '../../store/useStatsStore';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useShallow } from 'zustand/react/shallow';
import { handleImageError } from '../../utils/imageFallback';
import type { Track } from '../../types/spotify';

interface MobileStatsViewProps {
  onBack: () => void;
  onSelectArtist?: (artistName: string) => void;
}

export const MobileStatsView: React.FC<MobileStatsViewProps> = ({
  onBack,
  onSelectArtist,
}) => {
  const { totalSeconds, totalTracksPlayed, audioPersonality, getTopArtists, getTopTracks } = useStatsStore();
  const { playTrack, currentTrack, isPlaying } = usePlayerStore(
    useShallow((s) => ({
      playTrack: s.playTrack,
      currentTrack: s.currentTrack,
      isPlaying: s.isPlaying,
    }))
  );

  const topArtists = getTopArtists(10);
  const topTracks = getTopTracks(15);

  const totalMinutes = Math.round(totalSeconds / 60);
  const totalHours = (totalMinutes / 60).toFixed(1);

  const handleTrackClick = (trk: any) => {
    const trackObj: Track = {
      id: trk.id,
      name: trk.name,
      duration_ms: 180000,
      artists: [{ id: `art-${trk.artist}`, name: trk.artist }],
      album: {
        id: `alb-${trk.id}`,
        name: trk.name,
        images: [{ url: trk.image }],
      },
    };
    playTrack(trackObj);
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

        <h1 className="text-base font-bold text-white tracking-tight">Estadísticas de escucha</h1>

        <div className="w-9" />
      </div>

      <div className="px-4 pt-4 space-y-6">
        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 gap-3">
          {/* Card 1: Tiempo */}
          <div className="p-4 rounded-2xl bg-[#181818] border border-white/[0.06] flex flex-col justify-between">
            <span className="text-xs text-[#a7a7a7] font-medium">Tiempo escuchado</span>
            <div className="mt-2">
              <span className="text-2xl font-black text-white font-['SpotifyMixUITitle']">
                {totalMinutes > 60 ? `${totalHours} h` : `${totalMinutes} min`}
              </span>
              <p className="text-[11px] text-[#727272] mt-0.5">En este dispositivo</p>
            </div>
          </div>

          {/* Card 2: Canciones */}
          <div className="p-4 rounded-2xl bg-[#181818] border border-white/[0.06] flex flex-col justify-between">
            <span className="text-xs text-[#a7a7a7] font-medium">Canciones reproducidas</span>
            <div className="mt-2">
              <span className="text-2xl font-black text-[#1ed760] font-['SpotifyMixUITitle']">
                {totalTracksPlayed}
              </span>
              <p className="text-[11px] text-[#727272] mt-0.5">Total de reproducciones</p>
            </div>
          </div>
        </div>

        {/* Personality Banner */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-[#181818] via-[#242424] to-[#181818] border border-white/[0.06] flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase tracking-wider font-bold text-[#1ed760]">
              Personalidad de escucha
            </span>
            <h2 className="text-lg font-bold text-white font-['SpotifyMixUITitle'] mt-0.5">
              {audioPersonality || 'Oyente Musical'}
            </h2>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#1ed760]/10 flex items-center justify-center text-[#1ed760]">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
        </div>

        {/* SECTION: Top Artists */}
        <section className="space-y-3">
          <h2 className="text-lg font-black text-white font-['SpotifyMixUITitle']">
            Artistas más escuchados
          </h2>

          {topArtists.length === 0 ? (
            <div className="py-6 px-4 bg-[#181818] rounded-xl text-center">
              <p className="text-xs text-[#a7a7a7]">Aún no hay suficientes datos de artistas.</p>
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none -mx-4 px-4">
              {topArtists.map((artist, idx) => (
                <div
                  key={artist.name}
                  onClick={() => onSelectArtist && onSelectArtist(artist.name)}
                  className="w-24 shrink-0 flex flex-col items-center text-center space-y-1.5 cursor-pointer active:scale-95 transition-transform"
                >
                  <div className="w-20 h-20 rounded-full overflow-hidden shadow-lg bg-[#242424] relative border border-white/5">
                    {artist.image ? (
                      <img
                        src={artist.image}
                        alt={artist.name}
                        onError={handleImageError}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-[#333] flex items-center justify-center font-bold text-white text-lg">
                        {(artist.name || 'A').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-black/80 text-[#1ed760] font-black text-[10px] flex items-center justify-center border border-black">
                      #{idx + 1}
                    </span>
                  </div>
                  <span className="font-bold text-white text-xs truncate w-full">
                    {artist.name}
                  </span>
                  <span className="text-[10px] text-[#a7a7a7]">
                    {artist.plays} reps
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* SECTION: Top Tracks */}
        <section className="space-y-3">
          <h2 className="text-lg font-black text-white font-['SpotifyMixUITitle']">
            Canciones más reproducidas
          </h2>

          {topTracks.length === 0 ? (
            <div className="py-6 px-4 bg-[#181818] rounded-xl text-center">
              <p className="text-xs text-[#a7a7a7]">Aún no hay reproducciones registradas.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {topTracks.map((trk, idx) => {
                const isCurrentPlaying = isPlaying && currentTrack?.id === trk.id;
                return (
                  <div
                    key={trk.id}
                    onClick={() => handleTrackClick(trk)}
                    className="flex items-center gap-3 p-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.06] active:bg-white/[0.1] cursor-pointer transition-colors"
                  >
                    <span
                      className={`w-4 text-center font-bold text-xs ${
                        isCurrentPlaying ? 'text-[#1ed760]' : 'text-[#a7a7a7]'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <div className="w-11 h-11 rounded-[4px] overflow-hidden bg-[#242424] shadow shrink-0 relative">
                      {trk.image ? (
                        <img
                          src={trk.image}
                          alt={trk.name}
                          onError={handleImageError}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/30">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                          </svg>
                        </div>
                      )}
                      {isCurrentPlaying && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <div className="w-2.5 h-2.5 rounded-full bg-[#1ed760] animate-pulse" />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span
                        className={`font-bold text-sm truncate ${
                          isCurrentPlaying ? 'text-[#1ed760]' : 'text-white'
                        }`}
                      >
                        {trk.name}
                      </span>
                      <span className="text-xs text-[#a7a7a7] mt-0.5 truncate">
                        {trk.artist}
                      </span>
                    </div>
                    <span className="text-xs text-[#a7a7a7] tabular-nums shrink-0">
                      {trk.plays} reps
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
