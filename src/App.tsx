import { useEffect } from 'react';
import { DesktopLayout } from './components/desktop/DesktopLayout';
import { MobileLayout } from './components/mobile/MobileLayout';
import { useSpotifyDataStore } from './store/useSpotifyDataStore';
import { useIsMobile } from './utils/useIsMobile';

function App() {
  const initializeSpotify = useSpotifyDataStore((s) => s.initialize);
  const isMobile = useIsMobile();

  useEffect(() => {
    initializeSpotify();

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
      window.removeEventListener('focus', handleFocus);
    };
  }, [initializeSpotify]);

  return isMobile ? <MobileLayout /> : <DesktopLayout />;
}

export default App;
