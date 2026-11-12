<div align="center">

# 🎧 Spotifree

**Reproductor musical web y app nativa para Android / Android Auto con modo DJ inteligente, reproducción offline, widgets animados y soporte SoundCloud/remixes.**

[![Version](https://img.shields.io/badge/versión-0.2.4-1DB954?style=for-the-badge)](./package.json)
[![Web Live](https://img.shields.io/badge/Web-spotifreeweb.vercel.app-000000?style=for-the-badge&logo=vercel)](https://spotifreeweb.vercel.app)
[![Android APK](https://img.shields.io/badge/Android-Descargar%20APK-3DDC84?style=for-the-badge&logo=android&logoColor=white)](https://github.com/Gekamil/spotifree/releases/download/android-latest/Spotifree.apk)
[![CI APK](https://github.com/Gekamil/spotifree/actions/workflows/android-apk.yml/badge.svg)](https://github.com/Gekamil/spotifree/actions/workflows/android-apk.yml)

[Abrir Web App](https://spotifreeweb.vercel.app) · [Página de instalación Android](https://spotifreeweb.vercel.app/instalar) · [Última Release APK](https://github.com/Gekamil/spotifree/releases/tag/android-latest)

</div>

---

## ✨ Qué incluye Spotifree

| Área | Funcionalidades principales |
| :--- | :--- |
| **🎵 Reproducción y Catálogo** | Búsqueda unificada (Spotify, Deezer, iTunes, SoundCloud y YouTube), apartado dedicado de **Álbumes**, prioridad para **remixes oficiales** antes que leaks/SoundCloud, carátulas HD y portadas animadas (*motion covers*). |
| **🎛️ Modo DJ IA & Web Audio** | Planificador armónico con **rueda Camelot** y emparejamiento de **BPM / doble-mitad**, 7 presets de mezcla (`automatica`, `corte`, `filtro`, `eco_out`, `freno_vinilo`, `beat_roll`, `crescendo`), orbe dinámico de 3 capas e interacción por texto/voz con síntesis neural (`msedge-tts`). |
| **📶 Offline & Biblioteca** | Descarga de listas y canciones para escucha sin conexión, reproducción desde almacenamiento local, playlists colaborativas en tiempo real, papelera/historial de versiones, prevención de autoguardado al explorar listas externas y sincronización con Firebase. |
| **🔊 Audio & Sesiones** | Selector de **salida de audio** en ordenador, móvil web y Android APK (altavoz, auriculares, Bluetooth, USB), además de sesiones para **Escuchar juntos** (`PeerJS`) y estadísticas de escucha. |
| **🚗 Android Auto & Widgets** | 4 pestañas nativas en el coche (**Inicio**, **Recientes**, **Tu biblioteca** y **Explorar**), reproducción aleatoria, cola, letra en el salpicadero, comandos de voz y **2 widgets** con carátula difuminada, gradiente dinámico, `<Chronometer>` y Tocadiscos fluido a 60 FPS. |

---

## 🧱 Stack Tecnológico

- **Frontend:** React 19, TypeScript, Vite 8, Tailwind CSS, Zustand
- **Audio & DSP:** Web Audio API (channel strip de 10 nodos, ecualizador, sweeps resonantes, delay sincronizado), `hls.js`, Web Workers (`audioAnalysis.worker`)
- **Backend / Serverless:** Vercel Serverless Functions (`api/*.js`) + servidor Node/HTTP (`server.mjs`) con resolución multimedia (`yt-dlp`, `youtubei.js`, `play-dl`, SoundCloud fallback)
- **Móvil y Nativo:** Capacitor 8 (`com.spotifree.music`), plugins nativos Java para Android, MediaBrowserService para Android Auto y widgets `AppWidgetProvider`
- **Datos y Tiempo Real:** Firebase, `PeerJS`

---

## 📂 Estructura del Proyecto

```text
delightful-borg/
├── api/                         # Endpoints serverless (Vercel): búsqueda, playlists, audio, letras, auth, TTS
├── native/android/              # Código nativo Java y recursos XML de Android / Android Auto / Widgets
│   ├── SpotifreeMediaService.java
│   ├── SpotifreeMediaPlugin.java
│   ├── SpotifreeAudioOutputPlugin.java
│   ├── SpotifreeAudioFxPlugin.java
│   ├── SpotifreeLocalMusicPlugin.java
│   ├── SpotifreeWidget.java
│   ├── SpotifreeTurntableWidget.java
│   └── res/                     # Layouts, drawables vectoriales e iconos de pestañas y widgets
├── scripts/                     # Workers de audio (audioService.mjs, audio_resolver.py), setup Android y fetch APK
├── src/
│   ├── components/              # Vistas Desktop, Mobile, DJ IA, Widgets, Modales y Reproductor
│   ├── services/                # API Spotify/Deezer, motor de audio, historial, salidas de audio, sesiones
│   ├── store/                   # Stores Zustand (player, datos, UI, estadísticas)
│   └── utils/                   # Almacenamiento offline, orden aleatorio, letras, carátulas y deep links
├── tests/                       # Suites de tests unitarios, integración y E2E (node:test)
├── .github/workflows/           # Pipeline automático de compilación, firma y release del APK
├── Dockerfile                   # Imagen Node 20 + Python 3 + ffmpeg + yt-dlp para backend de audio
├── server.mjs                   # Servidor HTTP standalone (puerto 10000 por defecto)
└── vercel.json                  # Configuración de build, rewrites y cabeceras en Vercel
```

---

## 🚀 Puesta en Marcha en Local

### Requisitos previos
- **Node.js 20+** (en CI se utiliza Node 22)
- **Python 3 + `ffmpeg` + `yt-dlp`** (para el resolver completo de audio en el backend local)

### Instalación y desarrollo

```bash
# 1. Clonar el repositorio
git clone https://github.com/Gekamil/spotifree.git
cd spotifree

# 2. Instalar dependencias
npm install

# 3. Arrancar el frontend en modo desarrollo (Vite)
npm run dev
```

Si quieres levantar también el servidor backend de audio/API en local:

```bash
node server.mjs
```

> Por defecto escucha en `http://localhost:10000` (configurable mediante `PORT`).

---

## 🐳 Ejecutar Backend + Web con Docker

El `Dockerfile` incluido instala `node:20-slim`, `python3`, `ffmpeg` y `yt-dlp[default,deno]`, compila el frontend y arranca `server.mjs` en el puerto `10000`:

```bash
docker build -t spotifree .
docker run -p 10000:10000 spotifree
```

---

## 🧪 Tests y Calidad de Código

El proyecto utiliza el runner nativo `node:test` y `oxlint`:

```bash
# Comprobación de tipos TypeScript y build de producción
npm run build

# Linter rápido
npm run lint

# Suite principal (12 baterías: transiciones DJ, planificador, offline, karaoke, letras, biblioteca, orbe)
npm test

# Suites adicionales E2E y nativas
node tests/e2e_spotifree_r1_r5.test.mjs
node tests/audio_output_and_covers.test.mjs
node tests/android_auto_and_widgets.test.mjs
```

---

## 📱 Compilación del APK Android

La app Android usa **Capacitor 8** cargando la web desplegada (con `offline.html` como respaldo sin conexión) e inyectando los plugins nativos de Android Auto, efectos de audio, selector de salida, archivos locales y widgets.

### De forma local (requiere Android SDK / Android Studio)

```bash
npx cap add android
npm run build:apk
```

### Automática en GitHub Actions

Cada `push` a `main` que modifique `native/**`, `scripts/setup-android-*.mjs`, `capacitor.config.ts`, `package.json` o recursos de la app dispara [`.github/workflows/android-apk.yml`](./.github/workflows/android-apk.yml), que:

1. Compila la web (`npm run build`).
2. Sincroniza el proyecto Capacitor y copia clases/recursos nativos (`scripts/setup-android-native.mjs`).
3. Genera y firma `Spotifree.apk` con `./gradlew assembleRelease` y `apksigner`.
4. Publica el binario en la release [`android-latest`](https://github.com/Gekamil/spotifree/releases/tag/android-latest).

> En **Vercel**, `vercel.json` ejecuta `npm run build && node scripts/fetch-latest-apk.mjs` para servir siempre la web actualizada junto con `/Spotifree.apk` y `/instalar` desde el mismo dominio.

---

## 📌 Novedades Recientes (`v0.2.4`)

- **Android Auto · Pestaña «Recientes»:** acceso directo exclusivamente a las playlists, álbumes, mixes y canciones escuchadas recientemente.
- **Widgets rediseñados:** fondo con carátula difuminada, gradiente dinámico de doble tono, barra de progreso y temporizador nativo en vivo (`<Chronometer>`).
- **Tocadiscos fluido a 60 FPS:** plato vinilo y reflejo óptico girando suavemente en el launcher sin saltos de frames, con etiqueta central nítida en HD.

Consulta el historial completo de versiones en [`src/data/changelog.ts`](./src/data/changelog.ts).
