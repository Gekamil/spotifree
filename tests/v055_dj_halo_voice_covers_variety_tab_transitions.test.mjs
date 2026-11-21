import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('Spotifree v0.5.5: Non-Spinning Concentric DJ Halo, Guaranteed DJ Voice, Mix Cover Variety & Instant Tab Transitions', () => {
  const visualizerSource = fs.readFileSync(path.resolve('src/components/dj/SpotifyDJVisualizer.tsx'), 'utf-8');
  const aiDJViewSource = fs.readFileSync(path.resolve('src/components/dj/AIDJView.tsx'), 'utf-8');
  const mobileLayoutSource = fs.readFileSync(path.resolve('src/components/mobile/MobileLayout.tsx'), 'utf-8');
  const voiceServiceSource = fs.readFileSync(path.resolve('src/services/aiDJVoiceService.ts'), 'utf-8');
  const spotifreeMixesSource = fs.readFileSync(path.resolve('src/services/spotifreeMixes.ts'), 'utf-8');
  const indexCssSource = fs.readFileSync(path.resolve('src/index.css'), 'utf-8');

  it('1. Spotify DJ Halo Visualizer: Standing wave breathing with ZERO rotational spinning & concentric waves active', () => {
    // Non-spinning: standing waves using Math.sin(theta * 2) * Math.cos(time * ...) instead of Math.sin(theta - time)
    assert.ok(
      visualizerSource.includes('Math.sin(theta * 2) * Math.cos('),
      'Must use standing harmonic without travelling angular phase to eliminate rotation'
    );
    assert.ok(
      !visualizerSource.includes('Math.sin(theta * 2 - (mini ? time'),
      'Must not subtract time directly from theta * k which causes spinning'
    );
    // Concentric delaminated waves always present matching Spotify DJ Screenshot 1
    assert.ok(
      visualizerSource.includes('baseSplit = 0.88') || visualizerSource.includes('baseSplit = 0.8'),
      'Must maintain multi-wave delamination active even when idle'
    );
    // Canvas styling: transparent background and no borders
    assert.ok(
      visualizerSource.includes('background: \'transparent\''),
      'Canvas must explicitly have transparent background'
    );
  });

  it('2. DJ Access & Voice Guarantee: Unauthenticated access permitted, audio unlocked on mobile tap', () => {
    // MobileLayout allows DJ entrance without forcing login modal
    const djIdx = mobileLayoutSource.indexOf("isAIDJPlaylist({ id: cleanId");
    const authIdx = mobileLayoutSource.indexOf("if (!isAuthenticated) {\n      openLoginModal();");
    assert.ok(djIdx !== -1, 'Must check isAIDJPlaylist in handleSelectPlaylistById');
    assert.ok(authIdx !== -1, 'Must check isAuthenticated');
    assert.ok(djIdx < authIdx, 'isAIDJPlaylist must be evaluated BEFORE checking isAuthenticated to avoid blocking');

    // Unlocks audio context on user gesture
    assert.ok(
      mobileLayoutSource.includes('aiDJVoiceService.unlockAudioForMobile()'),
      'MobileLayout must unlock audio on DJ tap'
    );
    assert.ok(
      aiDJViewSource.includes('aiDJVoiceService.unlockAudioForMobile()'),
      'AIDJView must unlock audio on mount'
    );
    assert.ok(
      aiDJViewSource.includes('startDJSession(true, { speakFirst: true })'),
      'AIDJView must trigger fresh speech session when mounted'
    );
  });

  it('3. Speech Fallback: speechSynthesis fallback active unconditionally without voices length barrier', () => {
    assert.ok(
      voiceServiceSource.includes("'speechSynthesis' in window"),
      'Must check speechSynthesis support'
    );
    assert.ok(
      !voiceServiceSource.includes("window.speechSynthesis.getVoices().length > 0;\n      if (hasDeviceVoice)"),
      'Must not block speechSynthesis fallback if getVoices() has not loaded asynchronously yet'
    );
  });

  it('4. Spotifree Mix Covers: Rich visual variety with Real Song Photos (Banner, Badge, Collage)', () => {
    // 3 distinct generator styles
    assert.ok(spotifreeMixesSource.includes('makeBannerCoverSvg'), 'Must export makeBannerCoverSvg');
    assert.ok(spotifreeMixesSource.includes('makeCollageCoverSvg'), 'Must export makeCollageCoverSvg');
    assert.ok(spotifreeMixesSource.includes('makeGeometricCoverSvg'), 'Must export makeGeometricCoverSvg');

    // Banner style: real song photo + bottom rectangular banner
    assert.ok(spotifreeMixesSource.includes('barH =') || spotifreeMixesSource.includes('bannerH ='), 'Must draw bottom rectangular banner');
    assert.ok(spotifreeMixesSource.includes('drawImageAspectCover'), 'Must crop and draw song image cleanly');

    // Daily mixes rotate through styles with banner dominant
    assert.ok(
      spotifreeMixesSource.includes('dailyStyles: CoverStyle[] ='),
      'Daily mixes must cycle through styles'
    );
  });

  it('5. Instant Tab Switching: Tabs kept mounted in DOM with simultaneous fast reveal (.spf-tab-fade)', () => {
    // index.css defines spfTabFade
    assert.ok(indexCssSource.includes('@keyframes spfTabFade'), 'Must define spfTabFade keyframes');
    assert.ok(indexCssSource.includes('.spf-tab-fade'), 'Must define .spf-tab-fade class');

    // MobileLayout keeps tabs mounted in DOM instead of unmounting and destroying them
    assert.ok(
      mobileLayoutSource.includes("className={mobileTab === 'home' && !seeAllShelf ? 'min-h-full transition-colors duration-500 spf-tab-fade relative bg-[#121212]' : 'hidden'}"),
      'Home tab must stay mounted and toggle visibility with hidden class'
    );
    assert.ok(
      mobileLayoutSource.includes("className={mobileTab === 'search' ? 'px-4 pt-2 pb-28 spf-tab-fade' : 'hidden'}"),
      'Search tab must stay mounted and toggle visibility with hidden class'
    );
    assert.ok(
      mobileLayoutSource.includes("className={mobileTab === 'library' ? 'px-4 pt-2.5 pb-28 space-y-2.5 spf-tab-fade' : 'hidden'}"),
      'Library tab must stay mounted and toggle visibility with hidden class'
    );
  });
});
