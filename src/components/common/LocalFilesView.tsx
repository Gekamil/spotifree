/**
 * "Archivos locales & Descargas": the user's own songs, device audio, and offline downloads.
 * Organised in authentic Spotify-style folders and subfolders.
 * Plays completely offline in airplane mode without any connection.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Track } from '../../types/spotify';
import { usePlayerStore } from '../../store/usePlayerStore';
import {
  LOCAL_FILES_EVENT,
  LOCAL_FILES_PLAYLIST_ID,
  addLocalFiles,
  getLocalFilesSize,
  listLocalTracks,
  removeLocalTrack,
} from '../../utils/localFiles';
import { formatDuration } from '../../utils/formatters';
import {
  DEVICE_PREFIX,
  devicePermissionGranted,
  deviceTracks,
  isDeviceMusicAvailable,
  scanDeviceMusic,
} from '../../utils/nativeLocalMusic';
import { getDownloadedTracks, onDownloadsChanged } from '../../utils/offlineStorage';
import {
  type DownloadFolder,
  createDownloadFolder,
  deleteDownloadFolder,
  getDownloadFolders,
  getTrackFolderId,
  moveTrackToFolder,
  onFoldersChanged,
  renameDownloadFolder,
} from '../../utils/downloadFolders';
import { MobileSheet, SheetHeader, SheetItem, SheetList } from '../mobile/MobileSheet';

export const LOCAL_FILES_COVER_GRADIENT = 'linear-gradient(135deg, #1e3264 0%, #1ed760 100%)';

/** Cover of "Archivos locales": a folder with a note, on Spotify colours */
export const LocalFilesCover: React.FC<{ size?: number; className?: string }> = ({ size = 48, className = '' }) => (
  <div
    className={`flex items-center justify-center shrink-0 shadow ${className}`}
    style={{ width: size, height: size, background: LOCAL_FILES_COVER_GRADIENT }}
  >
    <svg width={size * 0.46} height={size * 0.46} viewBox="0 0 24 24" fill="white" aria-hidden="true">
      <path d="M3 5a2 2 0 0 1 2-2h4.6l2 2H19a2 2 0 0 1 2 2v1H3zm-0 4h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zm11 2v4.27A2 2 0 1 0 15 17v-4h2v-2z" />
    </svg>
  </div>
);

const NoteIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
  </svg>
);

const FolderIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
  </svg>
);

const PhoneIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17 1.01L7 1c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99zM17 19H7V5h10v14z" />
  </svg>
);

const DownloadIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
  </svg>
);

function formatSize(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  return `${Math.max(0.1, bytes / 1024 ** 2).toFixed(1)} MB`;
}

interface LocalFilesViewProps {
  onBack?: () => void;
  isMobile?: boolean;
}

export const LocalFilesView: React.FC<LocalFilesViewProps> = ({ onBack, isMobile = false }) => {
  const onDevice = isDeviceMusicAvailable();
  const [imported, setImported] = useState<Track[]>([]);
  const [phoneTracks, setPhoneTracks] = useState<Track[]>(() => (onDevice ? deviceTracks() : []));
  const [downloaded, setDownloaded] = useState<Track[]>(() => getDownloadedTracks());
  const [folders, setFolders] = useState<DownloadFolder[]>(() => getDownloadFolders());
  const [selectedFolderId, setSelectedFolderId] = useState<string>('all');
  const [folderVersion, setFolderVersion] = useState(0);

  const [needsPermission, setNeedsPermission] = useState(false);
  const [scanningPhone, setScanningPhone] = useState(false);
  const folderRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [loaded, setLoaded] = useState(false);
  const [sizeBytes, setSizeBytes] = useState(0);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Modals / Sheet state
  const [menuTrack, setMenuTrack] = useState<Track | null>(null);
  const [movingTrack, setMovingTrack] = useState<Track | null>(null);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renamingFolder, setRenamingFolder] = useState<DownloadFolder | null>(null);
  const [renameInput, setRenameInput] = useState('');

  const { currentTrack, isPlaying, playTrack, togglePlay, addToQueue } = usePlayerStore(
    useShallow((s) => ({
      currentTrack: s.currentTrack,
      isPlaying: s.isPlaying,
      playTrack: s.playTrack,
      togglePlay: s.togglePlay,
      addToQueue: s.addToQueue,
    }))
  );

  // All combined offline tracks deduplicated by ID
  const allTracks = useMemo(() => {
    const map = new Map<string, Track>();
    // 1. Device music
    for (const t of phoneTracks) map.set(t.id, t);
    // 2. Browser local imported tracks
    for (const t of imported) map.set(t.id, t);
    // 3. Online downloaded tracks
    for (const t of downloaded) {
      if (!map.has(t.id)) map.set(t.id, t);
    }
    return Array.from(map.values());
  }, [phoneTracks, imported, downloaded]);

  // Current folder's tracks
  const displayedTracks = useMemo(() => {
    if (selectedFolderId === 'all') return allTracks;
    return allTracks.filter((t) => getTrackFolderId(t.id) === selectedFolderId);
  }, [allTracks, selectedFolderId, folderVersion]);

  // Count tracks per folder for badge display
  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = { all: allTracks.length };
    for (const f of folders) counts[f.id] = 0;
    for (const t of allTracks) {
      const fId = getTrackFolderId(t.id);
      counts[fId] = (counts[fId] || 0) + 1;
    }
    return counts;
  }, [allTracks, folders, folderVersion]);

  const refresh = async () => {
    const [list, size] = await Promise.all([listLocalTracks(), getLocalFilesSize()]);
    setImported(list);
    setSizeBytes(size);
    if (onDevice) setPhoneTracks(deviceTracks());
    setDownloaded(getDownloadedTracks());
    setFolders(getDownloadFolders());
    setLoaded(true);
  };

  const scanPhone = async (request: boolean) => {
    setScanningPhone(true);
    const ok = await scanDeviceMusic(request);
    setScanningPhone(false);
    setNeedsPermission(!ok && devicePermissionGranted() === false);
    if (ok) {
      setPhoneTracks(deviceTracks());
      showToast('Música del móvil sincronizada');
    }
  };

  useEffect(() => {
    void refresh();
    if (onDevice) void scanPhone(false);

    const onLocal = () => void refresh();
    const onDown = () => {
      setDownloaded(getDownloadedTracks());
      setFolderVersion((v) => v + 1);
    };
    const onFolders = () => {
      setFolders(getDownloadFolders());
      setFolderVersion((v) => v + 1);
    };
    const onOpenMove = (e: any) => {
      if (e.detail?.track) {
        setMovingTrack(e.detail.track);
      }
    };

    window.addEventListener(LOCAL_FILES_EVENT, onLocal);
    window.addEventListener('spotifree:open-move-folder', onOpenMove);
    const unDownloads = onDownloadsChanged(onDown);
    const unFolders = onFoldersChanged(onFolders);

    return () => {
      window.removeEventListener(LOCAL_FILES_EVENT, onLocal);
      window.removeEventListener('spotifree:open-move-folder', onOpenMove);
      unDownloads();
      unFolders();
    };
  }, []);

  const showToast = (msg: string, ms = 2600) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), ms);
  };

  const onFiles = async (list: FileList | null) => {
    const files = Array.from(list || []);
    if (inputRef.current) inputRef.current.value = '';
    if (folderRef.current) folderRef.current.value = '';
    if (!files.length) return;
    setProgress({ done: 0, total: files.length });
    const res = await addLocalFiles(files, (done, total) => setProgress({ done, total }));
    setProgress(null);
    if (res.added === 0) showToast('Esos archivos no son de audio');
    else showToast(res.added === 1 ? 'Canción añadida' : `${res.added} canciones añadidas`);
  };

  const isThisContextPlaying = Boolean(currentTrack && displayedTracks.some((t) => t.id === currentTrack.id));

  const playAll = (shuffle = false) => {
    if (!displayedTracks.length) return;
    if (isThisContextPlaying && !shuffle) {
      togglePlay();
      return;
    }
    const list = shuffle ? [...displayedTracks].sort(() => Math.random() - 0.5) : displayedTracks;
    playTrack(list[0], list, LOCAL_FILES_PLAYLIST_ID);
  };

  const playOne = (t: Track) => {
    if (currentTrack?.id === t.id) togglePlay();
    else playTrack(t, displayedTracks, LOCAL_FILES_PLAYLIST_ID);
  };

  const handleCreateFolder = () => {
    const name = newFolderName.trim();
    if (!name) return;
    const created = createDownloadFolder(name);
    setNewFolderName('');
    setIsCreatingFolder(false);
    showToast(`Carpeta «${created.name}» creada`);

    // If we were moving a track, assign it directly to the newly created folder
    if (movingTrack) {
      moveTrackToFolder(movingTrack.id, created.id);
      setMovingTrack(null);
      showToast(`«${movingTrack.name}» movida a «${created.name}»`);
    } else {
      setSelectedFolderId(created.id);
    }
  };

  const handleRenameFolder = () => {
    if (!renamingFolder) return;
    const name = renameInput.trim();
    if (!name) return;
    const ok = renameDownloadFolder(renamingFolder.id, name);
    if (ok) showToast('Carpeta renombrada');
    setRenamingFolder(null);
    setRenameInput('');
  };

  const handleDeleteFolder = (folder: DownloadFolder) => {
    if (folder.isDefault) return;
    if (window.confirm(`¿Eliminar la subcarpeta «${folder.name}»? Las canciones volverán a su carpeta original.`)) {
      deleteDownloadFolder(folder.id);
      if (selectedFolderId === folder.id) setSelectedFolderId('all');
      showToast('Carpeta eliminada');
    }
  };

  const handleMoveTrack = (targetFolderId: string) => {
    if (!movingTrack) return;
    const targetFolder = folders.find((f) => f.id === targetFolderId);
    moveTrackToFolder(movingTrack.id, targetFolderId);
    showToast(`Movida a «${targetFolder?.name || 'carpeta'}»`);
    setMovingTrack(null);
    setMenuTrack(null);
    setFolderVersion((v) => v + 1);
  };

  const activeFolder = folders.find((f) => f.id === selectedFolderId);

  const cover = (t: Track, size: string) =>
    t.album?.images?.[0]?.url ? (
      <img src={t.album.images[0].url} alt="" className={`${size} rounded object-cover shrink-0 bg-[#282828]`} />
    ) : (
      <div className={`${size} rounded shrink-0 bg-[#282828] text-[#7a7a7a] flex items-center justify-center`}>
        <NoteIcon />
      </div>
    );

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept="audio/*,.mp3,.m4a,.aac,.flac,.ogg,.opus,.wav"
      multiple
      className="hidden"
      onChange={(e) => void onFiles(e.target.files)}
    />
  );

  const folderInput = (
    <input
      ref={(el) => {
        folderRef.current = el;
        if (el) {
          el.setAttribute('webkitdirectory', '');
          el.setAttribute('directory', '');
        }
      }}
      type="file"
      multiple
      className="hidden"
      onChange={(e) => void onFiles(e.target.files)}
    />
  );

  return (
    <div className="min-h-full text-white font-['SpotifyMixUI'] select-none pb-20">
      {fileInput}
      {folderInput}

      {/* Header */}
      <div
        className={`${isMobile ? 'px-4 pt-3 pb-5' : 'px-6 pt-16 pb-6'}`}
        style={{ background: 'linear-gradient(180deg, #1e3264 0%, #152244 55%, #121212 100%)' }}
      >
        {isMobile && onBack && (
          <button
            onClick={onBack}
            className="w-9 h-9 -ml-1.5 mb-3 flex items-center justify-center rounded-full active:bg-black/20 cursor-pointer"
            aria-label="Volver"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.957 2.793a1 1 0 0 1 0 1.414L8.164 12l7.793 7.793a1 1 0 1 1-1.414 1.414L5.336 12l9.207-9.207a1 1 0 0 1 1.414 0z" />
            </svg>
          </button>
        )}
        <div className={`flex ${isMobile ? 'flex-col items-center text-center' : 'items-end gap-6'}`}>
          <LocalFilesCover size={isMobile ? 180 : 220} className="rounded-md shadow-[0_8px_40px_rgba(0,0,0,0.6)]" />
          <div className={`${isMobile ? 'mt-5 w-full text-left' : ''}`}>
            {!isMobile && <p className="text-sm font-bold uppercase tracking-wider text-white/70">Biblioteca sin conexión</p>}
            <h1 className={`font-black tracking-tight font-['SpotifyMixUITitle'] ${isMobile ? 'text-2xl' : 'text-6xl my-2'}`}>
              {selectedFolderId === 'all'
                ? 'Descargas y Archivos'
                : activeFolder?.name || 'Archivos locales'}
            </h1>
            <p className="text-sm text-white/70 mt-1 flex flex-wrap items-center gap-1.5">
              <span>{displayedTracks.length} {displayedTracks.length === 1 ? 'canción' : 'canciones'}</span>
              <span>•</span>
              <span>Suenan en modo avión</span>
              {phoneTracks.length > 0 && selectedFolderId === 'all' && (
                <>
                  <span>•</span>
                  <span>{phoneTracks.length} del móvil</span>
                </>
              )}
              {downloaded.length > 0 && selectedFolderId === 'all' && (
                <>
                  <span>•</span>
                  <span>{downloaded.length} descargas</span>
                </>
              )}
              {sizeBytes > 0 && (
                <>
                  <span>•</span>
                  <span>{formatSize(sizeBytes)} guardados</span>
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Main Controls: Play, Shuffle, Add */}
      <div className={`flex items-center gap-4 ${isMobile ? 'px-4 py-3' : 'px-6 py-4'}`}>
        <button
          onClick={() => playAll(false)}
          disabled={!displayedTracks.length}
          className="w-14 h-14 rounded-full bg-[#1ed760] text-black flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-transform disabled:opacity-40 cursor-pointer"
          aria-label={isThisContextPlaying && isPlaying ? 'Pausar' : 'Reproducir'}
        >
          {isThisContextPlaying && isPlaying ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M5.7 3a.7.7 0 0 0-.7.7v16.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V3.7a.7.7 0 0 0-.7-.7zm10 0a.7.7 0 0 0-.7.7v16.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V3.7a.7.7 0 0 0-.7-.7z" />
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="m7.05 3.606 13.49 7.788a.7.7 0 0 1 0 1.212L7.05 20.394A.7.7 0 0 1 6 19.788V4.212a.7.7 0 0 1 1.05-.606" />
            </svg>
          )}
        </button>
        <button
          onClick={() => playAll(true)}
          disabled={!displayedTracks.length}
          className="w-10 h-10 flex items-center justify-center text-[#b3b3b3] hover:text-white disabled:opacity-40 cursor-pointer active:scale-90 transition-all"
          aria-label="Reproducir en aleatorio"
        >
          <svg width="22" height="22" viewBox="0 0 16 16" fill="currentColor">
            <path d="M13.151.922a.75.75 0 1 0-1.06 1.06L13.109 3H11.16a3.75 3.75 0 0 0-2.873 1.34l-6.173 7.356A2.25 2.25 0 0 1 .39 12.5H0V14h.391a3.75 3.75 0 0 0 2.873-1.34l6.173-7.356a2.25 2.25 0 0 1 1.724-.804h1.947l-1.017 1.018a.75.75 0 0 0 1.06 1.06L15.98 3.75zM.391 3.5H0V2h.391c1.109 0 2.16.49 2.873 1.34L4.89 5.277l-.979 1.167-1.796-2.14A2.25 2.25 0 0 0 .39 3.5z" />
            <path d="m7.5 10.723.98-1.167.957 1.14a2.25 2.25 0 0 0 1.724.804h1.947l-1.017-1.018a.75.75 0 1 1 1.06-1.06l2.829 2.828-2.829 2.828a.75.75 0 1 1-1.06-1.06L13.109 13H11.16a3.75 3.75 0 0 1-2.873-1.34l-.787-.938z" />
          </svg>
        </button>

        <div className="flex-1" />

        {/* Custom Folder Actions (Rename / Delete) */}
        {activeFolder && !activeFolder.isDefault && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setRenamingFolder(activeFolder);
                setRenameInput(activeFolder.name);
              }}
              className="h-8 px-3 rounded-full text-xs font-semibold border border-white/20 hover:border-white text-white/80 hover:text-white flex items-center gap-1.5 transition-all cursor-pointer"
            >
              Renombrar
            </button>
            <button
              onClick={() => handleDeleteFolder(activeFolder)}
              className="h-8 px-3 rounded-full text-xs font-semibold border border-red-500/40 hover:border-red-400 text-red-400 hover:text-red-300 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              Eliminar
            </button>
          </div>
        )}

        {/* Add audio files / folder */}
        <button
          onClick={() => inputRef.current?.click()}
          className="h-9 px-4 rounded-full text-xs font-bold flex items-center gap-2 cursor-pointer active:scale-95 transition-all border border-[#7c7c7c] text-white hover:border-white"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M15.25 8a.75.75 0 0 1-.75.75H8.75v5.75a.75.75 0 0 1-1.5 0V8.75H1.5a.75.75 0 0 1 0-1.5h5.75V1.5a.75.75 0 0 1 1.5 0v5.75h5.75a.75.75 0 0 1 .75.75" />
          </svg>
          Añadir audio
        </button>
      </div>

      {/* Spotify-style Subfolders Horizontal Filter Bar */}
      <div className={`overflow-x-auto no-scrollbar py-2 ${isMobile ? 'px-4' : 'px-6'}`}>
        <div className="flex items-center gap-2 min-w-max pb-1">
          {/* Todas */}
          <button
            onClick={() => setSelectedFolderId('all')}
            className={`h-8 px-3.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              selectedFolderId === 'all'
                ? 'bg-white text-black font-black shadow-md'
                : 'bg-[#242424] text-white/80 hover:text-white hover:bg-[#2e2e2e]'
            }`}
          >
            Todas ({folderCounts.all || 0})
          </button>

          {/* Folder Chips */}
          {folders.map((f) => {
            const isSelected = selectedFolderId === f.id;
            const count = folderCounts[f.id] || 0;
            return (
              <button
                key={f.id}
                onClick={() => setSelectedFolderId(f.id)}
                className={`h-8 px-3.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? 'bg-[#1ed760] text-black font-black shadow-md'
                    : 'bg-[#242424] text-white/80 hover:text-white hover:bg-[#2e2e2e]'
                }`}
              >
                {f.type === 'device' && <PhoneIcon className="w-3.5 h-3.5" />}
                {f.type === 'downloads' && <DownloadIcon className="w-3.5 h-3.5" />}
                {f.type === 'custom' && <FolderIcon className="w-3.5 h-3.5" />}
                <span>{f.name}</span>
                <span className={`text-[11px] opacity-75 font-normal ml-0.5`}>({count})</span>
              </button>
            );
          })}

          {/* + Nueva Carpeta */}
          <button
            onClick={() => {
              setNewFolderName('');
              setIsCreatingFolder(true);
            }}
            className="h-8 px-3.5 rounded-full text-xs font-bold bg-[#242424] text-[#1ed760] hover:bg-[#2e2e2e] border border-[#1ed760]/30 hover:border-[#1ed760] transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M15.25 8a.75.75 0 0 1-.75.75H8.75v5.75a.75.75 0 0 1-1.5 0V8.75H1.5a.75.75 0 0 1 0-1.5h5.75V1.5a.75.75 0 0 1 1.5 0v5.75h5.75a.75.75 0 0 1 .75.75" />
            </svg>
            Nueva carpeta
          </button>
        </div>
      </div>

      {/* APK: device permission banner */}
      {onDevice && needsPermission && (
        <div className={`${isMobile ? 'mx-4' : 'mx-6'} my-3 rounded-lg bg-[#242424] p-4 flex items-center gap-4 spf-page-enter border border-white/10`}>
          <div className="w-11 h-11 rounded-full bg-[#1ed760] text-black flex items-center justify-center shrink-0">
            <PhoneIcon className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold">Muestra la música de tu móvil</p>
            <p className="text-xs text-[#a7a7a7] leading-snug mt-0.5">
              Se guardan organizadas en «Música del dispositivo» y suenan sin conexión en modo avión.
            </p>
          </div>
          <button
            onClick={() => void scanPhone(true)}
            className="h-8 px-4 rounded-full bg-white text-black text-xs font-bold shrink-0 active:scale-95 cursor-pointer"
          >
            Permitir
          </button>
        </div>
      )}

      {/* APK: scanning in progress */}
      {onDevice && scanningPhone && phoneTracks.length === 0 && (
        <p className={`${isMobile ? 'px-4' : 'px-6'} pb-2 text-xs text-[#a7a7a7]`}>
          Buscando música en tu móvil…
        </p>
      )}

      {/* Progress bar when adding files */}
      {progress && (
        <div className={`${isMobile ? 'mx-4' : 'mx-6'} mb-3 rounded-lg bg-[#242424] p-3`}>
          <p className="text-sm font-bold">
            Añadiendo canciones ({progress.done}/{progress.total})…
          </p>
          <div className="mt-2 h-1 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full bg-[#1ed760] transition-all"
              style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Empty folder / empty library state */}
      {loaded && displayedTracks.length === 0 && !progress ? (
        <div className="px-8 py-16 flex flex-col items-center text-center spf-page-enter">
          <div className="w-16 h-16 rounded-full bg-[#242424] text-white/50 flex items-center justify-center mb-4">
            <FolderIcon className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold font-['SpotifyMixUITitle']">
            {selectedFolderId === 'all'
              ? 'Tu música sin conexión aparecerá aquí'
              : `La carpeta «${activeFolder?.name}» está vacía`}
          </h2>
          <p className="mt-2 text-sm text-[#a7a7a7] max-w-sm leading-relaxed">
            {selectedFolderId === 'all'
              ? 'Descarga canciones desde cualquier playlist o añade archivos de audio de tu dispositivo para escucharlos sin conexión.'
              : 'Puedes mover canciones a esta carpeta pulsando en los tres puntos de cualquier pista.'}
          </p>
          <div className="mt-6 flex items-center gap-3 flex-wrap justify-center">
            <button
              onClick={() => inputRef.current?.click()}
              className="h-10 px-5 rounded-full bg-white text-black font-bold text-xs hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              Añadir archivos
            </button>
            {selectedFolderId !== 'all' && (
              <button
                onClick={() => setSelectedFolderId('all')}
                className="h-10 px-5 rounded-full border border-white/20 hover:border-white text-white font-bold text-xs transition-all cursor-pointer"
              >
                Ver todas las canciones
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Track List */
        <div className={`${isMobile ? 'px-2' : 'px-4'} mt-2`}>
          {!isMobile && displayedTracks.length > 0 && (
            <div className="grid grid-cols-[16px_1fr_1fr_120px_72px] gap-4 px-4 py-2 mb-2 border-b border-white/10 text-xs font-semibold uppercase tracking-wider text-[#a7a7a7]">
              <span>#</span>
              <span>Título</span>
              <span>Álbum / Origen</span>
              <span>Carpeta</span>
              <span className="text-right">Duración</span>
            </div>
          )}

          {displayedTracks.map((t, i) => {
            const active = currentTrack?.id === t.id;
            const artist = t.artists?.[0]?.name || 'Artista desconocido';
            const trackFolderId = getTrackFolderId(t.id);
            const trackFolder = folders.find((f) => f.id === trackFolderId);

            return isMobile ? (
              /* Mobile Track Row */
              <div
                key={t.id}
                className="flex items-center gap-3 px-2 py-2 rounded-md active:bg-white/10 transition-colors"
                onClick={() => playOne(t)}
              >
                {cover(t, 'w-12 h-12')}
                <div className="flex-1 min-w-0">
                  <p className={`text-[15px] font-medium truncate ${active ? 'text-[#1ed760]' : 'text-white'}`}>
                    {t.name}
                  </p>
                  <p className="text-[13px] text-[#a7a7a7] truncate flex items-center gap-1.5 mt-0.5">
                    <span>{artist}</span>
                    {selectedFolderId === 'all' && trackFolder && (
                      <span className="px-1.5 py-0.2 rounded bg-white/10 text-[10px] text-white/80 font-normal">
                        {trackFolder.name}
                      </span>
                    )}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuTrack(t);
                  }}
                  className="w-10 h-10 flex items-center justify-center text-[#a7a7a7] hover:text-white cursor-pointer active:scale-90"
                  aria-label="Opciones"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4m0 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4m0 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4" />
                  </svg>
                </button>
              </div>
            ) : (
              /* Desktop Track Row */
              <div
                key={t.id}
                onDoubleClick={() => playOne(t)}
                className="group grid grid-cols-[16px_1fr_1fr_120px_72px] gap-4 items-center px-4 py-2 rounded-md hover:bg-white/10 transition-colors"
              >
                <button
                  onClick={() => playOne(t)}
                  className={`text-sm tabular-nums cursor-pointer ${active ? 'text-[#1ed760]' : 'text-[#a7a7a7]'}`}
                >
                  <span className="group-hover:hidden">{i + 1}</span>
                  <svg className="hidden group-hover:block text-white" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M3 1.713a.7.7 0 0 1 1.05-.607l10.89 6.288a.7.7 0 0 1 0 1.212L4.05 14.894A.7.7 0 0 1 3 14.288z" />
                  </svg>
                </button>

                <div className="flex items-center gap-3 min-w-0">
                  {cover(t, 'w-10 h-10')}
                  <div className="min-w-0">
                    <p className={`text-sm font-medium truncate ${active ? 'text-[#1ed760]' : 'text-white'}`}>{t.name}</p>
                    <p className="text-xs text-[#a7a7a7] truncate">{artist}</p>
                  </div>
                </div>

                <p className="text-xs text-[#a7a7a7] truncate">{t.album?.name || 'Archivo local'}</p>

                {/* Folder indicator & Quick move button */}
                <div className="flex items-center">
                  <button
                    onClick={() => setMovingTrack(t)}
                    title="Mover a otra carpeta"
                    className="text-xs px-2 py-0.5 rounded-full bg-white/5 group-hover:bg-white/15 text-white/80 group-hover:text-white flex items-center gap-1.5 transition-all truncate cursor-pointer hover:border-white/30 border border-transparent"
                  >
                    <FolderIcon className="w-3 h-3 text-[#1ed760] shrink-0" />
                    <span className="truncate">{trackFolder?.name || 'Carpeta'}</span>
                  </button>
                </div>

                <div className="flex items-center justify-end gap-3">
                  <button
                    onClick={() => setMovingTrack(t)}
                    className="opacity-0 group-hover:opacity-100 text-[#a7a7a7] hover:text-white transition-opacity cursor-pointer"
                    title="Mover a carpeta…"
                  >
                    <FolderIcon className="w-4 h-4" />
                  </button>
                  <span className="text-xs text-[#a7a7a7] tabular-nums">{formatDuration(t.duration_ms)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Track Menu Sheet (Mobile) */}
      <MobileSheet open={!!menuTrack} onClose={() => setMenuTrack(null)}>
        {menuTrack && (
          <>
            <SheetHeader image={menuTrack.album?.images?.[0]?.url} title={menuTrack.name} subtitle={menuTrack.artists?.[0]?.name} />
            <SheetList>
              <SheetItem
                icon={
                  <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M15 15H1v-1.5h14zm0-4.5H1V9h14zm-14-7A2.5 2.5 0 0 1 3.5 1h9a2.5 2.5 0 0 1 0 5h-9A2.5 2.5 0 0 1 1 3.5m2.5-1a1 1 0 0 0 0 2h9a1 1 0 1 0 0-2z" />
                  </svg>
                }
                label="Añadir a la cola"
                onClick={() => {
                  addToQueue(menuTrack);
                  setMenuTrack(null);
                  showToast('Añadida a la cola');
                }}
              />
              <SheetItem
                icon={<FolderIcon className="w-5 h-5 text-[#1ed760]" />}
                label="Mover a carpeta…"
                sublabel={`Actualmente en «${folders.find((f) => f.id === getTrackFolderId(menuTrack.id))?.name || 'Música'}»`}
                onClick={() => {
                  const t = menuTrack;
                  setMenuTrack(null);
                  setMovingTrack(t);
                }}
              />
              {!menuTrack.id.startsWith(DEVICE_PREFIX) && (
                <SheetItem
                  danger
                  icon={
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                    </svg>
                  }
                  label="Eliminar de este dispositivo"
                  onClick={() => {
                    const id = menuTrack.id;
                    setMenuTrack(null);
                    void removeLocalTrack(id).then(() => showToast('Eliminada'));
                  }}
                />
              )}
            </SheetList>
          </>
        )}
      </MobileSheet>

      {/* Move Track to Folder Sheet / Dialog */}
      <MobileSheet open={!!movingTrack} onClose={() => setMovingTrack(null)}>
        {movingTrack && (
          <div className="pb-4">
            <div className="px-5 pt-3 pb-2 border-b border-white/10">
              <p className="text-xs text-[#a7a7a7] uppercase tracking-wider font-semibold">Mover canción a…</p>
              <h3 className="text-base font-bold text-white truncate mt-0.5">{movingTrack.name}</h3>
            </div>
            <SheetList>
              {folders.map((f) => {
                const isCurrent = getTrackFolderId(movingTrack.id) === f.id;
                return (
                  <SheetItem
                    key={f.id}
                    icon={
                      f.type === 'device' ? (
                        <PhoneIcon className="w-5 h-5 text-white/70" />
                      ) : f.type === 'downloads' ? (
                        <DownloadIcon className="w-5 h-5 text-white/70" />
                      ) : (
                        <FolderIcon className="w-5 h-5 text-white/70" />
                      )
                    }
                    label={f.name}
                    sublabel={isCurrent ? 'Carpeta actual' : undefined}
                    onClick={() => handleMoveTrack(f.id)}
                  />
                );
              })}
              <SheetItem
                icon={
                  <div className="w-5 h-5 rounded-full border border-[#1ed760] flex items-center justify-center text-[#1ed760]">
                    +
                  </div>
                }
                label="Crear nueva subcarpeta"
                onClick={() => {
                  setNewFolderName('');
                  setIsCreatingFolder(true);
                }}
              />
            </SheetList>
          </div>
        )}
      </MobileSheet>

      {/* Create New Folder Modal Dialog */}
      {isCreatingFolder && (
        <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#282828] w-full max-w-sm rounded-xl p-6 shadow-2xl border border-white/10 text-white">
            <h3 className="text-xl font-bold font-['SpotifyMixUITitle']">Nueva subcarpeta</h3>
            <p className="text-xs text-[#a7a7a7] mt-1">
              Ponle un nombre para organizar tus descargas y audios locales.
            </p>
            <input
              type="text"
              autoFocus
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateFolder();
                if (e.key === 'Escape') setIsCreatingFolder(false);
              }}
              placeholder="Ej. Gimnasio, Carretera, Favoritas..."
              className="w-full mt-4 h-11 px-3.5 rounded-lg bg-[#3e3e3e] border border-transparent focus:border-[#1ed760] text-sm text-white placeholder-white/40 outline-none transition-all"
            />
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setIsCreatingFolder(false)}
                className="px-4 py-2 rounded-full text-xs font-bold text-white/70 hover:text-white transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateFolder}
                disabled={!newFolderName.trim()}
                className="px-5 py-2 rounded-full bg-[#1ed760] disabled:opacity-40 text-black text-xs font-black hover:scale-105 active:scale-95 transition-all cursor-pointer"
              >
                Crear carpeta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Folder Modal Dialog */}
      {renamingFolder && (
        <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#282828] w-full max-w-sm rounded-xl p-6 shadow-2xl border border-white/10 text-white">
            <h3 className="text-xl font-bold font-['SpotifyMixUITitle']">Renombrar carpeta</h3>
            <input
              type="text"
              autoFocus
              value={renameInput}
              onChange={(e) => setRenameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameFolder();
                if (e.key === 'Escape') setRenamingFolder(null);
              }}
              className="w-full mt-4 h-11 px-3.5 rounded-lg bg-[#3e3e3e] border border-transparent focus:border-[#1ed760] text-sm text-white placeholder-white/40 outline-none transition-all"
            />
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setRenamingFolder(null)}
                className="px-4 py-2 rounded-full text-xs font-bold text-white/70 hover:text-white transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleRenameFolder}
                disabled={!renameInput.trim()}
                className="px-5 py-2 rounded-full bg-[#1ed760] disabled:opacity-40 text-black text-xs font-black hover:scale-105 active:scale-95 transition-all cursor-pointer"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[250] px-4 py-2.5 rounded-full bg-white text-black text-xs font-bold shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200">
          {toast}
        </div>
      )}
    </div>
  );
};

export default LocalFilesView;
