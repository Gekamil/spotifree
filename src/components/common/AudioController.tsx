import React, { useEffect, useRef } from 'react';
import { usePlayerStore, registerMediaSessionHandlers } from '../../store/usePlayerStore';
import { audioEngine } from '../../services/audioEngine';

/**
 * Universal Headless Audio Coordinator
 * Coordinates play, pause, queue progression, next/prev tracks, volume, and mobile MediaSession.
 */
export const AudioController: React.FC = () => {
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const volume = usePlayerStore((s) => s.volume);
  const isMuted = usePlayerStore((s) => s.isMuted);
  const queue = usePlayerStore((s) => s.queue);

  const lastTrackIdRef = useRef<string | null>(null);

  // 1. Ensure window.__audioEngine is available globally
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__audioEngine = audioEngine;
    }
  }, []);

  // 2. Play track when currentTrack changes (Desktop + Mobile parity)
  useEffect(() => {
    if (!currentTrack) return;
    if (lastTrackIdRef.current === currentTrack.id) return;
    lastTrackIdRef.current = currentTrack.id;

    const artistName = currentTrack.artists?.[0]?.name || '';
    const query = `${currentTrack.name} ${artistName}`.trim();

    if (audioEngine.getCurrentTrackId() !== currentTrack.id) {
      audioEngine.playTrack(currentTrack.id, query, 0);
    }

    // Preload next track in queue for instant zero-latency transitions
    if (queue && queue.length > 0) {
      const currentIndex = queue.findIndex((t) => t.id === currentTrack.id);
      if (currentIndex !== -1 && currentIndex < queue.length - 1) {
        const next = queue[currentIndex + 1];
        if (next) {
          const nextArtist = next.artists?.[0]?.name || '';
          audioEngine.preloadTrack(next.id, `${next.name} ${nextArtist}`.trim());
        }
      }
    }
  }, [currentTrack, queue]);

  // 3. Keep volume and mute synchronized
  useEffect(() => {
    audioEngine.setVolume(isMuted ? 0 : volume);
    audioEngine.setMuted(isMuted);
  }, [volume, isMuted]);

  // 4. Ensure MediaSession handlers are registered without destructive cleanup
  useEffect(() => {
    registerMediaSessionHandlers();
  }, []);

  return null;
};
