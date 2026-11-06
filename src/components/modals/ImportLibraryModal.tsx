import React, { useState } from 'react';
import { useUIStore } from '../../store/useUIStore';
import { useSpotifyDataStore } from '../../store/useSpotifyDataStore';
import { importExternalPlaylist } from '../../utils/playlistImporter';
import { t } from '../../utils/i18n';

export const ImportLibraryModal: React.FC = () => {
  const { isImportModalOpen, closeImportModal } = useUIStore();
  const { user, addCustomPlaylist } = useSpotifyDataStore();
  const [importInput, setImportInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isImportModalOpen) return null;

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = importInput.trim();
    if (!text) return;

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const result = await importExternalPlaylist(text, user || undefined);
      if (result.success && result.playlist) {
        addCustomPlaylist(result.playlist);
        setSuccessMsg(`Lista «${result.playlist.name}» importada con éxito (${result.playlist.tracks?.items?.length || 0} canciones).`);
        setTimeout(() => {
          closeImportModal();
          setSuccessMsg(null);
          setImportInput('');
        }, 1200);
      } else {
        setErrorMsg(result.error || 'No se pudo importar la lista. Verifica el enlace o formato.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error inesperado al importar la biblioteca.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200 select-none font-['SpotifyMixUI']"
      onClick={closeImportModal}
    >
      <div
        className="w-full max-w-[500px] bg-[#282828] border border-white/10 rounded-xl p-6 text-white shadow-[0_24px_56px_rgba(0,0,0,0.8)] space-y-5 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-white font-['SpotifyMixUITitle'] tracking-tight">
              {t('importMusicTitle') || 'Importa tu música'}
            </h2>
            <p className="text-xs text-[#b3b3b3] mt-1 font-['SpotifyMixUI']">
              {t('importMusicSubtitle') || 'Trae tus listas, canciones y artistas a tu biblioteca.'}
            </p>
          </div>
          <button
            type="button"
            onClick={closeImportModal}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#b3b3b3] hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0 ml-2"
            title="Cerrar"
          >
            <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
              <path d="M2.47 2.47a.75.75 0 0 1 1.06 0L8 6.94l4.47-4.47a.75.75 0 1 1 1.06 1.06L9.06 8l4.47 4.47a.75.75 0 1 1-1.06 1.06L8 9.06l-4.47 4.47a.75.75 0 0 1-1.06-1.06L6.94 8 2.47 3.53a.75.75 0 0 1 0-1.06z" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleImport} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-[#b3b3b3] block mb-2 font-['SpotifyMixUI'] uppercase tracking-wider">
              Enlace de playlist o lista de canciones
            </label>
            <textarea
              value={importInput}
              onChange={(e) => setImportInput(e.target.value)}
              placeholder="Pega un enlace de Spotify (https://open.spotify.com/playlist/...) o una lista con 'Canción - Artista'"
              rows={4}
              className="w-full bg-[#3e3e3e] focus:bg-[#333333] border border-transparent focus:border-[#727272] focus:ring-1 focus:ring-[#727272] rounded-lg p-3.5 text-sm text-white placeholder-[#878787] outline-none transition-all resize-none font-normal leading-relaxed font-['SpotifyMixUI']"
              autoFocus
            />
            <p className="text-xs text-[#a7a7a7] mt-2 leading-relaxed">
              Compatible con enlaces públicos de Spotify, YouTube, Apple Music o listados de texto línea por línea.
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-950/60 border border-red-500/30 rounded-lg text-xs text-red-200">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-[#1ed760]/20 border border-[#1ed760]/40 rounded-lg text-xs text-[#1ed760] font-bold">
              {successMsg}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={closeImportModal}
              className="px-6 py-2.5 rounded-full text-sm font-bold text-[#b3b3b3] hover:text-white hover:scale-104 active:scale-100 transition-all cursor-pointer font-['SpotifyMixUI']"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading || !importInput.trim()}
              className="px-8 py-2.5 rounded-full bg-[#1ed760] hover:bg-[#1fdf64] hover:scale-104 active:scale-100 text-black text-sm font-bold transition-all cursor-pointer disabled:opacity-40 disabled:scale-100 shadow-lg font-['SpotifyMixUI']"
            >
              {isLoading ? 'Importando...' : 'Importar ahora'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
