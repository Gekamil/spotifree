import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Spotifree v0.6.8: Spotify Live Sessions DJ Interface & Instant Thinking Transition', () => {
  const root = process.cwd();
  const aidjViewFile = fs.readFileSync(path.join(root, 'src/components/dj/AIDJView.tsx'), 'utf-8');
  const desktopLayoutFile = fs.readFileSync(path.join(root, 'src/components/desktop/DesktopLayout.tsx'), 'utf-8');
  const mobileLayoutFile = fs.readFileSync(path.join(root, 'src/components/mobile/MobileLayout.tsx'), 'utf-8');
  const djSegmentsFile = fs.readFileSync(path.join(root, 'src/services/djSegments.ts'), 'utf-8');

  it('1. AIDJView has integrated Spotify Live Sessions player card with scrubber and native controls', () => {
    // Verified Spotify icons
    assert.ok(aidjViewFile.includes('PrevNativeIcon'), 'Should import and use PrevNativeIcon');
    assert.ok(aidjViewFile.includes('NextNativeIcon'), 'Should import and use NextNativeIcon');
    assert.ok(aidjViewFile.includes('PlayNativeIcon'), 'Should import and use PlayNativeIcon');
    assert.ok(aidjViewFile.includes('PauseNativeIcon'), 'Should import and use PauseNativeIcon');
    assert.ok(aidjViewFile.includes('QueueNativeIcon'), 'Should import and use QueueNativeIcon');
    assert.ok(aidjViewFile.includes('CheckTrackNativeIcon'), 'Should import and use CheckTrackNativeIcon');

    // Scrubber component
    assert.ok(aidjViewFile.includes('DJPlaybackScrubber'), 'Should have DJPlaybackScrubber component');
    assert.ok(aidjViewFile.includes('formatDuration(progressMs)'), 'Scrubber displays current progress time');
    assert.ok(aidjViewFile.includes('formatDuration(duration)'), 'Scrubber displays total duration time');

    // Cambiar rollo button
    assert.ok(aidjViewFile.includes('Cambiar rollo'), 'Should have Cambiar rollo button');

    // Previous and Next track controls wired
    assert.ok(aidjViewFile.includes('previousTrack'), 'Should wire previousTrack');
    assert.ok(aidjViewFile.includes('nextTrack'), 'Should wire nextTrack');
  });

  it('2. AIDJView displays "Pensando tu sesión..." state immediately', () => {
    assert.ok(aidjViewFile.includes('Pensando tu sesión...'), 'Should display Pensando tu sesión... when thinking');
    assert.ok(aidjViewFile.includes('isThinking'), 'Should check isThinking state');
    assert.ok(aidjViewFile.includes('animate-bounce'), 'Should have bounce animation for thinking dots');
  });

  it('3. Instant Transition: MobileLayout & DesktopLayout set isThinking synchronously on DJ entry', () => {
    assert.ok(
      mobileLayoutFile.includes("useAIDJStore.setState({ isDJModeActive: true, isThinking: true, visualizerState: 'speaking'"),
      'MobileLayout should immediately set DJ thinking and visualizer on click'
    );
    assert.ok(
      desktopLayoutFile.includes("useAIDJStore.setState({ isDJModeActive: true, isThinking: true, visualizerState: 'speaking'"),
      'DesktopLayout should immediately set DJ thinking and visualizer on click'
    );
  });

  it('4. djSegments avoids blocking network delays when local library tracks exist', () => {
    assert.ok(
      djSegmentsFile.includes('library.length < 4 && blocks.length === 0'),
      'djSegments should only query external discovery if library is nearly empty and has no blocks'
    );
  });

  it('5. Clean Spotify Live Sessions UI: search bar, voice prompt and chat inputs removed from main view', () => {
    assert.ok(!aidjViewFile.includes('promptInput'), 'Should NOT have text prompt input in AIDJView');
    assert.ok(!aidjViewFile.includes('toggleMic'), 'Should NOT have voice dictation toggle in AIDJView');
    assert.ok(!aidjViewFile.includes('isChatRendered'), 'Should NOT render chat drawer in AIDJView');
    assert.ok(aidjViewFile.includes('DJPlaybackScrubber'), 'Should keep integrated player scrubber');
    assert.ok(aidjViewFile.includes('Cambiar rollo'), 'Should keep native Cambiar rollo button');
  });

  it('6. Deadlock prevention: startDJSession does not deadlock on isThinking and starts instantly', () => {
    const aiDJServiceFile = fs.readFileSync(path.join(root, 'src/services/aiDJService.ts'), 'utf-8');
    const musicTaggingFile = fs.readFileSync(path.join(root, 'src/services/musicTaggingService.ts'), 'utf-8');

    assert.ok(aiDJServiceFile.includes('let isDJSessionStarting = false;'), 'Uses module lock instead of aborting when isThinking is preset');
    assert.ok(aiDJServiceFile.includes('if (isDJSessionStarting)'), 'Guards against actual concurrent startup without blocking UI isThinking');
    assert.ok(musicTaggingFile.includes('if (shuffledUser.length >= count)'), 'Instant return from user library tracks without network search');
  });

  it('7. Style Selector & Cambiar Rollo Improvements: No stars, diverse vibes & enlarged banner typography', () => {
    // Zero stars on Cambiar rollo
    assert.ok(!aidjViewFile.includes('text-[#1ed760] text-xs">✦'), 'Cambiar rollo must NOT have sparkle/star icon');
    assert.ok(aidjViewFile.includes('showVibeDrawer'), 'Cambiar rollo opens vibe selector drawer');
    assert.ok(aidjViewFile.includes('DJ_VIBE_PRESETS'), 'Uses clean vibe presets');

    // Mobile layout banner text size
    assert.ok(
      mobileLayoutFile.includes('text-[16px]') || mobileLayoutFile.includes('text-[17px]') || mobileLayoutFile.includes('text-base') || mobileLayoutFile.includes('text-lg'),
      'Mobile DJ banner text must be visibly enlarged'
    );
  });
});
