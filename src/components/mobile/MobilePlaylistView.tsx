import React, { useState, useEffect } from 'react';
import type { Playlist, Track } from '../../types/spotify';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useSpotifyDataStore } from '../../store/useSpotifyDataStore';
import { resolveVibrantColor } from '../../utils/spotifyColor';
import {
  PlayNativeIcon,
  PauseNativeIcon,
  AddTrackNativeIcon,
  CheckTrackNativeIcon,
} from '../icons/SpotifyNativeIcons';
import { formatDuration } from '../../utils/formatters';
import { searchSpotify } from '../../services/spotifyApi';
import { handleImageError } from '../../utils/imageFallback';

function cleanQueryForSearch(name: string, id: string): string {
  const n = (name || '').toLowerCase();
  if (id === '43GWp9FbN9nHihudedyVQM' || /romeo.*prince/i.test(n)) return 'Romeo Santos Prince Royce';
  if (id === 'radio-prince-royce' || /prince\s*royce/i.test(n)) return 'Prince Royce';
  if (n.includes('spidey')) return 'Spidey and His Amazing Friends Patrick Stump';
  if (n.includes('j+l') || n.includes('nuestro amor')) return 'Bad Bunny Feid Quevedo Rauw';
  if (n.includes('míticas') || n.includes('miticas')) return 'Estopa Melendi El Canto del Loco';
  if (n.includes('el nuevo urbano')) return 'Saiko Quevedo Morad Beny Jr';
  return name.replace(/[\(\)\[\]♡★✨🔥&]/g, ' ').replace(/\b20\d\d\b/g, '').trim();
}

interface MobilePlaylistViewProps {
  playlist: Playlist;
  onBack: () => void;
  onSelectPlaylistById?: (id: string, name?: string, image?: string) => void;
}

export const MobilePlaylistView: React.FC<MobilePlaylistViewProps> = ({
  playlist,
  onBack,
}) => {
  const { currentTrack, isPlaying, playTrack, togglePlay } = usePlayerStore();
  const { user } = useSpotifyDataStore();

  const [tracks, setTracks] = useState<Track[]>(playlist.tracks?.items || []);
  const [loading, setLoading] = useState(false);
  const [isSavedInLibrary, setIsSavedInLibrary] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      const saved = window.localStorage.getItem('spotifree_saved_library_playlists');
      if (saved) {
        const list: string[] = JSON.parse(saved);
        if (list.includes(playlist.id)) return true;
      }
    } catch {}
    return false;
  });

  // Track search state for empty lists
  const [addSearchQuery, setAddSearchQuery] = useState('');
  const [addSearchResults, setAddSearchResults] = useState<Track[]>([]);
  const [isSearchingAdd, setIsSearchingAdd] = useState(false);

  const themeColor = resolveVibrantColor(playlist.id, playlist.name, (playlist as any).color);
  const isLikedPlaylist = playlist.id === 'liked-songs' || playlist.id.includes('collection:tracks');

  // Load tracks if playlist only has stub
  useEffect(() => {
    let cancelled = false;

    // 1. Direct items
    if (playlist.tracks?.items && playlist.tracks.items.length > 0) {
      setTracks(playlist.tracks.items);
      return;
    }

    // 2. Check store for pre-seeded tracks
    const storePl = useSpotifyDataStore.getState().playlists.find((p) => p.id === playlist.id);
    if (storePl?.tracks?.items && storePl.tracks.items.length > 0) {
      setTracks(storePl.tracks.items);
      return;
    }

    // 3. Check custom saved tracks in localStorage
    try {
      const savedKey = isLikedPlaylist ? 'spotifree_custom_liked_songs' : `spotifree_playlist_tracks_${playlist.id}`;
      const savedRaw = window.localStorage.getItem(savedKey);
      if (savedRaw) {
        const parsed = JSON.parse(savedRaw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setTracks(parsed);
          return;
        }
      }
    } catch {}

    async function fetchTracks() {
      setLoading(true);
      try {
        const query = cleanQueryForSearch(playlist.name, playlist.id);
        const res = await fetch(
          `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=30`
        );
        if (res.ok) {
          const data = await res.json();
          const mapped: Track[] = (data.results || []).map((t: any, idx: number) => ({
            id: `track-${t.trackId || idx}`,
            name: t.trackName || 'Canción',
            duration_ms: t.trackTimeMillis || 210000,
            artists: [{ id: `art-${t.artistId || idx}`, name: t.artistName || 'Artista' }],
            album: {
              id: `alb-${t.collectionId || idx}`,
              name: t.collectionName || t.trackName,
              images: [{ url: (t.artworkUrl100 || '').replace('100x100bb', '600x600bb') }],
            },
          }));
          if (!cancelled && mapped.length > 0) {
            setTracks(mapped);
          }
        }
      } catch {}
      if (!cancelled) setLoading(false);
    }

    fetchTracks();
    return () => {
      cancelled = true;
    };
  }, [playlist.id, playlist.name, isLikedPlaylist]);

  const handleToggleLibrary = () => {
    const next = !isSavedInLibrary;
    setIsSavedInLibrary(next);
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem('spotifree_saved_library_playlists');
        let list: string[] = raw ? JSON.parse(raw) : [];
        if (next) {
          if (!list.includes(playlist.id)) list.push(playlist.id);
          useSpotifyDataStore.getState().addCustomPlaylist(playlist);
        } else {
          list = list.filter((id) => id !== playlist.id);
          useSpotifyDataStore.getState().deletePlaylist(playlist.id);
        }
        window.localStorage.setItem('spotifree_saved_library_playlists', JSON.stringify(list));
      } catch {}
    }
  };

  const handleTrackClick = (track: Track) => {
    if (currentTrack?.id === track.id) {
      togglePlay();
    } else {
      playTrack(track, tracks);
    }
  };

  const handlePlayAll = () => {
    if (tracks.length === 0) return;
    if (isPlaying && tracks.some((t) => t.id === currentTrack?.id)) {
      togglePlay();
    } else {
      playTrack(tracks[0], tracks);
    }
  };

  const handleSearchAdd = async (q: string) => {
    setAddSearchQuery(q);
    if (!q.trim()) {
      setAddSearchResults([]);
      return;
    }
    setIsSearchingAdd(true);
    try {
      const data = await searchSpotify(q);
      setAddSearchResults(data?.tracks?.items || []);
    } catch {
      setAddSearchResults([]);
    } finally {
      setIsSearchingAdd(false);
    }
  };

  const handleAddTrack = (newTrack: Track) => {
    setTracks((prev) => [newTrack, ...prev]);
  };

  const isCurrentPlaylistPlaying =
    isPlaying && tracks.some((t) => t.id === currentTrack?.id);

  const coverUrl =
    isLikedPlaylist
      ? 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg'
      : playlist.images?.[0]?.url || tracks[0]?.album?.images?.[0]?.url;

  return (
    <div
      className="select-none min-h-screen text-white font-['SpotifyMixUI'] pb-36 relative overflow-hidden"
      style={{
        backgroundColor: themeColor,
        backgroundImage: 'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(18,18,18,0.85) 280px, #121212 420px)',
      }}
    >
      {/* Ambient atmospheric aura & glow shine at the top */}
      <div
        className="absolute -top-20 left-1/2 -translate-x-1/2 w-[340px] h-[340px] rounded-full pointer-events-none blur-[90px] opacity-50 z-0"
        style={{ backgroundColor: themeColor }}
      />
      {/* Sticky Top Header */}
      <div className="sticky top-0 z-30 px-4 py-3 flex items-center justify-between backdrop-blur-md bg-black/40 border-b border-white/5">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-full bg-black/60 text-white flex items-center justify-center active:scale-95 transition-transform"
          title="Atrás"
        >
          <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
            <path d="M11.03.47a.75.75 0 0 1 0 1.06L4.81 7.75l6.22 6.22a.75.75 0 1 1-1.06 1.06l-6.75-6.75a.75.75 0 0 1 1.06 0z" />
          </svg>
        </button>

        <span className="font-bold text-sm text-white truncate max-w-[200px]">
          {playlist.name}
        </span>

        <button
          onClick={handleToggleLibrary}
          className="w-9 h-9 flex items-center justify-center text-white/80 hover:text-white"
          title={isSavedInLibrary ? 'Guardada en tu biblioteca' : 'Guardar en biblioteca'}
        >
          {isSavedInLibrary ? (
            <CheckTrackNativeIcon size={22} className="text-[#1ed760]" />
          ) : (
            <AddTrackNativeIcon size={22} />
          )}
        </button>
      </div>

      {/* Hero Header matching Spotify Mobile 03_mobile_playlist.png */}
      <div className="px-6 pt-4 pb-4 flex flex-col items-center text-center">
        <div className="w-52 h-52 rounded-lg overflow-hidden shadow-2xl bg-[#242424] mb-4 border border-white/10">
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={playlist.name}
              onError={handleImageError}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/40">
              <svg width="56" height="56" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
              </svg>
            </div>
          )}
        </div>

        <h1 className="text-2xl font-black text-white font-['SpotifyMixUITitle'] leading-tight mb-1 max-w-[90%]">
          {playlist.name}
        </h1>

        {playlist.description && (
          <p className="text-xs text-[#b3b3b3] line-clamp-2 max-w-[85%] mb-2">
            {playlist.description}
          </p>
        )}

        <div className="flex items-center gap-2 text-xs text-[#b3b3b3] font-medium">
          <span className="text-white font-bold">{playlist.owner?.display_name || user?.display_name || 'Spotify'}</span>
          <span>•</span>
          <span>{tracks.length} canciones</span>
        </div>
      </div>

      {/* Action Row matching Spotify Mobile: Library, Download, Dots, Large Play Button */}
      <div className="px-6 py-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={handleToggleLibrary}
            className="w-8 h-8 rounded-full border border-white/40 flex items-center justify-center text-white hover:border-white transition-all active:scale-95"
            title={isSavedInLibrary ? 'Guardada' : 'Guardar en biblioteca'}
          >
            {isSavedInLibrary ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="#1ed760">
                <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 1.5a.75.75 0 0 1 .75.75v5h5a.75.75 0 0 1 0 1.5h-5v5a.75.75 0 0 1-1.5 0v-5h-5a.75.75 0 0 1 0-1.5h5v-5A.75.75 0 0 1 8 1.5z" />
              </svg>
            )}
          </button>

          <button
            className="w-8 h-8 rounded-full border border-white/40 flex items-center justify-center text-white/70 hover:text-white transition-all"
            title="Descargar"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 1.5a.75.75 0 0 1 .75.75v8.19l2.72-2.72a.75.75 0 1 1 1.06 1.06l-4 4a.75.75 0 0 1-1.06 0l-4-4a.75.75 0 0 1 1.06-1.06l2.72 2.72V2.25A.75.75 0 0 1 8 1.5zM2 13.5a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75z" />
            </svg>
          </button>

          <button
            className="w-8 h-8 flex items-center justify-center text-white/70 hover:text-white"
            title="Más opciones"
          >
            <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
              <path d="M3 8a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm6.5 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm6.5 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z" />
            </svg>
          </button>
        </div>

        {/* Large Green Play Button */}
        <button
          onClick={handlePlayAll}
          className="w-14 h-14 rounded-full bg-[#1ed760] hover:scale-106 active:scale-95 shadow-2xl flex items-center justify-center text-black transition-all"
          title={isCurrentPlaylistPlaying ? 'Pausar' : 'Reproducir lista'}
        >
          {isCurrentPlaylistPlaying ? (
            <PauseNativeIcon size={24} className="text-black" />
          ) : (
            <PlayNativeIcon size={24} className="text-black ml-1" />
          )}
        </button>
      </div>

      {/* Track List */}
      <div className="px-4 pt-2 space-y-1">
        {loading ? (
          <div className="p-8 text-center text-[#b3b3b3] text-sm flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-white/20 border-t-[#1ed760] rounded-full animate-spin" />
            <span>Cargando canciones...</span>
          </div>
        ) : tracks.length === 0 ? (
          <div className="p-6 text-center space-y-4">
            <p className="text-xs text-[#b3b3b3] leading-relaxed max-w-xs mx-auto">
              Tu lista de <em>«Canciones que te gustan»</em> es una colección personal protegida en Spotify. Añade canciones con el buscador para crear tu lista.
            </p>
            {/* Inline search for songs */}
            <div className="max-w-md mx-auto space-y-3">
              <input
                type="text"
                value={addSearchQuery}
                onChange={(e) => handleSearchAdd(e.target.value)}
                placeholder="Buscar canciones para añadir..."
                className="w-full h-11 bg-white/10 text-white text-sm rounded-full px-4 outline-none placeholder:text-[#a7a7a7] border border-transparent focus:border-white/30"
              />

              {isSearchingAdd && (
                <div className="text-xs text-[#b3b3b3]">Buscando temas...</div>
              )}

              {addSearchResults.map((trk) => (
                <div
                  key={trk.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-white/5 hover:bg-white/10"
                >
                  <div className="flex flex-col min-w-0 pr-2 text-left">
                    <span className="font-bold text-white text-xs truncate">
                      {trk.name}
                    </span>
                    <span className="text-[11px] text-[#b3b3b3] truncate">
                      {trk.artists?.map((a) => a.name).join(', ')}
                    </span>
                  </div>
                  <button
                    onClick={() => handleAddTrack(trk)}
                    className="px-3 py-1 rounded-full bg-white text-black text-xs font-bold shrink-0 hover:scale-105 active:scale-95"
                  >
                    Añadir
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          tracks.map((track, idx) => {
            const isThisPlaying = isPlaying && currentTrack?.id === track.id;
            const trackCover =
              track.album?.images?.[0]?.url ||
              tracks[0]?.album?.images?.[0]?.url;

            return (
              <div
                key={track.id || idx}
                onClick={() => handleTrackClick(track)}
                className="flex items-center justify-between p-2.5 rounded-lg active:bg-white/10 cursor-pointer transition-colors group"
              >
                {/* Left: Cover or Number + Info */}
                <div className="flex items-center gap-3 min-w-0 flex-1 mr-3">
                  <div className="w-11 h-11 rounded overflow-hidden bg-[#242424] shrink-0 shadow relative">
                    {trackCover ? (
                      <img
                        src={trackCover}
                        alt={track.name}
                        onError={handleImageError}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-[#b3b3b3]">
                        {idx + 1}
                      </div>
                    )}
                    {isThisPlaying && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <div className="w-3 h-3 bg-[#1ed760] rounded-full animate-ping" />
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col min-w-0">
                    <span
                      className={`font-bold text-sm truncate ${
                        isThisPlaying ? 'text-[#1ed760]' : 'text-white'
                      }`}
                    >
                      {track.name}
                    </span>
                    <span className="text-xs text-[#b3b3b3] truncate mt-0.5">
                      {track.artists?.map((a) => a.name).join(', ') || 'Artista'}
                    </span>
                  </div>
                </div>

                {/* Right: duration / options */}
                <div className="flex items-center gap-2 shrink-0 text-[#b3b3b3]">
                  <span className="text-xs">{formatDuration(track.duration_ms)}</span>
                  <button
                    onClick={(e) => e.stopPropagation()}
                    className="p-1 hover:text-white"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M3 8a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm6.5 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm6.5 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
