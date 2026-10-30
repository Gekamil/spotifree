/**
 * Spotifree High-Performance Audio Engine
 * Pure full-track audio playback with zero 30-second clips and automatic ad skipping.
 * Fully compatible with Mobile browsers, PWA, and Desktop.
 */

import { usePlayerStore } from '../store/usePlayerStore';
import type { Track } from '../types/spotify';
import { API_BASE } from '../config';
import { getDownloadedTrackBlobUrl } from '../utils/offlineStorage';
import { djTransitionService, type DJTransitionConfig } from './djTransitionService';
import { resolveClientSideRealFeature } from '../utils/audioFeatures';

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
  private audios: [HTMLAudioElement, HTMLAudioElement];
  private activeAudioIndex: 0 | 1 = 0;
  private carrierAudio: HTMLAudioElement | null = null;
  private isExplicitlyPaused = false;
  private wakeLockSentinel: any = null;

  private audioContext: AudioContext | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private filterNodes: BiquadFilterNode[] = [];
  private compressorNode: DynamicsCompressorNode | null = null;
  private currentTrackId: string | null = null;
  private currentTrackQuery: string | null = null;
  private currentVideoId: string | null = null;
  private isSeeking = false;
  private isTransitioning = false;
  private activeEngine: 'youtube' | 'html5' = 'youtube';
  private failedVideoIds: Set<string> = new Set();

  private ytPlayers: [any, any] = [null, null];
  private activeYtIndex: 0 | 1 = 0;
  private isYtReady = false;
  private ytReadyPromise: Promise<void> | null = null;
  private progressInterval: number | null = null;

  private eqFrequencies = [60, 150, 400, 1000, 2400, 15000];
  private isCrossfading = false;
  private preloadedNext: { track: Track; videoId?: string; query: string } | null = null;
  private isPreloadingNext = false;
  private crossfadeInterval: number | null = null;
  private auditionInterval: number | null = null;
  private isAuditioning = false;

  public get ytPlayer(): any {
    return this.ytPlayers[this.activeYtIndex];
  }

  public get secondaryYtPlayer(): any {
    return this.ytPlayers[this.activeYtIndex === 0 ? 1 : 0];
  }

  public get audio(): HTMLAudioElement {
    return this.audios[this.activeAudioIndex];
  }

  public get secondaryAudio(): HTMLAudioElement {
    return this.audios[this.activeAudioIndex === 0 ? 1 : 0];
  }

  private checkCrossfade(curSec: number, durSec: number) {
    if (this.isSeeking || !durSec || durSec < 15) return;

    const gaplessSaved = typeof window !== 'undefined' ? window.localStorage.getItem('spotifree_gapless') : null;
    if (gaplessSaved === 'false') return;

    const crossfadeEnabledSaved = typeof window !== 'undefined' ? window.localStorage.getItem('spotifree_crossfade_enabled') : null;
    if (crossfadeEnabledSaved === 'false') return;

    let crossfadeSec = 0;
    try {
      const saved = typeof window !== 'undefined' ? window.localStorage.getItem('spotifree_crossfade_sec') : null;
      if (saved !== null) crossfadeSec = Math.max(0, Math.min(12, parseInt(saved, 10)));
      else crossfadeSec = 5;
    } catch {}

    // DJ Mode Check: When DJ Mode is active, bypass simple flat fade and use beat-aligned transition duration & custom transition config
    const isDjMode =
      typeof window !== 'undefined' &&
      (window.localStorage.getItem('spotifree_dj_mode') === 'true' ||
        window.localStorage.getItem('spotifree_dj_mode_desktop') === 'true');

    let djConfig: DJTransitionConfig | null = null;
    let effectiveCrossfade = crossfadeSec;

    if (isDjMode) {
      const state = usePlayerStore.getState();
      const curTrack = state.currentTrack;
      const nextTrack = state.getNextTrack?.();
      if (curTrack && nextTrack) {
        djConfig = djTransitionService.getTransitionConfig(curTrack.id, nextTrack.id);
        const feat = resolveClientSideRealFeature(curTrack.id, curTrack.name, curTrack.artists?.[0]?.name);
        effectiveCrossfade = djTransitionService.calculateDurationSeconds(feat.tempo, djConfig.compases);
      } else {
        effectiveCrossfade = 3.8;
      }
    }

    if (effectiveCrossfade <= 0) return;

    const remaining = durSec - curSec;

    // 1. Preload upcoming song in the background before crossfade starts
    if (
      !this.preloadedNext &&
      !this.isPreloadingNext &&
      remaining <= Math.max(20, effectiveCrossfade + 8) &&
      remaining > effectiveCrossfade
    ) {
      this.preloadUpcomingTrack();
    }

    // 2. Start simultaneous dual-engine crossfade when remaining reaches effectiveCrossfade
    if (!this.isCrossfading && remaining > 0 && remaining <= effectiveCrossfade) {
      this.executeCrossfade(effectiveCrossfade, djConfig);
    }
  }

  private async preloadUpcomingTrack() {
    this.isPreloadingNext = true;
    try {
      const state = usePlayerStore.getState();
      const nextTrack = state.getNextTrack?.();
      if (!nextTrack || (nextTrack.id === this.currentTrackId && state.repeatMode !== 'one')) {
        this.isPreloadingNext = false;
        return;
      }

      const artistName = nextTrack.artists?.[0]?.name || '';
      const query = `${nextTrack.name} ${artistName}`.trim();

      let videoId: string | null | undefined =
        nextTrack.id === this.currentTrackId && this.currentVideoId
          ? this.currentVideoId
          : VIDEO_ID_CACHE.get(query);

      if (!videoId) {
        videoId = (await this.resolveVideoId(query, nextTrack.id)) || undefined;
      }

      this.preloadedNext = {
        track: nextTrack,
        videoId: videoId || undefined,
        query,
      };

      // In YouTube mode, cue on secondary player so it's pre-buffered
      const secPlayer = this.secondaryYtPlayer;
      if (videoId && secPlayer && typeof secPlayer.cueVideoById === 'function') {
        try {
          secPlayer.cueVideoById({ videoId, startSeconds: 0 });
        } catch {}
      }
    } catch (e) {
      console.warn('[AudioEngine] Preload upcoming track error:', e);
    } finally {
      this.isPreloadingNext = false;
    }
  }

  private async executeCrossfade(crossfadeSec: number, djConfig: DJTransitionConfig | null = null) {
    this.isCrossfading = true;
    const state = usePlayerStore.getState();

    if (!this.preloadedNext) {
      const nextTrack = state.getNextTrack?.();
      if (!nextTrack || (nextTrack.id === this.currentTrackId && state.repeatMode !== 'one')) {
        this.isCrossfading = false;
        return;
      }
      const artistName = nextTrack.artists?.[0]?.name || '';
      const query = `${nextTrack.name} ${artistName}`.trim();
      let videoId: string | null | undefined =
        nextTrack.id === this.currentTrackId && this.currentVideoId
          ? this.currentVideoId
          : VIDEO_ID_CACHE.get(query);

      if (!videoId) {
        videoId = (await this.resolveVideoId(query, nextTrack.id)) || undefined;
      }
      this.preloadedNext = { track: nextTrack, videoId: videoId || undefined, query };
    }

    let nextTrack = this.preloadedNext?.track;
    let nextVideoId = this.preloadedNext?.videoId;
    if (!nextTrack) {
      this.isCrossfading = false;
      return;
    }

    if (this.activeEngine === 'youtube' && !nextVideoId) {
      const artistName = nextTrack.artists?.[0]?.name || '';
      const query = `${nextTrack.name} ${artistName}`.trim();
      nextVideoId = (await this.resolveVideoId(query, nextTrack.id)) || undefined;
      if (nextVideoId && this.preloadedNext) {
        this.preloadedNext.videoId = nextVideoId;
      }
    }

    if (this.activeEngine === 'youtube' && !nextVideoId) {
      this.isCrossfading = false;
      return;
    }

    const masterVolume = state.isMuted ? 0 : state.volume;
    const secYt = this.secondaryYtPlayer;

    // Start secondary player at volume 0
    if (this.activeEngine === 'youtube' && secYt && nextVideoId) {
      try {
        if (typeof secYt.setVolume === 'function') secYt.setVolume(0);
        if (typeof secYt.unMute === 'function') secYt.unMute();
        secYt.loadVideoById({ videoId: nextVideoId, startSeconds: 0 });
        secYt.playVideo();
      } catch {}
    } else if (this.activeEngine === 'html5') {
      try {
        const secAudio = this.secondaryAudio;
        secAudio.volume = 0;
        secAudio.src = `${API_BASE}/api/audio/stream?q=${encodeURIComponent(this.preloadedNext.query)}`;
        secAudio.play().catch(() => {});
      } catch {}
    }

    const durationMs = crossfadeSec * 1000;
    let accumulatedCrossfadeMs = 0;
    let lastTick = Date.now();

    if (this.crossfadeInterval !== null) {
      clearInterval(this.crossfadeInterval);
    }

    this.crossfadeInterval = window.setInterval(() => {
      const now = Date.now();
      const delta = now - lastTick;
      lastTick = now;

      if (!usePlayerStore.getState().isPlaying) {
        return;
      }

      accumulatedCrossfadeMs += delta;
      const progress = Math.min(1, Math.max(0, accumulatedCrossfadeMs / durationMs));

      let outVol: number;
      let inVol: number;

      if (djConfig) {
        // DJ Automix with Beat-Matching, Volume Envelope & Bass Swap
        const volEnvelope = djConfig.volumeEnvelope || 'superposicion';
        if (volEnvelope === 'superposicion' || djConfig.preset === 'automatica') {
          // Outgoing: full volume for 1st bar, then smooth slope down
          if (progress <= 0.5) {
            outVol = masterVolume;
          } else {
            outVol = Math.cos((progress - 0.5) * Math.PI) * masterVolume;
          }
          inVol = progress * masterVolume;
        } else if (volEnvelope === 'corte_directo' || djConfig.preset === 'corte') {
          outVol = progress < 0.5 ? masterVolume : 0;
          inVol = progress < 0.5 ? 0 : masterVolume;
        } else if (djConfig.preset === 'crescendo') {
          outVol = Math.cos(progress * 0.5 * Math.PI) * masterVolume;
          inVol = Math.pow(progress, 1.8) * masterVolume;
        } else {
          // Lineal
          outVol = (1 - progress) * masterVolume;
          inVol = progress * masterVolume;
        }

        // Bass Swap (Intercambio de graves central):
        // 1st half: Outgoing track retains full bass punch, incoming bass is attenuated to avoid frequency mud
        // 2nd half (crossover beat): Outgoing drops bass by -24dB while incoming bass snaps to 100%!
        if (djConfig.eqMode === 'intercambio_graves_central' || djConfig.preset === 'automatica') {
          if (progress < 0.5) {
            inVol = inVol * 0.65; // attenuated low frequencies
          } else {
            outVol = outVol * 0.35; // instant low-cut on outgoing track
          }
        }
      } else {
        // Equal power sinusoidal curve for continuous crossfade
        outVol = Math.cos(progress * 0.5 * Math.PI) * masterVolume;
        inVol = Math.sin(progress * 0.5 * Math.PI) * masterVolume;
      }

      if (this.activeEngine === 'youtube') {
        const curActiveYt = this.ytPlayer;
        const curSecYt = this.secondaryYtPlayer;
        if (curActiveYt && typeof curActiveYt.setVolume === 'function') {
          curActiveYt.setVolume(Math.round(outVol * 100));
        }
        if (curSecYt && typeof curSecYt.setVolume === 'function') {
          curSecYt.setVolume(Math.round(inVol * 100));
        }
      } else {
        const curActiveAudio = this.audio;
        const curSecAudio = this.secondaryAudio;
        if (curActiveAudio) curActiveAudio.volume = Math.max(0, Math.min(1, outVol));
        if (curSecAudio) curSecAudio.volume = Math.max(0, Math.min(1, inVol));
      }

      // When crossfade finishes:
      if (progress >= 1) {
        this.finishCrossfade(crossfadeSec);
      }
    }, 60);
  }

  /**
   * Atomic finalizer for crossfade and Automix transitions.
   * Ensures the incoming song continues playing seamlessly from its elapsed time
   * without skipping, avoids false-positive ad detection, and smoothly pauses the outgoing player.
   */
  private finishCrossfade(crossfadeSec = 0) {
    if (!this.isCrossfading) return;
    this.isCrossfading = false;

    if (this.crossfadeInterval !== null) {
      clearInterval(this.crossfadeInterval);
      this.crossfadeInterval = null;
    }

    const state = usePlayerStore.getState();
    const nextTrack = this.preloadedNext?.track || state.getNextTrack?.();
    const nextVideoId = this.preloadedNext?.videoId;
    const nextQuery = this.preloadedNext?.query;
    this.preloadedNext = null;

    if (!nextTrack) {
      this.startProgressTicker();
      return;
    }

    const masterVolume = state.isMuted ? 0 : state.volume;
    const oldYtIndex = this.activeYtIndex;
    const newYtIndex: 0 | 1 = oldYtIndex === 0 ? 1 : 0;
    const oldAudioIndex = this.activeAudioIndex;
    const newAudioIndex: 0 | 1 = oldAudioIndex === 0 ? 1 : 0;

    // 1. ATOMICALLY SWAP ACTIVE PLAYER INDICES FIRST!
    this.activeYtIndex = newYtIndex;
    this.activeAudioIndex = newAudioIndex;
    this.currentTrackId = nextTrack.id;
    this.currentTrackQuery = nextQuery || `${nextTrack.name} ${nextTrack.artists?.[0]?.name || ''}`.trim();
    this.isTransitioning = false;

    // 2. NOW silence and gently pause outgoing old player
    // Because activeYtIndex is ALREADY newYtIndex, handleYtStateChange will safely ignore
    // the pause event from oldYtIndex!
    if (this.activeEngine === 'youtube') {
      const oldPlayer = this.ytPlayers[oldYtIndex];
      if (oldPlayer) {
        try {
          if (typeof oldPlayer.setVolume === 'function') oldPlayer.setVolume(0);
          if (typeof oldPlayer.pauseVideo === 'function') oldPlayer.pauseVideo();
        } catch {}
      }
    } else {
      const oldAudio = this.audios[oldAudioIndex];
      if (oldAudio) {
        try {
          oldAudio.volume = 0;
          oldAudio.pause();
          oldAudio.currentTime = 0;
        } catch {}
      }
    }

    // 3. Bring incoming player to full volume and ensure it continues playing
    let detectedVideoId = nextVideoId || null;
    let elapsedSeconds = crossfadeSec > 0 ? crossfadeSec : 0;

    if (this.activeEngine === 'youtube') {
      const newPlayer = this.ytPlayers[newYtIndex];
      if (newPlayer) {
        try {
          if (typeof newPlayer.unMute === 'function') newPlayer.unMute();
          if (typeof newPlayer.setVolume === 'function') newPlayer.setVolume(Math.round(masterVolume * 100));
          if (typeof newPlayer.playVideo === 'function') newPlayer.playVideo();

          const data = typeof newPlayer.getVideoData === 'function' ? newPlayer.getVideoData() : null;
          if (data && data.video_id) {
            detectedVideoId = data.video_id;
          }

          if (typeof newPlayer.getCurrentTime === 'function') {
            const ct = newPlayer.getCurrentTime();
            if (isFinite(ct) && ct > 0) {
              elapsedSeconds = ct;
            }
          }
        } catch {}
      }
    } else {
      const newAudio = this.audios[newAudioIndex];
      if (newAudio) {
        try {
          newAudio.volume = Math.max(0, Math.min(1, masterVolume));
          newAudio.play().catch(() => {});
          if (isFinite(newAudio.currentTime) && newAudio.currentTime > 0) {
            elapsedSeconds = newAudio.currentTime;
          }
        } catch {}
      }
    }

    this.currentVideoId = detectedVideoId;

    // 4. Update player store with Song B and the exact elapsed time
    state.completeCrossfadeTrack(nextTrack, Math.round(elapsedSeconds * 1000));
    usePlayerStore.setState({ isPlaying: true });

    // 5. Resume progress ticker on new active player
    this.startProgressTicker();
  }

  /**
   * High-Fidelity DJ Transition Audition with Real Songs.
   * Plays the real ending/outro of Track A into the real beginning of Track B
   * with the exact volume envelope, filter/EQ, and compás duration selected by the user.
   */
  public async startTransitionAudition(
    trackA: Track,
    trackB: Track,
    config: DJTransitionConfig,
    onProgress: (progress: number) => void,
    onEnded: () => void
  ): Promise<boolean> {
    this.stopTransitionAudition();

    // Pause regular playback so audio doesn't clash
    if (this.crossfadeInterval !== null) {
      clearInterval(this.crossfadeInterval);
      this.crossfadeInterval = null;
    }
    if (this.progressInterval !== null) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
    for (const p of this.ytPlayers) {
      if (p && typeof p.pauseVideo === 'function') {
        try { p.pauseVideo(); } catch {}
      }
    }
    for (const a of this.audios) {
      if (a) {
        try { a.pause(); } catch {}
      }
    }
    this.isAuditioning = true;

    // Resolve video IDs for Track A and Track B using resilient cache + backend + client fallback
    const queryA = `${trackA.name} ${trackA.artists?.[0]?.name || ''}`.trim();
    const queryB = `${trackB.name} ${trackB.artists?.[0]?.name || ''}`.trim();

    let videoIdA =
      trackA.id === this.currentTrackId && this.currentVideoId
        ? this.currentVideoId
        : await this.resolveVideoId(queryA, trackA.id);

    let videoIdB = await this.resolveVideoId(queryB, trackB.id);

    if (!videoIdA || !videoIdB) {
      this.isAuditioning = false;
      return false; // Fallback to acoustic synthesis
    }

    // Compute DJ timing parameters
    const tempoA = config.tempoA || 128;
    const safeTempo = tempoA > 40 && tempoA < 240 ? tempoA : 128;
    const barSec = (4 * 60) / safeTempo;
    const transitionDur = Math.max(2.0, Math.min(16.0, barSec * (config.compases || 2)));
    const leadInSec = 1.2;
    const leadOutSec = 2.0;
    const totalSec = leadInSec + transitionDur + leadOutSec;

    const durA = (trackA.duration_ms || 210000) / 1000;
    // Seek Track A right to its finale/outro so the transition captures the real ending
    const startSecA = Math.max(0, Math.round(durA - (transitionDur + leadInSec + 1.5)));
    const startSecB = 0;

    await this.ensureYouTubeReady();
    const p0 = this.ytPlayers[0];
    const p1 = this.ytPlayers[1];

    if (!p0 || !p1) {
      this.isAuditioning = false;
      return false;
    }

    // Reset playback rates
    try {
      if (typeof p0.setPlaybackRate === 'function') p0.setPlaybackRate(1);
      if (typeof p1.setPlaybackRate === 'function') p1.setPlaybackRate(1);
    } catch {}

    // Deck A (Track A): 100% volume, start near the end
    try {
      if (typeof p0.unMute === 'function') p0.unMute();
      if (typeof p0.setVolume === 'function') p0.setVolume(100);
      p0.loadVideoById({ videoId: videoIdA, startSeconds: startSecA });
      p0.playVideo();
    } catch {}

    // Deck B (Track B): cued, muted
    try {
      if (typeof p1.unMute === 'function') p1.unMute();
      if (typeof p1.setVolume === 'function') p1.setVolume(0);
      p1.loadVideoById({ videoId: videoIdB, startSeconds: startSecB });
      p1.pauseVideo();
    } catch {}

    const startTime = Date.now();
    let startedB = false;
    const totalDurationMs = totalSec * 1000;

    this.auditionInterval = window.setInterval(() => {
      if (!this.isAuditioning) {
        this.stopTransitionAudition();
        return;
      }

      const elapsedMs = Date.now() - startTime;
      const elapsedSec = elapsedMs / 1000;
      const progress = Math.min(1.0, Math.max(0.0, elapsedMs / totalDurationMs));
      onProgress(progress);

      // Phase 1: Lead-in (Song A outro playing solo)
      if (elapsedSec < leadInSec) {
        if (typeof p0.setVolume === 'function') p0.setVolume(100);
        if (typeof p1.setVolume === 'function') p1.setVolume(0);
      }
      // Phase 2: Active DJ Transition Window
      else if (elapsedSec < leadInSec + transitionDur) {
        if (!startedB) {
          startedB = true;
          try { p1.playVideo(); } catch {}
        }

        const pMix = Math.min(1.0, Math.max(0.0, (elapsedSec - leadInSec) / transitionDur));
        let outVol = 1.0;
        let inVol = pMix;

        if (config.volumeEnvelope === 'superposicion' || config.preset === 'automatica') {
          outVol = pMix <= 0.5 ? 1.0 : Math.cos((pMix - 0.5) * Math.PI);
          inVol = pMix;
        } else if (config.volumeEnvelope === 'corte_directo' || config.preset === 'corte') {
          outVol = pMix < 0.5 ? 1.0 : 0.0;
          inVol = pMix < 0.5 ? 0.0 : 1.0;
        } else if (config.preset === 'crescendo') {
          outVol = Math.cos(pMix * 0.5 * Math.PI);
          inVol = Math.pow(pMix, 1.8);
        } else {
          // Lineal
          outVol = 1.0 - pMix;
          inVol = pMix;
        }

        // Bass Swap / Low-pass Filter EQ logic
        if (config.eqMode === 'intercambio_graves_central' || config.preset === 'automatica') {
          if (pMix < 0.5) {
            inVol = inVol * 0.65;
          } else {
            outVol = outVol * 0.35;
          }
        } else if (config.eqMode === 'filtro_paso_bajo' || config.preset === 'filtro') {
          outVol = outVol * (1.0 - pMix * 0.6);
        }

        // DJ FX 1: Turntable / Vinyl Brake (Freno de vinilo)
        if (config.preset === 'freno_vinilo' || config.fxMode === 'freno_vinilo') {
          const remainingSec = (leadInSec + transitionDur) - elapsedSec;
          if (remainingSec <= 0.7 && remainingSec > 0.25) {
            try { if (typeof p0.setPlaybackRate === 'function') p0.setPlaybackRate(0.5); } catch {}
          } else if (remainingSec <= 0.25 && remainingSec > 0) {
            try { if (typeof p0.setPlaybackRate === 'function') p0.setPlaybackRate(0.25); } catch {}
            outVol = Math.max(0, outVol * (remainingSec / 0.25));
          } else if (remainingSec <= 0) {
            try { if (typeof p0.pauseVideo === 'function') p0.pauseVideo(); } catch {}
            try { if (typeof p0.setPlaybackRate === 'function') p0.setPlaybackRate(1); } catch {}
          }
        }

        // DJ FX 2: Beat Roll / Stutter loop acceleration
        if (config.preset === 'beat_roll' || config.fxMode === 'repeticion_loop') {
          const beatSec = 60 / safeTempo;
          const progressInPhase = elapsedSec - leadInSec;
          if (progressInPhase > transitionDur * 0.5) {
            const rollRate = progressInPhase > transitionDur * 0.75 ? beatSec / 8 : beatSec / 4;
            const rollTick = (progressInPhase % rollRate) / rollRate;
            if (rollTick > 0.5) {
              outVol = outVol * 0.25;
            }
          }
        }

        // DJ FX 3: Echo Out tail
        if (config.preset === 'eco_out' || config.fxMode === 'eco') {
          outVol = Math.pow(Math.max(0, 1.0 - pMix), 2.2);
        }

        if (typeof p0.setVolume === 'function') p0.setVolume(Math.round(Math.max(0, Math.min(1, outVol)) * 100));
        if (typeof p1.setVolume === 'function') p1.setVolume(Math.round(Math.max(0, Math.min(1, inVol)) * 100));
      }
      // Phase 3: Lead-out (Song B playing solo at full volume)
      else if (elapsedSec < totalSec) {
        if (typeof p0.setVolume === 'function') p0.setVolume(0);
        try { p0.pauseVideo(); } catch {}
        try { if (typeof p0.setPlaybackRate === 'function') p0.setPlaybackRate(1); } catch {}
        if (typeof p1.setVolume === 'function') p1.setVolume(100);
      }
      // Phase 4: Completed
      else {
        this.stopTransitionAudition();
        onEnded();
      }
    }, 35);

    return true;
  }

  public stopTransitionAudition(): void {
    this.isAuditioning = false;
    if (this.auditionInterval !== null) {
      clearInterval(this.auditionInterval);
      this.auditionInterval = null;
    }
    for (const p of this.ytPlayers) {
      if (p) {
        try {
          if (typeof p.setPlaybackRate === 'function') p.setPlaybackRate(1);
          if (typeof p.setVolume === 'function') p.setVolume(0);
          if (typeof p.pauseVideo === 'function') p.pauseVideo();
        } catch {}
      }
    }
    for (const a of this.audios) {
      if (a) {
        try {
          a.volume = 0;
          a.pause();
        } catch {}
      }
    }
  }

  constructor() {
    this.audios = [new Audio(), new Audio()];
    this.audios[0].preload = 'auto';
    this.audios[1].preload = 'auto';

    this.setupHtml5Listeners();

    if (typeof window !== 'undefined') {
      try {
        this.carrierAudio = new Audio('/silence.wav');
        this.carrierAudio.loop = true;
        this.carrierAudio.volume = 0.01;
        this.carrierAudio.preload = 'auto';
      } catch {}
    }

    if (typeof window !== 'undefined') {
      // Unlock audio context on user gesture for mobile / PWA
      const unlockUserMedia = () => {
        this.unlockAudio();
      };
      window.addEventListener('click', unlockUserMedia, { passive: true });
      window.addEventListener('touchstart', unlockUserMedia, { passive: true });

      // Handle visibility changes: when the user comes back to the app,
      // ensure audio is still playing and not muted (mobile browsers sometimes
      // mute or pause the YT iframe when returning from background).
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          // Tab/app became visible again — restore playback if it was supposed to be playing
          const { isPlaying } = usePlayerStore.getState();
          if (isPlaying) {
            if (this.activeEngine === 'html5' && this.audio.paused) {
              // HTML5 audio was paused while in background — resume it
              this.audio.play().catch(() => {});
            } else if (this.activeEngine === 'youtube' && this.ytPlayer) {
              try {
                // Unmute and restore volume first
                if (typeof this.ytPlayer.unMute === 'function') {
                  this.ytPlayer.unMute();
                  const { volume, isMuted } = usePlayerStore.getState();
                  if (!isMuted) this.ytPlayer.setVolume(Math.round(volume * 100));
                }
                // Check if player is paused/stopped and resume if needed
                const ytState = typeof this.ytPlayer.getPlayerState === 'function'
                  ? this.ytPlayer.getPlayerState() : -1;
                // States: -1=unstarted, 0=ended, 1=playing, 2=paused, 3=buffering, 5=cued
                if (ytState === 2 || ytState === -1) {
                  // Was paused by the browser — resume it
                  this.ytPlayer.playVideo();
                }
              } catch {}
            }
            // Always re-signal mediaSession that we're playing
            if ('mediaSession' in navigator) {
              try { navigator.mediaSession.playbackState = 'playing'; } catch {}
            }
          }
        } else {
          // App going to background — make sure mediaSession is set to 'playing'
          // so Android knows NOT to stop the audio
          const { isPlaying } = usePlayerStore.getState();
          if (isPlaying && 'mediaSession' in navigator) {
            try { navigator.mediaSession.playbackState = 'playing'; } catch {}
          }
        }
      });

      // Pre-warm YouTube IFrame API immediately in background across ALL platforms
      // (Desktop, Mobile, PWA) so tracks begin instantly with 0ms cold-start latency!
      setTimeout(() => {
        this.ensureYouTubeReady().catch(() => {});
      }, 50);
    }
  }

  /** Detect mobile devices or PWA standalone mode */
  public isMobileOrPWA(): boolean {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
      (window as any).navigator?.standalone === true
    );
  }



  private ensureYouTubeReady(): Promise<void> {
    if (typeof window === 'undefined') return Promise.resolve();
    if (this.isYtReady && this.ytPlayers[0] && this.ytPlayers[1]) return Promise.resolve();
    if (this.ytReadyPromise) return this.ytReadyPromise;

    this.ytReadyPromise = new Promise<void>((resolve) => {
      let isDone = false;
      const finish = () => {
        if (!isDone) {
          isDone = true;
          this.isYtReady = true;
          resolve();
        }
      };

      // Safety timeout: Never hang for more than 2000ms
      const safetyTimeout = setTimeout(finish, 2000);

      const initPlayer = () => {
        try {
          let host = document.getElementById('spotifree-yt-player-host');
          if (!host) {
            host = document.createElement('div');
            host.id = 'spotifree-yt-player-host';
            host.style.cssText =
              'position:fixed;bottom:0px;right:0px;width:64px;height:64px;opacity:0.02;pointer-events:none;z-index:-1;overflow:hidden;';
            document.body.appendChild(host);
          }

          let playerDiv0 = document.getElementById('spotifree-yt-player-0');
          if (!playerDiv0) {
            playerDiv0 = document.createElement('div');
            playerDiv0.id = 'spotifree-yt-player-0';
            host.appendChild(playerDiv0);
          }

          let playerDiv1 = document.getElementById('spotifree-yt-player-1');
          if (!playerDiv1) {
            playerDiv1 = document.createElement('div');
            playerDiv1.id = 'spotifree-yt-player-1';
            host.appendChild(playerDiv1);
          }

          if (!(window as any).YT || !(window as any).YT.Player) {
            setTimeout(initPlayer, 200);
            return;
          }

          const createPlayerInstance = (divId: string, index: 0 | 1) => {
            return new (window as any).YT.Player(divId, {
              height: '64',
              width: '64',
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
                  try {
                    const iframe = document.getElementById(divId);
                    if (iframe) {
                      iframe.setAttribute('allow', 'autoplay *; encrypted-media *; fullscreen *');
                    }
                  } catch {}
                  if (index === 0) {
                    clearTimeout(safetyTimeout);
                    const { volume, isMuted } = usePlayerStore.getState();
                    if (this.ytPlayers[0] && typeof this.ytPlayers[0].setVolume === 'function') {
                      this.ytPlayers[0].setVolume(isMuted ? 0 : Math.round(volume * 100));
                    }
                    finish();
                  }
                },
                onStateChange: (event: any) => {
                  this.handleYtStateChange(event, index);
                },
                onError: (_event: any) => {
                  if (index === this.activeYtIndex) {
                    if (this.currentVideoId) this.failedVideoIds.add(this.currentVideoId);
                    if (this.currentTrackQuery) {
                      this.resolveAndPlayAlternate(this.currentTrackQuery, this.currentVideoId || undefined);
                    }
                  }
                },
              },
            });
          };

          this.ytPlayers[0] = createPlayerInstance('spotifree-yt-player-0', 0);
          this.ytPlayers[1] = createPlayerInstance('spotifree-yt-player-1', 1);
        } catch (err) {
          console.warn('[AudioEngine] Failed to initialize YouTube players:', err);
          clearTimeout(safetyTimeout);
          finish();
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
    if (!this.ytPlayer || this.isCrossfading || this.isTransitioning || this.isSeeking) return;
    try {
      const duration = typeof this.ytPlayer.getDuration === 'function' ? this.ytPlayer.getDuration() : 0;
      const expectedTrackMs = usePlayerStore.getState().currentTrack?.duration_ms || 0;

      // Real music tracks are never fast-forwarded! If duration > 45s, this is the song.
      if (duration > 45 || (expectedTrackMs > 0 && Math.abs(duration - expectedTrackMs / 1000) < 30)) {
        const data = typeof this.ytPlayer.getVideoData === 'function' ? this.ytPlayer.getVideoData() : null;
        if (data && data.video_id && data.video_id !== this.currentVideoId) {
          // Keep currentVideoId synchronized with YouTube's canonical ID for the track
          this.currentVideoId = data.video_id;
        }

        const { volume, isMuted } = usePlayerStore.getState();
        if (typeof this.ytPlayer.unMute === 'function' && !isMuted && typeof this.ytPlayer.isMuted === 'function' && this.ytPlayer.isMuted()) {
          this.ytPlayer.unMute();
          this.ytPlayer.setVolume(Math.round(volume * 100));
        }
        return;
      }

      // Pre-roll advertisement (< 45s while real song is > 60s) — mute and fast-forward past it
      const data = typeof this.ytPlayer.getVideoData === 'function' ? this.ytPlayer.getVideoData() : null;
      if (data && data.video_id && this.currentVideoId && data.video_id !== this.currentVideoId && duration > 0 && duration <= 45 && expectedTrackMs > 60000) {
        if (typeof this.ytPlayer.mute === 'function') this.ytPlayer.mute();
        this.ytPlayer.seekTo(duration, true);
      }
    } catch {}
  }

  private handleYtStateChange(event: any, playerIndex: 0 | 1 = 0) {
    const code = event.data;
    // 1: PLAYING, 2: PAUSED, 0: ENDED, 3: BUFFERING, -1: UNSTARTED
    if (playerIndex !== this.activeYtIndex) {
      // Secondary player state change during crossfade
      return;
    }

    if (code === 1) {
      this.isTransitioning = false;
      this.isExplicitlyPaused = false;
      this.startCarrier();
      this.checkAndSkipAd();
      usePlayerStore.setState({ isPlaying: true });
      this.startProgressTicker();
      if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
        try { navigator.mediaSession.playbackState = 'playing'; } catch {}
      }
    } else if (code === 2) {
      if (this.isExplicitlyPaused || !usePlayerStore.getState().isPlaying) {
        this.stopCarrier();
        this.stopProgressTicker();
        if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
          try { navigator.mediaSession.playbackState = 'paused'; } catch {}
        }
        return;
      }

      if (typeof document !== 'undefined' && document.hidden && usePlayerStore.getState().isPlaying && !this.isExplicitlyPaused) {
        try {
          if (this.ytPlayer && typeof this.ytPlayer.playVideo === 'function') {
            this.ytPlayer.playVideo();
          }
          if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
            navigator.mediaSession.playbackState = 'playing';
          }
        } catch (_) {}
        return;
      }

      if (!this.isTransitioning && !this.isCrossfading) {
        this.stopCarrier();
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
      if (this.isCrossfading) {
        // Complete crossfade cleanly if primary track naturally reached end during transition
        this.finishCrossfade();
        return;
      }

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
          if (!this.isCrossfading && typeof this.ytPlayer.isMuted === 'function' && this.ytPlayer.isMuted()) {
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
            if (isFinite(curSec) && !this.isCrossfading) this.checkCrossfade(curSec, durSec);
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
    this.audios.forEach((audioEl, idx) => {
      audioEl.addEventListener('timeupdate', () => {
        if (this.activeEngine === 'html5' && this.activeAudioIndex === idx && !this.isSeeking) {
          const cur = audioEl.currentTime;
          usePlayerStore.getState().setProgress(cur * 1000);
          const dur = audioEl.duration;
          if (dur && isFinite(dur) && !this.isCrossfading) {
            this.checkCrossfade(cur, dur);
          }
        }
      });

      audioEl.addEventListener('durationchange', () => {
        if (this.activeEngine === 'html5' && this.activeAudioIndex === idx && audioEl.duration && isFinite(audioEl.duration) && audioEl.duration > 0) {
          usePlayerStore.getState().setDuration(audioEl.duration * 1000);
        } else if (this.activeEngine === 'html5' && this.activeAudioIndex === idx) {
          const trackDur = usePlayerStore.getState().currentTrack?.duration_ms;
          if (trackDur && trackDur > 0) {
            usePlayerStore.getState().setDuration(trackDur);
          }
        }
      });

      audioEl.addEventListener('ended', () => {
        if (this.activeEngine !== 'html5' || this.activeAudioIndex !== idx) return;
        if (this.isCrossfading) {
          this.finishCrossfade();
          return;
        }
        const state = usePlayerStore.getState();
        if (state.repeatMode === 'one') {
          audioEl.currentTime = 0;
          audioEl.play().catch(() => {});
        } else {
          state.nextTrack();
        }
      });

      audioEl.addEventListener('play', () => {
        if (this.activeEngine === 'html5' && this.activeAudioIndex === idx && !usePlayerStore.getState().isPlaying) {
          usePlayerStore.setState({ isPlaying: true });
        }
      });

      audioEl.addEventListener('pause', () => {
        if (this.activeEngine === 'html5' && this.activeAudioIndex === idx && usePlayerStore.getState().isPlaying && !this.isCrossfading && !this.isTransitioning) {
          usePlayerStore.setState({ isPlaying: false });
        }
      });
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

      this.compressorNode = this.audioContext.createDynamicsCompressor();
      const normalizeSaved = typeof window !== 'undefined' ? window.localStorage.getItem('spotifree_normalize_volume') : null;
      const isNorm = normalizeSaved !== 'false';
      this.compressorNode.threshold.value = isNorm ? -24 : 0;
      this.compressorNode.ratio.value = isNorm ? 12 : 1;
      lastNode.connect(this.compressorNode);
      this.compressorNode.connect(this.audioContext.destination);
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
        signal: AbortSignal.timeout?.(1500),
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
        signal: AbortSignal.timeout?.(1500),
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

  /** Unified Video ID resolution: Cache -> Local Backend Scrape -> Client Fallback */
  public async resolveVideoId(query: string, trackId?: string): Promise<string | null> {
    if (!query) return null;
    const cleanQuery = query.trim();
    const cached = VIDEO_ID_CACHE.get(cleanQuery);
    if (cached) return cached;

    // 1. Try local server backend API (/api/audio/resolve)
    try {
      const url = `${API_BASE}/api/audio/resolve?q=${encodeURIComponent(cleanQuery)}${trackId ? `&trackId=${encodeURIComponent(trackId)}` : ''}`;
      const res = await fetch(url, { signal: AbortSignal.timeout ? AbortSignal.timeout(3000) : undefined });
      if (res.ok) {
        const data = await res.json();
        if (data && data.videoId) {
          persistVideoId(cleanQuery, data.videoId);
          return data.videoId;
        }
      }
    } catch {}

    // 2. Client-side fallback
    try {
      const clientVid = await this.resolveVideoIdClient(cleanQuery);
      if (clientVid) {
        persistVideoId(cleanQuery, clientVid);
        return clientVid;
      }
    } catch {}

    return null;
  }

  public async playTrack(trackId: string, query: string, startSeconds = 0) {
    if (this.crossfadeInterval !== null) {
      clearInterval(this.crossfadeInterval);
      this.crossfadeInterval = null;
    }
    this.isCrossfading = false;
    this.preloadedNext = null;

    // Stop secondary player
    const secYt = this.secondaryYtPlayer;
    if (secYt && typeof secYt.stopVideo === 'function') {
      try { secYt.stopVideo(); } catch {}
    }
    const secAudio = this.secondaryAudio;
    if (secAudio) {
      try { secAudio.pause(); secAudio.currentTime = 0; } catch {}
    }

    this.currentTrackId = trackId;
    this.currentTrackQuery = query;
    this.failedVideoIds.clear();
    this.isSeeking = false;
    this.isTransitioning = true;
    this.isExplicitlyPaused = false;

    usePlayerStore.getState().setProgress(startSeconds * 1000);
    // Start silent carrier audio synchronously during the user gesture.
    // This establishes top-level document MediaSession ownership in Brave / Android!
    this.startCarrier();

    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      try { navigator.mediaSession.playbackState = 'playing'; } catch {}
    }

    try {
      // 0. Check offline storage ("musica-spotifree")
      try {
        const offlineBlobUrl = await getDownloadedTrackBlobUrl(trackId);
        if (offlineBlobUrl || (typeof navigator !== 'undefined' && !navigator.onLine)) {
          if (offlineBlobUrl) {
            this.activeEngine = 'html5';
            this.audio.src = offlineBlobUrl;
            this.audio.currentTime = startSeconds;
            await this.audio.play();
            this.startCarrier();
            usePlayerStore.setState({ isPlaying: true });
            this.isTransitioning = false;
            return;
          }
        }
      } catch {}

      // 1. Resolve videoId instantly via unified cache & resolver
      let videoId = await this.resolveVideoId(query, trackId);

      if (videoId) {
        this.currentVideoId = videoId;
        this.activeEngine = 'youtube';
        await this.ensureYouTubeReady();

        if (this.ytPlayer && typeof this.ytPlayer.loadVideoById === 'function') {
          this.audio.pause();

          const { volume, isMuted } = usePlayerStore.getState();
          if (typeof this.ytPlayer.setVolume === 'function') {
            this.ytPlayer.setVolume(isMuted ? 0 : Math.round(volume * 100));
          }

          this.ytPlayer.loadVideoById({ videoId, startSeconds });
          this.ytPlayer.playVideo();
          this.startCarrier();
          usePlayerStore.setState({ isPlaying: true });
          this.startProgressTicker();

          // Ensure MediaSession is instantly marked playing with duration
          if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
            try {
              navigator.mediaSession.playbackState = 'playing';
            } catch (_) {}
          }

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
        if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
          try { navigator.mediaSession.playbackState = 'playing'; } catch (_) {}
        }
      }
    } catch (e) {
      console.warn('[AudioEngine] Alternate resolve error:', e);
    }
  }

    public startCarrier() {
    if (typeof window === 'undefined') return;
    if (this.carrierAudio) {
      try {
        if (this.carrierAudio.paused) {
          this.carrierAudio.play().catch(() => {});
        }
      } catch {}
    }
    this.startBackgroundCarrier();
  }

  public stopCarrier() {
    if (this.carrierAudio) {
      try {
        this.carrierAudio.pause();
      } catch {}
    }
    this.stopBackgroundCarrier();
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
      this.startCarrier();
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
      if (this.ytPlayer && typeof this.ytPlayer.unMute === 'function') {
        this.ytPlayer.unMute();
        const { volume, isMuted } = usePlayerStore.getState();
        if (!isMuted) this.ytPlayer.setVolume(Math.round(volume * 100));
      }
    } catch {}
  }

  public togglePlay() {
    const isPlaying = usePlayerStore.getState().isPlaying;
    if (isPlaying) {
      this.pause();
    } else {
      this.resume();
    }
  }

  public pause() {
    this.isExplicitlyPaused = true;
    this.stopCarrier();
    if (this.activeEngine === 'youtube') {
      if (this.ytPlayers[0] && typeof this.ytPlayers[0].pauseVideo === 'function') {
        try { this.ytPlayers[0].pauseVideo(); } catch {}
      }
      if (this.ytPlayers[1] && typeof this.ytPlayers[1].pauseVideo === 'function') {
        try { this.ytPlayers[1].pauseVideo(); } catch {}
      }
      this.stopProgressTicker();
    }
    if (this.audios[0]) {
      try { this.audios[0].pause(); } catch {}
    }
    if (this.audios[1]) {
      try { this.audios[1].pause(); } catch {}
    }
    usePlayerStore.setState({ isPlaying: false });
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      try { navigator.mediaSession.playbackState = 'paused'; } catch {}
    }
  }

  public resume() {
    this.isExplicitlyPaused = false;
    this.startCarrier();
    const { volume, isMuted } = usePlayerStore.getState();
    const targetVol = isMuted ? 0 : volume;

    if (this.activeEngine === 'youtube') {
      const currentTrack = usePlayerStore.getState().currentTrack;
      if (!this.currentVideoId && currentTrack) {
        const artistName = currentTrack.artists?.[0]?.name || '';
        const query = `${currentTrack.name} ${artistName}`.trim();
        const startSec = Math.floor((usePlayerStore.getState().progressMs || 0) / 1000);
        this.playTrack(currentTrack.id, query, startSec);
        return;
      }
      if (this.ytPlayer && typeof this.ytPlayer.playVideo === 'function') {
        try {
          if (typeof this.ytPlayer.unMute === 'function') {
            this.ytPlayer.unMute();
          }
          if (!this.isCrossfading && typeof this.ytPlayer.setVolume === 'function') {
            this.ytPlayer.setVolume(Math.round(targetVol * 100));
          }
          this.ytPlayer.playVideo();
          if (this.isCrossfading && this.secondaryYtPlayer && typeof this.secondaryYtPlayer.playVideo === 'function') {
            this.secondaryYtPlayer.playVideo();
          }
          this.startProgressTicker();
        } catch {}
        usePlayerStore.setState({ isPlaying: true });
        if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
          try { navigator.mediaSession.playbackState = 'playing'; } catch {}
        }
        return;
      }
    }

    if (this.audio) {
      if (!this.isCrossfading) {
        this.audio.volume = targetVol;
      }
      this.audio.play().catch(() => {});
      if (this.isCrossfading && this.secondaryAudio) {
        this.secondaryAudio.play().catch(() => {});
      }
    }
    usePlayerStore.setState({ isPlaying: true });
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      try { navigator.mediaSession.playbackState = 'playing'; } catch {}
    }
  }

  public seek(seconds: number) {
    if (!isFinite(seconds)) return;
    this.isSeeking = true;

    if (this.isCrossfading) {
      if (this.crossfadeInterval !== null) {
        clearInterval(this.crossfadeInterval);
        this.crossfadeInterval = null;
      }
      this.isCrossfading = false;
      const secYt = this.secondaryYtPlayer;
      if (secYt && typeof secYt.stopVideo === 'function') {
        try { secYt.stopVideo(); } catch {}
      }
      const secAudio = this.secondaryAudio;
      if (secAudio) {
        try { secAudio.pause(); secAudio.currentTime = 0; } catch {}
      }
      const { volume, isMuted } = usePlayerStore.getState();
      this.setVolume(isMuted ? 0 : volume);
    }

    if (this.ytPlayer && typeof this.ytPlayer.seekTo === 'function') {
      try {
        this.ytPlayer.seekTo(seconds, true);
      } catch {}
    } else {
      this.audio.currentTime = seconds;
    }

    usePlayerStore.getState().setProgress(seconds * 1000);

    // Update MediaSession position state
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator && (navigator.mediaSession as any).setPositionState) {
      try {
        const dur = this.getDuration();
        if (dur > 0) {
          (navigator.mediaSession as any).setPositionState({
            duration: dur,
            playbackRate: 1,
            position: Math.max(0, seconds),
          });
        }
      } catch (_) {}
    }

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


  public setVolumeNormalization(enabled: boolean) {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem('spotifree_normalize_volume', String(enabled));
      } catch {}
    }
    this.initAudioContext();
    if (this.compressorNode && this.audioContext) {
      try {
        if (enabled) {
          this.compressorNode.threshold.setValueAtTime(-24, this.audioContext.currentTime);
          this.compressorNode.ratio.setValueAtTime(12, this.audioContext.currentTime);
        } else {
          this.compressorNode.threshold.setValueAtTime(0, this.audioContext.currentTime);
          this.compressorNode.ratio.setValueAtTime(1, this.audioContext.currentTime);
        }
      } catch {}
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
        const d = this.ytPlayer.getDuration();
        if (d && isFinite(d) && d > 0) return d;
      } catch {}
    }
    const stateDur = (usePlayerStore.getState().durationMs || 0) / 1000;
    if (stateDur > 0) return stateDur;
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
