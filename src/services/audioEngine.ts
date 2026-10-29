/**
 * Spotifree High-Performance Audio Engine
 * Pure full-track audio playback with zero 30-second clips and automatic ad skipping.
 * Fully compatible with Mobile browsers, PWA, and Desktop.
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
  private wakeLockSentinel: any = null;

  private audioContext: AudioContext | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private filterNodes: BiquadFilterNode[] = [];
  private currentTrackId: string | null = null;
  private currentTrackQuery: string | null = null;
  private currentVideoId: string | null = null;
  private isSeeking = false;
  private isTransitioning = false;
  private activeEngine: 'youtube' | 'html5' = 'youtube';
  private failedVideoIds: Set<string> = new Set();

  private ytPlayer: any = null;
  private isYtReady = false;
  private ytReadyPromise: Promise<void> | null = null;
  private progressInterval: number | null = null;

  private eqFrequencies = [60, 150, 400, 1000, 2400, 15000];

  constructor() {
    this.audio = new Audio();
    this.audio.preload = 'auto';

    this.setupHtml5Listeners();

    if (typeof window !== 'undefined') {
      // Unlock audio context on user gesture for mobile / PWA
      const unlockUserMedia = () => {
        this.unlockAudio();
      };
      window.addEventListener('click', unlockUserMedia, { passive: true });
      window.addEventListener('touchstart', unlockUserMedia, { passive: true });

      // Handle visibility changes without forcing silence
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && usePlayerStore.getState().isPlaying) {
          try {
            if (this.ytPlayer && typeof this.ytPlayer.unMute === 'function') {
              this.ytPlayer.unMute();
              const { volume, isMuted } = usePlayerStore.getState();
              if (!isMuted) {
                this.ytPlayer.setVolume(Math.round(volume * 100));
              }
            }
          } catch {}
        }
      });

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
            // Render inside active viewport with real dimensions & opacity so mobile browsers (iOS WebKit / Android Chrome PWA)
            // treat the player as an active visible media source and do NOT mute or suspend background playback
            host.style.cssText = 'position:fixed;bottom:0;left:0;width:200px;height:120px;opacity:0.2;pointer-events:none;z-index:5;overflow:hidden;';
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
            height: '120',
            width: '200',
            host: 'https://www.youtube.com',
            playerVars: {
              autoplay: 1,
              controls: 0,
              disablekb: 1,
              fs: 0,
              modestbranding: 1,
              rel: 0,
              playsinline: 1,
              enablejsapi: 1,
              iv_load_policy: 3,
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
                const iframe = document.querySelector('#spotifree-yt-player-host iframe') as HTMLIFrameElement;
                if (iframe) {
                  iframe.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture');
                }
                resolve();
              },
              onStateChange: (event: any) => {
                this.handleYtStateChange(event);
              },
              onError: (event: any) => {
                console.warn('[AudioEngine] YouTube player error:', event.data, 'Current videoId:', this.currentVideoId);
                // On embed restriction or unavailable video error (150, 101, 100, 2), retry with alternate official video
                if (this.currentVideoId) {
                  this.failedVideoIds.add(this.currentVideoId);
                }
                if (this.currentTrackQuery) {
                  this.resolveAndPlayAlternate(this.currentTrackQuery, this.currentVideoId || undefined);
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

  /** Detect and automatically skip pre-roll advertisements in YouTube Player */
  private checkAndSkipAd() {
    if (!this.ytPlayer) return;
    try {
      const data = typeof this.ytPlayer.getVideoData === 'function' ? this.ytPlayer.getVideoData() : null;
      if (data && data.video_id && this.currentVideoId && data.video_id !== this.currentVideoId) {
        // Active video is a pre-roll advertisement — mute and fast-forward past it
        if (typeof this.ytPlayer.mute === 'function') this.ytPlayer.mute();
        const duration = this.ytPlayer.getDuration?.() || 999;
        this.ytPlayer.seekTo(duration, true);
      } else if (data && data.video_id === this.currentVideoId) {
        // Main song is playing — restore user's volume
        const { volume, isMuted } = usePlayerStore.getState();
        if (typeof this.ytPlayer.unMute === 'function' && !isMuted) {
          this.ytPlayer.unMute();
          this.ytPlayer.setVolume(Math.round(volume * 100));
        }
      }
    } catch {}
  }

  private handleYtStateChange(event: any) {
    const code = event.data;
    // 1: PLAYING, 2: PAUSED, 0: ENDED, 3: BUFFERING, -1: UNSTARTED
    if (code === 1) {
      this.isTransitioning = false;
      this.checkAndSkipAd();
      usePlayerStore.setState({ isPlaying: true });
      this.startProgressTicker();
      if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
        try { navigator.mediaSession.playbackState = 'playing'; } catch {}
      }
    } else if (code === 2) {
      // Ignore transient pause events fired during video loading/transitioning
      if (!this.isTransitioning) {
        usePlayerStore.setState({ isPlaying: false });
        this.stopProgressTicker();
        if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
          try { navigator.mediaSession.playbackState = 'paused'; } catch {}
        }
      }
    } else if (code === 3) {
      this.checkAndSkipAd();
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
          this.checkAndSkipAd();
          if (typeof this.ytPlayer.isMuted === 'function' && this.ytPlayer.isMuted()) {
            const { volume, isMuted } = usePlayerStore.getState();
            if (!isMuted) {
              this.ytPlayer.unMute();
              this.ytPlayer.setVolume(Math.round(volume * 100));
            }
          }
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
    }, 100);
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

  /** Direct client-side Innertube search fallback if backend resolve times out */
  private async resolveVideoIdClient(query: string, excludeIds?: Set<string>): Promise<string | null> {
    try {
      const res = await fetch('https://music.youtube.com/youtubei/v1/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        body: JSON.stringify({
          context: {
            client: {
              clientName: 'WEB_REMIX',
              clientVersion: '1.20240318.01.00',
              hl: 'es',
              gl: 'ES',
            },
          },
          query,
          params: 'Eg-KAQwIARAAGAAgACgAMABqChAEEAMQCRAFEAo%3D',
        }),
        signal: AbortSignal.timeout?.(4000),
      });

      if (res.ok) {
        const data = await res.json();
        const text = JSON.stringify(data);
        const matches = [...text.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g)].map((m) => m[1]);
        for (const vid of matches) {
          if (!excludeIds || !excludeIds.has(vid)) {
            return vid;
          }
        }
      }
    } catch {}

    // Fallback: direct web search
    try {
      const searchRes = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, {
        signal: AbortSignal.timeout?.(4000),
      });
      if (searchRes.ok) {
        const html = await searchRes.text();
        const matches = [...html.matchAll(/\/watch\?v=([a-zA-Z0-9_-]{11})/g)].map((m) => m[1]);
        for (const vid of matches) {
          if (!excludeIds || !excludeIds.has(vid)) {
            return vid;
          }
        }
      }
    } catch {}

    return null;
  }

  public async playTrack(trackId: string, query: string, startSeconds = 0) {
    this.currentTrackId = trackId;
    this.currentTrackQuery = query;
    this.failedVideoIds.clear();
    this.isSeeking = false;
    this.isTransitioning = true;

    // Reset progress to 0
    usePlayerStore.getState().setProgress(startSeconds * 1000);
    this.startBackgroundCarrier();

    try {
      // 1. Check instant in-memory & persistent cache
      let videoId: string | null | undefined = VIDEO_ID_CACHE.get(query);

      // 2. Resolve videoId from backend API with client fallback
      if (!videoId) {
        try {
          const resolveUrl = `${API_BASE}/api/audio/resolve?q=${encodeURIComponent(query)}&trackId=${encodeURIComponent(trackId)}`;
          const res = await fetch(resolveUrl, { signal: AbortSignal.timeout?.(5000) });
          if (res.ok) {
            const data = await res.json();
            if (data.videoId) {
              videoId = data.videoId;
              persistVideoId(query, videoId!);
            }
          }
        } catch {}

        // Fallback: direct browser search
        if (!videoId) {
          videoId = await this.resolveVideoIdClient(query);
          if (videoId) {
            persistVideoId(query, videoId);
          }
        }
      }

      if (videoId) {
        this.currentVideoId = videoId;
        await this.ensureYouTubeReady();

        if (this.ytPlayer && typeof this.ytPlayer.loadVideoById === 'function') {
          this.activeEngine = 'youtube';
          this.audio.pause();

          const { volume, isMuted } = usePlayerStore.getState();
          if (typeof this.ytPlayer.setVolume === 'function') {
            this.ytPlayer.setVolume(isMuted ? 0 : Math.round(volume * 100));
          }

          this.ytPlayer.loadVideoById({ videoId, startSeconds });
          this.ytPlayer.playVideo();
          this.startBackgroundCarrier();
          usePlayerStore.setState({ isPlaying: true });
          this.startProgressTicker();

          // Safety transition release after 4 seconds
          setTimeout(() => {
            this.isTransitioning = false;
          }, 4000);
          return;
        }
      }
    } catch (err: any) {
      console.warn('[AudioEngine] Play error:', err?.message);
    }

    this.isTransitioning = false;
  }

  private async resolveAndPlayAlternate(originalQuery: string, failedId?: string) {
    if (failedId) {
      this.failedVideoIds.add(failedId);
    }
    try {
      // 1. Try resolving official video
      const officialQuery = `${originalQuery} official video`;
      let videoId = await this.resolveVideoIdClient(officialQuery, this.failedVideoIds);

      // 2. Try backend API with exclusion
      if (!videoId) {
        try {
          const excludeList = Array.from(this.failedVideoIds).join(',');
          const resolveUrl = `${API_BASE}/api/audio/resolve?q=${encodeURIComponent(officialQuery)}&exclude=${encodeURIComponent(excludeList)}`;
          const res = await fetch(resolveUrl, { signal: AbortSignal.timeout?.(5000) });
          if (res.ok) {
            const data = await res.json();
            if (data.videoId && !this.failedVideoIds.has(data.videoId)) {
              videoId = data.videoId;
            }
          }
        } catch {}
      }

      // 3. Fallback to simplified query + audio
      if (!videoId) {
        const altQuery = `${originalQuery} audio`;
        videoId = await this.resolveVideoIdClient(altQuery, this.failedVideoIds);
      }

      if (videoId && this.ytPlayer && typeof this.ytPlayer.loadVideoById === 'function') {
        this.currentVideoId = videoId;
        persistVideoId(originalQuery, videoId);
        this.activeEngine = 'youtube';
        this.ytPlayer.loadVideoById({ videoId, startSeconds: 0 });
        this.ytPlayer.playVideo();
        this.startBackgroundCarrier();
        usePlayerStore.setState({ isPlaying: true });
        this.startProgressTicker();
      }
    } catch (e) {
      console.warn('[AudioEngine] Alternate resolve error:', e);
    }
  }

  public async startBackgroundCarrier() {
    // Acquire Screen Wake Lock on mobile devices so user can keep lyrics / player on without screen sleep
    if (typeof navigator !== 'undefined' && 'wakeLock' in navigator && (navigator as any).wakeLock?.request) {
      try {
        if (!this.wakeLockSentinel) {
          this.wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
          this.wakeLockSentinel.addEventListener('release', () => {
            this.wakeLockSentinel = null;
          });
        }
      } catch {}
    }
  }

  public stopBackgroundCarrier() {
    if (this.wakeLockSentinel) {
      try { this.wakeLockSentinel.release(); } catch {}
      this.wakeLockSentinel = null;
    }
  }

  public unlockAudio() {
    try {
      this.startBackgroundCarrier();
      if (this.ytPlayer && typeof this.ytPlayer.unMute === 'function') {
        this.ytPlayer.unMute();
        const { volume, isMuted } = usePlayerStore.getState();
        if (!isMuted) this.ytPlayer.setVolume(Math.round(volume * 100));
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
        if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
          try { navigator.mediaSession.playbackState = 'paused'; } catch {}
        }
      } else { // Paused -> Play
        if (typeof this.ytPlayer.unMute === 'function') {
          this.ytPlayer.unMute();
          const { volume, isMuted } = usePlayerStore.getState();
          if (!isMuted) this.ytPlayer.setVolume(Math.round(volume * 100));
        }
        this.ytPlayer.playVideo();
        this.startBackgroundCarrier();
        usePlayerStore.setState({ isPlaying: true });
        this.startProgressTicker();
        if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
          try { navigator.mediaSession.playbackState = 'playing'; } catch {}
        }
      }
      return;
    }

    if (this.audio.paused) {
      this.audio.play().catch(() => {});
      this.startBackgroundCarrier();
      usePlayerStore.setState({ isPlaying: true });
      if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
        try { navigator.mediaSession.playbackState = 'playing'; } catch {}
      }
    } else {
      this.audio.pause();
      this.stopBackgroundCarrier();
      usePlayerStore.setState({ isPlaying: false });
      if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
        try { navigator.mediaSession.playbackState = 'paused'; } catch {}
      }
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
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      try { navigator.mediaSession.playbackState = 'paused'; } catch {}
    }
  }

  public resume() {
    this.startBackgroundCarrier();
    if (this.activeEngine === 'youtube' && this.ytPlayer && typeof this.ytPlayer.playVideo === 'function') {
      try {
        if (typeof this.ytPlayer.unMute === 'function') {
          this.ytPlayer.unMute();
          const { volume, isMuted } = usePlayerStore.getState();
          if (!isMuted) this.ytPlayer.setVolume(Math.round(volume * 100));
        }
        this.ytPlayer.playVideo();
        this.startProgressTicker();
      } catch {}
      usePlayerStore.setState({ isPlaying: true });
      if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
        try { navigator.mediaSession.playbackState = 'playing'; } catch {}
      }
      return;
    }

    this.audio.play().catch(() => {});
    usePlayerStore.setState({ isPlaying: true });
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      try { navigator.mediaSession.playbackState = 'playing'; } catch {}
    }
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
      const res = await fetch(resolveUrl, { signal: AbortSignal.timeout?.(4000) });
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

  public getCurrentVideoId(): string | null {
    if (this.currentVideoId) return this.currentVideoId;
    if (this.currentTrackQuery && VIDEO_ID_CACHE.has(this.currentTrackQuery)) {
      return VIDEO_ID_CACHE.get(this.currentTrackQuery) || null;
    }
    return null;
  }

  public async resolveVideoIdForTrack(query: string, trackId: string): Promise<string | null> {
    if (VIDEO_ID_CACHE.has(query)) {
      return VIDEO_ID_CACHE.get(query)!;
    }
    try {
      const res = await fetch(`${API_BASE}/api/audio/resolve?q=${encodeURIComponent(query)}&trackId=${encodeURIComponent(trackId)}`, {
        signal: AbortSignal.timeout?.(5000),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.videoId) {
          persistVideoId(query, data.videoId);
          return data.videoId;
        }
      }
    } catch {}
    const clientVid = await this.resolveVideoIdClient(query);
    if (clientVid) {
      persistVideoId(query, clientVid);
      return clientVid;
    }
    return null;
  }
}

export const audioEngine = new AudioEngine();
if (typeof window !== 'undefined') {
  (window as any).__audioEngine = audioEngine;
}
