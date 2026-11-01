/**
 * Spotify AI DJ Natural Spanish Speech Synthesis & Audio Ducking Engine
 * Powered by Neural Edge-TTS (es-ES-AlvaroNeural) with SpeechSynthesis Fallback
 */

export interface DJVoiceOptions {
  onWord?: (word: string, currentFullText: string) => void;
  onVoiceLevel?: (level: number) => void;
  onEnd?: () => void;
  rate?: number;
  pitch?: number;
}

export interface AIDJConfig {
  voice: string;
  provider: 'edge' | 'openai' | 'elevenlabs' | 'cartesia';
  apiKey?: string;
  voiceId?: string;
}

const DEFAULT_CONFIG: AIDJConfig = {
  voice: 'es-MX-DaliaNeural', // Official Spotify DJ Livi persona
  provider: 'edge',
  apiKey: '',
  voiceId: '',
};

class AIDJVoiceService {
  private isSpeaking: boolean = false;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private currentAudio: HTMLAudioElement | null = null;
  private abortController: AbortController | null = null;
  private voiceLevelInterval: any = null;
  private cachedSpanishVoice: SpeechSynthesisVoice | null = null;
  private ttsCache: Map<string, string> = new Map();
  private config: AIDJConfig = DEFAULT_CONFIG;

  constructor() {
    if (typeof window !== 'undefined') {
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
    }
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
      const engine = typeof window !== 'undefined' ? (window as any).__audioEngine : null;
      if (engine && typeof engine.setDuckedVolume === 'function') {
        engine.setDuckedVolume(0.18);
      } else {
        const audioElements = document.querySelectorAll('audio, video');
        audioElements.forEach((el: any) => {
          if (!el.dataset.djDucked && el !== this.currentAudio) {
            el.dataset.prevVol = el.volume;
            el.dataset.djDucked = 'true';
            el.volume = Math.max(0.1, el.volume * 0.2);
          }
        });
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
      const engine = typeof window !== 'undefined' ? (window as any).__audioEngine : null;
      if (engine && typeof engine.restoreDuckedVolume === 'function') {
        engine.restoreDuckedVolume();
      } else {
        const audioElements = document.querySelectorAll('audio, video');
        audioElements.forEach((el: any) => {
          if (el.dataset.djDucked && el.dataset.prevVol && el !== this.currentAudio) {
            el.volume = parseFloat(el.dataset.prevVol);
            delete el.dataset.djDucked;
            delete el.dataset.prevVol;
          }
        });
      }
    } catch (e) {
      console.warn('[AIDJVoice] Restore audio warning:', e);
    }
  }

  /**
   * High-fidelity Neural Edge-TTS playback (es-ES-AlvaroNeural)
   */
  private async speakViaNeuralTTS(text: string, options: DJVoiceOptions = {}): Promise<boolean> {
    try {
      this.abortController = new AbortController();
      const signal = this.abortController.signal;

      let audioUrl = this.ttsCache.get(text);
      if (!audioUrl) {
        const params = new URLSearchParams({
          text,
          voice: this.config.voice || 'es-MX-DaliaNeural',
          provider: this.config.provider || 'edge',
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
        this.ttsCache.set(text, audioUrl);
      }

      if (!this.isSpeaking) return true;

      const audio = new Audio(audioUrl);
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

        // Realistic speech voice level pulsation for the orb visualizer
        let phase = 0;
        this.voiceLevelInterval = setInterval(() => {
          if (!this.isSpeaking || audio.paused) {
            options.onVoiceLevel?.(0.05);
            return;
          }
          phase += 0.28;
          const raw = Math.sin(phase) * 0.45 + Math.sin(phase * 2.1) * 0.35 + 0.55;
          const bounded = Math.max(0.18, Math.min(1.0, raw));
          options.onVoiceLevel?.(bounded);
        }, 50);

        // Word subtitle progression in exact synchronization with playback
        audio.ontimeupdate = () => {
          if (!audio.duration || audio.duration === Infinity) return;
          const progress = Math.max(0, Math.min(1, audio.currentTime / audio.duration));
          const wordIndex = Math.min(words.length - 1, Math.floor(progress * words.length));
          const currentWord = words[wordIndex] || '';
          const partial = words.slice(0, wordIndex + 1).join(' ');
          options.onWord?.(currentWord, partial);
        };

        audio.onended = () => {
          cleanup();
        };

        audio.onerror = (e) => {
          console.warn('[AIDJVoice] Neural audio playback error:', e);
          cleanup();
          resolve(false);
        };

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
   * Browser SpeechSynthesis fallback
   */
  private async speakViaSpeechSynthesis(text: string, options: DJVoiceOptions = {}): Promise<void> {
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
      utterance.rate = options.rate || 1.02;
      utterance.pitch = options.pitch || 0.98;

      let phase = 0;
      this.voiceLevelInterval = setInterval(() => {
        phase += 0.3;
        const raw = Math.sin(phase) * 0.4 + Math.sin(phase * 2.3) * 0.3 + 0.5;
        const bounded = Math.max(0.15, Math.min(1.0, raw));
        options.onVoiceLevel?.(bounded);
      }, 50);

      let wordIdx = 0;
      const words = text.split(/\s+/);
      const delayPerWord = Math.max(160, Math.min(280, 220 / (options.rate || 1.0)));

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
    this.duckAudio();

    // 1. Prioritize high-fidelity Neural Edge-TTS (es-ES-AlvaroNeural)
    const success = await this.speakViaNeuralTTS(text, options);
    if (success) {
      return;
    }

    // 2. Fallback to browser SpeechSynthesis if Neural TTS failed or is offline
    if (this.isSpeaking) {
      console.info('[AIDJVoice] Fallback to browser SpeechSynthesis');
      return this.speakViaSpeechSynthesis(text, options);
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
