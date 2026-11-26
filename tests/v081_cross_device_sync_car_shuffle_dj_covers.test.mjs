import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

// Mock minimal browser storage before loading Zustand stores & services
const storageMap = new Map();
if (!globalThis.window) {
  globalThis.window = {
    location: { origin: 'http://localhost', search: '', pathname: '/', hash: '' },
    localStorage: {
      getItem: (k) => (storageMap.has(k) ? storageMap.get(k) : null),
      setItem: (k, v) => storageMap.set(k, String(v)),
      removeItem: (k) => storageMap.delete(k),
      clear: () => storageMap.clear(),
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  };
}
if (!globalThis.CustomEvent) {
  globalThis.CustomEvent = class CustomEvent extends Event {
    constructor(type, params) {
      super(type, params);
      this.detail = params?.detail;
    }
  };
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    const parent = context.parentURL || '';
    const isProjectFile = !parent.includes('/node_modules/') && !parent.includes('\\node_modules\\');
    if (isProjectFile && (specifier.startsWith('./') || specifier.startsWith('../')) && !/\.[a-z0-9]+$/i.test(specifier) && parent) {
      for (const ext of ['.ts', '.tsx', '.js']) {
        const candidate = new URL(`${specifier}${ext}`, parent);
        if (fs.existsSync(fileURLToPath(candidate))) {
          return nextResolve(candidate.href, context);
        }
      }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if ((url.endsWith('.tsx') || url.endsWith('.ts')) && !url.includes('/node_modules/')) {
      const source = fs
        .readFileSync(fileURLToPath(url), 'utf8')
        .replace(/\bimport\.meta\.env\b/g, '({})');
      const transpiled = ts.transpileModule(source, {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.React,
        },
        fileName: fileURLToPath(url),
      });
      return { format: 'module', source: transpiled.outputText, shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});

const { slimPlaybackSnapshotForCloud } = await import('../src/services/firebase.ts');
const { shouldApplyRemotePlayback, applyRemotePlayback, capturePlaybackSnapshot } = await import('../src/services/playbackSync.ts');
const { usePlayerStore } = await import('../src/store/usePlayerStore.ts');
const { normCover, sameTitle } = await import('../src/utils/trackCovers.tsx');

const makeTrack = (id, name, artist = 'Artist', extra = {}) => ({
  id,
  name,
  uri: `spotify:track:${id}`,
  duration_ms: 205000,
  artists: [{ id: `art-${id}`, name: artist }],
  album: {
    id: `alb-${id}`,
    name: `Album ${name}`,
    images: [{ url: `https://i.scdn.co/image/${id}`, height: 300, width: 300 }],
  },
  ...extra,
});

describe('v081: Cross-Device Sync, Car Shuffle Icons & DJ Cover/Audio Reliability', () => {
  it('1. Strict Zero-Emoji Check on New & Modified Files', () => {
    const files = [
      'src/services/playbackSync.ts',
      'src/services/firebase.ts',
      'native/android/SpotifreeMediaPlugin.java',
      'native/android/SpotifreeMediaService.java',
      'native/android/res/drawable/ic_car_shuffle_off.xml',
      'native/android/res/drawable/ic_car_shuffle_on.xml',
      'native/android/res/drawable/ic_car_shuffle_smart.xml',
      'tests/v081_cross_device_sync_car_shuffle_dj_covers.test.mjs',
    ];
    const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}]/u;
    for (const f of files) {
      const content = fs.readFileSync(path.resolve(f), 'utf8');
      assert.ok(!emojiRegex.test(content), `File ${f} must contain zero emojis`);
    }
  });

  it('2. slimPlaybackSnapshotForCloud preserves Smart Shuffle flags, repeatMode & centers around current track', () => {
    const bigPlaylist = Array.from({ length: 220 }, (_, i) =>
      makeTrack(`tr-${i}`, `Track ${i}`, 'Artist', i === 191 || i === 192 ? { isSmartRecommendation: true, queueId: `q-${i}` } : {})
    );

    const compact = slimPlaybackSnapshotForCloud({
      version: 1,
      updatedAt: Date.now(),
      deviceId: 'phone-1',
      wasPlaying: false,
      progressMs: 74200,
      durationMs: 205000,
      currentContextId: 'pl-Workout',
      currentContextName: 'Gym Mix',
      shuffleMode: 'smart',
      isShuffle: true,
      repeatMode: 'all',
      playedInShuffle: ['tr-188', 'tr-189', 'tr-190'],
      preselectedNextTrackId: 'tr-191',
      currentTrack: bigPlaylist[190],
      queue: bigPlaylist,
      originalQueue: bigPlaylist,
      djState: null,
    });

    assert.ok(compact, 'Snapshot should be generated');
    assert.equal(compact.shuffleMode, 'smart');
    assert.equal(compact.repeatMode, 'all');
    assert.equal(compact.progressMs, 74200);
    assert.equal(compact.currentContextId, 'pl-Workout');
    assert.equal(compact.currentContextName, 'Gym Mix');

    // Window slicing must retain track 190 and its upcoming Smart Shuffle tracks 191 & 192
    const ids = compact.queue.map((t) => t.id);
    assert.ok(ids.includes('tr-190'), 'Current track near end of large playlist must stay in queue slice');
    const smart191 = compact.queue.find((t) => t.id === 'tr-191');
    const smart192 = compact.queue.find((t) => t.id === 'tr-192');
    assert.equal(smart191?.isSmartRecommendation, true, 'Smart Shuffle recommendation flag must survive slimming');
    assert.equal(smart191?.queueId, 'q-191', 'queueId must survive slimming');
    assert.equal(smart192?.isSmartRecommendation, true, 'Second Smart Shuffle recommendation flag must survive slimming');
  });

  it('3. shouldApplyRemotePlayback protects active playback & echoes, allows newer remote state', () => {
    const remote = {
      version: 1,
      updatedAt: 2000,
      deviceId: 'car-dev',
      currentTrack: makeTrack('t-1', 'Song One'),
    };

    // Blocks while currently playing locally
    assert.equal(
      shouldApplyRemotePlayback({
        remote,
        localDeviceId: 'pc-dev',
        isLocallyPlaying: true,
        hasLocalCurrentTrack: true,
        lastLocalInteractionAt: 1000,
        lastAppliedRemoteAt: 500,
      }),
      false
    );

    // Blocks own device echo when already hydrated
    assert.equal(
      shouldApplyRemotePlayback({
        remote: { ...remote, deviceId: 'pc-dev' },
        localDeviceId: 'pc-dev',
        isLocallyPlaying: false,
        hasLocalCurrentTrack: true,
        lastLocalInteractionAt: 1000,
        lastAppliedRemoteAt: 500,
      }),
      false
    );

    // Blocks stale timestamp older than local interaction
    assert.equal(
      shouldApplyRemotePlayback({
        remote,
        localDeviceId: 'pc-dev',
        isLocallyPlaying: false,
        hasLocalCurrentTrack: true,
        lastLocalInteractionAt: 3000,
        lastAppliedRemoteAt: 500,
      }),
      false
    );

    // Applies newer paused remote state from another device
    assert.equal(
      shouldApplyRemotePlayback({
        remote,
        localDeviceId: 'pc-dev',
        isLocallyPlaying: false,
        hasLocalCurrentTrack: true,
        lastLocalInteractionAt: 1500,
        lastAppliedRemoteAt: 1000,
      }),
      true
    );
  });

  it('4. applyRemotePlayback hydrates paused player store with Smart Shuffle tracks at exact second', () => {
    const t1 = makeTrack('t-10', 'Song Ten', 'Artist A');
    const tSmart = makeTrack('t-smart-1', 'Smart Pick', 'Artist B', { isSmartRecommendation: true });
    const t2 = makeTrack('t-11', 'Song Eleven', 'Artist A');

    const applied = applyRemotePlayback(
      {
        version: 1,
        updatedAt: Date.now() + 5000,
        deviceId: 'mobile-phone-99',
        wasPlaying: false,
        progressMs: 91500,
        durationMs: 210000,
        currentContextId: 'pl-night',
        currentContextName: 'Night Drive',
        shuffleMode: 'smart',
        isShuffle: true,
        repeatMode: 'one',
        playedInShuffle: ['t-10'],
        preselectedNextTrackId: 't-smart-1',
        currentTrack: t1,
        queue: [t1, tSmart, t2],
        originalQueue: [t1, t2],
        djState: null,
      },
      true
    );

    assert.equal(applied, true);
    const st = usePlayerStore.getState();
    assert.equal(st.isPlaying, false, 'Restored cross-device playback must remain paused until user presses play');
    assert.equal(st.currentTrack?.id, 't-10');
    assert.equal(st.progressMs, 91500);
    assert.equal(st.shuffleMode, 'smart');
    assert.equal(st.isShuffle, true);
    assert.equal(st.repeatMode, 'one');
    assert.equal(st.currentContextId, 'pl-night');
    assert.equal(st.currentContextName, 'Night Drive');
    assert.equal(st.queue.length, 3);
    assert.equal((st.queue[1]).isSmartRecommendation, true);

    const captured = capturePlaybackSnapshot();
    assert.equal(captured?.progressMs, 91500);
    assert.equal(captured?.shuffleMode, 'smart');
    assert.equal((captured?.queue[1]).isSmartRecommendation, true);
  });

  it('5. AudioController & AudioEngine handle paused cross-device resume without restarting from 0:00', () => {
    const audioControllerSrc = fs.readFileSync(path.resolve('src/components/common/AudioController.tsx'), 'utf8');
    const audioEngineSrc = fs.readFileSync(path.resolve('src/services/audioEngine.ts'), 'utf8');

    assert.ok(audioControllerSrc.includes('if (!isPlaying) return;'), 'AudioController must not call playTrack(0) when currentTrack changes while paused');
    assert.ok(audioEngineSrc.includes('public resetForRestoredTrack()'), 'AudioEngine must expose resetForRestoredTrack');
    assert.ok(audioEngineSrc.includes('cleanEngine !== cleanCurrent'), 'AudioEngine.resume() must check if loaded track mismatches restored track');
    assert.ok(audioEngineSrc.includes('/^(?:yt-|rec-ytm?-)([a-zA-Z0-9_-]{11})$/i'), 'AudioEngine.resolveVideoId must fast-extract direct yt- IDs');
  });

  it('6. Android Auto visually differentiates off, normal shuffle, and smart shuffle across JS, Java & XML drawables', () => {
    const nativeMediaSrc = fs.readFileSync(path.resolve('src/services/nativeMedia.ts'), 'utf8');
    const pluginSrc = fs.readFileSync(path.resolve('native/android/SpotifreeMediaPlugin.java'), 'utf8');
    const serviceSrc = fs.readFileSync(path.resolve('native/android/SpotifreeMediaService.java'), 'utf8');

    const offXml = fs.readFileSync(path.resolve('native/android/res/drawable/ic_car_shuffle_off.xml'), 'utf8');
    const onXml = fs.readFileSync(path.resolve('native/android/res/drawable/ic_car_shuffle_on.xml'), 'utf8');
    const smartXml = fs.readFileSync(path.resolve('native/android/res/drawable/ic_car_shuffle_smart.xml'), 'utf8');

    assert.ok(nativeMediaSrc.includes('shuffleMode'), 'nativeMedia.ts must send shuffleMode to Android Auto');
    assert.ok(nativeMediaSrc.includes('getTrackCoverUrl'), 'nativeMedia.ts must resolve cover using getTrackCoverUrl');
    assert.ok(pluginSrc.includes('call.getString("shuffleMode"'), 'SpotifreeMediaPlugin must read shuffleMode string');
    assert.ok(serviceSrc.includes('R.drawable.ic_car_shuffle_off'), 'SpotifreeMediaService must use ic_car_shuffle_off');
    assert.ok(serviceSrc.includes('R.drawable.ic_car_shuffle_on'), 'SpotifreeMediaService must use ic_car_shuffle_on');
    assert.ok(serviceSrc.includes('R.drawable.ic_car_shuffle_smart'), 'SpotifreeMediaService must use ic_car_shuffle_smart');
    assert.ok(serviceSrc.includes('ACT_SHUFFLE + ":" + shufMode'), 'Action IDs must differ per shuffleMode to bypass Android Auto icon cache');

    // Distinct drawables check: off has dimmed alpha and no dot, on has separated dot, smart has sparkle and no dot
    assert.ok(offXml.includes('#72FFFFFF'), 'ic_car_shuffle_off must use muted alpha');
    assert.ok(onXml.includes('#FF1ED760') && onXml.includes('18.8'), 'ic_car_shuffle_on must render green arrows + separated indicator dot');
    assert.ok(smartXml.includes('#FF1ED760') && smartXml.includes('M4.2,1.0') && !smartXml.includes('18.8'), 'ic_car_shuffle_smart must render top-left 4-point sparkle without bottom dot');
  });

  it('7. DJ mode cover matching & player cover components avoid stale artwork and support short/YouTube titles', () => {
    assert.equal(normCover('Luna | Video Oficial (En Vivo)'), 'luna');
    assert.equal(sameTitle('Luna', 'Luna - Official Audio'), true);
    assert.equal(sameTitle('Ella', 'Ella'), true);
    assert.equal(sameTitle('Other Song', 'Luna'), false);

    const trackCoversSrc = fs.readFileSync(path.resolve('src/utils/trackCovers.tsx'), 'utf8');
    const aiDjSrc = fs.readFileSync(path.resolve('src/services/aiDJService.ts'), 'utf8');
    const desktopSrc = fs.readFileSync(path.resolve('src/components/desktop/DesktopPlayer.tsx'), 'utf8');
    const miniSrc = fs.readFileSync(path.resolve('src/components/mobile/MobileMiniPlayer.tsx'), 'utf8');
    const modalSrc = fs.readFileSync(path.resolve('src/components/mobile/MobileNowPlayingModal.tsx'), 'utf8');
    const djViewSrc = fs.readFileSync(path.resolve('src/components/dj/AIDJView.tsx'), 'utf8');

    assert.ok(trackCoversSrc.includes('/api/search?q='), 'findExactCover should include /api/search catalog fallback');
    assert.ok(trackCoversSrc.includes('handleTrackCoverError'), 'Shared handleTrackCoverError retry helper must exist');
    assert.ok(aiDjSrc.includes('missingArtwork') && aiDjSrc.includes('hydrateAndSyncDJCovers'), 'aiDJService must hydrate upcoming DJ artwork on track changes');
    assert.ok(desktopSrc.includes('setResolvedDesktopCover(undefined)'), 'DesktopPlayer must reset stale resolvedDesktopCover on track switch');
    assert.ok(miniSrc.includes('setResolvedCover(undefined)') && miniSrc.includes('isPlaylistOrGenericCover(direct)'), 'MobileMiniPlayer must reset stale cover and reject generic covers');
    assert.ok(modalSrc.includes('failedCoverUrlRef') && modalSrc.includes('isPlaylistOrGenericCover(immediateCover)'), 'MobileNowPlayingModal must track failed URLs and reject generic covers');
    assert.ok(djViewSrc.includes('handleTrackCoverError'), 'AIDJView must retry exact cover lookup on image load error');
  });

  it('8. Version 1.0 release metadata & Créditos tab in About section', () => {
    const pkg = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8'));
    const changelog = fs.readFileSync(path.resolve('src/data/changelog.ts'), 'utf8');
    const aboutSrc = fs.readFileSync(path.resolve('src/components/common/AboutAppSection.tsx'), 'utf8');

    assert.ok(['1.0.0', '1.1.0', '1.2.0', '1.3.0'].includes(pkg.version));
    assert.ok(/export const APP_VERSION = '1\.[0-9]+';/.test(changelog));
    assert.ok(changelog.includes("version: '1.0'"));
    assert.ok(aboutSrc.includes('Versiones') && aboutSrc.includes('Créditos'));
    assert.ok(aboutSrc.includes('Jorge Pérez'));
    assert.ok(aboutSrc.includes('https://github.com/Gekamil'));
  });
});
