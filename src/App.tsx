import { useEffect } from 'react';
import { DesktopLayout } from './components/desktop/DesktopLayout';
import { useSpotifyDataStore } from './store/useSpotifyDataStore';

function App() {
  const initializeSpotify = useSpotifyDataStore((s) => s.initialize);

  useEffect(() => {
    initializeSpotify();

    const handleFocus = () => {
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

  return <DesktopLayout />;
}

export default App;
