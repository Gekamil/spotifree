/**
 * Spotify AI DJ Natural Spanish Speech Synthesis & Audio Ducking Engine
 */

export interface DJVoiceOptions {
  onWord?: (word: string, currentFullText: string) => void;
  onVoiceLevel?: (level: number) => void;
  onEnd?: () => void;
  rate?: number;
  pitch?: number;
}

class AIDJVoiceService {
  private isSpeaking: boolean = false;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private voiceLevelInterval: any = null;
  private cachedSpanishVoice: SpeechSynthesisVoice | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = () => {
        this.resolveSpanishVoice();
      };
      this.resolveSpanishVoice();
    }
  }

  private resolveSpanishVoice(): SpeechSynthesisVoice | null {
    if (typeof window === 'undefined' || !window.speechSynthesis) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return null;

    const spanishVoices = voices.filter((v) => v.lang.startsWith('es'));
    if (spanishVoices.length === 0) return null;

    // Prioritized high-quality Spanish natural voices
    const preferredNames = [
      'google español',
      'google spanish',
      'jorge',
      'pablo',
      'diego',
      'carlos',
      'alvaro',
      'enrique',
      'helena',
      'monica',
      'paulina',
      'es-es',
      'es-mx',
      'es-us',
    ];

    for (const pref of preferredNames) {
      const match = spanishVoices.find(
        (v) =>
          v.name.toLowerCase().includes(pref) ||
          v.lang.toLowerCase().includes(pref)
      );
      if (match) {
        this.cachedSpanishVoice = match;
        return match;
      }
    }

    this.cachedSpanishVoice = spanishVoices[0];
    return spanishVoices[0];
  }

  public getSpanishVoice(): SpeechSynthesisVoice | null {
    if (this.cachedSpanishVoice) return this.cachedSpanishVoice;
    return this.resolveSpanishVoice();
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
          if (!el.dataset.djDucked) {
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
          if (el.dataset.djDucked && el.dataset.prevVol) {
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

    // Fallback if browser doesn't have speechSynthesis
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
      utterance.rate = options.rate || 1.02; // Energetic natural radio host cadence
      utterance.pitch = options.pitch || 0.98;

      // Start acoustic voice level modulation
      let phase = 0;
      this.voiceLevelInterval = setInterval(() => {
        phase += 0.3;
        // Natural speech modulation rhythm with pauses
        const raw = Math.sin(phase) * 0.4 + Math.sin(phase * 2.3) * 0.3 + 0.5;
        const bounded = Math.max(0.15, Math.min(1.0, raw));
        options.onVoiceLevel?.(bounded);
      }, 50);

      // Stream words smoothly with fallback timer so subtitles always progress
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

      // Maximum safety timeout against Chrome SpeechSynthesis hangs
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
    if (this.voiceLevelInterval) {
      clearInterval(this.voiceLevelInterval);
      this.voiceLevelInterval = null;
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
