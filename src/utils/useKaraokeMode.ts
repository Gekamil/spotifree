import { useCallback, useEffect, useState } from 'react';
import type { Track } from '../types/spotify';
import { audioEngine, type KaraokeState } from '../services/audioEngine';

/**
 * Checks whether the current track has a real instrumental ("sin voces") source
 * when fullscreen/expanded lyrics are opened, and exposes synchronized Karaoke toggle state.
 */
export function useKaraokeMode(track: Track | null | undefined, enabled: boolean) {
  const [state, setState] = useState<KaraokeState>(() => audioEngine.getKaraokeState(track?.id));

  useEffect(() => {
    setState(audioEngine.getKaraokeState(track?.id));
    return audioEngine.subscribeKaraoke(() => {
      setState(audioEngine.getKaraokeState(track?.id));
    });
  }, [track?.id]);

  useEffect(() => {
    if (!enabled || !track?.id || !track?.name) return;
    let cancelled = false;
    audioEngine.checkInstrumentalSource(track).then(() => {
      if (!cancelled) {
        setState(audioEngine.getKaraokeState(track.id));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, track?.id, track?.name]);

  const toggle = useCallback(async () => {
    if (!track) return;
    await audioEngine.toggleKaraokeMode(track);
  }, [track]);

  return {
    available: Boolean(state.instrumental?.sourceId),
    active: state.active,
    switching: state.switching,
    instrumental: state.instrumental,
    toggle,
  };
}
