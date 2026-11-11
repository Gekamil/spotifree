import { create } from 'zustand';
import type { Track } from '../types/spotify';
import { useSpotifyDataStore } from '../store/useSpotifyDataStore';
import { usePlayerStore } from '../store/usePlayerStore';
import { audioEngine } from './audioEngine';
import { aiDJVoiceService, cleanTextForNaturalTTS } from './aiDJVoiceService';
import { isNativeSpeechAvailable, nativeListen, nativeStopListening } from './nativeSpeech';
import { useLanguageStore } from '../utils/i18n';
import { resolveTrackCoversBatch } from '../utils/trackCovers';
import {
  type MusicHashtag,
  resolveHashtagFromPrompt,
  getCuratedSetForHashtag,
  getDominantUserHashtag,
  getInitialDJLibraryRemix,
  classifyTrackHashtags,
} from './musicTaggingService';
import { useStatsStore } from '../store/useStatsStore';
import { isNonMusicOrNoise, filterMusicTracksOnly } from '../utils/trackFilter';
import { getCustomLikedSongs } from '../utils/userStorage';
import { searchSpotify, fetchPlaylistRecommendations } from './spotifyApi';
import { fetchLyricsUnified, parseEnhancedLyrics } from '../utils/lyricsService';
import { buildSegmentedDJSet, buildSegmentIntro, segmentAt, type DJSegment } from './djSegments';

export type AIDJVisualizerMode = 'idle' | 'speaking' | 'listening' | 'playing';

export interface DJChatMessage {
  id: string;
  sender: 'dj' | 'user';
  text: string;
  timestamp: string;
  curatedSetTitle?: string;
  trackCount?: number;
  requestedTrack?: Track;
  similarTracks?: Track[];
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
  /** Blocks of the current set ("Lo que más te suena", "Hace tiempo que no suenan"...) */
  segments: DJSegment[];
  activeSegmentId: string | null;
  /** True while the DJ prepares a set (AI request in flight) */
  isThinking: boolean;
  /** 'personal' = built from the user's library; 'request' = built from what they asked for */
  setMode: 'personal' | 'request';
  /** Requested song information when user asks for a specific title */
  requestedSongName: string | null;
  requestedTrack: Track | null;
  similarTracks: Track[];
  showSimilarPanel: boolean;

  // Actions
  setShowSimilarPanel: (show: boolean) => void;
  clearSimilarTracks: () => void;
  setViewMode: (mode: 'chat' | 'playlist') => void;
  setVisualizerState: (state: AIDJVisualizerMode) => void;
  setVoiceLevel: (level: number) => void;
  setTranscript: (text: string) => void;
  setDJThemeColor: (color: string) => void;
  setDJTracks: (tracks: Track[]) => void;
  startDJSession: (forceReset?: boolean) => Promise<void>;
  cancelDJIntroIfNotStarted: () => void;
  stopDJSession: () => void;
  handleUserPrompt: (promptText: string) => Promise<void>;
  handleSetCompletion: () => Promise<void>;
  startVoiceListening: () => void;
  stopVoiceListening: () => void;
  triggerManualTransition: () => Promise<void>;
  /** Spotify DJ's main button: jump to the next block (or build new ones) and let the DJ present it */
  nextSegment: () => Promise<void>;
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

const isEnglishUI = () => useLanguageStore.getState().language === 'en';

function pickDynamicSpeech(categoryKey: string, options: string[]): string {
  const lastUsed = lastUsedSpeechMap.get(categoryKey);
  const candidates = options.length > 1 ? options.filter((s) => s !== lastUsed) : options;
  const picked = candidates[Math.floor(Math.random() * candidates.length)] || options[0];
  lastUsedSpeechMap.set(categoryKey, picked);
  return picked;
}

/** Real facts the DJ may mention (the AI is told not to invent any other) */
function buildDJContext(track?: Track | null): Record<string, unknown> {
  const now = new Date();
  const h = now.getHours();
  const timeOfDay = h < 6 ? 'madrugada' : h < 13 ? 'mañana' : h < 21 ? 'tarde' : 'noche';
  const weekday = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][now.getDay()];
  const voice = aiDJVoiceService.getSelectedVoice();
  const voiceRegion = voice === 'dalia' || voice === 'jorge' ? 'mx' : voice === 'salome' ? 'co' : voice === 'sebastian' ? 've' : 'es';
  const ctx: Record<string, unknown> = { timeOfDay, weekday, voiceRegion };
  try {
    const top = useStatsStore.getState().getTopArtists(3).map((a) => a.name).filter(Boolean);
    if (top[0]) ctx.topArtist = top[0];
    if (track && top.some((n) => (track.artists || []).some((a) => a.name === n))) ctx.isTopArtist = true;
  } catch {}
  const release = String((track as any)?.album?.release_date || '');
  if (/^\d{4}/.test(release)) ctx.releaseYear = release.slice(0, 4);
  const album = track?.album?.name;
  if (album && track && album.toLowerCase() !== (track.name || '').toLowerCase()) ctx.album = album;
  return ctx;
}

async function callGroqDJ(payload: any, timeoutMs = 4500): Promise<any | null> {
  try {
    const res = await fetch('/api/groq', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: useLanguageStore.getState().language,
        context: buildDJContext(payload?.currentTrack || payload?.nextTrack),
        ...payload,
      }),
      signal: AbortSignal.timeout ? AbortSignal.timeout(timeoutMs) : undefined,
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && !data.success && data.reason) console.info('[AIDJ] AI not available, using local DJ lines:', data.reason);
    return data && data.success ? data : null;
  } catch {
    return null;
  }
}

/** Liked songs as tracks (the real storage, not the legacy 'spotifree_liked_songs' key). */
function getLikedTracksForDJ(): Track[] {
  try {
    const custom = getCustomLikedSongs();
    if (custom.length > 0) return custom;
  } catch {}
  const likedPl = useSpotifyDataStore.getState().playlists.find((p) => p.id === 'liked-songs');
  return likedPl?.tracks?.items || [];
}

function firstName(): string {
  const raw = useSpotifyDataStore.getState().user?.display_name || '';
  const n = raw ? raw.split(' ')[0] : '';
  return n === 'Invitado' ? '' : n;
}

/** Turns an AI recommendation into a real catalog track (real id + cover) when possible. */
async function resolveRecommendedTrack(title: string, artist: string): Promise<Track | null> {
  try {
    const res = await Promise.race([
      searchSpotify(`${title} ${artist}`),
      new Promise<null>((r) => setTimeout(() => r(null), 3500)),
    ]);
    const items: Track[] = (res as any)?.tracks?.items || [];
    const a = artist.toLowerCase();
    const t = title.toLowerCase();
    const hit =
      items.find((it) => (it.name || '').toLowerCase().includes(t) && (it.artists || []).some((x) => (x.name || '').toLowerCase().includes(a) || a.includes((x.name || '').toLowerCase()))) ||
      items.find((it) => (it.artists || []).some((x) => (x.name || '').toLowerCase() === a));
    return hit || null;
  } catch {
    return null;
  }
}

/** Speaks a DJ line over the music (ducked), with live captions. */
// The session greeting: leaving the DJ before the voice is heard cancels it
let introRun = 0;
let introPending = false;
let introVoiceHeard = false;

async function djSpeak(text: string, set: (p: Partial<AIDJState>) => void) {
  set({ visualizerState: 'speaking', currentMessage: text, displayedTranscript: '' });
  audioEngine.setDuckedVolume(0.18);
  await aiDJVoiceService.speak(text, {
    onWord: (_w, partial) => set({ displayedTranscript: partial }),
    onVoiceLevel: (level) => {
      if (level > 0.06) introVoiceHeard = true;
      set({ voiceLevel: level });
    },
    onEnd: () => {
      audioEngine.restoreDuckedVolume(1200);
      set({ visualizerState: usePlayerStore.getState().isPlaying ? 'playing' : 'idle', voiceLevel: 0 });
    },
  });
}

const announcedSegments = new Set<string>();

/** Asks the AI (in the background) for nicer block intros; keeps the local ones if it is slow. */
function polishSegmentIntros(segments: DJSegment[], tracks: Track[], set: (fn: (s: AIDJState) => Partial<AIDJState>) => void) {
  const userName = firstName();
  segments.slice(1).forEach((seg) => {
    const first = tracks[seg.startIndex];
    if (!first) return;
    callGroqDJ({ action: 'segment', kind: seg.title, reason: seg.reason, currentTrack: first, userName }, 5000).then((r) => {
      if (!r?.speech) return;
      const speech = cleanTextForNaturalTTS(r.speech);
      aiDJVoiceService.prefetchPhrase(speech);
      set((s) => ({ segments: s.segments.map((x) => (x.id === seg.id ? { ...x, intro: speech } : x)) }));
    });
  });
  // Warm up the local lines too, so the voice starts instantly at each block
  segments.forEach((s) => aiDJVoiceService.prefetchPhrase(s.intro));
}

export interface UserListeningProfile {
  topArtists: string[];
  recentTracks: { name: string; artist: string }[];
  likedTracks: { name: string; artist: string }[];
  topGenres: string[];
  totalTracksPlayed: number;
}

/**
 * Dynamically analyzes the current user's genuine listening history,
 * stats store, played tracks, and liked library to construct an accurate musical taste profile.
 */
export function getUserListeningProfile(): UserListeningProfile {
  const stats = useStatsStore.getState();
  const topArtists = stats.getTopArtists(8).map((a) => a.name).filter(Boolean);
  const playerHistory = usePlayerStore.getState().history || [];

  // 1. Recent tracks from player history (what the user actually listens to)
  const recentTracks = playerHistory.slice(0, 8).map((t) => ({
    name: t.name,
    artist: t.artists?.[0]?.name || '',
  })).filter((t) => t.name && t.artist);

  // 2. If stats hasn't recorded many plays yet, extract top artists directly from history
  if (topArtists.length === 0) {
    const artistCounts = new Map<string, number>();
    playerHistory.forEach((t) => {
      const art = t.artists?.[0]?.name;
      if (art && art !== 'Spotify') {
        artistCounts.set(art, (artistCounts.get(art) || 0) + 1);
      }
    });
    const sorted = Array.from(artistCounts.entries()).sort((a, b) => b[1] - a[1]);
    sorted.slice(0, 8).forEach(([art]) => topArtists.push(art));
  }

  // 3. Liked songs sample and additional artists
  let likedTracks: { name: string; artist: string }[] = [];
  if (typeof window !== 'undefined') {
    try {
      const localLiked: Track[] = getLikedTracksForDJ();
      likedTracks = localLiked.slice(0, 8).map((t) => ({
        name: t.name,
        artist: t.artists?.[0]?.name || '',
      })).filter((t) => t.name);

      if (topArtists.length < 5) {
        localLiked.forEach((t) => {
          const art = t.artists?.[0]?.name;
          if (art && art !== 'Spotify' && !topArtists.includes(art)) {
            topArtists.push(art);
          }
        });
      }
    } catch {}
  }

  // 4. Also scan user's playlists if topArtists is still empty
  if (topArtists.length === 0) {
    const { playlists, playlistDetailsCache } = useSpotifyDataStore.getState();
    const artistCounts = new Map<string, number>();
    const countArt = (t: Track) => {
      const art = t.artists?.[0]?.name;
      if (art && art !== 'Spotify') {
        artistCounts.set(art, (artistCounts.get(art) || 0) + 1);
      }
    };
    playlists.forEach((p) => p.tracks?.items?.forEach(countArt));
    Object.values(playlistDetailsCache).forEach((p: any) => p?.tracks?.items?.forEach(countArt));
    const sorted = Array.from(artistCounts.entries()).sort((a, b) => b[1] - a[1]);
    sorted.slice(0, 8).forEach(([art]) => topArtists.push(art));
  }

  // 5. Detect top genres/styles from user's history and liked songs
  const detectedGenres: string[] = [];
  const tagCounts = new Map<string, number>();
  [...playerHistory, ...getLikedTracksForDJ()].forEach((t) => {
    const tags = classifyTrackHashtags(t);
    tags.forEach((tag) => {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    });
  });
  const sortedTags = Array.from(tagCounts.entries()).sort((a, b) => b[1] - a[1]);
  sortedTags.slice(0, 3).forEach(([tag]) => detectedGenres.push(tag.replace('#', '')));

  return {
    topArtists: topArtists.slice(0, 8),
    recentTracks,
    likedTracks,
    topGenres: detectedGenres,
    totalTracksPlayed: stats.totalTracksPlayed || playerHistory.length,
  };
}

function rawAnalyzeUserIntent(prompt: string, userName: string): IntentAnalysis {
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

  const userProfile = getUserListeningProfile();
  let defaultQuery = `${p} exitos canciones`;
  if (isSurprise) {
    if (userProfile.topArtists.length > 0) {
      defaultQuery = `${userProfile.topArtists.slice(0, 3).join(' ')} exitos recomendados`;
    } else {
      defaultQuery = 'exitos pop latino urbano indie radio hits';
    }
  }

  return {
    speech,
    query: defaultQuery,
    vibeTitle: isSurprise ? (isEn ? 'Session: Your Personalized Mix' : 'Sesión: Tu Mezcla Personalizada') : `Sesión: ${prompt.slice(0, 20)}`,
    vibeColor: '#0050d0',
  };
}

function analyzeUserIntent(prompt: string, userName: string): IntentAnalysis {
  const res = rawAnalyzeUserIntent(prompt, userName);
  return {
    ...res,
    speech: cleanTextForNaturalTTS(res.speech),
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
  segments: [],
  activeSegmentId: null,
  isThinking: false,
  setMode: 'personal',
  requestedSongName: null,
  requestedTrack: null,
  similarTracks: [],
  showSimilarPanel: false,

  setShowSimilarPanel: (showSimilarPanel) => set({ showSimilarPanel }),
  clearSimilarTracks: () => set({ requestedSongName: null, requestedTrack: null, similarTracks: [], showSimilarPanel: false }),
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

    // Mutual Exclusivity: Starting DJ session turns off shuffle mode
    try {
      const pState = usePlayerStore.getState();
      if (pState.isShuffle || pState.shuffleMode !== 'off') {
        usePlayerStore.setState({
          shuffleMode: 'off',
          isShuffle: false,
          playedInShuffle: [],
          preselectedNextTrackId: null,
        });
      }
    } catch {}

    const dominantTag = getDominantUserHashtag();
    const cleanName = firstName();
    const run = ++introRun;
    introPending = true;
    introVoiceHeard = false;

    set({
      isDJModeActive: true,
      visualizerState: 'idle',
      songsPlayedInSet: 0,
      currentHashtag: dominantTag,
      isThinking: true,
      setMode: 'personal',
      currentMessage: '',
      displayedTranscript: '',
    });
    prefetchQuickVibeVoices(cleanName);

    // 1. Build the set in blocks from the user's real listening (fresh order every time)
    let tracks: Track[] = [];
    let segments: DJSegment[] = [];
    try {
      const built = await buildSegmentedDJSet({ userName: cleanName });
      tracks = filterMusicTracksOnly(built.tracks);
      segments = built.segments;
    } catch (e) {
      console.warn('[AIDJ] Segmented set failed, using library remix:', e);
    }
    if (run !== introRun) return; // the user left before the DJ started
    if (tracks.length < 3) {
      tracks = filterMusicTracksOnly(await getInitialDJLibraryRemix(15));
      if (run !== introRun) return;
      segments = tracks.length
        ? [{ id: `seg-${Date.now()}`, kind: 'liked', title: 'Tu mezcla', reason: 'canciones de su biblioteca', startIndex: 0, length: tracks.length, intro: buildSegmentIntro({ kind: 'liked' }, tracks[0], cleanName, true) }]
        : [];
    }
    // If filtering removed songs, keep block boundaries inside the list
    segments = segments.filter((s) => s.startIndex < tracks.length);

    const introText = cleanTextForNaturalTTS(segments[0]?.intro || buildSegmentIntro({ kind: 'liked' }, tracks[0], cleanName, true));
    announcedSegments.clear();
    if (segments[0]) announcedSegments.add(segments[0].id);

    set({
      djTracks: tracks,
      segments,
      activeSegmentId: segments[0]?.id || null,
      currentSetTitle: segments[0]?.title || 'Tu mezcla',
      isThinking: false,
    });
    polishSegmentIntros(segments, tracks, set as any);
    resolveTrackCoversBatch(tracks).catch(() => {});

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    set({
      chatHistory: [
        {
          id: 'msg-initial',
          sender: 'dj',
          text: introText,
          timestamp: timeStr,
          curatedSetTitle: segments[0]?.title || 'Tu mezcla',
          trackCount: tracks.length,
        },
      ],
    });

    get().stopVoiceListening();
    if (tracks.length > 0) {
      usePlayerStore.getState().playTrack(tracks[0], tracks, 'dj-session');
    }
    await djSpeak(introText, set);
    if (run === introRun) introPending = false;
  },

  /**
   * Leaving the DJ screen before the greeting is heard: nothing more happens. While the set is
   * still being prepared the whole start is called off; once the music is on, only the voice is.
   */
  cancelDJIntroIfNotStarted: () => {
    if (!introPending || introVoiceHeard) return;
    introRun++;
    introPending = false;
    aiDJVoiceService.stopSpeaking();
    audioEngine.restoreDuckedVolume(300);
    if (get().isThinking) {
      set({ isDJModeActive: false, isThinking: false, visualizerState: 'idle', voiceLevel: 0, currentMessage: '', displayedTranscript: '' });
    } else {
      set({ visualizerState: usePlayerStore.getState().isPlaying ? 'playing' : 'idle', voiceLevel: 0, currentMessage: '', displayedTranscript: '' });
    }
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

    // APK: Android's own speech recognition (the WebView has none)
    if (isNativeSpeechAvailable()) {
      const en = isEnglishUI();
      set({
        isMicListening: true,
        visualizerState: 'listening',
        currentMessage: en ? "I'm listening… talk to me" : 'Te escucho... habla conmigo',
        displayedTranscript: '',
      });
      let finalText = '';
      void nativeListen(en ? 'en-US' : 'es-ES', {
        onPartial: (text) => set({ displayedTranscript: text }),
        onFinal: (text) => {
          finalText = text;
          set({ displayedTranscript: text });
        },
        onLevel: (level) => set({ voiceLevel: level }),
        onEnd: (error) => {
          const isPlaying = usePlayerStore.getState().isPlaying;
          set({ isMicListening: false, voiceLevel: 0, visualizerState: isPlaying ? 'playing' : 'idle' });
          if (finalText.trim()) {
            void get().handleUserPrompt(finalText.trim());
          } else if (error === 'permission') {
            const msg = en
              ? 'Spotifree needs microphone permission. You can type your request below.'
              : 'Spotifree necesita permiso para el micrófono. Puedes escribir tu petición aquí abajo.';
            set({ currentMessage: msg, displayedTranscript: msg });
          } else if (error) {
            const msg = en ? "I didn't catch that. Try again or type it below." : 'No te he entendido. Prueba otra vez o escríbelo aquí abajo.';
            set({ currentMessage: msg, displayedTranscript: msg });
          }
        },
      });
      return;
    }

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
      rec.lang = isEnglishUI() ? 'en-US' : 'es-ES';
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
    if (isNativeSpeechAvailable() && get().isMicListening) nativeStopListening();
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
    // Never leave the "preparing" indicator stuck if something below throws
    setTimeout(() => {
      if (get().isThinking) set({ isThinking: false });
    }, 16000);

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
      currentMessage: '',
      displayedTranscript: '',
      voiceLevel: 0.3,
      isThinking: true,
    }));

    const rawName = useSpotifyDataStore.getState().user?.display_name || '';
    const cleanName = rawName ? rawName.split(' ')[0] : '';
    const analysis = analyzeUserIntent(promptText, cleanName);

    // Concurrently prefetch local fallback speech audio for zero latency
    aiDJVoiceService.prefetchPhrase(analysis.speech);

    // 1. Collect all available tracks from user playlists, history, and liked songs
    const { playlists, playlistDetailsCache } = useSpotifyDataStore.getState();
    const allUserTracks: Track[] = [];
    const seenIds = new Set<string>();

    const addTrack = (t: Track) => {
      if (t && t.id && !seenIds.has(t.id)) {
        if (isNonMusicOrNoise(t)) return;
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

    // Include recent listening history so the AI has context on what this specific user plays
    try {
      const history = usePlayerStore.getState().history || [];
      history.forEach(addTrack);
    } catch {}

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
        getLikedTracksForDJ().forEach(addTrack);
      } catch {}
    }

    const userProfile = getUserListeningProfile();

    // ─── 2. CHECK IF PROMPT IS A SPECIFIC SONG REQUEST (e.g. "Te Robaré", "ponme Columbia", etc.) ───
    const isExplicitSongCmd =
      /^(ponme|pon|reproduce|toca|escuchar|quiero\s+escuchar|la\s+canci[oó]n(\s+de)?|la\s+de|canci[oó]n|song|play|temazo)\b/i.test(pLow) ||
      /\b(canci[oó]n\s+de|parecidas?\s+a|similares?\s+a|algo\s+como|del\s+estilo\s+de|titulos?\s+similares?)\b/i.test(pLow);

    const isKnownMoodOnly =
      /^(m[aá]s\s+movido|algo\s+chill|reggaet[oó]n|cl[aá]sicos|trap\s*\/\s*urbano|sorpr[eé]ndeme|gym|entrenar|fiesta|dormir|estudiar|triste|rock|pop|electr[oó]nica|salsa|bachata|descubrimiento)$/i.test(
        pLow
      );

    const cleanedSongQuery = promptText
      .replace(/^(por\s+fa(vor)?|oye|dj|hola|hey)\s*/i, '')
      .replace(/^(ponme|pon|reproduce|toca|escuchar|quiero\s+escuchar|la\s+canci[oó]n(\s+de)?|la\s+de|canci[oó]n|song|play|temazo)\s+/i, '')
      .replace(/\b(por\s+fa(vor)?|gracias)\b/gi, '')
      .replace(/\b(y\s+similares|y\s+parecidas|canciones\s+similares|titulos\s+similares|similares|parecidas)\b/gi, '')
      .trim();

    let songTarget: Track | null = null;
    if (!isKnownMoodOnly && cleanedSongQuery.length >= 2) {
      // 1. First check local library tracks
      const qLow = cleanedSongQuery.toLowerCase();
      const localExact = allUserTracks.find((ut) => {
        const utName = (ut.name || '').toLowerCase();
        return utName === qLow || utName.includes(qLow) || qLow.includes(utName);
      });

      if (localExact) {
        songTarget = localExact;
      } else {
        // 2. Query searchSpotify catalog
        try {
          const searchRes = await Promise.race([
            searchSpotify(cleanedSongQuery),
            new Promise<null>((r) => setTimeout(() => r(null), 3000)),
          ]);
          const candidateList: Track[] = filterMusicTracksOnly(searchRes?.tracks || []);
          if (candidateList.length > 0) {
            const firstCand = candidateList[0];
            const candTitle = (firstCand.name || '').toLowerCase();
            const candArtist = (firstCand.artists?.[0]?.name || '').toLowerCase();
            if (
              isExplicitSongCmd ||
              candTitle.includes(qLow) ||
              qLow.includes(candTitle) ||
              qLow.split(' ').some((w) => w.length > 3 && candTitle.includes(w)) ||
              (candArtist && qLow.includes(candArtist))
            ) {
              songTarget = firstCand;
            }
          }
        } catch {}
      }
    }

    if (songTarget) {
      const artistName = songTarget.artists?.[0]?.name || '';
      const songTitle = songTarget.name;
      const isEn = isEnglishUI();

      // Query Spotify recommendations, Groq, and search in parallel
      const [spotifyRecs, groqResult] = await Promise.all([
        fetchPlaylistRecommendations(
          songTarget.id,
          songTarget.name,
          [songTarget],
          12
        ).catch(() => []),
        callGroqDJ(
          {
            action: 'recommend',
            prompt: `Canciones similares y del mismo estilo y energía que "${songTitle}" de ${artistName}`,
            userName: cleanName,
            userProfile,
          },
          6500
        ).catch(() => null),
      ]);

      const groqCandidates: Track[] = [];
      if (groqResult && Array.isArray(groqResult.tracks)) {
        const validCandidates = groqResult.tracks
          .filter((gt: any) => gt && gt.title && !isNonMusicOrNoise(gt))
          .slice(0, 10);
        const resolved = await Promise.all(
          validCandidates.map((gt: any) => resolveRecommendedTrack(String(gt.title), String(gt.artist || '')))
        );
        resolved.forEach((t) => {
          if (t && !isNonMusicOrNoise(t)) groqCandidates.push(t);
        });
      }

      let searchSimilar: Track[] = [];
      if (spotifyRecs.length + groqCandidates.length < 6 && artistName) {
        try {
          const sRes = await searchSpotify(`${artistName} exitos similares`);
          searchSimilar = filterMusicTracksOnly(sRes?.tracks || []);
        } catch {}
      }

      const targetIdClean = (songTarget.id || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
      const targetTitleLower = songTitle.toLowerCase().trim();
      const isNotTargetSong = (t: Track) => {
        const c = (t.id || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
        const tName = (t.name || '').toLowerCase().trim();
        return c !== targetIdClean && t.id !== songTarget?.id && tName !== targetTitleLower;
      };

      const seenTrackKeys = new Set<string>();
      const dedupeList = (list: Track[]): Track[] => {
        return list.filter((t) => {
          if (!t || !t.id) return false;
          const clean = (t.id || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
          const sig = t.name && t.artists?.[0]?.name ? `${t.name.toLowerCase().trim()}::${t.artists[0].name.toLowerCase().trim()}` : clean;
          if (seenTrackKeys.has(clean) || seenTrackKeys.has(sig)) return false;
          seenTrackKeys.add(clean);
          seenTrackKeys.add(sig);
          return true;
        });
      };

      const rawSimilar = dedupeList([
        ...groqCandidates.filter(isNotTargetSong),
        ...spotifyRecs.filter(isNotTargetSong),
        ...searchSimilar.filter(isNotTargetSong),
        ...allUserTracks.filter(isNotTargetSong),
      ]);

      const similarTracks = filterMusicTracksOnly(rawSimilar).slice(0, 10);
      const finalSet = [songTarget, ...similarTracks];

      let customSpeech = groqResult?.speech ? cleanTextForNaturalTTS(groqResult.speech) : '';
      if (!customSpeech || !customSpeech.toLowerCase().includes(songTitle.toLowerCase().slice(0, 8))) {
        customSpeech = isEn
          ? `Great choice! Here is ${songTitle}${artistName ? ` by ${artistName}` : ''}, and a list of similar titles you'll love.`
          : `¡Temazo! Aquí tienes «${songTitle}»${artistName ? ` de ${artistName}` : ''} y una lista de títulos similares con el mismo estilo para ti.`;
      }

      const finalTitle = `Similares a ${songTitle}`;
      const finalColor = groqResult?.vibeColor || '#1ed760';

      const requestSegment: DJSegment = {
        id: `seg-req-${Date.now()}`,
        kind: 'request',
        title: `Similares a ${songTitle}`,
        reason: `petición: ${songTitle}`,
        startIndex: 0,
        length: finalSet.length,
        intro: customSpeech,
      };

      announcedSegments.clear();
      announcedSegments.add(requestSegment.id);

      resolveTrackCoversBatch(finalSet).catch(() => {});
      if (typeof window !== 'undefined' && (window as any).__audioEngine) {
        try {
          (window as any).__audioEngine.warmupInitialTracks(finalSet.slice(0, 6));
        } catch {}
      }

      const djTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const djMsg: DJChatMessage = {
        id: `msg-dj-${Date.now()}`,
        sender: 'dj',
        text: customSpeech,
        timestamp: djTime,
        curatedSetTitle: finalTitle,
        trackCount: finalSet.length,
        requestedTrack: songTarget,
        similarTracks: similarTracks,
      };

      set((state) => ({
        currentMessage: customSpeech,
        displayedTranscript: '',
        currentSetTitle: finalTitle,
        djThemeColor: finalColor,
        songsPlayedInSet: 0,
        djTracks: finalSet,
        requestedSongName: songTitle,
        requestedTrack: songTarget,
        similarTracks: similarTracks,
        showSimilarPanel: true,
        segments: [requestSegment],
        activeSegmentId: requestSegment.id,
        setMode: 'request',
        isThinking: false,
        chatHistory: [...state.chatHistory, djMsg],
      }));

      usePlayerStore.getState().playTrack(songTarget, finalSet, 'dj-session');
      await djSpeak(customSpeech, set);
      return;
    }

    // 3. General Mood / Hashtag Flow: Resolve hashtag and query Groq in parallel
    const targetTag = resolveHashtagFromPrompt(promptText);
    set({ currentHashtag: targetTag });

    const [hashtagSet, groqResult] = await Promise.all([
      getCuratedSetForHashtag(targetTag, 15),
      callGroqDJ({
        action: 'recommend',
        prompt: promptText,
        userName: cleanName,
        userProfile,
      }, 10000),
    ]);

    let finalSpeech = analysis.speech;
    let finalTitle = analysis.vibeTitle;
    let finalColor = analysis.vibeColor;
    let finalSet: Track[] = [];

    if (groqResult && groqResult.speech) {
      finalSpeech = cleanTextForNaturalTTS(groqResult.speech);
      aiDJVoiceService.prefetchPhrase(finalSpeech);
      if (groqResult.vibeTitle) finalTitle = groqResult.vibeTitle;
      if (groqResult.vibeColor) finalColor = groqResult.vibeColor;

      // Smart recommendation mapping: user library matches + new personalized discoveries
      if (Array.isArray(groqResult.tracks) && groqResult.tracks.length > 0) {
        const candidates = (groqResult.tracks as any[])
          .filter((gt) => gt && gt.title && !isNonMusicOrNoise(gt))
          .slice(0, 15);
        // Songs already in the library are used as they are; new discoveries are looked up in the
        // catalog (in parallel) so they get their real id and cover instead of a stock photo.
        const resolved = await Promise.all(
          candidates.map(async (gt) => {
            const gTitle = String(gt.title || '').toLowerCase().trim();
            const gArtist = String(gt.artist || '').toLowerCase().trim();
            const inLibrary = allUserTracks.find((ut) => {
              const utName = (ut.name || '').toLowerCase();
              const utArtist = (ut.artists?.[0]?.name || '').toLowerCase();
              return (utName.includes(gTitle) || gTitle.includes(utName)) && (!gArtist || utArtist.includes(gArtist) || gArtist.includes(utArtist));
            });
            if (inLibrary) return inLibrary;
            const found = await resolveRecommendedTrack(String(gt.title), String(gt.artist || ''));
            if (found) return found;
            return {
              id: `rec-groq-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              name: gt.title,
              artists: [{ id: `art-${gt.artist || 'rec'}`, name: gt.artist || 'Artista' }],
              album: { id: `alb-${Date.now()}`, name: gt.title, images: [] },
              duration_ms: 210000,
              preview_url: null,
            } as Track;
          })
        );
        const matched: Track[] = [];
        for (const match of resolved) {
          if (match && !matched.some((m) => m.name.toLowerCase() === match.name.toLowerCase())) {
            matched.push(match);
          }
        }

        finalSet = [...matched];
        for (const t of hashtagSet) {
          if (finalSet.length >= 15) break;
          if (!finalSet.some((m) => m.id === t.id)) {
            finalSet.push(t);
          }
        }
      }
    }

    if (finalSet.length < 8) {
      finalSet = hashtagSet.length >= 8 ? hashtagSet : (allUserTracks.length > 0 ? allUserTracks.slice(0, 15) : hashtagSet);
    }

    finalSet = filterMusicTracksOnly(finalSet);

    // The DJ always says what is about to play (the local lines did not name the song)
    const first = finalSet[0];
    if (first?.name && !finalSpeech.toLowerCase().includes(first.name.toLowerCase().slice(0, 12))) {
      const art = first.artists?.[0]?.name;
      finalSpeech = isEnglishUI()
        ? `${finalSpeech} Starting with ${first.name}${art ? ` by ${art}` : ''}.`
        : `${finalSpeech} Empezamos con ${first.name}${art ? ` de ${art}` : ''}.`;
    }

    const requestSegment: DJSegment = {
      id: `seg-req-${Date.now()}`,
      kind: 'request',
      title: finalTitle.replace(/^(Sesi[oó]n|Session):\s*/i, '') || (isEnglishUI() ? 'Your request' : 'Tu petición'),
      reason: `lo que ha pedido: ${promptText}`,
      startIndex: 0,
      length: finalSet.length,
      intro: finalSpeech,
    };
    announcedSegments.clear();
    announcedSegments.add(requestSegment.id);
    set({ segments: [requestSegment], activeSegmentId: requestSegment.id, setMode: 'request', isThinking: false });

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
      text: finalSpeech,
      timestamp: djTime,
      curatedSetTitle: finalTitle,
      trackCount: finalSet.length,
    };

    set((state) => ({
      currentMessage: finalSpeech,
      displayedTranscript: '',
      currentSetTitle: finalTitle,
      djThemeColor: finalColor || state.djThemeColor,
      songsPlayedInSet: 0,
      djTracks: finalSet,
      chatHistory: [...state.chatHistory, djMsg],
    }));

    // 4. Start playing the next song right now ducked under the DJ's voice
    const track1 = finalSet[0];
    if (track1) {
      usePlayerStore.getState().playTrack(track1, finalSet, 'dj-session');
      audioEngine.setDuckedVolume(0.12);
    }

    // 5. Speak the personalized charismatic DJ intro cleanly
    get().stopVoiceListening();
    await aiDJVoiceService.speak(finalSpeech, {
      onWord: (_word, partial) => {
        set({ displayedTranscript: partial });
      },
      onVoiceLevel: (level) => {
        set({ voiceLevel: level });
      },
      onEnd: () => {
        // Song is already playing! Smoothly fade volume up to 100%
        audioEngine.restoreDuckedVolume(1200);
        set({
          visualizerState: 'playing',
          voiceLevel: 0,
        });
      },
    });
  },

  /**
   * Called when the 15-track DJ set finishes or reaches the end of queue.
   * Analyzes user playlists and related songs by hashtag, queues 15 new songs, and plays them smoothly.
   */
  handleSetCompletion: async () => {
    const state = get();
    const previousIds = new Set(state.djTracks.map((t) => t.id));
    const cleanName = firstName();

    aiDJVoiceService.stopSpeaking();
    set({ visualizerState: 'idle', songsPlayedInSet: 0, isThinking: true });

    let nextSet: Track[] = [];
    let segments: DJSegment[] = [];
    if (state.setMode === 'personal') {
      // New blocks from the library, skipping what already sounded in this session
      try {
        const built = await buildSegmentedDJSet({ userName: cleanName, exclude: previousIds });
        nextSet = filterMusicTracksOnly(built.tracks);
        segments = built.segments.filter((s) => s.startIndex < nextSet.length);
      } catch {}
    }
    if (nextSet.length < 3) {
      const currentTag = state.currentHashtag || getDominantUserHashtag();
      nextSet = filterMusicTracksOnly(await getCuratedSetForHashtag(currentTag, 15, previousIds));
      const prevTitle = state.segments[0]?.title || state.currentSetTitle || (isEnglishUI() ? 'Your mix' : 'Tu mezcla');
      const speech = pickDynamicSpeech(
        'set_more',
        isEnglishUI()
          ? [
              `More of this coming up. ${nextSet[0]?.name ? `Here's ${nextSet[0].name}.` : ''}`,
              `The music doesn't stop. More ${prevTitle.toLowerCase()} for you.`,
              `Another round? Let's go. ${nextSet[0]?.name ? `Playing ${nextSet[0].name}.` : ''}`,
            ]
          : [
              `Seguimos con más de esto. ${nextSet[0]?.name ? `Ahora ${nextSet[0].name}.` : ''}`,
              `La música no para. Más ${prevTitle.toLowerCase()} para ti.`,
              `¿Otra ronda? Venga. ${nextSet[0]?.name ? `Suena ${nextSet[0].name}.` : ''}`,
            ]
      ).trim();
      segments = nextSet.length
        ? [{ id: `seg-more-${Date.now()}`, kind: state.setMode === 'request' ? 'request' : 'liked', title: prevTitle, reason: 'más del mismo estilo', startIndex: 0, length: nextSet.length, intro: speech }]
        : [];
    }

    announcedSegments.clear();
    if (segments[0]) announcedSegments.add(segments[0].id);
    set({ djTracks: nextSet, segments, activeSegmentId: segments[0]?.id || null, currentSetTitle: segments[0]?.title || state.currentSetTitle, isThinking: false });
    resolveTrackCoversBatch(nextSet).catch(() => {});
    if (state.setMode === 'personal') polishSegmentIntros(segments, nextSet, set as any);

    if (nextSet.length > 0) {
      usePlayerStore.getState().playTrack(nextSet[0], nextSet, 'dj-session');
    }

    const speech = cleanTextForNaturalTTS(segments[0]?.intro || '¡Seguimos!');
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    set((s) => ({
      chatHistory: [
        ...s.chatHistory,
        {
          id: `msg-completion-${Date.now()}`,
          sender: 'dj',
          text: speech,
          timestamp: timeStr,
          curatedSetTitle: segments[0]?.title || 'Sesión en curso',
          trackCount: nextSet.length,
        },
      ],
    }));

    get().stopVoiceListening();
    await djSpeak(speech, set);
  },

  nextSegment: async () => {
    const { djTracks, segments } = get();
    const cur = usePlayerStore.getState().currentTrack;
    const idx = cur ? djTracks.findIndex((t) => t.id === cur.id) : -1;
    const next = segments.find((s) => s.startIndex > idx);
    if (next && djTracks[next.startIndex]) {
      // The track-change watcher presents the block as soon as its first song starts
      usePlayerStore.getState().playTrack(djTracks[next.startIndex], djTracks, 'dj-session');
      return;
    }
    // No more blocks: a brand-new personal set
    set({ setMode: 'personal' });
    await get().handleSetCompletion();
  },

  /**
   * Manual or automatic transition to next set with DJ commentary
   */
  triggerManualTransition: async () => {
    const currentTrack = usePlayerStore.getState().currentTrack;
    const curArtist = currentTrack?.artists?.[0]?.name || '';
    const curTitle = currentTrack?.name || '';
    const nextTrack = usePlayerStore.getState().getNextTrack();

    aiDJVoiceService.stopSpeaking();
    set({
      visualizerState: 'speaking',
      songsPlayedInSet: 0,
    });

    const lang = useLanguageStore.getState().language;
    const isEn = lang === 'en';

    const rawName = useSpotifyDataStore.getState().user?.display_name || '';
    const cleanName = rawName ? rawName.split(' ')[0] : '';
    const userProfile = getUserListeningProfile();

    let transitionText = '';
    try {
      const groqRes = await callGroqDJ({
        action: 'transition',
        currentTrack,
        nextTrack,
        userName: cleanName,
        userProfile,
      });
      if (groqRes && groqRes.speech) {
        transitionText = cleanTextForNaturalTTS(groqRes.speech);
      }
    } catch {}

    if (!transitionText) {
      const transitionPhrases = isEn
        ? [
            `That was ${curTitle}${curArtist ? ` by ${curArtist}` : ''}. Switching it up with the next track. Turn it up!`,
            `What a song! Keeping the energy high with the next one.`,
            `Changing up the rhythm! Here is another track you will love.`,
          ]
        : [
            `Ese fue ${curTitle}${curArtist ? ` de ${curArtist}` : ''}. ¡Cambiamos de ritmo con la siguiente! Súbele.`,
            `¡Qué temazo acabamos de escuchar! Vamos con la siguiente para mantener la fiesta arriba.`,
            `Cambiando de onda. Aquí tienes otro temazo que te va a encantar. ¡Dale play!`,
          ];
      transitionText = transitionPhrases[Math.floor(Math.random() * transitionPhrases.length)];
    }

    set({ currentMessage: transitionText, displayedTranscript: '' });

    // Switch to next track right now ducked under the DJ's voice!
    if (nextTrack) {
      usePlayerStore.getState().playTrack(nextTrack, undefined, 'dj-session');
      audioEngine.setDuckedVolume(0.12);
    }

    get().stopVoiceListening();
    await aiDJVoiceService.speak(transitionText, {
      onWord: (_word, partial) => {
        set({ displayedTranscript: partial });
      },
      onVoiceLevel: (lvl) => {
        set({ voiceLevel: lvl });
      },
      onEnd: () => {
        // Next track is already playing! Smoothly bring volume back up to 100%
        audioEngine.restoreDuckedVolume(1200);
        set({ visualizerState: 'playing', voiceLevel: 0 });
      },
    });
  },
}));

if (typeof window !== 'undefined') {
  (window as any).__useAIDJStore = useAIDJStore;

  // ---------------------------------------------------------------- talk-over timing
  // Like a radio DJ: talk over the instrumental intro and stop before the singer comes in. If the
  // new song's intro is too short but the previous one ends with a long instrumental outro, the
  // DJ talks over that outro instead (just before the block starts).
  const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
  const estimateSpeechMs = (text: string) => Math.round(words(text) * 360 + 700);
  const vocalTimes = async (t: Track): Promise<{ first: number; last: number } | null> => {
    try {
      const res = await Promise.race([
        fetchLyricsUnified(t.name, t.artists?.[0]?.name || '', (t.duration_ms || 0) / 1000),
        new Promise<null>((r) => setTimeout(() => r(null), 2500)),
      ]);
      const synced = (res as any)?.syncedLyrics;
      if (!synced) return null;
      const lines = parseEnhancedLyrics(synced).filter((l) => l.text && l.text.trim());
      if (!lines.length) return null;
      return { first: lines[0].timeMs, last: lines[lines.length - 1].timeMs };
    } catch {
      return null;
    }
  };

  const announceBlock = (seg: DJSegment) => {
    const text = cleanTextForNaturalTTS(seg.intro);
    const t = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    useAIDJStore.setState((s) => ({
      chatHistory: [...s.chatHistory, { id: `msg-seg-${Date.now()}`, sender: 'dj', text, timestamp: t, curatedSetTitle: seg.title, trackCount: seg.length }],
    }));
    void djSpeak(text, useAIDJStore.setState);
  };

  let outroTimer: number | undefined;

  usePlayerStore.subscribe((state, prev) => {
    if (!state.currentTrack || state.currentTrack.id === prev.currentTrack?.id) return;
    window.clearTimeout(outroTimer);
    const dj = useAIDJStore.getState();
    if (!dj.isDJModeActive || state.currentContextId !== 'dj-session' || dj.segments.length === 0) return;
    const current = state.currentTrack;
    const idx = dj.djTracks.findIndex((t) => t.id === current.id);
    if (idx < 0) return;
    const seg = segmentAt(dj.segments, idx);
    if (!seg) return;
    if (seg.id !== dj.activeSegmentId) {
      useAIDJStore.setState({ activeSegmentId: seg.id, currentSetTitle: seg.title, songsPlayedInSet: 0 });
    }

    // The next song opens a block: maybe present it over this song's instrumental outro
    const nextSeg = dj.segments.find((s) => s.startIndex === idx + 1);
    const nextTrack = dj.djTracks[idx + 1];
    if (nextSeg && nextTrack && !announcedSegments.has(nextSeg.id)) {
      void (async () => {
        const [here, there] = await Promise.all([vocalTimes(current), vocalTimes(nextTrack)]);
        const need = estimateSpeechMs(nextSeg.intro);
        const nextIntro = there ? there.first : 0;
        if (!here || nextIntro >= need + 800) return; // the next intro is long enough: talk there
        const dur = state.durationMs || current.duration_ms || 0;
        const outroStart = here.last + 4500; // the last sung line, plus a few seconds to finish it
        const crossfadeMs = 8000;
        const startAt = Math.max(outroStart, dur - crossfadeMs - need - 1000);
        if (dur <= 0 || startAt + need > dur - 1000) return; // no room in the outro either
        const wait = startAt - (usePlayerStore.getState().progressMs || 0);
        if (wait < 0) return;
        outroTimer = window.setTimeout(() => {
          const p = usePlayerStore.getState();
          const d = useAIDJStore.getState();
          if (!p.isPlaying || p.currentTrack?.id !== current.id || !d.isDJModeActive || d.isThinking) return;
          if (announcedSegments.has(nextSeg.id) || aiDJVoiceService.getIsSpeaking()) return;
          announcedSegments.add(nextSeg.id);
          announceBlock(nextSeg);
        }, wait);
      })();
    }

    if (seg.startIndex !== idx || announcedSegments.has(seg.id)) return;
    announcedSegments.add(seg.id);
    if (dj.isThinking) return;
    // A new block always wins: if the DJ was still talking, it cuts itself off and presents it
    if (aiDJVoiceService.getIsSpeaking()) aiDJVoiceService.stopSpeaking();
    // Over the intro: as soon as the new song is on (not on the previous one's crossfade tail),
    // earlier when the singer comes in soon
    void vocalTimes(current).then((v) => {
      const need = estimateSpeechMs(seg.intro);
      const delay = v && v.first > 0 && v.first < need + 1800 ? 300 : 1200;
      window.setTimeout(() => {
        if (usePlayerStore.getState().currentTrack?.id !== current.id) return;
        announceBlock(seg);
      }, delay);
    });
  });
}
