import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  classifySoundCloudVariant,
  findMatchingOfficialTrackIndex,
  scoreInstrumentalCandidate,
  normalizeSoundCloudArtwork,
  scItemToSpotifreeTrack,
} from '../api/_lib/musicFallback.js';

describe('SoundCloud Variant Classification, Official Deduplication & Instrumental Karaoke Gate', () => {
  it('classifies SoundCloud tracks into remix, slowed, leak, live, instrumental, and official_like', () => {
    assert.equal(classifySoundCloudVariant('Bad Bunny - Monaco (WILL K Remix)').variant, 'remix');
    assert.equal(classifySoundCloudVariant('The Weeknd - After Hours (Slowed + Reverb)').variant, 'slowed');
    assert.equal(classifySoundCloudVariant('Sped Up Nightcore Version').variant, 'slowed');
    assert.equal(classifySoundCloudVariant('The Weeknd - Take Me Back To LA (Unreleased Leak Demo)').variant, 'leak');
    assert.equal(classifySoundCloudVariant('Track Inédita 2026').variant, 'leak');
    assert.equal(classifySoundCloudVariant('Live at Wembley Concert Session').variant, 'live');
    assert.equal(classifySoundCloudVariant('Blinding Lights [Sin Voces] (Instrumental)').variant, 'instrumental');
    assert.equal(classifySoundCloudVariant('The Weeknd - Blinding Lights').variant, 'official_like');
  });

  it('detects literal official duplicates while preserving remixes, slowed versions, and leaks', () => {
    const officialTracks = [
      {
        id: 'dz-1001',
        name: 'Blinding Lights',
        duration_ms: 200_000,
        artists: [{ name: 'The Weeknd' }],
      },
      {
        id: 'dz-1002',
        name: 'Starboy',
        duration_ms: 230_000,
        artists: [{ name: 'The Weeknd' }],
      },
    ];

    // Exact official duplicate -> matches index 0
    assert.equal(
      findMatchingOfficialTrackIndex(
        {
          id: 555001,
          title: 'Blinding Lights',
          user: { username: 'The Weeknd' },
          duration: 202_000,
        },
        officialTracks
      ),
      0
    );

    // Slowed version -> MUST NOT be suppressed as an official duplicate
    assert.equal(
      findMatchingOfficialTrackIndex(
        {
          id: 555002,
          title: 'Blinding Lights (Slowed + Reverb)',
          user: { username: 'The Weeknd' },
          duration: 235_000,
        },
        officialTracks
      ),
      -1
    );

    // Remix -> MUST NOT be suppressed
    assert.equal(
      findMatchingOfficialTrackIndex(
        {
          id: 555003,
          title: 'The Weeknd - Starboy (Kygo Remix)',
          user: { username: 'Kygo' },
          duration: 245_000,
        },
        officialTracks
      ),
      -1
    );

    // Unreleased / leak -> MUST NOT be suppressed
    assert.equal(
      findMatchingOfficialTrackIndex(
        {
          id: 555004,
          title: 'Hold Your Heart (Unreleased Leak)',
          user: { username: 'XO Vault' },
          duration: 195_000,
        },
        officialTracks
      ),
      -1
    );
  });

  it('formats SoundCloud artwork in high resolution and maps Spotifree track metadata cleanly', () => {
    assert.equal(
      normalizeSoundCloudArtwork('https://i1.sndcdn.com/artworks-abc123-large.jpg'),
      'https://i1.sndcdn.com/artworks-abc123-t500x500.jpg'
    );
    const trk = scItemToSpotifreeTrack({
      id: 1970101443,
      title: 'Bad Bunny - Monaco (WILL K Remix)',
      duration: 180_000,
      artwork_url: 'https://i1.sndcdn.com/artworks-xyz-large.jpg',
      permalink_url: 'https://soundcloud.com/example/monaco-remix',
      user: { id: 99, username: 'WILL K' },
      tag_list: 'remix',
    });
    assert.equal(trk.id, 'sc-1970101443');
    assert.equal(trk.scVariant, 'remix');
    assert.equal(trk.scVariantLabel, 'Remix');
    assert.equal(trk.album.images[0].url, 'https://i1.sndcdn.com/artworks-xyz-t500x500.jpg');
  });

  it('strictly verifies instrumental ("sin voces") tracks and rejects non-instrumental / vocal covers', () => {
    const target = { title: 'Blinding Lights', artist: 'The Weeknd', expectedDurationSec: 200 };

    // Valid instrumental / sin voces tracks pass
    assert.equal(
      scoreInstrumentalCandidate(
        { candTitle: 'Blinding Lights (Official Instrumental)', candArtist: 'The Weeknd', candDurationSec: 201 },
        target
      ).matched,
      true
    );
    assert.equal(
      scoreInstrumentalCandidate(
        { candTitle: 'The Weeknd - Blinding Lights [Sin Voces] Karaoke', candArtist: 'Karaoke Backing Track', candDurationSec: 198 },
        target
      ).matched,
      true
    );

    // Normal vocal track MUST BE REJECTED (so mic button never shows falsely)
    assert.equal(
      scoreInstrumentalCandidate(
        { candTitle: 'Blinding Lights', candArtist: 'The Weeknd', candDurationSec: 200 },
        target
      ).matched,
      false
    );

    // Solo piano/guitar cover / acapella / slowed / bad duration MUST BE REJECTED
    assert.equal(
      scoreInstrumentalCandidate(
        { candTitle: 'Blinding Lights - Piano Cover Instrumental', candArtist: 'Piano Player', candDurationSec: 200 },
        target
      ).matched,
      false
    );
    assert.equal(
      scoreInstrumentalCandidate(
        { candTitle: 'Blinding Lights (Acapella Only Vocals)', candArtist: 'The Weeknd', candDurationSec: 200 },
        target
      ).matched,
      false
    );
    assert.equal(
      scoreInstrumentalCandidate(
        { candTitle: 'Blinding Lights Instrumental (Slowed + Reverb)', candArtist: 'Anon', candDurationSec: 200 },
        target
      ).matched,
      false
    );
    assert.equal(
      scoreInstrumentalCandidate(
        { candTitle: 'Blinding Lights (Instrumental)', candArtist: 'The Weeknd', candDurationSec: 95 },
        target
      ).matched,
      false
    );
  });

  it('wires Karaoke microphone strictly behind instrumental availability and reduced-motion CSS', () => {
    const fullscreenSrc = fs.readFileSync('src/components/mobile/LyricsFullscreen.tsx', 'utf8');
    const sidebarSrc = fs.readFileSync('src/components/desktop/DesktopRightSidebar.tsx', 'utf8');
    const micBtnSrc = fs.readFileSync('src/components/common/KaraokeMicButton.tsx', 'utf8');
    const cssSrc = fs.readFileSync('src/index.css', 'utf8');
    const engineSrc = fs.readFileSync('src/services/audioEngine.ts', 'utf8');

    assert.ok(fullscreenSrc.includes('{karaoke.available && ('), 'Fullscreen lyrics hides mic unless available');
    assert.ok(sidebarSrc.includes('{karaoke.available && ('), 'Desktop lyrics hides mic unless available');
    assert.ok(micBtnSrc.includes('aria-pressed={active}'), 'Mic button exposes toggle state');
    assert.ok(cssSrc.includes('@media (prefers-reduced-motion: no-preference)'), 'Mic animation honors prefers-reduced-motion');
    assert.ok(engineSrc.includes('scDirectMatch') && engineSrc.includes('checkInstrumentalSource') && engineSrc.includes('toggleKaraokeMode'));
  });
});
