import { useEffect } from 'react';
import { DesktopLayout } from './components/desktop/DesktopLayout';
import { MobileLayout } from './components/mobile/MobileLayout';
import { AudioController } from './components/common/AudioController';
import { useSpotifyDataStore } from './store/useSpotifyDataStore';
import { useUIStore } from './store/useUIStore';
import { useIsMobile } from './utils/useIsMobile';
import { initAuthListener } from './services/spotifreeAuth';

function App() {
  const initializeSpotify = useSpotifyDataStore((s) => s.initialize);
  const isMobile = useIsMobile();

  useEffect(() => {
    initializeSpotify();

    // Initialize real-time cloud session listener
    const unsubscribeAuth = initAuthListener();

    const handleOpenModal = () => useUIStore.getState().openLoginModal();
    window.addEventListener('spotifree_open_login_modal', handleOpenModal);

    const handleFocus = () => {
      if (typeof window !== 'undefined' && window.location.search.includes('code=')) return;
      // Re-validate OAuth token on window focus if logged in
      const token = typeof window !== 'undefined' ? window.localStorage.getItem('spotify_access_token') : null;
      if (token && token !== 'session-bridge-active') {
        initializeSpotify();
      }
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      unsubscribeAuth();
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('spotifree_open_login_modal', handleOpenModal);
    };
  }, [initializeSpotify]);

  return (
    <>
      <AudioController />
      {isMobile ? <MobileLayout /> : <DesktopLayout />}
    </>
  );
}

export default App;
