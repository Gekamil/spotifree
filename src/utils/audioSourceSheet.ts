import type { Track } from '../types/spotify';

/** Opens the "Audio source" sheet (choose which upload plays a song). Rendered by <AudioSourceSheet/>. */
export const AUDIO_SOURCE_EVENT = 'spotifree:open-audio-source';

export function openAudioSourceSheet(track: Track | null | undefined) {
  if (typeof window === 'undefined' || !track) return;
  window.dispatchEvent(new CustomEvent(AUDIO_SOURCE_EVENT, { detail: { track } }));
}
