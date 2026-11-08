/**
 * "Archivos locales": the user's own songs, stored inside the app. They play without any
 * connection (airplane mode included). Same page on the phone and on the computer.
 */
import React, { useEffect, useRef, useState } from 'react';
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

function formatSize(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  return `${Math.max(0.1, bytes / 1024 ** 2).toFixed(1)} MB`;
}

interface LocalFilesViewProps {
  onBack?: () => void;
  isMobile?: boolean;
}

export const LocalFilesView: React.FC<LocalFilesViewProps> = ({ onBack, isMobile = false }) => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [sizeBytes, setSizeBytes] = useState(0);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [menuTrack, setMenuTrack] = useState<Track | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { currentTrack, isPlaying, playTrack, togglePlay, addToQueue } = usePlayerStore(
    useShallow((s) => ({ currentTrack: s.currentTrack, isPlaying: s.isPlaying, playTrack: s.playTrack, togglePlay: s.togglePlay, addToQueue: s.addToQueue }))
  );

  const refresh = async () => {
    const [list, size] = await Promise.all([listLocalTracks(), getLocalFilesSize()]);
    setTracks(list);
    setSizeBytes(size);
    setLoaded(true);
  };

  useEffect(() => {
    void refresh();
    const on = () => void refresh();
    window.addEventListener(LOCAL_FILES_EVENT, on);
    return () => window.removeEventListener(LOCAL_FILES_EVENT, on);
  }, []);

  const showToast = (msg: string, ms = 2600) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), ms);
  };

  const onFiles = async (list: FileList | null) => {
    const files = Array.from(list || []);
    if (inputRef.current) inputRef.current.value = '';
    if (!files.length) return;
    setProgress({ done: 0, total: files.length });
    const res = await addLocalFiles(files, (done, total) => setProgress({ done, total }));
    setProgress(null);
    if (res.added === 0) showToast('Esos archivos no son de audio');
    else showToast(res.added === 1 ? 'Canción añadida' : `${res.added} canciones añadidas`);
  };

  const isThisContextPlaying = Boolean(currentTrack && tracks.some((t) => t.id === currentTrack.id));

  const playAll = (shuffle = false) => {
    if (!tracks.length) return;
    if (isThisContextPlaying && !shuffle) {
      togglePlay();
      return;
    }
    const list = shuffle ? [...tracks].sort(() => Math.random() - 0.5) : tracks;
    playTrack(list[0], list, LOCAL_FILES_PLAYLIST_ID);
  };

  const playOne = (t: Track) => {
    if (currentTrack?.id === t.id) togglePlay();
    else playTrack(t, tracks, LOCAL_FILES_PLAYLIST_ID);
  };

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

  const addButton = (label: string, primary = false) => (
    <button
      onClick={() => inputRef.current?.click()}
      className={`h-9 px-4 rounded-full text-sm font-bold flex items-center gap-2 cursor-pointer active:scale-95 transition-all ${
        primary ? 'bg-white text-black hover:scale-[1.03]' : 'border border-[#7c7c7c] text-white hover:border-white'
      }`}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <path d="M15.25 8a.75.75 0 0 1-.75.75H8.75v5.75a.75.75 0 0 1-1.5 0V8.75H1.5a.75.75 0 0 1 0-1.5h5.75V1.5a.75.75 0 0 1 1.5 0v5.75h5.75a.75.75 0 0 1 .75.75" />
      </svg>
      {label}
    </button>
  );

  return (
    <div className="min-h-full text-white font-['SpotifyMixUI'] select-none pb-10">
      {fileInput}

      {/* Header */}
      <div
        className={`${isMobile ? 'px-4 pt-3 pb-5' : 'px-6 pt-16 pb-6'}`}
        style={{ background: 'linear-gradient(180deg, #2f5a4a 0%, #1b3a30 60%, #121212 100%)' }}
      >
        {isMobile && onBack && (
          <button onClick={onBack} className="w-9 h-9 -ml-1.5 mb-3 flex items-center justify-center rounded-full active:bg-black/20 cursor-pointer" aria-label="Volver">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.957 2.793a1 1 0 0 1 0 1.414L8.164 12l7.793 7.793a1 1 0 1 1-1.414 1.414L5.336 12l9.207-9.207a1 1 0 0 1 1.414 0z" />
            </svg>
          </button>
        )}
        <div className={`flex ${isMobile ? 'flex-col items-center text-center' : 'items-end gap-6'}`}>
          <LocalFilesCover size={isMobile ? 180 : 220} className="rounded-md shadow-[0_8px_40px_rgba(0,0,0,0.5)]" />
          <div className={`${isMobile ? 'mt-5 w-full text-left' : ''}`}>
            {!isMobile && <p className="text-sm font-semibold">Playlist</p>}
            <h1 className={`font-black tracking-tight font-['SpotifyMixUITitle'] ${isMobile ? 'text-2xl' : 'text-6xl my-3'}`}>Archivos locales</h1>
            <p className="text-sm text-white/70 mt-1">
              {tracks.length} {tracks.length === 1 ? 'canción' : 'canciones'}
              {sizeBytes > 0 ? ` • ${formatSize(sizeBytes)} en este dispositivo` : ''} • Suenan sin conexión
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className={`flex items-center gap-4 ${isMobile ? 'px-4 py-3' : 'px-6 py-5'}`}>
        <button
          onClick={() => playAll(false)}
          disabled={!tracks.length}
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
          disabled={!tracks.length}
          className="w-10 h-10 flex items-center justify-center text-[#b3b3b3] hover:text-white disabled:opacity-40 cursor-pointer active:scale-90 transition-all"
          aria-label="Reproducir en aleatorio"
        >
          <svg width="24" height="24" viewBox="0 0 16 16" fill="currentColor">
            <path d="M13.151.922a.75.75 0 1 0-1.06 1.06L13.109 3H11.16a3.75 3.75 0 0 0-2.873 1.34l-6.173 7.356A2.25 2.25 0 0 1 .39 12.5H0V14h.391a3.75 3.75 0 0 0 2.873-1.34l6.173-7.356a2.25 2.25 0 0 1 1.724-.804h1.947l-1.017 1.018a.75.75 0 0 0 1.06 1.06L15.98 3.75zM.391 3.5H0V2h.391c1.109 0 2.16.49 2.873 1.34L4.89 5.277l-.979 1.167-1.796-2.14A2.25 2.25 0 0 0 .39 3.5z" />
            <path d="m7.5 10.723.98-1.167.957 1.14a2.25 2.25 0 0 0 1.724.804h1.947l-1.017-1.018a.75.75 0 1 1 1.06-1.06l2.829 2.828-2.829 2.828a.75.75 0 1 1-1.06-1.06L13.109 13H11.16a3.75 3.75 0 0 1-2.873-1.34l-.787-.938z" />
          </svg>
        </button>
        <div className="flex-1" />
        {tracks.length > 0 && addButton('Añadir')}
      </div>

      {/* Adding progress */}
      {progress && (
        <div className={`${isMobile ? 'mx-4' : 'mx-6'} mb-3 rounded-lg bg-[#242424] p-3`}>
          <p className="text-sm font-bold">
            Añadiendo canciones ({progress.done}/{progress.total})…
          </p>
          <div className="mt-2 h-1 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-[#1ed760] transition-all" style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }} />
          </div>
        </div>
      )}

      {/* List / empty state */}
      {loaded && tracks.length === 0 && !progress ? (
        <div className="px-8 py-12 flex flex-col items-center text-center spf-page-enter">
          <div className="w-16 h-16 rounded-full bg-[#242424] text-white flex items-center justify-center mb-5">
            <NoteIcon />
          </div>
          <h2 className="text-xl font-bold font-['SpotifyMixUITitle']">Añade canciones de tu dispositivo</h2>
          <p className="mt-2 text-sm text-[#a7a7a7] max-w-sm leading-relaxed">
            Elige archivos de música (MP3, M4A, FLAC…). Se guardan dentro de la app y suenan sin conexión, también en modo avión.
          </p>
          <div className="mt-6">{addButton('Añadir archivos', true)}</div>
        </div>
      ) : (
        <div className={`${isMobile ? 'px-2' : 'px-4'} spf-stagger`}>
          {!isMobile && tracks.length > 0 && (
            <div className="grid grid-cols-[16px_1fr_1fr_72px] gap-4 px-4 py-2 mb-2 border-b border-white/10 text-sm text-[#a7a7a7]">
              <span>#</span>
              <span>Título</span>
              <span>Álbum</span>
              <span className="text-right">Duración</span>
            </div>
          )}
          {tracks.map((t, i) => {
            const active = currentTrack?.id === t.id;
            const artist = t.artists?.[0]?.name || 'Artista desconocido';
            return isMobile ? (
              <div key={t.id} className="flex items-center gap-3 px-2 py-2 rounded-md active:bg-white/10" onClick={() => playOne(t)}>
                {cover(t, 'w-12 h-12')}
                <div className="flex-1 min-w-0">
                  <p className={`text-[15px] truncate ${active ? 'text-[#1ed760]' : 'text-white'}`}>{t.name}</p>
                  <p className="text-[13px] text-[#a7a7a7] truncate">{artist}</p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuTrack(t);
                  }}
                  className="w-10 h-10 flex items-center justify-center text-[#a7a7a7] cursor-pointer"
                  aria-label="Opciones de la canción"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4m0 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4m0 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4" />
                  </svg>
                </button>
              </div>
            ) : (
              <div
                key={t.id}
                onDoubleClick={() => playOne(t)}
                className="group grid grid-cols-[16px_1fr_1fr_72px] gap-4 items-center px-4 py-2 rounded-md hover:bg-white/10"
              >
                <button onClick={() => playOne(t)} className={`text-sm tabular-nums cursor-pointer ${active ? 'text-[#1ed760]' : 'text-[#a7a7a7]'}`}>
                  <span className="group-hover:hidden">{i + 1}</span>
                  <svg className="hidden group-hover:block text-white" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M3 1.713a.7.7 0 0 1 1.05-.607l10.89 6.288a.7.7 0 0 1 0 1.212L4.05 14.894A.7.7 0 0 1 3 14.288z" />
                  </svg>
                </button>
                <div className="flex items-center gap-3 min-w-0">
                  {cover(t, 'w-10 h-10')}
                  <div className="min-w-0">
                    <p className={`truncate ${active ? 'text-[#1ed760]' : 'text-white'}`}>{t.name}</p>
                    <p className="text-sm text-[#a7a7a7] truncate">{artist}</p>
                  </div>
                </div>
                <p className="text-sm text-[#a7a7a7] truncate">{t.album?.name}</p>
                <div className="flex items-center justify-end gap-3">
                  <button
                    onClick={() => void removeLocalTrack(t.id).then(() => showToast('Eliminada de este dispositivo'))}
                    className="opacity-0 group-hover:opacity-100 text-[#a7a7a7] hover:text-white transition-opacity cursor-pointer"
                    title="Eliminar de este dispositivo"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                    </svg>
                  </button>
                  <span className="text-sm text-[#a7a7a7] tabular-nums">{formatDuration(t.duration_ms)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Song menu (phone) */}
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
                danger
                icon={
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                  </svg>
                }
                label="Eliminar de este dispositivo"
                sublabel="El archivo original de tu móvil no se borra"
                onClick={() => {
                  const id = menuTrack.id;
                  setMenuTrack(null);
                  void removeLocalTrack(id).then(() => showToast('Eliminada de este dispositivo'));
                }}
              />
            </SheetList>
          </>
        )}
      </MobileSheet>

      {toast && (
        <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-[130] px-4 py-2.5 rounded-full bg-white text-black text-xs font-bold shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200">
          {toast}
        </div>
      )}
    </div>
  );
};

export default LocalFilesView;
