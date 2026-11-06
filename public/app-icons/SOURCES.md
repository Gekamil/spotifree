# Logos oficiales de Spotify — fuentes

Archivos originales descargados sin modificar (pendientes de aprobación antes de generar
las versiones 192x192, 512x512 y apple-touch-icon 180x180 para el selector de iconos).

| Archivo | Época | Fuente |
|---|---|---|
| `originals/2008-2012_spotify_logo.svg` | 2008–2012 | https://commons.wikimedia.org/wiki/File:Spotify_logo_2008%E2%80%932012.svg |
| `originals/2013-2015_spotify_logo.svg` | 2013–2015 | https://commons.wikimedia.org/wiki/File:Spotify_logo_2013%E2%80%932015.svg |
| `originals/2015-2024_spotify_icon.svg` | 2015–2024 | https://commons.wikimedia.org/wiki/File:Spotify_logo_without_text.svg |
| `originals/2015-2024_spotify_app_logo_black.svg` | 2015–2024 (app) | https://commons.wikimedia.org/wiki/File:Spotify_App_Logo.svg |
| `originals/2024_spotify_icon_green.svg` | 2024–hoy | https://commons.wikimedia.org/wiki/File:2024_Spotify_logo_without_text.svg |
| `originals/2024_spotify_icon_black.svg` | 2024–hoy (negro) | https://commons.wikimedia.org/wiki/File:2024_Spotify_logo_without_text_(black).svg |
| `originals/2026_spotify_20th_anniversary_logo.svg` | Mayo 2026 (20 aniversario) | https://commons.wikimedia.org/wiki/File:Spotify_20th_anniversary_logo.svg |

## Icono "bola de discoteca" (20 aniversario, mayo 2026)
Spotify no lo publicó como archivo descargable (ni Commons ni Newsroom). Se ha **recortado del
icono real** que aparece en la imagen de prensa de 9to5Mac (2000x1000, icono de 850x850):
- Origen: https://9to5mac.com/wp-content/uploads/sites/6/2026/05/spotify-disco-ball.webp
  (artículo: https://9to5mac.com/2026/05/17/spotify-confirms-disco-ball-app-icon-is-temporary-and-regular-logo-will-return/)
- Copia del original: `originals/2026_spotify20_disco_ball_press_9to5mac.webp`
- Proceso: solo se eliminó el fondo verde plano de la foto, se recortó el icono (sin marca de agua)
  y se redimensionó. No se ha redibujado nada.

| Archivo en `2026-disco-ball/` | Uso |
|---|---|
| `spotify20-disco-ball-original-crop.png` | Recorte a tamaño nativo (850x850) |
| `icon-512.png`, `icon-192.png` | PWA `purpose: any` (esquinas transparentes) |
| `icon-maskable-512.png`, `icon-maskable-192.png` | Android adaptativo / APK (fondo negro completo) |
| `apple-touch-icon.png` | iOS 180x180 (fondo negro completo) |

Nota: al venir de una foto de 850 px, la nitidez es buena hasta 512 px. Si se consigue el APK oficial
de mayo 2026, se podría sustituir por el recurso `mipmap` original.

Vista previa: `/app-icons/preview.html`
