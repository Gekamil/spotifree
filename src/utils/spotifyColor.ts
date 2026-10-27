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

  // Editorial Playlists
  '37i9dQZF1DWZdsS73T1ogG': '#1A4B4C', // el nuevo urbano
  'el-nuevo-urbano': '#1A4B4C',
  '37i9dQZF1DX2EiUAL7Wdfc': '#9C3426', // míticas
  'miticas': '#9C3426',
  '37i9dQZF1DXcBWIGoYBM5M': '#1A4B4C', // Éxitos España
  '4f0YTBqSbvM1iJpuY9r3yQ': '#2D4B68', // ZIZI
  'zizi': '#2D4B68',
  '37i9dQZF1E35QYVMBRlDph': '#B85228', // Mix diario 1
};

export function isDullGrey(color?: string | null): boolean {
  if (!color) return true;
  const c = color.trim().toLowerCase();
  return (
    c === '#303030' ||
    c === '#282828' ||
    c === '#121212' ||
    c === '#181818' ||
    c === '#242424' ||
    c === '#333333' ||
    c === '#404040' ||
    c === '#535353' ||
    c === 'rgb(48, 48, 48)' ||
    c === 'rgb(40, 40, 40)' ||
    c === 'rgb(18, 18, 18)'
  );
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
