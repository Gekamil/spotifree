# Guía de Contexto y Arquitectura del Proyecto Spotifree (Para Claude)

> **Documento de Contexto Integral del Repositorio `delightful-borg` (Spotifree)**  
> Este documento contiene **toda la información técnica, arquitectónica y operativa** necesaria para que Claude comprenda al 100% el estado del proyecto, todas las características implementadas, la estructura de carpetas, convenciones de ejecución y tareas pendientes solicitadas por el usuario.

---

## 1. Visión General del Proyecto

**Spotifree** es un reproductor de música de ultra-alta fidelidad visual y funcional respecto al cliente oficial de Spotify (disponible tanto en versión **Web / PWA responsive** como en **APK nativo para Android** empaquetado con **Capacitor**).

### Objetivos Clave y Diferenciadores:
1. **Fidelidad Visual 1:1 con Spotify**: Réplica milimétrica de la interfaz tanto en Desktop (navegación de 3 columnas, estanterías dinámicas, sidebar colapsable, menú contextual, cola lateral) como en Móvil (barra inferior de navegación, cabecera contextual, mini-player con controles completos, modal Now Playing a pantalla completa con letras y canvas de vídeo en bucle).
2. **Streaming Real y Gratuito Sin Anuncios**: Los metadatos, carátulas HD, listas, álbumes y artistas se extraen directamente del ecosistema de Spotify (mediante cookies, tokens de sesión y proxies sobre embeds de Spotify), mientras que el flujo de audio de alta fidelidad se resuelve y reproduce a través de un backend inteligente con YouTube / YouTube Music como motor de audio sin restricciones.
3. **Motor de DJ Profesional y Mezclas Armónicas (Camelot Wheel)**: Implementación de un motor Web Audio API dual-deck que analiza BPM, tono musical (notación Camelot 1A-12B), estructura de compases (phrases de 4 a 32 beats) y aplica transiciones automáticas en tiempo real (Bass Swap de 3 bandas, barridos de filtro resonante HPF/LPF, eco sincronizado con tempo, parada de vinilo y loop stutter).
4. **Modo Fiesta / Sesiones Compartidas**: Sincronización de cola y reproducción en tiempo real entre múltiples usuarios mediante WebRTC con `peerjs`.
5. **Ajustes de Sonido Profesionales**: Ecualizador interactivo de 6 bandas con curva visual y presets de géneros, normalización de volumen estilo Spotify (ReplayGain), reproducción sin pausas (Gapless) y crossfade configurable (1 a 12 segundos).

---

## 2. Entorno de Ejecución y Comandos Críticos

### Sistema Operativo y Terminal
* **Entorno**: Windows.
* **Shell**: PowerShell / CMD.
* ⚠️ **REGLA DE ORO DE EJECUCIÓN EN ESTE ENTORNO**:
  PowerShell tiene deshabilitada por directiva del sistema la ejecución de scripts (`npm.ps1`). Por tanto, **NUNCA ejecutes `npm run ...` directamente en PowerShell**. Debes envolver siempre los comandos en `cmd /c`:
  ```bash
  # Correcto para compilar:
  cmd /c "npm run build"

  # Correcto para tests:
  cmd /c "npm test"

  # Correcto para dev:
  cmd /c "npm run dev"

  # Correcto para compilar APK con Capacitor:
  cmd /c "npm run build:apk"
  ```
  O alternativamente, invoca directamente Node:
  ```bash
  node server.mjs
  node tests/dj_transitions.test.js
  ```

### Scripts Disponibles en `package.json`
* `npm run dev`: Inicia el servidor de desarrollo Vite (puerto por defecto 5173).
* `npm run build`: Compila TypeScript y empaqueta la aplicación con Vite en la carpeta `dist/`.
* `npm test`: Ejecuta la suite de pruebas unitarias y E2E de transiciones DJ (`tests/dj_transitions.test.js`). 83 tests pasando con 100% de éxito.
* `npm run lint`: Ejecuta el linter rápido `oxlint`.
* `npm run build:apk`: Ejecuta `npm run build` y sincroniza los activos con el proyecto de Android Capacitor (`cap sync android`).
* `server.mjs`: Servidor backend Node.js (puerto 10000 por defecto) que gestiona el proxy de audio, extracción de sesiones de Spotify, Edge TTS y streaming con cabeceras HTTP 206 (Range).

---

## 3. Arquitectura del Código (`src/`)

```
delightful-borg/
├── api/                             # Endpoints serverless para Vercel (extract-session, audio-proxy)
├── public/                          # Activos estáticos, manifest, iconos y worker
│   ├── manifest.webmanifest         # PWA Manifest con configuración maskable y any
│   ├── sw.js                        # Service Worker para caché PWA
│   ├── favicon.svg                  # Favicon vectorial oficial Spotify
│   ├── icon-192.png / icon-512.png  # Iconos oficiales transparentes circulares
│   ├── icon-mobile-192.png / 512.png# Iconos maskable adaptativos de Google
│   └── apple-touch-icon.png         # Icono para iOS Safari (180x180)
├── scripts/                         # Utilidades de scraping, verificación y audio
│   └── audioService.mjs             # Resolución y streaming de audio con YouTube
├── server.mjs                       # Servidor local Node.js para streaming y TTS
├── capacitor.config.ts              # Configuración de empaquetado para Android nativo (Capacitor)
├── tests/                           # Suite de pruebas E2E automatizada
│   └── dj_transitions.test.js       # 83 tests de motor DJ y Web Audio API
└── src/
    ├── App.tsx                      # Punto de entrada principal con detección responsive móvil/escritorio
    ├── main.tsx                     # Montaje de React 19 y estilos
    ├── components/
    │   ├── common/                  # Componentes compartidos
    │   │   ├── AudioController.tsx  # Conexión entre Zustand player store y AudioEngine
    │   │   ├── EditProfileModal.tsx # Modal de edición de perfil de usuario
    │   │   ├── ErrorBoundary.tsx    # Captura de fallos en renderizado
    │   │   ├── SharedSessionModal.tsx# Gestión de sala de escucha compartida (PeerJS)
    │   │   └── SpotifreeAuthCard.tsx# Banner de inicio de sesión / estado de cuenta
    │   ├── desktop/                 # Interfaz exclusiva para Desktop (>768px)
    │   │   ├── DesktopLayout.tsx    # Layout de 3 columnas (Sidebar, Main Feed, Right Panel)
    │   │   ├── DesktopSidebar.tsx   # Biblioteca de playlists, podcasts y carpetas
    │   │   ├── DesktopHeader.tsx    # Barra superior con historial, buscador y perfil
    │   │   ├── DesktopPlayer.tsx    # Barra inferior fija de reproducción de Spotify
    │   │   ├── DesktopHomeView.tsx  # Feed principal con estanterías de canciones y recomendaciones
    │   │   ├── DesktopPlaylistView.tsx # Vista detallada de playlist con tabla de tracks
    │   │   ├── DesktopRightSidebar.tsx # Panel lateral "Sonando ahora", letras y biografía del artista
    │   │   └── DesktopSettingsView.tsx # Ajustes completos (audio, ecualizador, cuenta, caché)
    │   ├── mobile/                  # Interfaz móvil nativa (≤768px)
    │   │   ├── MobileLayout.tsx     # Contenedor móvil con soporte para safe-area-insets
    │   │   ├── MobileHeader.tsx     # Cabecera con avatar, filtros rápidos y ajustes
    │   │   ├── MobileBottomNav.tsx  # Barra inferior (Inicio, Buscar, Tu Biblioteca)
    │   │   ├── MobileMiniPlayer.tsx # Mini-reproductor flotante con gestos y controles
    │   │   ├── MobileNowPlayingModal.tsx # Reproductor a pantalla completa con letras y vídeo
    │   │   ├── MobilePlaylistView.tsx # Lista móvil con cabecera fija y botón verde flotante de play
    │   │   └── MobileSettingsView.tsx # Ajustes móviles con EQ interactivo de 6 bandas
    │   ├── dj/                      # Módulo de DJ Inteligente
    │   │   ├── AIDJView.tsx         # Vista de voz del DJ con locución en tiempo real
    │   │   ├── InteractiveMusicWaves.tsx # Visualizador de espectro y ondas
    │   │   └── SpotifyDJVisualizer.tsx # Esfera animada al estilo DJ X de Spotify
    │   ├── icons/                   # Iconografía oficial exacta de Spotify
    │   └── modals/                  # Modales flotantes (TransitionEditorModal, Wrapped, etc.)
    ├── services/
    │   ├── audioEngine.ts           # Motor de audio Web Audio API dual-deck (Crossfade, EQ, Gain)
    │   ├── djTransitionService.ts   # Rueda de Camelot, BPM matching, cálculo armónico y compases
    │   ├── djAudioNodes.ts          # Nodos de procesado de señal (Bass Swap, HPF/LPF, Echo, Stutter)
    │   ├── aiDJService.ts           # Lógica y scripts de intervención del DJ
    │   ├── aiDJVoiceService.ts      # Síntesis de voz Edge TTS con personalidades
    │   ├── sharedSessionService.ts  # WebRTC / PeerJS para escuchar música juntos
    │   ├── spotifyApi.ts            # Consumo de API y scraping de metadatos de Spotify
    │   └── spotifyAuth.ts           # Gestión de autenticación y tokens
    ├── store/                       # Estados globales con Zustand
    │   ├── usePlayerStore.ts        # Cola, track actual, reproducción, volumen, shuffle, repeat
    │   ├── useSpotifyDataStore.ts   # Listas de usuario, favoritos, histórico y feed
    │   ├── useUIStore.ts            # Visibilidad de modales, vistas activas y banners
    │   └── useStatsStore.ts         # Métricas para el resumen anual (Spotify Wrapped)
    └── utils/
        ├── adaptiveLogo.ts          # Ajuste de favicon e iconos según plataforma
        ├── audioFeatures.ts         # Mapeo de energía, valencia, BPM y tono
        ├── lyricsService.ts         # Obtención de letras sincronizadas
        └── offlineStorage.ts        # Caché persistente en IndexedDB para modo sin conexión
```

---

## 4. Componentes y Subsistemas en Detalle

### A. Motor de Audio (`audioEngine.ts` y `djTransitionService.ts`)
* **Arquitectura Dual-Deck**: Mantiene dos reproductores paralelos (Deck A y Deck B) en un único `AudioContext` de Web Audio API. Esto permite realizar crossfade matemático continuo y transiciones DJ sin silencios ni cortes.
* **Rueda de Camelot**: Convierte cualquier tonalidad musical (ej. *C Major*, *A Minor*) al código Camelot (ej. `8B`, `8A`) y calcula la distancia armónica:
  * Distancia 0 o adyacente (ej. `8A` a `8B` o `9A`): Transición suave armónica con *Bass Swap*.
  * Salto de energía (+1 o +2 semitonos): Transición ascendente con barrido de filtro resonante.
  * Incompatible o gran brecha de tempo: Transición con *Echo Out* tempo-sincronizado o *Vinyl Brake*.
* **Estructura de Compases**: Calcula las frases musicales en bloques de 4, 8, 16 o 32 pulsos (beats) y programa la transición en el *downbeat* exacto.
* **Ecualizador de 6 bandas**: Integra nodos `BiquadFilterNode` en 6 frecuencias fijas (60Hz, 150Hz, 400Hz, 1kHz, 2.4kHz, 15kHz) con rango de -12dB a +12dB y presets listos para usar (*Bass Boost, Rock, Pop, Electrónica, Acústico, etc.*).

### B. Mini-Player y Reproductor a Pantalla Completa
* **MobileMiniPlayer**: Situado sobre la barra de navegación móvil. Incluye:
  * Carátula oficial redondeada con animación de pulsación.
  * Título y artistas con scroll automático en textos largos.
  * Controles completos: Botón de Me Gusta (corazón verde), Shuffle, Anterior, Play/Pause, Siguiente, Repetir.
  * Barra de progreso delgada interactiva en el borde inferior.
* **MobileNowPlayingModal**: Se expande deslizando hacia arriba o pulsando el mini-player.
  * Fondo dinámico que extrae el color dominante de la carátula.
  * Pestaña de letras sincronizadas con karaoke en tiempo real.
  * Selector de calidad de audio y dispositivo de salida.
  * Soporte para canvas de vídeo vertical en bucle de Spotify.

### C. Servidor Backend (`server.mjs`)
* Se ejecuta en Node.js y escucha por defecto en el puerto `10000`.
* Resuelve IDs de pistas de Spotify a vídeos de YouTube Music utilizando `@distube/ytdl-core` y `youtubei.js`.
* Emite streams de audio con soporte completo para la cabecera HTTP `Range: bytes=x-y` (código 206 Partial Content), permitiendo adelantar y retrasar la canción instantáneamente sin descargar el archivo completo.
* Dispone del endpoint de locución `/api/ai-dj/voice` que conecta con `msedge-tts` para generar la voz del DJ en español o inglés con acentos seleccionables.

### D. Empaquetado Móvil con Capacitor
* El proyecto está configurado con `@capacitor/android` v8.6.0.
* Archivo de configuración: [capacitor.config.ts](file:///c:/Users/jorge/Documents/antigravity/delightful-borg/capacitor.config.ts).
  * `appId`: `com.spotifree.music`
  * `appName`: `Spotifree`
  * `webDir`: `dist`
  * Plugins integrados: `StatusBar` (estilo oscuro `#121212`) y `SplashScreen`.
* Para generar o actualizar el proyecto de Android Studio: `cmd /c "npm run build:apk"`.

---

## 5. Estado Actual del Proyecto y Tarea Solicitada por el Usuario

### 1. Corrección Realizada en el Icono de Móvil
* **Problema anterior**: Al guardar la web como acceso directo en el móvil, el icono aparecía como un "cuadrado negro con esquinas cuadradas exactas", lo que resultaba antiestético y diferente a cualquier app instalada.
* **Causa encontrada**: En `icon-mobile.svg` se había definido un `<rect rx="20" fill="#000000"/>` con esquinas transparentes. En iOS Safari, Apple no admite transparencias en `apple-touch-icon` y rellena las esquinas de negro puro (`#000000`), produciendo un bloque cuadrado de 90°. En Android, no cumplía el formato *maskable* adaptativo.
* **Solución aplicada**:
  * Se regeneraron [icon-192.png](file:///c:/Users/jorge/Documents/antigravity/delightful-borg/public/icon-192.png) y [icon-512.png](file:///c:/Users/jorge/Documents/antigravity/delightful-borg/public/icon-512.png) como el círculo verde neón oficial de Spotify (`#1ED760`) transparente por fuera.
  * Se regeneraron [icon-mobile-192.png](file:///c:/Users/jorge/Documents/antigravity/delightful-borg/public/icon-mobile-192.png) y [icon-mobile-512.png](file:///c:/Users/jorge/Documents/antigravity/delightful-borg/public/icon-mobile-512.png) en formato adaptativo *maskable* (fondo verde completo y el logo en la zona segura) para que el lanzador del móvil (Samsung, Xiaomi, Pixel) lo recorte con la forma redonda nativa de cualquier app.
  * Se actualizó [apple-touch-icon.png](file:///c:/Users/jorge/Documents/antigravity/delightful-borg/public/apple-touch-icon.png) para iPhone.
  * Se corrigieron [index.html](file:///c:/Users/jorge/Documents/antigravity/delightful-borg/index.html) y [src/utils/adaptiveLogo.ts](file:///c:/Users/jorge/Documents/antigravity/delightful-borg/src/utils/adaptiveLogo.ts).

### 2. Petición del Usuario y Tarea Pendiente
El usuario quiere implementar en la sección de **Ajustes** (y opcionalmente en el empaquetado del **APK de Android**) un **selector de iconos de la aplicación**, permitiendo al usuario cambiar el logo de Spotifree entre distintas variantes que Spotify ha tenido en su historia (como la **Bola de Discoteca / DJ del 20 aniversario** de mayo de 2026, el logo retro, etc.).

> 🚨 **REGLA ESTRICTA Y CRÍTICA DEL USUARIO PARA ESTA TAREA**:
> * **NO crear los logos a mano mediante scripts generadores de SVG ni inventar diseños vectoriales**.
> * El usuario **borró** los logos previos generados por script porque exige que sean **los archivos reales oficiales extraídos directamente de internet** (de los repositorios de APKs oficiales de Spotify, del Newsroom / Brand Assets oficial de Spotify o de campañas reales).
> * **Flujo de trabajo exigido**: Primero hay que buscar, descargar o extraer los recursos de imagen reales legítimos de internet, optimizarlos a las resoluciones necesarias (192x192, 512x512 y apple-touch-icon) y **mostrárselos al usuario para su aprobación** antes de proceder a programar la integración en los ajustes o en el APK.

---

## 6. Checklist de Buenas Prácticas para Trabajar en este Repositorio

1. **Compilación Limpia**: Tras cualquier modificación de código, verifica siempre que el proyecto compila ejecutando:
   ```bash
   cmd /c "npm run build"
   ```
2. **Respeto a los Tests Existentes**: No rompas la suite de DJ transitions. Puedes verificarla en cualquier momento con:
   ```bash
   cmd /c "npm test"
   ```
3. **No Modificar Credenciales ni Archivos de Sesión**: Mantén intactos `live-spotify-tokens.json`, `cookies.txt` y `.env.local`.
4. **Fidelidad Estética de Spotify**: Cualquier botón, modal, icono o menú nuevo debe utilizar las clases de Tailwind de Spotify (`bg-spotify-black`, `bg-spotify-darkGray`, `text-spotify-green`, tipografía `SpotifyMixUI`, esquinas redondeadas estándar y transiciones suaves).
