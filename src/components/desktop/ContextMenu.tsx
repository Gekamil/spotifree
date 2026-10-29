import React, { useEffect, useRef, useState } from 'react';
import { useUIStore } from '../../store/useUIStore';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useSpotifyDataStore } from '../../store/useSpotifyDataStore';

interface ContextMenuProps {
  onSelectPlaylistById?: (id: string, name?: string) => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ onSelectPlaylistById }) => {
  const { contextMenu, closeContextMenu, openEditPlaylistModal, setActiveMainTab } = useUIStore();
  const { toggleLike, likedTrackIds } = usePlayerStore();
  const { playlists, deletePlaylist } = useSpotifyDataStore();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeContextMenu();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeContextMenu();
      }
    };
    if (contextMenu.isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu.isOpen, closeContextMenu]);

  const targetPlaylist = React.useMemo(() => {
    if (!contextMenu.isOpen || !contextMenu.playlistId) return null;
    const found = playlists.find(
      (p) =>
        p.id === contextMenu.playlistId ||
        (p as any).uri === contextMenu.playlistId ||
        (p as any).uri === `spotify:playlist:${contextMenu.playlistId}` ||
        (p as any).uri === `spotify:album:${contextMenu.playlistId}`
    );
    if (found) return found;

    // Check quick access cards
    const quickAccess = useSpotifyDataStore.getState().quickAccessCards || [];
    const foundQuick = quickAccess.find((q) => q.id === contextMenu.playlistId);
    if (foundQuick) {
      return {
        id: foundQuick.id,
        name: foundQuick.name,
        description: '',
        images: [{ url: foundQuick.image }],
        owner: {
          display_name: foundQuick.id === '7b3MrCWtettvBKlfBSdorn' ? 'Jorgeperezvk' : 'Spotify',
          id: foundQuick.id === '7b3MrCWtettvBKlfBSdorn' ? 'user' : 'spotify',
        },
        tracks: { total: 0, items: [] },
      } as any;
    }

    // Check dynamic shelves
    const shelves = useSpotifyDataStore.getState().dynamicShelves || [];
    for (const s of shelves) {
      const c = s.cards.find((card) => card.id === contextMenu.playlistId);
      if (c) {
        return {
          id: c.id,
          name: c.title,
          description: c.subtitle,
          images: [{ url: c.image }],
          owner: { display_name: 'Spotify', id: 'spotify' },
          tracks: { total: 0, items: [] },
        } as any;
      }
    }

    return {
      id: contextMenu.playlistId,
      name: 'Lista',
      description: '',
      images: [],
      owner: { display_name: 'Spotify', id: 'spotify' },
      tracks: { total: 0, items: [] },
    } as any;
  }, [contextMenu.isOpen, contextMenu.playlistId, playlists]);


  const [showPlaylistSubmenu, setShowPlaylistSubmenu] = useState(false);

  const targetTrack = React.useMemo(() => {
    if (!contextMenu.trackId) return null;
    const q = usePlayerStore.getState().queue;
    let found = q.find((t) => t.id === contextMenu.trackId);
    if (found) return found;
    if (usePlayerStore.getState().currentTrack?.id === contextMenu.trackId) {
      return usePlayerStore.getState().currentTrack;
    }
    for (const pl of playlists) {
      const inPl = pl.tracks?.items?.find((t) => t.id === contextMenu.trackId);
      if (inPl) return inPl;
    }
    return null;
  }, [contextMenu.trackId, playlists]);

  const userPlaylistsForAdd = React.useMemo(() => {
    return playlists.filter(
      (p) =>
        p.id !== 'liked-songs' &&
        p.id !== 'tracks' &&
        !p.id.includes('collection:tracks') &&
        !p.id.startsWith('art-') &&
        p.id !== 'nueva-carpeta'
    );
  }, [playlists]);

  const isCurrentPlaylistCustom = Boolean(
    contextMenu.playlistId &&
    contextMenu.playlistId !== 'liked-songs' &&
    contextMenu.playlistId !== 'tracks' &&
    !contextMenu.playlistId.includes('collection:tracks') &&
    !contextMenu.playlistId.startsWith('art-')
  );

  const handleAddTrackToSpecificPlaylist = (targetPlId: string) => {
    if (!targetTrack) return;
    const pl = playlists.find((p) => p.id === targetPlId);
    if (pl) {
      const items = pl.tracks?.items || [];
      if (!items.some((t) => t.id === targetTrack.id)) {
        const updated = [...items, { ...targetTrack, added_at: 'Hoy' }];
        useSpotifyDataStore.getState().updatePlaylist(pl.id, {
          tracks: { total: updated.length, items: updated },
        });
      }
    }
    closeContextMenu();
  };

  const handleRemoveTrackFromCurrentPlaylist = () => {
    if (contextMenu.playlistId && contextMenu.trackId) {
      const pl = playlists.find((p) => p.id === contextMenu.playlistId);
      if (pl && pl.tracks?.items) {
        const updated = pl.tracks.items.filter((t) => t.id !== contextMenu.trackId);
        useSpotifyDataStore.getState().updatePlaylist(pl.id, {
          tracks: { total: updated.length, items: updated },
        });
      }
    }
    closeContextMenu();
  };

  if (!contextMenu.isOpen) return null;

  const isTrackMenu = !!contextMenu.trackId;
  const isLiked = contextMenu.trackId ? likedTrackIds.includes(contextMenu.trackId) : false;

  if (!isTrackMenu && !targetPlaylist) return null;

  const isLikedPlaylist =
    Boolean(targetPlaylist && (
      targetPlaylist.id === 'liked-songs' ||
      targetPlaylist.id?.includes('collection:tracks') ||
      targetPlaylist.name?.toLowerCase().trim() === 'canciones que te gustan'
    ));

  const isArtist = Boolean(
    targetPlaylist && (
      targetPlaylist.id === '3x7gz85amxEplGx7LQxE7Z' ||
      targetPlaylist.id === '5lwmRuXgjX8xIwlnauTZIP' ||
      targetPlaylist.id === 'romeo-santos' ||
      targetPlaylist.description?.toLowerCase() === 'artista' ||
      (targetPlaylist as any).type === 'artist' ||
      targetPlaylist.id?.startsWith('art-')
    )
  );

  const isFolder = Boolean(
    targetPlaylist && (
      targetPlaylist.id === 'nueva-carpeta' ||
      targetPlaylist.description?.toLowerCase().includes('listas')
    )
  );

  const isUserCreatedPlaylist = Boolean(
    targetPlaylist &&
    !isLikedPlaylist &&
    !isArtist &&
    !isFolder &&
    targetPlaylist.id !== 'liked-songs' &&
    targetPlaylist.id !== 'collection:tracks'
  );

  const handleDeletePlaylist = () => {
    if (targetPlaylist && isUserCreatedPlaylist && !isLikedPlaylist) {
      if (window.confirm(`¿Seguro que deseas eliminar «${targetPlaylist.name}»?`)) {
        deletePlaylist(targetPlaylist.id);
        setActiveMainTab('home');
      }
    }
    closeContextMenu();
  };

  const handleEditData = () => {
    if (targetPlaylist && isUserCreatedPlaylist && !isLikedPlaylist) {
      openEditPlaylistModal(targetPlaylist);
    }
    closeContextMenu();
  };

  return (
    <div
      ref={menuRef}
      className="fixed bg-[#282828] rounded-[4px] shadow-[0_16px_24px_rgba(0,0,0,0.6),0_6px_8px_rgba(0,0,0,0.4)] p-1 z-50 text-white select-none border border-white/5 w-[250px] text-xs font-semibold animate-in fade-in zoom-in-95 duration-100"
      style={{
        top: Math.min(contextMenu.y, window.innerHeight - 380),
        left: Math.min(contextMenu.x, window.innerWidth - 270),
      }}
    >
      {!isTrackMenu ? (
        /* Playlist Context Menu (Exact 1:1 match to Spotify Image 5 & User Screenshot) */
        <div className="space-y-0.5">
          {/* 0. Fijar / Desfijar en tu biblioteca */}
          {!isLikedPlaylist && (
            <button
              onClick={() => {
                if (targetPlaylist) {
                  const newPinned = !(targetPlaylist as any).is_pinned;
                  useSpotifyDataStore.getState().updatePlaylist(targetPlaylist.id, { is_pinned: newPinned } as any);
                  const savedRaw = localStorage.getItem('spotify_extracted_session');
                  if (savedRaw) {
                    try {
                      const parsed = JSON.parse(savedRaw);
                      if (parsed.playlists) {
                        parsed.playlists = parsed.playlists.map((p: any) => p.id === targetPlaylist.id ? { ...p, is_pinned: newPinned } : p);
                        localStorage.setItem('spotify_extracted_session', JSON.stringify(parsed));
                      }
                    } catch {}
                  }
                }
                closeContextMenu();
              }}
              className="w-full px-3 py-2.5 rounded-[2px] hover:bg-[#3e3e3e] transition-colors text-left flex items-center gap-3 text-[13px] text-white"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="text-[#a7a7a7] shrink-0">
                <path d="M8.822.797a2.72 2.72 0 0 1 3.847 0l2.534 2.534a2.72 2.72 0 0 1 0 3.847l-1.82 1.82 1.408 5.163a.75.75 0 0 1-.948.91l-4.723-1.574-3.58 3.58a.75.75 0 0 1-1.06-1.06l3.58-3.58-1.574-4.723a.75.75 0 0 1 .91-.948l5.163 1.408 1.82-1.82a1.22 1.22 0 0 0 0-1.727L11.845 2.11a1.22 1.22 0 0 0-1.727 0L8.298 3.93 6.945 2.577z" />
              </svg>
              <span className="truncate">{(targetPlaylist as any)?.is_pinned ? 'Desfijar de tu biblioteca' : 'Fijar en tu biblioteca'}</span>
            </button>
          )}

          {/* 1. Añadir a la cola */}
          <button
            onClick={() => {
              if (targetPlaylist?.tracks?.items && targetPlaylist.tracks.items.length > 0) {
                usePlayerStore.getState().addToQueue(targetPlaylist.tracks.items);
              }
              closeContextMenu();
            }}
            className="w-full px-3 py-2.5 rounded-[2px] hover:bg-[#3e3e3e] transition-colors text-left flex items-center gap-3 text-[13px] text-white"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="text-[#a7a7a7] shrink-0">
              <path d="M16 15H2v-1.5h14zm0-4.5H2V9h14zm-8.034-6A5.5 5.5 0 0 1 7.187 6H13.5a2.5 2.5 0 0 0 0-5H7.966c.159.474.255.978.278 1.5H13.5a1 1 0 1 1 0 2zM2 2V0h1.5v2h2v1.5h-2v2H2v-2H0V2z" />
            </svg>
            <span className="truncate">Añadir a la cola</span>
          </button>

          {/* 2. Añadir al perfil */}
          <button
            onClick={() => {
              closeContextMenu();
            }}
            className="w-full px-3 py-2.5 rounded-[2px] hover:bg-[#3e3e3e] transition-colors text-left flex items-center gap-3 text-[13px] text-white"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="text-[#a7a7a7] shrink-0">
              <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0M1.5 8a6.5 6.5 0 1 1 11.395 4.277 3.5 3.5 0 0 0-1.163-1.088l-1.523-.88a.285.285 0 0 1-.076-.428l.086-.104v-.001c.549-.654.962-1.449 1.02-2.422.03-.526-.055-1.074-.165-1.395a3.2 3.2 0 0 0-.671-1.154 3.26 3.26 0 0 0-4.806 0 3.2 3.2 0 0 0-.672 1.154c-.109.32-.195.87-.163 1.395.057.973.47 1.768 1.018 2.422l.087.105a.285.285 0 0 1-.076.428l-1.523.88a3.5 3.5 0 0 0-1.163 1.088A6.48 6.48 0 0 1 1.5 8" />
            </svg>
            <span className="truncate">Añadir al perfil</span>
          </button>

          {isUserCreatedPlaylist && (
            <>
              {/* 3. Editar datos (Pencil Icon) -> Opens Modal */}
              <button
                onClick={handleEditData}
                className="w-full px-3 py-2.5 rounded-[2px] hover:bg-[#3e3e3e] transition-colors text-left flex items-center gap-3 text-[13px] text-white"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="text-[#a7a7a7] shrink-0">
                  <path d="M11.838.146a.5.5 0 0 1 .708 0l3.308 3.308a.5.5 0 0 1 0 .708L5.27 14.746l-4.5 1a.5.5 0 0 1-.601-.6l1-4.5L11.838.146zm.354 1.768L2.946 11.16l-.68 3.061 3.061-.68 9.246-9.246-2.381-2.381z" />
                </svg>
                <span className="truncate">Editar datos</span>
              </button>

              {/* 4. Eliminar (Trash Can) */}
              <button
                onClick={handleDeletePlaylist}
                className="w-full px-3 py-2.5 rounded-[2px] hover:bg-[#3e3e3e] transition-colors text-left flex items-center gap-3 text-[13px] text-[#ff5c5c]"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="shrink-0">
                  <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8" />
                  <path d="M11.005 4.995a.75.75 0 0 1 0 1.06L9.061 8l1.944 1.945a.75.75 0 1 1-1.06 1.06L8 9.061l-1.945 1.944a.75.75 0 1 1-1.06-1.06L6.939 8 4.995 6.055a.75.75 0 1 1 1.06-1.06L8 6.939l1.945-1.944a.75.75 0 0 1 1.06 0" />
                </svg>
                <span className="truncate font-bold">Eliminar</span>
              </button>

              <div className="h-px bg-white/10 my-1 mx-1" />

              {/* 5. Hacer privada */}
              <button
                onClick={() => {
                  closeContextMenu();
                }}
                className="w-full px-3 py-2.5 rounded-[2px] hover:bg-[#3e3e3e] transition-colors text-left flex items-center gap-3 text-[13px] text-white"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="text-[#a7a7a7] shrink-0">
                  <path d="M8 1a3.5 3.5 0 0 0-3.5 3.5V6H3a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-1.5V4.5A3.5 3.5 0 0 0 8 1m2 5H6V4.5a2 2 0 1 1 4 0z" />
                </svg>
                <span className="truncate">Hacer privada</span>
              </button>
            </>
          )}

          {/* 6. Invitar a colaboradores */}
          <button
            onClick={() => {
              navigator.clipboard?.writeText(window.location.href).catch(() => {});
              closeContextMenu();
            }}
            className="w-full px-3 py-2.5 rounded-[2px] hover:bg-[#3e3e3e] transition-colors text-left flex items-center gap-3 text-[13px] text-white"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="text-[#a7a7a7] shrink-0">
              <path d="M12.5 8a.75.75 0 0 1 .75.75v1.75H15a.75.75 0 0 1 0 1.5h-1.75V13.75a.75.75 0 0 1-1.5 0V12H10a.75.75 0 0 1 0-1.5h1.75V8.75a.75.75 0 0 1 .75-.75" />
              <path d="M6 0a4 4 0 1 0 0 8 4 4 0 0 0 0-8M3.5 4a2.5 2.5 0 1 1 5 0 2.5 2.5 0 0 1-5 0M0 13c0-2.21 2.686-4 6-4 1.157 0 2.228.217 3.125.597a4 4 0 0 0-.125 1.003v1.306A8.5 8.5 0 0 0 6 10.5c-3.13 0-4.5 1.637-4.5 2.5V14h5.602c.11.536.31 1.042.585 1.5H0z" />
            </svg>
            <span className="truncate">Invitar a colaboradores</span>
          </button>

          {/* 7. Excluir de tu perfil de gustos */}
          <button
            onClick={() => {
              closeContextMenu();
            }}
            className="w-full px-3 py-2.5 rounded-[2px] hover:bg-[#3e3e3e] transition-colors text-left flex items-center gap-3 text-[13px] text-white"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="text-[#a7a7a7] shrink-0">
              <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8" />
              <path d="M11.005 4.995a.75.75 0 0 1 0 1.06L9.061 8l1.944 1.945a.75.75 0 1 1-1.06 1.06L8 9.061l-1.945 1.944a.75.75 0 1 1-1.06-1.06L6.939 8 4.995 6.055a.75.75 0 1 1 1.06-1.06L8 6.939l1.945-1.944a.75.75 0 0 1 1.06 0" />
            </svg>
            <span className="truncate">Excluir de tu perfil de gustos</span>
          </button>

          {/* 8. Mover a carpeta */}
          <button
            onClick={() => {
              closeContextMenu();
            }}
            className="w-full px-3 py-2.5 rounded-[2px] hover:bg-[#3e3e3e] transition-colors text-left flex items-center justify-between text-[13px] text-white"
          >
            <div className="flex items-center gap-3 truncate">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="text-[#a7a7a7] shrink-0">
                <path d="M1.75 1A1.75 1.75 0 0 0 0 2.75v11.5C0 15.216.784 16 1.75 16h12.5A1.75 1.75 0 0 0 16 14.25v-9.5A1.75 1.75 0 0 0 14.25 3H7.82l-.65-1.125A1.75 1.75 0 0 0 5.655 1zM1.5 2.75a.25.25 0 0 1 .25-.25h3.905a.25.25 0 0 1 .216.125L6.954 4.5h7.296a.25.25 0 0 1 .25.25v9.5a.25.25 0 0 1-.25.25H1.75a.25.25 0 0 1-.25-.25z" />
              </svg>
              <span className="truncate">Mover a carpeta</span>
            </div>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="text-[#a7a7a7]">
              <path d="M6 3.5 10.5 8 6 12.5" />
            </svg>
          </button>

          {/* 9. Compartir */}
          <button
            onClick={() => {
              navigator.clipboard?.writeText(window.location.href).catch(() => {});
              closeContextMenu();
            }}
            className="w-full px-3 py-2.5 rounded-[2px] hover:bg-[#3e3e3e] transition-colors text-left flex items-center justify-between text-[13px] text-white"
          >
            <div className="flex items-center gap-3 truncate">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="text-[#a7a7a7] shrink-0">
                <path d="M1 5.75A.75.75 0 0 1 1.75 5H4v1.5H2.5v8h11v-8H12V5h2.25a.75.75 0 0 1 .75.75v9.5a.75.75 0 0 1-.75.75H1.75a.75.75 0 0 1-.75-.75z" />
                <path d="M8 9.576a.75.75 0 0 0 .75-.75V2.903l1.454 1.454a.75.75 0 0 0 1.06-1.06L8 .03 4.735 3.296a.75.75 0 0 0 1.06 1.061L7.25 2.903v5.923c0 .414.336.75.75.75" />
              </svg>
              <span className="truncate">Compartir</span>
            </div>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="text-[#a7a7a7]">
              <path d="M6 3.5 10.5 8 6 12.5" />
            </svg>
          </button>
        </div>
      ) : (
        /* Track Context Menu (Spotify 1:1 Parity) */
        <div className="space-y-0.5">
          {/* Añadir a la cola */}
          <button
            onClick={() => {
              if (targetTrack) {
                usePlayerStore.getState().addToQueue(targetTrack);
              } else if (contextMenu.trackId) {
                const tr = usePlayerStore.getState().queue.find((t) => t.id === contextMenu.trackId);
                if (tr) usePlayerStore.getState().addToQueue(tr);
              }
              closeContextMenu();
            }}
            className="w-full px-3 py-2.5 rounded-[2px] hover:bg-[#3e3e3e] transition-colors text-left flex items-center gap-3 text-[13px] text-white"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="text-[#a7a7a7] shrink-0">
              <path d="M16 15H2v-1.5h14zm0-4.5H2V9h14zm-8.034-6A5.5 5.5 0 0 1 7.187 6H13.5a2.5 2.5 0 0 0 0-5H7.966c.159.474.255.978.278 1.5H13.5a1 1 0 1 1 0 2zM2 2V0h1.5v2h2v1.5h-2v2H2v-2H0V2z" />
            </svg>
            <span>Añadir a la cola</span>
          </button>

          {/* Guardar / Eliminar de tus canciones que te gustan */}
          <button
            onClick={() => {
              if (contextMenu.trackId) toggleLike(contextMenu.trackId, targetTrack || undefined);
              closeContextMenu();
            }}
            className="w-full px-3 py-2.5 rounded-[2px] hover:bg-[#3e3e3e] transition-colors text-left flex items-center gap-3 text-[13px] text-white"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className={isLiked ? "text-[#1ed760] shrink-0" : "text-[#a7a7a7] shrink-0"}>
              <path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8m11.748-1.97a.75.75 0 0 0-1.06-1.06l-4.47 4.47-1.405-1.406a.75.75 0 1 0-1.061 1.06l2.466 2.467 5.53-5.53z" />
            </svg>
            <span>{isLiked ? 'Eliminar de tus canciones que te gustan' : 'Guardar en tus canciones que te gustan'}</span>
          </button>

          {/* Añadir a lista de reproducción (con selector interactivo) */}
          <div className="relative">
            <button
              onClick={() => setShowPlaylistSubmenu(!showPlaylistSubmenu)}
              className="w-full px-3 py-2.5 rounded-[2px] hover:bg-[#3e3e3e] transition-colors text-left flex items-center justify-between text-[13px] text-white"
            >
              <div className="flex items-center gap-3 truncate">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="text-[#a7a7a7] shrink-0">
                  <path d="M15.25 8a.75.75 0 0 1-.75.75H8.75v5.75a.75.75 0 0 1-1.5 0V8.75H1.5a.75.75 0 0 1 0-1.5h5.75V1.5a.75.75 0 0 1 1.5 0v5.75h5.75a.75.75 0 0 1 .75.75" />
                </svg>
                <span>Añadir a lista de reproducción</span>
              </div>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className={`text-[#a7a7a7] transition-transform ${showPlaylistSubmenu ? 'rotate-90' : ''}`}>
                <path d="M6 3.5 10.5 8 6 12.5" />
              </svg>
            </button>

            {showPlaylistSubmenu && (
              <div className="mt-1 ml-4 border-l border-white/10 pl-2 space-y-1 max-h-40 overflow-y-auto">
                {userPlaylistsForAdd.length > 0 ? (
                  userPlaylistsForAdd.map((pl) => (
                    <button
                      key={pl.id}
                      onClick={() => handleAddTrackToSpecificPlaylist(pl.id)}
                      className="w-full px-2 py-1.5 rounded hover:bg-[#3e3e3e] text-left text-xs text-[#b3b3b3] hover:text-white truncate flex items-center gap-2"
                    >
                      <span>+</span>
                      <span className="truncate">{pl.name}</span>
                    </button>
                  ))
                ) : (
                  <p className="text-[11px] text-[#727272] px-2 py-1">No hay listas creadas</p>
                )}
              </div>
            )}
          </div>

          {/* Eliminar de esta lista (Solo si la lista es creada/modificable por el usuario) */}
          {isCurrentPlaylistCustom && (
            <button
              onClick={handleRemoveTrackFromCurrentPlaylist}
              className="w-full px-3 py-2.5 rounded-[2px] hover:bg-[#3e3e3e] transition-colors text-left flex items-center gap-3 text-[13px] text-[#ff5c5c]"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="shrink-0">
                <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8" />
                <path d="M11.005 4.995a.75.75 0 0 1 0 1.06L9.061 8l1.944 1.945a.75.75 0 1 1-1.06 1.06L8 9.061l-1.945 1.944a.75.75 0 1 1-1.06-1.06L6.939 8 4.995 6.055a.75.75 0 1 1 1.06-1.06L8 6.939l1.945-1.944a.75.75 0 0 1 1.06 0" />
              </svg>
              <span className="font-bold">Eliminar de esta lista</span>
            </button>
          )}

          {/* Ver artista */}
          {targetTrack?.artists?.[0] && (
            <button
              onClick={() => {
                const artistName = targetTrack.artists[0].name;
                if (onSelectPlaylistById) {
                  onSelectPlaylistById('art-' + artistName.toLowerCase().replace(/\s+/g, '-'), artistName);
                } else {
                  setActiveMainTab('search');
                }
                closeContextMenu();
              }}
              className="w-full px-3 py-2.5 rounded-[2px] hover:bg-[#3e3e3e] transition-colors text-left flex items-center gap-3 text-[13px] text-white"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="text-[#a7a7a7] shrink-0">
                <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0M1.5 8a6.5 6.5 0 1 1 11.395 4.277 3.5 3.5 0 0 0-1.163-1.088l-1.523-.88a.285.285 0 0 1-.076-.428l.086-.104v-.001c.549-.654.962-1.449 1.02-2.422.03-.526-.055-1.074-.165-1.395a3.2 3.2 0 0 0-.671-1.154 3.26 3.26 0 0 0-4.806 0 3.2 3.2 0 0 0-.672 1.154c-.109.32-.195.87-.163 1.395.057.973.47 1.768 1.018 2.422l.087.105a.285.285 0 0 1-.076.428l-1.523.88a3.5 3.5 0 0 0-1.163 1.088A6.48 6.48 0 0 1 1.5 8" />
              </svg>
              <span>Ver artista ({targetTrack.artists[0].name})</span>
            </button>
          )}

          <div className="h-px bg-white/10 my-1 mx-1" />

          {/* Compartir */}
          <button
            onClick={() => {
              const text = targetTrack ? `${targetTrack.name} - ${targetTrack.artists[0]?.name || ''}` : window.location.href;
              navigator.clipboard?.writeText(text).catch(() => {});
              closeContextMenu();
            }}
            className="w-full px-3 py-2.5 rounded-[2px] hover:bg-[#3e3e3e] transition-colors text-left flex items-center justify-between text-[13px] text-white"
          >
            <div className="flex items-center gap-3">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="text-[#a7a7a7] shrink-0">
                <path d="M1 5.75A.75.75 0 0 1 1.75 5H4v1.5H2.5v8h11v-8H12V5h2.25a.75.75 0 0 1 .75.75v9.5a.75.75 0 0 1-.75.75H1.75a.75.75 0 0 1-.75-.75z" />
                <path d="M8 9.576a.75.75 0 0 0 .75-.75V2.903l1.454 1.454a.75.75 0 0 0 1.06-1.06L8 .03 4.735 3.296a.75.75 0 0 0 1.06 1.061L7.25 2.903v5.923c0 .414.336.75.75.75" />
              </svg>
              <span>Compartir</span>
            </div>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="text-[#a7a7a7]">
              <path d="M6 3.5 10.5 8 6 12.5" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};
