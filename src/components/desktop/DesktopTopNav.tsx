import React, { useEffect } from 'react';
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
  } = useUIStore();

  const { isAuthenticated, user, login } = useSpotifyDataStore();

  useEffect(() => {
    // Attempt live session synchronization from Chrome on port 9222
    syncChromeSession().catch((err) => {
      console.warn('[DesktopTopNav] Auto session sync notice:', err);
    });
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    setActiveMainTab('search');
  };

  const handleHomeClick = () => {
    setSearchQuery('');
    setActiveMainTab('home');
    onNavigateHome();
  };

  return (
    <header className="h-16 w-full bg-black px-4 flex items-center justify-between select-none shrink-0 z-50 relative">
      {/* Left: Spotify Circle Logo */}
      <div className="flex items-center shrink-0 pl-1">
        <button
          onClick={handleHomeClick}
          className="text-white hover:scale-104 active:scale-96 transition-transform p-1"
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
        {/* Iniciar sesión con Spotify / Descubrir Premium */}
        {!isAuthenticated ? (
          <button
            onClick={login}
            className="bg-white hover:scale-104 active:scale-98 text-black text-sm font-bold px-6 py-2.5 rounded-full transition-transform shrink-0 shadow-sm flex items-center justify-center cursor-pointer"
            title="Iniciar sesión con Spotify"
          >
            <span>Iniciar sesión con Spotify</span>
          </button>
        ) : (
          <button
            className="bg-white hover:scale-104 active:scale-98 text-black text-xs font-bold px-3.5 py-1.5 rounded-full transition-transform shrink-0 shadow-sm"
          >
            Descubrir Premium
          </button>
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
          className="w-8 h-8 rounded-full flex items-center justify-center text-[#b3b3b3] hover:text-white hover:bg-white/10 hover:scale-104 transition-all shrink-0"
          title="Novedades"
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

        {/* User avatar & Profile dropdown (rendered only when authenticated) */}
        {isAuthenticated && (
          <>
            <button
              onClick={toggleProfile}
              className="w-12 h-12 rounded-full bg-[#1f1f1f] hover:scale-104 active:scale-96 transition-transform flex items-center justify-center p-2 relative cursor-pointer shrink-0"
              title={user?.display_name || 'Perfil'}
            >
              {user?.images && user.images.length > 0 && user.images[0]?.url ? (
                <img
                  src={user.images[0].url}
                  alt={user?.display_name || 'Usuario'}
                  className="w-8 h-8 rounded-full object-cover shadow"
                />
              ) : (
                <span className="w-8 h-8 rounded-full bg-[#ff6437] text-black font-bold flex items-center justify-center text-sm shadow">
                  {(user?.display_name || 'U').charAt(0).toUpperCase()}
                </span>
              )}
            </button>

            {/* Profile Dropdown */}
            <ProfileDropdown />
          </>
        )}
      </div>
    </header>
  );
};
