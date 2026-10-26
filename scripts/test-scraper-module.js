export async function fetchPlaylistFromEmbed(playlistId) {
  const cleanId = playlistId.replace(/^spotify:playlist:/, '').split('?')[0];

  const url = `https://open.spotify.com/embed/playlist/${cleanId}`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch embed: HTTP ${response.status}`);
  }

  const html = await response.text();
  const scriptMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!scriptMatch) {
    throw new Error('Embed NEXT_DATA not found');
  }

  const data = JSON.parse(scriptMatch[1]);
  const entity = data.props?.pageProps?.state?.data?.entity;

  if (!entity) {
    throw new Error('Playlist entity not found in embed');
  }

  const tracks = (entity.trackList || []).map((t, idx) => {
    const rawUri = t.uri || '';
    const trackId = rawUri.split(':').pop() || `track-${idx}`;
    return {
      id: trackId,
      name: t.title,
      artists: (t.subtitle ? t.subtitle.split(', ') : ['Varios Artistas']).map((name, i) => ({
        id: `artist-${i}`,
        name: name.trim(),
      })),
      album: {
        id: `album-${cleanId}`,
        name: entity.name,
        images: entity.visualIdentity?.image?.length > 0
          ? entity.visualIdentity.image
          : [{ url: 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg' }],
      },
      duration_ms: t.duration || 180000,
      preview_url: t.audioPreview?.url || null,
      added_at: '2025-01-01',
    };
  });

  return {
    id: cleanId,
    name: entity.name,
    description: entity.description || '',
    images: entity.visualIdentity?.image?.length > 0
      ? entity.visualIdentity.image
      : [{ url: 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg' }],
    owner: {
      display_name: entity.owner?.name || 'Spotify',
      id: entity.owner?.id || 'spotify',
    },
    color: '#303030',
    tracks: {
      total: tracks.length,
      items: tracks,
    },
  };
}
