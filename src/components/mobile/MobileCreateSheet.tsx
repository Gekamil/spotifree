import React, { useEffect, useRef, useState } from 'react';
import { importExternalPlaylist } from '../../utils/playlistImporter';
import { showGlobalToast } from '../../utils/globalToast';
import { useSpotifyDataStore } from '../../store/useSpotifyDataStore';
import { useSharedSessionStore } from '../../services/sharedSessionService';
import { FriendsNativeIcon, ImportNativeIcon, PasteNativeIcon, PlaylistNoteNativeIcon } from '../icons/SpotifyNativeIcons';
import type { Playlist } from '../../types/spotify';

interface MobileCreateSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onCreatePlaylist: (name: string) => void;
  onImportPlaylist?: (playlist: Playlist) => void;
  defaultPlaylistNumber?: number;
}

const IMPORT_SOURCES = ['YouTube Music', 'YouTube', 'Apple Music', 'Spotify'];

/**
 * "Crear" (mobile, like Spotify's): Playlist, Importar playlist and Escuchar juntos. Naming a
 * playlist and importing one open full screen, as in the Spotify app.
 */
export const MobileCreateSheet: React.FC<MobileCreateSheetProps> = ({
  isOpen,
  onClose,
  onCreatePlaylist,
  onImportPlaylist,
  defaultPlaylistNumber = 1,
}) => {
  const { user } = useSpotifyDataStore();
  const [viewMode, setViewMode] = useState<'menu' | 'naming' | 'importing'>('menu');
  const [playlistName, setPlaylistName] = useState(`Mi playlist n.º ${defaultPlaylistNumber}`);
  const [importUrl, setImportUrl] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState<[number, number] | null>(null);

  // Swipe down to close the sheet
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef(0);
  const currentYRef = useRef(0);

  // Every time it opens: back to the menu with a fresh default name
  useEffect(() => {
    if (isOpen) {
      setViewMode('menu');
      setPlaylistName(`Mi playlist n.º ${defaultPlaylistNumber}`);
      setImportError(null);
    }
  }, [isOpen, defaultPlaylistNumber]);

  const handleTouchStart = (e: React.TouchEvent) => {
    startYRef.current = e.touches[0].clientY;
    currentYRef.current = e.touches[0].clientY;
    setIsDragging(true);
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const delta = e.touches[0].clientY - startYRef.current;
    if (delta > 0) {
      currentYRef.current = e.touches[0].clientY;
      setDragY(delta);
    }
  };
  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (currentYRef.current - startYRef.current > 90) {
      setDragY(450);
      setTimeout(() => {
        onClose();
        setDragY(0);
      }, 200);
    } else {
      setDragY(0);
    }
  };

  if (!isOpen) return null;

  const handleSubmitPlaylist = (e: React.FormEvent) => {
    e.preventDefault();
    onCreatePlaylist(playlistName.trim() || `Mi playlist n.º ${defaultPlaylistNumber}`);
    onClose();
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importUrl.trim() || importLoading) return;
    setImportLoading(true);
    setImportError(null);
    setImportProgress(null);
    const result = await importExternalPlaylist(importUrl.trim(), user || undefined, (done, total) => setImportProgress([done, total]));
    setImportLoading(false);
    setImportProgress(null);

    if (result.success && result.playlist) {
      if (typeof result.total === 'number' && typeof result.matched === 'number') {
        showGlobalToast(`«${result.playlist.name}»: ${result.matched} de ${result.total} canciones encontradas`);
      }
      if (onImportPlaylist) onImportPlaylist(result.playlist);
      else useSpotifyDataStore.getState().addCustomPlaylist(result.playlist);
      setImportUrl('');
      onClose();
    } else {
      setImportError(result.error || 'No se pudo importar la playlist.');
    }
  };

  const pasteLink = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setImportUrl(text.trim());
    } catch {
      setImportError('No se pudo leer el portapapeles. Mantén pulsado el campo y elige «Pegar».');
    }
  };

  // ------------------------------------------------------------------ full-screen steps
  if (viewMode !== 'menu') {
    const isNaming = viewMode === 'naming';
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col select-none font-['SpotifyMixUI'] animate-in fade-in duration-200"
        style={{ background: 'linear-gradient(180deg, #535353 0%, #282828 45%, #121212 100%)' }}
      >
        <form
          onSubmit={isNaming ? handleSubmitPlaylist : handleImportSubmit}
          className="flex-1 flex flex-col justify-center px-6 pt-[env(safe-area-inset-top,0px)] pb-[calc(env(safe-area-inset-bottom,0px)+24px)]"
        >
          <h2 className="text-[24px] font-bold text-white text-center font-['SpotifyMixUITitle'] tracking-tight">
            {isNaming ? 'Ponle nombre a tu playlist' : 'Importar playlist'}
          </h2>

          {isNaming ? (
            <div className="mt-8 border-b border-white/70 focus-within:border-white">
              <input
                type="text"
                autoFocus
                value={playlistName}
                onChange={(e) => setPlaylistName(e.target.value)}
                onFocus={(e) => e.currentTarget.select()}
                maxLength={100}
                className="w-full bg-transparent pb-2 text-white text-[32px] leading-tight outline-none text-center font-bold tracking-tight"
                placeholder="Mi playlist"
              />
            </div>
          ) : (
            <>
              <p className="mt-2 text-[14px] text-[#b3b3b3] text-center leading-snug">
                Pega el enlace de una playlist o escribe canciones, una por línea («Canción - Artista»).
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {IMPORT_SOURCES.map((s) => (
                  <span key={s} className="px-3 py-1 rounded-full bg-white/10 text-[12px] font-bold text-white/90">
                    {s}
                  </span>
                ))}
              </div>
              <div className="mt-6 rounded-md bg-white/10 focus-within:bg-white/[0.14] transition-colors">
                <textarea
                  autoFocus
                  rows={3}
                  value={importUrl}
                  onChange={(e) => setImportUrl(e.target.value)}
                  disabled={importLoading}
                  className="block w-full resize-none bg-transparent px-3.5 pt-3 pb-1 text-[15px] text-white outline-none placeholder:text-white/40"
                  placeholder="https://music.youtube.com/playlist?list=…"
                />
                <div className="flex justify-end px-2 pb-2">
                  <button
                    type="button"
                    onClick={() => void pasteLink()}
                    disabled={importLoading}
                    className="flex items-center gap-1.5 h-8 px-3 rounded-full text-[13px] font-bold text-white hover:bg-white/10 active:scale-95 transition-transform disabled:opacity-40"
                  >
                    <PasteNativeIcon size={15} />
                    Pegar
                  </button>
                </div>
              </div>
              {importLoading && (
                <div className="mt-4 space-y-1.5">
                  <div className="h-1 w-full rounded-full bg-white/20 overflow-hidden">
                    <div
                      className="h-full bg-[#1ed760] transition-all duration-300"
                      style={{ width: importProgress ? `${(importProgress[0] / Math.max(1, importProgress[1])) * 100}%` : '6%' }}
                    />
                  </div>
                  <p className="text-[13px] text-[#b3b3b3] text-center tabular-nums">
                    {importProgress ? `Buscando canciones ${importProgress[0]} de ${importProgress[1]}` : 'Leyendo la playlist…'}
                  </p>
                </div>
              )}
              {importError && <p className="mt-3 text-[13px] text-[#f3727f] text-center font-medium">{importError}</p>}
            </>
          )}

          <div className="mt-10 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setViewMode('menu')}
              disabled={importLoading}
              className="h-12 px-7 rounded-full border border-[#7c7c7c] text-white font-bold text-[15px] hover:border-white active:scale-95 transition-all disabled:opacity-40"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!isNaming && (importLoading || !importUrl.trim())}
              className="h-12 px-8 rounded-full bg-[#1ed760] text-black font-bold text-[15px] hover:bg-[#3be477] active:scale-95 transition-all disabled:opacity-50"
            >
              {isNaming ? 'Crear' : importLoading ? 'Importando…' : 'Importar'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  // ------------------------------------------------------------------ the sheet
  const Option = ({
    icon,
    title,
    subtitle,
    onClick,
  }: {
    icon: React.ReactNode;
    title: string;
    subtitle: string;
    onClick: () => void;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-4 px-4 py-3 text-left active:bg-white/10 transition-colors"
    >
      <span className="w-12 h-12 rounded-full bg-[#3e3e3e] flex items-center justify-center text-white shrink-0">{icon}</span>
      <span className="min-w-0">
        <span className="block text-[16px] font-bold text-white leading-tight">{title}</span>
        <span className="block text-[14px] text-[#b3b3b3] leading-snug mt-0.5">{subtitle}</span>
      </span>
    </button>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 animate-in fade-in duration-200 select-none font-['SpotifyMixUI']"
      onClick={onClose}
    >
      <div
        className="w-full bg-[#282828] rounded-t-xl pt-1 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] animate-slide-up-modal touch-pan-y"
        style={{
          transform: `translateY(${dragY}px)`,
          transition: isDragging ? 'none' : 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Crear"
      >
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="w-full py-3 flex items-center justify-center"
        >
          <div className="w-9 h-1 rounded-full bg-white/30" />
        </div>
        <Option
          icon={<PlaylistNoteNativeIcon size={24} />}
          title="Playlist"
          subtitle="Crea una playlist con canciones"
          onClick={() => setViewMode('naming')}
        />
        <Option
          icon={<ImportNativeIcon size={24} />}
          title="Importar playlist"
          subtitle="Desde YouTube Music, YouTube, Apple Music o Spotify"
          onClick={() => {
            setImportError(null);
            setViewMode('importing');
          }}
        />
        <Option
          icon={<FriendsNativeIcon size={24} className="currentColor" />}
          title="Escuchar juntos"
          subtitle="Pon música con tus amigos en tiempo real"
          onClick={() => {
            onClose();
            useSharedSessionStore.getState().setModalOpen(true);
          }}
        />
      </div>
    </div>
  );
};
