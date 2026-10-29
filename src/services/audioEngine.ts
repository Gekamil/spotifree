/**
 * Antigravity Resilient Hybrid Audio Engine
 * Combines Native YouTube Web Player (100% resilient on residential & mobile IPs)
 * with HTML5 Web Audio Stream fallback.
 * Works natively on Desktop and Mobile browsers without datacenter IP bot challenges.
 */

import { usePlayerStore } from '../store/usePlayerStore';
import { API_BASE } from '../config';

const VIDEO_ID_CACHE = new Map<string, string>();

// Initialize persistent cache from localStorage
if (typeof window !== 'undefined') {
  try {
    const saved = window.localStorage.getItem('spotifree_yt_cache');
    if (saved) {
      const parsed = JSON.parse(saved);
      Object.entries(parsed).forEach(([k, v]) => {
        if (typeof v === 'string') VIDEO_ID_CACHE.set(k, v);
      });
    }
  } catch {}
}

function persistVideoId(query: string, videoId: string) {
  VIDEO_ID_CACHE.set(query, videoId);
  if (typeof window !== 'undefined') {
    try {
      const obj: Record<string, string> = {};
      let count = 0;
      for (const [k, v] of VIDEO_ID_CACHE.entries()) {
        obj[k] = v;
        if (++count > 500) break;
      }
      window.localStorage.setItem('spotifree_yt_cache', JSON.stringify(obj));
    } catch {}
  }
}

class AudioEngine {
  private audio: HTMLAudioElement;
  private silentCarrier: HTMLAudioElement | null = null;
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private filterNodes: BiquadFilterNode[] = [];
  private currentTrackId: string | null = null;
  private currentTrackQuery: string | null = null;
  private isSeeking = false;
  private activeEngine: 'youtube' | 'html5' = 'youtube';

  private ytPlayer: any = null;
  private isYtReady = false;
  private ytReadyPromise: Promise<void> | null = null;
  private progressInterval: number | null = null;

  private eqFrequencies = [60, 150, 400, 1000, 2400, 15000];

  constructor() {
    this.audio = new Audio();
    this.audio.preload = 'auto';
    this.audio.crossOrigin = 'anonymous';

    this.setupHtml5Listeners();

    if (typeof window !== 'undefined') {
      try {
        this.silentCarrier = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA');
        this.silentCarrier.loop = true;
        this.silentCarrier.volume = 0.001;
      } catch {}
      // Unlock audio on mobile on first user gesture
      const unlockUserMedia = () => {
        try {
          if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume().catch(() => {});
          }
          if (this.ytPlayer && typeof this.ytPlayer.playVideo === 'function') {
            // Player exists
          }
        } catch {}
        window.removeEventListener('click', unlockUserMedia);
        window.removeEventListener('touchstart', unlockUserMedia);
      };
      window.addEventListener('click', unlockUserMedia, { once: true, passive: true });
      window.addEventListener('touchstart', unlockUserMedia, { once: true, passive: true });

      // Pre-warm YouTube IFrame API immediately in background
      setTimeout(() => {
        this.ensureYouTubeReady().catch(() => {});
      }, 50);
    }
  }

  private ensureYouTubeReady(): Promise<void> {
    if (typeof window === 'undefined') return Promise.resolve();
    if (this.isYtReady && this.ytPlayer) return Promise.resolve();
    if (this.ytReadyPromise) return this.ytReadyPromise;

    this.ytReadyPromise = new Promise<void>((resolve) => {
      const initPlayer = () => {
        try {
          let host = document.getElementById('spotifree-yt-player-host');
          if (!host) {
            host = document.createElement('div');
            host.id = 'spotifree-yt-player-host';
            // Position inside viewport (240x240px clipped) so mobile browsers (iOS WebKit / Android Chrome)
            // treat the iframe as active and do not suspend or freeze background media playback
            host.style.cssText = 'position:fixed;bottom:0;right:0;width:240px;height:240px;opacity:0.001;pointer-events:none;z-index:-9999;clip-path:inset(100%);';
            document.body.appendChild(host);
          }

          let playerDiv = document.getElementById('spotifree-yt-player');
          if (!playerDiv) {
            playerDiv = document.createElement('div');
            playerDiv.id = 'spotifree-yt-player';
            host.appendChild(playerDiv);
          }

          if (!(window as any).YT || !(window as any).YT.Player) {
            setTimeout(initPlayer, 200);
            return;
          }

          this.ytPlayer = new (window as any).YT.Player('spotifree-yt-player', {
            height: '240',
            width: '240',
            playerVars: {
              autoplay: 1,
              controls: 0,
              disablekb: 1,
              fs: 0,
              modestbranding: 1,
              rel: 0,
              playsinline: 1,
              enablejsapi: 1,
              origin: typeof window !== 'undefined' ? window.location.origin : undefined,
              widget_referrer: typeof window !== 'undefined' ? window.location.origin : undefined,
            },
            events: {
              onReady: () => {
                this.isYtReady = true;
                const { volume, isMuted } = usePlayerStore.getState();
                if (this.ytPlayer && typeof this.ytPlayer.setVolume === 'function') {
                  this.ytPlayer.setVolume(isMuted ? 0 : Math.round(volume * 100));
                }
                resolve();
              },
              onStateChange: (event: any) => {
                this.handleYtStateChange(event);
              },
              onError: (event: any) => {
                console.warn('[AudioEngine] YouTube player error:', event.data);
                // On error 101 or 150 (not embeddable), try alternate query (e.g. + audio)
                if (this.currentTrackQuery && (event.data === 101 || event.data === 150)) {
                  this.resolveAndPlayAlternate(this.currentTrackQuery, this.currentTrackId);
                } else if (this.currentTrackQuery) {
                  this.fallbackToStream(this.currentTrackQuery);
                }
              },
            },
          });
        } catch (err) {
          console.warn('[AudioEngine] Failed to initialize YouTube player:', err);
          resolve();
        }
      };

      if ((window as any).YT && (window as any).YT.Player) {
        initPlayer();
      } else {
        const prevCallback = (window as any).onYouTubeIframeAPIReady;
        (window as any).onYouTubeIframeAPIReady = () => {
          if (typeof prevCallback === 'function') prevCallback();
          initPlayer();
        };

        if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
          const script = document.createElement('script');
          script.src = 'https://www.youtube.com/iframe_api';
          document.head.appendChild(script);
        }
      }
    });

    return this.ytReadyPromise;
  }

  private handleYtStateChange(event: any) {
    const code = event.data;
    // 1: PLAYING, 2: PAUSED, 0: ENDED, 3: BUFFERING
    if (code === 1) {
      usePlayerStore.setState({ isPlaying: true });
      this.startProgressTicker();
    } else if (code === 2) {
      usePlayerStore.setState({ isPlaying: false });
      this.stopProgressTicker();
    } else if (code === 0) {
      this.stopProgressTicker();
      const state = usePlayerStore.getState();
      if (state.repeatMode === 'one') {
        this.seek(0);
        this.resume();
      } else {
        state.nextTrack();
      }
    }
  }

  private startProgressTicker() {
    this.stopProgressTicker();
    this.progressInterval = window.setInterval(() => {
      if (this.isSeeking) return;

      if (this.activeEngine === 'youtube' && this.ytPlayer && typeof this.ytPlayer.getCurrentTime === 'function') {
        try {
          const curSec = this.ytPlayer.getCurrentTime();
          const durSec = this.ytPlayer.getDuration();
          if (isFinite(curSec) && curSec >= 0) {
            usePlayerStore.getState().setProgress(curSec * 1000);
          }
          if (isFinite(durSec) && durSec > 0) {
            usePlayerStore.getState().setDuration(durSec * 1000);
          }
        } catch {}
      }
    }, 80);
  }

  private stopProgressTicker() {
    if (this.progressInterval !== null) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }

  private setupHtml5Listeners() {
    this.audio.addEventListener('timeupdate', () => {
      if (this.activeEngine === 'html5' && !this.isSeeking) {
        usePlayerStore.getState().setProgress(this.audio.currentTime * 1000);
      }
    });

    this.audio.addEventListener('durationchange', () => {
      if (this.activeEngine === 'html5' && this.audio.duration && isFinite(this.audio.duration) && this.audio.duration > 0) {
        usePlayerStore.getState().setDuration(this.audio.duration * 1000);
      }
    });

    this.audio.addEventListener('loadedmetadata', () => {
      if (this.activeEngine === 'html5' && this.audio.duration && isFinite(this.audio.duration) && this.audio.duration > 0) {
        usePlayerStore.getState().setDuration(this.audio.duration * 1000);
      }
    });

    this.audio.addEventListener('ended', () => {
      if (this.activeEngine !== 'html5') return;
      const state = usePlayerStore.getState();
      if (state.repeatMode === 'one') {
        this.audio.currentTime = 0;
        this.audio.play().catch(() => {});
      } else {
        state.nextTrack();
      }
    });

    this.audio.addEventListener('play', () => {
      if (this.activeEngine === 'html5' && !usePlayerStore.getState().isPlaying) {
        usePlayerStore.setState({ isPlaying: true });
      }
    });

    this.audio.addEventListener('pause', () => {
      if (this.activeEngine === 'html5' && usePlayerStore.getState().isPlaying) {
        usePlayerStore.setState({ isPlaying: false });
      }
    });

    this.audio.addEventListener('error', (e) => {
      if (this.activeEngine === 'html5') {
        console.warn('[AudioEngine] HTML5 stream error:', e, this.audio.error);
      }
    });
  }

  private initAudioContext() {
    if (this.audioContext) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      this.audioContext = new AudioCtx();

      this.sourceNode = this.audioContext.createMediaElementSource(this.audio);

      let savedBands: number[] = [0, 0, 0, 0, 0, 0];
      try {
        const raw = typeof window !== 'undefined' ? window.localStorage.getItem('spotifree_eq_bands') : null;
        if (raw) savedBands = JSON.parse(raw);
      } catch {}

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
        filter.gain.value = savedBands[idx] ?? 0;

        lastNode.connect(filter);
        lastNode = filter;
        return filter;
      });

      lastNode.connect(this.audioContext.destination);
    } catch (e) {
      console.warn('[AudioEngine] Web Audio EQ not initialized:', e);
    }
  }

  public async playTrack(trackId: string, query: string, startSeconds = 0) {
    this.currentTrackId = trackId;
    this.currentTrackQuery = query;
    this.isSeeking = false;

    // Reset progress to 0
    usePlayerStore.getState().setProgress(startSeconds * 1000);

    // Check user preference in localStorage
    const preferredEngine = typeof window !== 'undefined'
      ? window.localStorage.getItem('spotifree_audio_engine') || 'hybrid'
      : 'hybrid';

    if (preferredEngine === 'stream') {
      return this.fallbackToStream(query, startSeconds);
    }

    try {
      // 1. Resolve videoId
      let videoId = VIDEO_ID_CACHE.get(query);
      if (!videoId) {
        const resolveUrl = `${API_BASE}/api/audio/resolve?q=${encodeURIComponent(query)}&trackId=${encodeURIComponent(trackId)}`;
        const res = await fetch(resolveUrl);
        if (res.ok) {
          const data = await res.json();
          if (data.videoId) {
            videoId = data.videoId;
            persistVideoId(query, videoId!);
          }
        }
      }

      if (videoId) {
        await this.ensureYouTubeReady();
        if (this.ytPlayer && typeof this.ytPlayer.loadVideoById === 'function') {
          this.activeEngine = 'youtube';
          this.audio.pause();

          const { volume, isMuted } = usePlayerStore.getState();
          if (typeof this.ytPlayer.setVolume === 'function') {
            this.ytPlayer.setVolume(isMuted ? 0 : Math.round(volume * 100));
          }

          this.ytPlayer.loadVideoById({
            videoId,
            startSeconds,
          });
          this.ytPlayer.playVideo();
          usePlayerStore.setState({ isPlaying: true });
          this.startProgressTicker();
          return;
        }
      }
    } catch (err: any) {
      console.warn('[AudioEngine] Native YouTube play error, attempting stream fallback:', err.message);
    }

    // Fallback to HTML5 audio stream
    return this.fallbackToStream(query, startSeconds);
  }

  private async resolveAndPlayAlternate(originalQuery: string, _trackId: string | null) {
    try {
      const altQuery = `${originalQuery} audio`;
      const resolveUrl = `${API_BASE}/api/audio/resolve?q=${encodeURIComponent(altQuery)}`;
      const res = await fetch(resolveUrl);
      if (res.ok) {
        const data = await res.json();
        if (data.videoId && this.ytPlayer && typeof this.ytPlayer.loadVideoById === 'function') {
          this.activeEngine = 'youtube';
          this.ytPlayer.loadVideoById({ videoId: data.videoId, startSeconds: 0 });
          this.ytPlayer.playVideo();
          usePlayerStore.setState({ isPlaying: true });
          this.startProgressTicker();
          return;
        }
      }
    } catch {}

    this.fallbackToStream(originalQuery, 0);
  }

  private fallbackToStream(query: string, startSeconds = 0) {
    this.activeEngine = 'html5';
    this.stopProgressTicker();
    if (this.ytPlayer && typeof this.ytPlayer.pauseVideo === 'function') {
      try { this.ytPlayer.pauseVideo(); } catch {}
    }

    this.initAudioContext();
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }

    const streamUrl = `${API_BASE}/api/audio/stream?q=${encodeURIComponent(query)}`;
    this.audio.src = streamUrl;
    if (startSeconds > 0) {
      this.audio.currentTime = startSeconds;
    }

    const { volume, isMuted } = usePlayerStore.getState();
    this.audio.volume = isMuted ? 0 : volume;

    this.audio.play()
      .then(() => {
        usePlayerStore.setState({ isPlaying: true });
      })
      .catch((err) => {
        console.warn('[AudioEngine] Stream play failed:', err.message);
      });
  }

  public startBackgroundCarrier() {
    if (this.silentCarrier && this.silentCarrier.paused) {
      this.silentCarrier.play().catch(() => {});
    }
  }

  public stopBackgroundCarrier() {
    if (this.silentCarrier && !this.silentCarrier.paused) {
      this.silentCarrier.pause();
    }
  }

  public unlockAudio() {
    try {
      this.startBackgroundCarrier();
      if (this.audioContext && this.audioContext.state === 'suspended') {
        this.audioContext.resume().catch(() => {});
      }
      if (this.audio) {
        this.audio.play().then(() => this.audio.pause()).catch(() => {});
      }
    } catch {}
  }

  public togglePlay() {
    if (this.activeEngine === 'youtube' && this.ytPlayer && typeof this.ytPlayer.getPlayerState === 'function') {
      const state = this.ytPlayer.getPlayerState();
      if (state === 1) { // Playing -> Pause
        this.ytPlayer.pauseVideo();
        this.stopBackgroundCarrier();
        usePlayerStore.setState({ isPlaying: false });
        this.stopProgressTicker();
      } else { // Paused -> Play
        this.ytPlayer.playVideo();
        this.startBackgroundCarrier();
        usePlayerStore.setState({ isPlaying: true });
        this.startProgressTicker();
      }
      return;
    }

    // HTML5 fallback
    if (this.audio.paused) {
      this.audio.play().catch(() => {});
      this.startBackgroundCarrier();
      usePlayerStore.setState({ isPlaying: true });
    } else {
      this.audio.pause();
      this.stopBackgroundCarrier();
      usePlayerStore.setState({ isPlaying: false });
    }
  }

  public pause() {
    if (this.activeEngine === 'youtube' && this.ytPlayer && typeof this.ytPlayer.pauseVideo === 'function') {
      try { this.ytPlayer.pauseVideo(); } catch {}
      this.stopProgressTicker();
    }
    this.audio.pause();
    this.stopBackgroundCarrier();
    usePlayerStore.setState({ isPlaying: false });
  }

  public resume() {
    this.startBackgroundCarrier();
    if (this.activeEngine === 'youtube' && this.ytPlayer && typeof this.ytPlayer.playVideo === 'function') {
      try {
        this.ytPlayer.playVideo();
        this.startProgressTicker();
      } catch {}
      usePlayerStore.setState({ isPlaying: true });
      return;
    }

    this.audio.play().catch(() => {});
    usePlayerStore.setState({ isPlaying: true });
  }

  public seek(seconds: number) {
    if (!isFinite(seconds)) return;
    this.isSeeking = true;

    if (this.activeEngine === 'youtube' && this.ytPlayer && typeof this.ytPlayer.seekTo === 'function') {
      try {
        this.ytPlayer.seekTo(seconds, true);
      } catch {}
    } else {
      this.audio.currentTime = seconds;
    }

    usePlayerStore.getState().setProgress(seconds * 1000);

    setTimeout(() => {
      this.isSeeking = false;
    }, 300);
  }

  public setVolume(val: number) {
    const clamped = Math.max(0, Math.min(1, val));
    if (this.ytPlayer && typeof this.ytPlayer.setVolume === 'function') {
      try {
        this.ytPlayer.setVolume(Math.round(clamped * 100));
      } catch {}
    }
    this.audio.volume = clamped;
  }

  public setMuted(muted: boolean) {
    if (this.ytPlayer && typeof this.ytPlayer.mute === 'function') {
      try {
        muted ? this.ytPlayer.mute() : this.ytPlayer.unMute();
      } catch {}
    }
    this.audio.muted = muted;
  }

  public setEqualizerBand(index: number, gainDb: number) {
    if (this.filterNodes[index]) {
      this.filterNodes[index].gain.value = gainDb;
    }
  }

  public setAllEqualizerBands(bands: { label: string; value: number }[]) {
    this.initAudioContext();
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('spotifree_eq_bands', JSON.stringify(bands.map((b) => b.value)));
      }
    } catch {}
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
    if (this.activeEngine === 'youtube' && this.ytPlayer && typeof this.ytPlayer.getCurrentTime === 'function') {
      try {
        return this.ytPlayer.getCurrentTime() || 0;
      } catch {}
    }
    return this.audio.currentTime || 0;
  }

  public getDuration(): number {
    if (this.activeEngine === 'youtube' && this.ytPlayer && typeof this.ytPlayer.getDuration === 'function') {
      try {
        return this.ytPlayer.getDuration() || 0;
      } catch {}
    }
    return this.audio.duration || 0;
  }

  public async preloadTrack(trackId: string, query: string) {
    if (!query || VIDEO_ID_CACHE.has(query)) return;
    try {
      const resolveUrl = `${API_BASE}/api/audio/resolve?q=${encodeURIComponent(query)}&trackId=${encodeURIComponent(trackId)}`;
      const res = await fetch(resolveUrl);
      if (res.ok) {
        const data = await res.json();
        if (data.videoId) {
          persistVideoId(query, data.videoId);
        }
      }
    } catch {}
  }

  public async prefetchTrack(query: string, trackId?: string) {
    return this.preloadTrack(trackId || 'temp', query);
  }
}

export const audioEngine = new AudioEngine();
if (typeof window !== 'undefined') {
  (window as any).__audioEngine = audioEngine;
}
