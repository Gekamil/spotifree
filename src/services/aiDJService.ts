import { create } from 'zustand';
import type { Track } from '../types/spotify';
import { useSpotifyDataStore } from '../store/useSpotifyDataStore';
import { usePlayerStore } from '../store/usePlayerStore';
import { aiDJVoiceService } from './aiDJVoiceService';
import { searchSpotify } from './spotifyApi';

export type AIDJVisualizerMode = 'idle' | 'speaking' | 'listening' | 'playing';

export interface AIDJState {
  visualizerState: AIDJVisualizerMode;
  isMicListening: boolean;
  currentMessage: string;
  displayedTranscript: string;
  voiceLevel: number;
  currentSetTitle: string;
  songsPlayedInSet: number;
  isDJModeActive: boolean;

  // Actions
  setVisualizerState: (state: AIDJVisualizerMode) => void;
  setVoiceLevel: (level: number) => void;
  setTranscript: (text: string) => void;
  startDJSession: () => Promise<void>;
  stopDJSession: () => void;
  handleUserPrompt: (promptText: string) => Promise<void>;
  startVoiceListening: () => void;
  stopVoiceListening: () => void;
  triggerManualTransition: () => Promise<void>;
}

// Preset vibes with keywords and descriptions
export const DJ_VIBE_PRESETS = [
  { id: 'reggaeton', label: '🔥 Reggaeton & Fiesta', query: 'reggaeton fiesta perreo urbano' },
  { id: 'gym', label: '🏋️ Energía Gym', query: 'gym entrenamiento motivacion drill' },
  { id: 'focus', label: '🧠 Concentración', query: 'estudiar concentracion lofi piano' },
  { id: 'chill', label: '🌙 Chill & Relax', query: 'chill relax noche acustico suave' },
  { id: 'tropical', label: '🌴 Latino & Bachata', query: 'bachata salsa latino tropical romeo' },
  { id: 'surprise', label: '⚡ Sorpréndeme', query: 'exitos variados sorpresivo top' },
];

let speechRecognitionInstance: any = null;

export const useAIDJStore = create<AIDJState>((set, get) => ({
  visualizerState: 'idle',
  isMicListening: false,
  currentMessage: '',
  displayedTranscript: '',
  voiceLevel: 0,
  currentSetTitle: 'Sesión Inicial',
  songsPlayedInSet: 0,
  isDJModeActive: false,

  setVisualizerState: (visualizerState) => set({ visualizerState }),
  setVoiceLevel: (voiceLevel) => set({ voiceLevel }),
  setTranscript: (displayedTranscript) => set({ displayedTranscript }),

  /**
   * Start or resume DJ session: greets user warmly in Spanish and sets up speech
   */
  startDJSession: async () => {
    set({
      isDJModeActive: true,
      visualizerState: 'speaking',
      songsPlayedInSet: 0,
    });

    const hour = new Date().getHours();
    const greeting =
      hour >= 6 && hour < 13
        ? '¡Buenos días!'
        : hour >= 13 && hour < 21
        ? '¡Buenas tardes!'
        : '¡Buenas noches!';

    const userName = useSpotifyDataStore.getState().user?.display_name?.split(' ')[0] || '';
    const namePhrase = userName ? `, ${userName}` : '';

    const introText = `${greeting}${namePhrase}. Soy tu DJ personal con inteligencia artificial. He estado analizando tus gustos musicales y tus canciones favoritas. ¿Qué te apetece escuchar ahora mismo?`;

    set({ currentMessage: introText, displayedTranscript: '' });

    await aiDJVoiceService.speak(introText, {
      onWord: (_word, partial) => {
        set({ displayedTranscript: partial });
      },
      onVoiceLevel: (level) => {
        set({ voiceLevel: level });
      },
      onEnd: () => {
        const currentlyPlaying = usePlayerStore.getState().isPlaying;
        set({
          visualizerState: currentlyPlaying ? 'playing' : 'idle',
          voiceLevel: 0,
        });
      },
    });
  },

  /**
   * Stop DJ voice and deactivate DJ active mode
   */
  stopDJSession: () => {
    aiDJVoiceService.stopSpeaking();
    get().stopVoiceListening();
    set({
      isDJModeActive: false,
      visualizerState: 'idle',
      voiceLevel: 0,
      isMicListening: false,
    });
  },

  /**
   * Start Speech Recognition via Web Speech API (Microphone)
   */
  startVoiceListening: () => {
    if (typeof window === 'undefined') return;

    aiDJVoiceService.stopSpeaking();
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRec) {
      const msg = 'Tu navegador no soporta entrada de voz directa. Puedes escribir o elegir una vibra.';
      set({ currentMessage: msg, displayedTranscript: msg });
      return;
    }

    try {
      if (speechRecognitionInstance) {
        try {
          speechRecognitionInstance.abort();
        } catch {}
      }

      const rec = new SpeechRec();
      speechRecognitionInstance = rec;
      rec.lang = 'es-ES';
      rec.continuous = false;
      rec.interimResults = true;

      set({
        isMicListening: true,
        visualizerState: 'listening',
        currentMessage: 'Te escucho... habla conmigo',
        displayedTranscript: '',
      });

      rec.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        set({ displayedTranscript: transcript });

        if (event.results[0].isFinal) {
          get().stopVoiceListening();
          get().handleUserPrompt(transcript);
        }
      };

      rec.onerror = (event: any) => {
        console.warn('[AIDJ] Speech recognition error:', event.error);
        get().stopVoiceListening();
      };

      rec.onend = () => {
        set({ isMicListening: false });
        if (get().visualizerState === 'listening') {
          const isPlaying = usePlayerStore.getState().isPlaying;
          set({ visualizerState: isPlaying ? 'playing' : 'idle' });
        }
      };

      rec.start();
    } catch (e) {
      console.warn('[AIDJ] Failed to start recognition:', e);
      set({ isMicListening: false, visualizerState: 'idle' });
    }
  },

  stopVoiceListening: () => {
    if (speechRecognitionInstance) {
      try {
        speechRecognitionInstance.stop();
      } catch {}
      speechRecognitionInstance = null;
    }
    set({ isMicListening: false });
  },

  /**
   * Process user request (voice, text or vibe chip), analyze library, and curate a dynamic mini-set
   */
  handleUserPrompt: async (promptText: string) => {
    if (!promptText || promptText.trim().length === 0) return;

    aiDJVoiceService.stopSpeaking();
    set({
      visualizerState: 'speaking',
      currentMessage: `Analizando tu música para "${promptText}"...`,
      displayedTranscript: '',
      voiceLevel: 0.3,
    });

    const cleanPrompt = promptText.toLowerCase().trim();

    // 1. Collect all available tracks from user playlists, cache, and liked songs
    const { playlists, playlistDetailsCache } = useSpotifyDataStore.getState();
    const allUserTracks: Track[] = [];
    const seenIds = new Set<string>();

    const addTrack = (t: Track) => {
      if (t && t.id && !seenIds.has(t.id)) {
        seenIds.add(t.id);
        allUserTracks.push(t);
      }
    };

    // From details cache
    Object.values(playlistDetailsCache).forEach((pl: any) => {
      pl?.tracks?.items?.forEach(addTrack);
    });

    // From playlists
    playlists.forEach((p) => {
      p.tracks?.items?.forEach(addTrack);
    });

    // From localStorage
    if (typeof window !== 'undefined') {
      try {
        const local = JSON.parse(window.localStorage.getItem('user_imported_playlists') || '[]');
        local.forEach((p: any) => p?.tracks?.items?.forEach(addTrack));
        const liked = JSON.parse(window.localStorage.getItem('spotifree_liked_songs') || '[]');
        liked.forEach(addTrack);
      } catch {}
    }

    // 2. Score and filter tracks according to the prompt
    const words = cleanPrompt.split(/\s+/).filter((w) => w.length > 2);
    let matchedTracks: Track[] = [];

    // Check specific genre/mood matches
    const isReggaeton = /reggaeton|perreo|fiesta|bailar|urbano|bellakeo|dembow/i.test(cleanPrompt);
    const isGym = /gym|entrenar|entrenamiento|motivaci|pesas|fuerza|duro|drill/i.test(cleanPrompt);
    const isFocus = /estudiar|concentra|trabajar|lectura|estudio|lofi|piano/i.test(cleanPrompt);
    const isChill = /chill|relax|tranquil|dormir|acustico|calma|suave|noche/i.test(cleanPrompt);
    const isBachata = /bachata|tropical|latino|salsa|romeo|aventura|merengue/i.test(cleanPrompt);

    matchedTracks = allUserTracks.filter((t) => {
      const title = (t.name || '').toLowerCase();
      const artist = (t.artists?.map((a) => a.name).join(' ') || '').toLowerCase();
      const album = (t.album?.name || '').toLowerCase();
      const full = `${title} ${artist} ${album}`;

      // Direct word match
      if (words.some((w) => full.includes(w))) return true;

      // Genre heuristics
      if (isReggaeton && /bad bunny|feid|quevedo|mora|rauw|anuel|daddy|reggaeton|perreo|columbia|luna/i.test(full)) return true;
      if (isGym && /rock|drill|phonk|rap|trap|duki|bizarrap|eminem|hype/i.test(full)) return true;
      if (isFocus && /lofi|piano|chill|instrumental|ambient|study/i.test(full)) return true;
      if (isChill && /acustico|morat|beret|camilo|sheeran|calm|suave/i.test(full)) return true;
      if (isBachata && /romeo|prince|aventura|bachata|guerra|turizo/i.test(full)) return true;

      return false;
    });

    // 3. If user has fewer than 4 matching tracks, enrich with real Spotify search tracks
    if (matchedTracks.length < 4) {
      try {
        const queryTerm = isReggaeton
          ? 'reggaeton exitos'
          : isGym
          ? 'gym workout motivation'
          : isFocus
          ? 'lofi focus study'
          : isChill
          ? 'chill relax acustico'
          : isBachata
          ? 'bachata romantica exitos'
          : cleanPrompt;

        const searchRes = await searchSpotify(queryTerm);
        const fetchedItems = searchRes?.tracks?.items || [];
        fetchedItems.forEach((ft: any) => {
          if (ft && ft.id && !seenIds.has(ft.id)) {
            seenIds.add(ft.id);
            matchedTracks.push(ft);
          }
        });
      } catch (err) {
        console.warn('[AIDJ] Spotify search fallback notice:', err);
      }
    }

    // Fallback if still empty: use all user tracks shuffled
    if (matchedTracks.length === 0) {
      matchedTracks = [...allUserTracks];
    }

    // Shuffle matched tracks to make a fresh 4-track set
    for (let i = matchedTracks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [matchedTracks[i], matchedTracks[j]] = [matchedTracks[j], matchedTracks[i]];
    }
    const finalSet = matchedTracks.slice(0, 5);

    // 4. Generate custom charismatic DJ speech intro
    const track1 = finalSet[0];
    const artist1 = track1?.artists?.[0]?.name || 'un gran artista';
    const trackName1 = track1?.name || 'este temazo';

    const track2 = finalSet[1];
    const artist2 = track2?.artists?.[0]?.name;

    let vibeLabel = 'tu música favorita';
    if (isReggaeton) vibeLabel = 'reggaeton y fiesta';
    else if (isGym) vibeLabel = 'alta energía y motivación';
    else if (isFocus) vibeLabel = 'enfoque y concentración';
    else if (isChill) vibeLabel = 'chill y relajación';
    else if (isBachata) vibeLabel = 'bachata y sabor latino';
    else if (words.length > 0) vibeLabel = `estilo ${words[0]}`;

    const speechVariants = [
      `¡Entendido! Vamos a subir la vibra con un set de ${vibeLabel}. Arrancamos con ${trackName1} de ${artist1}${artist2 ? `, y más adelante nos espera ${artist2}` : ''}. ¡Dale volumen!`,
      `Modo ${vibeLabel} activado. He preparado una selección perfecta para este momento. Empezamos fuerte con ${trackName1} de ${artist1}. ¡Disfrútalo!`,
      `¡Qué buena elección! Tengo justo lo que buscas para esa vibra de ${vibeLabel}. Arrancamos con ${trackName1}. ¡Sube el volumen y siente el ritmo!`,
    ];
    const djSpeech = speechVariants[Math.floor(Math.random() * speechVariants.length)];

    set({
      currentMessage: djSpeech,
      displayedTranscript: '',
      currentSetTitle: `Sesión: ${vibeLabel.toUpperCase()}`,
      songsPlayedInSet: 0,
    });

    // 5. Immediately queue finalSet and start playing track 1 in background (ducked under the DJ voice)
    if (track1) {
      usePlayerStore.getState().playTrack(track1, finalSet, 'dj-session');
    }

    // 6. Speak the intro with live subtitles and voice pulse
    await aiDJVoiceService.speak(djSpeech, {
      onWord: (_word, partial) => {
        set({ displayedTranscript: partial });
      },
      onVoiceLevel: (level) => {
        set({ voiceLevel: level });
      },
      onEnd: () => {
        set({
          visualizerState: 'playing',
          voiceLevel: 0,
        });
      },
    });
  },

  /**
   * Manual or automatic transition to next set with DJ commentary
   */
  triggerManualTransition: async () => {
    const currentTrack = usePlayerStore.getState().currentTrack;
    const curArtist = currentTrack?.artists?.[0]?.name || '';
    const curTitle = currentTrack?.name || '';

    aiDJVoiceService.stopSpeaking();
    set({
      visualizerState: 'speaking',
      songsPlayedInSet: 0,
    });

    const transitionPhrases = [
      `Ese fue ${curTitle}${curArtist ? ` de ${curArtist}` : ''}. Ahora vamos a cambiar de ritmo: aquí tienes una nueva vibra para seguir con la energía alta.`,
      `¡Qué temazo acabamos de escuchar! Para mantener el ambiente arriba, vamos con esta otra joya que sé que te va a encantar.`,
      `Cambiando de onda... aquí tienes otro tema imprescindible para tu sesión. ¡A disfrutarlo!`,
    ];
    const transitionText = transitionPhrases[Math.floor(Math.random() * transitionPhrases.length)];

    set({ currentMessage: transitionText, displayedTranscript: '' });

    await aiDJVoiceService.speak(transitionText, {
      onWord: (_word, partial) => {
        set({ displayedTranscript: partial });
      },
      onVoiceLevel: (lvl) => {
        set({ voiceLevel: lvl });
      },
      onEnd: () => {
        set({ visualizerState: 'playing', voiceLevel: 0 });
      },
    });

    // Skip to next track smoothly
    usePlayerStore.getState().nextTrack();
  },
}));

if (typeof window !== 'undefined') {
  (window as any).__useAIDJStore = useAIDJStore;
}
