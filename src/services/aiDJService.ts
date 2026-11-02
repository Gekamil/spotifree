import { create } from 'zustand';
import type { Track } from '../types/spotify';
import { useSpotifyDataStore } from '../store/useSpotifyDataStore';
import { usePlayerStore } from '../store/usePlayerStore';
import { aiDJVoiceService } from './aiDJVoiceService';
import { resolveTrackCoversBatch } from '../utils/trackCovers';
import {
  type MusicHashtag,
  resolveHashtagFromPrompt,
  getCuratedSetForHashtag,
  getDominantUserHashtag,
} from './musicTaggingService';

export type AIDJVisualizerMode = 'idle' | 'speaking' | 'listening' | 'playing';

export interface DJChatMessage {
  id: string;
  sender: 'dj' | 'user';
  text: string;
  timestamp: string;
  curatedSetTitle?: string;
  trackCount?: number;
}

export interface AIDJState {
  visualizerState: AIDJVisualizerMode;
  isMicListening: boolean;
  currentMessage: string;
  displayedTranscript: string;
  voiceLevel: number;
  currentSetTitle: string;
  djThemeColor: string;
  songsPlayedInSet: number;
  isDJModeActive: boolean;
  djTracks: Track[];
  currentHashtag: MusicHashtag;
  chatHistory: DJChatMessage[];
  viewMode: 'chat' | 'playlist';

  // Actions
  setViewMode: (mode: 'chat' | 'playlist') => void;
  setVisualizerState: (state: AIDJVisualizerMode) => void;
  setVoiceLevel: (level: number) => void;
  setTranscript: (text: string) => void;
  setDJThemeColor: (color: string) => void;
  setDJTracks: (tracks: Track[]) => void;
  startDJSession: (forceReset?: boolean) => Promise<void>;
  stopDJSession: () => void;
  handleUserPrompt: (promptText: string) => Promise<void>;
  handleSetCompletion: () => Promise<void>;
  startVoiceListening: () => void;
  stopVoiceListening: () => void;
  triggerManualTransition: () => Promise<void>;
}

// Preset vibes for clean Spotify chips (NO EMOJIS, pure Spotify aesthetic)
export const DJ_VIBE_PRESETS = [
  { id: 'descubrimiento', label: 'Descubrimiento', query: 'descubrimiento novedades recomendaciones' },
  { id: 'pop', label: 'Pop actual', query: 'pop exitos pop en espanol' },
  { id: 'urbano', label: 'Urbano latino', query: 'reggaeton trap urbano latino para bailar' },
  { id: 'entreno', label: 'Para entrenar', query: 'gym motivacion entrenamiento a tope' },
  { id: 'enfoque', label: 'Concentración', query: 'lofi instrumental para concentrarme y estudiar' },
  { id: 'chill', label: 'Chill out', query: 'novo amor cigarettes after sex indie folk acustico calma' },
  { id: 'clasicos', label: 'Clásicos', query: 'clasicos canciones de siempre exitos de siempre' },
];

let speechRecognitionInstance: any = null;

interface IntentAnalysis {
  speech: string;
  query: string;
  vibeTitle: string;
  vibeColor: string;
  excludeTitles?: string[];
}

function analyzeUserIntent(prompt: string, userName: string): IntentAnalysis {
  const p = prompt.toLowerCase().trim();
  const namePhrase = userName ? `, ${userName}` : '';

  // 1. Sad / Bad Day / Need to cry / Heartbreak / Emotional
  if (/mal d[ií]a|triste|baj[oó]n|llorar|depre|desanimo|desamor|pena|despecho|tristeza|solo|sola|duro|agobiad/i.test(p)) {
    return {
      speech: `Sé que has tenido un día difícil${namePhrase}. Te preparé algo tranquilo para bajar revoluciones y desconectar.`,
      query: 'morat beret pablo alboran baladas acustico guitarra suave',
      vibeTitle: 'Sesión: Calma y Desconexión',
      vibeColor: '#3d4852',
    };
  }

  // 2. Gym / Workout / High Energy / Motivation / Training
  if (/gym|entrenar|entrenamiento|pesas|fuerza|duro|drill|a tope|correr|cardio|crossfit|mancuerna|hype|motiva|romperla/i.test(p)) {
    return {
      speech: `¡A romperla en el entreno${namePhrase}! Te dejo este set con pura energía pesada. ¡Dale con todo!`,
      query: 'duki eladio carrion travis scott drill phonk motivacion',
      vibeTitle: 'Sesión: Máxima Adrenalina Gym',
      vibeColor: '#e65100',
      excludeTitles: ['gym', 'workout', 'fitness'],
    };
  }

  // 3. Party / Reggaeton / Dancing / Weekend / Club
  if (/fiesta|perreo|bailar|discoteca|farra|desmadre|viernes|s[aá]bado|marcha|reggaeton|perrear|bellakeo|dembow|rumba/i.test(p)) {
    return {
      speech: `¡Modo fiesta activado! Arrancamos con este perreo para que no pares de moverte. Súbele.`,
      query: 'bad bunny feid quevedo mora rauw alejandro reggaeton exitos',
      vibeTitle: 'Sesión: Perreo y Fiesta',
      vibeColor: '#d32f2f',
      excludeTitles: ['reggaeton', 'perreo', 'fiesta'],
    };
  }

  // 3b. Bachata / Latino Romántico
  if (/bachata|romeo|prince royce|aventura|salsa|merengue/i.test(p)) {
    return {
      speech: `¡Pura bachata y sentimiento${namePhrase}! Aquí tienes los himnos de Romeo Santos, Prince Royce y más.`,
      query: 'romeo santos prince royce aventura juan luis guerra bachata exitos',
      vibeTitle: 'Sesión: Bachata y Sentimiento',
      vibeColor: '#7b1fa2',
      excludeTitles: ['bachata'],
    };
  }

  // 3c. Trap / Urbano / Drill
  if (/trap|drill|urbano|calle|duki|eladio|milo j|trueno|c\.r\.o|ysy a/i.test(p)) {
    return {
      speech: `Directo a la vibra pesada${namePhrase}. Puras barras y los ritmos urbanos más duros del momento.`,
      query: 'duki trueno milo j bizarrap eladio carrion trap exitos',
      vibeTitle: 'Sesión: Trap y Urbano',
      vibeColor: '#ff5722',
      excludeTitles: ['trap'],
    };
  }

  // 3d. Electrónica / House / Dance
  if (/electro|electronic|techno|house|edm|rave|dance|dj set/i.test(p)) {
    return {
      speech: `¡Subiendo los BPMs! Te preparé una sesión electrónica limpia para mantener la energía al tope.`,
      query: 'calvin harris david guetta tiesto avicii edm dance hits',
      vibeTitle: 'Sesión: Club Electrónica',
      vibeColor: '#00acc1',
      excludeTitles: ['electro', 'electronic', 'house'],
    };
  }

  // 3e. Rock / Indie / Clásicos del Rock
  if (/rock|guitarra|indie|queen|nirvana|coldplay|estopa|melendi/i.test(p)) {
    return {
      speech: `¡Suban esas guitarras! Clásicos y temazos de rock que se cantan a pleno pulmón.`,
      query: 'queen coldplay estopa melendi fito fitipaldis rock exitos',
      vibeTitle: 'Sesión: Clásicos del Rock',
      vibeColor: '#c2185b',
      excludeTitles: ['rock', 'rock n roll'],
    };
  }

  // 4. Study / Focus / Deep Work / Reading / Coding
  if (/estudiar|concentra|trabajar|lectura|estudio|lofi|piano|trabajo|examen|tarea|oficina|programar|enfoque/i.test(p)) {
    return {
      speech: `Momento de enfoque${namePhrase}. Aquí tienes ritmos limpios para concentrarte y rendir al cien.`,
      query: 'lofi study beats chill instrumental piano calm',
      vibeTitle: 'Sesión: Enfoque Profundo',
      vibeColor: '#1976d2',
    };
  }

  // 5. Chill / Lo-Fi / Relaxed Rhythm
  if (/chill|relax|tranquil|calma|suave|paz|sof[aá]|desconectar|descanso|desestres|lofi|lo-fi/i.test(p)) {
    return {
      speech: `Relájate${namePhrase}. Te preparé una sesión lo-fi con ritmos suaves y tranquilos para desconectar del mundo.`,
      query: 'lofi hip hop beats chill study instrumental',
      vibeTitle: 'Sesión: Lo-Fi Chill Beats',
      vibeColor: '#00897b',
      excludeTitles: ['chill', 'relax', 'chill out', 'reggaeton', 'techno'],
    };
  }

  // 6. Sleep / Night / Bedtime
  if (/dormir|noche|cama|sue[nñ]o|descansar|acostarse/i.test(p)) {
    return {
      speech: `Buenas noches. Te dejo esta selección íntima y calmada para que descanses como toca.`,
      query: 'sleep ambient lofi night piano calm ludovico einaudi',
      vibeTitle: 'Sesión: Calma Nocturna',
      vibeColor: '#283593',
    };
  }

  // 7. Road trip / Driving / Car
  if (/coche|viaje|conducir|carretera|viajar|ruta|auto/i.test(p)) {
    return {
      speech: `¡Música para la carretera! Sube el volumen y disfruta del camino con estos temazos.`,
      query: 'avicii coldplay dua lipa the weeknd road trip hits',
      vibeTitle: 'Sesión: Carretera y Viento',
      vibeColor: '#f57c00',
    };
  }

  // 8. Nostalgia / Decades (2000s, 90s, 80s, classic)
  if (/2000|noventa|ochenta|80|90|clasic|retro|nostalg|recuerdo|antigu|viej/i.test(p)) {
    const era = /80/i.test(p) ? 'los ochenta' : /90/i.test(p) ? 'los noventa' : 'los dos mil';
    return {
      speech: `¡Viajazo a ${era}! Esos himnos que nunca pasan de moda. A cantar a pleno pulmón.`,
      query: `exitos clasicos ${era} pop rock hits radio`,
      vibeTitle: `Sesión: Clásicos de ${era.toUpperCase()}`,
      vibeColor: '#3949ab',
    };
  }

  // 9. Specific Artist Detection
  const knownArtists = [
    'quevedo', 'bad bunny', 'feid', 'romeo santos', 'prince royce', 'duki', 'rauw alejandro',
    'paulo londra', 'rosalia', 'rosalía', 'morat', 'bizarrap', 'mora', 'anuel', 'daddy yankee', 'don omar',
    'queen', 'nirvana', 'michael jackson', 'coldplay', 'eminem', 'travis scott', 'drake',
    'taylor swift', 'shakira', 'maluma', 'j balvin', 'myke towers', 'eladio carrion',
    'milo j', 'trueno', 'nicki nicole', 'emilia', 'tini', 'c tangana', 'c. tangana',
    'melendi', 'estopa', 'alvaro diaz', 'álvaro díaz', 'rory', 'de la rose',
    'saiko', 'lia kali', 'cris mj', 'floyy menor', 'jc reyes', 'aventura', 'aitana', 'jhayco'
  ];

  let detectedArtist: string | null = null;
  for (const art of knownArtists) {
    if (p.includes(art)) {
      detectedArtist = art.charAt(0).toUpperCase() + art.slice(1);
      break;
    }
  }

  // Regex artist extraction if user says e.g. "ponme canciones de X" or "algo de X"
  if (!detectedArtist) {
    const match = p.match(/(?:ponme|algo de|canciones de|musica de|escuchar a|parecido a|tipo)\s+([a-zA-Z0-9\s]+)/i);
    if (match && match[1] && match[1].trim().length > 2 && match[1].trim().length < 30) {
      detectedArtist = match[1].trim();
    }
  }

  if (detectedArtist) {
    return {
      speech: `¡Qué temazos tiene ${detectedArtist}! Te armé una selección con sus mejores temas. Dale play.`,
      query: `${detectedArtist} exitos populares`,
      vibeTitle: `Sesión: ${detectedArtist.toUpperCase()}`,
      vibeColor: '#0c52cc',
    };
  }

  // 10. General / Surprise / Catch-all
  return {
    speech: `Cambiando de onda${namePhrase}. Aquí tienes una mezcla fresca pensada para ti. A disfrutarla.`,
    query: `${p} exitos canciones`,
    vibeTitle: `Sesión: ${prompt.slice(0, 20)}`,
    vibeColor: '#0050d0',
  };
}

export const useAIDJStore = create<AIDJState>((set, get) => ({
  visualizerState: 'idle',
  isMicListening: false,
  currentMessage: '',
  displayedTranscript: '',
  voiceLevel: 0,
  currentSetTitle: 'Sesión Inicial',
  djThemeColor: '#0c52cc',
  songsPlayedInSet: 0,
  isDJModeActive: false,
  djTracks: [],
  currentHashtag: '#reggaeton',
  chatHistory: [],
  viewMode: 'chat',

  setViewMode: (viewMode) => set({ viewMode }),
  setVisualizerState: (visualizerState) => set({ visualizerState }),
  setVoiceLevel: (voiceLevel) => set({ voiceLevel }),
  setTranscript: (displayedTranscript) => set({ displayedTranscript }),
  setDJThemeColor: (djThemeColor) => set({ djThemeColor }),
  setDJTracks: (djTracks) => set({ djTracks }),

  /**
   * Start DJ session: gathers tracks, plays set with ducking, and greets user warmly.
   * If already active and tracks exist, does not wipe or reset current session unless forceReset=true.
   */
  startDJSession: async (forceReset = false) => {
    const currentState = get();
    if (!forceReset && currentState.isDJModeActive && currentState.djTracks.length > 0) {
      // Session already active! Keep current track and playlist intact!
      return;
    }

    const dominantTag = getDominantUserHashtag();

    set({
      isDJModeActive: true,
      visualizerState: 'speaking',
      songsPlayedInSet: 0,
      currentHashtag: dominantTag,
    });

    // 1. Curate initial set using dynamic hashtag analysis of user playlists + related tracks
    const initialSet = await getCuratedSetForHashtag(dominantTag, 15);
    set({ djTracks: initialSet });

    // 2. Play track 1 immediately through global player in background with ducked volume
    if (initialSet.length > 0) {
      usePlayerStore.getState().playTrack(initialSet[0], initialSet, 'dj-session');
    }

    const hour = new Date().getHours();
    const greeting =
      hour >= 6 && hour < 13
        ? '¡Buenos días'
        : hour >= 13 && hour < 21
        ? '¡Qué onda'
        : '¡Buenas noches';

    const rawName = useSpotifyDataStore.getState().user?.display_name || '';
    const cleanName = rawName ? rawName.split(' ')[0] : '';
    const namePart = cleanName ? `, ${cleanName}` : '';

    const introText = `${greeting}${namePart}! Aquí tu DJ. Estuve viendo lo que escuchas y te armé una mezcla con tus temas favoritos. ¿Qué te apetece escuchar ahora?`;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    set({
      currentMessage: introText,
      displayedTranscript: '',
      chatHistory: [
        {
          id: 'msg-initial',
          sender: 'dj',
          text: introText,
          timestamp: timeStr,
          curatedSetTitle: 'Tu Mezcla Inicial',
          trackCount: initialSet.length,
        },
      ],
    });

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
   * Stop DJ voice and speech listening
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
      const msg = 'Tu navegador no soporta micrófono directo. Puedes escribir tu petición aquí abajo.';
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
   * Deep conversational semantic intent understanding & dynamic set curation
   */
  handleUserPrompt: async (promptText: string) => {
    if (!promptText || promptText.trim().length === 0) return;

    aiDJVoiceService.stopSpeaking();

    const userTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg: DJChatMessage = {
      id: `msg-user-${Date.now()}`,
      sender: 'user',
      text: promptText,
      timestamp: userTime,
    };

    set((state) => ({
      chatHistory: [...state.chatHistory, userMsg],
      visualizerState: 'speaking',
      currentMessage: `Entendido... preparando música para "${promptText}"`,
      displayedTranscript: '',
      voiceLevel: 0.3,
    }));

    const rawName = useSpotifyDataStore.getState().user?.display_name || '';
    const cleanName = rawName ? rawName.split(' ')[0] : '';
    const analysis = analyzeUserIntent(promptText, cleanName);

    // 1. Collect all available tracks from user playlists, details cache, and localStorage
    const { playlists, playlistDetailsCache } = useSpotifyDataStore.getState();
    const allUserTracks: Track[] = [];
    const seenIds = new Set<string>();

    const addTrack = (t: Track) => {
      if (t && t.id && !seenIds.has(t.id)) {
        seenIds.add(t.id);
        const art =
          t.album?.images?.[0]?.url ||
          (t as any).image ||
          (t as any).album_cover_url ||
          'https://misc.scdn.co/liked-songs/liked-songs-640.jpg';
        const normalized: Track = (!t.album || !t.album.images || t.album.images.length === 0)
          ? {
              ...t,
              album: {
                id: t.album?.id || `alb-${t.id}`,
                name: t.album?.name || t.name,
                images: [{ url: art }],
              },
            }
          : t;
        allUserTracks.push(normalized);
      }
    };

    Object.values(playlistDetailsCache).forEach((pl: any) => {
      pl?.tracks?.items?.forEach(addTrack);
    });

    playlists.forEach((p) => {
      p.tracks?.items?.forEach(addTrack);
    });

    if (typeof window !== 'undefined') {
      try {
        const local = JSON.parse(window.localStorage.getItem('user_imported_playlists') || '[]');
        local.forEach((p: any) => p?.tracks?.items?.forEach(addTrack));
        const liked = JSON.parse(window.localStorage.getItem('spotifree_liked_songs') || '[]');
        liked.forEach(addTrack);
      } catch {}
    }

    // 2. Resolve hashtag and curate cohesive 15-track playlist set instantaneously
    const targetTag = resolveHashtagFromPrompt(promptText);
    set({ currentHashtag: targetTag });

    const hashtagSet = await getCuratedSetForHashtag(targetTag, 15);
    const finalSet = hashtagSet.length >= 8 ? hashtagSet : (allUserTracks.length > 0 ? allUserTracks.slice(0, 15) : hashtagSet);

    // Pre-resolve artwork for all tracks in parallel
    resolveTrackCoversBatch(finalSet).catch(() => {});

    // Pre-warm audio streams for top tracks so playback is instantaneous
    if (typeof window !== 'undefined' && (window as any).__audioEngine) {
      try {
        (window as any).__audioEngine.warmupInitialTracks(finalSet.slice(0, 6));
      } catch {}
    }

    const djTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const djMsg: DJChatMessage = {
      id: `msg-dj-${Date.now()}`,
      sender: 'dj',
      text: analysis.speech,
      timestamp: djTime,
      curatedSetTitle: analysis.vibeTitle,
      trackCount: finalSet.length,
    };

    set((state) => ({
      currentMessage: analysis.speech,
      displayedTranscript: '',
      currentSetTitle: analysis.vibeTitle,
      djThemeColor: analysis.vibeColor || state.djThemeColor,
      songsPlayedInSet: 0,
      djTracks: finalSet,
      chatHistory: [...state.chatHistory, djMsg],
    }));

    // 4. Play track 1 immediately in background with ducked volume
    const track1 = finalSet[0];
    if (track1) {
      usePlayerStore.getState().playTrack(track1, finalSet, 'dj-session');
    }

    // 5. Speak the personalized charismatic DJ intro
    await aiDJVoiceService.speak(analysis.speech, {
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
   * Called when the 15-track DJ set finishes or reaches the end of queue.
   * Speaks to the user: "¿Qué tal si mantenemos este rollo? Te he preparado 15 temazos más..."
   * Analyzes user playlists and related songs by hashtag, queues 15 new songs, and plays them smoothly.
   */
  handleSetCompletion: async () => {
    const state = get();
    const currentTag = state.currentHashtag || getDominantUserHashtag();
    const previousIds = new Set(state.djTracks.map((t) => t.id));

    aiDJVoiceService.stopSpeaking();
    set({
      visualizerState: 'speaking',
      songsPlayedInSet: 0,
    });

    const nextSet = await getCuratedSetForHashtag(currentTag, 15, previousIds);
    set({ djTracks: nextSet });

    // Pre-resolve artwork in parallel
    resolveTrackCoversBatch(nextSet).catch(() => {});

    // Pre-warm audio streams
    if (typeof window !== 'undefined' && (window as any).__audioEngine) {
      try {
        (window as any).__audioEngine.warmupInitialTracks(nextSet.slice(0, 6));
      } catch {}
    }

    // Play first track of new set in background with ducked volume
    if (nextSet.length > 0) {
      usePlayerStore.getState().playTrack(nextSet[0], nextSet, 'dj-session');
    }

    const completionPhrases = [
      '¿Qué te parece si mantenemos este rollo? He analizado tus playlists y te preparé 15 temazos más que te van a flipar.',
      '¡Vaya sesión que llevamos! Mantenemos esta misma vibra con otras 15 canciones seleccionadas para ti. ¡A disfrutarlas!',
      'Para que la música no pare, seguimos en esta misma onda con 15 canciones de tus listas y novedades.',
    ];
    const speech = completionPhrases[Math.floor(Math.random() * completionPhrases.length)];

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    set((s) => ({
      currentMessage: speech,
      displayedTranscript: '',
      chatHistory: [
        ...s.chatHistory,
        {
          id: `msg-completion-${Date.now()}`,
          sender: 'dj',
          text: speech,
          timestamp: timeStr,
          curatedSetTitle: s.currentSetTitle || 'Sesión en curso',
          trackCount: nextSet.length,
        },
      ],
    }));

    await aiDJVoiceService.speak(speech, {
      onWord: (_word, partial) => {
        set({ displayedTranscript: partial });
      },
      onVoiceLevel: (level) => {
        set({ voiceLevel: level });
      },
      onEnd: () => {
        set({ visualizerState: 'playing', voiceLevel: 0 });
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
      `Ese fue ${curTitle}${curArtist ? ` de ${curArtist}` : ''}. Cambiemos de rollo con esto otro. ¡Súbele!`,
      `¡Qué temazo acabamos de escuchar! Para mantener el ambiente arriba, vamos con esto.`,
      `Cambiando de onda... aquí tienes otro tema que te va a encantar. ¡Dale play!`,
    ];
    const transitionText = transitionPhrases[Math.floor(Math.random() * transitionPhrases.length)];

    set({ currentMessage: transitionText, displayedTranscript: '' });

    // Begin background transition to the next track at ducked volume while the DJ introduces it
    usePlayerStore.getState().nextTrack();

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
  },
}));

if (typeof window !== 'undefined') {
  (window as any).__useAIDJStore = useAIDJStore;
}
