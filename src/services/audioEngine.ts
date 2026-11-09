/**
 * Spotifree High-Performance Audio Engine
 * Pure full-track audio playback with zero 30-second clips and automatic ad skipping.
 * Fully compatible with Mobile browsers, PWA, and Desktop.
 */

import { usePlayerStore } from '../store/usePlayerStore';
import type { Track } from '../types/spotify';
import { API_BASE } from '../config';
import { getDownloadedTrackBlobUrl, purgeCorruptedPreviewAudio } from '../utils/offlineStorage';
import { getLocalTrackUrl, isLocalTrackId } from '../utils/localFiles';
import { DEVICE_PREFIX, findDeviceMatch, getDeviceTrackUrl } from '../utils/nativeLocalMusic';
import { djTransitionService, type DJTransitionConfig } from './djTransitionService';
import { getTrackAnalysis, snapToBarGrid } from '../utils/audioFeatures';
import { EQ_CHANGED_EVENT, effectiveEqGains } from '../utils/eqSettings';
import { analyzeTrackAudio } from './trackAnalysisService';
import { showGlobalToast } from '../utils/globalToast';
import { cancelNativeTransitionFx, nativeTransitionFx } from './nativeAudioFx';
import { sleepTimerHoldsTransition } from './sleepTimer';
import { useLanguageStore } from '../utils/i18n';
import { computeTransitionGains, djFxLevelGain, recordTransitionUsed, transitionFXLayers } from './djMixPlanner';
import {
  createDJChannelStrip,
  scheduleBassSwap,
  scheduleResonantHPFSweep,
  scheduleResonantLPFSweep,
  scheduleBeatDelay,
  scheduleLoopStutter,
  cancelScheduledAutomations,
  playTransitionLayers,
  stopAuxiliaryTransitionFX,
  type DJChannelStrip,
  type ActiveAuxFX,
} from './djAudioNodes';

const VIDEO_ID_CACHE = new Map<string, string>();

function getVerifiedVideoId(q: string, title: string = '', artist: string = ''): string | null {
  if (!q && !title) return null;
  const full = `${q} ${title} ${artist}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  // ONLY match Quevedo - La Graciosa if BOTH Quevedo AND Graciosa are in the query
  if (full.includes('graciosa') && (full.includes('quevedo') || full.includes('elvis crespo') || full.includes('buenas noches'))) {
    return 'LZPLBSRnxSY';
  }
  // ONLY match Quevedo - Planteamiento Erróneo if BOTH Quevedo AND Planteamiento are in the query
  if (full.includes('planteamiento') && (full.includes('quevedo') || full.includes('erroneo') || full.includes('buenas noches'))) {
    return 'aWewyeC49e8';
  }
  return null;
}

// Initialize persistent cache from localStorage (v2 clean cache to discard obsolete/ad mappings)
if (typeof window !== 'undefined') {
  try {
    purgeCorruptedPreviewAudio().catch(() => {});
    // Purge legacy cache v1 which may contain bad/ad video IDs
    window.localStorage.removeItem('spotifree_yt_cache');
    // v3: the resolver now prefers audio-only uploads; v2 mappings were often video clips
    window.localStorage.removeItem('spotifree_yt_cache_v2');
    const saved = window.localStorage.getItem('spotifree_yt_cache_v3');
    if (saved) {
      const parsed = JSON.parse(saved);
      Object.entries(parsed).forEach(([k, v]) => {
        if (typeof v === 'string') {
          // Purge corrupted cached mappings for known tracks
          if (k.toLowerCase().includes('planteamiento') && v !== 'aWewyeC49e8') {
            return;
          }
          VIDEO_ID_CACHE.set(k, v);
        }
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
      window.localStorage.setItem('spotifree_yt_cache_v3', JSON.stringify(obj));
    } catch {}
  }
}

/** One upload of a song, as ranked by /api/audio/candidates */
export interface SourceCandidate {
  videoId: string;
  title: string;
  artist: string;
  durationSec: number;
  /** 'audio' = the song's audio-only upload (YouTube Music "song"), 'video' = video clip / other */
  kind: 'audio' | 'video';
  score: number;
  /** Same song (title/artist/length agree) */
  match: boolean;
}

// Source the user picked by hand for a song (trackId -> videoId), always used for that song
const SOURCE_OVERRIDE_KEY = 'spotifree_source_overrides';
function readOverrides(): Record<string, string> {
  try {
    return JSON.parse(window.localStorage.getItem(SOURCE_OVERRIDE_KEY) || '{}') || {};
  } catch {
    return {};
  }
}
export function getSourceOverride(trackId?: string | null): string | null {
  if (!trackId || typeof window === 'undefined') return null;
  const id = trackId.replace(/^spotify:track:/i, '');
  return readOverrides()[id] || null;
}
export function setSourceOverride(trackId: string, videoId: string | null) {
  if (typeof window === 'undefined') return;
  const id = trackId.replace(/^spotify:track:/i, '');
  const all = readOverrides();
  if (videoId) all[id] = videoId;
  else delete all[id];
  const keys = Object.keys(all);
  if (keys.length > 800) for (const k of keys.slice(0, keys.length - 800)) delete all[k];
  try {
    window.localStorage.setItem(SOURCE_OVERRIDE_KEY, JSON.stringify(all));
  } catch {}
}

function normWords(s: string): string[] {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\(.*?\)|\[.*?\]/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !['feat', 'the', 'con', 'and', 'los', 'las', 'del', 'remastered', 'version', 'remaster'].includes(w));
}

/**
 * Is a YouTube video (title, channel, length) really this song?
 * Different song: neither title words nor artist words appear. Different version: the video is
 * much longer (clip with intro/outro, live) or shorter (cut) than the Spotify song.
 */
export function judgeSource(track: Track, ytTitle: string, ytAuthor: string, ytDurSec: number): { ok: boolean; reason: string } {
  const hay = new Set(normWords(`${ytTitle} ${ytAuthor}`));
  const hayStr = normWords(`${ytTitle} ${ytAuthor}`).join(' ');
  const tWords = normWords(track.name || '');
  const aWords = (track.artists || []).flatMap((a) => normWords(a.name || ''));
  const titleHit = tWords.length === 0 || tWords.some((w) => hay.has(w) || hayStr.includes(w));
  const artistHit = aWords.length === 0 || aWords.some((w) => hay.has(w) || hayStr.includes(w));
  if (!titleHit && !artistHit) return { ok: false, reason: 'otra canción' };
  if (!titleHit && tWords.length >= 2) return { ok: false, reason: 'título distinto' };
  const spDur = (track.duration_ms || 0) / 1000;
  if (spDur > 30 && ytDurSec > 30) {
    const diff = ytDurSec - spDur;
    if (diff > 25) return { ok: false, reason: `vídeo ${Math.round(diff)} s más largo (intro o videoclip)` };
    if (diff < -20) return { ok: false, reason: `vídeo ${Math.round(-diff)} s más corto` };
  }
  return { ok: true, reason: '' };
}

class AudioEngine {
  private audios: [HTMLAudioElement, HTMLAudioElement];
  private activeAudioIndex: 0 | 1 = 0;
  private carrierAudio: HTMLAudioElement | null = null;
  private isExplicitlyPaused = false;
  private wakeLockSentinel: any = null;

  private audioContext: AudioContext | null = null;
  private deckStrips: [DJChannelStrip | null, DJChannelStrip | null] = [null, null];
  private sourceNodes: [MediaElementAudioSourceNode | null, MediaElementAudioSourceNode | null] = [null, null];
  private masterGain: GainNode | null = null;
  private filterNodes: BiquadFilterNode[] = [];
  private compressorNode: DynamicsCompressorNode | null = null;
  private activeAuxFX: ActiveAuxFX | null = null;
  private currentTrackId: string | null = null;
  private currentTrackQuery: string | null = null;
  private currentVideoId: string | null = null;
  private isSeeking = false;
  private isTransitioning = false;
  private activeEngine: 'youtube' | 'html5' = 'youtube';
  private failedVideoIds: Set<string> = new Set();

  private ytPlayers: [any, any] = [null, null];
  private activeYtIndex: 0 | 1 = 0;
  private playSequenceId: number = 0;
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
  private auditionRestore: { videoId: string; sec: number; playerIndex: 0 | 1 } | null = null;
  private lastEndedTimestamp = 0;
  private consecutiveEndedCount = 0;
  public lastCrossfadeFinishTime = 0;
  public lastTrackStartTime = 0;
  private lastObservedSec = -1;
  private lastPreloadAttempt = 0;
  private lastObservedAdvanceTime = 0;
  private stuckRecoveryAttempts = 0;

  public get isTransitionActive(): boolean {
    return this.isCrossfading || this.isTransitioning || (Date.now() - this.lastCrossfadeFinishTime < 3000);
  }

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

  public get deckStrip0(): DJChannelStrip | null {
    return this.deckStrips[0];
  }

  public get deckStrip1(): DJChannelStrip | null {
    return this.deckStrips[1];
  }

  public get activeDeckStrip(): DJChannelStrip | null {
    return this.deckStrips[this.activeAudioIndex];
  }

  public get secondaryDeckStrip(): DJChannelStrip | null {
    return this.deckStrips[this.activeAudioIndex === 0 ? 1 : 0];
  }

  /**
   * User-configured crossfade length (1-12s). Matches the default (5s) shown in the settings UI,
   * and treats legacy "0" values (written when gapless was toggled off) as the default instead of 1s.
   */
  private getConfiguredCrossfadeSec(): number {
    const DEFAULT_SEC = 5;
    try {
      if (typeof window === 'undefined') return DEFAULT_SEC;
      const saved = window.localStorage.getItem('spotifree_crossfade_sec') || window.localStorage.getItem('spotifree_crossfade');
      const parsed = saved !== null ? parseInt(saved, 10) : NaN;
      if (!isFinite(parsed) || parsed <= 0) return DEFAULT_SEC;
      return Math.max(1, Math.min(12, parsed));
    } catch {
      return DEFAULT_SEC;
    }
  }

  private isDJModeEnabled(): boolean {
    if (typeof window === 'undefined') return false;
    try {
      return (
        window.localStorage.getItem('spotifree_dj_mode') === 'true' ||
        window.localStorage.getItem('spotifree_dj_mode_desktop') === 'true' ||
        Boolean((window as any).__useAIDJStore?.getState?.()?.isDJModeActive)
      );
    } catch {
      return false;
    }
  }

  private static cleanId(id?: string | null): string {
    return (id || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
  }

  private static isSameTrack(a?: Track | null, b?: Track | null): boolean {
    if (!a || !b) return false;
    return AudioEngine.cleanId(a.id) === AudioEngine.cleanId(b.id);
  }

  private checkCrossfade(curSec: number, durSec: number) {
    if (this.isAuditioning || this.isSeeking || !durSec || durSec < 15) return;
    // Sleep timer about to stop the music: no mix into the next song
    if (sleepTimerHoldsTransition()) return;

    const state = usePlayerStore.getState();
    // CRITICAL FIX: If single track repeat (repeatMode === 'one') is active, DO NOT trigger crossfade or transitions!
    // Crossfading into the exact same track fades out the volume and triggers silence.
    if (state.repeatMode === 'one') return;
    if (state.queue && state.queue.length <= 1 && state.repeatMode !== 'off') return;

    // NOTE: Gapless and crossfade are independent settings (as in Spotify). Crossfade is controlled
    // only by 'spotifree_crossfade_enabled', so turning gapless off no longer silently disables it.

    const isDjMode =
      typeof window !== 'undefined' &&
      (window.localStorage.getItem('spotifree_dj_mode') === 'true' ||
        window.localStorage.getItem('spotifree_dj_mode_desktop') === 'true' ||
        Boolean((window as any).__useAIDJStore?.getState?.()?.isDJModeActive));

    const crossfadeEnabledSaved = typeof window !== 'undefined'
      ? window.localStorage.getItem('spotifree_crossfade_enabled') !== 'false'
      : true;

    // Precedence Check: If neither DJ Mode nor Crossfade is enabled, exit immediately
    if (!isDjMode && !crossfadeEnabledSaved) return;

    const crossfadeSec = this.getConfiguredCrossfadeSec();

    const curTrack = state.currentTrack;
    const nextTrack = state.getNextTrack?.();
    // Songs from the phone's files play on their own: the next one starts when this one ends
    if (isLocalTrackId(curTrack?.id) || isLocalTrackId(nextTrack?.id) || findDeviceMatch(curTrack) || findDeviceMatch(nextTrack)) return;

    let djConfig: DJTransitionConfig | null = null;
    let effectiveCrossfade = crossfadeSec;

    // CRITICAL USER REQUIREMENT:
    // If BOTH DJ Mode and Crossfade are activated in settings:
    // DJ MODE PREVAILS (prevalece) while Crossfade does NOT act!
    if (isDjMode) {
      if (curTrack && nextTrack) {
        // Real measured BPM / key / energy + per-session variety (or the user's saved transition)
        djConfig = djTransitionService.getPlannedTransition(curTrack, nextTrack);
        effectiveCrossfade = djTransitionService.calculateDurationSeconds(djConfig.tempoA ?? 120, djConfig.compases);
      } else {
        effectiveCrossfade = 3.8;
      }
    } else {
      // Standard crossfade with user-configured duration (1s - 12s)
      effectiveCrossfade = crossfadeSec;
      djConfig = null;
    }

    if (effectiveCrossfade <= 0) return;
    // Opening seconds of a track, or recent crossfade completion, must NEVER trigger crossfade
    if (Date.now() - this.lastTrackStartTime < 5000) return;
    if (Date.now() - this.lastCrossfadeFinishTime < 15000) return;
    if (curSec < 10 || durSec < 20) return;

    // Silence Truncation & Outro Dead Air Elimination:
    // Spotify duration represents true studio audio length. YouTube videos often include
    // 5-25 seconds of outro cards, silent credits, or sponsors after the music ends.
    // Guard against 30s preview metadata (e.g. from iTunes / Apple Music): previews are NOT full studio duration.
    const isApplePreviewMs = Boolean(curTrack && curTrack.duration_ms > 0 && curTrack.duration_ms <= 35000);
    const spotifyDurationSec = curTrack && curTrack.duration_ms > 0 && !isApplePreviewMs ? curTrack.duration_ms / 1000 : durSec;
    let effectiveTrackEndSec =
      spotifyDurationSec > 45 && spotifyDurationSec < durSec - 2.0 && (durSec - spotifyDurationSec) < 120
        ? spotifyDurationSec
        : durSec;

    // DJ mode with real analysis: mix out where the music actually ends (not over silent tails),
    // and start the transition exactly on a bar line of song A.
    const curAnalysis = isDjMode && curTrack ? getTrackAnalysis(curTrack.id) : null;
    if (curAnalysis?.tempoSource === 'analysis' && typeof curAnalysis.musicEndSec === 'number') {
      if (curAnalysis.musicEndSec > 30 && curAnalysis.musicEndSec < effectiveTrackEndSec) {
        effectiveTrackEndSec = curAnalysis.musicEndSec;
      }
    } else if (isDjMode && effectiveTrackEndSec > 60) {
      // Where the music really ends is unknown (only the 30 s preview could be measured): most
      // songs close with a fade-out or a few silent seconds, and a mix that starts there is not
      // heard at all. Finish the mix a little before the end instead.
      effectiveTrackEndSec -= Math.min(7, Math.max(3, effectiveTrackEndSec * 0.025));
    }

    const remaining = Math.max(0, effectiveTrackEndSec - curSec);

    // Have the next song resolved and cued well before the mix (a mix waiting for the search
    // used to be skipped and the song simply ended). At most one attempt every 5 s, so a
    // failing search is not repeated on every tick.
    if (
      !this.preloadedNext &&
      !this.isPreloadingNext &&
      remaining <= Math.max(45, effectiveCrossfade + 30) &&
      Date.now() - this.lastPreloadAttempt > 5000
    ) {
      this.lastPreloadAttempt = Date.now();
      this.preloadUpcomingTracks();
    }

    // Bar line where the mix should start, only when the measured grid is reliable that late
    // in the song (a wrong "bar line" sounds worse than a plain start).
    const barAlignedStart =
      djConfig && !this.isCrossfading && curAnalysis
        ? snapToBarGrid(curAnalysis, effectiveTrackEndSec - effectiveCrossfade, 'floor')
        : null;
    if (djConfig && !this.isCrossfading && curAnalysis && barAlignedStart !== null) {
      const bar = 240 / curAnalysis.tempo;
      const onBar = barAlignedStart;
      if (onBar > 10 && curSec >= onBar && remaining > 0) {
        this.executeCrossfade(Math.min(effectiveCrossfade, Math.max(1.5, remaining)), djConfig);
        return;
      }
      if (remaining > effectiveCrossfade + bar) return; // wait for the bar line
    }

    // Start simultaneous dual-engine crossfade when remaining reaches effectiveCrossfade
    // If remaining time is shorter than calculated phrase, clamp duration without altering preset
    if (!this.isCrossfading && remaining > 0 && remaining <= effectiveCrossfade) {
      const clampedDuration = Math.min(effectiveCrossfade, Math.max(1.5, remaining));
      this.executeCrossfade(clampedDuration, djConfig);
    }
  }

  /**
   * Universal Background Preloader for upcoming tracks N+1 and N+2.
   * Ensures zero-lag skipping and flawless instantaneous transitions on both Mobile & Desktop.
   */
  public async preloadUpcomingTracks(tracksToPreload?: (Track | null | undefined)[]) {
    if (this.isPreloadingNext) return;
    // Never re-cue the secondary deck while it is audibly fading in (would restart the incoming song)
    if (this.isCrossfading) return;
    // A transition preview owns both decks: cueing the next song here replaced one of the
    // preview's songs with another song of the playlist
    if (this.isAuditioning) return;
    this.isPreloadingNext = true;
    // Snapshot of the playing track: if it changes while we await the resolver, the result is stale
    const ownerTrackId = this.currentTrackId;
    const ownerSeq = this.playSequenceId;
    try {
      const state = usePlayerStore.getState();
      if (state.repeatMode === 'one') {
        return;
      }

      let upcoming: Track[] = [];
      if (tracksToPreload && tracksToPreload.length > 0) {
        upcoming = tracksToPreload.filter((t): t is Track => Boolean(t && t.id !== this.currentTrackId));
      } else if (typeof state.getUpcomingTracks === 'function') {
        upcoming = state.getUpcomingTracks(2);
      } else {
        const t1 = state.getNextTrack?.();
        if (t1) upcoming.push(t1);
      }

      // Local files need no resolving or pre-cueing
      upcoming = upcoming.filter((t) => !isLocalTrackId(t.id) && !findDeviceMatch(t));
      if (upcoming.length === 0) return;

      // 1. Process track N+1 (pre-cue into inactive player without stealing audio focus)
      const next1 = upcoming[0];
      if (next1 && next1.id !== this.currentTrackId) {
        const artist1 = next1.artists?.[0]?.name || '';
        const query1 = `${next1.name} ${artist1}`.trim();
        let videoId1: string | null | undefined = VIDEO_ID_CACHE.get(query1);
        if (!videoId1) {
          const dur1 = next1.duration_ms ? next1.duration_ms / 1000 : undefined;
          videoId1 = (await this.resolveVideoId(query1, next1.id, next1.name, artist1, dur1)) || undefined;
        }

        // Discard stale preload: the song changed, a crossfade started, or the queue/shuffle order
        // changed while resolving. Otherwise the next crossfade would play a different song than the UI.
        const expectedNext = tracksToPreload && tracksToPreload.length > 0 ? next1 : usePlayerStore.getState().getNextTrack?.();
        if (
          this.isAuditioning ||
          this.currentTrackId !== ownerTrackId ||
          this.playSequenceId !== ownerSeq ||
          this.isCrossfading ||
          !AudioEngine.isSameTrack(expectedNext, next1)
        ) {
          return;
        }

        this.preloadedNext = {
          track: next1,
          videoId: videoId1 || undefined,
          query: query1,
        };

        // DJ mode: measure the real BPM / key / structure of the playing and the next song
        if (this.isDJModeEnabled()) {
          const cur = usePlayerStore.getState().currentTrack;
          if (cur) void analyzeTrackAudio(cur, { videoId: this.currentVideoId });
          void analyzeTrackAudio(next1, { videoId: videoId1 || null });
        }

        // Cue video on inactive secondary player ready for instant playback
        const secPlayer = this.secondaryYtPlayer;
        if (videoId1 && secPlayer && typeof secPlayer.cueVideoById === 'function') {
          try {
            secPlayer.cueVideoById({ videoId: videoId1, startSeconds: 0 });
          } catch {}
        }
      }

      // 2. Process track N+2 in background (resolve videoId and prime cache for instant subsequent skip)
      if (upcoming.length > 1) {
        const next2 = upcoming[1];
        if (next2 && next2.id !== this.currentTrackId) {
          const artist2 = next2.artists?.[0]?.name || '';
          const query2 = `${next2.name} ${artist2}`.trim();
          let videoId2: string | null | undefined = VIDEO_ID_CACHE.get(query2);
          if (!videoId2) {
            const dur2 = next2.duration_ms ? next2.duration_ms / 1000 : undefined;
            this.resolveVideoId(query2, next2.id, next2.name, artist2, dur2).then((vid) => {
              if (vid) {
                VIDEO_ID_CACHE.set(query2, vid);
              }
            }).catch(() => {});
          }
        }
      }
    } catch (e) {
      console.warn('[AudioEngine] Preload upcoming tracks error:', e);
    } finally {
      this.isPreloadingNext = false;
    }
  }

  public async preloadUpcomingTrack() {
    return this.preloadUpcomingTracks();
  }

  /**
   * Called when the queue order changes (shuffle on/off, smart shuffle, queue edits).
   * Drops a preloaded "next" song that is no longer next and cues the correct one.
   */
  public refreshPreloadForQueueChange() {
    if (this.isCrossfading) return;
    const expected = usePlayerStore.getState().getNextTrack?.();
    if (this.preloadedNext && AudioEngine.isSameTrack(this.preloadedNext.track, expected)) return;
    this.preloadedNext = null;
    if (expected) this.preloadUpcomingTracks();
  }

  private async executeCrossfade(crossfadeSec: number, djConfig: DJTransitionConfig | null = null) {
    const state = usePlayerStore.getState();
    if (state.repeatMode === 'one') {
      this.isCrossfading = false;
      return;
    }

    this.isCrossfading = true;
    const ownerTrackId = this.currentTrackId;
    const ownerSeq = this.playSequenceId;
    // If the preloaded song is no longer the real "next" (shuffle toggled, queue edited, smart shuffle
    // inserted a track...), drop it so the audio always matches the cover/lyrics shown afterwards.
    const expectedNext = state.getNextTrack?.();
    if (this.preloadedNext && !AudioEngine.isSameTrack(this.preloadedNext.track, expectedNext)) {
      this.preloadedNext = null;
    }

    if (!this.preloadedNext) {
      const nextTrack = expectedNext;
      if (!nextTrack || AudioEngine.cleanId(nextTrack.id) === AudioEngine.cleanId(this.currentTrackId)) {
        this.isCrossfading = false;
        return;
      }
      const artistName = nextTrack.artists?.[0]?.name || '';
      const query = `${nextTrack.name} ${artistName}`.trim();
      let videoId: string | null | undefined = VIDEO_ID_CACHE.get(query);

      if (!videoId) {
        const nextDur = nextTrack.duration_ms ? nextTrack.duration_ms / 1000 : undefined;
        videoId = (await this.resolveVideoId(query, nextTrack.id, nextTrack.name, artistName, nextDur)) || undefined;
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
      nextVideoId = (await this.resolveVideoId(query, nextTrack.id, nextTrack.name, artistName)) || undefined;
      if (nextVideoId && this.preloadedNext) {
        this.preloadedNext.videoId = nextVideoId;
      }
    }

    // A manual skip / new song started while we were resolving: abandon this crossfade
    if (this.isAuditioning || this.currentTrackId !== ownerTrackId || this.playSequenceId !== ownerSeq || !this.isCrossfading) {
      return;
    }

    if (this.activeEngine === 'youtube' && !nextVideoId) {
      this.isCrossfading = false;
      return;
    }

    const masterVolume = state.isMuted ? 0 : this.getEffectiveVolume();

    const secYt = this.secondaryYtPlayer;
    // DJ mode: song B enters where it makes sense (after a silent intro, or at its drop)
    const mixInSec = djConfig && typeof djConfig.mixInSec === 'number' && djConfig.mixInSec > 0 ? djConfig.mixInSec : 0;
    if (djConfig) {
      recordTransitionUsed(djConfig.preset, djConfig.intensity || 'smooth');
      console.info(`[DJ] ${djConfig.title || djConfig.preset} (${djConfig.compases} compases, B entra en ${mixInSec.toFixed(1)}s) — ${djConfig.reason || ''}`);
    }

    // Start secondary player at volume 0 (Universal dual-deck simultaneous crossfade)
    if (this.activeEngine === 'youtube' && secYt && nextVideoId) {
      try {
        if (typeof secYt.setVolume === 'function') secYt.setVolume(0);
        if (typeof secYt.unMute === 'function') secYt.unMute();
        if (typeof secYt.setPlaybackRate === 'function') secYt.setPlaybackRate(1);
        const currentData = typeof secYt.getVideoData === 'function' ? secYt.getVideoData() : null;
        if (currentData && currentData.video_id === nextVideoId) {
          secYt.seekTo(mixInSec, true);
        } else {
          secYt.loadVideoById({ videoId: nextVideoId, startSeconds: mixInSec });
        }
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

    // Schedule Web Audio DSP Strip automations
    this.initAudioContext();
    const outIdx = this.activeAudioIndex;
    const inIdx: 0 | 1 = outIdx === 0 ? 1 : 0;
    const outStrip = this.deckStrips[outIdx];
    const inStrip = this.deckStrips[inIdx];
    const safeTempo = djConfig?.tempoA && djConfig.tempoA > 40 && djConfig.tempoA < 240 ? djConfig.tempoA : 128;

    if (this.audioContext && outStrip && inStrip) {
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume().catch(() => {});
      }
      const now = this.audioContext.currentTime;
      cancelScheduledAutomations(outStrip, now);
      cancelScheduledAutomations(inStrip, now);

      const crossoverTime = now + crossfadeSec * 0.5;
      const preset = djConfig?.preset || 'automatica';
      const eqMode = djConfig?.eqMode || 'intercambio_graves_central';
      const fxMode = djConfig?.fxMode || 'ninguno';

      // 1. Low-End Clash Prevention & Bass Swap (-40dB cut on outgoing, incoming pre-cut to -40dB then snapping to 0dB)
      if (eqMode === 'intercambio_graves_central' || preset === 'automatica' || preset === 'corte') {
        scheduleBassSwap(outStrip, inStrip, crossoverTime, now);
      }

      // 1b. Vocal Blend (Mezcla de voces): Lows ducked (-36dB) on both decks while mid frequencies (+2.5dB) are lifted
      if (preset === 'mezcla_voces') {
        outStrip.eqLow.gain.setValueAtTime(0, now);
        outStrip.eqLow.gain.setTargetAtTime(-36, now, 0.05);
        outStrip.eqMid.gain.setValueAtTime(0, now);
        outStrip.eqMid.gain.setTargetAtTime(2.5, now, 0.05);

        inStrip.eqLow.gain.setValueAtTime(-36, now);
        inStrip.eqMid.gain.setValueAtTime(0, now);
        inStrip.eqMid.gain.setTargetAtTime(2.0, now, 0.05);

        inStrip.eqLow.gain.setTargetAtTime(0, crossoverTime, 0.02);
        outStrip.eqMid.gain.setTargetAtTime(0, crossoverTime, 0.1);
      }

      // 2. Resonant Filter Sweeps
      if (preset === 'filtro') {
        scheduleResonantHPFSweep(outStrip, now, crossfadeSec, 20, 18000, 3.0);
        inStrip.eqLow.gain.setValueAtTime(-40, now);
        inStrip.eqLow.gain.setTargetAtTime(0, crossoverTime, 0.02);
      } else if (eqMode === 'filtro_paso_bajo') {
        scheduleResonantLPFSweep(outStrip, now, crossfadeSec, 20000, 80, 2.5);
      }

      // 3. Beat-Synchronized Echo Delay
      if (preset === 'eco_out' || fxMode === 'eco') {
        scheduleBeatDelay(outStrip, crossoverTime, crossfadeSec * 0.5, safeTempo, 0.75, 0.65);
        inStrip.eqLow.gain.setValueAtTime(0, now);
      }

      // 4. Accelerating Loop Stutter Roll / Rhythm Repetition
      if (preset === 'beat_roll' || preset === 'repeticion_ritmo' || fxMode === 'repeticion_loop' || fxMode === 'distorsion_wash') {
        scheduleLoopStutter(outStrip, now + crossfadeSec * 0.25, crossfadeSec * 0.73, safeTempo);
        scheduleResonantHPFSweep(outStrip, now + crossfadeSec * 0.3, crossfadeSec * 0.65, 40, 8000, 2.5);
        inStrip.eqLow.gain.setValueAtTime(-40, now);
        inStrip.eqLow.gain.setTargetAtTime(0, now + crossfadeSec * 0.98, 0.02);
      }

      // 5. Channel Faders Output
      outStrip.outputNode.gain.setValueAtTime(masterVolume, now);
      outStrip.outputNode.gain.linearRampToValueAtTime(0.0001, now + crossfadeSec);

      inStrip.outputNode.gain.setValueAtTime(0.0001, now);
      inStrip.outputNode.gain.linearRampToValueAtTime(masterVolume, now + crossfadeSec);
    }

    const durationMs = crossfadeSec * 1000;
    let accumulatedCrossfadeMs = 0;
    let lastTick = Date.now();
    const crossfadeStartTime = Date.now();
    let isDeckBReady = false;
    let lastRateOut = 1;

    if (this.crossfadeInterval !== null) {
      clearInterval(this.crossfadeInterval);
    }

    this.crossfadeInterval = window.setInterval(() => {
      const now = Date.now();

      if (!usePlayerStore.getState().isPlaying) {
        lastTick = now;
        return;
      }

      // Ready-State Gate: Verify secondary player is actively outputting audio before advancing crossfade
      if (!isDeckBReady) {
        let ready = false;
        if (this.activeEngine === 'youtube') {
          const curSecYt = this.secondaryYtPlayer;
          if (curSecYt && typeof curSecYt.getPlayerState === 'function') {
            const state = curSecYt.getPlayerState();
            const ct = typeof curSecYt.getCurrentTime === 'function' ? curSecYt.getCurrentTime() : 0;
            ready = (state === 1 || ct > 0);
          }
        } else {
          const curSecAudio = this.secondaryAudio;
          ready = !!(curSecAudio && curSecAudio.readyState >= 3 && !curSecAudio.paused);
        }

        if (!ready) {
          // Give the incoming song time to start (slow networks), as long as song A still has
          // music left to mix over. Proceeding with a silent deck B made the mix a hard cut.
          let aLeft = 99;
          try {
            if (this.activeEngine === 'youtube' && this.ytPlayer) aLeft = this.ytPlayer.getDuration() - this.ytPlayer.getCurrentTime();
            else if (this.audio) aLeft = this.audio.duration - this.audio.currentTime;
          } catch {}
          const waitLimit = isFinite(aLeft) && aLeft > crossfadeSec + 3 ? 4500 : 1500;
          if (now - crossfadeStartTime > waitLimit) {
            console.warn('[AudioEngine] Secondary player buffering timeout (1500ms), advancing fallback');
            isDeckBReady = true;
            lastTick = now;
          } else {
            // Keep Deck A at full master volume, Deck B at 0 volume while waiting to eliminate silence hole
            if (this.activeEngine === 'youtube') {
              try {
                if (this.ytPlayer?.setVolume) this.ytPlayer.setVolume(Math.round(masterVolume * 100));
                if (this.secondaryYtPlayer?.setVolume) this.secondaryYtPlayer.setVolume(0);
              } catch {}
            } else {
              if (this.audio) this.audio.volume = masterVolume;
              if (this.secondaryAudio) this.secondaryAudio.volume = 0;
            }
            lastTick = now;
            return;
          }
        } else {
          isDeckBReady = true;
          lastTick = now;
          // DJ layers on top of the songs (riser, roll, impact on the swap...). YouTube decks
          // can't be filtered, so these are what make the transition feel like a DJ mix.
          if (djConfig && this.audioContext) {
            this.stopAuxiliaryTransitionFX();
            const layers = transitionFXLayers(djConfig, crossfadeSec);
            this.activeAuxFX = playTransitionLayers(this.audioContext, layers, safeTempo, masterVolume * djFxLevelGain());
          }
          // APK: the filter move on the real audio (phone equalizer)
          if (djConfig) nativeTransitionFx(djConfig, crossfadeSec);
        }
      }

      const delta = now - lastTick;
      lastTick = now;
      accumulatedCrossfadeMs += delta;
      const progress = Math.min(1, Math.max(0, accumulatedCrossfadeMs / durationMs));

      let outVol: number;
      let inVol: number;

      if (djConfig) {
        // Same renderer as the editor preview, so what you set there is exactly what plays
        const g = computeTransitionGains(djConfig, progress, crossfadeSec);
        outVol = g.outVol * masterVolume;
        inVol = g.inVol * masterVolume;
        if (g.rateOut !== lastRateOut) {
          lastRateOut = g.rateOut;
          try { if (this.activeEngine === 'youtube' && this.ytPlayer?.setPlaybackRate) this.ytPlayer.setPlaybackRate(g.rateOut); } catch {}
          try { if (this.activeEngine === 'html5' && this.audio) this.audio.playbackRate = g.rateOut; } catch {}
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
   * Resets active crossfade and automix transitions cleanly.
   * Clears Web Audio automations, stops secondary players, and restores active deck volume.
   */
  public resetTransitionState() {
    if (this.crossfadeInterval !== null) {
      clearInterval(this.crossfadeInterval);
      this.crossfadeInterval = null;
    }
    this.isCrossfading = false;
    this.isTransitioning = false;
    this.preloadedNext = null;
    this.stopAuxiliaryTransitionFX();
    if (this.audioContext) {
      const now = this.audioContext.currentTime;
      if (this.deckStrips[0]) cancelScheduledAutomations(this.deckStrips[0], now);
      if (this.deckStrips[1]) cancelScheduledAutomations(this.deckStrips[1], now);
    }
    // Stop secondary player safely
    try {
      const secYt = this.secondaryYtPlayer;
      if (secYt) {
        if (typeof secYt.setVolume === 'function') secYt.setVolume(0);
        if (typeof secYt.stopVideo === 'function') secYt.stopVideo();
        else if (typeof secYt.pauseVideo === 'function') secYt.pauseVideo();
      }
      const secAudio = this.secondaryAudio;
      if (secAudio) {
        secAudio.volume = 0;
        secAudio.pause();
        secAudio.currentTime = 0;
      }
    } catch {}
    // Restore primary player volume
    const masterVolume = usePlayerStore.getState().isMuted ? 0 : this.getEffectiveVolume();
    try {
      if (this.activeEngine === 'youtube' && this.ytPlayer) {
        if (typeof this.ytPlayer.unMute === 'function') this.ytPlayer.unMute();
        if (typeof this.ytPlayer.setVolume === 'function') this.ytPlayer.setVolume(Math.round(masterVolume * 100));
      } else if (this.audio) {
        this.audio.volume = Math.max(0, Math.min(1, masterVolume));
      }
    } catch {}
  }

  /**
   * Atomic finalizer for crossfade and Automix transitions.
   * Ensures the incoming song continues playing seamlessly from its elapsed time
   * without skipping, avoids false-positive ad detection, and smoothly pauses the outgoing player.
   */
  private finishCrossfade(crossfadeSec = 0) {
    if (!this.isCrossfading) return;
    this.isCrossfading = false;
    this.lastCrossfadeFinishTime = Date.now();

    if (this.crossfadeInterval !== null) {
      clearInterval(this.crossfadeInterval);
      this.crossfadeInterval = null;
    }

    this.stopAuxiliaryTransitionFX();
    if (this.audioContext) {
      const now = this.audioContext.currentTime;
      if (this.deckStrips[0]) cancelScheduledAutomations(this.deckStrips[0], now);
      if (this.deckStrips[1]) cancelScheduledAutomations(this.deckStrips[1], now);
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

    const masterVolume = state.isMuted ? 0 : this.getEffectiveVolume();
    const oldYtIndex = this.activeYtIndex;
    const oldAudioIndex = this.activeAudioIndex;
    const isMobile = this.isMobileOrPWA();

    // Is the secondary deck really outputting the incoming song? On mobile it may have been blocked.
    let secondaryIsPlayingIncoming = false;
    try {
      if (this.activeEngine === 'youtube') {
        const sec = this.secondaryYtPlayer;
        const st = sec && typeof sec.getPlayerState === 'function' ? sec.getPlayerState() : -1;
        const ct = sec && typeof sec.getCurrentTime === 'function' ? sec.getCurrentTime() : 0;
        const vid = sec && typeof sec.getVideoData === 'function' ? sec.getVideoData()?.video_id : null;
        secondaryIsPlayingIncoming = (st === 1 || st === 3 || ct > 0) && (!nextVideoId || !vid || vid === nextVideoId);
      } else {
        const secA = this.secondaryAudio;
        secondaryIsPlayingIncoming = Boolean(secA && !secA.paused && secA.currentTime > 0);
      }
    } catch {}

    // Alternate active deck when the incoming deck is playing (always on desktop; on mobile only if it
    // actually started). If we stay on the same deck, the incoming song is force-loaded on it below,
    // so the audio can never keep playing the OLD song while the UI shows the new cover/lyrics.
    if (!isMobile || secondaryIsPlayingIncoming) {
      this.activeYtIndex = oldYtIndex === 0 ? 1 : 0;
      this.activeAudioIndex = oldAudioIndex === 0 ? 1 : 0;
    } else {
      this.activeYtIndex = 0;
      this.activeAudioIndex = 0;
    }

    this.currentTrackId = nextTrack.id;
    this.currentTrackQuery = nextQuery || `${nextTrack.name} ${nextTrack.artists?.[0]?.name || ''}`.trim();
    // Shield incoming track from spurious pauses, unstarted state drops, or premature ad-skips
    this.isTransitioning = true;
    setTimeout(() => {
      this.isTransitioning = false;
    }, 3500);

    const swappedDecks = this.activeEngine === 'youtube' ? oldYtIndex !== this.activeYtIndex : oldAudioIndex !== this.activeAudioIndex;

    // 2. NOW silence and cleanly stop outgoing old player if we swapped decks
    if (!swappedDecks) {
      // Same deck reused: the secondary (incoming) deck must be silenced, the primary will load song B
      try {
        const sec = this.secondaryYtPlayer;
        if (sec) {
          if (typeof sec.setVolume === 'function') sec.setVolume(0);
          if (typeof sec.stopVideo === 'function') sec.stopVideo();
        }
        const secA = this.secondaryAudio;
        if (secA) { secA.volume = 0; secA.pause(); }
      } catch {}
    } else if (oldYtIndex !== this.activeYtIndex && this.activeEngine === 'youtube') {
      const oldPlayer = this.ytPlayers[oldYtIndex];
      if (oldPlayer) {
        try {
          if (typeof oldPlayer.setVolume === 'function') oldPlayer.setVolume(0);
          if (typeof oldPlayer.stopVideo === 'function') oldPlayer.stopVideo();
          else if (typeof oldPlayer.pauseVideo === 'function') oldPlayer.pauseVideo();
          if (typeof oldPlayer.setPlaybackRate === 'function') oldPlayer.setPlaybackRate(1);
        } catch {}
      }
    } else if (oldAudioIndex !== this.activeAudioIndex) {
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
      const newPlayer = this.ytPlayers[this.activeYtIndex];
      if (newPlayer) {
        try {
          if (typeof newPlayer.unMute === 'function') newPlayer.unMute();
          if (typeof newPlayer.setVolume === 'function') newPlayer.setVolume(Math.round(masterVolume * 100));
          if (typeof newPlayer.setPlaybackRate === 'function') newPlayer.setPlaybackRate(1);

          // Force load when the deck is not playing song B (same deck reused on mobile, unbuffered
          // secondary, or a different video cued) so audio always matches the track shown in the UI.
          if (nextVideoId && typeof newPlayer.loadVideoById === 'function') {
            const pState = typeof newPlayer.getPlayerState === 'function' ? newPlayer.getPlayerState() : -1;
            const loadedVid = typeof newPlayer.getVideoData === 'function' ? newPlayer.getVideoData()?.video_id : null;
            const wrongVideo = Boolean(loadedVid && loadedVid !== nextVideoId);
            if (!swappedDecks || wrongVideo || (pState !== 1 && pState !== 3)) {
              newPlayer.loadVideoById({ videoId: nextVideoId, startSeconds: swappedDecks ? 0 : Math.max(0, crossfadeSec) });
            }
          }
          if (typeof newPlayer.playVideo === 'function') newPlayer.playVideo();

          const data = typeof newPlayer.getVideoData === 'function' ? newPlayer.getVideoData() : null;
          if (swappedDecks && data && data.video_id) {
            detectedVideoId = data.video_id;
          }
          if (!swappedDecks) {
            // Treat the reload like a fresh start so stale progress/ENDED events from song A are ignored
            this.lastTrackStartTime = Date.now();
          }

          // When the deck was just reloaded, getCurrentTime() may still report the OLD song position
          if (swappedDecks && typeof newPlayer.getCurrentTime === 'function') {
            const ct = newPlayer.getCurrentTime();
            if (isFinite(ct) && ct > 0) {
              elapsedSeconds = ct;
            }
          }
        } catch {}
      }
    } else {
      const newAudio = this.audios[this.activeAudioIndex];
      if (newAudio) {
        try {
          if (!swappedDecks && nextQuery) {
            newAudio.src = `${API_BASE}/api/audio/stream?q=${encodeURIComponent(nextQuery)}&trackId=${encodeURIComponent(nextTrack.id)}`;
            newAudio.currentTime = 0;
            elapsedSeconds = 0;
          }
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

    // 6. Automatically preload upcoming tracks N+1 and N+2 in the background
    setTimeout(() => {
      this.preloadUpcomingTracks();
    }, 400);
  }

  /**
   * Smooth manual skip transition for continuous audio continuity.
   * Performs an accelerated downbeat transition rather than an instant cold cut.
   */
  public async transitionToNextTrack(nextTrack: Track): Promise<void> {
    if (!nextTrack) return;

    if (this.isCrossfading) {
      this.finishCrossfade();
    }

    const state = usePlayerStore.getState();
    const curTrack = state.currentTrack;
    const artistName = nextTrack.artists?.[0]?.name || '';
    const query = `${nextTrack.name} ${artistName}`.trim();

    this.isTransitioning = true;
    this.isCrossfading = true;

    // Resolve or retrieve videoId for next track
    let videoId: string | null = null;
    if (nextTrack.id && nextTrack.id.startsWith('yt-')) {
      videoId = nextTrack.id.replace('yt-', '');
    } else {
      videoId = await this.resolveVideoId(query);
    }

    if (!videoId) {
      this.isCrossfading = false;
      state.playTrack(nextTrack);
      return;
    }

    this.initAudioContext();
    this.preloadedNext = { track: nextTrack, videoId, query };

    const isDjMode =
      typeof window !== 'undefined' &&
      (window.localStorage.getItem('spotifree_dj_mode') === 'true' ||
        window.localStorage.getItem('spotifree_dj_mode_desktop') === 'true' ||
        Boolean((window as any).__useAIDJStore?.getState?.()?.isDJModeActive));

    // Manual skip: same planned style, but at most 2 bars so the skip feels immediate
    const planned = isDjMode && curTrack ? djTransitionService.getPlannedTransition(curTrack, nextTrack) : null;
    const djConfig = planned ? { ...planned, compases: Math.min(2, planned.compases || 2) } : null;

    const crossfadeDuration = djConfig
      ? Math.min(6, djTransitionService.calculateDurationSeconds(djConfig.tempoA ?? 120, djConfig.compases))
      : this.getConfiguredCrossfadeSec();

    await this.executeCrossfade(crossfadeDuration, djConfig);
  }

  /**
   * Acoustic DJ Audition Engine.
   * Synthesizes studio preview audio via Web Audio API oscillators, filters & noise envelopes
   * with exact beat-matching, harmonic chords, and DJ transition FX presets.
   */
  public startAcousticAudition(
    config: DJTransitionConfig,
    onProgress: (progress: number) => void,
    onEnded: () => void
  ): boolean {
    this.stopTransitionAudition();
    this.isAuditioning = true;
    this.initAudioContext();
    if (!this.audioContext) return false;

    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }

    const safeTempo = config.tempoA && config.tempoA > 40 && config.tempoA < 240 ? config.tempoA : 128;
    const barSec = (4 * 60) / safeTempo;
    const transitionDur = Math.max(2.0, Math.min(16.0, barSec * (config.compases || 2)));
    const leadInSec = 1.5;
    const leadOutSec = 2.0;
    const totalSec = leadInSec + transitionDur + leadOutSec;
    const totalDurationMs = totalSec * 1000;
    const startTime = Date.now();
    const ctx = this.audioContext;
    const now = ctx.currentTime;

    // Master bus
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.18, now);
    masterGain.connect(ctx.destination);

    // Rhythm groove generator (kick + snare)
    const beatSec = 60 / safeTempo;
    const totalBeats = Math.ceil(totalSec / beatSec);

    for (let b = 0; b < totalBeats; b++) {
      const beatTime = now + b * beatSec;
      const isDownbeat = b % 4 === 0;
      const isSnare = b % 2 === 1;

      // Kick on beats 1 and 3
      if (isDownbeat || b % 4 === 2) {
        const osc = ctx.createOscillator();
        const kickGain = ctx.createGain();
        osc.frequency.setValueAtTime(130, beatTime);
        osc.frequency.exponentialRampToValueAtTime(45, beatTime + 0.08);
        kickGain.gain.setValueAtTime(0.35, beatTime);
        kickGain.gain.exponentialRampToValueAtTime(0.001, beatTime + 0.18);
        osc.connect(kickGain);
        kickGain.connect(masterGain);
        osc.start(beatTime);
        osc.stop(beatTime + 0.2);
      }

      // Snare on beats 2 and 4
      if (isSnare) {
        const osc = ctx.createOscillator();
        const snareGain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(220, beatTime);
        snareGain.gain.setValueAtTime(0.2, beatTime);
        snareGain.gain.exponentialRampToValueAtTime(0.001, beatTime + 0.12);
        osc.connect(snareGain);
        snareGain.connect(masterGain);
        osc.start(beatTime);
        osc.stop(beatTime + 0.14);
      }
    }

    // Trigger auxiliary DJ preset effect during the mix window
    this.stopAuxiliaryTransitionFX();
    this.activeAuxFX = playTransitionLayers(ctx, transitionFXLayers(config, transitionDur), safeTempo, djFxLevelGain(), now + leadInSec);

    this.auditionInterval = window.setInterval(() => {
      if (!this.isAuditioning) {
        this.stopTransitionAudition();
        try { masterGain.disconnect(); } catch {}
        return;
      }
      const elapsedMs = Date.now() - startTime;
      const progress = Math.min(1.0, Math.max(0.0, elapsedMs / totalDurationMs));
      onProgress(progress);

      if (elapsedMs >= totalDurationMs) {
        this.stopTransitionAudition();
        try { masterGain.disconnect(); } catch {}
        onEnded();
      }
    }, 40);

    return true;
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

    // Remember where the main song was, so it can be put back after the preview
    try {
      const mainSec =
        this.activeEngine === 'youtube' && this.ytPlayer && typeof this.ytPlayer.getCurrentTime === 'function'
          ? Number(this.ytPlayer.getCurrentTime()) || 0
          : (usePlayerStore.getState().progressMs || 0) / 1000;
      this.auditionRestore =
        this.activeEngine === 'youtube' && this.currentVideoId
          ? { videoId: this.currentVideoId, sec: mainSec, playerIndex: this.activeYtIndex }
          : null;
    } catch {
      this.auditionRestore = null;
    }
    // A real pause (store + explicit flag) so no watchdog / keep-alive resumes the main song
    // on top of the preview
    if (usePlayerStore.getState().isPlaying) this.pause();

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

    // Same lookup as normal playback (title, artist and length pick the right upload)
    const durOf = (t: Track) => (t.duration_ms ? t.duration_ms / 1000 : undefined);
    let videoIdA =
      trackA.id === this.currentTrackId && this.currentVideoId
        ? this.currentVideoId
        : await this.resolveVideoId(queryA, trackA.id, trackA.name, trackA.artists?.[0]?.name || '', durOf(trackA));

    let videoIdB = await this.resolveVideoId(queryB, trackB.id, trackB.name, trackB.artists?.[0]?.name || '', durOf(trackB));
    // Closed (or another preview started) while resolving
    if (!this.isAuditioning) return false;

    if (!videoIdA || !videoIdB) {
      // Never a synthetic demo instead of the real songs: report it
      this.stopTransitionAudition();
      return false;
    }

    // Same timing as the live mix: duration from the measured BPM and bars, A heard from just
    // before where the live mix would start (end of its music), B from its planned entry point.
    const tempoA = config.tempoA || 128;
    const safeTempo = tempoA > 40 && tempoA < 240 ? tempoA : 128;
    const transitionDur = djTransitionService.calculateDurationSeconds(safeTempo, config.compases || 2);
    const leadInSec = 6;
    const leadOutSec = 6;
    const totalSec = leadInSec + transitionDur + leadOutSec;

    const durA = (trackA.duration_ms || 210000) / 1000;
    const anA = getTrackAnalysis(trackA.id);
    const endA = anA?.tempoSource === 'analysis' && typeof anA.musicEndSec === 'number' && anA.musicEndSec > 30 ? Math.min(anA.musicEndSec, durA) : durA;
    let mixStartA = endA - transitionDur;
    const snappedA = snapToBarGrid(anA, mixStartA, 'floor');
    if (snappedA !== null) mixStartA = snappedA;
    const startSecA = Math.max(0, mixStartA - leadInSec);
    const startSecB = typeof config.mixInSec === 'number' && config.mixInSec > 0 ? config.mixInSec : 0;

    await this.ensureYouTubeReady();
    const p0 = this.ytPlayers[0];
    const p1 = this.ytPlayers[1];

    if (!p0 || !p1) {
      // Never a synthetic demo instead of the real songs: report it
      this.stopTransitionAudition();
      return false;
    }

    // Reset playback rates
    try {
      if (typeof p0.setPlaybackRate === 'function') p0.setPlaybackRate(1);
      if (typeof p1.setPlaybackRate === 'function') p1.setPlaybackRate(1);
    } catch {}

    // Deck A (Track A): 100% volume, start at energetic phrase
    try {
      if (typeof p0.unMute === 'function') p0.unMute();
      if (typeof p0.setVolume === 'function') p0.setVolume(100);
      p0.loadVideoById({ videoId: videoIdA, startSeconds: startSecA });
      p0.playVideo();
    } catch {}

    // Deck B (Track B): cue at its entry point, paused, until the transition starts
    try {
      if (typeof p1.unMute === 'function') p1.unMute();
      if (typeof p1.setVolume === 'function') p1.setVolume(0);
      if (typeof p1.cueVideoById === 'function') p1.cueVideoById({ videoId: videoIdB, startSeconds: startSecB });
      else {
        p1.loadVideoById({ videoId: videoIdB, startSeconds: startSecB });
        p1.pauseVideo?.();
      }
    } catch {}

    // Wait until Deck A actually begins playing audio before starting the transition timeline
    let isP0Playing = false;
    const waitStart = Date.now();
    // Up to 10 s: on mobile data the first song can take a while; giving up early played the
    // synthetic demo instead of the real songs
    while (!isP0Playing && Date.now() - waitStart < 10000) {
      if (!this.isAuditioning) return false;
      try {
        const state0 = typeof p0.getPlayerState === 'function' ? p0.getPlayerState() : -1;
        const ct0 = typeof p0.getCurrentTime === 'function' ? p0.getCurrentTime() : 0;
        if (state0 === 1 || ct0 > 0) {
          isP0Playing = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 50));
    }

    if (!isP0Playing) {
      // Never a synthetic demo instead of the real songs: report it
      this.stopTransitionAudition();
      return false;
    }

    const startTime = Date.now();
    const totalDurationMs = totalSec * 1000;

    this.initAudioContext();
    if (this.audioContext) {
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume().catch(() => {});
      }
      // Same DJ layers as the live mix
      this.stopAuxiliaryTransitionFX();
      this.activeAuxFX = playTransitionLayers(
        this.audioContext,
        transitionFXLayers(config, transitionDur),
        safeTempo,
        djFxLevelGain(),
        this.audioContext.currentTime + leadInSec
      );
    }
    // APK: same filter move on the real audio, when the mix part of the preview starts
    window.setTimeout(() => {
      if (this.isAuditioning) nativeTransitionFx(config, transitionDur);
    }, leadInSec * 1000);

    let startedB = false;
    let lastRate = 1;
    this.auditionInterval = window.setInterval(() => {
      if (!this.isAuditioning) {
        this.stopTransitionAudition();
        return;
      }

      const elapsedMs = Date.now() - startTime;
      const elapsedSec = elapsedMs / 1000;
      const progress = Math.min(1.0, Math.max(0.0, elapsedMs / totalDurationMs));
      onProgress(progress);

      // Phase 1: Lead-in (Song A playing solo, so you hear where the mix comes from)
      if (elapsedSec < leadInSec) {
        if (typeof p0.setVolume === 'function') p0.setVolume(100);
        if (typeof p1.setVolume === 'function') p1.setVolume(0);
      }
      // Phase 2: the transition, rendered exactly like the live DJ mix
      else if (elapsedSec < leadInSec + transitionDur) {
        if (!startedB) {
          startedB = true;
          try { p1.playVideo(); } catch {}
        }
        const pMix = Math.min(1.0, Math.max(0.0, (elapsedSec - leadInSec) / transitionDur));
        const g = computeTransitionGains(config, pMix, transitionDur);
        if (g.rateOut !== lastRate) {
          lastRate = g.rateOut;
          try { if (typeof p0.setPlaybackRate === 'function') p0.setPlaybackRate(g.rateOut); } catch {}
        }
        if (typeof p0.setVolume === 'function') p0.setVolume(Math.round(g.outVol * 100));
        if (typeof p1.setVolume === 'function') p1.setVolume(Math.round(g.inVol * 100));
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

  private stopAuxiliaryTransitionFX(): void {
    if (this.activeAuxFX) {
      stopAuxiliaryTransitionFX(this.activeAuxFX);
      this.activeAuxFX = null;
    }
    cancelNativeTransitionFx();
  }

  public stopTransitionAudition(): void {
    const wasAuditioning = this.isAuditioning;
    this.isAuditioning = false;
    if (this.auditionInterval !== null) {
      clearInterval(this.auditionInterval);
      this.auditionInterval = null;
    }
    if (!wasAuditioning) return;
    this.stopAuxiliaryTransitionFX();
    if (this.audioContext) {
      const now = this.audioContext.currentTime;
      if (this.deckStrips[0]) cancelScheduledAutomations(this.deckStrips[0], now);
      if (this.deckStrips[1]) cancelScheduledAutomations(this.deckStrips[1], now);
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
          a.pause();
          a.volume = this.getEffectiveVolume();
        } catch {}
      }
    }
    // Put the main song back where it was (paused), so "play" continues it
    const restore = this.auditionRestore;
    this.auditionRestore = null;
    if (restore) {
      const p = this.ytPlayers[restore.playerIndex];
      this.activeYtIndex = restore.playerIndex;
      try {
        if (p && typeof p.cueVideoById === 'function') {
          p.cueVideoById({ videoId: restore.videoId, startSeconds: Math.max(0, restore.sec) });
        }
        const { isMuted } = usePlayerStore.getState();
        if (p && typeof p.setVolume === 'function') p.setVolume(isMuted ? 0 : Math.round(this.getEffectiveVolume() * 100));
      } catch {}
      usePlayerStore.getState().setProgress(Math.max(0, restore.sec) * 1000);
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
      // Equalizer changed here or synced from another device
      // (only once the audio graph exists: it reads the saved EQ when it is created)
      window.addEventListener(EQ_CHANGED_EVENT, () => {
        try {
          if (this.audioContext) this.applyEqualizerGains(effectiveEqGains());
        } catch {}
      });

      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          // Tab/app became visible again — restore playback if it was supposed to be playing
          const { isPlaying } = usePlayerStore.getState();
          if (isPlaying && !this.isExplicitlyPaused) {
            this.startCarrier();
            this.startProgressTicker();
            if (this.activeEngine === 'html5' && this.audio.paused) {
              // HTML5 audio was paused while in background — resume it
              this.audio.play().catch(() => {});
            } else if (this.activeEngine === 'youtube' && this.ytPlayer) {
              try {
                // Unmute and restore volume first
                if (typeof this.ytPlayer.unMute === 'function') {
                  this.ytPlayer.unMute();
                  const { isMuted } = usePlayerStore.getState();
                  if (!isMuted) this.ytPlayer.setVolume(Math.round(this.getEffectiveVolume() * 100));
                }
                if (this.ensureActiveVideoMatches()) return;
                // Check if player is paused/stopped and resume if needed
                const ytState = typeof this.ytPlayer.getPlayerState === 'function'
                  ? this.ytPlayer.getPlayerState() : -1;
                // States: -1=unstarted, 0=ended, 1=playing, 2=paused, 3=buffering, 5=cued
                if (ytState === 2 || ytState === -1 || ytState === 5) {
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
          // App going to background — ensure carrier stays active and mediaSession is set to 'playing'
          // so Android and iOS know NOT to suspend or kill background audio
          const { isPlaying } = usePlayerStore.getState();
          if (isPlaying && !this.isExplicitlyPaused) {
            this.startCarrier();
            if ('mediaSession' in navigator) {
              try { navigator.mediaSession.playbackState = 'playing'; } catch {}
            }
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

  /** Detect mobile devices or mobile viewports */
  public isMobileOrPWA(win?: any): boolean {
    if (win && typeof win === 'object') {
      const nav = win.navigator || {};
      const ua = nav.userAgent || '';
      const platform = nav.platform || '';
      const maxTouchPoints = nav.maxTouchPoints || 0;
      const innerWidth = typeof win.innerWidth === 'number' ? win.innerWidth : 1024;
      return (
        /Android|iPhone|iPad|iPod/i.test(ua) ||
        (platform === 'MacIntel' && maxTouchPoints > 1) ||
        innerWidth < 768
      );
    }
    return (
      typeof window !== 'undefined' &&
      (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ||
        window.innerWidth < 768)
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
                    const { isMuted } = usePlayerStore.getState();
                    if (this.ytPlayers[0] && typeof this.ytPlayers[0].setVolume === 'function') {
                      this.ytPlayers[0].setVolume(isMuted ? 0 : Math.round(this.getEffectiveVolume() * 100));
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
      const curSec = typeof this.ytPlayer.getCurrentTime === 'function' ? this.ytPlayer.getCurrentTime() : 0;
      // Do not attempt ad skipping within the first 3 seconds of a track, or while video is initializing
      if (curSec < 3) return;

      const duration = typeof this.ytPlayer.getDuration === 'function' ? this.ytPlayer.getDuration() : 0;
      const expectedTrackMs = usePlayerStore.getState().currentTrack?.duration_ms || 0;

      // Real music tracks are never fast-forwarded! If duration > 45s, this is the song.
      if (duration > 45 || (expectedTrackMs > 0 && Math.abs(duration - expectedTrackMs / 1000) < 30)) {
        const data = typeof this.ytPlayer.getVideoData === 'function' ? this.ytPlayer.getVideoData() : null;
        if (data && data.video_id && data.video_id !== this.currentVideoId) {
          // Keep currentVideoId synchronized with YouTube's canonical ID for the track
          this.currentVideoId = data.video_id;
        }

        const { isMuted } = usePlayerStore.getState();
        if (typeof this.ytPlayer.unMute === 'function' && !isMuted && typeof this.ytPlayer.isMuted === 'function' && this.ytPlayer.isMuted()) {
          this.ytPlayer.unMute();
          this.ytPlayer.setVolume(Math.round(this.getEffectiveVolume() * 100));
        }
        return;
      }

      // Pre-roll advertisement (< 45s while real song is > 60s) — mute and fast-forward past it
      // ONLY if duration is established (>= 3s) and expected track is genuinely long
      const data = typeof this.ytPlayer.getVideoData === 'function' ? this.ytPlayer.getVideoData() : null;
      if (data && data.video_id && this.currentVideoId && data.video_id !== this.currentVideoId && duration >= 3 && duration <= 45 && expectedTrackMs > 60000) {
        if (typeof this.ytPlayer.mute === 'function') this.ytPlayer.mute();
        this.ytPlayer.seekTo(duration, true);
      }
    } catch {}
  }

  public handleYtStateChange(event: any, playerIndex: 0 | 1 = 0) {
    if (this.isAuditioning) {
      // Standard player listeners (progress ticker, crossfade trigger, next track) MUST NOT run during audition
      return;
    }
    const code = typeof event === 'number' ? event : (event?.data ?? event);
    // 1: PLAYING, 2: PAUSED, 0: ENDED, 3: BUFFERING, -1: UNSTARTED
    if (playerIndex !== this.activeYtIndex) {
      // Secondary player state change during crossfade
      return;
    }

    if (code === 1) {
      this.consecutiveEndedCount = 0;
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
      if (this.isExplicitlyPaused) {
        this.stopCarrier();
        this.stopProgressTicker();
        if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
          try { navigator.mediaSession.playbackState = 'paused'; } catch {}
        }
        return;
      }

      // App is in background / screen is locked: keep carrier alive so Android/iOS does not kill playback!
      if (typeof document !== 'undefined' && document.hidden) {
        this.startCarrier();
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

      // Only stop if visible, user didn't request playback, and not in transition
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

      // CRITICAL SHIELD: If track started recently (< 5000ms) or a transition/crossfade finished recently (< 12000ms),
      // ignore this ENDED event completely! It is a delayed event from the outgoing video, player initialization, or ad blip.
      if (
        this.isTransitioning ||
        (Date.now() - this.lastTrackStartTime < 5000) ||
        (Date.now() - this.lastCrossfadeFinishTime < 12000)
      ) {
        console.log('[AudioEngine] Ignored delayed/premature ENDED event', {
          sinceStart: Date.now() - this.lastTrackStartTime,
          sinceCrossfade: Date.now() - this.lastCrossfadeFinishTime,
          isTransitioning: this.isTransitioning,
        });
        return;
      }

      // If playback is halted by circuit breaker or stopped, do not trigger auto-skips
      if (!usePlayerStore.getState().isPlaying) {
        return;
      }

      // Debounce false-positive immediate ends:
      // If currentTime < 3.5s or duration is not yet established, ignore as premature / initialization event
      const curTime = typeof this.ytPlayer?.getCurrentTime === 'function' ? this.ytPlayer.getCurrentTime() : (event?.currentTime ?? 0);
      const durTime = typeof this.ytPlayer?.getDuration === 'function' ? this.ytPlayer.getDuration() : (event?.duration ?? 0);
      if (curTime < 3.5) {
        console.warn('[AudioEngine] Ignored premature track end (<3.5s)', { curTime, durTime });
        return;
      }

      // Guard: If a crossfade or outro truncation just completed (< 3500ms), ignore this ENDED event
      // from the outgoing player so we don't skip the incoming song!
      if (Date.now() - this.lastCrossfadeFinishTime < 3500) {
        console.warn('[AudioEngine] Ignored ENDED event right after crossfade/truncation');
        return;
      }

      // Circuit Breaker: If 2 or more consecutive rapid ENDED events occur (<1500ms),
      // halt automatic skipping to protect the mobile user from an infinite 0/1 loop!
      const now = Date.now();
      if (now - this.lastEndedTimestamp < 1500) {
        this.consecutiveEndedCount++;
        if (this.consecutiveEndedCount >= 2) {
          console.warn('[AudioEngine] Circuit breaker triggered: halting rapid skip loop');
          this.consecutiveEndedCount = 2; // Stay tripped until code === 1 (PLAYING)
          this.stopCarrier();
          usePlayerStore.setState({ isPlaying: false });
          return;
        }
      } else {
        this.consecutiveEndedCount = 1;
        this.lastEndedTimestamp = now;
      }

      const state = usePlayerStore.getState();
      if (state.repeatMode === 'one') {
        const masterVolume = state.isMuted ? 0 : this.getEffectiveVolume();
        const primaryYt = this.ytPlayers[this.activeYtIndex];
        if (primaryYt && typeof primaryYt.setVolume === 'function') {
          try { primaryYt.setVolume(Math.round(masterVolume * 100)); } catch {}
        }
        const strip = this.deckStrips[this.activeYtIndex];
        if (strip && this.audioContext) {
          const now = this.audioContext.currentTime;
          cancelScheduledAutomations(strip, now);
          strip.outputNode.gain.cancelScheduledValues(now);
          strip.outputNode.gain.setValueAtTime(masterVolume, now);
        }
        this.seek(0);
        this.resume();
        usePlayerStore.setState({ isPlaying: true, progressMs: 0 });
      } else {
        state.nextTrack();
      }
    }
  }

  private desyncTicks = 0;
  private checkAudioUiSync() {
    if (this.isTransitioning || this.isCrossfading || this.isSeeking || this.isAuditioning) {
      this.desyncTicks = 0;
      return;
    }
    const state = usePlayerStore.getState();
    if (!state.isPlaying || !state.currentTrack) {
      this.desyncTicks = 0;
      return;
    }

    const cleanEngine = (this.currentTrackId || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
    const cleanState = (state.currentTrack.id || '').replace(/^spotify:track:/i, '').split('?')[0].trim();

    if (cleanEngine && cleanState && cleanEngine !== cleanState) {
      this.desyncTicks++;
      const maxTicks = this.isMobileOrPWA() ? 60 : 35; // ~6s on mobile to prevent spurious resync during track switches
      if (this.desyncTicks >= maxTicks) {
        console.warn(`[AudioWatchdog] Desync detected: UI shows "${state.currentTrack.name}" (${state.currentTrack.id}) but audio engine playing (${this.currentTrackId}). Resyncing audio immediately...`);
        this.desyncTicks = 0;
        const artist = state.currentTrack.artists?.[0]?.name || '';
        const query = `${state.currentTrack.name} ${artist}`.trim();
        this.playTrack(state.currentTrack.id, query, Math.floor(state.progressMs / 1000));
      }
    } else {
      this.desyncTicks = 0;
    }
  }

  /**
   * Outro dead air and post-song silence truncation.
   * If a YouTube video contains trailing credits, end-cards or sponsors beyond the official studio duration,
   * advance seamlessly to the next track right as the music finishes.
   */
  private checkOutroTruncation(curSec: number, durSec: number) {
    if (this.isCrossfading || this.isTransitioning) return;
    if (curSec < 10 || durSec < 20) return; // Guard: Opening seconds must never trigger truncation
    if (Date.now() - this.lastTrackStartTime < 5000) return; // Guard: Stale or newly loaded track
    if (Date.now() - this.lastCrossfadeFinishTime < 15000) return;
    const state = usePlayerStore.getState();
    if (!state.isPlaying || state.repeatMode === 'one') return;
    const curTrack = state.currentTrack;
    // Guard against 30s preview metadata (e.g. from iTunes / Apple Music): previews are NOT full studio duration.
    if (!curTrack || !curTrack.duration_ms || curTrack.duration_ms <= 45000) return;

    const spotifyDurationSec = curTrack.duration_ms / 1000;
    // If YouTube duration has extra dead air (> 3s longer than studio audio, up to 120s)
    if (durSec > spotifyDurationSec + 3.0 && (durSec - spotifyDurationSec) < 120) {
      if (curSec >= spotifyDurationSec) {
        console.log(`[AudioEngine] Truncating dead outro (${curSec.toFixed(1)}s >= ${spotifyDurationSec.toFixed(1)}s), advancing cleanly to next track`);
        this.lastCrossfadeFinishTime = Date.now();
        this.lastEndedTimestamp = Date.now();
        state.nextTrack();
      }
    }
  }

  /**
   * Stuck audio watchdog: recovers playback automatically if video buffers or freezes for >6s
   */
  private checkStuckPlaybackWatchdog(curSec: number) {
    const now = Date.now();
    const state = usePlayerStore.getState();
    if (!state.isPlaying || this.isSeeking || this.isTransitioning || this.isCrossfading || this.isAuditioning) {
      this.lastObservedSec = curSec;
      this.lastObservedAdvanceTime = now;
      this.stuckRecoveryAttempts = 0;
      return;
    }

    if (Math.abs(curSec - this.lastObservedSec) > 0.2) {
      this.lastObservedSec = curSec;
      this.lastObservedAdvanceTime = now;
      this.stuckRecoveryAttempts = 0;
      return;
    }

    const stuckDurationMs = now - this.lastObservedAdvanceTime;
    if (stuckDurationMs > 6000 && this.stuckRecoveryAttempts === 0) {
      this.stuckRecoveryAttempts = 1;
      console.warn(`[AudioEngine] Playback stuck at ${curSec}s for >6s. Attempting resume kick...`);
      try {
        if (this.ytPlayer && typeof this.ytPlayer.playVideo === 'function') {
          this.ytPlayer.playVideo();
        }
      } catch {}
    } else if (stuckDurationMs > 10000 && this.stuckRecoveryAttempts === 1) {
      // Usually an expired stream after a long pause: reload the SAME video at the same second
      this.stuckRecoveryAttempts = 2;
      console.warn(`[AudioEngine] Playback still stuck after 10s. Reloading the same video at ${curSec.toFixed(1)}s`);
      try {
        if (this.ytPlayer && this.currentVideoId && typeof this.ytPlayer.loadVideoById === 'function') {
          this.ytPlayer.loadVideoById({ videoId: this.currentVideoId, startSeconds: Math.max(0, curSec) });
          this.ytPlayer.playVideo();
        }
      } catch {}
    } else if (stuckDurationMs > 20000 && this.stuckRecoveryAttempts === 2) {
      // Still nothing: another upload of the same song, from the same second
      this.stuckRecoveryAttempts = 3;
      console.warn('[AudioEngine] Same video does not play. Switching to another source of the same song');
      if (this.currentTrackQuery) {
        this.resolveAndPlayAlternate(this.currentTrackQuery, this.currentVideoId || undefined);
      }
    }
  }

  private startProgressTicker() {
    this.stopProgressTicker();
    if (this.isAuditioning) return;
    this.progressInterval = window.setInterval(() => {
      if (this.isSeeking || this.isAuditioning) return;
      this.checkAudioUiSync();

      if (this.activeEngine === 'youtube' && this.ytPlayer && typeof this.ytPlayer.getCurrentTime === 'function') {
        try {
          this.checkAndSkipAd();
          if (!this.isCrossfading && typeof this.ytPlayer.isMuted === 'function' && this.ytPlayer.isMuted()) {
            const { isMuted } = usePlayerStore.getState();
            if (!isMuted) {
              this.ytPlayer.unMute();
              this.ytPlayer.setVolume(Math.round(this.getEffectiveVolume() * 100));
            }
          }
          const curSec = this.ytPlayer.getCurrentTime();
          const durSec = this.ytPlayer.getDuration();
          // Filter out stale progress from previous video during the initial second of loading
          if (Date.now() - this.lastTrackStartTime < 1800 && curSec > 5) {
            return;
          }
          if (isFinite(curSec) && curSec >= 0) {
            usePlayerStore.getState().setProgress(curSec * 1000);
            this.checkStuckPlaybackWatchdog(curSec);
          }
          if (isFinite(durSec) && durSec > 0) {
            usePlayerStore.getState().setDuration(durSec * 1000);
            if (isFinite(curSec) && !this.isCrossfading) {
              this.verifyPlayingSource(curSec, durSec);
              this.checkCrossfade(curSec, durSec);
              this.checkOutroTruncation(curSec, durSec);
            }
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
        if (this.isTransitioning || (Date.now() - this.lastCrossfadeFinishTime < 5000)) {
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
    if (typeof window === 'undefined') return;
    try {
      if (!this.audioContext) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        try {
          this.audioContext = new AudioCtx({ latencyHint: 'playback' });
        } catch {
          this.audioContext = new AudioCtx();
        }
      }

      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume().catch(() => {});
      }

      // 1. Initialize Master Output Bus: masterGain -> graphic EQ filters -> compressorNode -> destination
      if (!this.masterGain) {
        this.masterGain = this.audioContext.createGain();
        this.masterGain.gain.value = 1.0;

        let savedBands: number[] = [0, 0, 0, 0, 0, 0];
        try {
          if (typeof window !== 'undefined') savedBands = effectiveEqGains();
        } catch {}

        let lastNode: AudioNode = this.masterGain;
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
        this.compressorNode.threshold.value = isNorm ? -20 : 0;
        this.compressorNode.ratio.value = isNorm ? 4 : 1;
        this.compressorNode.knee.value = 12;
        this.compressorNode.attack.value = 0.01;
        this.compressorNode.release.value = 0.15;
        lastNode.connect(this.compressorNode);
        this.compressorNode.connect(this.audioContext.destination);
      }

      // 2. Instantiate Dual DJ Channel Strips connected to Master Gain Bus
      for (let i = 0; i < 2; i++) {
        if (!this.deckStrips[i]) {
          this.deckStrips[i] = createDJChannelStrip(this.audioContext);
          this.deckStrips[i]!.outputNode.connect(this.masterGain);
        }
      }

      // 3. Connect HTMLMediaElements to their respective channel strips (guarded, at most once per element)
      for (let i = 0; i < 2; i++) {
        if (!this.sourceNodes[i] && this.audios[i] && this.deckStrips[i]) {
          try {
            this.sourceNodes[i] = this.audioContext.createMediaElementSource(this.audios[i]);
            this.sourceNodes[i]!.connect(this.deckStrips[i]!.inputNode);
          } catch (e) {
            console.warn(`[AudioEngine] Failed to connect MediaElementSource ${i}:`, e);
          }
        }
      }
    } catch (e) {
      console.warn('[AudioEngine] Web Audio DSP initialization failed:', e);
    }
  }

  // ---------------------------------------------------------------------------
  // Audio source (which YouTube upload plays a song): checks, automatic and manual switch
  // ---------------------------------------------------------------------------

  /** Songs whose source was already checked (trackId|videoId) and automatic switches per track */
  private verifiedSources = new Set<string>();
  private autoSwitches = new Map<string, number>();
  private switchingSource = false;

  /**
   * The paused/active player must hold the video of the song shown. If something else was
   * cued in it (or the player was reset while the app was in the background), reload the
   * right video at the saved position. Returns true when it reloaded.
   */
  private ensureActiveVideoMatches(): boolean {
    const p = this.ytPlayer;
    if (!p || !this.currentVideoId || this.activeEngine !== 'youtube' || this.isCrossfading) return false;
    try {
      const loaded = typeof p.getVideoData === 'function' ? p.getVideoData()?.video_id : null;
      const st = typeof p.getPlayerState === 'function' ? p.getPlayerState() : -1;
      const wrong = Boolean(loaded && loaded !== this.currentVideoId);
      const empty = !loaded && (st === -1 || st === 5);
      if (!wrong && !empty) return false;
      const sec = Math.max(0, (usePlayerStore.getState().progressMs || 0) / 1000);
      console.warn(`[AudioEngine] Player held ${loaded || 'nothing'} instead of ${this.currentVideoId}; reloading at ${sec.toFixed(1)}s`);
      this.lastTrackStartTime = Date.now();
      const { isMuted } = usePlayerStore.getState();
      if (typeof p.unMute === 'function') p.unMute();
      if (typeof p.setVolume === 'function') p.setVolume(isMuted ? 0 : Math.round(this.getEffectiveVolume() * 100));
      p.loadVideoById({ videoId: this.currentVideoId, startSeconds: sec });
      p.playVideo();
      return true;
    } catch {
      return false;
    }
  }

  /** Uploads of a song ranked by the resolver (songs-only "audio" uploads first). */
  public async fetchSourceCandidates(track: Track): Promise<SourceCandidate[]> {
    const artist = track.artists?.[0]?.name || '';
    const params = new URLSearchParams();
    params.set('q', `${track.name} ${artist}`.trim());
    params.set('title', track.name || '');
    if (artist) params.set('artist', artist);
    if (track.duration_ms) params.set('duration', String(Math.round(track.duration_ms / 1000)));
    try {
      const res = await fetch(`${API_BASE}/api/audio/candidates?${params.toString()}`, {
        signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined,
      });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data?.candidates) ? (data.candidates as SourceCandidate[]) : [];
    } catch {
      return [];
    }
  }

  /** Video playing the current song (null when not on YouTube) */
  public getActiveVideoInfo(): { videoId: string; title: string; author: string; durationSec: number } | null {
    const p = this.ytPlayer;
    if (this.activeEngine !== 'youtube' || !p || !this.currentVideoId) return null;
    try {
      const d = typeof p.getVideoData === 'function' ? p.getVideoData() : null;
      return {
        videoId: this.currentVideoId,
        title: d?.title || '',
        author: d?.author || '',
        durationSec: typeof p.getDuration === 'function' ? Number(p.getDuration()) || 0 : 0,
      };
    } catch {
      return { videoId: this.currentVideoId, title: '', author: '', durationSec: 0 };
    }
  }

  /**
   * Plays another upload of the current song, from the same second.
   * videoId = null picks the best one not tried yet. `manual` choices are remembered for the song.
   */
  public async switchSource(videoId: string | null, opts: { manual?: boolean; reason?: string } = {}): Promise<boolean> {
    const track = usePlayerStore.getState().currentTrack;
    if (!track || this.switchingSource) return false;
    const trackId = track.id;
    const query = `${track.name} ${track.artists?.[0]?.name || ''}`.trim();
    this.switchingSource = true;
    try {
      let target = videoId;
      if (!target) {
        if (this.currentVideoId) this.failedVideoIds.add(this.currentVideoId);
        const cands = await this.fetchSourceCandidates(track);
        target = cands.find((c) => c.match && !this.failedVideoIds.has(c.videoId) && c.videoId !== this.currentVideoId)?.videoId || null;
      }
      if (!target) return false;
      if (usePlayerStore.getState().currentTrack?.id !== trackId) return false; // song changed meanwhile

      if (opts.manual) setSourceOverride(trackId, target);
      persistVideoId(query, target);
      this.verifiedSources.add(`${trackId}|${target}`);
      console.info(`[AudioEngine] Audio source -> ${target}${opts.reason ? ` (${opts.reason})` : ''}`);

      if (this.isCrossfading) this.resetTransitionState();
      this.preloadedNext = null;
      const pos = Math.max(0, (usePlayerStore.getState().progressMs || 0) / 1000);
      const wasPlaying = usePlayerStore.getState().isPlaying;
      await this.ensureYouTubeReady();
      const p = this.ytPlayer;
      if (!p || typeof p.loadVideoById !== 'function') return false;
      this.activeEngine = 'youtube';
      this.currentVideoId = target;
      this.currentTrackId = trackId;
      this.currentTrackQuery = query;
      this.lastTrackStartTime = Date.now();
      this.isTransitioning = true;
      setTimeout(() => { this.isTransitioning = false; }, 3000);
      const { isMuted } = usePlayerStore.getState();
      if (typeof p.unMute === 'function') p.unMute();
      if (typeof p.setVolume === 'function') p.setVolume(isMuted ? 0 : Math.round(this.getEffectiveVolume() * 100));
      if (wasPlaying) {
        p.loadVideoById({ videoId: target, startSeconds: pos > 2 ? pos : 0 });
        p.playVideo();
        this.startProgressTicker();
      } else {
        p.cueVideoById({ videoId: target, startSeconds: pos > 2 ? pos : 0 });
      }
      setTimeout(() => this.preloadUpcomingTracks(), 1500);
      return true;
    } catch (e) {
      console.warn('[AudioEngine] switchSource failed', e);
      return false;
    } finally {
      this.switchingSource = false;
    }
  }

  /**
   * Once per song: does the video really play this song? Compares the YouTube title/channel
   * with the song and artist, and its length with Spotify's. A different song, or a version far
   * longer/shorter (video clip with intro, live, cut) is replaced by the next best upload.
   */
  private verifyPlayingSource(curSec: number, durSec: number) {
    if (this.switchingSource || this.isCrossfading || this.isTransitioning || this.isAuditioning) return;
    if (curSec < 1.5 || !durSec || !this.currentVideoId) return;
    const track = usePlayerStore.getState().currentTrack;
    if (!track || !this.currentTrackId || AudioEngine.cleanId(track.id) !== AudioEngine.cleanId(this.currentTrackId)) return;
    const key = `${track.id}|${this.currentVideoId}`;
    if (this.verifiedSources.has(key)) return;
    if (getSourceOverride(track.id) === this.currentVideoId) {
      this.verifiedSources.add(key); // chosen by the user
      return;
    }
    let data: any = null;
    try { data = this.ytPlayer?.getVideoData?.(); } catch {}
    if (!data || !data.title) return; // not known yet, try on the next tick
    this.verifiedSources.add(key);

    const verdict = judgeSource(track, String(data.title || ''), String(data.author || ''), durSec);
    if (verdict.ok) return;
    const n = this.autoSwitches.get(track.id) || 0;
    if (n >= 2) return;
    this.autoSwitches.set(track.id, n + 1);
    console.warn(`[AudioEngine] Source mismatch for "${track.name}": ${verdict.reason} ("${data.title}" by ${data.author}, ${Math.round(durSec)}s)`);
    void this.switchSource(null, { reason: verdict.reason }).then((ok) => {
      if (ok) {
        showGlobalToast(
          useLanguageStore.getState().language === 'en'
            ? 'The audio did not match the song. Switched to another source'
            : 'El audio no coincidía con la canción. Cambiado a otra fuente'
        );
      }
    });
  }

  /** Unified Fast Video ID resolution: Cache -> Robust Server Resolution with smart retries */
  public async resolveVideoId(
    query: string,
    trackId?: string,
    trackTitle?: string,
    trackArtist?: string,
    trackDurationSec?: number
  ): Promise<string | null> {
    if (!query) return null;
    const cleanQuery = query.trim();

    // A source the user chose by hand for this song always wins
    const override = getSourceOverride(trackId);
    if (override) return override;

    const verified = getVerifiedVideoId(cleanQuery, trackTitle, trackArtist);
    if (verified) {
      persistVideoId(cleanQuery, verified);
      return verified;
    }

    const cached = VIDEO_ID_CACHE.get(cleanQuery);
    if (cached) return cached;

    let resolvedId: string | null = null;

    // 1. Primary backend resolve with title, artist & duration parameters
    const backendPromise = (async () => {
      try {
        const params = new URLSearchParams();
        params.set('q', cleanQuery);
        if (trackId) params.set('trackId', trackId);
        if (trackTitle) params.set('title', trackTitle);
        if (trackArtist) params.set('artist', trackArtist);
        if (trackDurationSec && trackDurationSec > 0) params.set('duration', Math.round(trackDurationSec).toString());
        const url = `${API_BASE}/api/audio/resolve?${params.toString()}`;
        const res = await fetch(url, { signal: AbortSignal.timeout ? AbortSignal.timeout(6500) : undefined });
        if (res.ok) {
          const data = await res.json();
          if (data && data.videoId) return data.videoId as string;
        }
      } catch {}
      return null;
    })();

    // 2. Retry once if the first request fails (same query: a modified query such as
    // "<song> Topic" used to win the race with uploads of other artists)
    const fallbackPromise = (async () => {
      if (await backendPromise) return null;
      try {
        const params = new URLSearchParams();
        params.set('q', cleanQuery);
        if (trackId) params.set('trackId', trackId);
        if (trackTitle) params.set('title', trackTitle);
        if (trackArtist) params.set('artist', trackArtist);
        if (trackDurationSec && trackDurationSec > 0) params.set('duration', Math.round(trackDurationSec).toString());
        const altUrl = `${API_BASE}/api/audio/resolve?${params.toString()}`;
        const res = await fetch(altUrl, { signal: AbortSignal.timeout ? AbortSignal.timeout(5500) : undefined });
        if (res.ok) {
          const data = await res.json();
          if (data && data.videoId) return data.videoId as string;
        }
      } catch {}
      return null;
    })();

    try {
      resolvedId = (await backendPromise) || (await fallbackPromise);
    } catch {}

    if (resolvedId) {
      persistVideoId(cleanQuery, resolvedId);
      return resolvedId;
    }

    return null;
  }

  /**
   * Pre-warms the top tracks from the home feed or opened playlist in the background.
   * Caches video IDs and pre-cues the very first track in the YouTube player so that
   * the instant the user presses play, playback begins in < 100ms with zero cold-start delay.
   */
  public warmupInitialTracks(tracks: Track[]): void {
    if (!tracks || tracks.length === 0) return;
    const slice = tracks.slice(0, 8);

    // 1. Resolve and pre-cue first track immediately
    const first = slice[0];
    if (first) {
      const q = `${first.name} ${first.artists?.[0]?.name || ''}`.trim();
      this.resolveVideoId(q, first.id).then((vid) => {
        // Only on a cold start. With a paused song in the player, cueing another video here made
        // "play" resume a different song than the one shown.
        if (vid && !usePlayerStore.getState().isPlaying && !usePlayerStore.getState().currentTrack && !this.currentTrackId) {
          this.ensureYouTubeReady()
            .then(() => {
              if (this.ytPlayer && typeof this.ytPlayer.cueVideoById === 'function') {
                try {
                  this.ytPlayer.cueVideoById({ videoId: vid, startSeconds: 0 });
                } catch {}
              }
            })
            .catch(() => {});
        }
      });
    }

    // 2. Concurrently resolve upcoming tracks into persistent cache in background
    const bgResolve = () => {
      slice.slice(1).forEach((t, i) => {
        setTimeout(() => {
          if (usePlayerStore.getState().isPlaying) return;
          const q = `${t.name} ${t.artists?.[0]?.name || ''}`.trim();
          if (!VIDEO_ID_CACHE.has(q)) {
            this.resolveVideoId(q, t.id).catch(() => {});
          }
        }, 300 + i * 350);
      });
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      (window as any).requestIdleCallback(bgResolve);
    } else {
      setTimeout(bgResolve, 500);
    }
  }

  public async playTrack(trackId: string, query: string, startSeconds = 0) {
    if (this.isMobileOrPWA()) {
      this.activeYtIndex = 0;
      this.activeAudioIndex = 0;
    }

    const cleanNew = (trackId || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
    const cleanCur = (this.currentTrackId || '').replace(/^spotify:track:/i, '').split('?')[0].trim();

    // Guard against duplicate rapid playTrack triggers while resolving or if already actively playing this track:
    if (cleanNew && cleanCur === cleanNew) {
      if (this.isTransitioning) {
        // Already resolving and loading this exact track in active sequence, avoid restarting to 0!
        return;
      }
      if (startSeconds === 0 && usePlayerStore.getState().isPlaying) {
        // Already actively playing this song, keep playing smoothly!
        this.resume();
        return;
      }
    }

    this.playSequenceId++;
    const currentSeq = this.playSequenceId;
    this.lastTrackStartTime = Date.now();

    if (this.crossfadeInterval !== null) {
      clearInterval(this.crossfadeInterval);
      this.crossfadeInterval = null;
    }
    this.isCrossfading = false;
    this.preloadedNext = null;
    this.stopAuxiliaryTransitionFX();
    this.desyncTicks = 0;
    if (this.audioContext) {
      const now = this.audioContext.currentTime;
      if (this.deckStrips[0]) cancelScheduledAutomations(this.deckStrips[0], now);
      if (this.deckStrips[1]) cancelScheduledAutomations(this.deckStrips[1], now);
    }

    // Immediately silence outgoing player if changing to a new track so old audio doesn't bleed into the first second
    if (cleanNew !== cleanCur) {
      if (this.activeEngine === 'youtube' && this.ytPlayer && typeof this.ytPlayer.pauseVideo === 'function') {
        try { this.ytPlayer.pauseVideo(); } catch {}
      }
      if (this.audio) {
        try { this.audio.pause(); } catch {}
      }
    }

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
      // 0. Songs from the user's own files ("Archivos locales"), then offline storage ("musica-spotifree")
      try {
        // A playlist song that is also on the phone plays from the phone (no internet needed)
        const playing = usePlayerStore.getState().currentTrack;
        const deviceCopy = !isLocalTrackId(trackId) && playing?.id === trackId ? findDeviceMatch(playing) : null;
        if (deviceCopy) console.info('[AudioEngine] Playing the copy on this phone:', playing?.name);
        const offlineBlobUrl = trackId.startsWith(DEVICE_PREFIX)
          ? getDeviceTrackUrl(trackId)
          : deviceCopy
          ? getDeviceTrackUrl(deviceCopy)
          : isLocalTrackId(trackId)
          ? await getLocalTrackUrl(trackId)
          : await getDownloadedTrackBlobUrl(trackId);
        if (this.playSequenceId !== currentSeq || this.currentTrackId !== trackId) return;
        if (isLocalTrackId(trackId) && !offlineBlobUrl) {
          console.warn('[AudioEngine] Local file not found on this device:', trackId);
          usePlayerStore.setState({ isPlaying: false });
          this.isTransitioning = false;
          return;
        }
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          if (offlineBlobUrl) {
            this.activeEngine = 'html5';
            this.audio.src = offlineBlobUrl;
            this.audio.currentTime = startSeconds;
            await this.audio.play();
            this.startCarrier();
            usePlayerStore.setState({ isPlaying: true });
            this.isTransitioning = false;
            return;
          } else {
            console.warn('[AudioEngine] Offline / Modo avión: pista no descargada:', trackId);
            usePlayerStore.setState({ isPlaying: false });
            this.isTransitioning = false;
            try {
              window.dispatchEvent(
                new CustomEvent('spotifree:toast', {
                  detail: { message: 'Modo avión: esta canción no está descargada para escuchar sin conexión' }
                })
              );
            } catch {}
            return;
          }
        }
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
      } catch {}

      // 1. Resolve videoId instantly via unified cache & resolver with accurate track metadata
      const curTrk = usePlayerStore.getState().currentTrack;
      const tTitle = curTrk?.id === trackId ? curTrk.name : undefined;
      const tArtist = curTrk?.id === trackId ? curTrk.artists?.[0]?.name : undefined;
      const tDur = curTrk?.id === trackId && curTrk.duration_ms ? curTrk.duration_ms / 1000 : undefined;
      let videoId = await this.resolveVideoId(query, trackId, tTitle, tArtist, tDur);
      if (this.playSequenceId !== currentSeq || this.currentTrackId !== trackId) {
        return;
      }

      if (videoId) {
        this.currentVideoId = videoId;
        this.activeEngine = 'youtube';
        await this.ensureYouTubeReady();
        if (this.playSequenceId !== currentSeq || this.currentTrackId !== trackId) {
          return;
        }

        if (this.ytPlayer && typeof this.ytPlayer.loadVideoById === 'function') {
          this.audio.pause();

          const { isMuted } = usePlayerStore.getState();
          if (typeof this.ytPlayer.setVolume === 'function') {
            this.ytPlayer.setVolume(isMuted ? 0 : Math.round(this.getEffectiveVolume() * 100));
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

          // Preload upcoming tracks N+1 and N+2
          setTimeout(() => {
            this.preloadUpcomingTracks();
          }, 800);
          return;
        }
      } else {
        console.warn('[AudioEngine] No videoId resolved, streaming via HTML5 fallback');
        this.activeEngine = 'html5';
        this.audio.src = `${API_BASE}/api/audio/stream?q=${encodeURIComponent(query)}&trackId=${encodeURIComponent(trackId)}`;
        this.audio.currentTime = startSeconds;
        this.audio.volume = this.getEffectiveVolume();
        await this.audio.play();
        this.startCarrier();
        usePlayerStore.setState({ isPlaying: true });
        this.startProgressTicker();
        setTimeout(() => {
          this.isTransitioning = false;
        }, 3000);
        return;
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
    const ownerSeq = this.playSequenceId;
    const ownerTrackId = this.currentTrackId;
    // If the user moved to another song while we searched an alternate, never load the old song's audio
    const isStale = () => this.playSequenceId !== ownerSeq || this.currentTrackId !== ownerTrackId;
    try {
      // Another upload of the SAME song (same title, artist and length), never a loose
      // "official video" search, which could bring a different song
      const track = usePlayerStore.getState().currentTrack;
      const candidates = track ? await this.fetchSourceCandidates(track) : [];
      const pick = candidates.find((c) => !this.failedVideoIds.has(c.videoId) && c.videoId !== this.currentVideoId && c.match);
      const videoId = pick?.videoId || null;

      if (isStale()) return;

      if (videoId && this.ytPlayer && typeof this.ytPlayer.loadVideoById === 'function') {
        // Continue from where the song was (same song, so the same second)
        const pos = Math.max(0, (usePlayerStore.getState().progressMs || 0) / 1000);
        this.currentVideoId = videoId;
        persistVideoId(originalQuery, videoId);
        this.activeEngine = 'youtube';
        this.lastTrackStartTime = Date.now();
        this.ytPlayer.loadVideoById({ videoId, startSeconds: pos > 3 ? pos : 0 });
        this.ytPlayer.playVideo();
        this.startBackgroundCarrier();
        usePlayerStore.setState({ isPlaying: true });
        this.startProgressTicker();
        if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
          try { navigator.mediaSession.playbackState = 'playing'; } catch (_) {}
        }
      } else {
        console.warn('[AudioEngine] Alternate YouTube resolve failed, streaming via HTML5 fallback');
        this.activeEngine = 'html5';
        this.audio.src = `${API_BASE}/api/audio/stream?q=${encodeURIComponent(originalQuery)}`;
        this.audio.currentTime = 0;
        this.audio.volume = this.getEffectiveVolume();
        await this.audio.play();
        this.startCarrier();
        usePlayerStore.setState({ isPlaying: true });
        this.startProgressTicker();
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
        const { isMuted } = usePlayerStore.getState();
        if (!isMuted) this.ytPlayer.setVolume(Math.round(this.getEffectiveVolume() * 100));
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
    this.stopAuxiliaryTransitionFX();
    if (this.audioContext) {
      const now = this.audioContext.currentTime;
      if (this.deckStrips[0]) cancelScheduledAutomations(this.deckStrips[0], now);
      if (this.deckStrips[1]) cancelScheduledAutomations(this.deckStrips[1], now);
    }
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
          if (this.ensureActiveVideoMatches()) {
            this.startProgressTicker();
            usePlayerStore.setState({ isPlaying: true });
            return;
          }
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
      this.stopAuxiliaryTransitionFX();
      if (this.audioContext) {
        const now = this.audioContext.currentTime;
        if (this.deckStrips[0]) cancelScheduledAutomations(this.deckStrips[0], now);
        if (this.deckStrips[1]) cancelScheduledAutomations(this.deckStrips[1], now);
      }
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

  public isAudioDucked: boolean = false;
  private previousDuckedVolume: number | null = null;
  private currentFadingVolume: number | null = null;
  private duckFraction: number = 0.08;
  private duckFadeInterval: any = null;

  public setDuckedVolume(fraction: number = 0.10) {
    if (this.duckFadeInterval !== null) {
      clearInterval(this.duckFadeInterval);
      this.duckFadeInterval = null;
    }
    this.currentFadingVolume = null;
    this.isAudioDucked = true;
    this.duckFraction = fraction;
    if (this.previousDuckedVolume === null) {
      const v = usePlayerStore.getState().volume;
      this.previousDuckedVolume = v && v > 0.05 ? v : 1.0;
    }
    this.applyCurrentVolume();
  }

  public restoreDuckedVolume(fadeDurationMs: number = 1500) {
    if (this.duckFadeInterval !== null) {
      clearInterval(this.duckFadeInterval);
      this.duckFadeInterval = null;
    }

    const target = this.previousDuckedVolume ?? usePlayerStore.getState().volume;
    const startVol = this.getEffectiveVolume();

    if (fadeDurationMs <= 100 || Math.abs(target - startVol) < 0.02) {
      this.isAudioDucked = false;
      this.currentFadingVolume = null;
      this.previousDuckedVolume = null;
      this.setVolume(target);
      return;
    }

    const steps = 24;
    const stepTime = Math.max(30, Math.round(fadeDurationMs / steps));
    let currentStep = 0;

    this.duckFadeInterval = setInterval(() => {
      currentStep++;
      const progress = Math.min(1, currentStep / steps);
      // Smooth sinusoidal crescendo curve
      const factor = Math.sin(progress * Math.PI * 0.5);
      const curVol = startVol + (target - startVol) * factor;
      this.currentFadingVolume = curVol;

      const ytVol = Math.round(Math.max(0, Math.min(1, curVol)) * 100);
      if (this.ytPlayer && typeof this.ytPlayer.setVolume === 'function') {
        try { this.ytPlayer.setVolume(ytVol); } catch {}
      }
      if (Array.isArray(this.ytPlayers)) {
        this.ytPlayers.forEach((p) => {
          if (p && typeof p.setVolume === 'function') {
            try { p.setVolume(ytVol); } catch {}
          }
        });
      }
      this.audio.volume = Math.max(0, Math.min(1, curVol));
      if (this.secondaryAudio) {
        this.secondaryAudio.volume = Math.max(0, Math.min(1, curVol));
      }
      if (this.masterGain && this.audioContext) {
        try { this.masterGain.gain.setValueAtTime(curVol, this.audioContext.currentTime); } catch {}
      }

      if (currentStep >= steps) {
        clearInterval(this.duckFadeInterval);
        this.duckFadeInterval = null;
        this.currentFadingVolume = null;
        this.isAudioDucked = false;
        this.previousDuckedVolume = null;
        this.setVolume(target);
      }
    }, stepTime);
  }

  public getEffectiveVolume(): number {
    // Muted or at zero: really silent everywhere (song changes call unMute() on the players and
    // the DJ ducking kept a 2 % floor, so "zero" still let some sound through)
    const st = usePlayerStore.getState();
    if (st.isMuted || st.volume <= 0.001) return 0;
    if (this.currentFadingVolume !== null) {
      return this.currentFadingVolume;
    }
    if (this.isAudioDucked) {
      const base = this.previousDuckedVolume ?? usePlayerStore.getState().volume;
      return Math.max(0.02, base * this.duckFraction);
    }
    return usePlayerStore.getState().volume;
  }

  private applyCurrentVolume() {
    const eff = this.getEffectiveVolume();
    const ytVol = Math.round(eff * 100);
    if (this.ytPlayer && typeof this.ytPlayer.setVolume === 'function') {
      try { this.ytPlayer.setVolume(ytVol); } catch {}
    }
    if (Array.isArray(this.ytPlayers)) {
      this.ytPlayers.forEach((p) => {
        if (p && typeof p.setVolume === 'function') {
          try { p.setVolume(ytVol); } catch {}
        }
      });
    }
    this.audio.volume = eff;
    if (this.secondaryAudio) {
      this.secondaryAudio.volume = eff;
    }
    if (this.masterGain && this.audioContext) {
      try { this.masterGain.gain.setValueAtTime(eff, this.audioContext.currentTime); } catch {}
    }
  }

  public setVolume(val: number) {
    if (this.isAudioDucked) {
      this.previousDuckedVolume = Math.max(0, Math.min(1, val));
      this.applyCurrentVolume();
      return;
    }
    const clamped = Math.max(0, Math.min(1, val));
    const ytVol = Math.round(clamped * 100);
    if (this.ytPlayer && typeof this.ytPlayer.setVolume === 'function') {
      try {
        this.ytPlayer.setVolume(ytVol);
      } catch {}
    }
    if (Array.isArray(this.ytPlayers)) {
      this.ytPlayers.forEach((p) => {
        if (p && typeof p.setVolume === 'function') {
          try {
            p.setVolume(ytVol);
          } catch {}
        }
      });
    }
    this.audio.volume = clamped;
    if (this.secondaryAudio) {
      this.secondaryAudio.volume = clamped;
    }
  }

  public setMuted(muted: boolean) {
    // Every deck, not only the main one (the DJ / crossfade deck kept playing)
    const players = [this.ytPlayer, this.secondaryYtPlayer, ...(Array.isArray(this.ytPlayers) ? this.ytPlayers : [])];
    for (const p of new Set(players)) {
      if (!p) continue;
      try {
        if (muted && typeof p.mute === 'function') p.mute();
        else if (!muted && typeof p.unMute === 'function') p.unMute();
      } catch {}
    }
    for (const a of [this.audio, this.secondaryAudio, ...(Array.isArray(this.audios) ? this.audios : [])]) {
      if (a) a.muted = muted;
    }
    this.applyCurrentVolume();
  }

  public setEqualizerBand(index: number, gainDb: number) {
    if (this.filterNodes[index]) {
      if (this.audioContext && this.audioContext.state === 'running') {
        const t = this.audioContext.currentTime;
        this.filterNodes[index].gain.cancelScheduledValues(t);
        this.filterNodes[index].gain.setTargetAtTime(gainDb, t, 0.02);
      } else {
        this.filterNodes[index].gain.value = gainDb;
      }
    }
  }

  /** Applies EQ gains (dB per band) without touching the saved settings. */
  public applyEqualizerGains(gains: number[]) {
    this.initAudioContext();
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }
    gains.forEach((g, i) => this.setEqualizerBand(i, g));
  }

  /** True when the current song plays through the app's own audio path (EQ and DJ filters apply). */
  public isProcessingAudio(): boolean {
    return this.activeEngine === 'html5';
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
        const t = this.audioContext.currentTime;
        this.compressorNode.threshold.cancelScheduledValues(t);
        this.compressorNode.ratio.cancelScheduledValues(t);
        if (enabled) {
          this.compressorNode.threshold.setTargetAtTime(-20, t, 0.05);
          this.compressorNode.ratio.setTargetAtTime(4, t, 0.05);
          this.compressorNode.knee.setTargetAtTime(12, t, 0.05);
        } else {
          this.compressorNode.threshold.setTargetAtTime(0, t, 0.05);
          this.compressorNode.ratio.setTargetAtTime(1, t, 0.05);
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
    const isRunning = this.audioContext && this.audioContext.state === 'running';
    const t = isRunning ? this.audioContext!.currentTime : 0;
    bands.forEach((b, idx) => {
      if (this.filterNodes[idx]) {
        if (isRunning) {
          this.filterNodes[idx].gain.cancelScheduledValues(t);
          this.filterNodes[idx].gain.setTargetAtTime(b.value, t, 0.02);
        } else {
          this.filterNodes[idx].gain.value = b.value;
        }
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
    return null;
  }
}

export const audioEngine = new AudioEngine();
if (typeof window !== 'undefined') {
  (window as any).__audioEngine = audioEngine;
}
