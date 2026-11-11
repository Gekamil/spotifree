import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CloseNativeIcon } from '../icons/SpotifyNativeIcons';
import { useSharedSessionStore } from '../../services/sharedSessionService';
import {
  useAudioOutputStore,
  type AudioOutputKind,
} from '../../services/audioOutputService';

const SURFACE = '#282828';

const OutputKindIcon: React.FC<{ kind: AudioOutputKind; size?: number }> = ({ kind, size = 18 }) => {
  if (kind === 'bluetooth') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="6.5 6.5 17.5 17.5 12 23 12 1 17.5 6.5 6.5 17.5" />
      </svg>
    );
  }
  if (kind === 'wired' || kind === 'usb') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
        <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
      </svg>
    );
  }
  if (kind === 'tv') {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
        <path d="M0 3.75A2.75 2.75 0 0 1 2.75 1h10.5A2.75 2.75 0 0 1 16 3.75v6.5A2.75 2.75 0 0 1 13.25 13H8.75v1.5h2.5a.75.75 0 0 1 0 1.5h-6.5a.75.75 0 0 1 0-1.5h2.5V13h-4.5A2.75 2.75 0 0 1 0 10.25zM2.75 2.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25z" />
      </svg>
    );
  }
  if (kind === 'speaker') {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
        <path d="M9.741.85a.75.75 0 0 1 .375.65v13a.75.75 0 0 1-1.125.65l-6.925-4a3.64 3.64 0 0 1-1.33-4.967 3.64 3.64 0 0 1 1.33-1.332l6.925-4a.75.75 0 0 1 .75 0zm-6.924 5.3a2.14 2.14 0 0 0 0 3.7l5.8 3.35V2.8zm8.683 4.29V5.56a2.75 2.75 0 0 1 0 4.88" />
        <path d="M11.5 13.614a5.752 5.752 0 0 0 0-11.228v1.55a4.252 4.252 0 0 1 0 8.127z" />
      </svg>
    );
  }
  // Phone / Default icon matching mobile & Connect parity
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
      <path d="M5 1.5A1.5 1.5 0 0 0 3.5 3v10A1.5 1.5 0 0 0 5 14.5h6a1.5 1.5 0 0 0 1.5-1.5V3A1.5 1.5 0 0 0 11 1.5zM5 0h6a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V3a3 3 0 0 1 3-3m3 12.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0" />
    </svg>
  );
};

/** Mobile & APK "Conectar a un dispositivo" bottom sheet matching Desktop PlayerExtras design 1:1 */
export const MobileDevicePickerSheet: React.FC = () => {
  const {
    isSheetOpen,
    closeSheet,
    devices,
    currentId,
    activeLabel,
    activeKind,
    isApk,
    isNativePluginReady,
    supportsWebSink,
    hasHiddenLabels,
    selectOutput,
    openSystemOutputSwitcher,
  } = useAudioOutputStore();

  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef(0);
  const currentYRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isSheetOpen) return;
    const onBack = (e: Event) => {
      (e as CustomEvent).detail?.setHandled?.();
      closeSheet();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSheet();
    };
    window.addEventListener('spotifree_android_back', onBack);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('spotifree_android_back', onBack);
      window.removeEventListener('keydown', onKey);
    };
  }, [isSheetOpen, closeSheet]);

  if (!isSheetOpen) return null;

  const onTouchStart = (e: React.TouchEvent) => {
    if (scrollRef.current && scrollRef.current.scrollTop > 4) return;
    startYRef.current = e.touches[0].clientY;
    currentYRef.current = e.touches[0].clientY;
    setIsDragging(true);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const delta = e.touches[0].clientY - startYRef.current;
    if (delta > 0) {
      currentYRef.current = e.touches[0].clientY;
      setDragY(delta);
    }
  };
  const onTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (currentYRef.current - startYRef.current > 100) {
      setDragY(600);
      setTimeout(() => {
        closeSheet();
        setDragY(0);
      }, 200);
    } else {
      setDragY(0);
    }
  };

  const showAudioOutputs = isNativePluginReady || supportsWebSink || devices.length > 1;

  return createPortal(
    <div
      className="fixed inset-0 z-[2147483000] flex items-end justify-center bg-black/60 animate-in fade-in duration-200 select-none font-['SpotifyMixUI']"
      onClick={closeSheet}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Conectar a un dispositivo"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className="relative w-full max-w-[560px] max-h-[85vh] flex flex-col rounded-t-xl text-white shadow-[0_16px_24px_rgba(0,0,0,0.4),0_6px_8px_rgba(0,0,0,0.25)] animate-slide-up-modal"
        style={{
          background: SURFACE,
          transform: `translateY(${dragY}px)`,
          transition: isDragging ? 'none' : 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Drag Handle matching Spotify Mobile & SharedSessionModal */}
        <div className="shrink-0 flex items-center justify-center pt-2.5 pb-1">
          <div className="w-9 h-1 rounded-full bg-white/30" />
        </div>

        <button
          onClick={closeSheet}
          aria-label="Cerrar"
          className="absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center text-[#b3b3b3] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        >
          <CloseNativeIcon size={16} />
        </button>

        <div
          ref={scrollRef}
          className="overflow-y-auto px-5 pt-4 pb-[calc(env(safe-area-inset-bottom,0px)+24px)]"
        >
          {/* Current Device Section (1:1 match with Desktop PlayerExtras) */}
          <p className="text-base font-bold mb-3">Dispositivo actual</p>
          <div className="flex items-center gap-3 mb-5">
            <span className="w-10 h-10 rounded-md bg-[#1ed760]/15 text-[#1ed760] flex items-center justify-center shrink-0">
              <OutputKindIcon kind={activeKind === 'default' ? 'speaker' : activeKind} size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-[#1ed760]">Este teléfono</p>
              <p className="text-xs text-[#b3b3b3] truncate">{activeLabel}</p>
            </div>
          </div>

          {/* Audio Outputs List */}
          {showAudioOutputs && (
            <>
              <p className="text-sm font-bold mb-1.5">Salida de audio</p>
              <div className="space-y-0.5 mb-4 max-h-56 overflow-y-auto">
                {devices.map((d) => {
                  const isActive = currentId === d.id || Boolean(d.active && currentId !== 'default');
                  return (
                    <button
                      key={d.id}
                      onClick={() => void selectOutput(d)}
                      className={`w-full flex items-center justify-between gap-3 px-2.5 py-2.5 rounded-lg hover:bg-white/10 active:bg-white/15 text-left text-[13px] cursor-pointer transition-colors ${
                        isActive ? 'text-[#1ed760]' : 'text-white/90'
                      }`}
                    >
                      <span className="flex items-center gap-2.5 min-w-0 flex-1">
                        <span className={isActive ? 'text-[#1ed760]' : 'text-[#b3b3b3]'}>
                          <OutputKindIcon kind={d.kind} size={16} />
                        </span>
                        <span className="truncate font-medium">{d.label}</span>
                      </span>
                      {isActive && (
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="shrink-0">
                          <path d="M15.53 2.47a.75.75 0 0 1 0 1.06L4.907 14.153.47 9.716a.75.75 0 0 1 1.06-1.06l3.377 3.376L14.47 2.47a.75.75 0 0 1 1.06 0" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>

              {hasHiddenLabels && (
                <p className="text-[11px] text-[#a7a7a7] -mt-2 mb-4">
                  El navegador oculta los nombres de los altavoces hasta que das permiso de micrófono.
                </p>
              )}
            </>
          )}

          {/* Native Android System / Bluetooth Output Switcher Button */}
          {isApk && isNativePluginReady && (
            <button
              onClick={() => void openSystemOutputSwitcher()}
              className="w-full flex items-center gap-3 p-2.5 -mx-0.5 mb-2 rounded-lg bg-white/[0.06] hover:bg-white/10 active:bg-white/15 text-left cursor-pointer transition-colors"
            >
              <span className="w-10 h-10 rounded-md bg-white/10 text-white flex items-center justify-center shrink-0">
                <OutputKindIcon kind="bluetooth" size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-white">Cambiar salida de audio</span>
                <span className="block text-xs text-[#b3b3b3] truncate">
                  Altavoces, auriculares o dispositivos Bluetooth del sistema
                </span>
              </span>
            </button>
          )}

          {/* Escuchar juntos (1:1 match with Desktop PlayerExtras) */}
          <button
            onClick={() => {
              closeSheet();
              useSharedSessionStore.getState().setModalOpen(true);
            }}
            className="w-full flex items-center gap-3 p-2.5 -mx-0.5 rounded-lg hover:bg-white/10 active:bg-white/15 text-left cursor-pointer transition-colors"
          >
            <span className="w-10 h-10 rounded-md bg-white/10 flex items-center justify-center shrink-0">
              <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
                <path d="M6 0a4 4 0 1 0 0 8 4 4 0 0 0 0-8M3.5 4a2.5 2.5 0 1 1 5 0 2.5 2.5 0 0 1-5 0M12 6a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5m-1 2.5a1 1 0 1 1 2 0 1 1 0 0 1-2 0M0 13c0-2.21 2.686-4 6-4s6 1.79 6 4v1.5H0zm1.5 0h9c0-1.04-1.61-2.5-4.5-2.5S1.5 11.96 1.5 13" />
              </svg>
            </span>
            <span>
              <span className="block text-sm font-bold text-white">Escuchar juntos</span>
              <span className="block text-xs text-[#b3b3b3]">Comparte el control con tus amigos</span>
            </span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default MobileDevicePickerSheet;
