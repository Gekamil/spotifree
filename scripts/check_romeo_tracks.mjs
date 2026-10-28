import fs from 'node:fs';

const data = JSON.parse(fs.readFileSync('src/data/liveExtractedSession.json', 'utf8'));
const pl = data.playlists?.find(p => p.id === '43GWp9FbN9nHihudedyVQM' || p.name.includes('Romeo'));
console.log('Playlist in session:', pl?.name, pl?.id, 'tracks total:', pl?.tracks?.total, 'items length:', pl?.tracks?.items?.length);
if (pl?.tracks?.items?.length) {
  console.log('Sample tracks:', pl.tracks.items.slice(0, 5).map(t => t.name));
}
