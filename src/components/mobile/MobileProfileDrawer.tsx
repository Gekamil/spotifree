import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useSpotifyDataStore } from '../../store/useSpotifyDataStore';
import { handleImageError } from '../../utils/imageFallback';
import { hasUnseenChanges } from '../modals/MessagesNotificationsModal';

interface MobileProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: 'profile' | 'settings' | 'recents' | 'stats') => void;
  onOpenSharedSession: () => void;
  onOpenNotifications: () => void;
  onOpenLogin: () => void;
}

export const MobileProfileDrawer: React.FC<MobileProfileDrawerProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onOpenSharedSession,
  onOpenNotifications,
  onOpenLogin,
}) => {
  const { user, isAuthenticated, logout } = useSpotifyDataStore();
  const [isActivitySharing, setIsActivitySharing] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return window.localStorage.getItem('spotifree_sharing_activity') !== 'false';
  });

  const [unseenChanges, setUnseenChanges] = useState(() => hasUnseenChanges());
  useEffect(() => {
    const seen = () => setUnseenChanges(false);
    window.addEventListener('spotifree:changes-seen', seen);
    return () => window.removeEventListener('spotifree:changes-seen', seen);
  }, []);
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isExiting, setIsExiting] = useState(false);
  const [dragOffset, setDragOffset] = useState<number | null>(null);

  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const actionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Synchronous mirrors of the state (timers and the parent effect read these, never stale)
  const renderedRef = useRef(isOpen);
  const exitingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchStartTime = useRef(0);
  const isDragging = useRef(false);

  /**
   * Slides the drawer out, then unmounts it and tells the parent. `action` (a navigation…)
   * runs while it slides. Nothing re-opens it until the parent opens it again.
   */
  const startExit = useCallback((action?: () => void) => {
    if (exitingRef.current || !renderedRef.current) return;
    exitingRef.current = true;
    setIsExiting(true);
    setDragOffset(null);
    if (action) actionTimerRef.current = setTimeout(action, 180);
    exitTimerRef.current = setTimeout(() => {
      renderedRef.current = false;
      exitingRef.current = false;
      setShouldRender(false);
      setIsExiting(false);
      onCloseRef.current();
    }, 280);
  }, []);

  // Only the parent's isOpen drives this (the drawer's own exit state must never re-open it)
  useEffect(() => {
    if (isOpen) {
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
      if (actionTimerRef.current) clearTimeout(actionTimerRef.current);
      renderedRef.current = true;
      exitingRef.current = false;
      setShouldRender(true);
      setIsExiting(false);
      setDragOffset(null);
    } else {
      // Closed from outside (back button, another screen): slide out if still showing
      startExit();
    }
  }, [isOpen, startExit]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
      if (actionTimerRef.current) clearTimeout(actionTimerRef.current);
    };
  }, []);

  // Smooth dismiss handler (plays exit animation then notifies parent)
  const handleDismiss = useCallback(() => startExit(), [startExit]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleDismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, handleDismiss]);

  // Action handler with visible exit slide-out before navigation
  const handleAction = useCallback((action: () => void) => startExit(action), [startExit]);

  // Swipe to dismiss gestures
  const handleTouchStart = (e: React.TouchEvent) => {
    if (isExiting) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchStartTime.current = Date.now();
    isDragging.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isExiting) return;
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const deltaX = currentX - touchStartX.current;
    const deltaY = currentY - touchStartY.current;

    // Detect horizontal swipe to the left
    if (!isDragging.current) {
      if (Math.abs(deltaX) > 10 && Math.abs(deltaX) > Math.abs(deltaY) && deltaX < 0) {
        isDragging.current = true;
      }
    }

    if (isDragging.current && deltaX <= 0) {
      setDragOffset(deltaX);
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging.current || dragOffset === null) {
      setDragOffset(null);
      isDragging.current = false;
      return;
    }

    const duration = Date.now() - touchStartTime.current;
    const velocity = Math.abs(dragOffset) / (duration || 1);

    // If dragged more than 48px or swiped quickly to the left:
    if (dragOffset < -48 || (velocity > 0.35 && dragOffset < -20)) {
      isDragging.current = false;
      handleDismiss();
    } else {
      // Smooth snap back
      setDragOffset(null);
      isDragging.current = false;
    }
  };

  if (!shouldRender) return null;

  // Custom avatar per active account or user image
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
  const displayName = user?.display_name || (isAuthenticated ? 'Tu perfil' : 'Invitado');
  const initial = displayName.charAt(0).toUpperCase() || 'U';

  const toggleActivity = () => {
    const next = !isActivitySharing;
    setIsActivitySharing(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('spotifree_sharing_activity', String(next));
      window.dispatchEvent(
        new CustomEvent('spotifree:toast', {
          detail: {
            message: next
              ? 'Actividad de escucha compartida con amigos'
              : 'Actividad de escucha pausada',
          },
        })
      );
    }
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex font-['SpotifyMixUI'] select-none ${
        isExiting ? 'pointer-events-none' : ''
      }`}
    >
      {/* Darkened backdrop with smooth fade in and fade out */}
      <div
        onClick={handleDismiss}
        className={`fixed inset-0 bg-black/75 backdrop-blur-xs ${
          isExiting ? 'spf-backdrop-exit' : 'spf-backdrop-enter'
        }`}
        style={
          dragOffset !== null
            ? { opacity: Math.max(0, 1 + dragOffset / 320), transition: 'none' }
            : undefined
        }
        aria-hidden="true"
      />

      {/* Drawer Container (Smoothly sliding in on open, sliding out on exit) */}
      <aside
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        style={{
          paddingTop: 'max(16px, env(safe-area-inset-top, 16px))',
          paddingBottom: 'max(16px, env(safe-area-inset-bottom, 16px))',
          ...(dragOffset !== null
            ? { transform: `translate3d(${dragOffset}px, 0, 0)`, transition: 'none' }
            : {}),
        }}
        className={`relative z-10 w-[80%] max-w-[300px] h-full bg-[#1f1f1f] flex flex-col justify-between px-4 text-white shadow-2xl overflow-y-auto ${
          dragOffset !== null
            ? ''
            : isExiting
            ? 'spf-drawer-exit'
            : 'spf-drawer-enter'
        }`}
      >
        <div className="space-y-4">
          {/* 1. Profile Header Card + Añadir Cuenta inside unified rounded panel matching Spotify */}
          <div className="bg-[#282828] rounded-xl overflow-hidden">
            {/* Profile Row: always navigates to profile view so the user can edit profile and see their music */}
            <button
              type="button"
              onClick={() => handleAction(() => onNavigate('profile'))}
              className="w-full flex items-center gap-3.5 p-3 text-left group active:bg-white/5 transition-colors cursor-pointer"
            >
              {/* Avatar Circle */}
              <div className="w-12 h-12 rounded-full bg-[#3b82f6] text-white flex items-center justify-center font-bold text-xl shrink-0 overflow-hidden shadow">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    onError={handleImageError}
                    referrerPolicy="no-referrer"
                    className="w-full h-full max-w-full max-h-full object-cover rounded-full"
                  />
                ) : (
                  <span>{initial}</span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <h2 className="text-[17px] font-bold text-white font-['SpotifyMixUITitle'] truncate leading-snug">
                  {displayName}
                </h2>
                <span className="text-xs text-[#a7a7a7] group-hover:text-white transition-colors flex items-center font-normal">
                  Ver perfil
                </span>
              </div>
            </button>

            {/* Separator line inside card */}
            <div className="h-px bg-white/[0.06] mx-3" />

            {/* Añadir cuenta Row */}
            <button
              type="button"
              onClick={() => handleAction(() => onOpenLogin())}
              className="w-full flex items-center gap-3.5 p-3 active:bg-white/5 transition-colors text-left cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-full bg-[#363636] flex items-center justify-center text-[#b3b3b3] group-hover:text-white shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[14px] font-bold text-white tracking-tight leading-tight">
                  Añadir cuenta
                </span>
                <span className="text-[11.5px] text-[#a7a7a7] truncate font-normal">
                  Añade una cuenta infantil o de adulto
                </span>
              </div>
            </button>
          </div>

          {/* 2. Main Navigation List (matching real Spotify mobile menu order and styling - "Tu Premium" removed) */}
          <div className="space-y-1 pt-1">
            {/* Estadísticas de escucha with 'Novedad' blue label */}
            <button
              type="button"
              onClick={() => handleAction(() => onNavigate('stats'))}
              className="w-full flex items-center justify-between py-2.5 px-2 rounded-lg active:bg-white/5 transition-colors text-left cursor-pointer group"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-6 h-6 flex items-center justify-center text-white shrink-0">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                    <polyline points="17 6 23 6 23 12" />
                  </svg>
                </div>
                <div className="flex flex-col">
                  <span className="text-[15px] font-bold text-white tracking-tight">
                    Estadísticas de escucha
                  </span>
                  <span className="text-[11px] font-medium text-[#3b82f6]">
                    Novedad
                  </span>
                </div>
              </div>
            </button>

            {/* Recientes */}
            <button
              type="button"
              onClick={() => handleAction(() => onNavigate('recents'))}
              className="w-full flex items-center gap-3.5 py-2.5 px-2 rounded-lg active:bg-white/5 transition-colors text-left cursor-pointer group"
            >
              <div className="w-6 h-6 flex items-center justify-center text-white shrink-0">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <span className="text-[15px] font-bold text-white tracking-tight">
                Recientes
              </span>
            </button>

            {/* Novedades de la app (what changed in each version) */}
            <button
              type="button"
              onClick={() => handleAction(() => onOpenNotifications())}
              className="w-full flex items-center gap-3.5 py-2.5 px-2 rounded-lg active:bg-white/5 transition-colors text-left cursor-pointer group"
            >
              <div className="relative w-6 h-6 flex items-center justify-center text-white shrink-0">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9z" />
                  <path d="M19 15l.8 1.9 1.9.8-1.9.8L19 20.4l-.8-1.9-1.9-.8 1.9-.8z" />
                </svg>
                {unseenChanges && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#1ed760]" />}
              </div>
              <div className="flex flex-col">
                <span className="text-[15px] font-bold text-white tracking-tight">Novedades de la app</span>
                <span className="text-[11px] font-medium text-[#a7a7a7]">Qué ha cambiado en Spotifree</span>
              </div>
            </button>

            {/* Configuración y privacidad */}
            <button
              type="button"
              onClick={() => handleAction(() => onNavigate('settings'))}
              className="w-full flex items-center gap-3.5 py-2.5 px-2 rounded-lg active:bg-white/5 transition-colors text-left cursor-pointer group"
            >
              <div className="w-6 h-6 flex items-center justify-center text-white shrink-0">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </div>
              <span className="text-[15px] font-bold text-white tracking-tight">
                Configuración y privacidad
              </span>
            </button>
          </div>

          {/* 3. Dual circular quick action badges (1:1 Spotify Mobile layout) */}
          <div className="flex items-start gap-6 pt-3 px-1">
            {/* Actividad circle: toggles activity sharing with friends */}
            <button
              type="button"
              onClick={toggleActivity}
              className="flex flex-col items-center gap-1 cursor-pointer active:scale-95 transition-transform group"
            >
              <div className="relative w-12 h-12 rounded-full bg-[#3b82f6] text-white flex items-center justify-center font-bold text-lg overflow-hidden shadow shrink-0">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    onError={handleImageError}
                    referrerPolicy="no-referrer"
                    className="w-full h-full max-w-full max-h-full object-cover rounded-full"
                  />
                ) : (
                  <span>{initial}</span>
                )}
                {/* Active sharing green indicator dot */}
                {isActivitySharing && (
                  <div className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-[#1ed760] border-2 border-[#1f1f1f]" />
                )}
              </div>
              <span className="text-[12.5px] font-bold text-white leading-tight">Actividad</span>
              <span className={`text-[11px] leading-tight font-medium ${isActivitySharing ? 'text-[#1ed760]' : 'text-[#a7a7a7]'}`}>
                {isActivitySharing ? 'Compartiendo' : 'Activar'}
              </span>
            </button>

            {/* Escuchar con amigos circle (three human silhouettes group session icon) */}
            <button
              type="button"
              onClick={() => handleAction(() => onOpenSharedSession())}
              className="flex flex-col items-center gap-1 cursor-pointer active:scale-95 transition-transform group"
            >
              <div className="w-12 h-12 rounded-full bg-[#282828] group-hover:bg-[#333333] active:bg-[#383838] flex items-center justify-center text-white shadow shrink-0 transition-colors">
                {/* 3 Human silhouettes icon */}
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  {/* Left Person */}
                  <circle cx="5" cy="10" r="2.5" opacity="0.85" />
                  <path d="M5 14c-2 0-3.5 1-3.5 2.5V18h7v-1.5C8.5 15 7 14 5 14z" opacity="0.85" />
                  {/* Center Person (Prominent) */}
                  <circle cx="12" cy="8" r="3" />
                  <path d="M12 12.5c-2.6 0-5 1.3-5 3.2V18h10v-2.3c0-1.9-2.4-3.2-5-3.2z" />
                  {/* Right Person */}
                  <circle cx="19" cy="10" r="2.5" opacity="0.85" />
                  <path d="M19 14c-2 0-3.5 1-3.5 2.5V18h7v-1.5C22.5 15 21 14 19 14z" opacity="0.85" />
                </svg>
              </div>
              <span className="text-[12.5px] font-bold text-white leading-tight text-center">Escuchar con</span>
              <span className="text-[11px] text-[#a7a7a7] leading-tight font-normal text-center">amigos</span>
            </button>
          </div>
        </div>

        {/* 4. Bottom Footer: Cerrar sesión (if authenticated) */}
        {isAuthenticated && (
          <div className="pt-4 pb-1">
            <button
              type="button"
              onClick={() => handleAction(() => logout())}
              className="w-full py-2.5 rounded-full border border-[#727272] hover:border-white text-white font-bold text-xs uppercase tracking-wider active:scale-95 transition-all text-center cursor-pointer hover:bg-white/5"
            >
              Cerrar sesión
            </button>
          </div>
        )}
      </aside>
    </div>
  );
};
