import React, { useState, useRef, useEffect } from 'react';
import { useUIStore } from '../../store/useUIStore';
import { useSpotifyDataStore } from '../../store/useSpotifyDataStore';
import { EMPTY_PLAYLIST_COVER, getAutoPlaylistCover, useAutoCovers } from '../../utils/playlistCover';

/** A chosen photo, made small (square 500 px JPEG) so it never fills the browser's storage */
function shrinkImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const S = 500;
        const c = document.createElement('canvas');
        c.width = c.height = S;
        const ctx = c.getContext('2d')!;
        const s = Math.min(img.naturalWidth, img.naturalHeight);
        ctx.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, S, S);
        resolve(c.toDataURL('image/jpeg', 0.85));
      } catch (e) {
        reject(e);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('image'));
    };
    img.src = url;
  });
}

/** "Editar información" of a playlist (desktop), Spotify style */
export const EditPlaylistModal: React.FC = () => {
  const { isEditPlaylistModalOpen, editingPlaylist, closeEditPlaylistModal } = useUIStore();
  const { updatePlaylist, deletePlaylist } = useSpotifyDataStore();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [closing, setClosing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  useAutoCovers((s) => s.version); // repaint when the songs' collage is ready

  useEffect(() => {
    if (editingPlaylist) {
      setName(editingPlaylist.name || '');
      setDescription(editingPlaylist.description || '');
      const own = editingPlaylist.images?.[0]?.url || '';
      setCoverUrl(own && !own.includes('liked-songs') && !own.includes('mosaic.scdn.co') ? own : '');
      setClosing(false);
      setTimeout(() => nameRef.current?.select(), 60);
    }
  }, [editingPlaylist]);

  if (!isEditPlaylistModalOpen || !editingPlaylist) return null;

  // The playlist as it is now (with its songs) for the automatic cover
  const live =
    useSpotifyDataStore.getState().playlistDetailsCache[editingPlaylist.id] ||
    useSpotifyDataStore.getState().playlists.find((p) => p.id === editingPlaylist.id) ||
    editingPlaylist;
  const autoCover = getAutoPlaylistCover(live.tracks?.items);
  const shownCover = coverUrl || (autoCover !== EMPTY_PLAYLIST_COVER ? autoCover : '');

  const close = (after?: () => void) => {
    setClosing(true);
    setTimeout(() => {
      after?.();
      closeEditPlaylistModal();
    }, 140);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setCoverUrl(await shrinkImage(file));
    } catch {}
  };

  const handleCancel = () => {
    close(() => {
      // A brand-new playlist that is cancelled is not kept
      if ((editingPlaylist as any)?.is_new) deletePlaylist(editingPlaylist.id);
    });
  };

  const handleSave = () => {
    if (!name.trim()) return;
    updatePlaylist(editingPlaylist.id, {
      name: name.trim(),
      description: description.trim(),
      // No photo of its own: the cover is made automatically from its songs
      images: coverUrl ? [{ url: coverUrl }] : [],
      is_new: false,
    } as any);
    close();
  };

  return (
    <div
      className={`fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 select-none font-['SpotifyMixUI'] transition-opacity duration-150 ${
        closing ? 'opacity-0' : 'opacity-100 animate-in fade-in'
      }`}
      onMouseDown={handleCancel}
      onKeyDown={(e) => {
        if (e.key === 'Escape') handleCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Editar información"
        className={`bg-[#282828] text-white rounded-lg shadow-[0_16px_48px_rgba(0,0,0,0.6)] w-full max-w-[524px] p-6 relative transition-all duration-150 ${
          closing ? 'opacity-0 scale-95' : 'opacity-100 scale-100 animate-in fade-in zoom-in-95'
        }`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-5">
          <h2 className="text-2xl font-bold tracking-tight font-['SpotifyMixUITitle',sans-serif]">Editar información</h2>
          <button
            onClick={handleCancel}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#a7a7a7] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Cerrar"
            aria-label="Cerrar"
          >
            <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2.47 2.47a.75.75 0 0 1 1.06 0L8 6.94l4.47-4.47a.75.75 0 1 1 1.06 1.06L9.06 8l4.47 4.47a.75.75 0 0 1-1.06 1.06L8 9.06l-4.47 4.47a.75.75 0 0 1-1.06-1.06L6.94 8 2.47 3.53a.75.75 0 0 1 0-1.06z" />
            </svg>
          </button>
        </div>

        <div className="flex gap-4">
          {/* Cover: own photo or the automatic one (collage / first song) */}
          <div className="shrink-0 w-[180px]">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="relative w-[180px] h-[180px] rounded-[4px] overflow-hidden bg-[#3e3e3e] shadow-[0_4px_60px_rgba(0,0,0,0.5)] group cursor-pointer block"
              title="Cambiar foto"
            >
              {shownCover ? (
                <img src={shownCover} alt={name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[#7f7f7f]">
                  <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
                    <path d="M9 18V5l11-2v13" />
                    <circle cx="6" cy="18" r="3" />
                    <circle cx="17" cy="16" r="3" />
                  </svg>
                </div>
              )}
              <span className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center text-sm font-bold text-white">
                Cambiar foto
              </span>
            </button>
            {coverUrl ? (
              <button
                type="button"
                onClick={() => setCoverUrl('')}
                className="mt-2 text-xs text-[#a7a7a7] hover:text-white hover:underline cursor-pointer"
              >
                Usar portada automática
              </button>
            ) : (
              <p className="mt-2 text-[11px] text-[#a7a7a7] leading-snug">Portada automática: se crea con tus canciones.</p>
            )}
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
          </div>

          <div className="flex-1 flex flex-col">
            <div className="relative bg-[#3e3e3e] border border-transparent focus-within:border-[#727272] focus-within:bg-[#333] rounded-[4px] px-3 pt-1.5 pb-2 transition-colors">
              <label className="block text-[11px] font-bold text-[#b3b3b3]">Nombre</label>
              <input
                ref={nameRef}
                type="text"
                value={name}
                maxLength={100}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave();
                }}
                placeholder="Añade un nombre"
                className="w-full bg-transparent text-white font-semibold text-sm outline-none placeholder-[#727272]"
              />
            </div>

            <div className="bg-[#3e3e3e] border border-transparent focus-within:border-[#727272] focus-within:bg-[#333] rounded-[4px] px-3 pt-1.5 pb-2 transition-colors mt-3 flex-1 flex flex-col">
              <label className="block text-[11px] font-bold text-[#b3b3b3]">Descripción</label>
              <textarea
                value={description}
                maxLength={300}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Añade una descripción opcional"
                rows={4}
                className="w-full bg-transparent text-white text-xs outline-none placeholder-[#727272] resize-none flex-1 mt-0.5"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end mt-5">
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="px-8 py-3 rounded-full bg-white text-black font-bold text-sm transition-all hover:scale-[1.04] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 cursor-pointer"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
};
