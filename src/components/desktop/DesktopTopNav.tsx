import React, { useEffect, useState } from 'react';
import {
  SpotifyLogoNativeIcon,
  HomeNativeIcon,
  HomeFilledNativeIcon,
  SearchNativeIcon,
  ExploreNativeIcon,
  ExploreFilledNativeIcon,
  InstallAppNativeIcon,
  BellNativeIcon,
  FriendsNativeIcon,
} from '../icons/SpotifyNativeIcons';
import { useUIStore } from '../../store/useUIStore';
import { useSpotifyDataStore } from '../../store/useSpotifyDataStore';
import { syncChromeSession } from '../../services/sessionSync';
import { ProfileDropdown } from './ProfileDropdown';
import { MessagesNotificationsModal } from '../modals/MessagesNotificationsModal';

interface DesktopTopNavProps {
  onNavigateHome: () => void;
}

export const DesktopTopNav: React.FC<DesktopTopNavProps> = ({ onNavigateHome }) => {
  const {
    activeMainTab,
    toggleProfile,
    toggleRightSidebar,
    searchQuery,
    setSearchQuery,
    setActiveMainTab,
    openLoginModal,
  } = useUIStore();

  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const { isAuthenticated, user } = useSpotifyDataStore();

  useEffect(() => {
    // Attempt local Chrome dev session synchronization only when developing locally
    if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
      syncChromeSession().catch((err) => {
        console.warn('[DesktopTopNav] Auto session sync notice:', err);
      });
    }
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    setActiveMainTab('search');
  };

  const handleHomeClick = () => {
    setSearchQuery('');
    setActiveMainTab('home');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('spotifree_navigate_home'));
    }
    onNavigateHome();
  };

  return (
    <header className="h-16 w-full bg-black px-4 flex items-center justify-between select-none shrink-0 z-50 relative">
      {/* Left: Spotify Circle Logo */}
      <div className="flex items-center gap-2 shrink-0 pl-1">
        <button
          onClick={handleHomeClick}
          className="text-white hover:scale-104 active:scale-96 transition-transform p-1 mr-1"
          title="Spotify"
        >
          <SpotifyLogoNativeIcon size={32} className="text-white" />
        </button>
      </div>

      {/* Center: Home Button + Capsule Search Bar */}
      <div className="flex items-center gap-2 max-w-[480px] flex-1 justify-center px-2">
        {/* Circular Home Button with smooth morphing fill animation */}
        <button
          onClick={handleHomeClick}
          className="w-12 h-12 rounded-full bg-[#1f1f1f] hover:bg-[#282828] text-white flex items-center justify-center hover:scale-106 active:scale-95 transition-all shrink-0 shadow-sm relative overflow-hidden group cursor-pointer"
          title="Inicio"
        >
          {/* Outline house icon */}
          <span
            className={`absolute flex items-center justify-center transition-all duration-300 transform ${
              activeMainTab === 'home'
                ? 'opacity-0 scale-75 rotate-[-6deg]'
                : 'opacity-100 scale-100 rotate-0 text-[#b3b3b3] group-hover:text-white'
            }`}
          >
            <HomeNativeIcon size={24} />
          </span>

          {/* Filled white house icon */}
          <span
            className={`absolute flex items-center justify-center transition-all duration-300 transform ${
              activeMainTab === 'home'
                ? 'opacity-100 scale-100 rotate-0 text-white'
                : 'opacity-0 scale-75 rotate-[6deg] text-white'
            }`}
          >
            <HomeFilledNativeIcon size={24} />
          </span>
        </button>

        {/* Capsule Search Bar Matching Real Spotify */}
        <div className="h-12 flex-1 bg-[#1f1f1f] hover:bg-[#282828] focus-within:bg-[#1f1f1f] rounded-full flex items-center px-3.5 transition-colors border border-transparent focus-within:border-white/20 group min-w-[200px] relative">
          <div className="w-8 h-8 flex items-center justify-center shrink-0 mr-1.5 text-[#a7a7a7] group-hover:text-white transition-colors">
            <SearchNativeIcon size={24} />
          </div>
          <input
            type="text"
            value={searchQuery}
            onFocus={() => setActiveMainTab('search')}
            onChange={handleSearchChange}
            placeholder="¿Qué quieres reproducir?"
            className="w-full h-full bg-transparent text-white text-[15px] placeholder:text-[#a7a7a7] outline-none font-normal font-['SpotifyMixUI',-apple-system,BlinkMacSystemFont,system-ui,sans-serif] leading-[48px]"
          />
          <div className="h-6 w-px bg-[#3e3e3e] mx-2 shrink-0" />
          <button
            onClick={() => setActiveMainTab('search')}
            title="Explorar"
            className="text-[#a7a7a7] hover:text-white p-1 transition-colors shrink-0 relative w-8 h-8 flex items-center justify-center overflow-hidden cursor-pointer"
          >
            {/* Outline icon */}
            <span
              className={`absolute transition-all duration-300 transform ${
                activeMainTab === 'search'
                  ? 'opacity-0 scale-75'
                  : 'opacity-100 scale-100 text-[#a7a7a7] hover:text-white'
              }`}
            >
              <ExploreNativeIcon size={22} />
            </span>

            {/* Filled white icon matching Spotify Real Image 4 */}
            <span
              className={`absolute transition-all duration-300 transform ${
                activeMainTab === 'search'
                  ? 'opacity-100 scale-100 text-white'
                  : 'opacity-0 scale-75 text-white'
              }`}
            >
              <ExploreFilledNativeIcon size={22} />
            </span>
          </button>
        </div>
      </div>

      {/* Right: Descubrir Premium / Conectar, Instalar app, Bell, Friends, Avatar J */}
      <div className="flex items-center justify-end gap-2 shrink-0 relative">
        {/* Estado no autenticado: opciones limpias estilo Spotify */}
        {!isAuthenticated && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveMainTab('guide')}
              className="text-[#b3b3b3] hover:text-white text-sm font-bold px-3 py-1.5 transition-colors cursor-pointer"
            >
              Ayuda
            </button>
            <button
              onClick={() => openLoginModal()}
              className="bg-white hover:scale-104 active:scale-98 text-black text-xs font-bold px-4 py-2 rounded-full transition-transform shrink-0 shadow-sm flex items-center justify-center cursor-pointer"
              title="Conectar con Spotify"
            >
              <span>Conectar cuenta</span>
            </button>
          </div>
        )}

        {/* Instalar app */}
        <button
          className="flex items-center gap-2 text-[#b3b3b3] hover:text-white hover:scale-104 transition-all py-1 px-2 shrink-0 font-bold text-sm"
          title="Instalar app"
        >
          <InstallAppNativeIcon size={16} className="text-[#b3b3b3] group-hover:text-white" />
          <span>Instalar app</span>
        </button>

        {/* Novedades (Bell) */}
        <button
          onClick={() => setIsNotificationsOpen(true)}
          className="w-8 h-8 rounded-full flex items-center justify-center text-[#b3b3b3] hover:text-white hover:bg-white/10 hover:scale-104 transition-all shrink-0 cursor-pointer"
          title="Novedades y Mensajes"
        >
          <BellNativeIcon size={16} />
        </button>

        {/* Actividad de amigos */}
        <button
          onClick={() => toggleRightSidebar('friends')}
          className="w-8 h-8 rounded-full flex items-center justify-center text-[#b3b3b3] hover:text-white hover:bg-white/10 hover:scale-104 transition-all shrink-0"
          title="Actividad de amigos"
        >
          <FriendsNativeIcon size={16} />
        </button>

        {/* User avatar & Profile dropdown (rendered for both authenticated and guest users) */}
        <button
          onClick={toggleProfile}
          className="w-12 h-12 rounded-full bg-[#1f1f1f] hover:scale-104 active:scale-96 transition-transform flex items-center justify-center p-2 relative cursor-pointer shrink-0"
          title={isAuthenticated ? (user?.display_name || 'Perfil') : 'Invitado / Ajustes'}
        >
          {isAuthenticated && user?.images && user.images.length > 0 && user.images[0]?.url ? (
            <img
              src={user.images[0].url}
              alt={user?.display_name || 'Usuario'}
              className="w-8 h-8 rounded-full object-cover shadow"
            />
          ) : (
            <span className={`w-8 h-8 rounded-full ${isAuthenticated ? 'bg-[#ff6437] text-black font-bold' : 'bg-[#333] text-[#b3b3b3] hover:text-white'} flex items-center justify-center text-sm shadow`}>
              {isAuthenticated ? (user?.display_name || 'U').charAt(0).toUpperCase() : (
                <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4zm-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10c-2.29 0-3.516.68-4.168 1.332-.678.678-.83 1.418-.832 1.664h10z" />
                </svg>
              )}
            </span>
          )}
        </button>

        {/* Profile Dropdown */}
        <ProfileDropdown />
      </div>

      <MessagesNotificationsModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
      />
    </header>
  );
};
