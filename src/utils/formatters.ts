export const stripHtml = (html: string = ''): string => {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
};

export const formatDuration = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export const toHDImage = (url: string | null | undefined): string => {
  if (!url) return '';

  let cleaned = url
    // Album covers (640x640: b273)
    .replace(/\/ab67616d[0-9a-f]{8}([0-9a-f]{24})/, '/ab67616d0000b273$1')
    // Playlists & compilations (640x640: 0002)
    .replace(/\/ab67706f[0-9a-f]{8}([0-9a-f]{24})/, '/ab67706f00000002$1')
    // Artist avatars (640x640: e5eb)
    .replace(/\/ab676161[0-9a-f]{8}([0-9a-f]{24})/, '/ab6761610000e5eb$1')
    // User playlists (640x640: d72c)
    .replace(/\/ab67706c[0-9a-f]{8}([0-9a-f]{24})/, '/ab67706c0000d72c$1')
    // Radio & daily mix (640x640: 0002)
    .replace(/\/ab67706d[0-9a-f]{8}([0-9a-f]{24})/, '/ab67706d00000002$1')
    // Mosaics & Liked songs
    .replace('mosaic.scdn.co/60/', 'mosaic.scdn.co/640/')
    .replace('mosaic.scdn.co/300/', 'mosaic.scdn.co/640/')
    .replace('liked-songs-64.png', 'liked-songs-640.jpg')
    .replace('liked-songs-300.png', 'liked-songs-640.jpg');

  return cleaned;
};
