import React, { useState, useRef } from 'react';

interface MobileEditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDisplayName: string;
  initialAvatarUrl?: string;
  initialBannerUrl?: string;
  onSave: (data: { displayName: string; avatarUrl?: string; bannerUrl?: string }) => void;
}

export const MobileEditProfileModal: React.FC<MobileEditProfileModalProps> = ({
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md font-['SpotifyMixUI'] select-none animate-fade-in">
      <div className="relative w-full max-w-md bg-[#242424] text-white rounded-t-3xl sm:rounded-2xl shadow-2xl border border-white/10 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-bold text-[#b3b3b3] hover:text-white cursor-pointer"
          >
            Cancelar
          </button>
          <h3 className="text-sm font-bold text-white font-['SpotifyMixUITitle']">
            Editar perfil
          </h3>
          <button
            type="button"
            onClick={handleSave}
            className="text-xs font-bold text-[#1ed760] hover:text-white cursor-pointer"
          >
            Guardar
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-6">
          {/* Banner section */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-[#b3b3b3] uppercase tracking-wider">
              Portada / Banner (GIF o Imagen)
            </span>
            <div className="relative w-full h-28 rounded-xl overflow-hidden bg-[#181818] border border-white/10 group">
              {bannerUrl ? (
                <img src={bannerUrl} alt="Banner" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-[#727272] text-xs">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="mb-1">
                    <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
                  </svg>
                  <span>Sin banner seleccionado</span>
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center gap-2 opacity-90">
                <button
                  type="button"
                  onClick={() => bannerInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-full bg-white text-black font-bold text-xs shadow hover:scale-105 active:scale-95 transition-all"
                >
                  Subir archivo / GIF
                </button>
                {bannerUrl && (
                  <button
                    type="button"
                    onClick={() => setBannerUrl('')}
                    className="px-2.5 py-1.5 rounded-full bg-red-600/80 text-white font-bold text-xs hover:bg-red-600"
                  >
                    Quitar
                  </button>
                )}
              </div>
            </div>
            <input
              type="file"
              ref={bannerInputRef}
              onChange={(e) => handleFileChange(e, 'banner')}
              accept="image/*,.gif"
              className="hidden"
            />
            <div className="flex items-center justify-between text-[11px] text-[#b3b3b3]">
              <span>Admite archivos .gif, .png, .jpg</span>
              <button
                type="button"
                onClick={() => setShowBannerUrlInput(!showBannerUrlInput)}
                className="text-[#1ed760] hover:underline"
              >
                {showBannerUrlInput ? 'Ocultar URL' : 'O usar enlace URL'}
              </button>
            </div>
            {showBannerUrlInput && (
              <input
                type="text"
                value={bannerUrl}
                onChange={(e) => setBannerUrl(e.target.value)}
                placeholder="Pega la URL del banner o GIF..."
                className="w-full h-9 px-3 bg-[#181818] rounded-lg text-xs text-white border border-white/10 outline-none focus:border-[#1ed760]"
              />
            )}
          </div>

          {/* Avatar section */}
          <div className="space-y-2 flex flex-col items-center">
            <span className="text-xs font-bold text-[#b3b3b3] uppercase tracking-wider self-start">
              Foto de perfil (GIF o Imagen)
            </span>
            <div className="relative w-28 h-28 rounded-full overflow-hidden bg-[#181818] border-2 border-white/10 shadow-lg group my-2">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-tr from-[#1ed760] to-[#121212] flex items-center justify-center text-black font-black text-3xl">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-full bg-white text-black font-bold text-[11px] shadow hover:scale-105 active:scale-95 transition-all"
                >
                  Cambiar
                </button>
              </div>
            </div>
            <input
              type="file"
              ref={avatarInputRef}
              onChange={(e) => handleFileChange(e, 'avatar')}
              accept="image/*,.gif"
              className="hidden"
            />
            <div className="flex items-center gap-3 text-[11px] text-[#b3b3b3]">
              <button
                type="button"
                onClick={() => setShowAvatarUrlInput(!showAvatarUrlInput)}
                className="text-[#1ed760] hover:underline"
              >
                {showAvatarUrlInput ? 'Ocultar URL' : 'O pegar enlace URL de GIF'}
              </button>
              {avatarUrl && (
                <button
                  type="button"
                  onClick={() => setAvatarUrl('')}
                  className="text-red-400 hover:underline"
                >
                  Restablecer
                </button>
              )}
            </div>
            {showAvatarUrlInput && (
              <input
                type="text"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="Pega la URL de tu imagen o GIF..."
                className="w-full h-9 px-3 bg-[#181818] rounded-lg text-xs text-white border border-white/10 outline-none focus:border-[#1ed760] mt-1"
              />
            )}
          </div>

          {/* Name input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#b3b3b3] uppercase tracking-wider">
              Nombre de usuario
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Tu nombre en Spotifree"
              className="w-full h-11 px-3.5 bg-[#181818] rounded-xl text-sm text-white font-bold border border-white/10 outline-none focus:border-[#1ed760] transition-colors"
            />
            <p className="text-[11px] text-[#727272]">
              Este nombre será visible para tus seguidores y en tus listas de reproducción.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
