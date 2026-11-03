import { useEffect } from 'react';
import { DesktopLayout } from './components/desktop/DesktopLayout';
import { MobileLayout } from './components/mobile/MobileLayout';
import { AudioController } from './components/common/AudioController';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { AddToPlaylistModal } from './components/modals/AddToPlaylistModal';
import { SharedSessionModal } from './components/common/SharedSessionModal';
import { SharedSessionCursors } from './components/common/SharedSessionCursors';
import { useSpotifyDataStore } from './store/useSpotifyDataStore';
import { useUIStore } from './store/useUIStore';
import { usePlayerStore } from './store/usePlayerStore';
import { useIsMobile } from './utils/useIsMobile';
import { initAuthListener } from './services/spotifreeAuth';
import { useSharedSessionStore } from './services/sharedSessionService';

if (typeof window !== 'undefined') {
  (window as any).__useUIStore = useUIStore;
}

function App() {
  const initializeSpotify = useSpotifyDataStore((s) => s.initialize);
  const isMobile = useIsMobile();

  useEffect(() => {
    initializeSpotify();

    // Initialize real-time cloud session listener
    const unsubscribeAuth = initAuthListener();

    // Check URL for ?session=ROOM_ID invite link
    if (typeof window !== 'undefined') {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const inviteSessionId = urlParams.get('session');
        if (inviteSessionId) {
          const user = useSpotifyDataStore.getState().user;
          const guestName = user?.display_name || 'Invitado';
          useSharedSessionStore.getState().joinSession(inviteSessionId, guestName);
        }
      } catch {}
    }

    // Synchronize local playback changes to active shared session
    const unsubscribePlayer = usePlayerStore.subscribe((state, prevState) => {
      const { isInSession, broadcastPlayback } = useSharedSessionStore.getState();
      if (!isInSession) return;

      const trackChanged = state.currentTrack?.id !== prevState.currentTrack?.id;
      const playStateChanged = state.isPlaying !== prevState.isPlaying;
      const significantSeek = Math.abs(state.progressMs - prevState.progressMs) > 4000;

      if (trackChanged || playStateChanged || significantSeek) {
        broadcastPlayback(state.currentTrack, state.isPlaying, state.progressMs);
      }
    });

    const handleOpenModal = () => useUIStore.getState().openLoginModal();
    window.addEventListener('spotifree_open_login_modal', handleOpenModal);

    const handleFocus = () => {
      if (typeof window !== 'undefined' && window.location.search.includes('code=')) return;
      const token = typeof window !== 'undefined' ? window.localStorage.getItem('spotify_access_token') : null;
      if (token && token !== 'session-bridge-active') {
        initializeSpotify();
      }
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      unsubscribeAuth();
      unsubscribePlayer();
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('spotifree_open_login_modal', handleOpenModal);
    };
  }, [initializeSpotify]);

  return (
    <ErrorBoundary>
      <AudioController />
      {isMobile ? <MobileLayout /> : <DesktopLayout />}
      <AddToPlaylistModal />
      {isMobile && <SharedSessionModal />}
      <SharedSessionCursors />
    </ErrorBoundary>
  );
}

export default App;
