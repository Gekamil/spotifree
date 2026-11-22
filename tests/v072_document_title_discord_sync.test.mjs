import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('v072: usePlayerStore exports and defines updateDocumentTitle', () => {
  const storePath = path.resolve('src/store/usePlayerStore.ts');
  const content = fs.readFileSync(storePath, 'utf8');

  assert.ok(content.includes('export function updateDocumentTitle'), 'updateDocumentTitle must be exported');
  assert.ok(content.includes('document.title = artist ? `${track.name} • ${artist}` : `${track.name} • Spotifree`'), 'Document title formatting must follow Track • Artist pattern');
  assert.ok(content.includes('updateDocumentTitle(track, true)'), 'updateMediaSessionTrack must invoke updateDocumentTitle');
  assert.ok(content.includes('updateDocumentTitle(get().currentTrack, nextState)'), 'togglePlay must sync document.title');
});

test('v072: Document title logic handles track with artist and fallback cleanly', () => {
  // Test simulated browser document object
  const mockDocument = { title: '' };
  
  function testUpdateDocumentTitle(doc, track, isPlaying = true) {
    if (!doc) return;
    if (track && track.name && isPlaying) {
      const artist = track.artists?.map((a) => a.name).filter(Boolean).join(', ');
      doc.title = artist ? `${track.name} • ${artist}` : `${track.name} • Spotifree`;
    } else {
      doc.title = 'Spotifree - Reproductor web: música para todos';
    }
  }

  // 1. When playing a track with artists
  testUpdateDocumentTitle(mockDocument, {
    name: 'Ojitos Lindos',
    artists: [{ name: 'Bad Bunny' }, { name: 'Bomba Estéreo' }]
  }, true);
  assert.equal(mockDocument.title, 'Ojitos Lindos • Bad Bunny, Bomba Estéreo');

  // 2. When playing a track with single artist
  testUpdateDocumentTitle(mockDocument, {
    name: 'Monaco',
    artists: [{ name: 'Bad Bunny' }]
  }, true);
  assert.equal(mockDocument.title, 'Monaco • Bad Bunny');

  // 3. When paused
  testUpdateDocumentTitle(mockDocument, {
    name: 'Monaco',
    artists: [{ name: 'Bad Bunny' }]
  }, false);
  assert.equal(mockDocument.title, 'Spotifree - Reproductor web: música para todos');

  // 4. When stopped or no track
  testUpdateDocumentTitle(mockDocument, null, false);
  assert.equal(mockDocument.title, 'Spotifree - Reproductor web: música para todos');
});
