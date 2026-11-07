import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSharedSessionStore } from '../../services/sharedSessionService';
import { CloseNativeIcon } from '../icons/SpotifyNativeIcons';
import { SharedSessionPanel } from './SharedSessionPanel';

const SURFACE = '#282828';

/** Phone: "Escuchar juntos" as a Spotify bottom sheet (the content is SharedSessionPanel) */
export const SharedSessionModal: React.FC = () => {
  const isModalOpen = useSharedSessionStore((s) => s.isModalOpen);
  const setModalOpen = useSharedSessionStore((s) => s.setModalOpen);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef(0);
  const currentYRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Android back closes it
  useEffect(() => {
    if (!isModalOpen) return;
    const onBack = (e: Event) => {
      (e as CustomEvent).detail?.setHandled?.();
      setModalOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setModalOpen(false);
    window.addEventListener('spotifree_android_back', onBack);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('spotifree_android_back', onBack);
      window.removeEventListener('keydown', onKey);
    };
  }, [isModalOpen, setModalOpen]);

  if (!isModalOpen) return null;

  const onTouchStart = (e: React.TouchEvent) => {
    // Only drag the sheet down when its content is scrolled to the top
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
        setModalOpen(false);
        setDragY(0);
      }, 200);
    } else {
      setDragY(0);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[2147483000] flex items-end justify-center bg-black/60 animate-in fade-in duration-200" onClick={() => setModalOpen(false)}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Escuchar juntos"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className="relative w-full max-w-[560px] max-h-[92vh] flex flex-col rounded-t-xl animate-slide-up-modal"
        style={{
          background: SURFACE,
          transform: `translateY(${dragY}px)`,
          transition: isDragging ? 'none' : 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div className="shrink-0 flex items-center justify-center pt-2.5 pb-1">
          <div className="w-9 h-1 rounded-full bg-white/30" />
        </div>
        <button
          onClick={() => setModalOpen(false)}
          aria-label="Cerrar"
          className="absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center text-[#b3b3b3] hover:text-white hover:bg-white/10 transition-colors"
        >
          <CloseNativeIcon size={16} />
        </button>
        <div ref={scrollRef} className="overflow-y-auto px-5 pt-5 pb-[calc(env(safe-area-inset-bottom,0px)+24px)]">
          <SharedSessionPanel surface={SURFACE} compact />
        </div>
      </div>
    </div>,
    document.body
  );
};
