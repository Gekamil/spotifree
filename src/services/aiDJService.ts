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

// Preset vibes for quick clean chips
export const DJ_VIBE_PRESETS = [
  { id: 'fiesta', label: '🔥 Fiesta & Perreo', query: 'fiesta perreo reggaeton para bailar' },
  { id: 'gym', label: '🏋️ Energía Gym', query: 'gym motivacion a tope para entrenar duro' },
  { id: 'focus', label: '🧠 Concentración', query: 'lofi instrumental para concentrarme y estudiar' },
  { id: 'chill', label: '🌙 Chill & Relax', query: 'chill relax tranquilo para desconectar' },
  { id: 'surprise', label: '⚡ Sorpréndeme', query: 'sorprendeme con algo bueno que no espere' },
];

let speechRecognitionInstance: any = null;

interface IntentAnalysis {
  speech: string;
  query: string;
  vibeTitle: string;
}

function analyzeUserIntent(prompt: string, userName: string): IntentAnalysis {
  const p = prompt.toLowerCase().trim();
  const namePhrase = userName ? `, ${userName}` : '';

  // 1. Sad / Bad Day / Need to cry / Heartbreak / Emotional
  if (/mal d[ií]a|triste|baj[oó]n|llorar|depre|desanimo|desamor|pena|despecho|tristeza|solo|sola|duro|agobiad/i.test(p)) {
    return {
      speech: `Vaya${namePhrase}... sé de sobra lo que es tener uno de esos días pesados en los que todo se hace cuesta arriba. La música siempre ayuda a soltar tensiones y sanar. He preparado una selección acústica y reconfortante para desconectar del mundo. Respira hondo, ponte cómodo... y déjate llevar.`,
      query: 'baladas acustico chill triste guitarra piano',
      vibeTitle: 'Sesión: Calma y Desconexión',
    };
  }

  // 2. Gym / Workout / High Energy / Motivation / Training
  if (/gym|entrenar|entrenamiento|pesas|fuerza|duro|drill|a tope|correr|cardio|crossfit|mancuerna|hype|motiva|romperla/i.test(p)) {
    return {
      speech: `¡Esa es la energía que me gusta${namePhrase}! Hoy no se viene a especular, hoy se viene a dar el cien por cien. Te he armado un set con ritmos pesados y agresivos que te van a inyectar adrenalina pura en cada repetición. ¡A reventarlo con todo!`,
      query: 'gym workout phonk trap drill motivacion pesas',
      vibeTitle: 'Sesión: Máxima Adrenalina Gym',
    };
  }

  // 3. Party / Reggaeton / Dancing / Weekend / Club
  if (/fiesta|perreo|bailar|discoteca|farra|desmadre|viernes|s[aá]bado|marcha|reggaeton|perrear|bellakeo|dembow|rumba/i.test(p)) {
    return {
      speech: `¡Modo fiesta encendido${namePhrase}! Si hay ganas de bailar, aquí no nos vamos a guardar nada. Arrancamos con puro fuego de discoteca para que no pares de moverte ni un segundo. ¡Dale caña a esos altavoces!`,
      query: 'reggaeton exitos perreo 2024 fiesta',
      vibeTitle: 'Sesión: Perreo y Fiesta',
    };
  }

  // 4. Study / Focus / Deep Work / Reading / Coding
  if (/estudiar|concentra|trabajar|lectura|estudio|lofi|piano|trabajo|examen|tarea|oficina|programar|enfoque/i.test(p)) {
    return {
      speech: `Entendido${namePhrase}, modo concentración activado. Fuera distracciones y ruidos del mundo: te he preparado melodías limpias y envolventes que te van a mantener en la zona para que rindas al máximo. ¡A por ello!`,
      query: 'lofi hip hop study beats chill instrumental piano',
      vibeTitle: 'Sesión: Enfoque Profundo',
    };
  }

  // 5. Chill / Relax / Unwind / Peaceful
  if (/chill|relax|tranquil|calma|suave|paz|sof[aá]|desconectar|descanso|desestres/i.test(p)) {
    return {
      speech: `Totalmente de acuerdo${namePhrase}. A veces lo único que necesitamos es bajar revoluciones. He preparado un ambiente suave y envolvente, ideal para desconectar la mente y disfrutar del momento. Relájate...`,
      query: 'chill relax acustico suave indie pop',
      vibeTitle: 'Sesión: Relax Acústico',
    };
  }

  // 6. Sleep / Night / Bedtime
  if (/dormir|noche|cama|sue[nñ]o|descansar|acostarse/i.test(p)) {
    return {
      speech: `Apaga las luces y cierra los ojos. Te dejo una selección íntima y pausada para acompañar la noche y que descanses como te mereces. Que tengas muy buenas noches...`,
      query: 'sleep ambient lofi night piano calm',
      vibeTitle: 'Sesión: Calma Nocturna',
    };
  }

  // 7. Road trip / Driving / Car
  if (/coche|viaje|conducir|carretera|viajar|ruta|auto/i.test(p)) {
    return {
      speech: `¡El viaje perfecto necesita una banda sonora a la altura! He preparado una mezcla de himnos y temazos irresistibles para cantar en el camino con las ventanillas bajadas. ¡Buen viaje!`,
      query: 'road trip hits pop rock clasicos viaje coche',
      vibeTitle: 'Sesión: Carretera y Viento',
    };
  }

  // 8. Nostalgia / Decades (2000s, 90s, 80s, classic)
  if (/2000|noventa|ochenta|80|90|clasic|retro|nostalg|recuerdo|antigu|viej/i.test(p)) {
    const era = /80/i.test(p) ? 'los ochenta' : /90/i.test(p) ? 'los noventa' : 'los dos mil';
    return {
      speech: `¡Uff, viajazo en el tiempo directo a ${era}! Esos himnos que marcaron época nunca pasan de moda. Prepárate para cantar de principio a fin...`,
      query: `exitos clasicos ${era} pop rock hits`,
      vibeTitle: `Sesión: Clásicos de ${era.toUpperCase()}`,
    };
  }

  // 9. Specific Artist Detection
  const knownArtists = [
    'quevedo', 'bad bunny', 'feid', 'romeo santos', 'prince royce', 'duki', 'rauw alejandro',
    'rosalia', 'rosalía', 'morat', 'bizarrap', 'mora', 'anuel', 'daddy yankee', 'don omar',
    'queen', 'nirvana', 'michael jackson', 'coldplay', 'eminem', 'travis scott', 'drake',
    'taylor swift', 'shakira', 'maluma', 'j balvin', 'myke towers', 'eladio carrion',
    'milo j', 'trueno', 'nicki nicole', 'emilia', 'tini', 'c tangana', 'c. tangana',
    'melendi', 'estopa', 'alvaro diaz', 'álvaro díaz', 'rory', 'de la rose'
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
      speech: `¡Qué temazos tiene ${detectedArtist}! Tienen ese rollo inconfundible que siempre pega fuerte. Te he preparado sus mejores temas combinados con otras canciones de esa misma esencia que te van a encantar. ¡Dale volumen!`,
      query: `${detectedArtist} exitos`,
      vibeTitle: `Sesión: ${detectedArtist.toUpperCase()}`,
    };
  }

  // 10. General / Surprise / Catch-all
  return {
    speech: `¡Me parece un planazo! He analizado lo que me has dicho y he preparado una selección perfecta que encaja justo con lo que buscas. Arrancamos con este temazo... ¡A disfrutarlo!`,
    query: `${p} exitos`,
    vibeTitle: `Sesión: ${prompt.toUpperCase().slice(0, 30)}`,
  };
}

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
   * Start DJ session: greets user warmly with natural Spanish radio-DJ cadence
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
        ? '¡Buenos días'
        : hour >= 13 && hour < 21
        ? '¡Qué pasa'
        : '¡Buenas noches';

    const rawName = useSpotifyDataStore.getState().user?.display_name || '';
    const cleanName = rawName ? rawName.split(' ')[0] : '';
    const namePart = cleanName ? `, ${cleanName}` : '';

    const introText = `${greeting}${namePart}! Aquí tu DJ. He estado mirando lo que has estado escuchando últimamente y tengo buena música preparada. Cuéntame... ¿qué vibra te apetece escuchar hoy?`;

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
    set({
      visualizerState: 'speaking',
      currentMessage: `Entendido... preparando música para "${promptText}"`,
      displayedTranscript: '',
      voiceLevel: 0.3,
    });

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
        allUserTracks.push(t);
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

    // 2. Score tracks against the user intent
    const intentWords = analysis.query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
    let matchedTracks = allUserTracks.filter((t) => {
      const title = (t.name || '').toLowerCase();
      const artist = (t.artists?.map((a) => a.name).join(' ') || '').toLowerCase();
      const album = (t.album?.name || '').toLowerCase();
      const full = `${title} ${artist} ${album}`;
      return intentWords.some((w) => full.includes(w));
    });

    // 3. Enrich with authentic Spotify search results
    if (matchedTracks.length < 5) {
      try {
        const searchRes = await searchSpotify(analysis.query);
        const fetchedItems = searchRes?.tracks?.items || [];
        fetchedItems.forEach((ft: any) => {
          if (ft && ft.id && !seenIds.has(ft.id)) {
            seenIds.add(ft.id);
            matchedTracks.push(ft);
          }
        });
      } catch (err) {
        console.warn('[AIDJ] Spotify search enrichment notice:', err);
      }
    }

    // Fallback if still empty
    if (matchedTracks.length === 0) {
      matchedTracks = [...allUserTracks];
    }

    // Shuffle matched tracks to make a fresh 5-track mini-set
    for (let i = matchedTracks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [matchedTracks[i], matchedTracks[j]] = [matchedTracks[j], matchedTracks[i]];
    }
    const finalSet = matchedTracks.slice(0, 5);

    set({
      currentMessage: analysis.speech,
      displayedTranscript: '',
      currentSetTitle: analysis.vibeTitle,
      songsPlayedInSet: 0,
    });

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

    usePlayerStore.getState().nextTrack();
  },
}));

if (typeof window !== 'undefined') {
  (window as any).__useAIDJStore = useAIDJStore;
}
