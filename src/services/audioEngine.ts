/**
 * Antigravity Native Audio Engine
 * Direct, zero-ad, unthrottled HTML5 Web Audio Engine
 * Works natively on Desktop and Mobile browsers without Puppeteer or background Chromium.
 */

import { usePlayerStore } from '../store/usePlayerStore';
import { API_BASE } from '../config';

class AudioEngine {
  private audio: HTMLAudioElement;
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private filterNodes: BiquadFilterNode[] = [];
  private currentTrackId: string | null = null;
  private isSeeking = false;

  private eqFrequencies = [60, 150, 400, 1000, 2400, 15000];

  constructor() {
    this.audio = new Audio();
    this.audio.preload = 'auto';
    this.audio.crossOrigin = 'anonymous';

    this.setupListeners();
  }

  private initAudioContext() {
    if (this.audioContext) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      this.audioContext = new AudioCtx();

      this.sourceNode = this.audioContext.createMediaElementSource(this.audio);

      // Create 6-band parametric EQ filters
      let lastNode: AudioNode = this.sourceNode;
      this.filterNodes = this.eqFrequencies.map((freq, idx) => {
        const filter = this.audioContext!.createBiquadFilter();
        if (idx === 0) {
          filter.type = 'lowshelf';
        } else if (idx === this.eqFrequencies.length - 1) {
          filter.type = 'highshelf';
        } else {
          filter.type = 'peaking';
          filter.Q.value = 1.0;
        }
        filter.frequency.value = freq;
        filter.gain.value = 0;

        lastNode.connect(filter);
        lastNode = filter;
        return filter;
      });

      lastNode.connect(this.audioContext.destination);
    } catch (e) {
      console.warn('[AudioEngine] Web Audio EQ not initialized:', e);
    }
  }

  private setupListeners() {
    this.audio.addEventListener('timeupdate', () => {
      if (!this.isSeeking) {
        usePlayerStore.getState().setProgress(this.audio.currentTime * 1000);
      }
    });

    this.audio.addEventListener('durationchange', () => {
      if (this.audio.duration && isFinite(this.audio.duration) && this.audio.duration > 0) {
        usePlayerStore.getState().setDuration(this.audio.duration * 1000);
      }
    });

    this.audio.addEventListener('loadedmetadata', () => {
      if (this.audio.duration && isFinite(this.audio.duration) && this.audio.duration > 0) {
        usePlayerStore.getState().setDuration(this.audio.duration * 1000);
      }
    });

    this.audio.addEventListener('ended', () => {
      const state = usePlayerStore.getState();
      if (state.repeatMode === 'one') {
        this.audio.currentTime = 0;
        this.audio.play().catch(() => {});
      } else {
        state.nextTrack();
      }
    });

    this.audio.addEventListener('play', () => {
      if (!usePlayerStore.getState().isPlaying) {
        usePlayerStore.setState({ isPlaying: true });
      }
    });

    this.audio.addEventListener('pause', () => {
      if (usePlayerStore.getState().isPlaying) {
        usePlayerStore.setState({ isPlaying: false });
      }
    });

    this.audio.addEventListener('error', (e) => {
      console.error('[AudioEngine] Playback error:', e, this.audio.error);
    });
  }

  public async playTrack(trackId: string, query: string, startSeconds = 0) {
    this.initAudioContext();
    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume().catch(() => {});
    }

    this.currentTrackId = trackId;
    this.isSeeking = false;

    const streamUrl = `${API_BASE}/api/audio/stream?q=${encodeURIComponent(query)}&trackId=${encodeURIComponent(trackId)}`;
    this.audio.src = streamUrl;
    if (startSeconds > 0) {
      this.audio.currentTime = startSeconds;
    }

    const { volume, isMuted } = usePlayerStore.getState();
    this.audio.volume = isMuted ? 0 : volume;

    try {
      await this.audio.play();
      usePlayerStore.setState({ isPlaying: true });
    } catch (err: any) {
      // Browser autoplay policy might require user gesture
      console.warn('[AudioEngine] Autoplay waiting for user gesture or failed:', err.message);
    }
  }

  public togglePlay() {
    this.initAudioContext();
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }

    if (this.audio.paused) {
      this.audio.play().catch(() => {});
      usePlayerStore.setState({ isPlaying: true });
    } else {
      this.audio.pause();
      usePlayerStore.setState({ isPlaying: false });
    }
  }

  public pause() {
    this.audio.pause();
    usePlayerStore.setState({ isPlaying: false });
  }

  public resume() {
    this.initAudioContext();
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }
    this.audio.play().catch(() => {});
    usePlayerStore.setState({ isPlaying: true });
  }

  public seek(seconds: number) {
    if (!isFinite(seconds)) return;
    this.isSeeking = true;
    this.audio.currentTime = seconds;
    usePlayerStore.getState().setProgress(seconds * 1000);
    setTimeout(() => {
      this.isSeeking = false;
    }, 200);
  }

  public setVolume(val: number) {
    const clamped = Math.max(0, Math.min(1, val));
    this.audio.volume = clamped;
  }

  public setMuted(muted: boolean) {
    this.audio.muted = muted;
  }

  public setEqualizerBand(index: number, gainDb: number) {
    if (this.filterNodes[index]) {
      this.filterNodes[index].gain.value = gainDb;
    }
  }

  public setAllEqualizerBands(bands: { label: string; value: number }[]) {
    this.initAudioContext();
    bands.forEach((b, idx) => {
      if (this.filterNodes[idx]) {
        this.filterNodes[idx].gain.value = b.value;
      }
    });
  }

  public getCurrentTrackId(): string | null {
    return this.currentTrackId;
  }

  public getCurrentTime(): number {
    return this.audio.currentTime;
  }

  public getDuration(): number {
    return this.audio.duration || 0;
  }
}

export const audioEngine = new AudioEngine();
if (typeof window !== 'undefined') {
  (window as any).__audioEngine = audioEngine;
}
