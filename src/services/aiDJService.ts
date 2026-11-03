import { create } from 'zustand';
import type { Track } from '../types/spotify';
import { useSpotifyDataStore } from '../store/useSpotifyDataStore';
import { usePlayerStore } from '../store/usePlayerStore';
import { aiDJVoiceService } from './aiDJVoiceService';
import { useLanguageStore } from '../utils/i18n';
import { resolveTrackCoversBatch } from '../utils/trackCovers';
import {
  type MusicHashtag,
  resolveHashtagFromPrompt,
  getCuratedSetForHashtag,
  getDominantUserHashtag,
  getInitialDJLibraryRemix,
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

const lastUsedSpeechMap = new Map<string, string>();

function pickDynamicSpeech(categoryKey: string, options: string[]): string {
  const lastUsed = lastUsedSpeechMap.get(categoryKey);
  const candidates = options.length > 1 ? options.filter((s) => s !== lastUsed) : options;
  const picked = candidates[Math.floor(Math.random() * candidates.length)] || options[0];
  lastUsedSpeechMap.set(categoryKey, picked);
  return picked;
}

function analyzeUserIntent(prompt: string, userName: string): IntentAnalysis {
  const p = prompt.toLowerCase().trim();
  const namePhrase = userName ? `, ${userName}` : '';
  const isEn = useLanguageStore.getState().language === 'en';

  // 1. Sad / Bad Day / Need to cry / Heartbreak / Emotional
  if (/mal d[ií]a|triste|baj[oó]n|llorar|depre|desanimo|desamor|pena|despecho|tristeza|solo|sola|duro|agobiad/i.test(p)) {
    const speech = isEn
      ? pickDynamicSpeech('sad', [
          `I know it has been a tough day${namePhrase}. I put together something gentle to help you unwind and let go.`,
          `Taking a breather${namePhrase}. Here are some quiet, soothing acoustic melodies for your space.`,
          `Sending good energy your way. Lean back and let these warm harmonies comfort you.`,
        ])
      : pickDynamicSpeech('sad', [
          `Sé que has tenido un día difícil${namePhrase}. Te preparé algo tranquilo para bajar revoluciones y desconectar.`,
          `Momento de desahogarse${namePhrase}. Aquí tienes melodías acústicas y suaves para que respires hondo.`,
          `Mucho ánimo. Ponte cómodo y deja que estas canciones te acompañen en calma.`,
        ]);
    return {
      speech,
      query: 'morat beret pablo alboran baladas acustico guitarra suave',
      vibeTitle: isEn ? 'Session: Calm & Reset' : 'Sesión: Calma y Desconexión',
      vibeColor: '#3d4852',
    };
  }

  // 2. Gym / Workout / High Energy / Motivation / Training / "Más movido"
  if (/m[aá]s movido|gym|entrenar|entrenamiento|pesas|fuerza|duro|drill|a tope|correr|cardio|crossfit|mancuerna|hype|motiva|romperla/i.test(p)) {
    const speech = isEn
      ? pickDynamicSpeech('gym', [
          `Maximum energy incoming${namePhrase}! Here's a high-octane set to keep you hyped and pushing limits.`,
          `Turning up the tempo! Heavy bass, unstoppable momentum, and pure adrenaline.`,
          `No holding back now! Crank the volume and power through with these bangers.`,
        ])
      : pickDynamicSpeech('gym', [
          `¡A romperla en el entreno${namePhrase}! Te dejo este set con pura energía pesada. ¡Dale con todo!`,
          `¡Subiendo los decibelios! Ritmos rápidos y mucha adrenalina para no parar.`,
          `¡Aquí no hay descansos! Dale caña con esta dosis de pura potencia.`,
        ]);
    return {
      speech,
      query: 'duki eladio carrion travis scott drill phonk motivacion',
      vibeTitle: isEn ? 'Session: Maximum Adrenaline' : 'Sesión: Máxima Adrenalina',
      vibeColor: '#e65100',
      excludeTitles: ['gym', 'workout', 'fitness'],
    };
  }

  // 3. Party / Reggaeton / Dancing / Weekend / Club / "Reggaetón"
  if (/reggaet[oó]n|fiesta|perreo|bailar|discoteca|farra|desmadre|viernes|s[aá]bado|marcha|perrear|bellakeo|dembow|rumba/i.test(p)) {
    const speech = isEn
      ? pickDynamicSpeech('reggaeton', [
          `Party mode activated! Let's turn up the heat with these infectious reggaeton bangers.`,
          `Pumping up the energy${namePhrase}! Get ready to move with the hottest urban beats right now.`,
          `Turn that volume up! Pure rhythm and high-energy fiesta anthems coming right at you.`,
        ])
      : pickDynamicSpeech('reggaeton', [
          `¡Modo fiesta activado! Arrancamos con este perreo para que no pares de moverte. Súbele.`,
          `¡Subiendo la temperatura en cabina! Puro ritmo latino y reggaetón del bueno para bailar.`,
          `¡A romper la pista${namePhrase}! Te armé un set bien pegado con los mejores himnos urbanos.`,
          `¡Sube ese volumen! Aquí llega la mejor energía de fiesta directa a tus auriculares.`,
        ]);
    return {
      speech,
      query: 'bad bunny feid quevedo mora rauw alejandro reggaeton exitos',
      vibeTitle: isEn ? 'Session: Party & Perreo' : 'Sesión: Perreo y Fiesta',
      vibeColor: '#d32f2f',
      excludeTitles: ['reggaeton', 'perreo', 'fiesta'],
    };
  }

  // 3b. Salsa / Merengue (before bachata since it overlaps)
  if (/\bsalsa\b|merengue|celia cruz|marc anthony|salsa brava|salsa romantica/i.test(p)) {
    const speech = isEn
      ? pickDynamicSpeech('salsa', [
          `Turning up the tropical heat${namePhrase}! Pure salsa and merengue bangers coming right at you.`,
          `Dancing shoes on! Here are the hottest salsa anthems to move your feet.`,
        ])
      : pickDynamicSpeech('salsa', [
          `¡A mover los pies${namePhrase}! Te preparé un set de pura salsa y merengue que no te va a dejar quieto.`,
          `¡Que viva el trópico! Aquí tienes los himnos de salsa más pegados para bailar sin parar.`,
          `Sabor latino en cabina. Ritmos caribeños de primera para encender la pista.`,
        ]);
    return {
      speech,
      query: 'marc anthony celia cruz daddy yankee don omar salsa merengue exitos',
      vibeTitle: isEn ? 'Session: Salsa & Merengue' : 'Sesión: Salsa y Merengue',
      vibeColor: '#e65100',
      excludeTitles: ['salsa', 'merengue'],
    };
  }

  // 3c. Música en inglés / English music
  if (/ingl[eé]s|english|en ingl[eé]s|music[a]?\s+en\s+ingl[eé]s|songs?\s+in\s+english/i.test(p)) {
    const speech = isEn
      ? pickDynamicSpeech('english', [
          `Switching to English mode${namePhrase}! Here are the biggest English-language hits on the charts.`,
          `English bangers incoming! Top hits from the global charts just for you.`,
        ])
      : pickDynamicSpeech('english', [
          `¡Modo inglés activado${namePhrase}! Te traigo los hits más grandes en inglés del momento.`,
          `Cambiamos al inglés. Aquí tienes los mayores éxitos internacionales del pop y el urbano.`,
          `Puro inglés en cabina. Los temazos globales más sonados ahora mismo.`,
        ]);
    return {
      speech,
      query: 'taylor swift the weeknd drake dua lipa harry styles billie eilish english hits top',
      vibeTitle: isEn ? 'Session: English Hits' : 'Sesión: Hits en Inglés',
      vibeColor: '#1565c0',
      excludeTitles: [],
    };
  }

  // 3d. Pop español / música en español
  if (/espa[nñ]ol|en espa[nñ]ol|pop espa[nñ]ol|castellano|spanish/i.test(p)) {
    const speech = isEn
      ? pickDynamicSpeech('spanish', [
          `Spanish hits coming through${namePhrase}! The best of the Spanish-speaking charts right now.`,
        ])
      : pickDynamicSpeech('spanish', [
          `¡Puro pop en español${namePhrase}! Los mayores temazos de habla hispana del momento.`,
          `Lo mejor del pop y el urbano en español. Aquí los hits que arrasan en España y Latinoamérica.`,
        ]);
    return {
      speech,
      query: 'quevedo aitana bad gyal yung beef cruz cafune exitos espana 2024',
      vibeTitle: isEn ? 'Session: Spanish Hits' : 'Sesión: Hits en Español',
      vibeColor: '#c62828',
      excludeTitles: [],
    };
  }

  // 3b. Bachata / Latino Romántico
  if (/bachata|romeo|prince royce|aventura|merengue/i.test(p)) {
    const speech = isEn
      ? pickDynamicSpeech('bachata', [
          `Pure romance and rhythm${namePhrase}! Here are the greatest hits from Romeo Santos, Prince Royce, and more.`,
          `Classic Latin romantic groove coming through. Turn up the feeling.`,
        ])
      : pickDynamicSpeech('bachata', [
          `¡Pura bachata y sentimiento${namePhrase}! Aquí tienes los himnos de Romeo Santos, Prince Royce y más.`,
          `Romance y ritmo a fuego lento. Disfruta de esta selección de bachata de primer nivel.`,
        ]);
    return {
      speech,
      query: 'romeo santos prince royce aventura juan luis guerra bachata exitos',
      vibeTitle: isEn ? 'Session: Bachata & Romance' : 'Sesión: Bachata y Sentimiento',
      vibeColor: '#7b1fa2',
      excludeTitles: ['bachata'],
    };
  }

  // 3c. Trap / Urbano / Drill
  if (/trap|drill|urbano|calle|duki|eladio|milo j|trueno|c\.r\.o|ysy a/i.test(p)) {
    const speech = isEn
      ? pickDynamicSpeech('trap', [
          `Heavy urban vibes incoming${namePhrase}. Sharp bars and the hardest trap beats on the block.`,
          `Dialing into the streets. Deep 808s and the freshest flow in the scene.`,
        ])
      : pickDynamicSpeech('trap', [
          `Directo a la vibra pesada${namePhrase}. Puras barras y los ritmos urbanos más duros del momento.`,
          `Flow callejero en cabina. Bajos contundentes y el mejor trap de la escena.`,
          `Sonido urbano pesado. Aquí tienes la crema del drill y el trap.`,
        ]);
    return {
      speech,
      query: 'duki trueno milo j bizarrap eladio carrion trap exitos',
      vibeTitle: isEn ? 'Session: Trap & Urban' : 'Sesión: Trap y Urbano',
      vibeColor: '#ff5722',
      excludeTitles: ['trap'],
    };
  }

  // 3d. Electrónica / House / Dance
  if (/electro|electronic|techno|house|edm|rave|dance|dj set/i.test(p)) {
    const speech = isEn
      ? pickDynamicSpeech('electronic', [
          `Pumping up the BPM! Here's a crisp electronic set to keep the dancefloor alive.`,
          `Club mode engaged. Pulsing beats and immersive synth waves.`,
        ])
      : pickDynamicSpeech('electronic', [
          `¡Subiendo los BPMs! Te preparé una sesión electrónica limpia para mantener la energía al tope.`,
          `Modo club activado. Bajos sintetizados y ritmos envolventes para perderse en la música.`,
        ]);
    return {
      speech,
      query: 'calvin harris david guetta tiesto avicii edm dance hits',
      vibeTitle: isEn ? 'Session: Club Electronic' : 'Sesión: Club Electrónica',
      vibeColor: '#00acc1',
      excludeTitles: ['electro', 'electronic', 'house'],
    };
  }

  // 3e. Rock / Indie / Clásicos del Rock
  if (/rock|guitarra|indie|queen|nirvana|coldplay|estopa|melendi/i.test(p)) {
    const speech = isEn
      ? pickDynamicSpeech('rock', [
          `Turn up those guitars! Timeless rock anthems you can sing along to at the top of your lungs.`,
          `Pure rock and roll spirit! Crank up the volume and feel the distortion.`,
        ])
      : pickDynamicSpeech('rock', [
          `¡Suban esas guitarras! Clásicos y temazos de rock que se cantan a pleno pulmón.`,
          `Puro espíritu de rock and roll. Dale gas al amplificador y siente el ritmo.`,
        ]);
    return {
      speech,
      query: 'queen coldplay estopa melendi fito fitipaldis rock exitos',
      vibeTitle: isEn ? 'Session: Rock Classics' : 'Sesión: Clásicos del Rock',
      vibeColor: '#c2185b',
      excludeTitles: ['rock', 'rock n roll'],
    };
  }

  // 4. Study / Focus / Deep Work / Reading / Coding
  if (/estudiar|concentra|trabajar|lectura|estudio|piano|trabajo|examen|tarea|oficina|programar|enfoque/i.test(p)) {
    const speech = isEn
      ? pickDynamicSpeech('focus', [
          `Focus time${namePhrase}. Here are clean, steady beats to help you stay in the zone.`,
          `Deep work atmosphere ready. Smooth textures to power through your tasks.`,
        ])
      : pickDynamicSpeech('focus', [
          `Momento de enfoque${namePhrase}. Aquí tienes ritmos limpios para concentrarte y rendir al cien.`,
          `Zona de concentración activa. Sonidos constantes y fluidos para que nada te distraiga.`,
        ]);
    return {
      speech,
      query: 'lofi study beats chill instrumental piano calm',
      vibeTitle: isEn ? 'Session: Deep Focus' : 'Sesión: Enfoque Profundo',
      vibeColor: '#1976d2',
    };
  }

  // 5. Chill / Lo-Fi / Relaxed Rhythm / "Algo chill"
  if (/chill|relax|tranquil|calma|suave|paz|sof[aá]|desconectar|descanso|desestres|lofi|lo-fi/i.test(p)) {
    const speech = isEn
      ? pickDynamicSpeech('chill', [
          `Time to unwind${namePhrase}. Here's a curated lo-fi chill session to disconnect and clear your head.`,
          `Slowing down the tempo. Sit back, take a breath, and let these smooth beats flow.`,
          `Pure chill vibes. Warm melodies, gentle beats, and zero stress.`,
          `A quiet moment for you. Put your headphones on and drift away with this peaceful soundscape.`,
        ])
      : pickDynamicSpeech('chill', [
          `Relájate${namePhrase}. Te preparé una sesión lo-fi con ritmos suaves y tranquilos para desconectar del mundo.`,
          `Bajamos las revoluciones${namePhrase}. Aquí tienes una selección relajada para desconectar y respirar hondo.`,
          `Vibra tranquila en cabina. Ritmos lentos, texturas suaves y cero preocupaciones.`,
          `Momento de paz. Ponte cómodo y déjate llevar por esta atmósfera relajante.`,
        ]);
    return {
      speech,
      query: 'lofi hip hop beats chill study instrumental',
      vibeTitle: isEn ? 'Session: Lo-Fi Chill Beats' : 'Sesión: Lo-Fi Chill Beats',
      vibeColor: '#00897b',
      excludeTitles: ['chill', 'relax', 'chill out', 'reggaeton', 'techno'],
    };
  }

  // 6. Sleep / Night / Bedtime
  if (/dormir|noche|cama|sue[nñ]o|descansar|acostarse/i.test(p)) {
    const speech = isEn
      ? pickDynamicSpeech('sleep', [
          `Good night${namePhrase}. Here's an intimate, soothing soundtrack to help you drift off peacefully.`,
          `Soft bedtime melodies to quiet your thoughts and rest deep.`,
        ])
      : pickDynamicSpeech('sleep', [
          `Buenas noches${namePhrase}. Te dejo esta selección íntima y calmada para que descanses como toca.`,
          `Sonidos suaves y envolventes para despejar la mente y conciliar el sueño.`,
        ]);
    return {
      speech,
      query: 'sleep ambient lofi night piano calm ludovico einaudi',
      vibeTitle: isEn ? 'Session: Night Calm' : 'Sesión: Calma Nocturna',
      vibeColor: '#283593',
    };
  }

  // 7. Road trip / Driving / Car
  if (/coche|viaje|conducir|carretera|viajar|ruta|auto/i.test(p)) {
    const speech = isEn
      ? pickDynamicSpeech('roadtrip', [
          `Music for the open road! Turn up the volume and enjoy the ride with these anthems.`,
          `Hit the highway! Great travel companions to make every mile fly by.`,
        ])
      : pickDynamicSpeech('roadtrip', [
          `¡Música para la carretera! Sube el volumen y disfruta del camino con estos temazos.`,
          `¡Rumbo al destino! Buenas canciones para que cada kilómetro sea una fiesta.`,
        ]);
    return {
      speech,
      query: 'avicii coldplay dua lipa the weeknd road trip hits',
      vibeTitle: isEn ? 'Session: Open Road' : 'Sesión: Carretera y Viento',
      vibeColor: '#f57c00',
    };
  }

  // 8. Nostalgia / Decades (2000s, 90s, 80s, classic) / "Clásicos"
  if (/2000|noventa|ochenta|80|90|clasic|cl[aá]sico|retro|nostalg|recuerdo|antigu|viej/i.test(p)) {
    const era = /80/i.test(p) ? 'los 80' : /90/i.test(p) ? 'los 90' : 'los 2000';
    const speech = isEn
      ? pickDynamicSpeech('classics', [
          `Taking a trip back in time! Timeless anthems that never get old. Sing along!`,
          `Pure nostalgia! Classic hits that defined eras and still sound incredible today.`,
          `Golden anthems coming right through. Enjoy this unforgettable vintage throwback.`,
        ])
      : pickDynamicSpeech('classics', [
          `¡Viajazo en el tiempo! Esos himnos legendarios que nunca pasan de moda. A cantar a pleno pulmón.`,
          `¡Puros recuerdos! Canciones inolvidables que marcaron época y siguen sonando brutales.`,
          `Nostalgia de la buena. Dale play a estos himnos de oro de ${era}.`,
        ]);
    return {
      speech,
      query: `exitos clasicos ${era} pop rock hits radio`,
      vibeTitle: isEn ? 'Session: Timeless Classics' : `Sesión: Clásicos de ${era.toUpperCase()}`,
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

  if (!detectedArtist) {
    const match = p.match(/(?:ponme|algo de|canciones de|musica de|escuchar a|parecido a|tipo)\s+([a-zA-Z0-9\s]+)/i);
    if (match && match[1] && match[1].trim().length > 2 && match[1].trim().length < 30) {
      detectedArtist = match[1].trim();
    }
  }

  if (detectedArtist) {
    const speech = isEn
      ? `Nothing beats ${detectedArtist}! Here's a handpicked selection with their finest tracks.`
      : `¡Qué temazos tiene ${detectedArtist}! Te armé una selección con sus mejores temas. Dale play.`;
    return {
      speech,
      query: `${detectedArtist} exitos populares`,
      vibeTitle: `Sesión: ${detectedArtist.toUpperCase()}`,
      vibeColor: '#0c52cc',
    };
  }

  // 10. General / Surprise / "Sorpréndeme" / Catch-all
  const isSurprise = /sorpr[eé]ndeme|sorpresa|aleatorio|random|mezcla|otra cosa/i.test(p);
  const speech = isEn
    ? pickDynamicSpeech('surprise', [
        `Switching up the script${namePhrase}! Let me take the wheel with this unexpected, fresh mix.`,
        `Time for a surprise! I dug deep into your tastes to bring an exciting mashup.`,
        `Curating a brand new groove for you. Sit back and enjoy the discovery.`,
      ])
    : pickDynamicSpeech('surprise', [
        `¡Venga esa sorpresa${namePhrase}! Rebusqué en tus listas y encontré combinaciones que te van a volar la cabeza.`,
        `¡Cambiamos el guión! Déjame llevar el volante con esta mezcla inesperada.`,
        `Modo aleatorio premium. Temas que te encantan junto a descubrimientos frescos.`,
        `Cambiando de onda${namePhrase}. Aquí tienes una mezcla fresca pensada para ti. A disfrutarla.`,
      ]);

  return {
    speech,
    query: isSurprise ? 'exitos pop latino urbano indie radio hits' : `${p} exitos canciones`,
    vibeTitle: isSurprise ? (isEn ? 'Session: Surprise Mashup' : 'Sesión: Mezcla Sorpresa') : `Sesión: ${prompt.slice(0, 20)}`,
    vibeColor: '#0050d0',
  };
}

/**
 * Pre-warms neural TTS audio for all primary quick vibe chips so that
 * tapping any button starts voice playback with 0ms network latency.
 */
export function prefetchQuickVibeVoices(userName?: string): void {
  const prompts = [
    'Algo chill',
    'Más movido',
    'Reggaetón',
    'Clásicos',
    'Trap / Urbano',
    'Sorpréndeme',
  ];
  prompts.forEach((promptText) => {
    try {
      const analysis = analyzeUserIntent(promptText, userName || '');
      aiDJVoiceService.prefetchPhrase(analysis.speech);
    } catch {}
  });
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

    // Compute intro text immediately and prefetch audio concurrently with set curation
    const hour = new Date().getHours();
    const lang = useLanguageStore.getState().language;
    const isEn = lang === 'en';

    const greeting = isEn
      ? (hour >= 6 && hour < 13 ? 'Good morning' : hour >= 13 && hour < 21 ? 'Hey what is up' : 'Good evening')
      : (hour >= 6 && hour < 13 ? '¡Buenos días' : hour >= 13 && hour < 21 ? '¡Qué onda' : '¡Buenas noches');

    const rawName = useSpotifyDataStore.getState().user?.display_name || '';
    const cleanName = rawName ? rawName.split(' ')[0] : '';
    const namePart = cleanName ? `, ${cleanName}` : '';

    const introText = isEn
      ? `${greeting}${namePart}! I'm your DJ. I took a look at what you've been listening to and built a personalized mix of your favorite tracks. What vibe are you feeling today?`
      : `${greeting}${namePart}! Aquí tu DJ. Estuve viendo lo que escuchas y te armé una mezcla con tus temas favoritos. ¿Qué te apetece escuchar ahora?`;

    aiDJVoiceService.prefetchPhrase(introText);
    prefetchQuickVibeVoices(cleanName);

    // 1. Curate initial set: 75% directly from user playlists + same library artists
    const initialSet = await getInitialDJLibraryRemix(15);
    set({ djTracks: initialSet });

    // 2. Stage track 1 in the player without playing audio yet (prevents volume collision while DJ speaks)
    if (initialSet.length > 0) {
      usePlayerStore.setState({
        queue: initialSet,
        currentTrack: initialSet[0],
        isPlaying: false,
      });
    }

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

    get().stopVoiceListening();
    await aiDJVoiceService.speak(introText, {
      onWord: (_word, partial) => {
        set({ displayedTranscript: partial });
      },
      onVoiceLevel: (level) => {
        set({ voiceLevel: level });
      },
      onEnd: () => {
        // Drop the beat cleanly right as the DJ intro concludes!
        if (initialSet.length > 0) {
          usePlayerStore.getState().playTrack(initialSet[0], initialSet, 'dj-session');
        }
        set({
          visualizerState: 'playing',
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
      if (typeof window !== 'undefined') {
        (window as any).speechRecognitionInstance = rec;
      }
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
        speechRecognitionInstance.abort();
      } catch {}
      speechRecognitionInstance = null;
    }
    if (typeof window !== 'undefined') {
      (window as any).speechRecognitionInstance = null;
    }
    set({ isMicListening: false });
  },

  /**
   * Deep conversational semantic intent understanding & dynamic set curation
   */
  handleUserPrompt: async (promptText: string) => {
    if (!promptText || promptText.trim().length === 0) return;

    aiDJVoiceService.stopSpeaking();

    const pLow = promptText.toLowerCase().trim();

    // ─── FAST-PATH: "siguiente", "siguiente canción", "otra", "skip", "cambia" ───
    const isSkipCmd = /^(siguiente|sig|skip|otra|cambia(r)?(\s+de\s+canci[oó]n)?|next|salta)$/i.test(pLow)
      || /\b(siguiente\s+canci[oó]n|otra\s+canci[oó]n|skip\s+this|ponme\s+otra|pass|next\s+track)\b/i.test(pLow);

    if (isSkipCmd) {
      usePlayerStore.getState().nextTrack();
      const skipPhrases = [
        '¡Cambiando de tema!',
        'Siguiente canción, ¡vamos!',
        '¡Ale! Aquí viene la siguiente.',
        'Listo, pasamos a la siguiente.',
      ];
      const sp = skipPhrases[Math.floor(Math.random() * skipPhrases.length)];
      const t = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      set((state) => ({
        chatHistory: [
          ...state.chatHistory,
          { id: `msg-user-${Date.now()-1}`, sender: 'user', text: promptText, timestamp: t },
          { id: `msg-dj-${Date.now()}`, sender: 'dj', text: sp, timestamp: t },
        ],
        currentMessage: sp,
        displayedTranscript: '',
        visualizerState: 'playing',
        voiceLevel: 0,
      }));
      get().stopVoiceListening();
      aiDJVoiceService.speak(sp, {
        onWord: (_w, partial) => set({ displayedTranscript: partial }),
        onVoiceLevel: (level) => set({ voiceLevel: level }),
        onEnd: () => set({ visualizerState: 'playing', voiceLevel: 0 }),
      });
      return;
    }

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

    // Immediately prefetch the speech audio concurrently so playback starts with minimal latency
    aiDJVoiceService.prefetchPhrase(analysis.speech);

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

    // 4. Stage track 1 in the player without un-ducked audio overlap
    const track1 = finalSet[0];
    if (track1) {
      usePlayerStore.setState({
        queue: finalSet,
        currentTrack: track1,
        isPlaying: false,
      });
    }

    // 5. Speak the personalized charismatic DJ intro cleanly
    get().stopVoiceListening();
    await aiDJVoiceService.speak(analysis.speech, {
      onWord: (_word, partial) => {
        set({ displayedTranscript: partial });
      },
      onVoiceLevel: (level) => {
        set({ voiceLevel: level });
      },
      onEnd: () => {
        // Drop the beat cleanly right as speech concludes!
        if (track1) {
          usePlayerStore.getState().playTrack(track1, finalSet, 'dj-session');
        }
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

    const lang = useLanguageStore.getState().language;
    const isEn = lang === 'en';

    const completionPhrases = isEn
      ? [
          "How about we keep this vibe going? I checked your playlists and lined up 15 more tracks you're going to love.",
          "What an amazing session so far! Keeping this momentum with 15 fresh tracks selected just for you. Turn it up!",
          "Keeping the music flowing without missing a beat. Here are 15 more songs to keep the energy going.",
        ]
      : [
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

    get().stopVoiceListening();
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

    const lang = useLanguageStore.getState().language;
    const isEn = lang === 'en';

    const transitionPhrases = isEn
      ? [
          `That was ${curTitle}${curArtist ? ` by ${curArtist}` : ''}. Switching it up with this next track. Turn it up!`,
          `What a track we just listened to! Keeping the energy high, let's jump into this one.`,
          `Changing up the vibe... here is another tune you're gonna love. Hit play!`,
        ]
      : [
          `Ese fue ${curTitle}${curArtist ? ` de ${curArtist}` : ''}. Cambiemos de rollo con esto otro. ¡Súbele!`,
          `¡Qué temazo acabamos de escuchar! Para mantener el ambiente arriba, vamos con esto.`,
          `Cambiando de onda... aquí tienes otro tema que te va a encantar. ¡Dale play!`,
        ];
    const transitionText = transitionPhrases[Math.floor(Math.random() * transitionPhrases.length)];

    set({ currentMessage: transitionText, displayedTranscript: '' });

    get().stopVoiceListening();
    await aiDJVoiceService.speak(transitionText, {
      onWord: (_word, partial) => {
        set({ displayedTranscript: partial });
      },
      onVoiceLevel: (lvl) => {
        set({ voiceLevel: lvl });
      },
      onEnd: () => {
        // Drop the next track cleanly as the DJ finishes introducing it
        usePlayerStore.getState().nextTrack();
        set({ visualizerState: 'playing', voiceLevel: 0 });
      },
    });
  },
}));

if (typeof window !== 'undefined') {
  (window as any).__useAIDJStore = useAIDJStore;
}
