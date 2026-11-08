/**
 * Spotify AI DJ Natural Spanish Speech Synthesis & Audio Ducking Engine
 * Powered by Neural Edge-TTS (es-ES-AlvaroNeural) with SpeechSynthesis Fallback
 */

import { useLanguageStore } from '../utils/i18n';
import { audioEngine } from './audioEngine';
import { usePlayerStore } from '../store/usePlayerStore';

export type DJVoiceId = 'dalia' | 'elevenlabs' | 'sebastian' | 'alvaro' | 'salome' | 'gemini' | 'jorge' | 'elvira';

export interface DJVoiceOptionItem {
  id: DJVoiceId;
  name: string;
  region: string;
  description: string;
  descriptionEn: string;
}

/** The DJ's voices (Microsoft neural voices, with a radio presenter's delivery) */
export const DJ_VOICE_OPTIONS: DJVoiceOptionItem[] = [
  { id: 'dalia', name: 'Dalia', region: 'México', description: 'Cercana y con energía', descriptionEn: 'Warm and upbeat' },
  { id: 'jorge', name: 'Jorge', region: 'México', description: 'Locutor de radio, grave', descriptionEn: 'Radio host, deep' },
  { id: 'alvaro', name: 'Álvaro', region: 'España', description: 'Locutor joven y natural', descriptionEn: 'Young, natural host' },
  { id: 'elvira', name: 'Elvira', region: 'España', description: 'Clara y elegante', descriptionEn: 'Clear and elegant' },
  { id: 'salome', name: 'Salomé', region: 'Colombia', description: 'Alegre y musical', descriptionEn: 'Bright and musical' },
  { id: 'sebastian', name: 'Sebastián', region: 'Venezuela', description: 'Animado, de fiesta', descriptionEn: 'Lively, party vibe' },
];
const VOICE_KEY = 'spotifree_dj_voice_choice';
const isKnownVoice = (v: unknown): v is DJVoiceId => DJ_VOICE_OPTIONS.some((o) => o.id === v);

/** Exact time of each spoken word (ms), from the voice service */
interface WordTiming {
  t: number;
  d: number;
  w: string;
}

export interface DJVoiceOptions {
  onWord?: (word: string, currentFullText: string) => void;
  onVoiceLevel?: (level: number) => void;
  onEnd?: () => void;
  rate?: number;
  pitch?: number;
}

export interface AIDJConfig {
  voice: string;
  provider: 'edge' | 'openai' | 'elevenlabs' | 'cartesia' | 'gemini';
  apiKey?: string;
  voiceId?: string;
  azureKey?: string;
  azureRegion?: string;
}

const DEFAULT_CONFIG: AIDJConfig = {
  voice: 'dalia',
  provider: 'edge',
  apiKey: '',
  voiceId: '',
  azureKey: '',
  azureRegion: '',
};

export function cleanTextForNaturalTTS(text: string): string {
  if (!text) return '';
  return text
    .replace(/["“”«»]/g, '')
    // Replace multiple periods/ellipses with single period to eliminate awkward 700ms pauses
    .replace(/\.{2,}/g, '.')
    // Remove dashes that cause hesitation
    .replace(/[—–]/g, ' ')
    // Remove brackets and parentheses
    .replace(/[()[\]{}]/g, '')
    // Remove commas directly preceding exclamation or question marks
    .replace(/,\s*([!¡?¿])/g, ' $1')
    // Remove duplicate commas
    .replace(/,+/g, ',')
    // Replace semicolons with period for crisp sentence boundary
    .replace(/\s*;\s*/g, '. ')
    // Normalize spaces
    .replace(/\s+/g, ' ')
    .trim();
}

class AIDJVoiceService {
  private isSpeaking: boolean = false;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private currentAudio: HTMLAudioElement | null = null;
  private abortController: AbortController | null = null;
  private voiceLevelInterval: any = null;
  private cachedSpanishVoice: SpeechSynthesisVoice | null = null;
  private ttsCache: Map<string, string> = new Map();
  private config: AIDJConfig = DEFAULT_CONFIG;
  private selectedVoiceId: DJVoiceId = 'dalia';
  private testPhraseIndex: number = 0;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const v = localStorage.getItem(VOICE_KEY);
        this.selectedVoiceId = isKnownVoice(v) ? v : 'dalia';
      } catch {}

      try {
        const saved = localStorage.getItem('spotifree_ai_dj_config');
        if (saved) {
          this.config = { ...DEFAULT_CONFIG, ...JSON.parse(saved), voice: this.selectedVoiceId, provider: 'edge' };
        }
      } catch {}

      if ('speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = () => {
          this.resolveSpanishVoice();
        };
        this.resolveSpanishVoice();
      }

      // Pre-warm and unlock audio context on mobile user gesture
      const unlock = () => {
        this.unlockAudioForMobile();
      };
      window.addEventListener('click', unlock, { once: true, passive: true });
      window.addEventListener('touchstart', unlock, { once: true, passive: true });
    }
  }

  /**
   * Blesses an audio element during a user touch/click gesture to prevent mobile autoplay blocks
   */
  public unlockAudioForMobile() {
    if (typeof window === 'undefined') return;
    try {
      const dummy = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA');
      dummy.volume = 0.01;
      const playPromise = dummy.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise.then(() => {
          dummy.pause();
        }).catch(() => {});
      }
    } catch {}
  }

  public getConfig(): AIDJConfig {
    return { ...this.config };
  }

  public setConfig(newConfig: Partial<AIDJConfig>) {
    this.config = { ...this.config, ...newConfig };
    this.ttsCache.clear();
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('spotifree_ai_dj_config', JSON.stringify(this.config));
      } catch {}
    }
  }

  public getSelectedVoice(): DJVoiceId {
    if (this.previewOverride) return this.previewOverride;
    // Also picks up a voice synced from another device
    try {
      const v = localStorage.getItem(VOICE_KEY);
      if (isKnownVoice(v)) this.selectedVoiceId = v;
    } catch {}
    return this.selectedVoiceId;
  }

  public setSelectedVoice(voice?: DJVoiceId) {
    const v = isKnownVoice(voice) ? voice : 'dalia';
    this.selectedVoiceId = v;
    this.config.voice = v;
    this.config.provider = 'edge';
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(VOICE_KEY, v);
      } catch {}
    }
  }

  /** /api/tts parameters: the chosen voice, the presenter's delivery and word timings */
  private ttsParams(text: string, lang: string, voice: DJVoiceId): URLSearchParams {
    const provider = voice === 'gemini' ? 'gemini' : voice === 'elevenlabs' ? 'elevenlabs' : 'edge';
    const params = new URLSearchParams({ text, voice, provider, format: 'mp3', lang, style: 'dj', timings: '1', v: '5' });
    if (this.config.apiKey) params.set('apiKey', this.config.apiKey);
    if (this.config.voiceId) params.set('voiceId', this.config.voiceId);
    if (this.config.azureKey) params.set('azureKey', this.config.azureKey);
    if (this.config.azureRegion) params.set('azureRegion', this.config.azureRegion);
    return params;
  }

  /** Audio (blob URL) + word timings; works with the JSON answer and with plain audio */
  private async fetchSpeech(text: string, lang: string, voice: DJVoiceId, signal?: AbortSignal): Promise<{ url: string; words: WordTiming[] } | null> {
    const res = await fetch(`/api/tts?${this.ttsParams(text, lang, voice).toString()}`, { signal });
    if (!res.ok) throw new Error(`TTS API returned ${res.status}`);
    if ((res.headers.get('content-type') || '').includes('json')) {
      const data = await res.json();
      if (!data?.audio) return null;
      const bin = atob(data.audio);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      if (bytes.length < 500) return null;
      return { url: URL.createObjectURL(new Blob([bytes], { type: data.mime || 'audio/mpeg' })), words: Array.isArray(data.words) ? data.words : [] };
    }
    const blob = await res.blob();
    if (blob.size < 500) return null;
    return { url: URL.createObjectURL(blob), words: [] };
  }

  private wordCache: Map<string, WordTiming[]> = new Map();

  /** Real loudness of the DJ's voice (drives the sphere), when the audio can be analysed */
  private analyserCtx: AudioContext | null = null;
  private attachAnalyser(audio: HTMLAudioElement): AnalyserNode | null {
    try {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AC) return null;
      if (!this.analyserCtx) this.analyserCtx = new AC();
      const ctx = this.analyserCtx!;
      if ((ctx.state as string) !== 'running') {
        void ctx.resume().catch(() => {});
        // Not running yet: the element would be silent through the graph. Keep it direct.
        return null;
      }
      const src = ctx.createMediaElementSource(audio);
      const an = ctx.createAnalyser();
      an.fftSize = 512;
      an.smoothingTimeConstant = 0.6;
      src.connect(an);
      an.connect(ctx.destination);
      return an;
    } catch {
      return null;
    }
  }

  /**
   * Prefetches audio for a phrase into memory cache for instantaneous response
   */
  public prefetchPhrase(text: string) {
    if (typeof window === 'undefined' || !text || text.trim().length === 0) return;
    const clean = cleanTextForNaturalTTS(text);
    if (!clean) return;
    try {
      const lang = useLanguageStore.getState().language;
      const activeVoice = this.getSelectedVoice();
      const cacheKey = `${lang}:${activeVoice}:${clean}`;
      if (this.ttsCache.has(cacheKey)) return;
      this.fetchSpeech(clean, lang, activeVoice)
        .then((r) => {
          if (!r) return;
          this.ttsCache.set(cacheKey, r.url);
          this.wordCache.set(cacheKey, r.words);
        })
        .catch(() => {});
    } catch {}
  }

  /** Lets you hear a voice without choosing it (the settings' ▶ buttons) */
  private previewOverride: DJVoiceId | null = null;
  private previewToken = 0;
  public async previewVoice(voiceId: DJVoiceId): Promise<void> {
    const token = ++this.previewToken;
    this.previewOverride = voiceId;
    try {
      await this.speak(this.nextTestPhrase());
    } finally {
      if (token === this.previewToken) this.previewOverride = null;
    }
  }

  public async testVoice(voiceId?: DJVoiceId): Promise<void> {
    if (voiceId) {
      this.setSelectedVoice(voiceId);
    }
    return this.speak(this.nextTestPhrase());
  }

  private nextTestPhrase(): string {
    const lang = useLanguageStore.getState().language;
    const isEn = lang === 'en';
    const phrases = isEn
      ? [
          "Hey there! I'm your personal Spotifree DJ, ready to drop some great tracks for you.",
          "Tuning the audio levels. Getting your personalized mix ready.",
          "This is a quick voice check. Let me know what vibe you're feeling today.",
        ]
      : [
          '¡Hola! Soy tu DJ personal de Spotifree, listo para ponerle ritmo a tu día.',
          'Ajustando los niveles de sonido. Preparando los mejores temas para ti.',
          'Esta es una prueba de mi voz. Dime qué estilo te apetece y nos ponemos en marcha.',
        ];
    const phrase = phrases[this.testPhraseIndex % phrases.length];
    this.testPhraseIndex++;
    return phrase;
  }

  public resolveSpanishVoice(): SpeechSynthesisVoice | null {
    if (typeof window === 'undefined' || !window.speechSynthesis) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return null;

    const spanishVoices = voices.filter((v) => v.lang.startsWith('es'));
    if (spanishVoices.length === 0) return null;

    // 1. Modern High-Fidelity Neural / Cloud voices (Google español, Microsoft Natural/Neural)
    const googleSpain = spanishVoices.find(
      (v) => v.name.toLowerCase().includes('google español') && !v.name.toLowerCase().includes('estados unidos')
    );
    if (googleSpain) {
      this.cachedSpanishVoice = googleSpain;
      return googleSpain;
    }

    const naturalOnline = spanishVoices.find(
      (v) => v.name.toLowerCase().includes('natural') || v.name.toLowerCase().includes('neural')
    );
    if (naturalOnline) {
      this.cachedSpanishVoice = naturalOnline;
      return naturalOnline;
    }

    const anyGoogle = spanishVoices.find((v) => v.name.toLowerCase().includes('google'));
    if (anyGoogle) {
      this.cachedSpanishVoice = anyGoogle;
      return anyGoogle;
    }

    // 2. Charismatic male radio-host voices
    const maleVoice = spanishVoices.find((v) => /pablo|jorge|diego|alvaro|carlos/i.test(v.name));
    if (maleVoice) {
      this.cachedSpanishVoice = maleVoice;
      return maleVoice;
    }

    // 3. Any Spanish voice avoiding legacy robotic Windows SAPI voices if possible
    const modernOther = spanishVoices.find(
      (v) => !/helena|laura|sabina/i.test(v.name.toLowerCase())
    );
    if (modernOther) {
      this.cachedSpanishVoice = modernOther;
      return modernOther;
    }

    this.cachedSpanishVoice = spanishVoices[0];
    return spanishVoices[0];
  }

  public getSpanishVoice(): SpeechSynthesisVoice | null {
    const voice = this.resolveSpanishVoice();
    return voice || this.cachedSpanishVoice;
  }

  /**
   * Duck music audio when DJ begins speaking
   */
  private duckAudio() {
    try {
      // Lower background music volume smoothly to 12% so the new song plays quietly under the DJ's voice
      if (audioEngine && typeof audioEngine.setDuckedVolume === 'function') {
        audioEngine.setDuckedVolume(0.12);
      } else if (typeof window !== 'undefined' && (window as any).__audioEngine) {
        (window as any).__audioEngine.setDuckedVolume(0.12);
      }
    } catch (e) {
      console.warn('[AIDJVoice] Duck audio warning:', e);
    }
  }

  /**
   * Restore music audio smoothly when DJ finishes speaking
   */
  private restoreAudio() {
    try {
      const { isPlaying } = usePlayerStore.getState();
      if (isPlaying && audioEngine && typeof audioEngine.startCarrier === 'function') {
        audioEngine.startCarrier();
      }
      if (audioEngine && typeof audioEngine.restoreDuckedVolume === 'function') {
        audioEngine.restoreDuckedVolume(1200);
      } else if (typeof window !== 'undefined' && (window as any).__audioEngine) {
        (window as any).__audioEngine.restoreDuckedVolume(1200);
      }
    } catch (e) {
      console.warn('[AIDJVoice] Restore audio warning:', e);
    }
  }

  /**
   * High-fidelity Neural Edge-TTS / Gemini playback
   */
  private async speakViaNeuralTTS(text: string, options: DJVoiceOptions = {}): Promise<boolean> {
    try {
      this.abortController = new AbortController();
      const signal = this.abortController.signal;

      const lang = useLanguageStore.getState().language;
      const activeVoice = this.getSelectedVoice();
      const cacheKey = `${lang}:${activeVoice}:${text}`;
      let audioUrl = this.ttsCache.get(cacheKey);
      let timings = this.wordCache.get(cacheKey) || [];
      if (!audioUrl) {
        const got = await this.fetchSpeech(text, lang, activeVoice, signal);
        if (!got) {
          throw new Error('TTS returned incomplete audio blob');
        }
        audioUrl = got.url;
        timings = got.words;
        if (this.ttsCache.size > 20) {
          const firstKey = this.ttsCache.keys().next().value;
          if (firstKey) {
            const oldUrl = this.ttsCache.get(firstKey);
            if (oldUrl) URL.revokeObjectURL(oldUrl);
            this.ttsCache.delete(firstKey);
            this.wordCache.delete(firstKey);
          }
        }
        this.ttsCache.set(cacheKey, audioUrl);
        this.wordCache.set(cacheKey, timings);
      }

      if (!this.isSpeaking) return true;

      // Ensure any previous audio instance is stopped immediately
      if (this.currentAudio) {
        try {
          this.currentAudio.pause();
          this.currentAudio.currentTime = 0;
          this.currentAudio.src = '';
        } catch {}
        this.currentAudio = null;
      }

      // Always create a clean, untainted native audio element for pristine studio fidelity
      const audio = new Audio();
      audio.src = audioUrl;
      audio.preload = 'auto';
      audio.playbackRate = 1.0;
      audio.volume = 1.0; // Full 100% volume matching music playback
      audio.setAttribute('playsinline', 'true');
      audio.setAttribute('webkit-playsinline', 'true');
      (audio as any).preservesPitch = true;
      audio.style.display = 'none';
      if (typeof document !== 'undefined' && document.body) {
        document.body.appendChild(audio);
      }
      this.currentAudio = audio;

      return new Promise<boolean>((resolve) => {
        let isDone = false;
        const words = text.split(/\s+/).filter(Boolean);

        const cleanup = () => {
          if (isDone) return;
          isDone = true;
          if (this.voiceLevelInterval) {
            clearInterval(this.voiceLevelInterval);
            this.voiceLevelInterval = null;
          }
          if (audio.parentNode) {
            try { audio.parentNode.removeChild(audio); } catch {}
          }
          options.onVoiceLevel?.(0);
          options.onWord?.('', text);
          this.restoreAudio();
          this.isSpeaking = false;
          this.currentAudio = null;
          options.onEnd?.();
          resolve(true);
        };

        // The sphere follows the real loudness of the voice when the audio can be analysed
        const analyser = this.attachAnalyser(audio);
        const samples = analyser ? new Uint8Array(analyser.fftSize) : null;

        // Smooth 30ms high-frequency timer for fluid voice level and real-time streaming word subtitles
        let phase = 0;
        let lastReportedWordIdx = -1;
        this.voiceLevelInterval = setInterval(() => {
          if (!this.isSpeaking || audio.paused) {
            options.onVoiceLevel?.(0.05);
            return;
          }
          if (analyser && samples) {
            analyser.getByteTimeDomainData(samples);
            let sum = 0;
            for (let i = 0; i < samples.length; i++) {
              const v = (samples[i] - 128) / 128;
              sum += v * v;
            }
            const rms = Math.sqrt(sum / samples.length);
            options.onVoiceLevel?.(Math.max(0.08, Math.min(1, rms * 4.2)));
          } else {
            phase += 0.28;
            const raw = Math.sin(phase) * 0.45 + Math.sin(phase * 2.1) * 0.35 + 0.55;
            options.onVoiceLevel?.(Math.max(0.18, Math.min(1.0, raw)));
          }

          // Exact captions: the words the voice has really said (timings from the voice service)
          if (timings.length > 0 && !isNaN(audio.currentTime)) {
            const nowMs = audio.currentTime * 1000 + 60;
            let spoken = 0;
            while (spoken < timings.length && timings[spoken].t <= nowMs) spoken++;
            const wordIndex = Math.min(words.length - 1, Math.round((spoken / timings.length) * words.length) - 1);
            if (wordIndex >= 0 && wordIndex !== lastReportedWordIdx) {
              lastReportedWordIdx = wordIndex;
              options.onWord?.(words[wordIndex] || '', words.slice(0, wordIndex + 1).join(' '));
            }
          } else if (audio.duration && audio.duration > 0 && !isNaN(audio.currentTime)) {
            // Fluid word subtitle progression calculated continuously at 30ms resolution
            const effectiveTime = Math.min(audio.duration, audio.currentTime + 0.09);
            const progress = Math.max(0, Math.min(1, effectiveTime / audio.duration));
            const wordIndex = Math.min(words.length - 1, Math.floor(progress * words.length));
            if (wordIndex !== lastReportedWordIdx) {
              lastReportedWordIdx = wordIndex;
              const currentWord = words[wordIndex] || '';
              const partial = words.slice(0, wordIndex + 1).join(' ');
              options.onWord?.(currentWord, partial);
            }
          }
        }, 30);

        audio.onended = () => {
          cleanup();
        };

        audio.onerror = (e) => {
          console.warn('[AIDJVoice] Neural audio playback error:', e);
          cleanup();
          resolve(false);
        };

        // Duck music right as speech playback starts
        this.duckAudio();
        if (typeof window !== 'undefined' && (window as any).speechRecognitionInstance) {
          try { (window as any).speechRecognitionInstance.abort(); } catch {}
        }
        audio.play().catch((err) => {
          console.warn('[AIDJVoice] Play rejected (autoplay block or aborted):', err);
          cleanup();
          resolve(false);
        });
      });
    } catch (e: any) {
      if (e?.name === 'AbortError') return true;
      console.warn('[AIDJVoice] Neural TTS fetch failed, will fallback to speechSynthesis:', e);
      return false;
    }
  }

  /**
   * Browser SpeechSynthesis (available as manual test utility)
   */
  public async speakViaSpeechSynthesis(text: string, options: DJVoiceOptions = {}): Promise<void> {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      console.warn('[AIDJVoice] Speech synthesis not supported, simulating speech');
      await this.simulateSpeech(text, options);
      this.restoreAudio();
      this.isSpeaking = false;
      options.onEnd?.();
      return;
    }

    return new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      this.currentUtterance = utterance;

      const voice = this.getSpanishVoice();
      if (voice) {
        utterance.voice = voice;
      }
      utterance.lang = voice ? voice.lang : 'es-ES';
      utterance.rate = options.rate || 1.16;
      utterance.pitch = options.pitch || 1.0;

      let phase = 0;
      this.voiceLevelInterval = setInterval(() => {
        phase += 0.3;
        const raw = Math.sin(phase) * 0.4 + Math.sin(phase * 2.3) * 0.3 + 0.5;
        const bounded = Math.max(0.15, Math.min(1.0, raw));
        options.onVoiceLevel?.(bounded);
      }, 50);

      let wordIdx = 0;
      const words = text.split(/\s+/);
      const delayPerWord = Math.max(140, Math.min(240, 190 / (options.rate || 1.16)));

      const wordInterval = setInterval(() => {
        if (wordIdx < words.length) {
          wordIdx++;
          const partial = words.slice(0, wordIdx).join(' ');
          options.onWord?.(words[wordIdx - 1], partial);
        } else {
          clearInterval(wordInterval);
        }
      }, delayPerWord);

      const maxSpeechMs = Math.max(2500, words.length * delayPerWord + 1500);
      let isDone = false;

      const finish = () => {
        if (isDone) return;
        isDone = true;
        clearInterval(wordInterval);
        clearInterval(this.voiceLevelInterval);
        this.voiceLevelInterval = null;
        options.onVoiceLevel?.(0);
        options.onWord?.('', text);
        this.restoreAudio();
        this.isSpeaking = false;
        this.currentUtterance = null;
        options.onEnd?.();
        resolve();
      };

      const safetyTimer = setTimeout(() => {
        finish();
      }, maxSpeechMs);

      utterance.onend = () => {
        clearTimeout(safetyTimer);
        finish();
      };

      utterance.onerror = (err) => {
        console.warn('[AIDJVoice] Speech error:', err);
        clearTimeout(safetyTimer);
        finish();
      };

      try {
        window.speechSynthesis.cancel();
        this.duckAudio();
        window.speechSynthesis.speak(utterance);
      } catch (e) {
        console.error('[AIDJVoice] Failed to speak:', e);
        clearTimeout(safetyTimer);
        finish();
      }
    });
  }

  /**
   * Speak DJ message in natural Spanish with voice level simulation and word streaming
   */
  public async speak(text: string, options: DJVoiceOptions = {}): Promise<void> {
    this.stopSpeaking();

    const clean = cleanTextForNaturalTTS(text);
    if (!clean || clean.trim().length === 0) {
      options.onEnd?.();
      return;
    }

    this.isSpeaking = true;

    // High-fidelity Neural Studio TTS with crisp intonation and zero awkward pauses
    const success = await this.speakViaNeuralTTS(clean, options);
    if (!success && this.isSpeaking) {
      // The voice service failed: the device's own voice rather than silence (when it has one)
      const hasDeviceVoice =
        typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.getVoices().length > 0;
      if (hasDeviceVoice) {
        await this.speakViaSpeechSynthesis(clean, options);
        return;
      }
      this.restoreAudio();
      this.isSpeaking = false;
      options.onEnd?.();
    }
  }

  /**
   * Fallback speech simulation if browser engine fails or speech is blocked
   */
  private async simulateSpeech(text: string, options: DJVoiceOptions): Promise<void> {
    const words = text.split(/\s+/);
    let spoken = '';
    const delayPerWord = 220;

    for (let i = 0; i < words.length; i++) {
      if (!this.isSpeaking) break;
      spoken += (i === 0 ? '' : ' ') + words[i];
      options.onWord?.(words[i], spoken);
      options.onVoiceLevel?.(Math.random() * 0.6 + 0.3);
      await new Promise((r) => setTimeout(r, delayPerWord));
    }
    options.onVoiceLevel?.(0);
  }

  /**
   * Stop any active speech immediately
   */
  public stopSpeaking() {
    this.isSpeaking = false;
    if (this.abortController) {
      try {
        this.abortController.abort();
      } catch {}
      this.abortController = null;
    }
    if (this.voiceLevelInterval) {
      clearInterval(this.voiceLevelInterval);
      this.voiceLevelInterval = null;
    }
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
        this.currentAudio.src = '';
      } catch {}
      this.currentAudio = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
    this.restoreAudio();
    this.currentUtterance = null;
  }

  public getIsSpeaking(): boolean {
    return this.isSpeaking;
  }

  public getCurrentUtterance(): SpeechSynthesisUtterance | null {
    return this.currentUtterance;
  }
}

export const aiDJVoiceService = new AIDJVoiceService();
if (typeof window !== 'undefined') {
  (window as any).__aiDJVoiceService = aiDJVoiceService;
}
