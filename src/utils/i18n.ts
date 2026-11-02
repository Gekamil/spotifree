import { create } from 'zustand';

export type Language = 'es' | 'en';

export const TRANSLATIONS = {
  es: {
    // Navigation
    home: 'Inicio',
    search: 'Buscar',
    library: 'Tu biblioteca',
    create: 'Crear',
    recents: 'Recientes',
    playlists: 'Playlists',
    artists: 'Artistas',
    albums: 'Álbumes',
    downloaded: 'Descargas',
    downloads: 'Descargado',
    settings: 'Configuración',
    profile: 'Perfil',
    logout: 'Cerrar sesión',
    login: 'Iniciar sesión',
    back: 'Atrás',
    all: 'Todo',
    music: 'Música',

    // Library
    likedSongs: 'Canciones que te gustan',
    likedSongsSubtitle: 'Playlist • {count} canciones',
    playlist: 'Playlist',
    artist: 'Artista',
    album: 'Álbum',
    folder: 'Carpeta',
    searchInLibrary: 'Buscar en tu biblioteca',
    addToLibrary: 'Añadir a tu biblioteca',
    importMusicTitle: 'Importa tu música desde otras aplicaciones',
    importMusicSubtitle: 'Trae tus listas, canciones y artistas.',
    importLibraryBtn: 'Importar biblioteca',
    deleteFromLibrary: 'Eliminar de tu biblioteca',
    editPlaylist: 'Editar playlist',
    share: 'Compartir',
    confirmDelete: '¿Seguro que quieres eliminar esta lista?',
    deletedFromLibraryToast: 'Se ha eliminado de tu biblioteca',

    // DJ & Player
    djTitle: 'DJ',
    djMadeForYou: 'Playlist • Hecho para ti',
    djQueue: 'Cola del DJ',
    djSessionLive: 'Sesión en vivo',
    djQueueSongs: 'Cola del DJ • {count} canciones',
    djListening: 'Escuchando...',
    djVoiceSelectorTitle: 'Voz de la Inteligencia Artificial (DJ)',
    djVoiceSelectorSubtitle: 'Elige la personalidad y el modelo de voz que utilizará tu DJ personal para presentar tus sesiones.',
    testVoice: 'Probar voz',
    speaking: 'Hablando...',
    askDJPlaceholder: 'Pídeme lo que quieras escuchar: géneros, estados de ánimo o artistas.',
    djThinking: 'Sintonizando el ritmo...',
    nowPlaying: 'Sonando',
    queue: 'Cola',
    lyrics: 'Letras',
    officialVideo: 'Vídeo oficial',

    // Settings
    languageTitle: 'Idioma',
    languageSubtitle: 'Selecciona tu idioma preferido para la interfaz.',
    storageTitle: 'Almacenamiento y Caché',
    storageSubtitle: 'Caché de canciones y portadas guardadas.',
    clearCache: 'Borrar caché',
    cacheCleared: '¡Caché borrada!',
    playbackTitle: 'Reproducción',
    normalizeVolume: 'Normalizar el volumen',
    normalizeVolumeSubtitle: 'Establece el mismo nivel sonoro para todas las canciones.',
    gaplessPlayback: 'Reproducción sin pausas',
    gaplessSubtitle: 'Transición continua sin silencios entre pistas.',
    crossfade: 'Fundido entre canciones',
    equalizer: 'Ecualizador de audio',
    musicVideos: 'Vídeos musicales',
    canvas: 'Canvas',
  },
  en: {
    // Navigation
    home: 'Home',
    search: 'Search',
    library: 'Your Library',
    create: 'Create',
    recents: 'Recents',
    playlists: 'Playlists',
    artists: 'Artists',
    albums: 'Albums',
    downloaded: 'Downloaded',
    downloads: 'Downloads',
    settings: 'Settings',
    profile: 'Profile',
    logout: 'Log out',
    login: 'Log in',
    back: 'Back',
    all: 'All',
    music: 'Music',

    // Library
    likedSongs: 'Liked Songs',
    likedSongsSubtitle: 'Playlist • {count} songs',
    playlist: 'Playlist',
    artist: 'Artist',
    album: 'Album',
    folder: 'Folder',
    searchInLibrary: 'Search in Your Library',
    addToLibrary: 'Add to Your Library',
    importMusicTitle: 'Import your music from other apps',
    importMusicSubtitle: 'Bring your playlists, tracks and artists.',
    importLibraryBtn: 'Import library',
    deleteFromLibrary: 'Remove from Your Library',
    editPlaylist: 'Edit playlist',
    share: 'Share',
    confirmDelete: 'Are you sure you want to delete this playlist?',
    deletedFromLibraryToast: 'Removed from Your Library',

    // DJ & Player
    djTitle: 'DJ',
    djMadeForYou: 'Playlist • Made for you',
    djQueue: 'DJ Queue',
    djSessionLive: 'Live session',
    djQueueSongs: 'DJ Queue • {count} songs',
    djListening: 'Listening...',
    djVoiceSelectorTitle: 'AI DJ Voice',
    djVoiceSelectorSubtitle: 'Choose the personality and voice model your personal DJ will use to introduce your sessions.',
    testVoice: 'Test voice',
    speaking: 'Speaking...',
    askDJPlaceholder: 'Ask me what you want to hear: genres, moods, or artists.',
    djThinking: 'Tuning the mix...',
    nowPlaying: 'Now Playing',
    queue: 'Queue',
    lyrics: 'Lyrics',
    officialVideo: 'Official video',

    // Settings
    languageTitle: 'Language',
    languageSubtitle: 'Choose your preferred language for the interface.',
    storageTitle: 'Storage & Cache',
    storageSubtitle: 'Cached songs and offline album artwork.',
    clearCache: 'Clear cache',
    cacheCleared: 'Cache cleared!',
    playbackTitle: 'Playback',
    normalizeVolume: 'Normalize volume',
    normalizeVolumeSubtitle: 'Sets the same volume level for all tracks.',
    gaplessPlayback: 'Gapless playback',
    gaplessSubtitle: 'Continuous transition without silence between tracks.',
    crossfade: 'Crossfade',
    equalizer: 'Audio equalizer',
    musicVideos: 'Music videos',
    canvas: 'Canvas',
  },
} as const;

export type TranslationKey = keyof typeof TRANSLATIONS.es;

interface LanguageStore {
  language: Language;
  setLanguage: (lang: Language) => void;
}

export const useLanguageStore = create<LanguageStore>((set) => {
  let initial: Language = 'es';
  if (typeof window !== 'undefined') {
    try {
      const saved = window.localStorage.getItem('spotifree_language');
      if (saved === 'en' || saved === 'es') initial = saved;
      else if (saved && saved.startsWith('en')) initial = 'en';
    } catch {}
  }
  return {
    language: initial,
    setLanguage: (lang) => {
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem('spotifree_language', lang);
        } catch {}
      }
      set({ language: lang });
    },
  };
});

export function t(key: TranslationKey, params?: Record<string, string | number>): string {
  const lang = useLanguageStore.getState().language;
  let text: string = (TRANSLATIONS[lang] as any)?.[key] || (TRANSLATIONS.es as any)[key] || key;
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    });
  }
  return text;
}
