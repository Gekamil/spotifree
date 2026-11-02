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
        className="w-full max-w-lg bg-[#242424] rounded-2xl p-6 text-white shadow-2xl border border-white/10 space-y-4 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-2 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#1ed760]/20 text-[#1ed760] flex items-center justify-center shrink-0">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-['SpotifyMixUITitle']">
                {t('importMusicTitle')}
              </h3>
              <p className="text-xs text-[#b3b3b3] mt-0.5">{t('importMusicSubtitle')}</p>
            </div>
          </div>
          <button
            onClick={closeImportModal}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-[#b3b3b3] hover:text-white transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleImport} className="space-y-4 pt-1">
          <div>
            <label className="text-xs font-bold text-[#b3b3b3] block mb-1.5 uppercase tracking-wider">
              Enlace de playlist o lista de canciones
            </label>
            <textarea
              value={importInput}
              onChange={(e) => setImportInput(e.target.value)}
              placeholder="Pega un enlace de Spotify (https://open.spotify.com/playlist/...) o una lista con 'Canción - Artista'"
              rows={4}
              className="w-full bg-[#181818] border border-white/10 rounded-xl p-3 text-xs text-white placeholder-[#727272] focus:border-[#1ed760] outline-none transition-colors resize-none"
              autoFocus
            />
            <p className="text-[11px] text-[#727272] mt-1">
              Compatible con enlaces públicos de Spotify, YouTube, Apple Music o listados de texto línea por línea.
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-950/50 border border-red-500/30 rounded-xl text-xs text-red-200">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-[#1ed760]/20 border border-[#1ed760]/40 rounded-xl text-xs text-[#1ed760] font-bold">
              {successMsg}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={closeImportModal}
              className="px-4 py-2 rounded-full text-xs font-bold text-[#b3b3b3] hover:text-white transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading || !importInput.trim()}
              className="px-6 py-2 rounded-full bg-white text-black text-xs font-bold hover:scale-105 active:scale-95 transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none shadow-lg"
            >
              {isLoading ? 'Importando...' : 'Importar ahora'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
