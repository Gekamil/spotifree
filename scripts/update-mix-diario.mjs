import fs from 'node:fs';
import path from 'node:path';

function toHDImage(url) {
  if (!url) return 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg';
  return url
    .replace('/ab67616d000011eb/', '/ab67616d0000b273/')
    .replace('/ab67616d00004851/', '/ab67616d0000b273/')
    .replace('/ab67616d00001e02/', '/ab67616d0000b273/')
    .replace('/ab67616d0000ab87/', '/ab67616d0000b273/')
    .replace('/ab67706c00004851/', '/ab67706c0000d72c/')
    .replace('/ab67706c00001e02/', '/ab67706c0000d72c/')
    .replace('/ab67706c0000dec5/', '/ab67706c0000d72c/')
    .replace('/ab67706f00004851/', '/ab67706f00000002/')
    .replace('/ab67706f000036f3/', '/ab67706f00000002/')
    .replace('mosaic.scdn.co/60/', 'mosaic.scdn.co/640/')
    .replace('mosaic.scdn.co/300/', 'mosaic.scdn.co/640/');
}

async function scrapeEmbed(playlistId) {
  const url = `https://open.spotify.com/embed/playlist/${playlistId}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    }
  });
  const html = await res.text();
  const scriptMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!scriptMatch) return null;
  const data = JSON.parse(scriptMatch[1]);
  const entity = data.props?.pageProps?.state?.data?.entity;
  if (!entity) return null;

  const coverUrl = toHDImage(
    entity.visualIdentity?.image?.[0]?.url ||
    entity.coverArt?.sources?.[0]?.url ||
    'https://misc.scdn.co/liked-songs/liked-songs-640.jpg'
  );

  const tracks = (entity.trackList || []).map((t, idx) => {
    const rawUri = t.uri || '';
    const trackId = rawUri.split(':').pop() || `track-${idx}`;
    const artistNames = t.subtitle ? t.subtitle.split(', ') : ['Spotify'];

    return {
      id: trackId,
      name: t.title,
      artists: artistNames.map((name, i) => ({
        id: `artist-${idx}-${i}`,
        name: name.trim(),
      })),
      album: {
        id: `album-${playlistId}`,
        name: entity.name,
        images: [{ url: coverUrl }],
      },
      duration_ms: t.duration || 180000,
      preview_url: t.audioPreview?.url || null,
      added_at: 'Reciente',
    };
  });

  return {
    id: playlistId,
    name: entity.name,
    description: entity.description || '',
    type: 'playlist',
    images: [{ url: coverUrl }],
    owner: {
      display_name: 'Hecha para Jorgeperezvk',
      id: 'spotify',
    },
    color: '#303030',
    tracks: tracks,
  };
}

async function updateMixDiario() {
  const mixData = await scrapeEmbed('37i9dQZF1E35QYVMBRlDph');
  if (mixData) {
    console.log('Scraped Mix diario 1 with tracks:', mixData.tracks.length);
    const allTracksFile = path.resolve('src/data/allRealPlaylistTracks.json');
    const allTracks = JSON.parse(fs.readFileSync(allTracksFile, 'utf8'));
    allTracks['37i9dQZF1E35QYVMBRlDph'] = mixData;
    allTracks['mix-diario-1'] = mixData;
    allTracks['daily-mix-1'] = mixData;
    fs.writeFileSync(allTracksFile, JSON.stringify(allTracks, null, 2));
    console.log('Saved 50 tracks to allRealPlaylistTracks.json for Mix diario 1!');
  }
}

updateMixDiario().catch(console.error);
