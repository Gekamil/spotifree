/**
 * Spotifree Version History & Changelog Data
 * Used in "Acerca de la aplicación" in Settings (Mobile & Desktop).
 */

export interface ChangelogRelease {
  version: string;
  date: string;
  title: string;
  isLatest?: boolean;
  highlights: string[];
}

export const APP_VERSION = '0.2.7';

export const CHANGELOG_RELEASES: ChangelogRelease[] = [
  {
    version: '0.2.7',
    date: '12 de noviembre, 2026',
    title: 'Modo Labs: velocidad y tono, audio espacial 3D / mono y valoraciones Like/Dislike estilo Amazon Music',
    isLatest: true,
    highlights: [
      'Modo Labs (Spotifree Labs): nuevo interruptor maestro en Ajustes avanzados que desbloquea funciones experimentales de audio y reproducción.',
      'Control de velocidad y tono al vuelo (0.50x – 2.00x): modifica el ritmo desde el menú de 3 puntos o la barra de reproducción (efecto slowed o nightcore) con interruptor de conservación de tono original.',
      'Audio mono y balance espacial 3D: conmuta entre audio mono completo o posiciona el sonido en un cuadrante táctil interactivo (delante/detrás, izquierda/derecha) para auriculares.',
      'Sistema de valoraciones Like / Dislike (estilo Amazon Music): botones 👍 y 👎 para afinar gustos; las canciones con dislike se saltan al instante y quedan bloqueadas de listas, aleatorio y Android Auto.',
    ],
  },
  {
    version: '0.2.6',
    date: '12 de noviembre, 2026',
    title: 'Fundidos limpios, fotos de artistas corregidas y búsqueda mucho más rápida',
    highlights: [
      'Fundido estándar (crossfade) limpio y fiel a la duración configurada (3s, 6s, 12s...): en modo normal ya no aplica cortes de graves de DJ ni doble atenuación sobre el deck de salida, y pre-carga el deck HTML5 secundario para evitar retrasos al inicio de fundidos cortos.',
      'Fotos de artistas corregidas en el selector de gustos y artistas relacionados: resolución paralela de retratos reales, recuperación automática ante URLs antiguas de CDN y soporte `no-referrer`.',
      'Búsqueda progresiva mucho más rápida: resultados locales al instante (0 ms), caché en memoria, vía rápida `?fast=1` en paralelo sin esperar SoundCloud/enriquecimiento lento, debounce reducido a 130 ms y cancelación automática con AbortController.',
    ],
  },
  {
    version: '0.2.5',
    date: '12 de noviembre, 2026',
    title: 'Búsqueda completa en Android Auto (autores, álbumes y listas) y diseño mejorado en el coche',
    highlights: [
      'Autores/Artistas, Álbumes y Playlists en las búsquedas de Android Auto: ahora al buscar en el coche aparecen los artistas con su catálogo de temas principales y aleatorio, álbumes, playlists y canciones agrupados.',
      'Tema oficial verde Spotify (#1ED760) en Android Auto (SpotifreeCarTheme), resaltado de tema activo en listas e insignia nativa de descargas sin conexión.',
      'Diseño mixto por secciones (rejilla visual para tarjetas y filas compactas para canciones) para navegar más rápido conduciendo.',
    ],
  },
  {
    version: '0.2.4',
    date: '12 de noviembre, 2026',
    title: 'Pestaña Recientes en Android Auto y widgets rediseñados con fondo difuminado y giro fluido',
    highlights: [
      'Nueva pestaña «Recientes» en Android Auto: muestra únicamente tus playlists, álbumes y canciones escuchadas hace poco, sin mezclar recomendaciones.',
      'Ambos widgets rediseñados (Reproductor y Tocadiscos): fondo real con la carátula difuminada, gradiente dinámico de doble tono, borde cristalino, barra de progreso y temporizador en vivo.',
      'Tocadiscos fluido a 60 FPS: eliminada la rotación a saltos del ViewFlipper por un plato vinilo con surcos y reflejo óptico girando suavemente en el launcher y etiqueta nítida en HD.',
    ],
  },
  {
    version: '0.2.3',
    date: '11 de noviembre, 2026',
    title: 'Selector de salida de audio en móvil y APK, carátulas en play directo y mejoras en búsquedas',
    highlights: [
      'Selector de dispositivo y salida de audio en móvil y Android APK: pulsa el icono de dispositivos en el minirreproductor o «Este teléfono» en el reproductor para elegir altavoz, auriculares, Bluetooth o abrir «Escuchar juntos» con el mismo diseño que ordenador.',
      'Plugin nativo Android (SpotifreeAudioOutput): detección en tiempo real de altavoces, cable y Bluetooth en la app Android con acceso directo al panel de salida de medios del sistema.',
      'Carátulas siempre visibles en el reproductor lateral de ordenador: al reproducir directamente desde Inicio o búsquedas, las portadas de «Sonando ahora» y la cola se resuelven automáticamente sin quedarse vacías.',
      'Pulido de álbumes, remixes y añadir a playlist: años reales en resultados de álbumes, actualización completa de cabecera de álbumes en móvil y guardado persistente al crear playlists desde el modal.',
    ],
  },
  {
    version: '0.2.2',
    date: '11 de noviembre, 2026',
    title: 'Remixes oficiales en búsquedas, pestaña de álbumes, creación de playlist al añadir y prevención de autoguardado',
    highlights: [
      'Remixes oficiales primero: en la pestaña de remixes de búsqueda ahora aparecen primero los remixes oficiales de catálogo antes que temas de SoundCloud o filtraciones.',
      'Nuevo apartado de Álbumes en búsquedas: pestaña dedicada a álbumes en ordenador y móvil igual que en Spotify, con navegación a lista completa de canciones.',
      'Crear playlist al añadir canción: al pulsar la opción inferior de crear nueva playlist en el modal de añadir, la playlist se crea con la canción y se guarda de forma persistente en tu biblioteca.',
      'Control de guardado en biblioteca: visualizar o abrir playlists buscadas y recomendadas ya no las autoguarda en tu biblioteca a menos que decidas guardarlas explícitamente.',
    ],
  },
  {
    version: '0.2.1',
    date: '11 de noviembre, 2026',
    title: 'Aro del DJ interactivo, chat con la IA, filtrado de remixes y widgets animados',
    highlights: [
      'Aro de la IA perfeccionado: se hunde y rebota de forma orgánica solo en la zona donde habla, con 1 aro unificado en reposo.',
      'Interacción directa con la IA DJ: ahora puedes pedirle estilos (reggaeton, lofi, rock) o canciones similares mediante voz o texto sin pantallas bloqueadas.',
      'Filtrado de remixes y leaks en artistas: el botón ahora filtra las canciones directamente en la misma vista sin cambiar de pestaña y sin adornos innecesarios.',
      'Velocidad de reproducción de temas SoundCloud/leaks acelerada con descargas paralelas de segmentos HLS y caché extendida.',
      'Widgets mejorados: fondos con la carátula difuminada, animaciones de ondas de audio y letras sincronizadas adaptables a cualquier tamaño.',
      'Eliminación de la API de ElevenLabs, optimizando la voz con Edge Neural sin claves ni cuotas externas.',
    ],
  },
  {
    version: '0.2.0',
    date: '10 de noviembre, 2026',
    title: 'Tocadiscos, estadísticas y escuchar con amigos',
    highlights: [
      'Nuevo widget «Tocadiscos» para la pantalla de inicio: el vinilo gira con la canción que suena, con su portada en la etiqueta, y el brazo baja al darle a reproducir.',
      'Estadísticas de escucha rediseñadas: minutos de la semana comparados con la anterior, gráfico de los últimos 7 días, a qué horas escuchas y tus artistas y canciones más escuchados. El tiempo escuchado ya se cuenta bien.',
      'Ajustes › Escuchar juntos: los amigos que están escuchando contigo, con su foto, y con los que has escuchado antes.',
      'El panel lateral del perfil ya se cierra bien y todos sus botones funcionan.',
      '«Novedades de la app» sustituye a «Tus avisos» y muestra qué cambia en cada versión.',
      'Ordenar y ver la biblioteca con el mismo diseño que Spotify, en móvil y ordenador.',
      'La tarjeta de «Tu DJ personal» vuelve a tener el texto y el botón abajo, y la pantalla del DJ va más fluida.',
      'Portadas que no cargaban arregladas y artistas de ejemplo sustituidos por los tuyos de verdad.',
    ],
  },
  {
    version: '0.1.3',
    date: '9 de Noviembre, 2026',
    title: 'Coche y Android Auto perfeccionados',
    highlights: [
      'Iconos superiores oficiales de Spotify (Inicio, Tu biblioteca, Explorar y Cola) cargados de forma instantánea mediante bitmaps directos en memoria.',
      'Soporte completo para reproducción aleatoria en listas de reproducción con el icono oficial de shuffle en la cabecera.',
      'Carátulas de alta definición garantizadas en cualquier salpicadero (Android Auto, Bluetooth AVRCP, Apple CarPlay bridge y pantallas integradas de vehículos).',
      'Puntos indicadores verdes (#1ed760) auténticos en controles activos de aleatorio y repetición.',
      'Mejoras en la extracción de portadas con movimiento de Apple Music con búsqueda internacional (catálogos España y Global/EE.UU.).',
    ],
  },
  {
    version: '0.1.2',
    date: '9 de Noviembre, 2026',
    title: 'Biblioteca móvil avanzada y cuadrícula visual',
    highlights: [
      'Barra de herramientas móvil con el icono oficial de ordenación Spotify (< | > rotado 90° / ↑↓) y menú inferior desplegable ("Ordenar por").',
      'Criterios de ordenación: Recientes, Añadidos recientemente, Alfabético y Creador.',
      'Selector de visualización en móvil ("Ver como"): Cuadrícula de 2 columnas con carátulas gigantes, Lista estándar y Compacto.',
      'Ajuste del tamaño de carátulas en modo lista a 56px (w-14 h-14) idéntico a la app nativa de Spotify.',
    ],
  },
  {
    version: '0.1.1',
    date: '8 de Noviembre, 2026',
    title: 'Descargas sin conexión y carpetas locales',
    highlights: [
      'Descargas offline reales: guardado en CacheStorage y OPFS para escuchar en Modo Avión sin conexión a Internet.',
      'Proxy de streaming con cabeceras CORS para eliminar bloqueos de descarga en navegadores y móvil.',
      'Sistema de subcarpetas en "Descargas y Archivos locales": organización separada entre audios del dispositivo y descargas de Spotifree.',
      'Acción para crear nuevas subcarpetas ("Gimnasio", "Carretera"...) y mover canciones entre ellas desde el menú contextual.',
    ],
  },
  {
    version: '0.1.0',
    date: '7 de Noviembre, 2026',
    title: 'Lanzamiento Inicial & Motor de DJ Inteligente',
    highlights: [
      'Modo DJ inteligente con rueda Camelot, análisis de BPM, compases y transiciones armónicas mediante Web Audio DSP.',
      'Sincronización nativa en segundo plano para reproducción continua con la pantalla bloqueada en Android.',
      'Ecualizador completo con presets acústicos y simulación de altavoz.',
      'Diseño visual 1:1 basado en la interfaz oficial de Spotify.',
    ],
  },
];
