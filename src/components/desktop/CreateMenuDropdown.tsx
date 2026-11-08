import React, { useEffect, useRef, useState } from 'react';
import { useUIStore } from '../../store/useUIStore';
import { useSpotifyDataStore } from '../../store/useSpotifyDataStore';
import { openImportPlaylistDialog } from '../common/ImportPlaylistDialog';
import { ImportNativeIcon, PlaylistNoteNativeIcon } from '../icons/SpotifyNativeIcons';

/**
 * Desktop "Crear" menu, Spotify style: compact, rounded, opens from the button (scale + fade)
 * and closes the same way. Playlist / Importar playlist.
 */
export const CreateMenuDropdown: React.FC = () => {
  const { isCreateMenuOpen, closeCreateMenu } = useUIStore();
  const menuRef = useRef<HTMLDivElement>(null);
  // Stays mounted while it animates out
  const [mounted, setMounted] = useState(isCreateMenuOpen);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (isCreateMenuOpen) {
      setMounted(true);
      // A timer (not requestAnimationFrame, which pauses in hidden windows and left it invisible)
      const t = setTimeout(() => setShown(true), 16);
      return () => clearTimeout(t);
    }
    setShown(false);
    const t = setTimeout(() => setMounted(false), 130);
    return () => clearTimeout(t);
  }, [isCreateMenuOpen]);

  useEffect(() => {
    if (!isCreateMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // The "Crear" button toggles it itself
      if (target.closest?.('[data-create-button]')) return;
      if (menuRef.current && !menuRef.current.contains(target)) closeCreateMenu();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeCreateMenu();
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [isCreateMenuOpen, closeCreateMenu]);

  if (!mounted) return null;

  const Item = ({ icon, title, subtitle, onClick }: { icon: React.ReactNode; title: string; subtitle: string; onClick: () => void }) => (
    <button
      role="menuitem"
      onClick={onClick}
      className="w-full flex items-center gap-3 px-2 py-2 rounded-md hover:bg-white/10 active:bg-white/[0.07] transition-colors text-left group cursor-pointer"
    >
      <span className="w-10 h-10 rounded-full bg-[#3e3e3e] group-hover:bg-[#4d4d4d] flex items-center justify-center shrink-0 text-white transition-colors">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block font-bold text-[14px] text-white leading-tight">{title}</span>
        <span className="block text-[12.5px] text-[#a7a7a7] mt-0.5 leading-snug">{subtitle}</span>
      </span>
    </button>
  );

  return (
    <div
      ref={menuRef}
      role="menu"
      className={`absolute top-10 left-0 w-[300px] bg-[#282828] rounded-lg shadow-[0_16px_24px_rgba(0,0,0,.3),0_6px_8px_rgba(0,0,0,.2)] p-1 z-50 text-white select-none font-['SpotifyMixUI'] origin-top-left transition-all duration-[130ms] ease-out ${
        shown ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-1'
      }`}
    >
      <Item
        icon={<PlaylistNoteNativeIcon size={20} />}
        title="Playlist"
        subtitle="Crea una playlist con canciones"
        onClick={() => {
          const newPl = useSpotifyDataStore.getState().createPlaylist();
          (newPl as any).is_new = true;
          closeCreateMenu();
          useUIStore.getState().openEditPlaylistModal(newPl);
        }}
      />
      <Item
        icon={<ImportNativeIcon size={20} />}
        title="Importar playlist"
        subtitle="De YouTube Music, Apple Music, Deezer o Spotify"
        onClick={() => {
          closeCreateMenu();
          openImportPlaylistDialog();
        }}
      />
    </div>
  );
};
