/**
 * Spotify AI DJ Natural Spanish Speech Synthesis & Audio Ducking Engine
 * Powered by Neural Edge-TTS (es-ES-AlvaroNeural) with SpeechSynthesis Fallback
 */

import { useLanguageStore } from '../utils/i18n';
import { audioEngine } from './audioEngine';

export type DJVoiceId = 'alvaro' | 'salome' | 'gemini';

export interface DJVoiceOptionItem {
  id: DJVoiceId;
  name: string;
  region: string;
  description: string;
}

export const DJ_VOICE_OPTIONS: DJVoiceOptionItem[] = [
  {
    id: 'alvaro',
    name: 'Álvaro',
    region: 'España',
    description: 'Locutor de radio profesional • Tono cálido e inmersivo',
  },
  {
    id: 'salome',
    name: 'Salomé',
    region: 'Colombia',
    description: 'Asistente de audio dinámica • Tono latino enérgico',
  },
  {
    id: 'gemini',
    name: 'Gemini IA',
    region: 'Google Cloud',
    description: 'Modelo generativo multimodal de última generación',
  },
];

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
}

const DEFAULT_CONFIG: AIDJConfig = {
  voice: 'alvaro',
  provider: 'edge',
  apiKey: '',
  voiceId: '',
};

class AIDJVoiceService {
  private isSpeaking: boolean = false;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private currentAudio: HTMLAudioElement | null = null;
  private persistentMobileAudio: HTMLAudioElement | null = null;
  private abortController: AbortController | null = null;
  private voiceLevelInterval: any = null;
  private cachedSpanishVoice: SpeechSynthesisVoice | null = null;
  private ttsCache: Map<string, string> = new Map();
  private config: AIDJConfig = DEFAULT_CONFIG;
  private selectedVoiceId: DJVoiceId = 'alvaro';
  private testPhraseIndex: number = 0;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const savedVoice = localStorage.getItem('spotifree_dj_voice_choice') as DJVoiceId;
        if (savedVoice === 'alvaro' || savedVoice === 'salome' || savedVoice === 'gemini') {
          this.selectedVoiceId = savedVoice;
        }
      } catch {}

      try {
        const saved = localStorage.getItem('spotifree_ai_dj_config');
        if (saved) {
          this.config = { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
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
      if (!this.persistentMobileAudio) {
        this.persistentMobileAudio = new Audio();
        this.persistentMobileAudio.preload = 'auto';
      }
      this.persistentMobileAudio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
      this.persistentMobileAudio.volume = 0.01;
      const playPromise = this.persistentMobileAudio.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise.then(() => {
          this.persistentMobileAudio?.pause();
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
    return this.selectedVoiceId;
  }

  public setSelectedVoice(voice: DJVoiceId) {
    if (voice !== 'alvaro' && voice !== 'salome' && voice !== 'gemini') return;
    this.selectedVoiceId = voice;
    this.config.voice = voice;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('spotifree_dj_voice_choice', voice);
      } catch {}
    }
  }

  /**
   * Prefetches audio for a phrase into memory cache for instantaneous response
   */
  public prefetchPhrase(text: string) {
    if (typeof window === 'undefined' || !text || text.trim().length === 0) return;
    try {
      const lang = useLanguageStore.getState().language;
      const activeVoice = this.getSelectedVoice();
      const cacheKey = `${lang}:${activeVoice}:${text}`;
      if (this.ttsCache.has(cacheKey)) return;

      const params = new URLSearchParams({
        text,
        voice: activeVoice,
        provider: activeVoice === 'gemini' ? 'gemini' : 'edge',
        lang,
      });
      fetch(`/api/tts?${params.toString()}`)
        .then((r) => (r.ok ? r.blob() : null))
        .then((blob) => {
          if (blob && blob.size > 500) {
            const url = URL.createObjectURL(blob);
            this.ttsCache.set(cacheKey, url);
          }
        })
        .catch(() => {});
    } catch {}
  }

  public async testVoice(voiceId?: DJVoiceId): Promise<void> {
    if (voiceId) {
      this.setSelectedVoice(voiceId);
    }
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
    return this.speak(phrase);
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
      if (audioEngine && typeof audioEngine.setDuckedVolume === 'function') {
        audioEngine.setDuckedVolume(0.10);
      } else if (typeof window !== 'undefined' && (window as any).__audioEngine) {
        (window as any).__audioEngine.setDuckedVolume(0.10);
      }
    } catch (e) {
      console.warn('[AIDJVoice] Duck audio warning:', e);
    }
  }

  /**
   * Restore music audio when DJ finishes speaking
   */
  private restoreAudio() {
    try {
      if (audioEngine && typeof audioEngine.restoreDuckedVolume === 'function') {
        audioEngine.restoreDuckedVolume(1000);
      } else if (typeof window !== 'undefined' && (window as any).__audioEngine) {
        (window as any).__audioEngine.restoreDuckedVolume(1000);
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
      if (!audioUrl) {
        const params = new URLSearchParams({
          text,
          voice: activeVoice,
          provider: activeVoice === 'gemini' ? 'gemini' : 'edge',
          lang,
        });
        if (this.config.apiKey) params.set('apiKey', this.config.apiKey);
        if (this.config.voiceId) params.set('voiceId', this.config.voiceId);

        const res = await fetch(`/api/tts?${params.toString()}`, {
          signal,
        });
        if (!res.ok) {
          throw new Error(`TTS API returned ${res.status}`);
        }
        const blob = await res.blob();
        if (blob.size < 500) {
          throw new Error('TTS returned incomplete audio blob');
        }
        audioUrl = URL.createObjectURL(blob);
        if (this.ttsCache.size > 20) {
          const firstKey = this.ttsCache.keys().next().value;
          if (firstKey) {
            const oldUrl = this.ttsCache.get(firstKey);
            if (oldUrl) URL.revokeObjectURL(oldUrl);
            this.ttsCache.delete(firstKey);
          }
        }
        this.ttsCache.set(cacheKey, audioUrl);
      }

      if (!this.isSpeaking) return true;

      // Ensure any previous audio instance is stopped immediately
      if (this.currentAudio) {
        try {
          this.currentAudio.pause();
          this.currentAudio.currentTime = 0;
          this.currentAudio.src = '';
        } catch {}
      }

      // Reuse persistent blessed element on mobile to bypass autoplay restrictions and keep pristine fidelity
      let audio = this.persistentMobileAudio;
      if (!audio) {
        audio = new Audio();
        this.persistentMobileAudio = audio;
      }
      audio.src = audioUrl;
      audio.preload = 'auto';
      audio.playbackRate = 1.0;
      audio.volume = 1.0;
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
          options.onVoiceLevel?.(0);
          options.onWord?.('', text);
          this.restoreAudio();
          this.isSpeaking = false;
          this.currentAudio = null;
          options.onEnd?.();
          resolve(true);
        };

        // Smooth 30ms high-frequency timer for fluid voice level and real-time streaming word subtitles
        let phase = 0;
        let lastReportedWordIdx = -1;
        this.voiceLevelInterval = setInterval(() => {
          if (!this.isSpeaking || audio.paused) {
            options.onVoiceLevel?.(0.05);
            return;
          }
          phase += 0.28;
          const raw = Math.sin(phase) * 0.45 + Math.sin(phase * 2.1) * 0.35 + 0.55;
          const bounded = Math.max(0.18, Math.min(1.0, raw));
          options.onVoiceLevel?.(bounded);

          // Fluid word subtitle progression calculated continuously at 30ms resolution
          if (audio.duration && audio.duration > 0 && !isNaN(audio.currentTime)) {
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

    if (!text || text.trim().length === 0) {
      options.onEnd?.();
      return;
    }

    this.isSpeaking = true;

    // High-fidelity Neural Studio TTS (Consistent Colombian persona - es-CO-SalomeNeural)
    const success = await this.speakViaNeuralTTS(text, options);
    if (!success && this.isSpeaking) {
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
