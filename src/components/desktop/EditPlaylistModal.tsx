import React, { useState, useRef, useEffect } from 'react';
import { useUIStore } from '../../store/useUIStore';
import { useSpotifyDataStore } from '../../store/useSpotifyDataStore';

export const EditPlaylistModal: React.FC = () => {
  const { isEditPlaylistModalOpen, editingPlaylist, closeEditPlaylistModal } = useUIStore();
  const updatePlaylist = useSpotifyDataStore((s) => s.updatePlaylist);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingPlaylist) {
      setName(editingPlaylist.name || '');
      setDescription(editingPlaylist.description || '');
      setCoverUrl(
        (editingPlaylist.images?.[0]?.url && !editingPlaylist.images[0].url.includes('liked-songs'))
          ? editingPlaylist.images[0].url
          : ''
      );
    }
  }, [editingPlaylist]);

  if (!isEditPlaylistModalOpen || !editingPlaylist) return null;

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setCoverUrl(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    if (!name.trim()) return;
    updatePlaylist(editingPlaylist.id, {
      name: name.trim(),
      description: description.trim(),
      images: [{ url: coverUrl }],
    });
    closeEditPlaylistModal();
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150 select-none"
      onClick={closeEditPlaylistModal}
    >
      <div
        className="bg-[#282828] text-white rounded-lg shadow-2xl w-full max-w-[524px] p-6 relative border border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4">
          <h2 className="text-2xl font-bold tracking-tight font-['SpotifyMixUITitle',sans-serif]">
            Editar información
          </h2>
          <button
            onClick={closeEditPlaylistModal}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#a7a7a7] hover:text-white hover:bg-white/10 transition-colors"
            title="Cerrar"
          >
            <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2.47 2.47a.75.75 0 0 1 1.06 0L8 6.94l4.47-4.47a.75.75 0 1 1 1.06 1.06L9.06 8l4.47 4.47a.75.75 0 0 1-1.06 1.06L8 9.06l-4.47 4.47a.75.75 0 0 1-1.06-1.06L6.94 8 2.47 3.53a.75.75 0 0 1 0-1.06z" />
            </svg>
          </button>
        </div>

        {/* Content Body: Image on left + Inputs on right */}
        <div className="flex gap-4">
          {/* Cover Art Box (180x180) */}
          <div
            onClick={handleImageClick}
            className="relative w-[180px] h-[180px] rounded-[4px] overflow-hidden bg-[#181818] shadow-2xl shrink-0 group cursor-pointer"
            title="Elegir foto"
          >
            {coverUrl ? (
              <img
                src={coverUrl}
                alt={name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-[#282828] text-[#b3b3b3]">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                </svg>
              </div>
            )}

            {/* Hover overlay with pencil icon + "Elegir foto" */}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 text-white">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                <path d="M14.06 2.94a2.25 2.25 0 0 1 3.18 0l3.82 3.82a2.25 2.25 0 0 1 0 3.18L8.18 22.82a.75.75 0 0 1-.53.22H3a.75.75 0 0 1-.75-.75v-4.65a.75.75 0 0 1 .22-.53L14.06 2.94zm2.12 1.06a.75.75 0 0 0-1.06 0l-1.5 1.5 3.82 3.82 1.5-1.5a.75.75 0 0 0 0-1.06l-2.76-2.76zM12.56 6.56 4.75 14.37v2.88h2.88l7.81-7.81-2.88-2.88z" />
              </svg>
              <span className="text-sm font-bold">Elegir foto</span>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />
          </div>

          {/* Form Fields */}
          <div className="flex-1 flex flex-col justify-between">
            {/* Name Input */}
            <div className="bg-[#3e3e3e] border border-transparent focus-within:border-[#727272] rounded-[4px] px-3 pt-1 pb-1.5 transition-colors">
              <label className="block text-[11px] font-bold text-[#b3b3b3]">
                Nombre
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre de la lista"
                className="w-full bg-transparent text-white font-semibold text-sm outline-none placeholder-[#727272]"
              />
            </div>

            {/* Description Textarea */}
            <div className="bg-[#3e3e3e] border border-transparent focus-within:border-[#727272] rounded-[4px] px-3 pt-1 pb-1.5 transition-colors mt-3 flex-1 flex flex-col">
              <label className="block text-[11px] font-bold text-[#b3b3b3]">
                Descripción
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Añade una descripción opcional"
                rows={4}
                className="w-full bg-transparent text-white text-xs outline-none placeholder-[#727272] resize-none flex-1 mt-0.5"
              />
            </div>
          </div>
        </div>

        {/* Buttons Action Bar */}
        <div className="flex items-center justify-between mt-5">
          {/* Left: Make Private / Public Toggle */}
          <button
            onClick={() => setIsPrivate(!isPrivate)}
            className="px-4 py-2 rounded-full border border-white/20 hover:border-white text-xs font-bold text-white transition-all hover:scale-104 active:scale-95"
          >
            {isPrivate ? 'Hacer pública' : 'Hacer privada'}
          </button>

          {/* Right: Guardar Pill Button */}
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="px-8 py-3 rounded-full bg-white text-black font-bold text-sm transition-all hover:scale-104 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            Guardar
          </button>
        </div>

        {/* Legal Disclaimer Footer */}
        <p className="text-[11px] text-[#b3b3b3] leading-relaxed mt-4 font-normal">
          Al continuar, aceptas que Spotify tenga acceso a la imagen que vas a subir. Asegúrate de tener derecho a subir la imagen.
        </p>
      </div>
    </div>
  );
};
