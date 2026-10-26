import fs from 'fs';
import path from 'path';

const artifactDir = 'C:\\Users\\jorge\\.gemini\\antigravity\\brain\\b7d3ec29-c076-4935-90b5-23f42c286313';
const data = JSON.parse(fs.readFileSync(path.join(artifactDir, 'captured-spotify-queries.json'), 'utf8'));

console.log('Total queries:', data.length);
for (const q of data) {
  if (q.operationName) {
    console.log(`\n--- Operation: ${q.operationName} ---`);
    console.log('Variables:', JSON.stringify(q.variables));
    console.log('Data keys:', q.data ? Object.keys(q.data) : 'null');
    if (q.operationName === 'profileAttributes') {
      console.log('Profile:', JSON.stringify(q.data));
    }
    if (q.operationName === 'fetchEntitiesForRecentlyPlayed') {
      console.log('Recently Played:', JSON.stringify(q.data).slice(0, 300));
    }
    if (q.operationName === 'fetchPlaylistMetadata') {
      console.log('Playlist Metadata:', JSON.stringify(q.data).slice(0, 300));
    }
  }
}
