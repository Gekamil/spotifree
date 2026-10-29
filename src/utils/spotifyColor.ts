export const SPOTIFY_VIBRANT_PALETTE = [
  '#5018F0', // Spotify Purple
  '#1DB954', // Spotify Green
  '#E91429', // Crimson Red
  '#2D46B9', // Sapphire Blue
  '#B02897', // Magenta
  '#E13300', // Sunset Orange
  '#148A08', // Emerald Forest
  '#E8115B', // Hot Pink
  '#BA5D07', // Warm Amber
  '#1E3264', // Deep Navy
  '#8D67AB', // Lavender
  '#7358FF', // Electric Violet
  '#EAB308', // Prince Royce Yellow / Gold
  '#C45028', // Romeo Terracotta
  '#D11B24', // Spidey Red
  '#608108', // Indie Olive Green
  '#DC148C', // Dance Hot Pink
  '#1A4B4C', // Urbano Deep Teal
];

export const KNOWN_PLAYLIST_COLORS: Record<string, string> = {
  // Prince Royce (Bright gold / yellow matching album cover)
  'radio-prince': '#EAB308',
  'radio-prince-royce': '#EAB308',
  'prince-royce': '#EAB308',
  'prince-royce-radio': '#EAB308',

  // Romeo & Prince (Warm terracotta / orange)
  'romeo-prince': '#C45028',
  'romeo---prince': '#C45028',
  '43GWp9FbN9nHihudedyVQM': '#C45028',

  // Liked Songs
  'liked-songs': '#5018F0',
  'collection-tracks': '#5018F0',
  'tracks': '#5018F0',

  // Spidey
  'spidey': '#D11B24',

  // J+L (2026)
  '7b3MrCWtettvBKlfBSdorn': '#8A654E',
  'jl-2026': '#8A654E',
  'j-l-2026': '#8A654E',

  // Top Tracks / Wrapped
  'my-top-tracks-playlist': '#5E3D82',
  '4Jf0fa5p0ajOnSriA9cYGS': '#5E3D82',
  'tus-canciones-mas-escuchadas-2025': '#E05A36',
  'your-top-songs-2025': '#E05A36',

  // Random
  'random': '#2D6852',

  // Editorial Playlists & Live Feed Shelves
  '37i9dQZF1DWZdsS73T1ogG': '#1A4B4C', // el nuevo urbano
  'el-nuevo-urbano': '#1A4B4C',
  '37i9dQZF1DX2EiUAL7Wdfc': '#9C3426', // míticas
  'miticas': '#9C3426',
  '37i9dQZF1DXcBWIGoYBM5M': '#1A4B4C', // Éxitos España
  '37i9dQZF1DXaxEKcoCdWHD': '#1A4B4C', // Éxitos España
  '4f0YTBqSbvM1iJpuY9r3yQ': '#2D4B68', // ZIZI
  'zizi': '#2D4B68',
  '37i9dQZF1E35QYVMBRlDph': '#B85228', // Mix diario 1
  '37i9dQZF1E39G7BcNRMw7W': '#2D46B9', // Mix diario 2
  '37i9dQZF1E38mn8YFuPgE2': '#C45028', // Mix diario 3
  '37i9dQZF1E37WRLP4fZmP6': '#7358FF', // Mix diario 4
  '37i9dQZF1E37UsvZHnETCz': '#E13300', // Mix diario 5
  '37i9dQZF1E39YlnoZk8GqV': '#148A08', // Mix diario 6
  '37i9dQZEVXcHqU92M8nGCZ': '#5018F0', // Descubrimiento semanal
  '37i9dQZEVXbcvA1FAYKESf': '#2D46B9', // Radar de Novedades
  '37i9dQZF1E4uMVXUeT9lW3': '#C45028', // Radio Romeo Santos
  '37i9dQZF1E4FpP3OTY6OyV': '#EAB308', // Radio Rels B
  '37i9dQZF1E4l5POm4tdfTL': '#7358FF', // Radio 3AM
  '37i9dQZF1E4CWDuYF7GiUo': '#BA5D07', // Radio Bad Bunny
  '37i9dQZF1EVHGWrwldPRtj': '#2D46B9', // Mix relajante
  '37i9dQZF1EIXyrqgTb1UJk': '#B02897', // Mix de Aventura
  '37i9dQZF1EQmK1rjZuPGDt': '#E13300', // Mix latino
  '37i9dQZF1EQm2eC3Aj5U5P': '#C45028', // Mix de bachata
  '37i9dQZF1EQncLwOalG3K7': '#1DB954', // Mix de pop
  '37i9dQZF1E4k8iFIrwwqkW': '#E8115B', // Radio KAROL G
  '37i9dQZF1E4vTHVDH1FT3Y': '#BA5D07', // Radio Bruno Mars
  '37i9dQZF1E4FhRRLh0mmxG': '#1E3264', // Radio Coldplay
  '37i9dQZF1DX9gKTxAbfFfX': '#EAB308', // Verano 2026
  '37i9dQZF1DX1HCSfq0nSal': '#DC148C', // PEGAO
  '37i9dQZF1DWVJv1UsWItkB': '#148A08', // Viral España 2026
  '37i9dQZF1DX8jrCoV9Ccve': '#BA5D07', // temardos
  '37i9dQZF1DX10zKzsJ2jva': '#E13300', // Viva Latino
  '37i9dQZF1DWZjqjZMudx9T': '#C45028', // MANSIÓN REGGAETÓN
  '37i9dQZF1DX43c0ftmnMBx': '#C45028', // Bachatéame
  '57tmzh0hsnWU8znnvEWJbe': '#B02897', // The Last (Aventura)
};

export function isDullGrey(color?: string | null): boolean {
  if (!color) return true;
  const c = color.trim().toLowerCase();
  if (
    c === '#000000' ||
    c === '#000' ||
    c === '#111' ||
    c === '#111111' ||
    c === '#1a1a1a' ||
    c === '#222222' ||
    c === '#202020' ||
    c === '#303030' ||
    c === '#282828' ||
    c === '#121212' ||
    c === '#181818' ||
    c === '#242424' ||
    c === '#333333' ||
    c === '#404040' ||
    c === '#535353' ||
    c === '#727272' ||
    c === '#b3b3b3' ||
    c === '#ffffff' ||
    c === '#fff' ||
    c.startsWith('rgba(0,') ||
    c.startsWith('rgb(0,') ||
    c.startsWith('rgb(18,') ||
    c.startsWith('rgb(24,') ||
    c.startsWith('rgb(40,') ||
    c.startsWith('rgb(48,')
  ) {
    return true;
  }

  // Parse 3 or 6 hex digits and inspect luminance & saturation
  if (c.startsWith('#')) {
    let hex = c.slice(1);
    if (hex.length === 3) {
      hex = hex.split('').map((x) => x + x).join('');
    }
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        if (lum < 40 || lum > 240) return true; // Reject pitch black / dark mud or pure white
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        if (max - min < 25) return true; // Reject washed-out grey
      }
    }
  }

  return false;
}

export function resolveVibrantColor(
  id: string = '',
  name: string = '',
  existingColor?: string | null
): string {
  // If the provided color is already vibrant and not dull grey, use it
  if (existingColor && !isDullGrey(existingColor)) {
    return existingColor;
  }

  const cleanId = (id || '').toLowerCase().trim();
  const cleanName = (name || '').toLowerCase().trim();

  // 1. Direct match in known catalog
  if (KNOWN_PLAYLIST_COLORS[cleanId]) return KNOWN_PLAYLIST_COLORS[cleanId];
  if (KNOWN_PLAYLIST_COLORS[cleanName]) return KNOWN_PLAYLIST_COLORS[cleanName];

  // 2. Keyword matching for artists, genres, titles
  if (/prince\s*royce/i.test(cleanName) || /prince\s*royce/i.test(cleanId)) {
    return '#EAB308'; // Bright yellow
  }
  if (/romeo/i.test(cleanName) || /romeo/i.test(cleanId)) {
    return '#C45028'; // Warm terracotta
  }
  if (/spider|spidey/i.test(cleanName) || /spider|spidey/i.test(cleanId)) {
    return '#D11B24'; // Spidey crimson
  }
  if (/gustan|liked/i.test(cleanName) || /liked/i.test(cleanId)) {
    return '#5018F0'; // Liked purple
  }
  if (/indie/i.test(cleanName) || /indie/i.test(cleanId)) {
    return '#608108'; // Indie olive green
  }
  if (/dance|electr/i.test(cleanName) || /dance|electr/i.test(cleanId)) {
    return '#DC148C'; // Dance magenta
  }
  if (/rock/i.test(cleanName) || /rock/i.test(cleanId)) {
    return '#BC5900'; // Rock amber
  }
  if (/pop/i.test(cleanName) || /pop/i.test(cleanId)) {
    return '#148A08'; // Pop green
  }
  if (/latina|latino/i.test(cleanName) || /latina|latino/i.test(cleanId)) {
    return '#E13300'; // Latin orange/red
  }
  if (/fútbol|futbol/i.test(cleanName) || /futbol/i.test(cleanId)) {
    return '#0D73EC'; // Blue fútbol
  }
  if (/novedad|radar|viernes/i.test(cleanName)) {
    return '#2D46B9'; // Electric blue
  }

  // 3. Fallback deterministic hash to SPOTIFY_VIBRANT_PALETTE (always vibrant!)
  const combined = `${cleanId}:${cleanName}`;
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    hash = (hash << 5) - hash + combined.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % SPOTIFY_VIBRANT_PALETTE.length;
  return SPOTIFY_VIBRANT_PALETTE[idx];
}

const imageColorCache = new Map<string, string>();

/**
 * Dynamically samples an image on an in-memory canvas to extract the most vibrant
 * dominant saturated color (e.g. hot pink for pink covers, warm brown/terracotta for brown covers).
 * Returns hex color string, cached in-memory and in localStorage.
 */
export async function extractDominantColorFromImage(imageUrl?: string | null): Promise<string | null> {
  if (!imageUrl || typeof window === 'undefined') return null;
  if (imageColorCache.has(imageUrl)) return imageColorCache.get(imageUrl)!;

  try {
    const cached = window.localStorage.getItem(`spotifree_vibrant_color_${imageUrl}`);
    if (cached) {
      imageColorCache.set(imageUrl, cached);
      return cached;
    }
  } catch {}

  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.referrerPolicy = 'no-referrer';
      img.src = imageUrl;

      const timer = setTimeout(() => {
        resolve(null);
      }, 2500);

      img.onload = () => {
        clearTimeout(timer);
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 40;
          canvas.height = 40;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) return resolve(null);

          ctx.drawImage(img, 0, 0, 40, 40);
          const imgData = ctx.getImageData(0, 0, 40, 40).data;

          let bestR = 140, bestG = 80, bestB = 60;
          let maxScore = -1;

          for (let i = 0; i < imgData.length; i += 16) {
            const r = imgData[i];
            const g = imgData[i + 1];
            const b = imgData[i + 2];
            const a = imgData[i + 3];

            if (a < 180) continue;

            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const delta = max - min;
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;

            // Reject pure black, muddy darks (< 35), or blown-out whites (> 230)
            if (lum < 35 || lum > 230) continue;
            // Reject monochromatic / washed out grays
            if (delta < 25) continue;

            const saturation = delta / max;
            // Score balances vibrancy and saturation while prioritizing visually pleasing hues
            const score = saturation * 1.5 + (lum > 50 && lum < 180 ? 0.5 : 0);

            if (score > maxScore) {
              maxScore = score;
              bestR = r;
              bestG = g;
              bestB = b;
            }
          }

          if (maxScore > 0) {
            const hex = `#${bestR.toString(16).padStart(2, '0')}${bestG.toString(16).padStart(2, '0')}${bestB.toString(16).padStart(2, '0')}`.toUpperCase();
            imageColorCache.set(imageUrl, hex);
            try {
              window.localStorage.setItem(`spotifree_vibrant_color_${imageUrl}`, hex);
            } catch {}
            return resolve(hex);
          }
        } catch (err) {
          // Canvas cross-origin taint fallback
        }
        resolve(null);
      };

      img.onerror = () => {
        clearTimeout(timer);
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });
}
