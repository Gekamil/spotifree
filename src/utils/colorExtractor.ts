// Smart dominant color extraction and deterministic vibrant Spotify palette

const KNOWN_COLORS: Record<string, string> = {
  'prince royce': '#eab308', // Warm Golden Yellow
  'prince royce radio': '#eab308',
  'romeo & prince': '#b45309', // Warm Terracotta / Amber
  'romeo santos': '#c2410c', // Deep Amber Orange
  'spidey': '#dc2626', // Marvel Red
  'j+l(2026)': '#8a654e', // Warm Sepia / Bronze
  'viva latino': '#e11d48', // Vibrant Hot Pink
  'el nuevo urbano': '#0d9488', // Emerald Teal
  'míticas': '#9c3426', // Crimson Rust
  'zizi': '#0284c7', // Ocean Blue
  'canciones que te gustan': '#5018F0', // Spotify Purple
  'top 50: españa': '#15803d', // Green Charts
  'éxitos españa': '#1a4b4c', // Teal
  'latin': '#0284c7', // Cyan Blue
  'pop': '#16a34a', // Emerald Green
  'rock': '#c2410c', // Fiery Amber
  'indie': '#65a30d', // Olive Lime
  'dance': '#db2777', // Magenta Pink
  'fútbol': '#0284c7', // Blue
  'descubrir': '#7c3aed', // Violet
};

const VIBRANT_FALLBACKS = [
  '#eab308', // Amber Yellow
  '#b45309', // Terracotta
  '#5018F0', // Purple
  '#0d9488', // Teal
  '#e11d48', // Crimson Rose
  '#0284c7', // Sapphire
  '#16a34a', // Green
  '#c2410c', // Rust
  '#7c3aed', // Violet
  '#db2777', // Magenta
];

export function isInvalidGrey(hex?: string): boolean {
  if (!hex) return true;
  const h = hex.toLowerCase().trim();
  return (
    h === '#303030' ||
    h === '#282828' ||
    h === '#121212' ||
    h === '#000000' ||
    h === '#181818' ||
    h === '#242424' ||
    h === '#333333' ||
    h === '#404040' ||
    h === '#535353' ||
    h === '#727272' ||
    h === 'rgb(40, 40, 40)' ||
    h === 'rgb(48, 48, 48)'
  );
}

const COLOR_CACHE = new Map<string, string>();

if (typeof window !== 'undefined') {
  try {
    const raw = window.localStorage.getItem('spotifree_extracted_colors');
    if (raw) {
      const parsed = JSON.parse(raw);
      Object.entries(parsed).forEach(([k, v]) => {
        if (typeof v === 'string') COLOR_CACHE.set(k, v);
      });
    }
  } catch {}
}

function persistColor(key: string, color: string) {
  COLOR_CACHE.set(key, color);
  if (typeof window !== 'undefined') {
    try {
      const obj: Record<string, string> = {};
      let count = 0;
      for (const [k, v] of COLOR_CACHE.entries()) {
        obj[k] = v;
        if (++count > 200) break;
      }
      window.localStorage.setItem('spotifree_extracted_colors', JSON.stringify(obj));
    } catch {}
  }
}

export function getColorFromTitle(title: string = '', fallbackId: string = ''): string {
  const clean = title.toLowerCase().trim();
  for (const [key, color] of Object.entries(KNOWN_COLORS)) {
    if (clean.includes(key)) return color;
  }

  // Deterministic vibrant fallback from hash
  const str = `${title}:${fallbackId}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % VIBRANT_FALLBACKS.length;
  return VIBRANT_FALLBACKS[idx];
}

/**
 * Extracts dominant vibrant color from an image using offscreen canvas.
 * Falls back immediately to title/id hash if image is unavailable or blocked by CORS.
 */
export async function extractDominantColor(imgUrl?: string, title: string = '', id: string = ''): Promise<string> {
  const fallback = getColorFromTitle(title, id);
  if (!imgUrl) return fallback;

  if (COLOR_CACHE.has(imgUrl)) {
    return COLOR_CACHE.get(imgUrl)!;
  }

  // Pre-mapped high-priority titles
  const cleanTitle = title.toLowerCase().trim();
  for (const [key, col] of Object.entries(KNOWN_COLORS)) {
    if (cleanTitle.includes(key)) {
      persistColor(imgUrl, col);
      return col;
    }
  }

  if (typeof window === 'undefined') return fallback;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.referrerPolicy = 'no-referrer';

    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        persistColor(imgUrl, fallback);
        resolve(fallback);
      }
    }, 1500);

    img.onload = () => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeout);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 24;
        canvas.height = 24;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          persistColor(imgUrl, fallback);
          return resolve(fallback);
        }

        ctx.drawImage(img, 0, 0, 24, 24);
        const data = ctx.getImageData(0, 0, 24, 24).data;

        let bestR = 0, bestG = 0, bestB = 0, maxSaturation = -1;
        let avgR = 0, avgG = 0, avgB = 0, count = 0;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];

          if (a < 128) continue;

          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const brightness = (max + min) / 2;

          // Skip near-black, near-white, or washed-out grey pixels
          if (brightness < 35 || brightness > 230) continue;
          const delta = max - min;
          if (delta < 20) continue;

          const saturation = delta / max;
          if (saturation > maxSaturation) {
            maxSaturation = saturation;
            bestR = r;
            bestG = g;
            bestB = b;
          }

          avgR += r;
          avgG += g;
          avgB += b;
          count++;
        }

        let finalR = bestR;
        let finalG = bestG;
        let finalB = bestB;

        if (maxSaturation < 0.25 && count > 0) {
          finalR = Math.round(avgR / count);
          finalG = Math.round(avgG / count);
          finalB = Math.round(avgB / count);
        }

        if (finalR === 0 && finalG === 0 && finalB === 0) {
          persistColor(imgUrl, fallback);
          return resolve(fallback);
        }

        // Clamp brightness to Spotify atmospheric aesthetic
        finalR = Math.min(240, Math.max(40, finalR));
        finalG = Math.min(240, Math.max(40, finalG));
        finalB = Math.min(240, Math.max(40, finalB));

        const hex = `#${((1 << 24) + (finalR << 16) + (finalG << 8) + finalB).toString(16).slice(1)}`;
        persistColor(imgUrl, hex);
        resolve(hex);
      } catch {
        persistColor(imgUrl, fallback);
        resolve(fallback);
      }
    };

    img.onerror = () => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeout);
      persistColor(imgUrl, fallback);
      resolve(fallback);
    };

    img.src = imgUrl;
  });
}
