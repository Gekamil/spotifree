import fs from 'fs';

const details = JSON.parse(fs.readFileSync('src/data/playlistDetailsExtracted.json', 'utf8'));

function parseDuration(durationStr) {
  if (!durationStr || !durationStr.includes(':')) return 180000;
  const parts = durationStr.split(':').map(Number);
  if (parts.length === 2) {
    return (parts[0] * 60 + parts[1]) * 1000;
  }
  return 180000;
}

const tracks = details.tracks.map((t, idx) => {
  const durationStr = t.cells && t.cells.length > 5 ? t.cells[5] : '3:30';
  const addedBy = t.cells && t.cells.length > 3 ? t.cells[3] : 'Jorgete';
  const addedAt = t.cells && t.cells.length > 4 ? t.cells[4] : '12 jul 2026';

  return {
    id: `jl-t-${idx + 1}`,
    name: t.title,
    artists: t.artists.map((name, aIdx) => ({ id: `art-${idx}-${aIdx}`, name })),
    album: {
      id: `alb-${idx + 1}`,
      name: t.album,
      images: [{ url: t.img || 'https://i.scdn.co/image/ab67616d000048511a9d42dbbfa5a0b440654321' }]
    },
    duration_ms: parseDuration(durationStr),
    added_at: addedAt,
    added_by: addedBy
  };
});

const fileContent = `// Auto-generated real tracklist for J+L(2026) extracted from Spotify
import type { Track } from '../types/spotify';

export interface CollaborativeTrack extends Track {
  added_by?: string;
}

export const jl2026Tracks: CollaborativeTrack[] = ${JSON.stringify(tracks, null, 2)};
`;

fs.writeFileSync('src/data/jl2026Tracks.ts', fileContent);
console.log(`Generated src/data/jl2026Tracks.ts with ${tracks.length} tracks!`);
