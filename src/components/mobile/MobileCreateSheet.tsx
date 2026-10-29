import React, { useState } from 'react';
import { importExternalPlaylist } from '../../utils/playlistImporter';
import { useSpotifyDataStore } from '../../store/useSpotifyDataStore';
import type { Playlist } from '../../types/spotify';

interface MobileCreateSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onCreatePlaylist: (name: string) => void;
  onImportPlaylist?: (playlist: Playlist) => void;
  onCreateFolder?: () => void;
  defaultPlaylistNumber?: number;
}

export const MobileCreateSheet: React.FC<MobileCreateSheetProps> = ({
  isOpen,
  onClose,
  onCreatePlaylist,
  onImportPlaylist,
  onCreateFolder,
  defaultPlaylistNumber = 1,
}) => {
  const { user } = useSpotifyDataStore();
  const [viewMode, setViewMode] = useState<'menu' | 'naming' | 'importing'>('menu');
  const [playlistName, setPlaylistName] = useState(`Mi playlist n.º ${defaultPlaylistNumber}`);
  const [importUrl, setImportUrl] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmitPlaylist = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = playlistName.trim() || `Mi playlist n.º ${defaultPlaylistNumber}`;
    onCreatePlaylist(finalName);
    setViewMode('menu');
    onClose();
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importUrl.trim()) return;
    setImportLoading(true);
    setImportError(null);

    const result = await importExternalPlaylist(importUrl.trim(), user || undefined);
    setImportLoading(false);

    if (result.success && result.playlist) {
      if (onImportPlaylist) {
        onImportPlaylist(result.playlist);
      } else {
        useSpotifyDataStore.getState().addCustomPlaylist(result.playlist);
      }
      setViewMode('menu');
      setImportUrl('');
      onClose();
    } else {
      setImportError(result.error || 'No se pudo importar la playlist.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-md animate-in fade-in duration-300 select-none font-['SpotifyMixUI'] pointer-events-auto"
      onClick={onClose}
    >
      <div
        className="w-full bg-[#181818] rounded-t-3xl p-6 pb-9 space-y-5 shadow-2xl animate-in slide-in-from-bottom duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] border-t border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="w-10 h-1.5 rounded-full bg-white/20 mx-auto -mt-1 mb-2" />

        {viewMode === 'menu' && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between pb-1">
              <h3 className="text-base font-bold text-white font-['SpotifyMixUITitle']">
                Crear
              </h3>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:text-white transition-colors cursor-pointer active:scale-90"
              >
                ✕
              </button>
            </div>

            {/* Creation Options matching Spotify Mobile */}
            <div className="space-y-1.5">
              {/* Option 1: Playlist */}
              <div
                onClick={() => setViewMode('naming')}
                className="flex items-center gap-4 p-3 rounded-2xl hover:bg-white/10 active:bg-white/15 cursor-pointer transition-all active:scale-[0.99]"
              >
                <div className="w-12 h-12 rounded-xl bg-[#282828] border border-white/10 flex items-center justify-center text-white shrink-0 shadow-lg">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M2 18h10v2H2v-2zm0-7h20v2H2v-2zm0-7h20v2H2V4zm16 11.5v3h3v2h-3v3h-2v-3h-3v-2h3v-3h2z" />
                  </svg>
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-bold text-white text-base">Playlist</span>
                  <span className="text-xs text-[#b3b3b3] mt-0.5">
                    Crea una lista de reproducción con canciones
                  </span>
                </div>
              </div>

              {/* Option 2: Fusión (Official Spotify Blend) */}
              <div
                onClick={() => {
                  setPlaylistName('Fusión con amigos');
                  setViewMode('naming');
                }}
                className="flex items-center gap-4 p-3 rounded-2xl hover:bg-white/10 active:bg-white/15 cursor-pointer transition-all active:scale-[0.99]"
              >
                <div className="w-12 h-12 rounded-xl bg-[#282828] border border-white/10 flex items-center justify-center text-[#1ed760] shrink-0 shadow-lg">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8.5 3a5.5 5.5 0 0 0-4.87 8.04A5.5 5.5 0 1 0 11.04 15.5 5.51 5.51 0 0 0 8.5 3zm5 5.5a3.5 3.5 0 0 1-1.39 2.78 5.48 5.48 0 0 0-2.39-2.39A3.5 3.5 0 0 1 13.5 8.5z" />
                  </svg>
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-bold text-white text-base">Fusión</span>
                  <span className="text-xs text-[#b3b3b3] mt-0.5">
                    Combina gustos con amigos en una playlist compartida
                  </span>
                </div>
              </div>

              {/* Option 3: Importar playlist */}
              <div
                onClick={() => setViewMode('importing')}
                className="flex items-center gap-4 p-3 rounded-2xl hover:bg-white/10 active:bg-white/15 cursor-pointer transition-all active:scale-[0.99]"
              >
                <div className="w-12 h-12 rounded-xl bg-[#282828] border border-white/10 flex items-center justify-center text-white shrink-0 shadow-lg">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 3a1 1 0 0 1 1 1v8.59l2.3-2.3a1 1 0 1 1 1.4 1.42l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 1.4-1.42l2.3 2.3V4a1 1 0 0 1 1-1zm-7 14a1 1 0 0 1 1 1v1h12v-1a1 1 0 1 1 2 0v2a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1z" />
                  </svg>
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-bold text-white text-base">Importar playlist</span>
                  <span className="text-xs text-[#b3b3b3] mt-0.5">
                    Desde YouTube, SoundCloud, Spotify o lista de texto
                  </span>
                </div>
              </div>

              {/* Option 4: Carpeta */}
              <div
                onClick={() => {
                  onCreateFolder?.();
                  onClose();
                }}
                className="flex items-center gap-4 p-3 rounded-2xl hover:bg-white/10 active:bg-white/15 cursor-pointer transition-all active:scale-[0.99]"
              >
                <div className="w-12 h-12 rounded-xl bg-[#282828] border border-white/10 flex items-center justify-center text-white shrink-0 shadow-lg">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
                  </svg>
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-bold text-white text-base">Carpeta</span>
                  <span className="text-xs text-[#b3b3b3] mt-0.5">
                    Organiza tus listas de reproducción
                  </span>
                </div>
              </div>
            </div>
          </>
        )}

        {viewMode === 'naming' && (
          /* Sub-step: Ponle nombre a tu lista */
          <form onSubmit={handleSubmitPlaylist} className="space-y-6 pt-2 animate-in fade-in duration-200">
            <h3 className="text-xl font-black text-white font-['SpotifyMixUITitle'] text-center">
              Ponle nombre a tu playlist
            </h3>
            <div className="relative border-b-2 border-white/40 focus-within:border-[#1ed760] transition-colors pb-1">
              <input
                type="text"
                autoFocus
                value={playlistName}
                onChange={(e) => setPlaylistName(e.target.value)}
                className="w-full bg-transparent px-2 py-2 text-white text-xl outline-none text-center font-black tracking-tight"
                placeholder="Mi playlist"
              />
            </div>
            <div className="flex items-center justify-center gap-4 pt-2">
              <button
                type="button"
                onClick={() => setViewMode('menu')}
                className="px-6 py-2.5 rounded-full border border-white/30 text-white font-bold text-xs hover:border-white transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-8 py-2.5 rounded-full bg-[#1ed760] hover:bg-[#1fdf64] active:scale-95 text-black font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-xl font-black"
              >
                Crear
              </button>
            </div>
          </form>
        )}

        {viewMode === 'importing' && (
          /* Sub-step: Importar playlist externa */
          <form onSubmit={handleImportSubmit} className="space-y-5 pt-2 animate-in fade-in duration-200">
            <h3 className="text-xl font-black text-white font-['SpotifyMixUITitle'] text-center">
              Importar playlist
            </h3>
            <p className="text-xs text-[#b3b3b3] text-center max-w-xs mx-auto">
              Pega un enlace de YouTube, SoundCloud, Spotify o escribe canciones línea por línea.
            </p>
            <div className="relative border-b-2 border-white/40 focus-within:border-[#1ed760] transition-colors pb-1">
              <textarea
                autoFocus
                rows={2}
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                className="w-full bg-transparent px-2 py-1 text-white text-sm outline-none text-center font-medium tracking-tight resize-none"
                placeholder="https://www.youtube.com/playlist?list=... o https://open.spotify.com/..."
              />
            </div>

            {importError && (
              <p className="text-xs text-red-400 text-center font-medium">{importError}</p>
            )}

            <div className="flex items-center justify-center gap-4 pt-2">
              <button
                type="button"
                onClick={() => setViewMode('menu')}
                className="px-6 py-2.5 rounded-full border border-white/30 text-white font-bold text-xs hover:border-white transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={importLoading || !importUrl.trim()}
                className="px-8 py-2.5 rounded-full bg-[#1ed760] hover:bg-[#1fdf64] disabled:opacity-50 active:scale-95 text-black font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-xl font-black"
              >
                {importLoading ? 'Importando...' : 'Importar'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
