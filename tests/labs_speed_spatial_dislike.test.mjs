import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

describe('v0.2.8 Spotifree Labs: Playback Speed, Spatial 3D / Mono & Unified Dislike System', () => {
  it('labsService.ts exports all state keys, helpers, and taste rating utilities', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src/services/labsService.ts'), 'utf8');
    assert.ok(src.includes('useLabsStore = create<LabsState>'), 'Must declare useLabsStore with Zustand');
    assert.ok(src.includes('setPlaybackSpeed:'), 'Must provide setPlaybackSpeed action');
    assert.ok(src.includes('setPreservesPitch:'), 'Must provide setPreservesPitch action');
    assert.ok(src.includes('setAudioMono:'), 'Must provide setAudioMono action');
    assert.ok(src.includes('setSpatialPosition:'), 'Must provide setSpatialPosition action');
    assert.ok(src.includes('markTasteDislike:'), 'Must provide markTasteDislike action');
    assert.ok(src.includes('isTrackDisliked'), 'Must export isTrackDisliked helper');
    assert.ok(src.includes('isTrackLikedTaste'), 'Must export isTrackLikedTaste helper');
  });

  it('AdvancedSettingsSection.tsx preserves desktop flat row dividers and mobile cards with accessibility roles', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src/components/common/AdvancedSettingsSection.tsx'), 'utf8');
    assert.ok(src.includes('role="switch"'), 'Must have switch role');
    assert.ok(src.includes('role="radiogroup"'), 'Must have radiogroup role');
    assert.ok(src.includes('role="radio"'), 'Must have radio role');
    assert.ok(src.includes('aria-checked='), 'Must have aria-checked attributes');
    assert.ok(src.includes('Modo Labs (Spotifree Labs)'), 'Must contain Modo Labs toggle in desktop mode');

    // Desktop block analysis
    const desktopIndex = src.indexOf('if (desktop) {');
    const desktopEndIndex = src.indexOf('\n  return (', desktopIndex);
    assert.ok(desktopIndex >= 0 && desktopEndIndex > desktopIndex, 'Must have desktop guard before mobile return');

    const desktopBlock = src.substring(desktopIndex, desktopEndIndex);
    assert.ok(desktopBlock.includes('border-b border-white/5'), 'Desktop mode must use flat row border-b border-white/5');
    assert.ok(!desktopBlock.includes('rounded-xl bg-[#181818]'), 'Desktop mode must not contain mobile rounded cards');

    const mobileBlock = src.substring(desktopEndIndex);
    assert.ok(mobileBlock.includes('rounded-xl bg-[#181818]'), 'Mobile mode must preserve rounded-xl bg-[#181818] cards');
  });

  it('audioEngine.ts connects spatial panner, rear damping filter, mono downmix node, and speed controls', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src/services/audioEngine.ts'), 'utf8');
    assert.ok(src.includes('spatialPannerNode'), 'audioEngine must declare spatialPannerNode');
    assert.ok(src.includes('spatialRearFilter'), 'audioEngine must declare spatialRearFilter');
    assert.ok(src.includes('monoNode'), 'audioEngine must declare monoNode');
    assert.ok(src.includes('setPlaybackSpeedAndPitch('), 'audioEngine must implement setPlaybackSpeedAndPitch');
    assert.ok(src.includes('setSpatialAndMono('), 'audioEngine must implement setSpatialAndMono');
    assert.ok(src.includes('this.monoNode.channelCount = opts.mono ? 1 : 2'), 'Mono downmix must switch channelCount 1 vs 2');
  });

  it('usePlayerStore.ts and shuffleOrder.ts skip and filter disliked tracks', () => {
    const storeSrc = fs.readFileSync(path.join(ROOT, 'src/store/usePlayerStore.ts'), 'utf8');
    assert.ok(storeSrc.includes('dislikeCurrentTrack:'), 'usePlayerStore must expose dislikeCurrentTrack');
    assert.ok(storeSrc.includes('isTrackDisliked'), 'usePlayerStore nextTrack must check disliked songs');

    const shuffleSrc = fs.readFileSync(path.join(ROOT, 'src/utils/shuffleOrder.ts'), 'utf8');
    assert.ok(shuffleSrc.includes('!isTrackDisliked(t)'), 'shuffleOrder must exclude disliked tracks when rating is active');
  });

  it('Android Auto MediaSession integrates dislike custom action and icon', () => {
    const svcSrc = fs.readFileSync(path.join(ROOT, 'native/android/SpotifreeMediaService.java'), 'utf8');
    assert.ok(svcSrc.includes('ACT_DISLIKE = "dislike"'), 'SpotifreeMediaService must define ACT_DISLIKE');
    assert.ok(svcSrc.includes('R.drawable.ic_car_dislike'), 'SpotifreeMediaService must bind ic_car_dislike drawable');
    assert.ok(svcSrc.includes('if (dislikeEnabled)'), 'Dislike action must be conditionally attached when active');

    const pluginSrc = fs.readFileSync(path.join(ROOT, 'native/android/SpotifreeMediaPlugin.java'), 'utf8');
    assert.ok(pluginSrc.includes('dislikeEnabled'), 'SpotifreeMediaPlugin must parse dislikeEnabled parameter');

    const mediaSrc = fs.readFileSync(path.join(ROOT, 'src/services/nativeMedia.ts'), 'utf8');
    assert.ok(mediaSrc.includes("case 'dislike':"), 'nativeMedia must route car dislike command');
    assert.ok(mediaSrc.includes('player.dislikeCurrentTrack?.()'), 'nativeMedia must invoke dislikeCurrentTrack');

    const drawablePath = path.join(ROOT, 'native/android/res/drawable/ic_car_dislike.xml');
    assert.ok(fs.existsSync(drawablePath), 'ic_car_dislike.xml must exist');
  });

  it('DesktopPlayer, MobileNowPlayingModal, and ContextMenu expose speed sheet & like/dislike buttons', () => {
    const desktopPlayer = fs.readFileSync(path.join(ROOT, 'src/components/desktop/DesktopPlayer.tsx'), 'utf8');
    assert.ok(desktopPlayer.includes('openSpeedControlSheet'), 'DesktopPlayer must trigger speed control sheet');
    assert.ok(desktopPlayer.includes('dislikeCurrentTrack'), 'DesktopPlayer must wire dislike button');

    const mobileModal = fs.readFileSync(path.join(ROOT, 'src/components/mobile/MobileNowPlayingModal.tsx'), 'utf8');
    assert.ok(mobileModal.includes('openSpeedControlSheet'), 'MobileNowPlayingModal must trigger speed control sheet');
    assert.ok(mobileModal.includes('dislikeCurrentTrack'), 'MobileNowPlayingModal must wire dislike button');

    const contextMenu = fs.readFileSync(path.join(ROOT, 'src/components/desktop/ContextMenu.tsx'), 'utf8');
    assert.ok(contextMenu.includes('openSpeedControlSheet'), 'ContextMenu must offer speed control option');
    assert.ok(contextMenu.includes('markTasteDislike'), 'ContextMenu must offer dislike option');

    const appSrc = fs.readFileSync(path.join(ROOT, 'src/App.tsx'), 'utf8');
    assert.ok(appSrc.includes('<SpeedControlModal />'), 'App.tsx must mount SpeedControlModal globally');
  });
});
