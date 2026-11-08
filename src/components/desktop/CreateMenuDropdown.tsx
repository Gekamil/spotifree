import React, { useEffect, useRef } from 'react';
import { useUIStore } from '../../store/useUIStore';
import { useSpotifyDataStore } from '../../store/useSpotifyDataStore';
import { openImportPlaylistDialog } from '../common/ImportPlaylistDialog';
import { ImportNativeIcon, PlaylistNoteNativeIcon } from '../icons/SpotifyNativeIcons';

/** Desktop "Crear" menu (like Spotify's): Playlist and Importar playlist */
export const CreateMenuDropdown: React.FC = () => {
  const { isCreateMenuOpen, closeCreateMenu } = useUIStore();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isCreateMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) closeCreateMenu();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeCreateMenu();
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [isCreateMenuOpen, closeCreateMenu]);

  if (!isCreateMenuOpen) return null;

  const Item = ({ icon, title, subtitle, onClick }: { icon: React.ReactNode; title: string; subtitle: string; onClick: () => void }) => (
    <button
      role="menuitem"
      onClick={onClick}
      className="w-full flex items-center gap-3 p-2 rounded-[2px] hover:bg-[#3e3e3e] transition-colors text-left group cursor-pointer"
    >
      <span className="w-12 h-12 rounded-full bg-[#3e3e3e] group-hover:bg-[#535353] flex items-center justify-center shrink-0 text-white transition-colors">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block font-bold text-[16px] text-white leading-tight">{title}</span>
        <span className="block text-[14px] text-[#b3b3b3] mt-0.5 leading-snug">{subtitle}</span>
      </span>
    </button>
  );

  return (
    <div
      ref={menuRef}
      role="menu"
      className="absolute top-10 left-0 w-[340px] bg-[#282828] rounded-[4px] shadow-[0_16px_24px_rgba(0,0,0,.3),0_6px_8px_rgba(0,0,0,.2)] p-1 z-50 text-white select-none animate-in fade-in zoom-in-95 duration-100 font-['SpotifyMixUI']"
    >
      <Item
        icon={<PlaylistNoteNativeIcon size={24} />}
        title="Playlist"
        subtitle="Crea una playlist con canciones"
        onClick={() => {
          const newPl = useSpotifyDataStore.getState().createPlaylist();
          (newPl as any).is_new = true;
          useUIStore.getState().openEditPlaylistModal(newPl);
          closeCreateMenu();
        }}
      />
      <Item
        icon={<ImportNativeIcon size={24} />}
        title="Importar playlist"
        subtitle="Desde YouTube Music, YouTube, Apple Music, Deezer o Spotify"
        onClick={() => {
          closeCreateMenu();
          openImportPlaylistDialog();
        }}
      />
    </div>
  );
};
