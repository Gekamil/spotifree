import fs from 'node:fs';
import path from 'node:path';

const artifactDir = 'C:\\Users\\jorge\\.gemini\\antigravity\\brain\\b7d3ec29-c076-4935-90b5-23f42c286313';
const f1 = path.join(artifactDir, 'spotify_mobile_home.png');
const f2 = path.join(artifactDir, 'spotify_mobile_search.png');
const f3 = path.join(artifactDir, 'spotify_mobile_album.png');

const b64Home = 'data:image/png;base64,' + fs.readFileSync(f1).toString('base64');
const b64Search = 'data:image/png;base64,' + fs.readFileSync(f2).toString('base64');
const b64Album = 'data:image/png;base64,' + fs.readFileSync(f3).toString('base64');

const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <script src="https://www.gstatic.com/antigravity/web/dev/tailwindcss.min.js"></script>
  <style>
    .phone-frame {
      width: 320px;
      height: 650px;
      border: 10px solid #282828;
      border-radius: 40px;
      overflow: hidden;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.85);
      position: relative;
      background: #000;
    }
    .notch {
      position: absolute;
      top: 8px;
      left: 50%;
      transform: translateX(-50%);
      width: 90px;
      height: 20px;
      background: #111;
      border-radius: 12px;
      z-index: 50;
    }
  </style>
</head>
<body class="bg-transparent text-white antialiased p-4 select-none">
  <div class="max-w-5xl mx-auto bg-[#121212] text-white border border-white/10 rounded-2xl p-6 shadow-2xl space-y-6">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
      <div>
        <h2 class="text-2xl font-black text-[#1ed760] tracking-tight flex items-center gap-2">
          <span>📱</span> Capturas Reales de Spotify Mobile (iPhone 393×852)
        </h2>
        <p class="text-sm text-[#a7a7a7] mt-1">
          Capturado directamente de open.spotify.com en viewport de móvil real para diseñar la vista responsive de Spotifree.
        </p>
      </div>
      <div class="flex items-center gap-2 bg-[#242424] p-1.5 rounded-xl border border-white/5">
        <button id="btn-home" onclick="showTab('home')" class="px-4 py-1.5 rounded-lg text-xs font-bold transition-all bg-[#1ed760] text-black shadow-md cursor-pointer">Inicio</button>
        <button id="btn-search" onclick="showTab('search')" class="px-4 py-1.5 rounded-lg text-xs font-bold transition-all text-[#b3b3b3] hover:text-white cursor-pointer">Explorar / Buscar</button>
        <button id="btn-album" onclick="showTab('album')" class="px-4 py-1.5 rounded-lg text-xs font-bold transition-all text-[#b3b3b3] hover:text-white cursor-pointer">Álbum (TA FACIL)</button>
        <button id="btn-grid" onclick="showTab('grid')" class="px-4 py-1.5 rounded-lg text-xs font-bold transition-all text-[#b3b3b3] hover:text-white cursor-pointer">Ver las 3 juntas</button>
      </div>
    </div>

    <!-- Single view with Phone Frame -->
    <div id="single-container" class="flex justify-center items-center py-4">
      <div class="phone-frame flex flex-col">
        <div class="notch"></div>
        <div class="flex-1 overflow-y-auto overflow-x-hidden">
          <img id="phone-img" src="${b64Home}" alt="Spotify Mobile" class="w-full h-auto object-cover" />
        </div>
      </div>
    </div>

    <!-- Grid view (3 side-by-side) -->
    <div id="grid-container" class="hidden grid grid-cols-1 md:grid-cols-3 gap-6 py-4 justify-items-center">
      <div class="flex flex-col items-center gap-2">
        <span class="text-xs font-bold text-[#1ed760] uppercase tracking-wider">1. Inicio (Home)</span>
        <div class="phone-frame">
          <div class="notch"></div>
          <div class="w-full h-full overflow-y-auto overflow-x-hidden">
            <img src="${b64Home}" alt="Inicio" class="w-full h-auto object-cover" />
          </div>
        </div>
      </div>
      <div class="flex flex-col items-center gap-2">
        <span class="text-xs font-bold text-[#1ed760] uppercase tracking-wider">2. Explorar todo (Search)</span>
        <div class="phone-frame">
          <div class="notch"></div>
          <div class="w-full h-full overflow-y-auto overflow-x-hidden">
            <img src="${b64Search}" alt="Explorar" class="w-full h-auto object-cover" />
          </div>
        </div>
      </div>
      <div class="flex flex-col items-center gap-2">
        <span class="text-xs font-bold text-[#1ed760] uppercase tracking-wider">3. Álbum TA FACIL</span>
        <div class="phone-frame">
          <div class="notch"></div>
          <div class="w-full h-full overflow-y-auto overflow-x-hidden">
            <img src="${b64Album}" alt="Álbum" class="w-full h-auto object-cover" />
          </div>
        </div>
      </div>
    </div>

    <div class="bg-[#181818] p-4 rounded-xl border border-white/5 flex items-center justify-between text-xs text-[#a7a7a7]">
      <span>✨ <b>Estructura móvil de Spotify</b>: Barra inferior fija de 3 pestañas (Inicio, Buscar, Biblioteca) + Mini Player flotante por encima con barra de progreso.</span>
    </div>
  </div>

  <script>
    const images = {
      home: "${b64Home}",
      search: "${b64Search}",
      album: "${b64Album}"
    };
    function showTab(tab) {
      const btns = ["home", "search", "album", "grid"];
      btns.forEach(b => {
        const el = document.getElementById("btn-" + b);
        if (el) {
          if (b === tab) {
            el.className = "px-4 py-1.5 rounded-lg text-xs font-bold transition-all bg-[#1ed760] text-black shadow-md cursor-pointer";
          } else {
            el.className = "px-4 py-1.5 rounded-lg text-xs font-bold transition-all text-[#b3b3b3] hover:text-white cursor-pointer";
          }
        }
      });
      const single = document.getElementById("single-container");
      const grid = document.getElementById("grid-container");
      const img = document.getElementById("phone-img");
      if (tab === "grid") {
        single.classList.add("hidden");
        grid.classList.remove("hidden");
      } else {
        grid.classList.add("hidden");
        single.classList.remove("hidden");
        if (images[tab]) img.src = images[tab];
      }
    }
  </script>
</body>
</html>`;

const outHtml = path.join(artifactDir, 'spotify_mobile_viewer.html');
fs.writeFileSync(outHtml, html, 'utf8');
console.log('Generated spotify_mobile_viewer.html with embedded base64 images!');

const markdown = `# Interfaz Móvil Real de Spotify & Arquitectura Mobile

A continuación tienes las capturas reales obtenidas directamente de la interfaz móvil oficial de Spotify (viewport iPhone 393x852) con imágenes incrustadas:

## 1. Inicio (Home)
![Spotify Mobile - Inicio](${b64Home})

---

## 2. Explorar y Buscar (Search)
![Spotify Mobile - Explorar y Buscar](${b64Search})

---

## 3. Vista de Álbum (TA FACIL - Lucho RK & La Pantera)
![Spotify Mobile - Vista de Álbum TA FACIL](${b64Album})

---

### Patrones Clave de la Interfaz Móvil de Spotify

1. **Barra de navegación inferior fija (Bottom Navigation Bar)**:
   - 3 pestañas principales: **Inicio** (Home), **Buscar** (Search), y **Tu biblioteca** (Your Library).
   - Altura estándar de 64px, fondo \`#121212\` con efecto blur / translucidez.

2. **Mini Player flotante**:
   - Se sitúa inmediatamente por encima de la barra de navegación inferior.
   - Muestra portada reducida (40x40), nombre de canción y artista desplazables o truncados, botón de play/pause y botón de dispositivo/like.
   - Barra de progreso delgada de 2px en la base del mini player.
   - Al tocar el mini player, se abre el reproductor a pantalla completa (Full Screen Player).

3. **Explorar Todo / Categorías en Móvil**:
   - Cuadrícula de 2 columnas (\`grid grid-cols-2 gap-3\`).
   - Tarjetas coloridas con tipografía en negrita y la imagen del género girada en la esquina inferior derecha.
   - Al pulsar en cualquier categoría, se abre una vista de categoría dedicada con carruseles horizontales.

4. **Vista de Álbum / Lista en Móvil**:
   - Portada centrada de gran tamaño (\`w-60 h-60\` o \`w-72 h-72\`) con sombra profunda.
   - Título, artista principal, año y conteo de canciones.
   - Botón flotante redondo de reproducción aleatoria / play en verde Spotify \`#1ed760\` en el lado derecho.
   - Filas de canciones sin columnas de tabla complejas: simplemente número/título + artista en una fila compacta con botón de opciones (\`...\`).
`;

const outMd = path.join(artifactDir, 'spotify_mobile_architecture.md');
fs.writeFileSync(outMd, markdown, 'utf8');
console.log('Updated spotify_mobile_architecture.md with embedded base64 data URIs!');
