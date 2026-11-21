import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const readRel = (p) => fs.readFileSync(path.join(root, p), 'utf8');

describe('Spotifree v0.6.3: Instant DJ Performance, Always-Speaking Preview & Black Screen Crashes Guard', () => {
  it('1. Track sanitization & null safety in usePlayerStore.ts', () => {
    const code = readRel('src/store/usePlayerStore.ts');
    assert.ok(code.includes('export function sanitizeTrack('), 'Must export sanitizeTrack helper');
    assert.ok(code.includes('safeTrack = sanitizeTrack(track)'), 'playTrack must sanitize incoming track');
    assert.ok(code.includes('art-unknown') && code.includes('Desconocido'), 'Must provide safe fallback artist when empty');
    assert.ok(code.includes('console.warn(\'[MediaSession] nexttrack error:\'') || code.includes('nextTrack error'), 'Must guard nextTrack MediaSession handler with try/catch');
  });

  it('2. Resilient auto-recovering ErrorBoundary against black screen crashes', () => {
    const eb = readRel('src/components/common/ErrorBoundary.tsx');
    assert.ok(eb.includes('fixed inset-0'), 'ErrorBoundary must be fixed inset-0 to cover full screen');
    assert.ok(eb.includes('recoveryTimer'), 'ErrorBoundary must implement automatic recovery timer');
    assert.ok(eb.includes('this.setState({ hasError: false, error: null })'), 'Must self-heal error state');
    
    const css = readRel('src/index.css');
    assert.ok(css.includes('html, body, #root {') && css.includes('min-height: 100%'), 'index.css must ensure #root never collapses');
  });

  it('3. MobileMiniPlayer uses lightweight image instead of background video decoding', () => {
    const mini = readRel('src/components/mobile/MobileMiniPlayer.tsx');
    assert.ok(!mini.includes('<MotionCover'), 'MobileMiniPlayer thumbnail must NOT mount MotionCover video decoder');
    assert.ok(mini.includes('<img') && mini.includes('src={coverUrl}'), 'MobileMiniPlayer must render optimized img');
  });

  it('4. MotionCover pauses and releases decoders on screen off / background', () => {
    const mc = readRel('src/components/common/MotionCover.tsx');
    assert.ok(mc.includes('document.hidden'), 'MotionCover must check document.hidden');
    assert.ok(mc.includes('visibilitychange'), 'MotionCover must listen to visibilitychange to pause video');
  });

  it('5. DJ Instant Audio Startup & Voice Watchdog in aiDJService & aiDJVoiceService', () => {
    const voice = readRel('src/services/aiDJVoiceService.ts');
    assert.ok(voice.includes('isAudioUnlocked'), 'aiDJVoiceService must track isAudioUnlocked to avoid repeated synchronous IPC');
    assert.ok(voice.includes('AbortSignal.timeout(2800)'), 'fetchSpeech must have fast <= 2800ms timeout');

    const dj = readRel('src/services/aiDJService.ts');
    assert.ok(dj.includes('audioEngine.restoreDuckedVolume('), 'djSpeak must restore ducked volume with watchdog');
    assert.ok(dj.includes('!introVoiceHeard'), 'Must restore volume if speech has not started');
  });

  it('6. In-memory fast DJ set building without blocking search', () => {
    const seg = readRel('src/services/djSegments.ts');
    assert.ok(seg.includes('library.length < 8'), 'Must avoid external search when user library has sufficient tracks');
    assert.ok(seg.includes('setTimeout(() => resolve(null), 400)'), 'search timeout must be fast 400ms');
  });

  it('7. Home DJ Card: Compact Rectangle & Larger Always-Speaking Visualizer', () => {
    const mob = readRel('src/components/mobile/MobileLayout.tsx');
    assert.ok(mob.includes('min-h-[118px]') || mob.includes('min-h-[120px]'), 'DJ card must be compact (min-h-[118px] or 120px)');
    assert.ok(mob.includes('state="speaking"'), 'Preview visualizer state must be "speaking"');
    assert.ok(mob.includes('forceWaves={true}'), 'Preview visualizer must force waves');
    assert.ok(/size=\{14[0-9]\}/.test(mob), 'Visualizer size in preview card must be enlarged >= 140');

    const desk = readRel('src/components/desktop/DesktopHomeView.tsx');
    assert.ok(desk.includes('state="speaking"'), 'Desktop DJ preview must be speaking');
    assert.ok(desk.includes('forceWaves={true}'), 'Desktop DJ preview must force waves');
  });
});
