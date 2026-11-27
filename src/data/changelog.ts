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

export const APP_VERSION = '1.7.1';

export const CHANGELOG_RELEASES: ChangelogRelease[] = [
  {
    version: '1.7.1',
    date: '28 de noviembre, 2026',
    title: 'Spotifree 1.7.1: Menu de tres puntos en artistas, descargas predeterminadas en dispositivo, seleccion multiple y correccion de aleatorio en descargadas',
    isLatest: true,
    highlights: [
      'Boton de 3 puntitos y menu de opciones en perfiles de artistas: tanto en la barra de acciones de escritorio como en movil, los artistas cuentan con menu de 3 puntos con acciones exclusivas para seguir/dejar de seguir, anadir sus temas destacados a la cola, ir a su radio y copiar su enlace.',
      'Descargas predeterminadas en el dispositivo: las canciones descargadas ahora se guardan por defecto en la carpeta del dispositivo y se escriben directamente en el almacenamiento fisico del movil (Music/Spotifree) sin pasos intermedios.',
      'Seleccion multiple y movimiento por lotes entre carpetas: anadido modo de seleccion con casillas para mover multiples canciones a cualquier carpeta de una sola vez, o guardarlas en bloque en el dispositivo.',
      'Correccion de aleatorio en lista de descargadas: al pulsar el boton de aleatorio en "Descargas y Archivos locales", el reproductor ya no resetea la lista a la pista 0, sino que conmuta limpiamente entre los modos de aleatorio (normal, inteligente y desactivado) manteniendo la reproduccion en curso.',
    ],
  },
  {
    version: '1.7',
    date: '27 de noviembre, 2026',
    title: 'Spotifree 1.7: Eliminacion de previews de 30s en SoundCloud, transiciones fluidas y restauracion de cola en aleatorio inteligente',
    isLatest: false,
    highlights: [
      'Eliminacion definitiva de snippets de 30 segundos en canciones de SoundCloud: se detectan y descartan los previews recortados de 30 segundos de SoundCloud tanto en el servidor como en el reproductor de audio, asegurando siempre la pista completa de estudio.',
      'Resolucion y transiciones ultrarrapidas en SoundCloud: optimizado el montaje de HLS fMP4 y aprovechada la precarga en el reproductor inactivo para que cambiar entre canciones de SoundCloud sea instantaneo y sin demoras de 4 segundos.',
      'Prioridad de catalogo Spotifree: si una cancion de SoundCloud existe en nuestro catalogo nativo, se reproduce directamente la version oficial de alta fidelidad sin esperas.',
      'Restauracion limpia de la cola al desactivar el aleatorio inteligente: al apagar el aleatorio inteligente (modo normal), se eliminan todas las canciones recomendadas y se recupera el orden y la lista original exacta de la playlist sin temas residuales.',
      'Deteccion automatica de idioma y pais: la interfaz detecta la ubicacion y zona horaria del usuario para mostrar todo en espanol o ingles de forma nativa.',
      'Fraseo abierto de inicio de sesion: interfaz clarificada para registrarse o iniciar sesion directamente con Spotifree tanto en web como en movil.',
    ],
  },
  {
    version: '1.6.1',
    date: '27 de noviembre, 2026',
    title: 'Spotifree 1.6.1: Correccion de carga y reproduccion en playlists de cantantes y aislamiento de musica descargada',
    isLatest: false,
    highlights: [
      'Carga y reproduccion inmediata de playlists de artistas en ordenador: eliminada la condicion que bloqueaba el boton de reproducir con el aviso de cargando canciones cuando la lista ya tiene temas listos o cuando se trata de un mix de artista.',
      'Reproduccion pendiente automatica: si pulsas reproducir mientras se cargan los temas de un cantante o lista, se inicia la reproduccion automaticamente en cuanto termina de cargar sin requerir pulsar de nuevo.',
      'Aislamiento de musica descargada: la reproduccion offline almacenada solo se activa cuando te encuentras en la playlist de canciones descargadas o en modo avion sin conexion; el resto de playlists y perfiles de artistas se reproducen via streaming normal sin conflictos entre cuentas.',
      'Boton de reproduccion rapida en tarjetas de artistas: pulsar el boton de reproducir sobre la tarjeta de un cantante en la pantalla de inicio de escritorio reproduce sus canciones directamente.',
      'Prioridad de mixes Spotifree frente a perfiles de artista: las listas con formato sf- se cargan de inmediato sin busquedas redundantes ni bloqueos de estado.',
    ],
  },
  {
    version: '1.6',
    date: '27 de noviembre, 2026',
    title: 'Spotifree 1.6: Compartir e importar playlists con vista previa, sincronizacion cloud de estadisticas, recuperacion de llamadas y rotacion dinamica',
    isLatest: false,
    highlights: [
      'Ventana de vista previa e importacion al compartir playlists: al abrir cualquier enlace compartido (?playlist=, ?collab= o ?share=) aparece un modal con portada, creador y canciones para aceptar e importar a tu biblioteca o solo abrir.',
      'Reanudacion automatica tras llamadas en coche y movil: si entra una llamada conduciendo o usando auriculares, la musica se pausa limpiamente y se reanuda sola al terminar la llamada sin quedarse silenciada para siempre.',
      'Sincronizacion bidireccional de tiempo de escucha y artistas en Firestore: tus horas escuchadas, canciones reproducidas y artistas del APK y la web se combinan en la nube para alimentar las recomendaciones y el perfil sin perder datos ni sobreescribir con ceros.',
      'Inicio pausado en escritorio al cambiar de dispositivo: al abrir la app en ordenador se restaura tu sesion y cancion pero permanece en pausa hasta que tu decidas darle al play.',
      'Listas de exitos y Top 50 dinamicas cada dia: Top 50 Espana, Top 50 Global y Novedades se nutren de listas reales actualizadas a diario en vez de canciones estaticas.',
      'Portada clasica Radio de 3 circulos y variedad visual: anadido el diseno azul clasico de Radio de Spotify con 3 circulos superpuestos, logos y estilos vinilo y editorial.',
      'Rotacion diaria de artistas y estantes: la fila de Tus artistas, en mix rota de artistas cada dia segun tus gustos y biblioteca, y la pantalla de inicio alterna estantes de animo, epocas y generos para no verse nunca igual.',
      'Nueva seccion Inspiradas en tus playlists: recomendaciones inteligentes generadas a partir de las listas creadas y guardadas por cada usuario.',
    ],
  },
  {
    version: '1.5',
    date: '27 de noviembre, 2026',
    title: 'Spotifree 1.5: Prioridad al catálogo propio en listas importadas y arranque instantáneo en SoundCloud',
    isLatest: false,
    highlights: [
      'Detección automática global en importación, búsqueda y reproductor: si una canción de SoundCloud o lista externa ya existe en Spotifree (sin alterar remixes, slowed o inéditas exclusivas), se reproduce directamente con nuestro catálogo nativo sin extraer de SoundCloud.',
      'Inicio ultrarrápido de canciones exclusivas de SoundCloud (especialmente en APK): fragmento inicial compacto de streaming, búsqueda paralela de cliente y omisión de sondeos CDN redundantes.',
      'Sesión SoundCloud activa bajo demanda y sostenible: precarga y preparación anticipada del siguiente tema con mantenimiento ligero temporal durante la reproducción de SoundCloud, sin afectar batería ni datos en la reproducción normal.',
    ],
  },
  {
    version: '1.4',
    date: '26 de noviembre, 2026',
    title: 'Spotifree 1.4: Reproducción fluida en SoundCloud y listas importadas, saltos al avanzar sin cortes y cero solapamientos',
    isLatest: false,
    highlights: [
      'Playlists importadas y de SoundCloud sin canciones mudas: envío completo de metadatos de respaldo, soporte ampliado para mezclas HLS largas y pistas cortas, y salto automático limpio si una pista no está disponible.',
      'Avance y arrastre de barra fluidos en todo momento: eliminados los parones totales al adelantar o rebobinar en streams HTML5 y móviles (seek confirmado al soltar y Range consistente en el servidor).',
      'Karaoke y dislike aún más estrictos: silenciado total entre motores (YouTube y HTML5) para que nunca vuelvan a sonar dos pistas a la vez al cambiar de canción o activar «Sin voces».',
      'Crossfade protegido contra errores de duración y anuncios cortos para evitar inicios anticipados del siguiente tema.',
    ],
  },
  {
    version: '1.3',
    date: '26 de noviembre, 2026',
    title: 'Spotifree 1.3: Nunca suenan dos canciones a la vez y playlists de SoundCloud más rápidas',
    isLatest: false,
    highlights: [
      'Al dar «No me gusta» o saltar de canción se detienen todos los reproductores internos, así que la canción anterior ya no sigue sonando por debajo de la nueva.',
      'Protección continua contra solapamientos: si un reproductor sobrante empieza a sonar (precarga o transición interrumpida), se silencia al instante.',
      'Karaoke: al quitar el modo «Sin voces» deja de sonar la pista instrumental, sin mezclar las versiones con y sin voz.',
      'Playlists importadas de SoundCloud más rápidas: cada canción ya no descarga en paralelo una versión karaoke que no se ha pedido, y las canciones repetidas se reproducen directamente desde SoundCloud.',
      'Versiones anteriores del APK conservadas en GitHub Releases.',
    ],
  },
  {
    version: '1.2',
    date: '25 de noviembre, 2026',
    title: 'Spotifree 1.2: Perfiles de artista con discografía completa, álbumes fiables y guardado persistente en APK',
    isLatest: false,
    highlights: [
      'Perfiles de artista completos en móvil y ordenador: añade Títulos populares y Discografía con filtros (Álbumes, Sencillos y EP, Recopilatorios), vista completa «Ver discografía», «Listas del artista» / «Incluye a...», biografía verificada y botón «Ver más» en canciones populares manteniendo todos los botones existentes.',
      'Álbumes siempre cargados desde cualquier canción: nueva resolución multiorigen para que entrar en un álbum desde el reproductor, tabla o menú móvil muestre siempre todas sus canciones.',
      'Guardado persistente en Android (APK): las playlists guardadas en Tu biblioteca se conservan tras cerrar y reabrir la app con almacenamiento optimizado y sincronización segura.',
      'Rendimiento web limpio: integración de Vercel Web Analytics y eliminación del sondeo innecesario a localhost en reposo sin afectar a Discord Rich Presence.',
    ],
  },
  {
    version: '1.1',
    date: '25 de noviembre, 2026',
    title: 'Spotifree 1.1: Aislamiento completo multicuenta, historial y recomendaciones independientes y eliminación de audio fantasma',
    isLatest: false,
    highlights: [
      'Aislamiento estricto multicuenta: búsquedas recientes, perfil de gustos (taste), recomendaciones, artistas sugeridos y estadísticas de escucha 100% independientes y únicos para cada cuenta en el mismo dispositivo.',
      'Eliminación de audio fantasma: cierre y parada sincronizada del motor de audio al cerrar sesión o cambiar de cuenta, evitando reproducciones residuales o colas cruzadas.',
      'Persistencia de reproducción local aislada: las sesiones de escucha guardadas se asocian de forma segura al UID del usuario activo, previniendo fugas entre diferentes cuentas en el mismo navegador.',
      'Cierre de sesión integral: desconexión completa y coordinada en móvil y escritorio con reseteo de almacenamiento en caché, perfiles y colas de reproducción.',
    ],
  },
  {
    version: '1.0',
    date: '24 de noviembre, 2026',
    title: 'Spotifree 1.0: Lanzamiento oficial con continuidad multidispositivo, Android Auto diferenciado, Modo DJ refinado y sección de Créditos',
    isLatest: false,
    highlights: [
      'Continuidad de reproducción entre móvil, coche y ordenador: al pausar o cambiar de dispositivo con la misma cuenta, Spotifree retoma la playlist, canción, segundo exacto y las canciones añadidas por el Aleatorio inteligente.',
      'Android Auto mejorado: iconos visuales diferenciados para aleatorio desactivado, aleatorio normal (con punto inferior) y aleatorio inteligente (con destello), además de carátulas fiables.',
      'Modo DJ perfeccionado: transiciones suaves y progresivas sin cortes bruscos, extracción garantizada de carátulas y pistas al avanzar canciones, y recomendaciones más fieles a tus gustos reales.',
      'Nueva pestaña de Créditos en Acerca de con la información del proyecto, autor y repositorio oficial en GitHub.',
    ],
  },
  {
    version: '0.5.3',
    date: '20 de noviembre, 2026',
    title: 'Spotifree 0.5.3: Transición instantánea de karaoke (0ms de silencio), biblioteca móvil con espaciado nativo Spotify y carátulas fotográficas en playlists temáticas',
    isLatest: false,
    highlights: [
      'Transición instantánea de karaoke sin pausas (0ms de silencio): el reproductor secundario precarga la pista instrumental en segundo plano y realiza un crossfade gapless sin interrupción audible al alternar el modo karaoke o ajustar la voz.',
      'Biblioteca móvil rediseñada con espaciado nativo de Spotify: eliminación de paddings excesivos, fila de filtros horizontales deslizables con botón de limpieza, carátulas compactas de 48x48px y tipografía ajustada idéntica a la app oficial.',
      'Separación de «Viaje en el tiempo» y «Playlists genéricas»: los grandes géneros (Rock, Pop, Urbano, EDM, Indie, Hip-Hop) ahora tienen su propio carrusel independiente («GRANDES GÉNEROS»), separándolos limpiamente de las décadas (80s, 90s, 2000s, 2010s).',
      'Carátulas con fotos reales de canciones: integración con proxy de imágenes seguro y composiciones enriquecidas que muestran las portadas de los artistas y canciones detrás de las tipografías y degradados temáticos.',
    ],
  },
  {
    version: '0.5.2',
    date: '20 de noviembre, 2026',
    title: 'Spotifree 0.5.2: Motor de recomendaciones armónicas, control vertical de karaoke estilo Spotify, controles móviles sin recortes y detector acústico instantáneo',
    isLatest: false,
    highlights: [
      'Motor de recomendaciones ampliado a 14 géneros: taxonomía ampliada con más de 350 artistas contemporáneos y canciones insignia (#indie, #corridos, #rnb, #trap, #reggaeton, #rock, etc.). En modo aleatorio inteligente, las canciones recomendadas son armónicamente compatibles y de artistas complementarios, con distintivo «✨ Recomendado» en cola.',
      'Control de volumen vocal de karaoke estilo Spotify: barra vertical lateral deslizante al pulsar el icono de karaoke con lectura numérica de porcentaje (0% a 100%), permitiendo atenuar la voz del cantante con diseño nativo y fluido.',
      'Controles en pantalla completa de letra adaptados al límite del móvil: ajuste seguro con viewport dinámico (100dvh) y área segura (safe-area-inset-bottom), incorporando controles completos de reproducción (anterior, pausar/reanudar, siguiente) perfectamente accesibles sin cortes.',
      'Detector de audio y letra sin falsos saltos: tolerancia refinada en duraciones e intros de videoclips oficiales y pistas Topic de YouTube Music, evitando descartar la canción correcta.',
      'Cambio instantáneo y silenciamiento previo: eliminación de la espera de 1.5s y silenciamiento automático a volumen cero al detectar desajustes para que el usuario nunca escuche fragmentos de canciones erróneas.',
    ],
  },
  {
    version: '0.5.1',
    date: '19 de noviembre, 2026',
    title: 'Spotifree 0.5.1: Búsqueda estricta de artistas, modo aleatorio musical inteligente y recuperación total de Android Auto',
    isLatest: false,
    highlights: [
      'Búsqueda estricta de artistas: eliminación total de colisiones y filtraciones por subcadenas. Al añadir o buscar un artista (ej. «Vibra Eterna»), no se mezclan canciones de otros artistas con nombres similares (ej. «Eterna»).',
      'Modo aleatorio inteligente por estilo y género musical: el modo aleatorio inteligente añade temas del mismo estilo musical, género y coherencia rítmica en vez de buscar únicamente por el nombre del artista actual, descubriendo temas complementarios.',
      'Android Auto en el coche recuperado: registro explícito de servicio multimedia con etiqueta y descripción para garantizar su aparición inmediata en el menú de aplicaciones del vehículo.',
      'Inicio directo desde el coche: compatibilidad mejorada con restricciones de inicio en segundo plano en Android 10 a 15, permitiendo iniciar la reproducción y navegación directamente desde la pantalla del coche sin necesidad de abrir la app previamente en el móvil.',
    ],
  },
  {
    version: '0.5',
    date: '18 de noviembre, 2026',
    title: 'Spotifree 0.5: Rendimiento 120 FPS ultrafluido en ordenador, sincronización en tiempo real de playlists de Spotify y nuevas estanterías por momento y tendencias',
    isLatest: false,
    highlights: [
      'Fluidez 120 FPS sin tirones en ordenador: eliminación total de recálculos de renderizado en hover en listas de reproducción mediante estados puros CSS y content-visibility nativo que optimiza el scroll de listas largas de más de 500 temas.',
      'Sincronización en vivo con Spotify (SWR): se elimina el bloqueo de 24 horas; los cambios y nuevas canciones añadidos en Spotify se actualizan en segundo plano en Spotifree al abrir la lista o cambiar de pestaña.',
      'Botón de sincronización manual instantánea: botón directo en la cabecera de la playlist en ordenador y menú de opciones para forzar la recarga inmediata de canciones desde los servidores de Spotify.',
      'Nuevas estanterías «Estados de ánimo y Momentos»: playlists adaptadas con selección semanal para Entrenamiento & Gym, Chill & Relax Acústico, Concentración & Flow, Fiesta & Fin de Semana y En Carretera.',
      'Nuevas estanterías «Tendencias & Virales del Momento»: acceso instantáneo a los temas más escuchados con Top Éxitos Globales 2026, Top 50 España y Descubrimiento Semanal Spotifree.',
      'Optimización de consumo en inicio de escritorio: aceleración por hardware en cabecera sticky y memoización de extracción cromática para navegación instantánea sin retardos de GPU.',
    ],
  },
  {
    version: '0.4.4',
    date: '18 de noviembre, 2026',
    title: 'Spotifree 0.4.4: Carátulas ultrarrápidas de bajo consumo, DJ con locución en Android Auto y mixes de épocas con rotación semanal',
    isLatest: false,
    highlights: [
      'Caché de carátulas ultrarrápido y bajo consumo de red: miniaturas optimizadas a 64px y 150px en listas y tarjetas, reduciendo el consumo de datos en más de un 90% para conexiones lentas o inestables.',
      'Cero parpadeos en Spotifree Web: memoria persistente de imágenes precargadas que mantiene las carátulas siempre cargadas al salir y volver de la pestaña sin parpadeos ni skeletons innecesarios.',
      'DJ en Android Auto con saludo vocal inicial: al pulsar sobre el DJ en Android Auto o mediante voz, el DJ habla e introduce la sesión en primer lugar antes de reproducir las canciones.',
      'Corrección de lista vacía en DJ de escritorio: apertura directa de la consola del DJ con orbe interactivo al hacer clic en playlists o tarjetas de DJ desde el ordenador.',
      'Mixes de Épocas y Estilos ampliados con rotación semanal: repertorio enriquecido para 70s, 80s, 90s, 2000s, 2010s, Rock Clásico, Pop Nostalgia, Urbano & Reggaeton Clásico y EDM que renueva sus temas determinísticamente cada semana.',
    ],
  },
  {
    version: '0.4',
    date: '15 de noviembre, 2026',
    title: 'Spotifree 0.4: Sincronización completa con APK y buscador, menú de 3 puntos perfeccionado y audio 3D/mono real',
    highlights: [
      'Sincronización instantánea de la APK con el buscador: todas las listas creadas, importadas y canciones guardadas se indexan y priorizan de inmediato en los resultados de búsqueda.',
      'Cabecera de playlist limpia y auténtica Spotify: se retira el botón de recarga de la barra de acciones superior, integrando la opción «Actualizar canciones de la lista» de forma natural dentro del menú de 3 puntos.',
      'Audio mono por suma de fases real: mezcla matemática perfecta (50% canal izquierdo + 50% canal derecho) audible en ambos auriculares para accesibilidad y escucha con un solo auricular.',
      'Campo acústico y balance 3D: posicionamiento espacial tridimensional con paneo panorámico y filtro de elevación/presencia frontal y atenuación de sombra craneal para sonido envolvente en auriculares.',
      'Procesamiento DSP directo: activación inmediata del motor de procesamiento de audio nativo al conmutar efectos avanzados de sonido.',
    ],
  },
  {
    version: '0.3',
    date: '13 de noviembre, 2026',
    title: 'Spotifree 0.3: navegación segura, gestos táctiles, sincronización de letras, widgets renovados y discografía completa',
    highlights: [
      'Protección para barra de 3 botones Android: zona segura inferior (--sab) para evitar pulsaciones accidentales entre los controles de la app y el sistema operativo.',
      'Nueva pestaña "Añadir a playlist": formulario limpio sin botones duplicados, botón fijo "+ Nueva playlist", y guardado instantáneo al escribir el nombre y pulsar "Hecho".',
      'Gestos universales de arrastrar para cerrar (drag-to-dismiss): desliza cómodamente hacia abajo desde el tirador superior en el menú de 3 puntos, añadir a playlist y todas las hojas flotantes.',
      'Control de velocidad transparente y persistente: el indicador permanece visible incluso a 1.0x con estilo cristalino y acento verde Spotify, desplegando un minirreproductor compacto sobre los controles.',
      'Gestión limpia de "No me gusta": al descartar una canción avanza a la siguiente sin dejar el botón marcado erróneamente en el nuevo tema, y sin loop de repetición.',
      'Android Auto con iluminación de estados: botones de aleatorio, repetición y favoritos con iluminación verde nativa (#1ED760) y acción de dislike reactiva.',
      'Sincronización milimétrica de letras: compensación de avance de audio (lead) para que el texto resalte exactamente con el inicio del canto de cada verso.',
      'Búsqueda con scroll infinito y discografía completa de artistas: exploración continua sin límites artificiales, resolución exhaustiva del catálogo y recomendaciones reales de artistas similares.',
      'Recomendaciones de playlists rotativas diarias y efecto cine ambiental: mezclas que se renuevan cada día y reproductor de videoclips cortos con fondo ambiental expansivo.',
      'Widgets de inicio modernizados: tocadiscos con vinilo lateral giratorio a 60 FPS, letras en marquesina fluida y portadas de alta definición en fondo difuminado.',
    ],
  },
  {
    version: '0.2.8',
    date: '12 de noviembre, 2026',
    title: 'Unificación de "No me gusta", Android Auto siempre activo y minirreproductor de velocidad en cristal',
    highlights: [
      'Unificación de Me gusta y No me gusta: el corazón nativo gestiona los temas favoritos, mientras que "No me gusta" y "No me interesa" quedan unificados como una única función que descarta y salta la pista al instante.',
      'Android Auto con botón "No me gusta" permanente: disponible en la pantalla del coche siempre (con o sin Modo Labs activo) para descartar temas no deseados con un solo toque.',
      'Minirreproductor flotante de velocidad en cristal: tarjeta de diseño translúcido situada justo encima del Play/Pausa para ajustar el tempo de 0.5x a 2.0x al vuelo sin tapar la pantalla.',
      'Ajustes avanzados simplificados: interruptor directo para habilitar la velocidad desde ajustes y gestión unificada del contador de canciones descartadas con restablecimiento.',
    ],
  },
  {
    version: '0.2.7',
    date: '12 de noviembre, 2026',
    title: 'Modo Labs: velocidad y tono, audio espacial 3D / mono y valoraciones Like/Dislike estilo Amazon Music',
    highlights: [
      'Modo Labs (Spotifree Labs): nuevo interruptor maestro en Ajustes avanzados que desbloquea funciones experimentales de audio y reproducción.',
      'Control de velocidad y tono al vuelo (0.50x – 2.00x): modifica el ritmo desde el menú de 3 puntos o la barra de reproducción (efecto slowed o nightcore) con interruptor de conservación de tono original.',
      'Audio mono y balance espacial 3D: conmuta entre audio mono completo o posiciona el sonido en un cuadrante táctil interactivo (delante/detrás, izquierda/derecha) para auriculares.',
      'Sistema de valoraciones Like / Dislike (estilo Amazon Music): botones de afinidad para afinar gustos; las canciones con dislike se saltan al instante y quedan bloqueadas de listas, aleatorio y Android Auto.',
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
