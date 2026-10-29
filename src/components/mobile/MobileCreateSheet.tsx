import React, { useState } from 'react';

interface MobileCreateSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onCreatePlaylist: (name: string) => void;
  onCreateFolder?: () => void;
  defaultPlaylistNumber?: number;
}

export const MobileCreateSheet: React.FC<MobileCreateSheetProps> = ({
  isOpen,
  onClose,
  onCreatePlaylist,
  onCreateFolder,
  defaultPlaylistNumber = 1,
}) => {
  const [isNamingPlaylist, setIsNamingPlaylist] = useState(false);
  const [playlistName, setPlaylistName] = useState(`Mi playlist n.º ${defaultPlaylistNumber}`);

  if (!isOpen) return null;

  const handleSubmitPlaylist = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = playlistName.trim() || `Mi playlist n.º ${defaultPlaylistNumber}`;
    onCreatePlaylist(finalName);
    setIsNamingPlaylist(false);
    onClose();
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

        {!isNamingPlaylist ? (
          <>
            {/* Header */}
            <div className="flex items-center justify-between pb-1">
              <h3 className="text-lg font-black text-white font-['SpotifyMixUITitle']">
                Crear
              </h3>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:text-white transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Creation Options matching Spotify Mobile */}
            <div className="space-y-2">
              {/* Option 1: Playlist */}
              <div
                onClick={() => setIsNamingPlaylist(true)}
                className="flex items-center gap-4 p-3 rounded-2xl hover:bg-white/10 active:bg-white/15 cursor-pointer transition-all active:scale-[0.98]"
              >
                <div className="w-12 h-12 rounded-xl bg-[#282828] border border-white/10 flex items-center justify-center text-white shrink-0 shadow-lg">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M15 15H3v2h12v-2zm0-4H3v2h12v-2zm-2-4H3v2h10V7zm4 4v-4h2v4h4v2h-4v4h-2v-4h-4v-2h4z" />
                  </svg>
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-bold text-white text-base">Playlist</span>
                  <span className="text-xs text-[#b3b3b3] mt-0.5">
                    Crea una lista de reproducción con canciones
                  </span>
                </div>
              </div>

              {/* Option 2: Carpeta */}
              <div
                onClick={() => {
                  onCreateFolder?.();
                  onClose();
                }}
                className="flex items-center gap-4 p-3 rounded-2xl hover:bg-white/10 active:bg-white/15 cursor-pointer transition-all active:scale-[0.98]"
              >
                <div className="w-12 h-12 rounded-xl bg-[#282828] border border-white/10 flex items-center justify-center text-white shrink-0 shadow-lg">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
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

              {/* Option 3: Fusión */}
              <div
                onClick={() => {
                  setIsNamingPlaylist(true);
                  setPlaylistName('Fusión con amigos');
                }}
                className="flex items-center gap-4 p-3 rounded-2xl hover:bg-white/10 active:bg-white/15 cursor-pointer transition-all active:scale-[0.98]"
              >
                <div className="w-12 h-12 rounded-xl bg-[#282828] border border-white/10 flex items-center justify-center text-white shrink-0 shadow-lg">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
                  </svg>
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-bold text-white text-base">Fusión</span>
                  <span className="text-xs text-[#b3b3b3] mt-0.5">
                    Combina gustos con amigos en una playlist
                  </span>
                </div>
              </div>
            </div>
          </>
        ) : (
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
                onClick={() => setIsNamingPlaylist(false)}
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
      </div>
    </div>
  );
};
