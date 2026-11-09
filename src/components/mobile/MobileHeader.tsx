import React from 'react';
import { useSpotifyDataStore } from '../../store/useSpotifyDataStore';
import { handleImageError } from '../../utils/imageFallback';

interface MobileHeaderProps {
  activeTab: 'todo' | 'musica' | string;
  onTabChange: (tab: any) => void;
  onOpenProfile?: () => void;
  onOpenDrawer?: () => void;
  onOpenSettings?: () => void;
  onOpenNotifications?: () => void;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({
  activeTab,
  onTabChange,
  onOpenProfile,
  onOpenDrawer,
}) => {
  const { user, isAuthenticated } = useSpotifyDataStore();

  const handleAvatarClick = () => {
    if (onOpenDrawer) onOpenDrawer();
    else if (onOpenProfile) onOpenProfile();
  };

  // Check user image, or custom profile image per active account
  const activeId = user?.id || (typeof window !== 'undefined' ? window.localStorage.getItem('spotifree_active_user_id') : '') || 'default';
  let customAvatar: string | undefined;
  if (typeof window !== 'undefined') {
    try {
      const saved = window.localStorage.getItem(`spotifree_custom_profile_${activeId}`) || window.localStorage.getItem('spotifree_custom_profile');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.avatarUrl) customAvatar = parsed.avatarUrl;
      }
    } catch {}
  }

  const avatarUrl = customAvatar || user?.images?.[0]?.url;
  const initial = (user?.display_name || 'J').charAt(0).toUpperCase();

  const pills: Array<{ id: string; label: string }> = [
    { id: 'todo', label: 'Todos' },
    { id: 'musica', label: 'Música' },
    { id: 'podcasts', label: 'Pódcasts' },
    { id: 'audiolibros', label: 'Audiolibros' },
  ];

  return (
    <header
      style={{ paddingTop: 'max(8px, var(--sat, 8px))' }}
      className="sticky top-0 z-30 px-3 sm:px-4 pb-2.5 flex items-center gap-3 select-none font-['SpotifyMixUI'] w-full max-w-full overflow-hidden"
    >
      {/* 1. Left: Profile Avatar (Tapping opens the Spotify Left Drawer) */}
      <button
        type="button"
        onClick={handleAvatarClick}
        className="w-8 h-8 rounded-full bg-[#3b82f6] text-white shrink-0 overflow-hidden shadow-md flex items-center justify-center cursor-pointer active:scale-95 transition-transform border border-white/10"
        title={isAuthenticated ? user?.display_name : 'Menú de perfil y ajustes'}
        aria-label="Abrir perfil y configuración"
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={user?.display_name || 'Usuario'}
            onError={handleImageError}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-xs font-bold text-white leading-none">
            {initial}
          </span>
        )}
      </button>

      {/* 2. Center/Right: Spotify Filter Pills (Todos, Música, Pódcasts, Audiolibros - horizontally scrollable, zero right icons) */}
      <div className="flex items-center gap-2 min-w-0 overflow-x-auto scrollbar-none py-0.5 pr-2">
        {pills.map((p) => {
          const isActive = activeTab === p.id || (p.id === 'todo' && activeTab === 'todos');
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onTabChange(p.id)}
              className={`h-8 px-3.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                isActive
                  ? 'bg-[#1ed760] text-black shadow-sm font-bold'
                  : 'bg-[#242424] text-white hover:bg-[#2e2e2e] font-semibold'
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>
    </header>
  );
};
