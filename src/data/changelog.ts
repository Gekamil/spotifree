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

export const APP_VERSION = '0.2.0';

export const CHANGELOG_RELEASES: ChangelogRelease[] = [
  {
    version: '0.2.0',
    date: '10 de noviembre, 2026',
    title: 'Tocadiscos, estadísticas y escuchar con amigos',
    isLatest: true,
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
