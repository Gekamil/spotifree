import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

describe('v0.2.6 Crossfade purity, Artist Onboarding Photos & Fast Search', () => {
  it('audioEngine.ts guards DJ EQ/filter/fader automation under if (djConfig) and keeps unity gain in standard crossfade', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src/services/audioEngine.ts'), 'utf8');
    assert.ok(src.includes('if (djConfig) {'), 'DJ Web Audio automations must run only when djConfig is active');
    assert.ok(src.includes('Pure standard crossfade (DJ mode OFF)'), 'Normal crossfade branch should restore unity strip gain cleanly');
    assert.ok(src.includes('outStrip.outputNode.gain.setValueAtTime(1.0, now)'), 'Standard crossfade keeps outgoing strip at unity gain');
    assert.ok(src.includes('inStrip.outputNode.gain.setValueAtTime(1.0, now)'), 'Standard crossfade keeps incoming strip at unity gain');
  });

  it('audioEngine.ts pre-cues secondary HTML5 audio deck in preloadUpcomingTracks and reuses it on executeCrossfade', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src/services/audioEngine.ts'), 'utf8');
    assert.ok(src.includes("data-precued-src"), 'audioEngine should track pre-cued secondary HTML5 source URL');
    assert.ok(src.includes('const alreadyPreCued = secAudio.getAttribute'), 'executeCrossfade should reuse already pre-cued HTML5 deck');
  });

  it('TasteOnboardingModal.tsx hydrates and recovers artist photos without broken e-cdns URLs', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src/components/modals/TasteOnboardingModal.tsx'), 'utf8');
    assert.equal(src.includes('e-cdns-images.dzcdn.net'), false, 'Stale e-cdns-images URLs should be replaced');
    assert.ok(src.includes('getArtistPicture'), 'Should import and use live getArtistPicture lookup');
    assert.ok(src.includes('hydrateArtistPhotos'), 'Should hydrate artist photos in parallel batches when opened');
    assert.ok(src.includes('referrerPolicy="no-referrer"'), 'Artist images should include no-referrer policy');
    assert.ok(src.includes('artistRetried'), 'Failed artist images should attempt live getArtistPicture recovery');
    assert.ok(src.includes('/api/spotify/search?q='), 'Onboarding search should route via backend API rather than CORS-blocked browser Deezer fetch');
  });

  it('MobileAddLibraryItemsModal.tsx resolves artist photos in parallel with error recovery', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src/components/mobile/MobileAddLibraryItemsModal.tsx'), 'utf8');
    assert.ok(src.includes('getArtistPicture'), 'Mobile modal should use getArtistPicture');
    assert.ok(src.includes('hydrateDefaults'), 'Mobile modal should hydrate default artist photos on open');
    assert.ok(src.includes('Promise.all('), 'Artist portrait resolution during search must run in parallel');
    assert.ok(src.includes('referrerPolicy="no-referrer"'), 'Mobile modal images should set referrerPolicy="no-referrer"');
  });

  it('Backend search endpoints (api/search.js, server.mjs, vite.config.ts) support fast=1 quick pass', () => {
    for (const rel of ['api/search.js', 'server.mjs', 'vite.config.ts']) {
      const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
      assert.ok(src.includes("searchParams.get('fast') === '1'"), `${rel} must support fast=1 quick search mode`);
    }
  });

  it('spotifyApi.ts implements client memory cache, progressive fast pass, AbortSignal, and skips redundant iTunes/Deezer waterfalls', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src/services/spotifyApi.ts'), 'utf8');
    assert.ok(src.includes('CLIENT_SEARCH_CACHE'), 'Client search cache should avoid repeat round-trips');
    assert.ok(src.includes('onQuickResults'), 'Progressive quick results callback should be supported');
    assert.ok(src.includes('&fast=1'), 'Client should trigger progressive ?fast=1 pass when onQuickResults is provided');
    assert.ok(src.includes('!gotBackendResults && officialRemixes.length < 3'), 'Direct remix fallback should not run redundantly after backend succeeds');
  });

  it('DesktopSearchView.tsx and MobileSearchView.tsx use 130ms debounce, AbortController, and onQuickResults', () => {
    for (const rel of ['src/components/desktop/DesktopSearchView.tsx', 'src/components/mobile/MobileSearchView.tsx']) {
      const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
      assert.ok(src.includes('new AbortController()'), `${rel} should cancel superseded queries`);
      assert.ok(src.includes('onQuickResults:'), `${rel} should render quick partial results immediately`);
      assert.ok(src.includes('}, 130);'), `${rel} should use responsive 130ms search debounce`);
    }
  });
});
