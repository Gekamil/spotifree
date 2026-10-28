import fs from 'node:fs';

const data = JSON.parse(fs.readFileSync('src/data/liveExtractedSession.json', 'utf8'));

console.log('Sample track items in liveExtractedSession:');
let foundTracks = [];
data.playlists.forEach(p => {
  if (p.tracks?.items?.length) {
    foundTracks = foundTracks.concat(p.tracks.items);
  }
});
console.log('Total tracks across playlists in file:', foundTracks.length);
if (data.topTracks?.length) {
  console.log('Top tracks in file:', data.topTracks.length, data.topTracks.slice(0, 3).map(t => t.name));
}
