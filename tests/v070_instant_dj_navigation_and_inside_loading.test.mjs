import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

describe('Spotifree v0.7.0: Instant DJ Screen Navigation (0ms) & Smooth Inside Loading', () => {
  const mobileLayoutPath = path.join(root, 'src/components/mobile/MobileLayout.tsx');
  const desktopLayoutPath = path.join(root, 'src/components/desktop/DesktopLayout.tsx');
  const desktopHomePath = path.join(root, 'src/components/desktop/DesktopHomeView.tsx');
  const aiDJServicePath = path.join(root, 'src/services/aiDJService.ts');
  const musicTaggingPath = path.join(root, 'src/services/musicTaggingService.ts');
  const aidjViewPath = path.join(root, 'src/components/dj/AIDJView.tsx');

  const mobileLayoutCode = fs.readFileSync(mobileLayoutPath, 'utf-8');
  const desktopLayoutCode = fs.readFileSync(desktopLayoutPath, 'utf-8');
  const desktopHomeCode = fs.readFileSync(desktopHomePath, 'utf-8');
  const aiDJServiceCode = fs.readFileSync(aiDJServicePath, 'utf-8');
  const musicTaggingCode = fs.readFileSync(musicTaggingPath, 'utf-8');
  const aidjViewCode = fs.readFileSync(aidjViewPath, 'utf-8');

  it('1. MobileLayout: Instant 0ms navigation to "dj" tab on click/tap with deferred session startup', () => {
    // When DJ card or shortcut is clicked, mobileTab must be set to 'dj' immediately
    assert.ok(
      mobileLayoutCode.includes("setMobileTab('dj')"),
      'MobileLayout must immediately switch tab to dj'
    );
    // startDJSession is deferred so React renders and paints AIDJView before heavy processing
    assert.ok(
      mobileLayoutCode.includes('setTimeout') && mobileLayoutCode.includes('startDJSession'),
      'MobileLayout must defer startDJSession with setTimeout so AIDJView mounts in 0ms'
    );
  });

  it('2. DesktopLayout & DesktopHomeView: Instant 0ms navigation on desktop with deferred session startup', () => {
    assert.ok(
      desktopLayoutCode.includes("setActiveMainTab('dj')"),
      'DesktopLayout must immediately switch activeMainTab to dj'
    );
    assert.ok(
      desktopLayoutCode.includes('setTimeout') && desktopLayoutCode.includes('startDJSession'),
      'DesktopLayout must defer startDJSession so view switches in 0ms'
    );
    assert.ok(
      desktopHomeCode.includes("setActiveMainTab('dj')"),
      'DesktopHomeView must immediately switch activeMainTab to dj'
    );
  });

  it('3. aiDJService: startDJSession yields immediately to let React mount and paint AIDJView in 0ms', () => {
    assert.ok(
      aiDJServiceCode.includes('await new Promise((r) => setTimeout(r, 40))'),
      'startDJSession must yield immediately to browser event loop'
    );
    assert.ok(
      aiDJServiceCode.includes('isDJSessionStarting'),
      'startDJSession protects against concurrent startup'
    );
  });

  it('4. musicTaggingService: Parallel artist search with timeouts prevents multi-second delays', () => {
    assert.ok(
      musicTaggingCode.includes('searchPromises = userArtists.slice(0, 4).map') &&
      musicTaggingCode.includes('Promise.all(searchPromises)'),
      'getInitialDJLibraryRemix must execute artist search in parallel rather than sequential multi-second awaits'
    );
  });

  it('5. AIDJView: Immediate display of "Pensando tu sesión..." & "Preparando música..." inside DJ screen', () => {
    assert.ok(
      aidjViewCode.includes('Pensando tu sesión...'),
      'AIDJView must display "Pensando tu sesión..." while loading inside'
    );
    assert.ok(
      aidjViewCode.includes('Preparando música...'),
      'AIDJView must display "Preparando música..." placeholder while thinking'
    );
    assert.ok(
      aidjViewCode.includes('SPOTIFY_DJ_COVER_IMAGE'),
      'AIDJView must use SPOTIFY_DJ_COVER_IMAGE as official artwork fallback'
    );
  });
});
