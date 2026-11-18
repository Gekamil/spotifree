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
  // Collages (mosaic.scdn.co/<size>/<4 ids>): only the size, never the ids inside
  if (url.includes('mosaic.scdn.co')) {
    return url.replace('mosaic.scdn.co/60/', 'mosaic.scdn.co/640/').replace('mosaic.scdn.co/300/', 'mosaic.scdn.co/640/');
  }

  let cleaned = url
    // Album covers (640x640: b273)
    .replace(/\/ab67616d[0-9a-f]{8}([0-9a-f]{24})/i, '/ab67616d0000b273$1')
    // Playlists & compilations (640x640: 0002 / 0003)
    .replace(/\/ab67706f[0-9a-f]{8}([0-9a-f]{24})/i, '/ab67706f00000002$1')
    // Artist avatars (640x640: e5eb)
    .replace(/\/ab676161[0-9a-f]{8}([0-9a-f]{24})/i, '/ab6761610000e5eb$1')
    // User playlists (640x640 HD: bebb)
    .replace(/\/ab67706c[0-9a-f]{8}([0-9a-f]{24})/i, '/ab67706c0000bebb$1')
    // Radio & daily mix (640x640: 0002)
    .replace(/\/ab67706d[0-9a-f]{8}([0-9a-f]{24})/i, '/ab67706d00000002$1')
    // Deezer covers: always use highest resolution 1000x1000 or 500x500
    .replace(/\/(\d+)x(\d+)-000000-80-0-0\.jpg/i, '/500x500-000000-80-0-0.jpg')
    // iTunes artwork: 100x100 -> 600x600
    .replace('100x100bb', '600x600bb')
    // Mosaics & Liked songs
    .replace('mosaic.scdn.co/60/', 'mosaic.scdn.co/640/')
    .replace('mosaic.scdn.co/300/', 'mosaic.scdn.co/640/')
    .replace('liked-songs-64.png', 'liked-songs-640.jpg')
    .replace('liked-songs-300.png', 'liked-songs-640.jpg');

  return cleaned;
};

/**
 * Fast lightweight thumbnail helper: 64-300px for mobile lists, cards, and queue.
 * Reduces image payload from ~200KB down to ~4-15KB, saving 90%+ bandwidth on mobile/slow connections!
 */
export const toThumbnailImage = (url: string | null | undefined, size: 64 | 150 | 300 = 150): string => {
  if (!url) return '';
  if (url.includes('mosaic.scdn.co')) {
    return url.replace('mosaic.scdn.co/640/', `mosaic.scdn.co/${size <= 80 ? '60' : '300'}/`);
  }
  let cleaned = url;
  if (size <= 80) {
    // 64x64 tiny thumbnail for track list rows & queue
    cleaned = cleaned
      .replace(/\/ab67616d[0-9a-f]{8}([0-9a-f]{24})/i, '/ab67616d00004851$1')
      .replace(/\/ab67706f[0-9a-f]{8}([0-9a-f]{24})/i, '/ab67706f00004851$1')
      .replace(/\/ab676161[0-9a-f]{8}([0-9a-f]{24})/i, '/ab67616100004851$1')
      .replace(/\/ab67706c[0-9a-f]{8}([0-9a-f]{24})/i, '/ab67706c00004851$1')
      .replace(/\/ab67706d[0-9a-f]{8}([0-9a-f]{24})/i, '/ab67706d00004851$1')
      .replace('600x600bb', '100x100bb')
      .replace(/\/500x500-000000-80-0-0\.jpg/i, '/120x120-000000-80-0-0.jpg');
  } else {
    // 300x300 for grid cards
    cleaned = cleaned
      .replace(/\/ab67616d[0-9a-f]{8}([0-9a-f]{24})/i, '/ab67616d00001e02$1')
      .replace(/\/ab67706f[0-9a-f]{8}([0-9a-f]{24})/i, '/ab67706f00001e02$1')
      .replace(/\/ab676161[0-9a-f]{8}([0-9a-f]{24})/i, '/ab67616100005174$1')
      .replace(/\/ab67706c[0-9a-f]{8}([0-9a-f]{24})/i, '/ab67706c0000da84$1')
      .replace(/\/ab67706d[0-9a-f]{8}([0-9a-f]{24})/i, '/ab67706d00001e02$1')
      .replace('600x600bb', '250x250bb')
      .replace(/\/500x500-000000-80-0-0\.jpg/i, '/250x250-000000-80-0-0.jpg');
  }
  return cleaned;
};
