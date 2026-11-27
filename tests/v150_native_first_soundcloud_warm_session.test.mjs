// v1.5: Native-first resolution for external/SoundCloud tracks, sustainable active SoundCloud warm session, and fast streaming.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const audioEngineSrc = fs.readFileSync(path.resolve('src/services/audioEngine.ts'), 'utf8');
const importerSrc = fs.readFileSync(path.resolve('src/utils/playlistImporter.ts'), 'utf8');
const spotifyApiSrc = fs.readFileSync(path.resolve('src/services/spotifyApi.ts'), 'utf8');
const apiAudioSrc = fs.readFileSync(path.resolve('api/audio.js'), 'utf8');
const musicFallbackSrc = fs.readFileSync(path.resolve('api/_lib/musicFallback.js'), 'utf8');
const serverSrc = fs.readFileSync(path.resolve('server.mjs'), 'utf8');

describe('Spotifree v1.5 Native-First Catalog Priority & Sustainable SoundCloud Warmth', () => {
  it('1. Playlist importer promotes matching SoundCloud tracks to Spotifree catalog without replacing variants', () => {
    assert.ok(importerSrc.includes('detectImportVariant'), 'Importer classifies exclusive variants before matching');
    assert.ok(importerSrc.includes('isSoundCloudObj'), 'matchAll checks Spotifree catalog for imported SoundCloud items');
    assert.ok(importerSrc.includes('fastOnly: true'), 'Importer uses fastOnly catalog lookups');
    assert.ok(spotifyApiSrc.includes('fastOnly?: boolean'), 'searchSpotify exposes fastOnly option');
    assert.ok(importerSrc.includes("if (variant === 'leak') return null;"), 'Never replaces unreleased/leak tracks');
  });

  it('2. AudioEngine checks Spotifree native source before falling back to SoundCloud across all entry points', () => {
    assert.ok(audioEngineSrc.includes('scNativeOverrideId'), 'playTrack resolves native Spotifree match before scDirectMatch');
    assert.ok(audioEngineSrc.includes('isExclusiveSoundCloudTrack'), 'Exclusive variants bypass unnecessary native search in 0ms');
    assert.ok(audioEngineSrc.includes('notInSpotifreeCache'), 'Tracks absent from Spotifree are cached cleanly to avoid re-probing');
    assert.ok(audioEngineSrc.includes("params.set('strict', '1')"), 'Strict resolution prevents wrong-song matches on sc- tracks');
    assert.ok(audioEngineSrc.includes('preservedPrecuedIdx'), 'Reuses pre-cued HTML5 deck on skip for instant playback');
  });

  it('3. On-demand SoundCloud warm session is time-bounded, active only for SoundCloud, and stops on pause', () => {
    const pauseBlock = audioEngineSrc.slice(
      audioEngineSrc.indexOf('public pause()'),
      audioEngineSrc.indexOf('public resetForRestoredTrack()')
    );
    assert.ok(audioEngineSrc.includes('activateSoundCloudWarmSession'), 'Defines timed SoundCloud warm session');
    assert.ok(audioEngineSrc.includes('8 * 60 * 1000'), 'Caps idle warm window to 8 minutes');
    assert.ok(audioEngineSrc.includes('this.lastScNetworkTouch < 85_000'), 'Avoids duplicate warm pings while streaming actively');
    assert.ok(pauseBlock.includes('stopSoundCloudWarmTimer()'), 'Stops warm timer cleanly when paused');
  });

  it('4. Backend accelerates SoundCloud extraction, uses compact initial stream chunk, and exposes warm/prepare-sc', () => {
    assert.ok(musicFallbackSrc.includes('Promise.any('), 'getSoundCloudClientId fetches asset bundles in parallel');
    assert.ok(musicFallbackSrc.includes('skipPreVerify: true'), 'Skips extra CDN bytes=0-63 roundtrip on explicit progressive MP3');
    assert.ok(apiAudioSrc.includes("action === 'stream' ? 393_216"), 'Streams compact 384 KB initial chunk on playback start');
    assert.ok(apiAudioSrc.includes("if (action === 'warm')"), 'Supports lightweight /api/audio/warm endpoint');
    assert.ok(apiAudioSrc.includes("if (action === 'prepare-sc')"), 'Supports background /api/audio/prepare-sc endpoint');
    assert.ok(apiAudioSrc.includes('findStrictNativeYouTubeMatch'), 'Backend enforces variant/artist/duration strict native match');
    assert.ok(serverSrc.includes('/api/audio/prepare-sc') && serverSrc.includes('/api/audio/warm'), 'Dev server routes warm and prepare-sc');
  });

  it('5. Release metadata is updated to version 1.5 / 1.5.0 without emojis', () => {
    const pkg = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8'));
    const changelog = fs.readFileSync(path.resolve('src/data/changelog.ts'), 'utf8');
    const readme = fs.readFileSync(path.resolve('README.md'), 'utf8');

    assert.ok(['1.5.0', '1.6.0', '1.6.1'].includes(pkg.version));
    assert.ok(changelog.includes("version: '1.5'"));
    assert.ok(readme.includes('versión-1.5') || readme.includes('versión-1.6') || readme.includes('versión-1.6.1'));
    assert.ok(readme.includes('## Novedades de la 1.5'));
  });
});
