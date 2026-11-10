import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { DesktopLayout } from './components/desktop/DesktopLayout';
import { MobileLayout } from './components/mobile/MobileLayout';
import { AudioController } from './components/common/AudioController';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { AddToPlaylistModal } from './components/modals/AddToPlaylistModal';
import { TasteOnboardingModal } from './components/modals/TasteOnboardingModal';
import { SharedSessionModal } from './components/common/SharedSessionModal';
import { SharedSessionCursors } from './components/common/SharedSessionCursors';
import GlobalToast from './components/common/GlobalToast';
import { ApkUpdateBanner } from './components/common/ApkUpdateBanner';
import { ConfirmDialogHost } from './components/common/ConfirmDialog';
import { PlaylistVersionsHost } from './components/common/PlaylistVersionsDialog';
import AudioSourceSheet from './components/common/AudioSourceSheet';
import SleepTimerSheet from './components/common/SleepTimerSheet';
import ImportPlaylistDialog from './components/common/ImportPlaylistDialog';
import StoryCardSheet from './components/common/StoryCardSheet';
import { useSpotifyDataStore } from './store/useSpotifyDataStore';
import { useUIStore } from './store/useUIStore';
import { usePlayerStore } from './store/usePlayerStore';
import { useIsMobile } from './utils/useIsMobile';
import { initAuthListener } from './services/spotifreeAuth';
import { useSharedSessionStore, getIsApplyingRemoteSync } from './services/sharedSessionService';
import { initSpotifreeMixes } from './services/spotifreeMixes';
import { initListenFriends } from './services/listenFriends';
import { initDeepLinks, handleDeepLink } from './utils/deepLinkHandler';

if (typeof window !== 'undefined') {
  (window as any).__useUIStore = useUIStore;
}

function App() {
  const initializeSpotify = useSpotifyDataStore((s) => s.initialize);
  const isMobile = useIsMobile();

  useEffect(() => {
    initializeSpotify();

    // Spotifree's own playlists: learns from what each account plays and refreshes daily
    initSpotifreeMixes();

    // Remembers the friends who listen together with this device (Settings › Escuchar juntos)
    initListenFriends();

    // Initialize real-time cloud session listener
    const unsubscribeAuth = initAuthListener();

    // Check URL for ?session=ROOM_ID invite link
    if (typeof window !== 'undefined') {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const inviteSessionId = urlParams.get('session');
        if (inviteSessionId) {
          const currentStore = useSharedSessionStore.getState();
          if (currentStore.sessionId && currentStore.sessionId !== inviteSessionId) {
            currentStore.leaveSession();
          }
          currentStore.joinSession(inviteSessionId).then((joined) => {
            if (!joined && typeof window !== 'undefined' && window.location.search.includes('session=')) {
              const cleanUrl = window.location.pathname + window.location.hash;
              window.history.replaceState({}, document.title, cleanUrl);
            }
          });
        }
      } catch {}
    }

    // Initialize Deep Links & Voice playback commands (Android AI / Gemini / Assistant / Links)
    initDeepLinks();
    let removeUrlListener: (() => void) | null = null;
    try {
      if (Capacitor.isPluginAvailable('App')) {
        CapApp.addListener('appUrlOpen', (event) => {
          if (event?.url) {
            void handleDeepLink(event.url);
          }
        }).then((handle) => {
          removeUrlListener = () => handle.remove();
        }).catch(() => {});
      }
    } catch {}

    // Synchronize local playback changes to active shared session (preventing echo loops)
    const unsubscribePlayer = usePlayerStore.subscribe((state, prevState) => {
      const { isInSession, broadcastPlayback } = useSharedSessionStore.getState();
      if (!isInSession || getIsApplyingRemoteSync()) return;

      const trackChanged = state.currentTrack?.id !== prevState.currentTrack?.id;
      const playStateChanged = state.isPlaying !== prevState.isPlaying;
      const significantSeek = Math.abs(state.progressMs - prevState.progressMs) > 6000;

      if ((trackChanged || playStateChanged || significantSeek) && state.currentTrack) {
        broadcastPlayback(state.currentTrack, state.isPlaying, state.progressMs);
      }
    });

    const handleOpenModal = () => useUIStore.getState().openLoginModal();
    window.addEventListener('spotifree_open_login_modal', handleOpenModal);

    // ─── Android Hardware Back Button & Native Status Bar (Capacitor & Web) ───────
    let removeBackListener: (() => void) | null = null;
    try {
      if (Capacitor.isPluginAvailable('App')) {
        CapApp.addListener('backButton', ({ canGoBack }) => {
          const ui = useUIStore.getState();
          if (ui.isTasteOnboardingOpen) {
            ui.closeTasteOnboarding();
            return;
          }
          if (ui.isLoginModalOpen) {
            ui.closeLoginModal();
            return;
          }
          if (ui.isAddToPlaylistModalOpen) {
            ui.closeAddToPlaylistModal();
            return;
          }
          if (ui.isSettingsModalOpen) {
            ui.closeSettingsModal();
            return;
          }
          if (ui.isProfileOpen) {
            ui.closeProfile();
            return;
          }
          if (ui.isImportModalOpen) {
            ui.closeImportModal();
            return;
          }
          if (ui.isEditPlaylistModalOpen) {
            ui.closeEditPlaylistModal();
            return;
          }
          if (ui.isCreateMenuOpen) {
            ui.closeCreateMenu();
            return;
          }
          if (ui.isSortMenuOpen) {
            ui.closeSortMenu();
            return;
          }
          if (ui.contextMenu.isOpen) {
            ui.closeContextMenu();
            return;
          }

          let wasHandled = false;
          const backEvent = new CustomEvent('spotifree_android_back', {
            detail: { setHandled: () => { wasHandled = true; } },
          });
          window.dispatchEvent(backEvent);

          if (wasHandled) return;

          if (canGoBack) {
            window.history.back();
          } else {
            CapApp.exitApp();
          }
        }).then((handle) => {
          removeBackListener = () => handle.remove();
        }).catch(() => {});
      }
    } catch {}

    if (Capacitor.isNativePlatform()) {
      try {
        if (Capacitor.isPluginAvailable('StatusBar')) {
          StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
          StatusBar.setBackgroundColor({ color: '#121212' }).catch(() => {});
        }
      } catch {}
    }

    const handleFocus = () => {
      if (typeof window !== 'undefined' && window.location.search.includes('code=')) return;
      const token = typeof window !== 'undefined' ? window.localStorage.getItem('spotify_access_token') : null;
      if (token && token !== 'session-bridge-active') {
        initializeSpotify();
      }
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      removeBackListener?.();
      removeUrlListener?.();
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
      <TasteOnboardingModal />
      {isMobile && <SharedSessionModal />}
      <SharedSessionCursors />
      <AudioSourceSheet />
      <SleepTimerSheet />
      <ImportPlaylistDialog />
      <StoryCardSheet />
      <GlobalToast />
      <ApkUpdateBanner />
      <PlaylistVersionsHost />
      <ConfirmDialogHost />
    </ErrorBoundary>
  );
}

export default App;
