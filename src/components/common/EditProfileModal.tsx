import React, { useState, useRef } from 'react';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDisplayName: string;
  initialAvatarUrl?: string;
  initialBannerUrl?: string;
  onSave: (data: { displayName: string; avatarUrl?: string; bannerUrl?: string }) => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  isOpen,
  onClose,
  initialDisplayName,
  initialAvatarUrl,
  initialBannerUrl,
  onSave,
}) => {
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl || '');
  const [bannerUrl, setBannerUrl] = useState(initialBannerUrl || '');
  const [showAvatarUrlInput, setShowAvatarUrlInput] = useState(false);
  const [showBannerUrlInput, setShowBannerUrlInput] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, target: 'avatar' | 'banner') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        if (target === 'avatar') {
          setAvatarUrl(reader.result);
        } else {
          setBannerUrl(reader.result);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      displayName: displayName.trim() || initialDisplayName,
      avatarUrl: avatarUrl || undefined,
      bannerUrl: bannerUrl || undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md font-['SpotifyMixUI'] select-none animate-fade-in p-0 sm:p-4">
      <div className="relative w-full max-w-lg bg-[#242424] text-white rounded-t-3xl sm:rounded-2xl shadow-2xl border border-white/10 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-bold text-[#b3b3b3] hover:text-white cursor-pointer transition-colors"
          >
            Cancelar
          </button>
          <h3 className="text-base font-bold text-white font-['SpotifyMixUITitle']">
            Editar perfil
          </h3>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-1.5 rounded-full bg-[#1ed760] text-black font-bold text-xs uppercase tracking-wider hover:scale-104 active:scale-95 transition-all shadow cursor-pointer font-black"
          >
            Guardar
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Banner section */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-[#b3b3b3] uppercase tracking-wider">
              Portada / Banner (GIF o Imagen)
            </span>
            <div className="relative w-full h-32 rounded-xl overflow-hidden bg-[#181818] border border-white/10 group">
              {bannerUrl ? (
                <img src={bannerUrl} alt="Banner" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-[#727272] text-xs">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" className="mb-1">
                    <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
                  </svg>
                  <span>Sin banner seleccionado</span>
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center gap-2 opacity-90 transition-opacity">
                <button
                  type="button"
                  onClick={() => bannerInputRef.current?.click()}
                  className="px-3 py-1.5 bg-white text-black text-xs font-bold rounded-full hover:scale-105 active:scale-95 transition-transform cursor-pointer shadow"
                >
                  Subir archivo / GIF
                </button>
                <button
                  type="button"
                  onClick={() => setShowBannerUrlInput(!showBannerUrlInput)}
                  className="px-3 py-1.5 bg-black/70 border border-white/20 text-white text-xs font-bold rounded-full hover:bg-black active:scale-95 transition-all cursor-pointer"
                >
                  Pegar URL
                </button>
                {bannerUrl && (
                  <button
                    type="button"
                    onClick={() => setBannerUrl('')}
                    className="p-1.5 bg-red-600/80 hover:bg-red-600 text-white rounded-full text-xs cursor-pointer"
                    title="Eliminar banner"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            <input
              ref={bannerInputRef}
              type="file"
              accept="image/*,.gif"
              onChange={(e) => handleFileChange(e, 'banner')}
              className="hidden"
            />

            {showBannerUrlInput && (
              <input
                type="text"
                placeholder="https://ejemplo.com/banner.gif o imagen..."
                value={bannerUrl}
                onChange={(e) => setBannerUrl(e.target.value)}
                className="w-full px-3.5 py-2 bg-[#181818] border border-white/10 rounded-lg text-xs text-white placeholder-[#727272] focus:border-[#1ed760] outline-none transition-colors"
              />
            )}
          </div>

          {/* Avatar / Logo Section */}
          <div className="flex items-center gap-5">
            <div className="relative w-24 h-24 rounded-full overflow-hidden bg-[#181818] border-2 border-white/10 shrink-0 group shadow-lg">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-tr from-[#5018f0] to-[#1ed760] text-black font-black text-3xl">
                  {(displayName || 'U').charAt(0).toUpperCase()}
                </div>
              )}
              <div
                onClick={() => avatarInputRef.current?.click()}
                className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-[10px] font-bold text-white text-center p-1"
              >
                <span>Cambiar</span>
                <span>foto / GIF</span>
              </div>
            </div>

            <div className="flex-1 space-y-2">
              <span className="text-xs font-bold text-[#b3b3b3] uppercase tracking-wider block">
                Foto de perfil / Logo
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 active:scale-95 text-xs font-bold rounded-full transition-all cursor-pointer border border-white/10"
                >
                  Subir archivo / GIF
                </button>
                <button
                  type="button"
                  onClick={() => setShowAvatarUrlInput(!showAvatarUrlInput)}
                  className="px-3 py-1.5 bg-white/5 hover:bg-white/15 active:scale-95 text-xs font-bold rounded-full transition-all cursor-pointer border border-white/10"
                >
                  Pegar URL
                </button>
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={() => setAvatarUrl('')}
                    className="px-2.5 py-1.5 bg-red-600/30 hover:bg-red-600/50 text-red-300 text-xs font-bold rounded-full transition-colors cursor-pointer"
                  >
                    Quitar
                  </button>
                )}
              </div>

              {showAvatarUrlInput && (
                <input
                  type="text"
                  placeholder="https://ejemplo.com/foto.gif..."
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  className="w-full px-3 py-1.5 bg-[#181818] border border-white/10 rounded-lg text-xs text-white placeholder-[#727272] focus:border-[#1ed760] outline-none transition-colors"
                />
              )}
            </div>

            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*,.gif"
              onChange={(e) => handleFileChange(e, 'avatar')}
              className="hidden"
            />
          </div>

          {/* Display Name Section */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-[#b3b3b3] uppercase tracking-wider block">
              Nombre de usuario
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Introduce tu nombre..."
              className="w-full px-4 py-2.5 bg-[#181818] border border-white/10 rounded-xl text-sm font-bold text-white placeholder-[#727272] focus:border-[#1ed760] outline-none transition-colors"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
