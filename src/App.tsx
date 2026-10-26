import { useEffect } from 'react';
import { DesktopLayout } from './components/desktop/DesktopLayout';
import { useSpotifyDataStore } from './store/useSpotifyDataStore';
import { startLiveSessionPolling, stopLiveSessionPolling } from './services/sessionSync';

function App() {
  const initializeSpotify = useSpotifyDataStore((s) => s.initialize);

  useEffect(() => {
    initializeSpotify();
    startLiveSessionPolling(15000);

    const handleFocus = () => {
      initializeSpotify();
    };

    const handleVisibility = () => {
      if (!document.hidden) {
        initializeSpotify();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      stopLiveSessionPolling();
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [initializeSpotify]);

  return <DesktopLayout />;
}

export default App;
